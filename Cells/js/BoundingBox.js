import { Vector3 } from "./Vec3.js";
import { rand } from "./random";

// A simple bounding box defined by a top/back/left corner and a bottom/front/right corner.
class BoundingBox {
  constructor(width, height, depth = 0) {
    this.topBackLeft = new Vector3(0, 0, 0);
    this.bottomFrontRight = new Vector3(width, height, depth);
  }

  contains(x, y, z = 0) {
    return (
      x >= this.topBackLeft.x &&
      y >= this.topBackLeft.y &&
      z >= this.topBackLeft.z &&
      x <= this.bottomFrontRight.x &&
      y <= this.bottomFrontRight.y &&
      z <= this.bottomFrontRight.z
    );
  }

  containsVector(v) {
    return this.contains(v.x, v.y, v.z);
  }

  getTopBackLeft() {
    return this.topBackLeft;
  }

  getBottomFrontRight() {
    return this.bottomFrontRight;
  }

  getRandomPointInside(dim = 2) {
    return new Vector3(
      rand() * this.getWidth() + this.topBackLeft.x,
      rand() * this.getHeight() + this.topBackLeft.y,
      dim === 3 ? rand() * this.getDepth() + this.topBackLeft.z : 0
    );
  }

  getWidth() {
    return this.bottomFrontRight.x - this.topBackLeft.x;
  }

  getHeight() {
    return this.bottomFrontRight.y - this.topBackLeft.y;
  }

  getDepth() {
    return this.bottomFrontRight.z - this.topBackLeft.z;
  }

  getCenter() {
    return new Vector3(
      this.topBackLeft.x + this.getWidth() / 2,
      this.topBackLeft.y + this.getHeight() / 2,
      this.topBackLeft.z + this.getDepth() / 2
    );
  }

  toString() {
    return `(${this.topBackLeft.toString()}, ${this.bottomFrontRight.toString()})`;
  }

  // Constrains a given vector to be within the bounding box.
  constrained(v) {
    return new Vector3(
      Math.max(this.topBackLeft.x, Math.min(this.bottomFrontRight.x, v.x)),
      Math.max(this.topBackLeft.y, Math.min(this.bottomFrontRight.y, v.y)),
      Math.max(this.topBackLeft.z, Math.min(this.bottomFrontRight.z, v.z))
    );
  }

  area() {
    return this.getWidth() * this.getHeight();
  }
}
