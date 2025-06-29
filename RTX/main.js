import { Vec3 } from "wtc-math";

async function main() {
  // Get the canvas element
  const canvas = document.getElementById("webgpu-canvas");
  if (!canvas) {
    console.error("Canvas element not found!");
    return;
  }
  canvas.width = window.innerWidth * 0.8;
  canvas.height = window.innerHeight * 0.8;

  // Request adapter and device
  if (!navigator.gpu) {
    console.error("WebGPU not supported on this browser.");
    return;
  }
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) {
    console.error("Failed to get GPU adapter.");
    return;
  }
  const device = await adapter.requestDevice();

  // Configure canvas context
  const context = canvas.getContext("webgpu");
  const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
  context.configure({
    device,
    format: presentationFormat,
    alphaMode: "opaque",
  });

  const renderParams = {
    voxelSize: 0.2,
    maxRenderDistance: 15.0, // Max distance to raymarch
  };

  // Fetch and create shader module
  const response = await fetch("./raytracer.wgsl");
  if (!response.ok) {
    console.error(
      `Failed to fetch shader: ${response.status} ${response.statusText}`
    );
    alert("Failed to load shader. See console for details.");
    return;
  }
  const shaderCode = await response.text();

  const shaderModule = device.createShaderModule({
    code: shaderCode,
  });

  // Create a uniform buffer
  // resolution: vec2<f32>           -> offset 0, size 8. Padded to 16.
  // camera_pos: vec3<f32>           -> offset 16, size 12. Padded to 16 (next starts at 32)
  // camera_forward: vec3<f32>       -> offset 32, size 12. Padded to 16 (next starts at 48)
  // camera_right: vec3<f32>         -> offset 48, size 12. Padded to 16 (next starts at 64)
  // camera_up: vec3<f32>            -> offset 64, size 12. Padded to 16 (next starts at 80)
  // voxel_size: f32               -> offset 80, size 4.
  // max_render_distance: f32      -> offset 84, size 4.
  // Total declared: 88 bytes. Struct size must be multiple of largest member alignment (vec3 -> 16 bytes).
  // So, total size of uniform buffer will be 96 bytes.

  const uniformBufferSize = 96;
  const uniformBuffer = device.createBuffer({
    size: uniformBufferSize,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  // Create a bind group
  const bindGroupLayout = device.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.FRAGMENT,
        buffer: { type: "uniform" },
      },
    ],
  });

  const bindGroup = device.createBindGroup({
    layout: bindGroupLayout,
    entries: [
      {
        binding: 0,
        resource: { buffer: uniformBuffer },
      },
    ],
  });

  // Create a render pipeline
  const pipelineLayout = device.createPipelineLayout({
    bindGroupLayouts: [bindGroupLayout], // Use the new layout here
  });

  const pipeline = device.createRenderPipeline({
    layout: pipelineLayout, // Use the new layout here
    vertex: {
      module: shaderModule,
      entryPoint: "vs_main",
    },
    fragment: {
      module: shaderModule,
      entryPoint: "fs_main",
      targets: [
        {
          format: presentationFormat,
        },
      ],
    },
    primitive: {
      topology: "triangle-list", // We draw two triangles to make a quad
    },
  });

  // Render loop
  let camera = {
    yaw: Math.PI * 0.25, // Angle around Y axis
    pitch: Math.PI * 0.15, // Angle around X axis (from horizontal plane)
    distance: 4.0, // Distance from origin (or lookAt point)
    lookAt: new Vec3(0, 0, 0), // Point the camera is looking at
    fov: Math.PI / 4, // Field of view (not used in current shader explicitly but good for perspective matrix later)
  };

  let mouseState = {
    isDragging: false,
    lastX: 0,
    lastY: 0,
  };

  canvas.addEventListener("mousedown", (event) => {
    if (event.button === 0) {
      // Left mouse button
      mouseState.isDragging = true;
      mouseState.lastX = event.clientX;
      mouseState.lastY = event.clientY;
    }
  });

  window.addEventListener("mousemove", (event) => {
    if (mouseState.isDragging) {
      const dx = event.clientX - mouseState.lastX;
      const dy = event.clientY - mouseState.lastY;

      camera.yaw += dx * 0.005; // Inverted: yaw increases with positive dx
      camera.pitch -= dy * 0.005;

      // Clamp pitch to avoid flipping over
      camera.pitch = Math.max(
        -Math.PI / 2 + 0.01,
        Math.min(Math.PI / 2 - 0.01, camera.pitch)
      );

      mouseState.lastX = event.clientX;
      mouseState.lastY = event.clientY;
    }
  });

  window.addEventListener("mouseup", (event) => {
    if (event.button === 0) {
      mouseState.isDragging = false;
    }
  });

  canvas.addEventListener("wheel", (event) => {
    event.preventDefault(); // Prevent page scrolling
    camera.distance += event.deltaY * 0.005;
    camera.distance = Math.max(0.5, Math.min(20.0, camera.distance)); // Clamp distance
  });

  function frame() {
    if (!canvas) return; // Stop if canvas is gone

    // Update camera vectors using wtc-math
    const cosPitch = Math.cos(camera.pitch);
    const sinPitch = Math.sin(camera.pitch);
    const cosYaw = Math.cos(camera.yaw);
    const sinYaw = Math.sin(camera.yaw);

    const relPos = new Vec3(
      camera.distance * sinPitch * cosYaw,
      camera.distance * cosPitch,
      camera.distance * sinPitch * sinYaw
    );
    const cameraPosVec = camera.lookAt.addNew(relPos);

    // Forward vector (lookAt - cameraPos, then normalize)
    const fwdVec = camera.lookAt.subtractNew(cameraPosVec).normalise();

    // Right vector (cross product of forward and world up, then normalize)
    const worldUpVec = new Vec3(0, 1, 0);
    // Standard convention: Right = normalize(cross(Forward, WorldUp))
    let rightVec = fwdVec.crossNew(worldUpVec);

    // Handle case where fwd is parallel to worldUp (e.g. looking straight up/down)
    // lengthSquared is an accessor, so we use it as a property.
    if (rightVec.lengthSquared < 0.0001) {
      // If looking straight up (fwdVec.y approx 1), fwd x worldUp is near zero.
      // We need a stable right vector. If fwd is (0,1,0), right could be (1,0,0) or (-1,0,0) depending on yaw.
      // Let's use a right vector based on yaw to avoid spinning wildly.
      // A common approach is to use a fixed 'global right' if up is aligned with forward,
      // but for an orbit camera, yaw still has meaning.
      // If fwdVec.y is positive (looking up), right = (cos(yaw+PI/2), 0, sin(yaw+PI/2))
      // = (-sinYaw, 0, cosYaw)
      // If fwdVec.y is negative (looking down), right = (cos(yaw-PI/2), 0, sin(yaw-PI/2))
      // = (sinYaw, 0, -cosYaw)
      if (fwdVec.y > 0) {
        // looking up or mostly up
        rightVec.x = -sinYaw;
        rightVec.y = 0;
        rightVec.z = cosYaw;
      } else {
        // looking down or mostly down
        rightVec.x = sinYaw;
        rightVec.y = 0;
        rightVec.z = -cosYaw;
      }
      // If yaw makes this zero (e.g. aligned with Z axis), default to (1,0,0)
      if (rightVec.lengthSquared < 0.0001) {
        rightVec.x = 1;
        rightVec.y = 0;
        rightVec.z = 0;
      }
    }
    rightVec.normalise();

    // Up vector (cross product of right and forward, then normalize)
    // Up = normalize(cross(Right, Forward))
    const upVec = rightVec.crossNew(fwdVec).normalise();

    // Update resolution and camera uniforms
    const resolutionArray = new Float32Array([canvas.width, canvas.height]);
    const cameraPosArray = new Float32Array([
      cameraPosVec.x,
      cameraPosVec.y,
      cameraPosVec.z,
    ]);
    const cameraForwardArray = new Float32Array([fwdVec.x, fwdVec.y, fwdVec.z]);
    const cameraRightArray = new Float32Array([
      rightVec.x,
      rightVec.y,
      rightVec.z,
    ]);
    const cameraUpArray = new Float32Array([upVec.x, upVec.y, upVec.z]);
    const voxelSizeArray = new Float32Array([renderParams.voxelSize]);
    const maxRenderDistanceArray = new Float32Array([
      renderParams.maxRenderDistance,
    ]);

    // Write data to buffer
    device.queue.writeBuffer(uniformBuffer, 0, resolutionArray); // offset 0 (vec2, 8B) -> padded to 16
    device.queue.writeBuffer(uniformBuffer, 16, cameraPosArray); // offset 16 (vec3, 12B) -> padded to 16 (total 32)
    device.queue.writeBuffer(uniformBuffer, 32, cameraForwardArray); // offset 32 (vec3, 12B) -> padded to 16 (total 48)
    device.queue.writeBuffer(uniformBuffer, 48, cameraRightArray); // offset 48 (vec3, 12B) -> padded to 16 (total 64)
    device.queue.writeBuffer(uniformBuffer, 64, cameraUpArray); // offset 64 (vec3, 12B) -> padded to 16 (total 80)
    device.queue.writeBuffer(uniformBuffer, 80, voxelSizeArray); // offset 80 (f32, 4B)
    device.queue.writeBuffer(uniformBuffer, 84, maxRenderDistanceArray); // offset 84 (f32, 4B) -> buffer ends at 88, padded to 96

    const commandEncoder = device.createCommandEncoder();
    const textureView = context.getCurrentTexture().createView();

    const renderPassDescriptor = {
      colorAttachments: [
        {
          view: textureView,
          clearValue: { r: 0.1, g: 0.1, b: 0.1, a: 1.0 },
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    };

    const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
    passEncoder.setPipeline(pipeline);
    passEncoder.setBindGroup(0, bindGroup); // Set the bind group
    passEncoder.draw(6, 1, 0, 0); // Draw a full-screen quad (6 vertices)
    passEncoder.end();

    device.queue.submit([commandEncoder.finish()]);
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

main().catch((err) => console.error(err));
