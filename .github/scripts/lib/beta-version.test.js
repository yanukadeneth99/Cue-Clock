// Tests for the pure beta version logic. No network, no git, just inputs and outputs.
const test = require('node:test');
const assert = require('node:assert/strict');
const v = require('./beta-version.js');

test('parseVersion reads production and beta tags', () => {
  assert.deepEqual(v.parseVersion('v0.1.2'), { major: 0, minor: 1, patch: 2, beta: null });
  assert.deepEqual(v.parseVersion('v0.1.2-beta.3'), { major: 0, minor: 1, patch: 2, beta: 3 });
  assert.equal(v.parseVersion('nightly'), null);
  assert.equal(v.parseVersion('v1.2'), null);
});

test('compareVersions orders beta below its own release', () => {
  assert.equal(v.compareVersions('v0.1.2-beta.1', 'v0.1.2'), -1);
  assert.equal(v.compareVersions('v0.1.2', 'v0.1.3-beta.1'), -1);
  assert.equal(v.compareVersions('v0.1.2-beta.2', 'v0.1.2-beta.1'), 1);
  assert.equal(v.compareVersions('v0.1.2', 'v0.1.2'), 0);
});

test('pickHighest and pickLastProduction handle the promoted pair', () => {
  const tags = ['v0.1.2', 'v0.1.2-beta.1', 'v0.1.1'];
  assert.equal(v.pickHighest(tags), 'v0.1.2');
  assert.equal(v.pickLastProduction(tags), 'v0.1.2');
});

test('bump increments the right field and drops any suffix', () => {
  assert.equal(v.bump('v0.1.2', 'patch'), 'v0.1.3');
  assert.equal(v.bump('v0.1.2', 'minor'), 'v0.2.0');
  assert.equal(v.bump('v0.1.2', 'major'), 'v1.0.0');
});

test('computeVersionPlan: highest is production -> fresh line above it', () => {
  const plan = v.computeVersionPlan(['v0.1.2', 'v0.1.2-beta.1', 'v0.1.1']);
  assert.equal(plan.mode, 'fresh');
  assert.equal(plan.highestTag, 'v0.1.2');
  assert.equal(plan.lastProductionTag, 'v0.1.2');
  assert.deepEqual(plan.candidates, {
    patch: 'v0.1.3-beta.1',
    minor: 'v0.2.0-beta.1',
    major: 'v1.0.0-beta.1',
  });
});

test('computeVersionPlan: highest is an in-flight beta -> iterate', () => {
  const plan = v.computeVersionPlan(['v0.1.2', 'v0.2.0-beta.1']);
  assert.equal(plan.mode, 'iterate');
  assert.equal(plan.highestTag, 'v0.2.0-beta.1');
  assert.equal(plan.lastProductionTag, 'v0.1.2');
  assert.deepEqual(plan.candidates, { iterate: 'v0.2.0-beta.2' });
});

test('computeVersionPlan: no tags at all -> fresh seed from v0.0.0', () => {
  const plan = v.computeVersionPlan([]);
  assert.equal(plan.mode, 'fresh');
  assert.equal(plan.highestTag, null);
  assert.equal(plan.lastProductionTag, null);
  assert.deepEqual(plan.candidates, {
    patch: 'v0.0.1-beta.1',
    minor: 'v0.1.0-beta.1',
    major: 'v1.0.0-beta.1',
  });
});
