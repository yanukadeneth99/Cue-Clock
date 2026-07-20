const test = require('node:test');
const assert = require('node:assert');
const {
  ageInDays,
  sriLankaDateLabel,
  classify,
  STALE_DAYS,
} = require('./digest.js');

// A frozen clock, so these tests mean the same thing forever.
const NOW = Date.parse('2026-07-20T12:30:00Z');

function item(over) {
  return {
    number: 1,
    title: 'A title',
    url: 'https://github.com/o/r/pull/1',
    kind: 'pr',
    author: 'someone',
    labels: ['dependencies'],
    createdAt: '2026-07-19T12:30:00Z',
    isDraft: false,
    ...over,
  };
}

test('ageInDays counts exactly three days as three', () => {
  assert.strictEqual(ageInDays('2026-07-17T12:30:00Z', NOW), 3);
});

test('ageInDays counts just under three days as two', () => {
  assert.strictEqual(ageInDays('2026-07-17T12:31:00Z', NOW), 2);
});

test('ageInDays counts just over three days as three', () => {
  assert.strictEqual(ageInDays('2026-07-17T12:29:00Z', NOW), 3);
});

test('ageInDays returns 0 for an unreadable date instead of throwing', () => {
  assert.strictEqual(ageInDays('not a date', NOW), 0);
});

test('sriLankaDateLabel uses local date, not UTC date', () => {
  // 21:00 UTC is already the next morning in Sri Lanka.
  assert.strictEqual(sriLankaDateLabel(Date.parse('2026-07-19T21:00:00Z')), '2026-07-20');
});

test('classify puts a human-review item in needsReview only, never both', () => {
  const out = classify([item({ labels: ['dependencies', 'human-review'], createdAt: '2026-07-01T00:00:00Z' })], { nowMs: NOW, staleDays: STALE_DAYS });
  assert.strictEqual(out.needsReview.length, 1);
  assert.strictEqual(out.stuck.length, 0);
});

test('classify treats an unlabelled item as stuck no matter how new it is', () => {
  const out = classify([item({ labels: [], createdAt: '2026-07-20T12:00:00Z' })], { nowMs: NOW, staleDays: STALE_DAYS });
  assert.strictEqual(out.stuck.length, 1);
  assert.strictEqual(out.stuck[0].ageDays, 0);
});

test('classify ignores a draft pull request even when it is old', () => {
  const out = classify([item({ isDraft: true, createdAt: '2026-07-01T00:00:00Z' })], { nowMs: NOW, staleDays: STALE_DAYS });
  assert.strictEqual(out.needsReview.length, 0);
  assert.strictEqual(out.stuck.length, 0);
});

test('classify still reports a draft that carries human-review', () => {
  const out = classify([item({ isDraft: true, labels: ['human-review'] })], { nowMs: NOW, staleDays: STALE_DAYS });
  assert.strictEqual(out.needsReview.length, 1);
});

test('classify leaves out a labelled item that is younger than the limit', () => {
  const out = classify([item({ createdAt: '2026-07-19T12:30:00Z' })], { nowMs: NOW, staleDays: STALE_DAYS });
  assert.strictEqual(out.stuck.length, 0);
});

test('classify returns needsReview newest first and stuck oldest first', () => {
  const out = classify([
    item({ number: 10, labels: ['human-review'], createdAt: '2026-07-01T00:00:00Z' }),
    item({ number: 11, labels: ['human-review'], createdAt: '2026-07-19T00:00:00Z' }),
    item({ number: 20, createdAt: '2026-07-10T00:00:00Z' }),
    item({ number: 21, createdAt: '2026-07-01T00:00:00Z' }),
  ], { nowMs: NOW, staleDays: STALE_DAYS });
  assert.deepStrictEqual(out.needsReview.map((i) => i.number), [11, 10]);
  assert.deepStrictEqual(out.stuck.map((i) => i.number), [21, 20]);
});

test('classify returns two empty buckets when nothing is open', () => {
  const out = classify([], { nowMs: NOW, staleDays: STALE_DAYS });
  assert.deepStrictEqual(out, { needsReview: [], stuck: [] });
});

test('classify does not modify the items it was given', () => {
  const original = item({});
  classify([original], { nowMs: NOW, staleDays: STALE_DAYS });
  assert.strictEqual(original.ageDays, undefined);
});

test('classify uses item number as tie-breaker when ages are identical', () => {
  // Both needsReview items share 10 ageDays; both stuck items share 19 ageDays.
  // needsReview should sort by number descending (higher first).
  // stuck should sort by number ascending (lower first).
  const out = classify([
    item({ number: 100, labels: ['human-review'], createdAt: '2026-07-10T00:00:00Z' }),
    item({ number: 50, labels: ['human-review'], createdAt: '2026-07-10T00:00:00Z' }),
    item({ number: 200, createdAt: '2026-07-01T00:00:00Z' }),
    item({ number: 150, createdAt: '2026-07-01T00:00:00Z' }),
  ], { nowMs: NOW, staleDays: STALE_DAYS });
  assert.deepStrictEqual(out.needsReview.map((i) => i.number), [100, 50]);
  assert.deepStrictEqual(out.stuck.map((i) => i.number), [150, 200]);
});

const {
  trimComments,
  formatStuckLines,
  buildDigestMessage,
  MAX_MESSAGE_CHARS,
} = require('./digest.js');

function comment(n, size) {
  return { author: `person${n}`, body: 'x'.repeat(size) };
}

test('trimComments keeps everything and omits nothing when under budget', () => {
  const all = [comment(1, 10), comment(2, 10)];
  const out = trimComments(all, 100);
  assert.strictEqual(out.omitted, 0);
  assert.deepStrictEqual(out.kept, all);
});

test('trimComments drops the oldest comments first and reports the count', () => {
  const out = trimComments([comment(1, 60), comment(2, 30), comment(3, 30)], 100);
  assert.strictEqual(out.omitted, 1);
  assert.deepStrictEqual(out.kept.map((c) => c.author), ['person2', 'person3']);
});

test('trimComments keeps the newest comment cut down when it alone busts the budget', () => {
  const out = trimComments([comment(1, 10), comment(2, 500)], 100);
  assert.strictEqual(out.kept.length, 1);
  assert.strictEqual(out.kept[0].author, 'person2');
  assert.strictEqual(out.kept[0].body.length, 100);
  assert.strictEqual(out.omitted, 1);
});

test('trimComments handles an empty list', () => {
  assert.deepStrictEqual(trimComments([], 100), { kept: [], omitted: 0 });
});

test('formatStuckLines renders number, title, age, and link', () => {
  const lines = formatStuckLines([
    { number: 96, title: 'bump firebase', ageDays: 5, url: 'https://x/pull/96' },
  ]);
  assert.deepStrictEqual(lines, ['- #96 bump firebase (5d) https://x/pull/96']);
});

test('formatStuckLines flattens a title containing a line break', () => {
  const lines = formatStuckLines([
    { number: 5, title: 'first line\nsecond line', ageDays: 4, url: 'https://x/issues/5' },
  ]);
  assert.strictEqual(lines.length, 1);
  assert.strictEqual(lines[0], '- #5 first line second line (4d) https://x/issues/5');
});

test('buildDigestMessage leaves out the Needs you section entirely when there is no summary', () => {
  const msg = buildDigestMessage({
    summary: '', stuckLines: ['- #1 a (4d) u'], dateLabel: '2026-07-20',
    needsReviewOverflow: 0, stuckOverflow: 0,
  });
  assert.ok(!msg.includes('Needs you'));
  assert.ok(msg.includes('Stuck:'));
});

test('buildDigestMessage leaves out the Stuck section entirely when nothing is stuck', () => {
  const msg = buildDigestMessage({
    summary: '#7: needs a decision', stuckLines: [], dateLabel: '2026-07-20',
    needsReviewOverflow: 0, stuckOverflow: 0,
  });
  assert.ok(msg.includes('Needs you:'));
  assert.ok(!msg.includes('Stuck:'));
});

test('buildDigestMessage reports both overflow counts separately', () => {
  const msg = buildDigestMessage({
    summary: '#7: needs a decision', stuckLines: ['- #1 a (4d) u'], dateLabel: '2026-07-20',
    needsReviewOverflow: 2, stuckOverflow: 9,
  });
  assert.ok(msg.includes('+2 more not summarised'));
  assert.ok(msg.includes('+9 more'));
});

test('buildDigestMessage always starts with the date line', () => {
  const msg = buildDigestMessage({
    summary: '', stuckLines: [], dateLabel: '2026-07-20',
    needsReviewOverflow: 0, stuckOverflow: 0,
  });
  assert.strictEqual(msg, 'Daily digest, 2026-07-20');
});

test('buildDigestMessage returns a message completely unchanged when well under the cap', () => {
  const msg = buildDigestMessage({
    summary: 'A small summary', stuckLines: ['- #1 title (5d) https://x/pull/1'], dateLabel: '2026-07-20',
    needsReviewOverflow: 0, stuckOverflow: 0,
  });
  // This message is much smaller than MAX_MESSAGE_CHARS (3900).
  assert.ok(msg.length < MAX_MESSAGE_CHARS - 100);
  assert.ok(!msg.includes('(message truncated)'));
});

test('buildDigestMessage truncates and marks a message far over the cap', () => {
  // Create a message with a very large summary to exceed MAX_MESSAGE_CHARS.
  const largeText = 'x'.repeat(4500);
  const msg = buildDigestMessage({
    summary: largeText, stuckLines: [], dateLabel: '2026-07-20',
    needsReviewOverflow: 0, stuckOverflow: 0,
  });
  // Message should be capped at MAX_MESSAGE_CHARS and contain the marker.
  assert.ok(msg.length <= MAX_MESSAGE_CHARS);
  assert.ok(msg.includes('(message truncated)'));
});
