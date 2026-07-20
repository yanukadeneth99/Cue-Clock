const test = require('node:test');
const assert = require('node:assert');
const {
  buildIssueTitle,
  buildIssueBody,
  crashConsoleUrl,
  fenceBlock,
  isSafeIssueId,
  MAX_TITLE_CHARS,
} = require('./crashes.js');

// Counts the pipes in a line that markdown would treat as REAL table separators.
// A pipe only stays inert when it is preceded by an odd number of backslashes
// (the last backslash escapes it). An even number (including zero) pairs the
// backslashes off on their own and leaves the pipe active, splitting the row.
function countUnescapedPipes(line) {
  let count = 0;
  let backslashRun = 0;
  for (const ch of line) {
    if (ch === '\\') {
      backslashRun += 1;
      continue;
    }
    if (ch === '|' && backslashRun % 2 === 0) count += 1;
    backslashRun = 0;
  }
  return count;
}

function cluster(over) {
  return {
    issueId: 'abc123',
    errorType: 'FATAL',
    eventCount: 12,
    distinctInstalls: 3,
    firstSeen: '2026-07-14T08:00:00Z',
    lastSeen: '2026-07-19T09:30:00Z',
    minAppVersion: '0.1.2',
    maxAppVersion: '0.1.3',
    blameFrame: { file: 'HomeScreen.kt', line: 42, symbol: 'onCreate', library: 'app' },
    exceptions: [
      {
        type: 'java.lang.NullPointerException',
        exception_message: 'boom',
        frames: [{ file: 'HomeScreen.kt', line: 42, symbol: 'onCreate', library: 'app' }],
      },
    ],
    ...over,
  };
}

test('buildIssueTitle uses the exception type and message when present', () => {
  assert.strictEqual(
    buildIssueTitle(cluster({})),
    '[crash] java.lang.NullPointerException: boom',
  );
});

test('buildIssueTitle falls back to the blame frame when there is no exception', () => {
  const title = buildIssueTitle(cluster({ exceptions: [] }));
  assert.strictEqual(title, '[crash] HomeScreen.kt:42');
});

test('buildIssueTitle falls back to the issue id when nothing else is known', () => {
  const title = buildIssueTitle(cluster({ exceptions: [], blameFrame: null }));
  assert.strictEqual(title, '[crash] abc123');
});

test('buildIssueTitle falls back to "unknown crash" when even the issue id is missing', () => {
  // No exception, no blame frame, and no issue id: the title must still say something
  // readable instead of the literal word "undefined".
  const title = buildIssueTitle(cluster({ exceptions: [], blameFrame: null, issueId: undefined }));
  assert.strictEqual(title, '[crash] unknown crash');
});

test('buildIssueTitle flattens a message containing line breaks', () => {
  const title = buildIssueTitle(cluster({
    exceptions: [{ type: 'E', exception_message: 'first\nsecond', frames: [] }],
  }));
  assert.strictEqual(title, '[crash] E: first second');
});

test('buildIssueTitle truncates a very long message', () => {
  const title = buildIssueTitle(cluster({
    exceptions: [{ type: 'E', exception_message: 'x'.repeat(500), frames: [] }],
  }));
  assert.strictEqual(title.length, MAX_TITLE_CHARS);
  assert.ok(title.endsWith('…'));
});

test('fenceBlock wraps plain content in a three-backtick fence', () => {
  const out = fenceBlock('hello');
  assert.strictEqual(out, '```text\nhello\n```');
});

test('fenceBlock grows the fence so content cannot escape it', () => {
  // Crash text containing its own fence must not break out of the block.
  const out = fenceBlock('before\n```\nafter');
  assert.ok(out.startsWith('````text\n'));
  assert.ok(out.endsWith('\n````'));
});

test('crashConsoleUrl builds the documented console path', () => {
  assert.strictEqual(
    crashConsoleUrl({ projectId: 'cue-clock', appId: '1:2:android:3', issueId: 'abc123' }),
    'https://console.firebase.google.com/project/cue-clock/crashlytics/app/1:2:android:3/issues/abc123',
  );
});

test('buildIssueBody puts the issue id on its own line for deduplication', () => {
  const body = buildIssueBody(cluster({}), { consoleUrl: 'https://x', priorIssue: null });
  assert.ok(body.includes('\nCrashlytics issue id: `abc123`\n'));
});

test('buildIssueBody writes the issue id raw, with no escaping', () => {
  // Regression test for the dedup invariant: the later search looks for this exact text,
  // so an underscore in the id must show up as a real underscore, not as "\_". cell() would
  // have escaped it, which would silently break the search and cause a duplicate issue.
  const body = buildIssueBody(cluster({ issueId: 'abc_123-def' }), {
    consoleUrl: 'https://x', priorIssue: null,
  });
  assert.ok(body.includes('\nCrashlytics issue id: `abc_123-def`\n'));
});

test('buildIssueBody keeps an at-mention in crash text inert inside the fence', () => {
  const body = buildIssueBody(cluster({
    exceptions: [{
      type: 'E',
      exception_message: 'hi @yanukadeneth99',
      frames: [{ file: '@everyone.kt', line: 1, symbol: 'boom', library: 'app' }],
    }],
  }), { consoleUrl: 'https://x', priorIssue: null });

  // Find the opening and closing fence so we can check what is actually BETWEEN them,
  // not just that the mention shows up somewhere after the first backtick run.
  const openFence = '```text\n';
  const fenceStart = body.indexOf(openFence);
  assert.ok(fenceStart > -1, 'expected an opening fence');
  const contentStart = fenceStart + openFence.length;
  const fenceEnd = body.indexOf('\n```', contentStart);
  assert.ok(fenceEnd > -1, 'expected a closing fence');
  const fenced = body.slice(contentStart, fenceEnd);

  // Both the frame file name and the exception message must sit inside the fence.
  assert.ok(fenced.includes('@everyone.kt'));
  assert.ok(fenced.includes('hi @yanukadeneth99'));

  // And neither mention should leak into the bare prose outside the fence.
  const outsideFence = body.slice(0, fenceStart) + body.slice(fenceEnd + '\n```'.length);
  assert.ok(!outsideFence.includes('@everyone.kt'));
  assert.ok(!outsideFence.includes('@yanukadeneth99'));
});

test('buildIssueBody escapes a pipe so it cannot break the table', () => {
  const body = buildIssueBody(cluster({ maxAppVersion: '0.1.3 | injected' }), {
    consoleUrl: 'https://x', priorIssue: null,
  });
  assert.ok(body.includes('0.1.3 \\| injected'));
});

test('buildIssueBody keeps a table row intact when a backslash sits right before a pipe', () => {
  // Regression test for the escaping bug: cell() used to only escape "|", so a crash
  // value that already ended in a backslash (like "evil\|injected") came out with an
  // EVEN number of backslashes in front of the pipe. Markdown pairs those backslashes
  // off and the pipe goes back to being a real column separator, splitting the row.
  const body = buildIssueBody(cluster({ maxAppVersion: 'evil\\|injected' }), {
    consoleUrl: 'https://x', priorIssue: null,
  });

  const row = body.split('\n').find((line) => line.startsWith('| App versions'));
  assert.ok(row, 'expected to find the app versions row');

  // A correctly escaped row has exactly 3 real column pipes: leading, middle, trailing.
  // If the injected pipe survives as a real separator, this count comes out as 4 instead,
  // which is what the old single-replace cell() produced.
  assert.strictEqual(countUnescapedPipes(row), 3);
});

test('buildIssueBody links the previous issue when this is a regression', () => {
  const body = buildIssueBody(cluster({}), { consoleUrl: 'https://x', priorIssue: 120 });
  assert.ok(body.includes('#120'));
});

test('buildIssueBody says so plainly when no stack trace was exported', () => {
  const body = buildIssueBody(cluster({ exceptions: [] }), {
    consoleUrl: 'https://x', priorIssue: null,
  });
  assert.ok(body.includes('No stack trace was exported'));
});

const { decideAction, applyCap, MAX_ISSUES_PER_RUN } = require('./crashes.js');

test('decideAction files a crash that has never been reported', () => {
  const out = decideAction(cluster({}), []);
  assert.strictEqual(out.action, 'file');
  assert.strictEqual(out.priorIssue, null);
});

test('decideAction skips a crash that already has an open issue', () => {
  const out = decideAction(cluster({}), [{ number: 5, state: 'OPEN', closedAt: null }]);
  assert.strictEqual(out.action, 'skip');
});

test('decideAction skips when an open issue exists alongside older closed ones', () => {
  const out = decideAction(cluster({ lastSeen: '2026-07-19T00:00:00Z' }), [
    { number: 4, state: 'CLOSED', closedAt: '2026-07-01T00:00:00Z' },
    { number: 5, state: 'OPEN', closedAt: null },
  ]);
  assert.strictEqual(out.action, 'skip');
});

test('decideAction files a regression when the crash came back after the close', () => {
  const out = decideAction(cluster({ lastSeen: '2026-07-19T00:00:00Z' }), [
    { number: 120, state: 'CLOSED', closedAt: '2026-07-10T00:00:00Z' },
  ]);
  assert.strictEqual(out.action, 'file');
  assert.strictEqual(out.priorIssue, 120);
});

test('decideAction skips when every event predates the close', () => {
  // The seven day window still contains crashes from before we closed the issue.
  // Filing here would report a regression that never happened.
  const out = decideAction(cluster({ lastSeen: '2026-07-09T00:00:00Z' }), [
    { number: 120, state: 'CLOSED', closedAt: '2026-07-10T00:00:00Z' },
  ]);
  assert.strictEqual(out.action, 'skip');
});

test('decideAction treats an event exactly at the close time as not a regression', () => {
  const out = decideAction(cluster({ lastSeen: '2026-07-10T00:00:00Z' }), [
    { number: 120, state: 'CLOSED', closedAt: '2026-07-10T00:00:00Z' },
  ]);
  assert.strictEqual(out.action, 'skip');
});

test('decideAction compares against the newest close when several issues exist', () => {
  // The newest close (07-15) sits FIRST here and the older one (07-01) sits LAST.
  // This locks in "newest by date", not "last in the array": a naive implementation
  // that reads closed[closed.length - 1] would pick the 07-01 issue instead, decide
  // the crash came back after that close, and wrongly file instead of skip.
  const out = decideAction(cluster({ lastSeen: '2026-07-12T00:00:00Z' }), [
    { number: 130, state: 'CLOSED', closedAt: '2026-07-15T00:00:00Z' },
    { number: 100, state: 'CLOSED', closedAt: '2026-07-01T00:00:00Z' },
  ]);
  assert.strictEqual(out.action, 'skip');
});

test('decideAction skips a closed match with no close time rather than risking a duplicate', () => {
  const out = decideAction(cluster({}), [{ number: 7, state: 'CLOSED', closedAt: null }]);
  assert.strictEqual(out.action, 'skip');
});

test('decideAction skips when the only match has a state it does not recognise', () => {
  // A state that is neither OPEN nor CLOSED (a typo, a future GitHub state) must not be
  // treated as closed just because it has a closedAt. We cannot safely judge it, so skip.
  const out = decideAction(cluster({ lastSeen: '2026-07-19T00:00:00Z' }), [
    { number: 9, state: 'WEIRD', closedAt: '2026-07-10T00:00:00Z' },
  ]);
  assert.strictEqual(out.action, 'skip');
});

test('applyCap keeps the first items and reports the rest', () => {
  const many = [1, 2, 3, 4, 5, 6, 7].map((n) => cluster({ issueId: `id${n}` }));
  const out = applyCap(many, MAX_ISSUES_PER_RUN);
  assert.strictEqual(out.selected.length, 5);
  assert.strictEqual(out.dropped.length, 2);
  assert.strictEqual(out.selected[0].issueId, 'id1');
});

test('applyCap drops nothing when the list is short', () => {
  const out = applyCap([cluster({})], MAX_ISSUES_PER_RUN);
  assert.strictEqual(out.selected.length, 1);
  assert.strictEqual(out.dropped.length, 0);
});

test('isSafeIssueId accepts a normal hex id', () => {
  assert.strictEqual(isSafeIssueId('abc123def456'), true);
});

test('isSafeIssueId accepts an id with an underscore and a hyphen', () => {
  assert.strictEqual(isSafeIssueId('abc_123-def'), true);
});

test('isSafeIssueId rejects an empty string', () => {
  assert.strictEqual(isSafeIssueId(''), false);
});

test('isSafeIssueId rejects null', () => {
  assert.strictEqual(isSafeIssueId(null), false);
});

test('isSafeIssueId rejects an id containing a backtick', () => {
  assert.strictEqual(isSafeIssueId('abc`123'), false);
});

test('isSafeIssueId rejects an id containing a space', () => {
  assert.strictEqual(isSafeIssueId('abc 123'), false);
});

test('isSafeIssueId rejects an id containing a pipe', () => {
  assert.strictEqual(isSafeIssueId('abc|123'), false);
});
