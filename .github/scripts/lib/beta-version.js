// Pure version logic for the beta release drafter.
// No git, no network. Everything here is a plain function of its inputs, so it is easy to test.

// A valid tag is vX.Y.Z or vX.Y.Z-beta.N.
const TAG_RE = /^v(\d+)\.(\d+)\.(\d+)(?:-beta\.(\d+))?$/;

// Turn a tag string into numbers, or null if it is not a shape we recognise.
function parseVersion(tag) {
  const m = TAG_RE.exec(tag);
  if (!m) return null;
  return {
    major: Number(m[1]),
    minor: Number(m[2]),
    patch: Number(m[3]),
    beta: m[4] === undefined ? null : Number(m[4]),
  };
}

// Compare two tags. A beta sorts BELOW its own release (v0.1.2-beta.1 < v0.1.2).
function compareVersions(a, b) {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  for (const key of ['major', 'minor', 'patch']) {
    if (pa[key] !== pb[key]) return pa[key] < pb[key] ? -1 : 1;
  }
  // Same X.Y.Z: a release (beta null) is higher than any beta.
  if (pa.beta === null && pb.beta === null) return 0;
  if (pa.beta === null) return 1;
  if (pb.beta === null) return -1;
  if (pa.beta === pb.beta) return 0;
  return pa.beta < pb.beta ? -1 : 1;
}

// Keep only tags we understand, sorted highest last.
function validSorted(tags) {
  return tags.filter((t) => parseVersion(t) !== null).sort(compareVersions);
}

// The highest tag of any kind, or null when there are none.
function pickHighest(tags) {
  const sorted = validSorted(tags);
  return sorted.length ? sorted[sorted.length - 1] : null;
}

// The highest bare vX.Y.Z (no beta suffix), or null.
function pickLastProduction(tags) {
  const prod = validSorted(tags).filter((t) => parseVersion(t).beta === null);
  return prod.length ? prod[prod.length - 1] : null;
}

// Bump a bare production tag by one field and drop any suffix.
function bump(prodTag, kind) {
  const p = parseVersion(prodTag);
  let { major, minor, patch } = p;
  if (kind === 'major') { major += 1; minor = 0; patch = 0; }
  else if (kind === 'minor') { minor += 1; patch = 0; }
  else { patch += 1; }
  return `v${major}.${minor}.${patch}`;
}

// Decide the next version. Two clean cases:
// - highest is a production tag (or no tags): start a fresh beta line above it.
// - highest is a beta with no matching production tag: keep iterating that line.
// (A promoted beta can never be the highest tag, because its production tag outranks it.)
function computeVersionPlan(tags) {
  const highestTag = pickHighest(tags);
  const lastProductionTag = pickLastProduction(tags);

  if (highestTag !== null && parseVersion(highestTag).beta !== null) {
    const p = parseVersion(highestTag);
    return {
      mode: 'iterate',
      highestTag,
      lastProductionTag,
      candidates: { iterate: `v${p.major}.${p.minor}.${p.patch}-beta.${p.beta + 1}` },
    };
  }

  // Fresh line. Bump off the highest production tag, or v0.0.0 for the very first release.
  const base = highestTag === null ? 'v0.0.0' : highestTag;
  return {
    mode: 'fresh',
    highestTag,
    lastProductionTag,
    candidates: {
      patch: `${bump(base, 'patch')}-beta.1`,
      minor: `${bump(base, 'minor')}-beta.1`,
      major: `${bump(base, 'major')}-beta.1`,
    },
  };
}

module.exports = {
  parseVersion,
  compareVersions,
  pickHighest,
  pickLastProduction,
  bump,
  computeVersionPlan,
};
