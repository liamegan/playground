export class HatchFlow {
  static STRATEGIES = Object.freeze({
    RANDOM: 0,
    LINEAR: 1,
  });

  constructor({
    width,
    height,
    points,
    proximityThreshold = 5,
    selectionStrategy = 0,
    pointsPerFrame = 20,
    segmentLength = 250,
    fieldFunction = function (point) {
      let baseAngle =
        Math.atan2(point.y - this.height / 2, point.x - this.width / 2) +
        Math.PI * 0.5;
      let wave = Math.sin(point.x * 0.05) * Math.cos(point.y * 0.05);
      return baseAngle + wave * 0.5;
    },
  }) {
    this.width = width;
    this.height = height;
    this.points = [...points];
    this.proximityThreshold = proximityThreshold;
    this.pointsPerFrame = pointsPerFrame;
    this.selectionStrategy = Object.values(HatchFlow.STRATEGIES).includes(
      selectionStrategy
    )
      ? selectionStrategy
      : HatchFlow.STRATEGIES.RANDOM;
    this.fieldFunction = fieldFunction;
    this.segmentLength = segmentLength;

    this.i = 0;
    this.running = false;
    this.snakes = [];

    this.bitmap = new Uint8Array(width * height);
  }

  async generate(draw) {
    return new Promise((resolve) => {
      this.running = true;

      let nextFrame = false;
      window.addEventListener("click", () => {
        nextFrame = true;
      });

      const generateHatches = async () => {
        let newSnakes = [];

        if (nextFrame) {
          // nextFrame = false;
          debugCanvas.cx.clearRect(0, 0, this.width, this.height);

          for (let i = 0; i < this.pointsPerFrame; i++) {
            let point = this.getNextPoint();
            if (!point) {
              this.running = false;
              break;
            }

            if (this.isTooClose(point)) {
              i--;
              continue;
            }

            debugCanvas.cx.beginPath();
            debugCanvas.cx.arc(point.x, point.y, 5, 0, Math.PI * 2);
            debugCanvas.cx.fill();

            const tip = await this.segment(point, 1);
            const tail = await this.segment(point, -1);
            const snake = { path: [...tail.reverse(), ...tip], point };

            // if (snake.path.length > 10) {
            newSnakes.push(snake);
            this.snakes.push(snake);

            // for (const mark of snake) {
            //   this.markPoint(mark);
            // }
            // } else {
            //   for (const mark of snake) {
            //     this.unmarkPoint(mark);
            //   }
            // }
          }
          console.log(newSnakes);
          draw(newSnakes);
        }

        if (this.running) {
          requestAnimationFrame(generateHatches);
        } else {
          // draw(this.snakes);
          resolve(this.snakes);
        }
      };

      requestAnimationFrame(generateHatches);
    });
  }

  async segment(point, direction = 1) {
    let c = false,
      growthTries = 0;

    let segment = [],
      buffer = [];
    let p = { ...point };
    let op = point;
    while (!c) {
      if (growthTries++ > 10000) c = true;
      // if (segment.length > this.segmentLength) c = true;
      const tp = this.grow(p, segment, buffer, direction);
      if (tp === true) c = true;
      // Update this to deal with different collision types
      if (buffer.length > 1) {
        const b = buffer.splice(0, 1);
        for (const mark of b) {
          this.markSegment(op, mark);
          op = mark;
        }
      }
    }

    return segment;
  }

  grow(point, snake, buffer, direction = 1) {
    const a = this.fieldFunction(point) - (direction === -1 ? Math.PI : 0);
    const mv = { x: Math.cos(a), y: Math.sin(a) };
    const op = { ...point };
    const np = { x: op.x + mv.x, y: op.y + mv.y };
    const debug = {};

    point.x = np.x;
    point.y = np.y;
    // Skip if movement doesn’t cause a visible change
    const newPoint = { x: np.x, y: np.y };
    // const tooClose = this.isTooClose(newPoint);
    const tooClose = this.isTooClose(newPoint, "cone", mv, debug);

    debugCanvas.cx.strokeStyle = tooClose ? "red" : "green";
    debugCanvas.cx.beginPath();
    debugCanvas.cx.moveTo(op.x, op.y);
    debugCanvas.cx.lineTo(op.x + mv.x * 30, op.y + mv.y * 30);
    debugCanvas.cx.stroke();
    if (tooClose) {
      debugCanvas.cx.fillStyle = "black";
      debugCanvas.cx.font = "16px Arial";
      debugCanvas.cx.fillText(
        `Distance: ${debug.distance}`,
        np.x + 5,
        np.y - 5
      );
    }

    if (
      !tooClose &&
      Math.floor(op.x) !== Math.floor(np.x) &&
      Math.floor(op.y) !== Math.floor(np.y)
    ) {
      snake.push(newPoint);
      buffer.push(newPoint);
    }

    return tooClose;
  }

  getNextPoint() {
    if (this.points.length < 1) return null;
    if (this.selectionStrategy == HatchFlow.STRATEGIES.RANDOM) {
      this.i = Math.floor(Math.random() * this.points.length);
      return this.points.splice(this.i, 1)[0];
    } else if (this.selectionStrategy == HatchFlow.STRATEGIES.LINEAR) {
      return this.points.splice(this.i++, 1)[0];
    }
  }

  isTooClose(pt, mode = "box", direction = { x: 0, y: 0 }, debug = {}) {
    const range = this.proximityThreshold;

    if (mode === "box") {
      for (let dx = -range; dx <= range; dx++) {
        for (let dy = -range; dy <= range; dy++) {
          const nx = Math.floor(pt.x) + dx;
          const ny = Math.floor(pt.y) + dy;
          if (nx >= 0 && nx < this.width && ny >= 0 && ny < this.height) {
            if (this.bitmap[ny * this.width + nx]) {
              const distSquared = (pt.x - nx) ** 2 + (pt.y - ny) ** 2;
              if (distSquared <= range * range) {
                return true;
              }
            }
          }
        }
      }
    } else if (mode === "cone") {
      const steps = range;
      const angleSpread = Math.PI / 4; // 60 degrees

      for (let i = 1; i <= steps; i += 0.5) {
        debug.distance = i;
        const currentSpread = (i / steps) * angleSpread;
        const raysAtThisDistance = 5 + Math.floor(i * 2);
        const angleIncrement = (currentSpread * 2) / raysAtThisDistance;

        for (let r = 0; r <= raysAtThisDistance; r++) {
          const offset = -currentSpread + r * angleIncrement;
          const baseAngle = Math.atan2(direction.y, direction.x);
          const a = baseAngle + offset;

          const nx = Math.floor(pt.x + i * Math.cos(a));
          const ny = Math.floor(pt.y + i * Math.sin(a));

          if (nx >= 0 && nx < this.width && ny >= 0 && ny < this.height) {
            if (this.bitmap[ny * this.width + nx]) {
              return true;
            }
          }
        }
      }
    }
    return false;
  }

  markPoint({ x, y }) {
    x = Math.floor(x);
    y = Math.floor(y);
    const size = 1; // Increase the size of the marked area
    for (let dx = -size; dx <= size; dx++) {
      for (let dy = -size; dy <= size; dy++) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && nx < this.width && ny >= 0 && ny < this.height) {
          this.bitmap[ny * this.width + nx] = 1;
        }
      }
    }
  }
  // After: Example using a Bresenham line routine
  markSegment(oldPoint, newPoint) {
    // A simple Bresenham line algorithm
    // Convert to integers for Bresenham
    let x0 = Math.floor(oldPoint.x);
    let y0 = Math.floor(oldPoint.y);
    const x1 = Math.floor(newPoint.x);
    const y1 = Math.floor(newPoint.y);

    const dx = Math.abs(x1 - x0);
    const sx = x0 < x1 ? 1 : -1;
    const dy = -Math.abs(y1 - y0);
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;

    while (true) {
      // Mark the pixel at (x0, y0).
      if (x0 >= 0 && x0 < this.width && y0 >= 0 && y0 < this.height) {
        this.markPoint({ x: x0, y: y0 });
      }

      // If we reached the endpoint, break
      if (x0 === x1 && y0 === y1) break;

      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }
  }
}
