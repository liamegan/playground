// wgsl/update_points.wgsl

// Uniforms: Data that is constant for all invocations in a dispatch.
struct SimParams {
  canvas_dims: vec2<f32>,    // 8 bytes
  damping_factor: f32,     // 4 bytes
  point_size: f32,         // 4 bytes
}; // Total 16 bytes

@group(0) @binding(0) var<storage, read_write> positions: array<vec2<f32>>;
@group(0) @binding(1) var<storage, read_write> old_positions: array<vec2<f32>>;
@group(0) @binding(2) var<uniform> params: SimParams;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let index = global_id.x;

  // Boundary check if not dispatching exact number of points
  // if (index >= arrayLength(&positions)) {
  //   return;
  // }

  let current_pos = positions[index];
  let prev_pos = old_positions[index];

  // Verlet integration
  var velocity = current_pos - prev_pos;
  var next_pos = current_pos + velocity;
  var new_old_pos_for_next_frame = current_pos;

  // Boundary checks and response
  // X-axis
  if (next_pos.x < 0.0) {
    next_pos.x = 0.0;
    new_old_pos_for_next_frame.x = next_pos.x + velocity.x * params.damping_factor;
  } else if (next_pos.x > params.canvas_dims.x) {
    next_pos.x = params.canvas_dims.x;
    new_old_pos_for_next_frame.x = next_pos.x + velocity.x * params.damping_factor;
  }

  // Y-axis
  if (next_pos.y < 0.0) {
    next_pos.y = 0.0;
    new_old_pos_for_next_frame.y = next_pos.y + velocity.y * params.damping_factor;
  } else if (next_pos.y > params.canvas_dims.y) {
    next_pos.y = params.canvas_dims.y;
    new_old_pos_for_next_frame.y = next_pos.y + velocity.y * params.damping_factor;
  }

  positions[index] = next_pos;
  old_positions[index] = new_old_pos_for_next_frame;
}