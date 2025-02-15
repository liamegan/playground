import { PoissonDiskSampling } from "./PSD.js";
import { smoothstep, clamp, fl, lerp, rotate } from "./utils.js";
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
  c.width = w;
  c.height = h;
  document.body.appendChild(c);
  let ctx = c.getContext("2d");
  const draw = (points) => {
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  };
  const points = await pds.generate(draw); // Await for generation to complete
}

setTimeout(main, 100);
