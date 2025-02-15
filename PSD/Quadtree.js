import { Rectangle } from "./Rectangle.js";

export class Quadtree {
  constructor(boundary, capacity, depth = 0, maxDepth = 10) {
    this.boundary = boundary; // Boundary is a rectangle
    this.capacity = capacity; // Max points a node can hold before splitting
    this.points = [];
    this.divided = false;
    this.depth = depth;
    this.maxDepth = maxDepth; // Limit the depth of subdivision
  }

  subdivide() {
    if (this.depth >= this.maxDepth) {
      return; // Stop subdividing if max depth is reached
    }

    const { x, y, w, h } = this.boundary;

    // Create four new rectangles representing each quadrant
    const nw = new Rectangle(x - w / 2, y - h / 2, w / 2, h / 2); // Top-left quadrant
    const ne = new Rectangle(x + w / 2, y - h / 2, w / 2, h / 2); // Top-right quadrant
    const sw = new Rectangle(x - w / 2, y + h / 2, w / 2, h / 2); // Bottom-left quadrant
    const se = new Rectangle(x + w / 2, y + h / 2, w / 2, h / 2); // Bottom-right quadrant

    this.northwest = new Quadtree(
      nw,
      this.capacity,
      this.depth + 1,
      this.maxDepth
    );
    this.northeast = new Quadtree(
      ne,
      this.capacity,
      this.depth + 1,
      this.maxDepth
    );
    this.southwest = new Quadtree(
      sw,
      this.capacity,
      this.depth + 1,
      this.maxDepth
    );
    this.southeast = new Quadtree(
      se,
      this.capacity,
      this.depth + 1,
      this.maxDepth
    );

    this.divided = true;
  }

  insert(point) {
    if (!this.boundary.contains(point)) {
      return false;
    }

    if (this.points.length < this.capacity) {
      this.points.push(point);
      return true;
    } else {
      if (!this.divided) {
        this.subdivide();
      }

      if (
        this.northwest.insert(point) ||
        this.northeast.insert(point) ||
        this.southwest.insert(point) ||
        this.southeast.insert(point)
      ) {
        return true;
      }
    }

    return false;
  }

  query(range, found = []) {
    if (!this.boundary.intersects(range)) {
      return found;
    } else {
      for (let p of this.points) {
        if (range.contains(p)) {
          found.push(p);
        }
      }

      if (this.divided) {
        this.northwest.query(range, found);
        this.northeast.query(range, found);
        this.southwest.query(range, found);
        this.southeast.query(range, found);
      }
    }

    return found;
  }
}
