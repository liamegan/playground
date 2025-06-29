struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) uv: vec2<f32>,
};

@vertex
fn vs_main(@builtin(vertex_index) vertex_index: u32) -> VertexOutput {
    var output: VertexOutput;

    var positions = array<vec2<f32>, 6>(
        vec2<f32>(-1.0, -1.0),
        vec2<f32>( 1.0, -1.0),
        vec2<f32>(-1.0,  1.0),
        vec2<f32>( 1.0,  1.0),
        vec2<f32>(-1.0,  1.0),
        vec2<f32>( 1.0, -1.0)
    );

    let pos_ndc = positions[vertex_index];
    output.position = vec4<f32>(pos_ndc.x, pos_ndc.y, 0.0, 1.0);
    output.uv = vec2<f32>(pos_ndc.x * 0.5 + 0.5, pos_ndc.y * 0.5 + 0.5);
    return output;
}

struct Uniforms {
  resolution: vec2<f32>,
  camera_pos: vec3<f32>,
  camera_forward: vec3<f32>,
  camera_right: vec3<f32>,
  camera_up: vec3<f32>,
  voxel_size: f32,
  max_render_distance: f32,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

// SDF: Sphere centered at origin
fn sdfSphere(p: vec3<f32>, radius: f32) -> f32 {
    return length(p) - radius;
}

// SDF: Infinite repeating boxes (example)
// fn sdfBoxRepeat(p: vec3<f32>, size: vec3<f32>, repeat_period: vec3<f32>) -> f32 {
//     let q = abs(p % repeat_period) - size;
//     return length(max(q, vec3<f32>(0.0))) + min(max(q.x, max(q.y, q.z)), 0.0);
// }

// AABB intersection - remains useful for individual voxels
fn intersect_aabb(ray_origin: vec3<f32>, ray_dir: vec3<f32>, box_min: vec3<f32>, box_max: vec3<f32>) -> f32 {
    let inv_dir = 1.0 / ray_dir;
    let t0 = (box_min - ray_origin) * inv_dir;
    let t1 = (box_max - ray_origin) * inv_dir;

    let tmin_vec = min(t0, t1);
    let tmax_vec = max(t0, t1);

    let tmin = max(tmin_vec.x, max(tmin_vec.y, tmin_vec.z));
    let tmax = min(tmax_vec.x, min(tmax_vec.y, tmax_vec.z));

    if (tmax >= max(0.0, tmin)) {
        return tmin;
    }
    return -1.0;
}

struct RayHit {
    hit: bool,
    distance: f32,
    normal: vec3<f32>,
    world_pos: vec3<f32>,
};

@fragment
fn fs_main(frag_in: VertexOutput) -> @location(0) vec4<f32> {
    let uv = frag_in.uv;
    let aspect_ratio = uniforms.resolution.x / uniforms.resolution.y;
    let screen_x = (uv.x * 2.0 - 1.0) * aspect_ratio;
    let screen_y = uv.y * 2.0 - 1.0;
    let focal_length = 1.0;
    let ray_dir_camera_space = screen_x * uniforms.camera_right +
                               screen_y * uniforms.camera_up +
                               uniforms.camera_forward * focal_length;
    let ray_dir = normalize(ray_dir_camera_space);
    let ray_origin = uniforms.camera_pos;

    var closest_hit: RayHit;
    closest_hit.hit = false;
    closest_hit.distance = uniforms.max_render_distance;

    let vs = uniforms.voxel_size;
    let half_vs = vs * 0.5;

    // Determine initial voxel cell coordinates from ray_origin
    var current_voxel_coord = vec3<i32>(floor(ray_origin / vs));

    let step = sign(ray_dir);
    // Initialize t_delta with a very large number if ray_dir component is zero
    let t_delta = vec3<f32>(
        select(1e9, abs(vs / ray_dir.x), ray_dir.x != 0.0),
        select(1e9, abs(vs / ray_dir.y), ray_dir.y != 0.0),
        select(1e9, abs(vs / ray_dir.z), ray_dir.z != 0.0)
    );

    // Calculate t_max: distance to the next conceptual voxel boundary
    var t_max = vec3<f32>();
    let ray_origin_in_cell = ray_origin - vec3<f32>(current_voxel_coord) * vs;

    if (ray_dir.x == 0.0) { t_max.x = 1e9; } 
    else if (step.x > 0.0) { t_max.x = (vs - ray_origin_in_cell.x) / ray_dir.x; }
    else { t_max.x = -ray_origin_in_cell.x / ray_dir.x; }

    if (ray_dir.y == 0.0) { t_max.y = 1e9; } 
    else if (step.y > 0.0) { t_max.y = (vs - ray_origin_in_cell.y) / ray_dir.y; }
    else { t_max.y = -ray_origin_in_cell.y / ray_dir.y; }

    if (ray_dir.z == 0.0) { t_max.z = 1e9; } 
    else if (step.z > 0.0) { t_max.z = (vs - ray_origin_in_cell.z) / ray_dir.z; }
    else { t_max.z = -ray_origin_in_cell.z / ray_dir.z; }
    
    // Ensure t_max components are positive, they represent distance along the ray
    // This initial t_max is distance from ray_origin to first cell boundary crossing.
    t_max = abs(t_max); // Taking abs might be problematic if ray starts inside cell boundary.
                       // The calculation above should yield positive t values already if ray_dir component isn't 0.
                       // Let's ensure they are positive, or large if ray_dir is zero for that component.
    if(ray_dir.x != 0.0 && t_max.x < 0.0) { t_max.x += t_delta.x; } // Advance if we started past a boundary going away from it.
    if(ray_dir.y != 0.0 && t_max.y < 0.0) { t_max.y += t_delta.y; } 
    if(ray_dir.z != 0.0 && t_max.z < 0.0) { t_max.z += t_delta.z; }


    let max_iter = i32(uniforms.max_render_distance / vs + 3.0); // Max iterations, +3 for buffer
    var current_t: f32 = 0.0;

    for (var i: i32 = 0; i < max_iter; i = i + 1) {
        // Determine which t_max is smallest (and thus which axis to step along)
        var axis_to_step: i32 = -1;
        var min_t_max_val: f32 = 1e8; // Smaller than 1e9 for t_delta/t_max initialization

        if (t_max.x < min_t_max_val) { min_t_max_val = t_max.x; axis_to_step = 0; }
        if (t_max.y < min_t_max_val) { min_t_max_val = t_max.y; axis_to_step = 1; }
        if (t_max.z < min_t_max_val) { min_t_max_val = t_max.z; axis_to_step = 2; }

        if(axis_to_step == -1 || min_t_max_val > uniforms.max_render_distance) { // Should not happen if t_max init is good, or we are past max distance
            break;
        }

        current_t = min_t_max_val;
        if (current_t > uniforms.max_render_distance) {
            break;
        }

        // Advance voxel coordinate and update t_max for the stepped axis
        if (axis_to_step == 0) {
            current_voxel_coord.x += i32(step.x);
            t_max.x += t_delta.x;
        } else if (axis_to_step == 1) {
            current_voxel_coord.y += i32(step.y);
            t_max.y += t_delta.y;
        } else { // axis_to_step == 2
            current_voxel_coord.z += i32(step.z);
            t_max.z += t_delta.z;
        }

        let cell_center_world = (vec3<f32>(current_voxel_coord) + vec3<f32>(0.5)) * vs;

        // DEBUG: Visualize DDA cells near origin
        if (abs(cell_center_world.x) < 6.0 && abs(cell_center_world.y) < 6.0 && abs(cell_center_world.z) < 6.0) {
            // If we haven't found a real hit from the SDF yet, show this debug color.
            // This helps confirm the DDA is reaching this space.
            if (!closest_hit.hit) { 
                 return vec4<f32>(0.05, 0.05, current_t / uniforms.max_render_distance, 1.0); // Blue gradient
            }
        }
        // END DEBUG

        // --- SDF Check and AABB Intersection --- 
        let sdf_dist = sdfSphere(cell_center_world, 5.0);

        if (sdf_dist < vs) { 
            let voxel_min_world = vec3<f32>(current_voxel_coord) * vs;
            let voxel_max_world = voxel_min_world + vec3<f32>(vs);
            let hit_dist_aabb = intersect_aabb(ray_origin, ray_dir, voxel_min_world, voxel_max_world);
            
            if (hit_dist_aabb > 0.0 && hit_dist_aabb < closest_hit.distance) { // Removed check against max_render_distance here as current_t check above covers it
                closest_hit.hit = true;
                closest_hit.distance = hit_dist_aabb;
                closest_hit.world_pos = ray_origin + ray_dir * hit_dist_aabb;
                
                let voxel_center_for_normal = voxel_min_world + vec3<f32>(vs * 0.5);
                let to_center = normalize(closest_hit.world_pos - voxel_center_for_normal);
                let abs_to_center = abs(to_center);
                if (abs_to_center.x > abs_to_center.y && abs_to_center.x > abs_to_center.z) {
                    closest_hit.normal = vec3<f32>(sign(to_center.x), 0.0, 0.0);
                } else if (abs_to_center.y > abs_to_center.z) {
                    closest_hit.normal = vec3<f32>(0.0, sign(to_center.y), 0.0);
                } else {
                    closest_hit.normal = vec3<f32>(0.0, 0.0, sign(to_center.z));
                }
            }
        }
        // --- End SDF Check ---
        
        // Early exit if a hit is found and the current_t (distance to next cell boundary) 
        // is already further than the found hit. This means we won't find a closer hit by stepping further.
        if (closest_hit.hit && current_t > closest_hit.distance) {
             break;
        }
    }

    if (closest_hit.hit) {
        let light_dir = normalize(vec3<f32>(0.5, 1.0, -1.0));
        let diffuse = max(dot(closest_hit.normal, light_dir), 0.0);
        let ambient = 0.2;
        let intensity = diffuse + ambient;
        return vec4<f32>(intensity * vec3<f32>(0.3, 1.0, 0.3), 1.0); // Green-ish voxel
    }

    return vec4<f32>(0.1, 0.15, 0.2, 1.0); // Background color
} 