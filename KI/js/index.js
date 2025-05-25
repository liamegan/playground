import { logGPUBuffer } from "./utils";

async function main() {
  // 1. Initialize WebGPU
  if (!navigator.gpu) {
    alert("WebGPU not supported on this browser.");
    throw new Error("WebGPU not supported.");
  }

  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) {
    alert("No appropriate GPUAdapter found.");
    throw new Error("No GPUAdapter found.");
  }

  const device = await adapter.requestDevice();
  const canvas = document.getElementById("webgpuCanvas");

  const gpuContext = canvas.getContext("webgpu");
  const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
  gpuContext.configure({
    device: device,
    format: presentationFormat,
    alphaMode: "premultiplied",
  });

  // Simulation Parameters
  const simParams = {
    canvasWidth: canvas.width,
    canvasHeight: canvas.height,
    dampingFactor: 0.55,
    pointSize: 10.0,
  };

  // 2. Point Data
  // const initialPoints = [
  //   { pos: { x: 50, y: 50 }, oldPos: { x: 45, y: 48 } },
  //   {
  //     pos: { x: canvas.width - 50, y: 100 },
  //     oldPos: { x: canvas.width - 51, y: 98 },
  //   },
  //   {
  //     pos: { x: 150, y: canvas.height - 50 },
  //     oldPos: { x: 148, y: canvas.height - 51 },
  //   },
  // ];
  const initialPoints = [];
  const numPoints = 1000;
  for (let i = 0; i < numPoints; i++) {
    const x = Math.random() * canvas.width;
    const y = Math.random() * canvas.height;
    const oldX = x + (Math.random() - 0.5) * 2; // Random old position
    const oldY = y + (Math.random() - 0.5) * 2; // Random old position
    initialPoints.push({
      pos: { x, y },
      oldPos: { x: oldX, y: oldY },
    });
  }
  // const numPoints = initialPoints.length;

  const positionsData = new Float32Array(numPoints * 2); // For initial upload
  const oldPositionsDataArr = new Float32Array(numPoints * 2); // JS array for old positions

  initialPoints.forEach((p, i) => {
    positionsData[i * 2] = p.pos.x;
    positionsData[i * 2 + 1] = p.pos.y;
    oldPositionsDataArr[i * 2] = p.oldPos.x;
    oldPositionsDataArr[i * 2 + 1] = p.oldPos.y;
  });

  // 3. Create GPU Buffers
  // Buffer for compute shader to write positions to
  const computeWritePositionsBuffer = device.createBuffer({
    size: positionsData.byteLength,
    usage:
      GPUBufferUsage.STORAGE |
      GPUBufferUsage.COPY_SRC |
      GPUBufferUsage.COPY_DST, // COPY_DST for initial data
    mappedAtCreation: true,
  });
  new Float32Array(computeWritePositionsBuffer.getMappedRange()).set(
    positionsData
  );
  computeWritePositionsBuffer.unmap();

  // Buffer for rendering (vertex data), compute shader will not touch this directly for writing
  const renderReadPositionsBuffer = device.createBuffer({
    size: positionsData.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });
  // We can optionally initialize it here, or let the first copy handle it.
  // device.queue.writeBuffer(renderReadPositionsBuffer, 0, positionsData);

  const oldPositionsBuffer = device.createBuffer({
    size: oldPositionsDataArr.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    mappedAtCreation: true,
  });
  new Float32Array(oldPositionsBuffer.getMappedRange()).set(
    oldPositionsDataArr
  );
  oldPositionsBuffer.unmap();

  const uniformBufferSize = 16;
  const uniformBuffer = device.createBuffer({
    size: uniformBufferSize,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const uniformData = new Float32Array([
    simParams.canvasWidth,
    simParams.canvasHeight,
    simParams.dampingFactor,
    simParams.pointSize,
  ]);
  device.queue.writeBuffer(uniformBuffer, 0, uniformData);

  // 4. Define Explicit Bind Group Layout for Compute
  const computeBindGroupLayout = device.createBindGroupLayout({
    entries: [
      {
        // @binding(0) computeWritePositionsBuffer
        binding: 0,
        visibility: GPUShaderStage.COMPUTE,
        buffer: { type: "storage" }, // This is where compute shader writes its results
      },
      {
        // @binding(1) oldPositionsBuffer
        binding: 1,
        visibility: GPUShaderStage.COMPUTE,
        buffer: { type: "storage" },
      },
      {
        // @binding(2) uniformBuffer (SimParams)
        binding: 2,
        visibility:
          GPUShaderStage.COMPUTE |
          GPUShaderStage.VERTEX |
          GPUShaderStage.FRAGMENT, // Vertex shader also uses this
        buffer: { type: "uniform" },
      },
    ],
  });

  // 5. Define Explicit Pipeline Layouts
  const computePipelineLayout = device.createPipelineLayout({
    bindGroupLayouts: [computeBindGroupLayout],
  });
  // Render pipeline might use a different layout if it only needs uniforms, or reuse if compatible.
  // For simplicity, if the render pipeline *only* uses the uniform from group 0, binding 2:
  const renderBindGroupLayout = device.createBindGroupLayout({
    entries: [
      {
        // @binding(2) uniformBuffer (SimParams) for render pipeline
        binding: 2, // Ensure this matches the shader's expectation for params
        visibility: GPUShaderStage.VERTEX,
        buffer: { type: "uniform" },
      },
    ],
  });
  const renderPipelineLayout = device.createPipelineLayout({
    bindGroupLayouts: [renderBindGroupLayout], // A layout specific to render pass if bindings differ significantly
    // OR use computePipelineLayout if the shared group works.
    // Let's keep using a shared layout for now and ensure the shared group is compatible.
    // The `computeBindGroupLayout` is fine as the render vertex shader only accesses binding 2.
  });

  // 6. Load Shaders
  const computeShaderModule = device.createShaderModule({
    code: await fetch("../wgsl/update_points.wgsl").then((res) => res.text()),
  });
  const pointRendererShaderModule = device.createShaderModule({
    code: await fetch("../wgsl/point_renderer.wgsl").then((res) => res.text()),
  });

  // 7. Create Compute Pipeline
  const computePipeline = device.createComputePipeline({
    layout: computePipelineLayout, // Use compute-specific or shared explicit layout
    compute: {
      module: computeShaderModule,
      entryPoint: "main",
    },
  });

  // 8. Create Render Pipeline
  const renderPipeline = device.createRenderPipeline({
    layout: computePipelineLayout, // Use the same layout if the bind group structure is shared for binding 2
    vertex: {
      module: pointRendererShaderModule,
      entryPoint: "vs_main",
      buffers: [
        // Describes the per-instance vertex buffer (renderReadPositionsBuffer)
        {
          arrayStride: 2 * 4,
          stepMode: "instance",
          attributes: [{ shaderLocation: 0, offset: 0, format: "float32x2" }],
        },
      ],
    },
    fragment: {
      module: pointRendererShaderModule,
      entryPoint: "fs_main",
      targets: [
        {
          format: presentationFormat,
          blend: {
            // Add this blend configuration
            color: {
              srcFactor: "one", // Since shader output is premultiplied: (srcR*srcA, srcG*srcA, srcB*srcA)
              dstFactor: "one-minus-src-alpha", // dstRGB * (1 - srcA)
              operation: "add", // finalRGB = (srcR*srcA) + dstRGB * (1 - srcA)
            },
            alpha: {
              srcFactor: "one", // Or "one" if accumulating alpha, "zero" if source alpha overwrites
              dstFactor: "one-minus-src-alpha", // Common setting for typical alpha blending
              operation: "add", // finalAlpha = srcA + dstA * (1 - srcA)
            },
          },
        },
      ],
    },
    primitive: {
      topology: "triangle-list",
    },
    // multisample: {
    //   count: 4,
    // },
  });

  // 9. Create Bind Group for Compute (and for uniforms in Render)
  const computeAndGlobalParamsBindGroup = device.createBindGroup({
    layout: computeBindGroupLayout, // This layout defines all 3 bindings
    entries: [
      { binding: 0, resource: { buffer: computeWritePositionsBuffer } }, // Compute writes here
      { binding: 1, resource: { buffer: oldPositionsBuffer } },
      { binding: 2, resource: { buffer: uniformBuffer } }, // Shared uniform
    ],
  });

  // 10. Simulation Loop
  async function simulationLoop() {
    const commandEncoder = device.createCommandEncoder();

    // --- Compute Pass ---
    // Writes to computeWritePositionsBuffer
    const computePass = commandEncoder.beginComputePass();
    computePass.setPipeline(computePipeline);
    computePass.setBindGroup(0, computeAndGlobalParamsBindGroup);
    computePass.dispatchWorkgroups(Math.ceil(numPoints / 64));
    computePass.end();

    // --- Copy Pass ---
    // Copy results from compute buffer to render buffer
    commandEncoder.copyBufferToBuffer(
      computeWritePositionsBuffer, // Source
      0,
      renderReadPositionsBuffer, // Destination
      0,
      positionsData.byteLength // Size of data to copy
    );

    // --- Render Pass ---
    // Reads from renderReadPositionsBuffer (as vertex buffer)
    // Reads from uniformBuffer (via computeAndGlobalParamsBindGroup for SimParams)
    const textureView = gpuContext.getCurrentTexture().createView();
    const renderPassDescriptor = {
      colorAttachments: [
        {
          view: textureView,
          clearValue: { r: 0.95, g: 0.95, b: 0.95, a: 1.0 },
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    };
    const renderPass = commandEncoder.beginRenderPass(renderPassDescriptor);
    renderPass.setPipeline(renderPipeline);
    // This bind group provides the uniform SimParams at binding 2,
    // which is what the vertex shader in the render pipeline expects.
    // Bindings 0 and 1 from this group are not used by the render pipeline's shaders.
    renderPass.setBindGroup(0, computeAndGlobalParamsBindGroup);
    renderPass.setVertexBuffer(0, renderReadPositionsBuffer); // Use the dedicated render buffer
    renderPass.draw(6, numPoints, 0, 0);
    renderPass.end();

    // console.clear();
    // logGPUBuffer(device, computeWritePositionsBuffer).catch(console.error);

    device.queue.submit([commandEncoder.finish()]);

    requestAnimationFrame(simulationLoop);
  }

  requestAnimationFrame(simulationLoop);
}

main().catch((err) => console.error(err));
