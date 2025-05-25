import {
  createRenderTarget,
  createShaderProgram,
  hexColorToNormalizedRgbArray,
  clampValue,
  lerpHexColors,
} from "./Utils.js";
import { Vector } from "./Vector.js";

// --- Shader Definitions ---
const RESIZE_FRAGMENT_SHADER = `#version 100
precision mediump float;uniform vec2 inputSize;uniform vec2 outputSize;uniform sampler2D inputTexture;void main(){vec2 position=gl_FragCoord.xy/outputSize;vec4 sample=texture2D(inputTexture,position);gl_FragColor=sample;}`;
const RESIZE_VERTEX_SHADER = `#version 100
attribute vec2 aVertexPosition;void main(){gl_Position=vec4(aVertexPosition,0.0,1.0);}`;
const GEOMETRY_FRAGMENT_SHADER =
  "varying lowp vec4 vColor;void main(void){gl_FragColor=vColor;}";
const GEOMETRY_VERTEX_SHADER =
  "attribute vec2 transformedPosition;attribute vec3 vertexColor;varying lowp vec4 vColor;void main(void){gl_Position=vec4(transformedPosition,0.0,1.0);vColor=vec4(vertexColor,1.0);}";
const BACKGROUND_FRAGMENT_SHADER = `#version 100
precision mediump float;uniform vec2 viewportSize;uniform float sdfCircleData[30];uniform vec3 backgroundColor1;uniform vec3 backgroundColor2;void main(){float k=0.1;vec2 position=vec2(gl_FragCoord.x,viewportSize.y-gl_FragCoord.y);float sumOfInfluences = 0.0;for(int i=0;i<10;i++){float radius=sdfCircleData[i*3+2];if(radius>0.0){float distToCircleEdge=length(position-vec2(sdfCircleData[i*3],sdfCircleData[i*3+1]))-radius;sumOfInfluences+=pow(2.,-k*distToCircleEdge);}}float metaballValue=-log2(sumOfInfluences)/k;gl_FragColor=mix(vec4(backgroundColor1,1.0),vec4(backgroundColor2,1.0),clamp(metaballValue/30.0,0.0,1.0));}`;
const BACKGROUND_VERTEX_SHADER = `#version 100
attribute vec2 aVertexPosition;void main(){gl_Position=vec4(aVertexPosition,0.0,1.0);}`;

// --- Constants for Drawing ---
const DEFAULT_CIRCLE_SEGMENTS = 10;
const SDF_DRAW_GRID_STEP_SIZE = 10;

// --- Renderer Class ---
export class Renderer {
  constructor(
    canvasElement,
    internalWidth,
    internalHeight,
    devicePixelRatio = 1,
    maxLineThickness = 2,
    getBackgroundColor1HexFn, // Function that returns a hex color number
    getBackgroundColor2HexFn // Function that returns a hex color number
  ) {
    this.vertexPositionsData = [];
    this.vertexColorsData = [];

    this.maxLineThickness = 999;
    this.backgroundSdfCirclesDataIndex = 0;

    this.renderingWidth = internalWidth;
    this.renderingHeight = internalHeight;
    this.canvasElement = canvasElement;
    this.devicePixelRatio = devicePixelRatio;

    this.canvasElement.width = internalWidth * devicePixelRatio;
    this.canvasElement.height = internalHeight * devicePixelRatio;

    this.gl = this.canvasElement.getContext("webgl");
    if (!this.gl) {
      console.error("WebGL not supported or context creation failed!");
      throw new Error("WebGL not supported");
    }

    this.renderTarget = createRenderTarget(
      this.gl,
      internalWidth,
      internalHeight
    );
    if (!this.renderTarget) {
      throw new Error("Failed to create render target.");
    }
    this.resizeShaderProgram = createShaderProgram(
      this.gl,
      RESIZE_VERTEX_SHADER,
      RESIZE_FRAGMENT_SHADER
    );
    this.geometryShaderProgram = createShaderProgram(
      this.gl,
      GEOMETRY_VERTEX_SHADER,
      GEOMETRY_FRAGMENT_SHADER
    );
    this.backgroundShaderProgram = createShaderProgram(
      this.gl,
      BACKGROUND_VERTEX_SHADER,
      BACKGROUND_FRAGMENT_SHADER
    );

    if (
      !this.resizeShaderProgram ||
      !this.geometryShaderProgram ||
      !this.backgroundShaderProgram
    ) {
      // Specific errors logged in createShaderProgram
      throw new Error("Failed to create one or more shader programs.");
    }

    this.maxLineThickness = maxLineThickness;
    this.getBackgroundColor1Hex = getBackgroundColor1HexFn || (() => 0x000000);
    this.getBackgroundColor2Hex = getBackgroundColor2HexFn || (() => 0x222222);

    this.backgroundSdfCirclesData = new Float32Array(30).fill(-1);
  }

  setBackgroundSdfCircles(circlesArray) {
    this.backgroundSdfCirclesDataIndex = 0;
    for (
      let i = 0;
      i < circlesArray.length &&
      this.backgroundSdfCirclesDataIndex <
        this.backgroundSdfCirclesData.length - 2;
      i++
    ) {
      const circle = circlesArray[i];
      this.backgroundSdfCirclesData[this.backgroundSdfCirclesDataIndex++] =
        circle.position.x;
      this.backgroundSdfCirclesData[this.backgroundSdfCirclesDataIndex++] =
        circle.position.y;
      this.backgroundSdfCirclesData[this.backgroundSdfCirclesDataIndex++] =
        circle.radius;
    }
    for (
      let i = this.backgroundSdfCirclesDataIndex;
      i < this.backgroundSdfCirclesData.length;
      i++
    ) {
      this.backgroundSdfCirclesData[i] = -1;
    }
  }

  setCanvasDisplayDimensions(displayWidth, displayHeight) {
    this.canvasElement.style.width = displayWidth + "px";
    this.canvasElement.style.height = displayHeight + "px";
  }

  setRenderingResolution(newWidth, newHeight) {
    this.renderingWidth = newWidth;
    this.renderingHeight = newHeight;

    this.canvasElement.width = newWidth * this.devicePixelRatio;
    this.canvasElement.height = newHeight * this.devicePixelRatio;

    if (this.renderTarget && this.renderTarget.texture)
      this.gl.deleteTexture(this.renderTarget.texture);
    if (this.renderTarget && this.renderTarget.fbo)
      this.gl.deleteFramebuffer(this.renderTarget.fbo);

    this.renderTarget = createRenderTarget(
      this.gl,
      this.renderingWidth,
      this.renderingHeight
    );
    if (!this.renderTarget) {
      console.error(
        "Failed to recreate render target during resolution change."
      );
      // Potentially throw an error or enter a degraded state
    }
  }

  clearGeometryBuffers() {
    this.vertexPositionsData = [];
    this.vertexColorsData = [];
  }

  renderFrame() {
    if (!this.gl || !this.renderTarget) {
      console.error("Renderer not properly initialized or context lost.");
      return;
    }
    this._renderBackgroundToTarget();
    this._renderGeometryToTarget();
    this._renderTargetToCanvas();
  }

  drawShape(pointsArray, hexColor) {
    if (pointsArray.length < 3) return;
    const centroid = Vector.average(pointsArray) || pointsArray[0].clone();

    for (let i = 0; i < pointsArray.length; i++) {
      this.drawTriangle(
        centroid.x,
        centroid.y,
        pointsArray[(i + 1) % pointsArray.length].x,
        pointsArray[(i + 1) % pointsArray.length].y,
        pointsArray[i].x,
        pointsArray[i].y,
        hexColor
      );
    }
  }

  drawCircle(
    centerVector,
    radius,
    hexColor = 0xffffff,
    segments = DEFAULT_CIRCLE_SEGMENTS
  ) {
    const angleStep = (Math.PI * 2) / segments;
    const points = [];
    for (let i = 0; i < segments; i++) {
      points.push(
        new Vector(
          centerVector.x + Math.cos(i * angleStep) * radius,
          centerVector.y + Math.sin(i * angleStep) * radius
        )
      );
    }
    this.drawShape(points, hexColor);
  }

  drawLine(startVector, endVector, thickness = 2, hexColor = 0xffffff) {
    thickness = Math.min(this.maxLineThickness, thickness);
    const delta = Vector.subtract(endVector, startVector);
    const perpendicular = new Vector(-delta.y, delta.x);
    perpendicular.normalize();
    perpendicular.multiplyByScalar(thickness / 2);

    const p1 = Vector.add(startVector, perpendicular);
    const p2 = Vector.subtract(startVector, perpendicular);
    const p3 = Vector.add(endVector, perpendicular);
    const p4 = Vector.subtract(endVector, perpendicular);

    this.drawTriangle(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y, hexColor);
    this.drawTriangle(p3.x, p3.y, p2.x, p2.y, p4.x, p4.y, hexColor);
  }

  drawPoint(positionVector, size = 3, hexColor = 0xffffff) {
    this.drawRectangle(
      positionVector.x - size / 2,
      positionVector.y - size / 2,
      positionVector.x + size / 2,
      positionVector.y + size / 2,
      hexColor
    );
  }

  drawRectangle(x1, y1, x2, y2, hexColor = 0xffffff) {
    this.drawTriangle(x1, y1, x2, y1, x1, y2, hexColor);
    this.drawTriangle(x2, y2, x2, y1, x1, y2, hexColor);
  }

  drawTriangle(x1, y1, x2, y2, x3, y3, hexColor = 0xffffff) {
    const halfWidth = this.renderingWidth / 2;
    const halfHeight = this.renderingHeight / 2;

    const transformedX1 = (x1 - halfWidth) / halfWidth;
    const transformedY1 = (halfHeight - y1) / halfHeight;
    const transformedX2 = (x2 - halfWidth) / halfWidth;
    const transformedY2 = (halfHeight - y2) / halfHeight;
    const transformedX3 = (x3 - halfWidth) / halfWidth;
    const transformedY3 = (halfHeight - y3) / halfHeight;

    this.vertexPositionsData.push(
      transformedX1,
      transformedY1,
      transformedX2,
      transformedY2,
      transformedX3,
      transformedY3
    );

    const [r, g, b] = hexColorToNormalizedRgbArray(hexColor);
    this.vertexColorsData.push(r, g, b, r, g, b, r, g, b);
  }

  drawSdfDebugGrid(sdfFunction, hexColor1 = 0x000000, hexColor2 = 0xffffff) {
    for (let y = 0; y < this.renderingHeight; y += SDF_DRAW_GRID_STEP_SIZE) {
      for (let x = 0; x < this.renderingWidth; x += SDF_DRAW_GRID_STEP_SIZE) {
        const sdfValue = sdfFunction(x, y);
        const normalizedValue = clampValue((sdfValue + 50) / 100, 0, 1);
        this.drawRectangle(
          x,
          y,
          x + SDF_DRAW_GRID_STEP_SIZE,
          y + SDF_DRAW_GRID_STEP_SIZE,
          lerpHexColors(hexColor1, hexColor2, normalizedValue)
        );
      }
    }
  }

  _renderBackgroundToTarget() {
    const gl = this.gl;
    const bgColor1Rgb = hexColorToNormalizedRgbArray(
      this.getBackgroundColor1Hex()
    );
    const bgColor2Rgb = hexColorToNormalizedRgbArray(
      this.getBackgroundColor2Hex()
    );

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.renderTarget.fbo);
    gl.viewport(0, 0, this.renderingWidth, this.renderingHeight);

    gl.useProgram(this.backgroundShaderProgram);

    const quadVertices = new Float32Array([
      -1, 1, 1, 1, 1, -1, -1, 1, 1, -1, -1, -1,
    ]);
    const quadBuffer = gl.createBuffer();
    if (!quadBuffer) {
      console.error("Failed to create quadBuffer for background.");
      return;
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, quadVertices, gl.STATIC_DRAW);

    const viewportSizeLocation = gl.getUniformLocation(
      this.backgroundShaderProgram,
      "viewportSize"
    );
    gl.uniform2fv(viewportSizeLocation, [
      this.renderingWidth,
      this.renderingHeight,
    ]);
    const sdfCirclesLocation = gl.getUniformLocation(
      this.backgroundShaderProgram,
      "sdfCircleData"
    );
    gl.uniform1fv(sdfCirclesLocation, this.backgroundSdfCirclesData);
    const bgColor1Location = gl.getUniformLocation(
      this.backgroundShaderProgram,
      "backgroundColor1"
    );
    gl.uniform3f(
      bgColor1Location,
      bgColor1Rgb[0],
      bgColor1Rgb[1],
      bgColor1Rgb[2]
    );
    const bgColor2Location = gl.getUniformLocation(
      this.backgroundShaderProgram,
      "backgroundColor2"
    );
    gl.uniform3f(
      bgColor2Location,
      bgColor2Rgb[0],
      bgColor2Rgb[1],
      bgColor2Rgb[2]
    );

    const vertexPositionLocation = gl.getAttribLocation(
      this.backgroundShaderProgram,
      "aVertexPosition"
    );
    if (vertexPositionLocation === -1) {
      console.error(
        "Attribute 'aVertexPosition' not found in backgroundShaderProgram."
      );
      gl.deleteBuffer(quadBuffer);
      return;
    }
    gl.enableVertexAttribArray(vertexPositionLocation);
    gl.vertexAttribPointer(vertexPositionLocation, 2, gl.FLOAT, false, 0, 0);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.disableVertexAttribArray(vertexPositionLocation);
    gl.deleteBuffer(quadBuffer);
  }

  _renderGeometryToTarget() {
    const gl = this.gl;
    if (this.vertexPositionsData.length === 0) return;

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.renderTarget.fbo);
    gl.viewport(0, 0, this.renderingWidth, this.renderingHeight);

    gl.useProgram(this.geometryShaderProgram);

    const positionBuffer = gl.createBuffer();
    if (!positionBuffer) {
      console.error("Failed to create positionBuffer for geometry.");
      return;
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array(this.vertexPositionsData),
      gl.STATIC_DRAW
    );
    const transformedPositionLocation = gl.getAttribLocation(
      this.geometryShaderProgram,
      "transformedPosition"
    );
    if (transformedPositionLocation === -1) {
      console.error(
        "Attribute 'transformedPosition' not found in geometryShaderProgram."
      );
      gl.deleteBuffer(positionBuffer);
      return;
    }
    gl.vertexAttribPointer(
      transformedPositionLocation,
      2,
      gl.FLOAT,
      false,
      0,
      0
    );
    gl.enableVertexAttribArray(transformedPositionLocation);

    const colorBuffer = gl.createBuffer();
    if (!colorBuffer) {
      console.error("Failed to create colorBuffer for geometry.");
      gl.deleteBuffer(positionBuffer);
      return;
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array(this.vertexColorsData),
      gl.STATIC_DRAW
    );
    const vertexColorLocation = gl.getAttribLocation(
      this.geometryShaderProgram,
      "vertexColor"
    );
    if (vertexColorLocation === -1) {
      console.error(
        "Attribute 'vertexColor' not found in geometryShaderProgram."
      );
      gl.deleteBuffer(positionBuffer);
      gl.deleteBuffer(colorBuffer);
      return;
    }
    gl.vertexAttribPointer(vertexColorLocation, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vertexColorLocation);

    gl.drawArrays(gl.TRIANGLES, 0, this.vertexPositionsData.length / 2);

    gl.disableVertexAttribArray(transformedPositionLocation);
    gl.disableVertexAttribArray(vertexColorLocation);
    gl.deleteBuffer(positionBuffer);
    gl.deleteBuffer(colorBuffer);
  }

  _renderTargetToCanvas() {
    const gl = this.gl;
    const canvas = this.canvasElement;

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);

    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(this.resizeShaderProgram);

    const quadVertices = new Float32Array([
      -1, 1, 1, 1, 1, -1, -1, 1, 1, -1, -1, -1,
    ]);
    const quadBuffer = gl.createBuffer();
    if (!quadBuffer) {
      console.error("Failed to create quadBuffer for target to canvas render.");
      return;
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, quadVertices, gl.STATIC_DRAW);

    const inputSizeLocation = gl.getUniformLocation(
      this.resizeShaderProgram,
      "inputSize"
    );
    gl.uniform2fv(inputSizeLocation, [
      this.renderingWidth,
      this.renderingHeight,
    ]);
    const outputSizeLocation = gl.getUniformLocation(
      this.resizeShaderProgram,
      "outputSize"
    );
    gl.uniform2fv(outputSizeLocation, [canvas.width, canvas.height]);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.renderTarget.texture);
    const inputTextureLocation = gl.getUniformLocation(
      this.resizeShaderProgram,
      "inputTexture"
    );
    gl.uniform1i(inputTextureLocation, 0);

    const vertexPositionLocation = gl.getAttribLocation(
      this.resizeShaderProgram,
      "aVertexPosition"
    );
    if (vertexPositionLocation === -1) {
      // Check if attribute location is valid
      console.error(
        "Attribute 'aVertexPosition' not found in resizeShaderProgram for _renderTargetToCanvas."
      );
      gl.deleteBuffer(quadBuffer); // Clean up buffer
      return; // Skip drawing if attribute is not found
    }
    gl.enableVertexAttribArray(vertexPositionLocation);
    // Ensure buffer is bound before vertexAttribPointer. It is, due to the bindBuffer call above for quadBuffer.
    gl.vertexAttribPointer(vertexPositionLocation, 2, gl.FLOAT, false, 0, 0);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.disableVertexAttribArray(vertexPositionLocation); // Disable after use
    gl.deleteBuffer(quadBuffer);
  }
}
