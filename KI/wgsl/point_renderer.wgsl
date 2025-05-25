// wgsl/point_renderer.wgsl

struct SimParams {
  canvas_dims: vec2<f32>,
  damping_factor: f32, // Not used in rendering shaders, but part of the shared struct
  point_size: f32,
};

// This bind group layout is expected by both the vertex shader here
// and the compute shader in update_points.wgsl
@group(0) @binding(2) var<uniform> params: SimParams;

// Vertex Shader Output / Fragment Shader Input (if needed for more complex cases)
// For this simple case, the fragment shader doesn't take varying inputs from the vertex shader
// beyond what's implicitly handled by the rasterizer for @builtin(position).
// struct VertexOutput {
//   @builtin(position) position: vec4<f32>,
//   // @location(0) color: vec4<f32>, // Example if passing color
// };

// --- Vertex Shader ---
@vertex
fn vs_main(
  @builtin(vertex_index) vertex_idx: u32,
  @location(0) instance_center_pixels: vec2<f32> // Per-instance data: point's center
) -> @builtin(position) vec4<f32> {
  let half_point_size = params.point_size * 0.5;

  // Pre-defined offsets for a quad centered at (0,0)
  // (Triangle 1: v0, v1, v2; Triangle 2: v1, v3, v2)
  var offsets = array<vec2<f32>, 6>(
    vec2<f32>(-half_point_size, -half_point_size), // v0 (Bottom-left)
    vec2<f32>( half_point_size, -half_point_size), // v1 (Bottom-right)
    vec2<f32>(-half_point_size,  half_point_size), // v2 (Top-left)

    // Second triangle (v1, v3, v2 - reusing v1 and v2)
    vec2<f32>( half_point_size, -half_point_size), // v1 (Bottom-right)
    vec2<f32>( half_point_size,  half_point_size), // v3 (Top-right)
    vec2<f32>(-half_point_size,  half_point_size)  // v2 (Top-left)
  );

  let offset_pos = offsets[vertex_idx];
  let final_pixel_pos = instance_center_pixels + offset_pos;

  let ndc_pos_x = (final_pixel_pos.x / params.canvas_dims.x) * 2.0 - 1.0;
  let ndc_pos_y = ((final_pixel_pos.y / params.canvas_dims.y) * 2.0 - 1.0) * -1.0; // Flip Y

  return vec4<f32>(ndc_pos_x, ndc_pos_y, 0.0, 1.0);
}

// --- Fragment Shader ---
@fragment
fn fs_main() -> @location(0) vec4<f32> {
  return vec4<f32>(0.8, 0.2, 0.2, 1.0); // Reddish color for points
}