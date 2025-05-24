export function prng(seed) {
  return function () {
    // force to 32‑bit int
    seed |= 0;
    // magic constant, tweak for different sequences
    seed = (seed + 0x6d2b79f5) | 0;
    // xorshift and multiply mix
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    // unsigned 32‑bit fraction
    return ((t ^ (t >>> 14)) >>> 0) / 0x100000000;
  };
}
