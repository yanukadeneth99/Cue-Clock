const test = require('node:test');
const assert = require('node:assert');
const {
  DEFAULT_MODEL,
  MAX_ISSUES,
  MAX_TEXT_CHARS,
  RETRY_DELAY_MS,
  isSafeModelName,
  endpointFor,
  buildRequestBody,
  validateReview,
  parseGeminiReply,
  shouldRetry,
  reviewScreenshot,
  warningLines,
  buildSummary,
} = require('./screenshot-review.js');

// A Gemini reply whose text part holds the given value as JSON.
function geminiBody(value) {
  return { candidates: [{ content: { parts: [{ text: JSON.stringify(value) }] } }] };
}

// A fake fetch that answers with the given responses in order and records every call.
function fakeFetch(responses) {
  const calls = [];
  const fn = async (url, init) => {
    calls.push({ url, init });
    const next = responses.shift();
    if (next instanceof Error) throw next;
    return {
      ok: next.status >= 200 && next.status < 300,
      status: next.status,
      json: async () => next.body,
    };
  };
  return { fn, calls };
}

function args(over) {
  return {
    sleep: async () => {},
    apiKey: 'test-key-123',
    model: DEFAULT_MODEL,
    expectations: 'Timers are the biggest thing on screen.',
    platform: 'web',
    fileName: 'add-cue-03-done.png',
    imageBase64: 'iVBORw0KGgo=',
    ...over,
  };
}

test('isSafeModelName allows plain model names only', () => {
  assert.strictEqual(isSafeModelName('gemini-3.8-flash'), true);
  assert.strictEqual(isSafeModelName('gemini-2.5-pro'), true);
  assert.strictEqual(isSafeModelName('../evil'), false);
  assert.strictEqual(isSafeModelName('gemini?key=x'), false);
  assert.strictEqual(isSafeModelName(''), false);
  assert.strictEqual(isSafeModelName(undefined), false);
});

test('buildRequestBody sends the image inline and asks for JSON with a schema', () => {
  const body = buildRequestBody(args());
  const parts = body.contents[0].parts;
  assert.match(parts[0].text, /add-cue-03-done\.png/);
  assert.match(parts[0].text, /Timers are the biggest thing on screen\./);
  assert.match(parts[0].text, /web app/);
  assert.deepStrictEqual(parts[1], { inlineData: { mimeType: 'image/png', data: 'iVBORw0KGgo=' } });
  assert.strictEqual(body.generationConfig.responseMimeType, 'application/json');
  assert.deepStrictEqual(body.generationConfig.responseSchema.properties.verdict.enum, ['ok', 'issue']);
});

test('validateReview keeps a well-formed answer', () => {
  const review = validateReview({ verdict: 'issue', issues: [{ severity: 'high', what: 'Countdown is cut off' }] });
  assert.deepStrictEqual(review, { verdict: 'issue', issues: [{ severity: 'high', what: 'Countdown is cut off' }] });
});

test('validateReview rejects answers without a known verdict', () => {
  assert.strictEqual(validateReview({ verdict: 'great', issues: [] }), null);
  assert.strictEqual(validateReview(null), null);
  assert.strictEqual(validateReview([]), null);
  assert.strictEqual(validateReview('ok'), null);
});

test('validateReview drops malformed issues and cuts long text', () => {
  const review = validateReview({
    verdict: 'issue',
    issues: [
      { severity: 'critical', what: 'unknown severity' },
      { severity: 'low', what: 42 },
      null,
      { severity: 'medium', what: 'x'.repeat(MAX_TEXT_CHARS + 50) },
      { severity: 'low', what: 'line one\nline two' },
    ],
  });
  assert.strictEqual(review.issues.length, 2);
  assert.strictEqual(review.issues[0].what.length, MAX_TEXT_CHARS);
  assert.ok(review.issues[0].what.endsWith('…'));
  assert.strictEqual(review.issues[1].what, 'line one line two');
});

test('validateReview caps the number of issues', () => {
  const many = Array.from({ length: MAX_ISSUES + 5 }, (_, i) => ({ severity: 'low', what: `issue ${i}` }));
  assert.strictEqual(validateReview({ verdict: 'issue', issues: many }).issues.length, MAX_ISSUES);
});

test('validateReview turns an "ok" with listed problems into "issue"', () => {
  const review = validateReview({ verdict: 'ok', issues: [{ severity: 'low', what: 'Small gap' }] });
  assert.strictEqual(review.verdict, 'issue');
});

test('parseGeminiReply returns null for text that is not JSON', () => {
  assert.strictEqual(parseGeminiReply({ candidates: [{ content: { parts: [{ text: 'console.log(1)' }] } }] }), null);
  assert.strictEqual(parseGeminiReply({}), null);
  assert.strictEqual(parseGeminiReply({ candidates: [] }), null);
});

test('parseGeminiReply joins split text parts', () => {
  const body = { candidates: [{ content: { parts: [{ text: '{"verdict":' }, { text: '"ok","issues":[]}' }] } }] };
  assert.deepStrictEqual(parseGeminiReply(body), { verdict: 'ok', issues: [] });
});

test('shouldRetry is true for 429 and 5xx only', () => {
  assert.strictEqual(shouldRetry(429), true);
  assert.strictEqual(shouldRetry(500), true);
  assert.strictEqual(shouldRetry(503), true);
  assert.strictEqual(shouldRetry(400), false);
  assert.strictEqual(shouldRetry(403), false);
});

test('reviewScreenshot sends the key in the header and never in the address', async () => {
  const { fn, calls } = fakeFetch([{ status: 200, body: geminiBody({ verdict: 'ok', issues: [] }) }]);
  const review = await reviewScreenshot(args({ fetchFn: fn }));
  assert.deepStrictEqual(review, { verdict: 'ok', issues: [] });
  assert.strictEqual(calls.length, 1);
  assert.strictEqual(calls[0].url, endpointFor(DEFAULT_MODEL));
  assert.ok(!calls[0].url.includes('test-key-123'));
  assert.strictEqual(calls[0].init.headers['x-goog-api-key'], 'test-key-123');
  assert.strictEqual(calls[0].init.method, 'POST');
});

test('reviewScreenshot retries once on 429 and then succeeds', async () => {
  const waits = [];
  const { fn, calls } = fakeFetch([
    { status: 429, body: {} },
    { status: 200, body: geminiBody({ verdict: 'issue', issues: [{ severity: 'medium', what: 'Text overlaps' }] }) },
  ]);
  const review = await reviewScreenshot(args({ fetchFn: fn, sleep: async (ms) => waits.push(ms) }));
  assert.strictEqual(calls.length, 2);
  assert.deepStrictEqual(waits, [RETRY_DELAY_MS]);
  assert.strictEqual(review.verdict, 'issue');
});

test('reviewScreenshot retries only once on repeated server errors', async () => {
  const { fn, calls } = fakeFetch([{ status: 503, body: {} }, { status: 500, body: {} }]);
  const review = await reviewScreenshot(args({ fetchFn: fn }));
  assert.strictEqual(calls.length, 2);
  assert.deepStrictEqual(review, { verdict: 'error', issues: [], error: 'HTTP 500' });
});

test('reviewScreenshot does not retry a 400', async () => {
  const { fn, calls } = fakeFetch([{ status: 400, body: {} }]);
  const review = await reviewScreenshot(args({ fetchFn: fn }));
  assert.strictEqual(calls.length, 1);
  assert.strictEqual(review.error, 'HTTP 400');
});

test('reviewScreenshot reports a network failure without its message', async () => {
  const err = new TypeError('fetch failed for https://example.test/?key=test-key-123');
  const { fn } = fakeFetch([err]);
  const review = await reviewScreenshot(args({ fetchFn: fn }));
  assert.strictEqual(review.verdict, 'error');
  assert.ok(!review.error.includes('test-key-123'));
  assert.match(review.error, /TypeError/);
});

test('reviewScreenshot reports a reply with the wrong shape', async () => {
  const { fn } = fakeFetch([{ status: 200, body: geminiBody({ verdict: 'maybe' }) }]);
  const review = await reviewScreenshot(args({ fetchFn: fn }));
  assert.deepStrictEqual(review, { verdict: 'error', issues: [], error: 'reply did not match the expected shape' });
});

test('warningLines prints one line per issue and encodes line breaks', () => {
  const lines = warningLines(
    [
      { file: 'a.png', verdict: 'ok', issues: [] },
      { file: 'b.png', verdict: 'issue', issues: [{ severity: 'high', what: 'bad\n::error::x 100%' }] },
      { file: 'c,d.png', verdict: 'error', issues: [], error: 'HTTP 500' },
    ],
    'android',
  );
  assert.strictEqual(lines.length, 2);
  assert.ok(lines.every((l) => l.startsWith('::warning title=') && !l.includes('\n')));
  assert.match(lines[0], /\[high\] bad%0A::error::x 100%25$/);
  assert.match(lines[1], /c%2Cd\.png::Not checked: HTTP 500$/);
});

test('buildSummary writes one table row per screenshot and keeps pipes inert', () => {
  const summary = buildSummary(
    [
      { file: 'a.png', verdict: 'ok', issues: [] },
      { file: 'b.png', verdict: 'issue', issues: [{ severity: 'low', what: 'left | right' }] },
      { file: 'c.png', verdict: 'error', issues: [], error: 'HTTP 429' },
    ],
    { platform: 'web', model: DEFAULT_MODEL },
  );
  const rows = summary.split('\n').filter((l) => l.startsWith('| ') && !l.startsWith('| File') && !l.startsWith('| ---'));
  assert.strictEqual(rows.length, 3);
  assert.match(summary, /1 ok, 1 with issues, 1 not checked/);
  assert.match(rows[1], /left \\\| right/);
  assert.match(rows[2], /Not checked: HTTP 429/);
});
