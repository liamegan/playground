export const fl = Math.floor;
export const clamp = function (a, b, v) {
  return Math.min(b, Math.max(a, v));
};
export const lerp = function (a, b, p) {
  return a + p * (b - a);
};
export const smoothstep = function (edge0, edge1, x) {
  const t = clamp(0.0, 1.0, (x - edge0) / (edge1 - edge0));
  return t * t * (3.0 - 2.0 * t);
};
export const rotate = function (x, y, a) {
  const c = Math.cos(a),
    s = Math.sin(a);
  return [c * x + s * y, c * y - s * x];
};
