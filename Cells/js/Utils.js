// --- WebGL Helper Functions ---
export function createRenderTarget(gl, width, height) {
  const targetTexture = gl.createTexture();
  if (!targetTexture) {
    console.error("Failed to create texture for render target.");
    return null;
  }
  gl.bindTexture(gl.TEXTURE_2D, targetTexture);
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

  const frameBufferObject = gl.createFramebuffer();
  if (!frameBufferObject) {
    console.error("Failed to create framebuffer object for render target.");
    gl.deleteTexture(targetTexture);
    return null;
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER, frameBufferObject);
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0,
    gl.TEXTURE_2D,
    targetTexture,
    0
  );

  if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
    console.error("Framebuffer incomplete!");
    gl.deleteFramebuffer(frameBufferObject);
    gl.deleteTexture(targetTexture);
    return null;
  }

  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.bindTexture(gl.TEXTURE_2D, null);

  return { texture: targetTexture, fbo: frameBufferObject };
}

export function createShaderProgram(
  gl,
  vertexShaderSource,
  fragmentShaderSource
) {
  const vertexShader = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(vertexShader, vertexShaderSource);
  gl.compileShader(vertexShader);
  if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
    console.error(
      "Vertex shader compilation error:",
      gl.getShaderInfoLog(vertexShader)
    );
    gl.deleteShader(vertexShader);
    return null;
  }

  const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(fragmentShader, fragmentShaderSource);
  gl.compileShader(fragmentShader);
  if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
    console.error(
      "Fragment shader compilation error:",
      gl.getShaderInfoLog(fragmentShader)
    );
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    return null;
  }

  const shaderProgram = gl.createProgram();
  gl.attachShader(shaderProgram, vertexShader);
  gl.attachShader(shaderProgram, fragmentShader);
  gl.linkProgram(shaderProgram);
  if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
    console.error(
      "Shader program linking error:",
      gl.getProgramInfoLog(shaderProgram)
    );
    gl.deleteProgram(shaderProgram);
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    return null;
  }
  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);
  return shaderProgram;
}

// --- Color Utility ---
export function hexColorToNormalizedRgbArray(hexColor) {
  // Returns [r, g, b] array (0-1)
  const r = ((hexColor >> 16) & 255) / 255;
  const g = ((hexColor >> 8) & 255) / 255;
  const b = (hexColor & 255) / 255;
  return [r, g, b];
}

export function clampValue(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function lerpHexColors(hexColor1, hexColor2, amount) {
  amount = clampValue(amount, 0, 1);
  const r1 = (hexColor1 >> 16) & 255;
  const g1 = (hexColor1 >> 8) & 255;
  const b1 = hexColor1 & 255;
  const r2 = (hexColor2 >> 16) & 255;
  const g2 = (hexColor2 >> 8) & 255;
  const b2 = hexColor2 & 255;
  const r = Math.round(r1 + (r2 - r1) * amount);
  const g = Math.round(g1 + (g2 - g1) * amount);
  const b = Math.round(b1 + (b2 - b1) * amount);
  return (r << 16) | (g << 8) | b;
}
