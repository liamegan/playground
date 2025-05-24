class Renderer {
  constructor(
    width,
    height,
    scaleFactor,
    maxLineThickness,
    getBackground1,
    getBackground2
  ) {
    this.width = width;
    this.height = height;
    this.maxLineThickness = maxLineThickness;
    this.canvas = document.createElement("canvas");
    this.canvas.id = "main-canvas";
    this.canvas.width = width * scaleFactor;
    this.canvas.height = height * scaleFactor;
    document.body.appendChild(this.canvas);
    this.gl = this.canvas.getContext("webgl");

    // Create an off-screen render target.
    this.renderTarget = createRenderTarget(this.gl, width, height);

    // Set up shaders.
    this.resizeShader = createShaderProgram(
      this.gl,
      resizeVertexShaderSource,
      resizeFragmentShaderSource
    );
    this.shaderProgram = createShaderProgram(
      this.gl,
      basicVertexShaderSource,
      basicFragmentShaderSource
    );
    this.backgroundShaderProgram = createShaderProgram(
      this.gl,
      backgroundVertexShaderSource,
      backgroundFragmentShaderSource
    );

    // Other properties and SDF (signed distance field) circles.
    this.sdfCircles = Array(30).fill(-1);
    this.lastCircleIndex = 0;
  }

  // Methods for clearing, drawing shapes (line, triangle, circle, etc.),
  // rendering the background and geometry, and finally compositing the scene.
  // ...
}

// Helper functions to create render targets and compile shader programs.
function createRenderTarget(gl, width, height) {
  // Creates a texture and framebuffer for off-screen rendering.
  let texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    width,
    height,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    null
  );
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  let fbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0,
    gl.TEXTURE_2D,
    texture,
    0
  );
  gl.clearColor(0, 0, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);
  return { texture, fbo };
}

function createShaderProgram(gl, vertexSource, fragmentSource) {
  let vertexShader = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(vertexShader, vertexSource);
  gl.compileShader(vertexShader);

  let fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(fragmentShader, fragmentSource);
  gl.compileShader(fragmentShader);

  let program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  // (Error logging omitted for brevity)
  return program;
}
