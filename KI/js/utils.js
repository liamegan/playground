export async function logGPUBuffer(device, bufferToRead) {
  // 1. Create a staging buffer
  const stagingBuffer = device.createBuffer({
    size: bufferToRead.size,
    usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
  });

  // 2. Copy data to staging buffer
  const commandEncoder = device.createCommandEncoder();
  commandEncoder.copyBufferToBuffer(
    bufferToRead, // source
    0, // sourceOffset
    stagingBuffer, // destination
    0, // destinationOffset
    bufferToRead.size // size
  );

  // Submit commands to the GPU
  const gpuCommands = commandEncoder.finish();
  device.queue.submit([gpuCommands]);

  // 3. Map the staging buffer
  await stagingBuffer.mapAsync(GPUMapMode.READ, 0, bufferToRead.size);

  // 4. Get mapped range and log
  const copyArrayBuffer = stagingBuffer.getMappedRange(0, bufferToRead.size);
  // Assuming your data is Float32
  const data = new Float32Array(copyArrayBuffer.slice(0)); // Use slice to create a copy

  console.log("Buffer data:", data);

  // 5. Unmap the buffer
  stagingBuffer.unmap();
  stagingBuffer.destroy(); // Optional: destroy if not needed anymore
}
