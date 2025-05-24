import { Vec3 } from "wtc-math";
import { rand } from "./random";

export class Vector3 extends Vec3 {
  constructor(x, y, z) {
    super(x, y, z);
  }

  static fromAngle(a) {
    return new Vector3(Math.cos(a), Math.sin(a), 0);
  }
  static random2D() {
    return new Vector3(rand(), rand(), 0);
  }
  static average(vectors) {
    if (vectors.length === 0) return;
    let avg = new Vector3();
    vectors.forEach((v) => avg.add(v));
    avg.divideScalar(vectors.length);
    return avg;
  }
  static angleBetween(v1, v2) {
    if (
      (v1.x === 0 && v1.y === 0 && v1.z === 0) ||
      (v2.x === 0 && v2.y === 0 && v2.z === 0)
    ) {
      return 0;
    }
    let dot = v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;
    let mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y + v1.z * v1.z);
    let mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y + v2.z * v2.z);
    let cosine = dot / (mag1 * mag2);
    if (cosine <= -1) return Math.PI;
    if (cosine >= 1) return 0;
    return Math.acos(cosine);
  }
  // static lerp(a, b, t) {
  //   return b.subtractNew(a).scale(t).add(a);
  // }
  limit(max) {
    const length = this.length;
    if (length > max) this.length = max;
    return this;
  }
  zero() {
    this.reset(0, 0, 0);
    return this;
  }
  swapXY() {
    const temp = this.x;
    this.x = this.y;
    this.y = temp;
    return this;
  }
  jitter(amount = 1) {
    const j = Vector3.random2D();
    j.length = amount;
    j.add(this);
    return j;
  }
  dot1(v) {
    let angle = Vector3.angleBetween(this, v);
    return this.fastLength * v.fastLength * Math.cos(angle);
  }
  distXY = (v) => v.subtractNew(this).length;
  get fastLength() {
    const absX = Math.abs(this.x);
    const absY = Math.abs(this.y);
    return absX > absY
      ? 0.41 * absY + 0.941246 * absX
      : 0.41 * absX + 0.941246 * absY;
  }
  get heading2D() {
    return Math.atan2(this.y, this.x);
  }
}

window.Vector3 = Vector3;
