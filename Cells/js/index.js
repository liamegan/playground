import { rand, initializeRandom } from "./random";
import { ParticleSystem } from "./ParticleSystem";
import { Stage } from "./Stage";
import { Renderer } from "./Renderer";
import { ColorManager } from "./ColorManager";
import { generateCreatures } from "./CreatureGenerator";
import { intToRGBString } from "./utils";
import { BoundingBox } from "./BoundingBox";
import { symmetricParticleForce } from "./Behaviours";

initializeRandom("My name is Liam");

// console.log(rand(), rand(), rand());

// const a = new Vector3(1, 2, 3);
// const b = new Vector3(4, 5, 6);
// const avg = Vector3.average([a, b]);
// (window.a = a), (window.b = b);
// console.log(avg, a.distXY(b));

// Setup system dimensions.
const systemWidth = 180;
const systemHeight = 180;

// Create a new ParticleSystem with a BoundingBox.
const particleSystem = new ParticleSystem(
  new BoundingBox(systemWidth, systemHeight),
  10
);
particleSystem.setMaxForce(2);

// Add various interactions and behaviors.
particleSystem.addSymmetricParticleInteraction(symmetricParticleForce(10, 1), {
  or: ["dust"],
});
// (Many other interactions are added here...)

// Create a Stage container for creatures.
const stage = new Stage(particleSystem);

// Create a ColorManager.
const colorManager = new ColorManager();
document.body.style.backgroundColor = intToRGBString(
  colorManager.get("background2")
);

// Create the renderer.
const renderer = new Renderer(
  systemWidth,
  systemHeight,
  5,
  colorManager.get("max_line_thickness"),
  () => colorManager.get("background1"),
  () => colorManager.get("background2")
);

// Generate creatures into the system (using the weighted generator options).
generateCreatures(particleSystem, stage, colorManager, renderer);

// Main animation loop.
let lastTime;
function animationLoop() {
  renderer.clear();
  let dt = Date.now() - lastTime;
  lastTime = Date.now();
  let steps = Math.max(Math.min(50 / dt, 10), 1);

  // Optionally process mouse/touch interactions...

  for (let i = 0; i < steps; i++) {
    particleSystem.update();
    stage.update();
  }

  stage.draw(renderer);
  // Adjust renderer scale based on window dimensions.
  if (window.innerWidth < window.innerHeight) {
    renderer.setScale(window.innerWidth / renderer.width);
  } else {
    renderer.setScale(window.innerHeight / renderer.height);
  }
  renderer.render();
  requestAnimationFrame(animationLoop);
}
animationLoop();

// Event listeners to handle user interactions.
renderer.canvas.addEventListener("mousedown", (e) => {
  mouseActive = true;
});
renderer.canvas.addEventListener(
  "touchstart",
  (e) => {
    mouseActive = true;
  },
  false
);
renderer.canvas.addEventListener("mousemove", (e) => {
  // Map mouse position to simulation coordinates.
});
renderer.canvas.addEventListener(
  "touchmove",
  (e) => {
    // Map touch position to simulation coordinates.
  },
  false
);
window.addEventListener("mouseup", (e) => {
  mouseActive = false;
});
