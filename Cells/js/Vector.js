export class Vector {
  static zero() {
    return new Vector(0, 0, 0);
  }

  static fromAngleRadians(angle) {
    return new Vector(Math.cos(angle), Math.sin(angle));
  }

  static random2D(randomFunction = Math.random) {
    // Note: Original uses fxrand(). Allow passing a custom random function.
    return Vector.fromAngleRadians(randomFunction() * Math.PI * 2);
  }

  static add(vectorA, vectorB) {
    return new Vector(
      vectorA.x + vectorB.x,
      vectorA.y + vectorB.y,
      vectorA.z + vectorB.z
    );
  }

  static subtract(vectorA, vectorB) {
    return new Vector(
      vectorA.x - vectorB.x,
      vectorA.y - vectorB.y,
      vectorA.z - vectorB.z
    );
  }

  static divideByScalar(vector, scalar) {
    return new Vector(vector.x / scalar, vector.y / scalar, vector.z / scalar);
  }

  static multiplyByScalar(vector, scalar) {
    return new Vector(vector.x * scalar, vector.y * scalar, vector.z * scalar);
  }

  static angleBetween(vectorA, vectorB) {
    if (
      (vectorA.x === 0 && vectorA.y === 0 && vectorA.z === 0) ||
      (vectorB.x === 0 && vectorB.y === 0 && vectorB.z === 0)
    ) {
      return 0;
    }
    const dotProduct =
      vectorA.x * vectorB.x + vectorA.y * vectorB.y + vectorA.z * vectorB.z;
    const magnitudeA = Math.sqrt(
      vectorA.x * vectorA.x + vectorA.y * vectorA.y + vectorA.z * vectorA.z
    );
    const magnitudeB = Math.sqrt(
      vectorB.x * vectorB.x + vectorB.y * vectorB.y + vectorB.z * vectorB.z
    );
    const cosTheta = dotProduct / (magnitudeA * magnitudeB);

    if (cosTheta <= -1) return Math.PI;
    if (cosTheta >= 1) return 0;
    return Math.acos(cosTheta);
  }

  static average(vectors) {
    if (vectors.length === 0) return undefined;
    const sumVector = new Vector();
    vectors.forEach((vec) => sumVector.addVector(vec));
    sumVector.divideByScalar(vectors.length);
    return sumVector;
  }

  constructor(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  distanceTo(otherVector) {
    const dx = otherVector.x - this.x;
    const dy = otherVector.y - this.y;
    const dz = otherVector.z - this.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  distanceTo2DPoint(x, y) {
    const dx = x - this.x;
    const dy = y - this.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  addVector(otherVector) {
    this.x += otherVector.x;
    this.y += otherVector.y;
    this.z += otherVector.z;
  }

  addCoordinates(dx, dy, dz = 0) {
    this.x += dx;
    this.y += dy;
    this.z += dz;
  }

  subtractVector(otherVector) {
    this.x -= otherVector.x;
    this.y -= otherVector.y;
    this.z -= otherVector.z;
  }

  subtractCoordinates(dx, dy, dz = 0) {
    this.x -= dx;
    this.y -= dy;
    this.z -= dz;
  }

  multiplyByScalar(scalar) {
    this.x *= scalar;
    this.y *= scalar;
    this.z *= scalar;
  }

  divideByScalar(scalar) {
    if (scalar === 0) {
      console.warn("Division by zero in Vector.divideByScalar");
      return;
    }
    this.x /= scalar;
    this.y /= scalar;
    this.z /= scalar;
  }

  getMagnitude() {
    // Using precise magnitude calculation
    return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
  }

  getMagnitudeSquared() {
    return this.x * this.x + this.y * this.y + this.z * this.z;
  }

  getAngle2D() {
    // Returns angle in radians for 2D vector (XY plane)
    return Math.atan2(this.y, this.x);
  }

  normalize() {
    const mag = this.getMagnitude();
    if (mag > 0) {
      this.divideByScalar(mag);
    }
  }

  limitMagnitude(maxMagnitude) {
    if (this.getMagnitude() > maxMagnitude) {
      this.setMagnitude(maxMagnitude);
    }
  }

  setMagnitude(newMagnitude) {
    this.normalize();
    this.multiplyByScalar(newMagnitude);
  }

  clone() {
    return new Vector(this.x, this.y, this.z);
  }

  rotate2D(angleRadians) {
    // Rotates around Z axis
    const currentX = this.x;
    this.x = this.x * Math.cos(angleRadians) - this.y * Math.sin(angleRadians);
    this.y =
      currentX * Math.sin(angleRadians) + this.y * Math.cos(angleRadians);
  }

  setToZero() {
    this.x = 0;
    this.y = 0;
    this.z = 0;
  }

  setCoordinates(x, y, z) {
    this.x = x;
    this.y = y;
    this.z = z !== undefined ? z : this.z;
  }

  setFromVector(otherVector) {
    this.x = otherVector.x;
    this.y = otherVector.y;
    this.z = otherVector.z;
  }

  swapXY() {
    const tempX = this.x;
    this.x = this.y;
    this.y = tempX;
  }

  toString() {
    return `<${this.x.toFixed(2)}, ${this.y.toFixed(2)}, ${this.z.toFixed(2)}>`;
  }

  lerpTo(targetVector, amount) {
    // Linear interpolation
    if (amount >= 1) {
      return targetVector.clone();
    }
    if (amount <= 0) {
      return this.clone();
    }
    return new Vector(
      (targetVector.x - this.x) * amount + this.x,
      (targetVector.y - this.y) * amount + this.y,
      (targetVector.z - this.z) * amount + this.z
    );
  }

  addRandomJitter(maxJitterAmount = 1, randomFunction = Math.random) {
    const jitterVector = Vector.random2D(randomFunction);
    jitterVector.setMagnitude(maxJitterAmount * randomFunction()); // Scale jitter by random amount up to max
    this.addVector(jitterVector);
    return this;
  }

  dotProduct(otherVector) {
    return (
      this.x * otherVector.x + this.y * otherVector.y + this.z * otherVector.z
    );
  }
}
