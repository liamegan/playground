import { Renderer } from "./Renderer";
import { Vector } from "./Vector";

document.addEventListener("DOMContentLoaded", () => {
  let canvas = document.getElementById("main-canvas");
  if (!canvas) {
    canvas = document.createElement("canvas");
    canvas.id = "main-canvas";
    container.appendChild(canvas);
  }

  try {
    const renderer = new Renderer(
      canvas,
      800, // internal rendering width
      600, // internal rendering height
      window.devicePixelRatio || 1,
      2, // max line thickness
      () => 0x102030, // Function returning background color 1 (hex)
      () => 0x304050 // Function returning background color 2 (hex)
    );

    renderer.setBackgroundSdfCircles([
      { position: new Vector(200, 200), radius: 50 },
      { position: new Vector(600, 400), radius: 80 },
    ]);

    renderer.setCanvasDisplayDimensions(800, 600); // CSS display size

    let angle = 0;

    function animate() {
      renderer.clearGeometryBuffers(); // Prepare for new frame's geometry

      // --- Draw dynamic stuff ---
      angle += 0.01;
      const movingRectX = 400 + Math.sin(angle) * 100;
      renderer.drawRectangle(
        movingRectX - 25,
        50,
        movingRectX + 25,
        100,
        0xff0000
      ); // red

      renderer.drawLine(
        new Vector(100, 150),
        new Vector(300 + Math.cos(angle * 2) * 50, 250),
        3,
        0x00ff00
      ); // green
      renderer.drawCircle(
        new Vector(400, 300),
        30 + Math.sin(angle * 0.5) * 20,
        0x0000ff
      ); // blue
      renderer.drawPoint(
        new Vector(500, 100 + Math.cos(angle) * 20),
        5,
        0xffff00
      ); // yellow

      const polyPoints = [
        new Vector(600, 100),
        new Vector(700 + Math.sin(angle) * 30, 50),
        new Vector(650, 150 + Math.cos(angle) * 30),
      ];
      renderer.drawShape(polyPoints, 0xff00ff); // magenta

      renderer.renderFrame(); // Renders background, then geometry, then scales to canvas

      requestAnimationFrame(animate);
    }

    animate();
  } catch (error) {
    console.error("Renderer initialization or animation failed:", error);
    const errorDiv = document.createElement("div");
    errorDiv.textContent =
      "Error initializing WebGL renderer: " + error.message;
    container.prepend(errorDiv);
  }
});
