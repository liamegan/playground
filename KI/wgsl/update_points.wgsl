// wgsl/update_points.wgsl

struct SimParams {
  canvas_dims: vec2<f32>,
  damping_factor: f32,
  point_size: f32,         // Used for collision radius as well
  particle_restitution: f32, // New: For inter-particle bounce
};

@group(0) @binding(0) var<storage, read_write> positions: array<vec2<f32>>;
@group(0) @binding(1) var<storage, read_write> old_positions: array<vec2<f32>>;
@group(0) @binding(2) var<uniform> params: SimParams;

// Number of iterations to resolve collisions per frame.
// More iterations lead to better separation but higher computational cost.
const NUM_COLLISION_ITERATIONS = 3;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let index = global_id.x;
  let num_points = arrayLength(&positions);

  // Boundary check for workgroups
  if (index >= num_points) {
    return;
  }

  let current_pos = positions[index];
  let prev_pos = old_positions[index];

  // Verlet integration: predict next position
  var velocity = current_pos - prev_pos;
  // You could add other forces like gravity here, e.g.:
  // velocity.y = velocity.y + 0.05; // Simple gravity example

  var next_pos = current_pos + velocity;

  // Store the original current position to be the new "old position" for the next frame.
  // This is important for Verlet integration if collisions are treated as instantaneous impulses.
  var new_old_pos_for_next_frame = current_pos;


  // --- Inter-particle collision detection and response ---
  let particle_radius = params.point_size * 0.4;
  let min_dist_between_centers = 2.0 * particle_radius; // Sum of two radii

  // Iteratively resolve collisions
  // This is a simplified approach. Each particle pushes itself away from others.
  for (var iter = 0; iter < NUM_COLLISION_ITERATIONS; iter = iter + 1) {
    for (var j = 0u; j < num_points; j = j + 1u) {
      if (index == j) {
        continue; // Don't collide with self
      }

      // Read the position of the other particle.
      // Note: `positions[j]` refers to the positions at the *beginning* of this compute dispatch.
      // This particle (index) reacts to where other particles (j) *were*.
      // More complex schemes might use ping-pong buffers for `next_pos` for more stable iterations.
      let other_pos = positions[j];

      let diff_vec = next_pos - other_pos;
      let dist_sq = dot(diff_vec, diff_vec);

      // Check for collision: if squared distance is less than squared minimum distance
      // and distance is not zero (to avoid issues if particles are exactly on top)
      if (dist_sq < (min_dist_between_centers * min_dist_between_centers) && dist_sq > 0.00001) {
        let dist = sqrt(dist_sq);
        let normal = diff_vec / dist; // Normalized vector from other_pos to next_pos

        // Calculate overlap amount
        let overlap = min_dist_between_centers - dist;
        
        // 1. Positional correction (resolve penetration)
        let positional_correction = normal * (overlap * 0.51); // Slightly > 0.5 to help prevent sticking
        next_pos = next_pos + positional_correction;

        // 2. Elastic bounce response for the current particle (index)
        // Calculate the velocity of the current particle leading into this potential collision state
        let velocity_into_collision = (next_pos - positional_correction) - new_old_pos_for_next_frame; // Approx velocity before this specific correction
        
        let normal_velocity_component = dot(velocity_into_collision, normal);

        // Only apply bounce if particles are moving towards each other along the normal
        if (normal_velocity_component < 0.0) {
          // Reflect velocity component along the normal with restitution
          let reflected_normal_velocity = -normal_velocity_component * params.particle_restitution;
          
          // The change in velocity along the normal
          let delta_normal_velocity = reflected_normal_velocity - normal_velocity_component;
          
          // New velocity after bounce
          let new_velocity = velocity_into_collision + normal * delta_normal_velocity;
          
          // Update new_old_pos_for_next_frame to reflect this bounce.
          // next_pos has been updated by positional_correction.
          // So, new_old_pos must be (next_pos - new_velocity)
          new_old_pos_for_next_frame = next_pos - new_velocity;
        }
        // If normal_velocity_component >= 0, they are already separating or moving parallel along the collision normal.
        // In this case, new_old_pos_for_next_frame remains based on previous state or earlier collisions in this iteration.
        // For simplicity, if not bouncing, we ensure new_old_pos_for_next_frame is consistent with the (potentially projection-adjusted) next_pos and original velocity.
        // This part might need refinement based on observed behavior if particles still feel "sticky".
        // A simpler alternative if not bouncing: new_old_pos_for_next_frame = (next_pos - positional_correction) - velocity_into_collision;
        // which simplifies to the original new_old_pos_for_next_frame before this specific interaction.


      }
    } // End loop over other particles (j)
  } // End collision iteration loop


  // --- Boundary checks and response (apply after collision resolution) ---
  // These now use particle_radius to prevent particles from sinking into walls.
  // X-axis
  if (next_pos.x < particle_radius) {
    next_pos.x = particle_radius;
    // Simple bounce: reflect velocity component and apply damping
    let current_velocity_x = next_pos.x - new_old_pos_for_next_frame.x; // This might be subtle after position adjustments
    new_old_pos_for_next_frame.x = next_pos.x + current_velocity_x * params.damping_factor;

  } else if (next_pos.x > params.canvas_dims.x - particle_radius) {
    next_pos.x = params.canvas_dims.x - particle_radius;
    let current_velocity_x = next_pos.x - new_old_pos_for_next_frame.x;
    new_old_pos_for_next_frame.x = next_pos.x + current_velocity_x * params.damping_factor;
  }

  // Y-axis
  if (next_pos.y < particle_radius) {
    next_pos.y = particle_radius;
    let current_velocity_y = next_pos.y - new_old_pos_for_next_frame.y;
    new_old_pos_for_next_frame.y = next_pos.y + current_velocity_y * params.damping_factor;
  } else if (next_pos.y > params.canvas_dims.y - particle_radius) {
    next_pos.y = params.canvas_dims.y - particle_radius;
    let current_velocity_y = next_pos.y - new_old_pos_for_next_frame.y;
    new_old_pos_for_next_frame.y = next_pos.y + current_velocity_y * params.damping_factor;
  }

  // Update positions in the buffer
  positions[index] = next_pos;
  old_positions[index] = new_old_pos_for_next_frame;
}