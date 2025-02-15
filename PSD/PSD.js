import { Rectangle } from "./Rectangle.js";
import { Quadtree } from "./Quadtree.js";
import { smoothstep, clamp, fl, lerp, rotate } from "../Global/utils.js";

export class PoissonDiskSampling {
  constructor({
    width,
    height,
    minRadius,
    maxRadius,
    k = 30,
    strategy = 0,
    drift = 0.01,
    fieldFunction,
    pointsPerFrame = 500,
  }) {
    this.width = width;
    this.height = height;
    this.minRadius = minRadius;
    this.maxRadius = maxRadius;
    this.k = k;
    this.strategy = strategy;
    this.drift = drift;
    this.pointsPerFrame = pointsPerFrame;
    if (typeof fieldFunction == "function")
      this.fieldFunction = fieldFunction.bind(this);
    this.cellSize = minRadius / Math.sqrt(2);
    this.quadtree = new Quadtree(
      new Rectangle(width / 2, height / 2, width / 2, height / 2),
      4
    );
    this.activeList = [];
    this.points = [];
    this.tries = 0;
    this.state = 0;
    this.running = false;
  }
  get activeIndex() {
    switch (this.strategy) {
      case 0:
        return 0;
      case 1:
        return this.activeList.length - 1;
      case 2:
        return Math.floor(Math.random() * this.activeList.length);
    }
  }
  async generate(draw) {
    let initialPoint = this.randomPoint();
    let initialRadius = this.getRadiusFromField(initialPoint.x, initialPoint.y);
    this.points.push({ ...initialPoint, radius: initialRadius });
    initialPoint.radius = initialRadius;
    this.activeList.push(initialPoint);
    this.quadtree.insert(initialPoint);

    return new Promise((resolve) => {
      this.running = true;
      const generatePoints = () => {
        let newPoints = [];
        if (!this.running || this.activeList.length === 0) {
          this.running = false;
          resolve(this.points); // Resolve when done
          return;
        }

        // Generate up to 100 points per frame
        for (let count = 0; count < this.pointsPerFrame; count++) {
          if (this.activeList.length === 0) break;

          const activeIndex = this.activeIndex;
          const activePoint = this.activeList[activeIndex];
          let found = false;

          for (let i = 0; i < this.k; i++) {
            this.tries++;
            const newPoint = this.randomPointAround(activePoint);
            if (this.isValid(newPoint)) {
              const newRadius = this.getRadiusFromField(newPoint.x, newPoint.y);
              newPoint.radius = newRadius;
              const pushed = this.quadtree.insert(newPoint);

              if (pushed) {
                this.points.push({ ...newPoint, radius: newRadius });
                newPoints.push(newPoint);
                this.activeList.push(newPoint);
                found = true;
                this.state += this.drift;
              }
              break;
            }
          }

          if (!found) {
            this.activeList.splice(activeIndex, 1);
          }
        }

        draw(newPoints);

        // Use requestAnimationFrame to schedule the next batch
        requestAnimationFrame(generatePoints);
      };

      // Start generating points using RAF
      requestAnimationFrame(generatePoints);
    });
  }
  randomPoint() {
    return { x: Math.random() * this.width, y: Math.random() * this.height };
  }
  randomPointAround(point) {
    const r1 = Math.random();
    const r2 = Math.random();
    const radius = point.radius;
    // const radius = this.getRadiusFromField(point.x, point.y);
    const newRadius = radius * (r1 + 1);
    const angle = 2 * Math.PI * r2;
    return {
      x: point.x + newRadius * Math.cos(angle),
      y: point.y + newRadius * Math.sin(angle),
    };
  }
  isValid(point) {
    const radius = this.getRadiusFromField(point.x, point.y);
    // const range = new Rectangle(point.x, point.y, radius, radius);
    const range = new Rectangle(
      point.x - radius,
      point.y - radius,
      radius * 2,
      radius * 2
    );
    const neighbors = this.quadtree.query(range);

    for (let neighbor of neighbors) {
      // const neighborRadius = this.getRadiusFromField(neighbor.x, neighbor.y);
      const minDist = radius;
      // const minDist = (radius+neighbor.radius)/2;
      if (this.distance(point, neighbor) < minDist) {
        return false;
      }
    }

    return true;
  }
  distance(p1, p2) {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    return Math.sqrt(dx * dx + dy * dy);
  }
  getRadiusFromField(x, y) {
    if (this.fieldFunction) return this.fieldFunction(x, y);
    const field = (x - this.width / 2 + y - this.height / 2) * 0.0025;
    const val = clamp(0, 1, smoothstep(-3, 5, field));

    return this.minRadius + val * (this.maxRadius - this.minRadius);
  }
}
