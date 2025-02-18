import { HatchFlow } from "./HatchFlow.js";
import { PoissonDiskSampling } from "../PSD/PSD.js";
import { smoothstep, clamp, fl, lerp, rotate } from "../Global/utils.js";
import { createNoise2D, createNoise3D } from "https://esm.sh/simplex-noise";
import alea from "https://esm.sh/alea";

const noise2D = createNoise2D();
const prng = alea("seed");
const noise2D2 = createNoise2D(prng);

const w = 2000,
  h = 2000;

const createFieldFunction = (terms) => {
  return function (x, y) {
    let field = 0;

    for (let i = 0; i < terms.length; i++)
      field = terms[i].bind(this)(x, y, field, this.state);

    field += Math.cos((x + y) * 0.005 + this.state);

    const val = clamp(0, 1, smoothstep(-2, 2, field - 0.2));
    return this.minRadius + val * (this.maxRadius - this.minRadius);
  };
};

async function main() {
  const terms = [
    (() =>
      function (x, y, field) {
        return (
          field +
          noise2D(x * 0.003, y * 0.003) * 0.5 +
          Math.cos(
            Math.hypot(x - this.width / 2, y - this.height / 2) * 0.01 +
              this.state
          )
        );
      })(),
    (() => {
      const s = Math.random() * 0.01;
      return function (x, y, field) {
        return field + Math.cos((x + y) * s + this.state);
      };
    })(),
  ];
  const pds = new PoissonDiskSampling({
    width: w,
    height: h,
    minRadius: 5,
    maxRadius: 50,
    strategy: 0,
    drift: 0,
    pointsPerFrame: 2000,
    fieldFunction: createFieldFunction(terms),
  });

  let c = document.createElement("canvas");
  let c2 = document.createElement("canvas");
  c.width = w;
  c.height = h;
  c2.width = w;
  c2.height = h;
  container.appendChild(c);
  container.appendChild(c2);
  let ctx = c.getContext("2d");
  let ctx2 = c2.getContext("2d");
  c2.className = "debug";
  c2.id = "debugCanvas";
  c2.cx = ctx2;
  console.log(ctx === ctx2);
  const draw = (points) => {
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  };
  const points = await pds.generate(draw); // Await for generation to complete

  const timeout = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  await timeout(1000); // wait a second

  const snakes = new HatchFlow({
    width: w,
    height: h,
    points,
    fieldFunction: function (point) {
      if (point.radius < 10) {
        return (
          Math.atan2(point.y - h / 2, point.x - w / 2) +
          noise2D2(point.x * 0.0005, point.y * 0.0005) +
          Math.PI * 0.5
        );
      }
      return noise2D(point.x * 0.001, point.y * 0.001) * Math.PI * 2;
    },
  });
  ctx.clearRect(0, 0, w, h);
  ctx.lineWidth = 2;
  const drawSnakes = (snakes) => {
    ctx.strokeStyle = "#333333";
    for (let i = 0; i < snakes.length; i++) {
      const s = snakes[i].path;
      // console.log(s);
      ctx.beginPath();
      for (let j = 0; j < s.length; j++) {
        if (i == 0) ctx.moveTo(s[j].x, s[j].y);
        else ctx.lineTo(s[j].x, s[j].y);
      }

      ctx.stroke();
    }
  };
  const allsnakes = await snakes.generate(drawSnakes);
}

setTimeout(main, 100);
