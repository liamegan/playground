export class HatchFlow {
  static STRATEGIES = Object.freeze({
    RANDOM: 0,
    LINEAR: 1,
  });

  constructor({
    width,
    height,
    points,
    proximityThreshold = 8,
    selectionStrategy = 1,
    pointsPerFrame = 20,
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

    this.i = 0;
    this.running = false;
    this.snakes = [];

    this.bitmap = new Uint8Array(width * height);
  }

  async generate(draw) {
    return new Promise((resolve) => {
      this.running = true;

      const generateHatches = () => {
        let newSnakes = [];

        for (let i = 0; i < this.pointsPerFrame; i++) {
          let point = this.getNextPoint();
          if (!point) {
            this.running = false;
            break;
          }
          let snake = [],
            buffer = [];

          if (this.isTooClose(point)) {
            i--;
            continue;
          }

          let tip = { ...point };
          let tail = { ...point };

          let c, t, b;
          c = t = b = false;
          let growthTries = 0;
          while (!c) {
            if (growthTries++ > 1000) c = true;
            if (snake.length > 500) c = true;
            let tp, bp;
            if (!t) tp = this.grow(tip, snake, buffer);
            if (tp === true) t = true;
            if (!b) bp = this.grow(tail, snake, buffer, -1);
            if (bp === true) b = true;
            if (tp && bp) c = true;
            if (buffer.length > 5) {
              const b = buffer.splice(0, 5);
              for (const mark of b) {
                this.markPoint(mark);
              }
            }
          }

          if (snake.length) {
            newSnakes.push(snake);
            this.snakes.push(snake);

            for (const mark of buffer) {
              this.markPoint(mark);
            }
          }
        }

        draw(newSnakes);

        if (this.running) {
          requestAnimationFrame(generateHatches);
        } else {
          draw(this.snakes);
          resolve(this.snakes);
        }
      };

      requestAnimationFrame(generateHatches);
    });
  }

  grow(point, snake, buffer, direction = 1) {
    const a = this.fieldFunction(point) - (direction === -1 ? Math.PI : 0);
    const mv = { x: Math.cos(a), y: Math.sin(a) };
    const op = { ...point };
    const np = { x: op.x + mv.x, y: op.y + mv.y };

    point.x = np.x;
    point.y = np.y;
    // Skip if movement doesn’t cause a visible change
    const newPoint = { x: np.x, y: np.y };
    const tooClose = this.isTooClose(newPoint, "cone", mv);
    if (
      !tooClose &&
      Math.floor(op.x) !== Math.floor(np.x) &&
      Math.floor(op.y) !== Math.floor(np.y)
    ) {
      if (direction === -1) snake.splice(0, 0, newPoint);
      else snake.push(newPoint);

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

  isTooClose(pt, mode = "box", direction = { x: 0, y: 0 }) {
    const range = this.proximityThreshold;

    if (mode === "box") {
      for (let dx = -range; dx <= range; dx++) {
        for (let dy = -range; dy <= range; dy++) {
          const nx = Math.round(pt.x) + dx;
          const ny = Math.round(pt.y) + dy;
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
      const angleSpread = Math.PI / 3;
      for (let i = 1; i <= steps; i += 0.5) {
        const spreadFactor = (i / steps) * angleSpread;
        for (let offset of [
          -spreadFactor,
          -spreadFactor * 0.5,
          -spreadFactor * 0.25,
          0,
          spreadFactor * 0.25,
          spreadFactor * 0.5,
          spreadFactor,
        ]) {
          const a = Math.atan2(direction.y, direction.x) + offset;
          const nx = Math.round(pt.x + i * Math.cos(a));
          const ny = Math.round(pt.y + i * Math.sin(a));

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
    x = Math.round(x);
    y = Math.round(y);
    if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
      this.bitmap[y * this.width + x] = 1;
    }
  }
}
