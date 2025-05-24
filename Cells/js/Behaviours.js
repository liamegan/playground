// Returns a function that scales a particle's velocity by a given factor.
export const dampenVelocity = (factor) => (particle) => {
  particle.velocity.mult(factor);
};

// Creates a force that repels a particle from a given point if within a threshold.
export const repelFromPoint = (point, threshold, forceMag) => (particle) => {
  let diff = Vector3.sub(point, particle.getPosition());
  if (diff.magnitude() < threshold) {
    diff.setMag(-forceMag);
    particle.applyForce(diff);
  }
};

// A symmetric interaction that applies an inverse-square force between two particles.
export const symmetricParticleForce =
  (interactionRange = 10, forceFactor = 0.01) =>
  (particleA, particleB) => {
    let diff = Vector3.sub(particleA.getPosition(), particleB.getPosition());
    let dist = diff.magnitude();
    if (dist < interactionRange) {
      let factor = forceFactor / (dist * dist + 0.01);
      diff.mult(factor);
      particleA.applyForce(diff);
      diff.mult(-1);
      particleB.applyForce(diff);
    }
  };

// A behavior that makes a particle steer toward the average position of its connected neighbors.
export const applyConnectionCentroidForce = (coefficient) => (particle) => {
  if (particle.getConnections().length > 0) {
    let centroid = new Vector3();
    particle.getConnections().forEach((conn) => {
      let other = conn.other(particle);
      if (other) {
        centroid.addVector(other.getPosition());
      }
    });
    centroid.div(particle.getConnections().length);
    let steer = Vector3.sub(centroid, particle.getPosition());
    steer.mult(coefficient);
    particle.applyForce(steer);
  }
};

/**
 * Attractor applies a spring‑like pull to each neighbor.
 * @param {number} range    – maximum distance over which to pull
 * @param {number} strength – constant scaling factor
 * @returns {(attractor: Particle, neighbors: Particle[]) => void}
 */
export const pointAttractionBehavior = (range = 10, strength = 0.01) => {
  return (attractor, neighbors) => {
    neighbors.forEach((neighbor) => {
      const diff = Vector3.sub(attractor.getPosition(), neighbor.getPosition());
      const dist = diff.magnitude();
      if (dist < range) {
        // avoid divide‑by‑zero
        const factor = strength / (dist * dist + 0.01);
        diff.mult(factor);
        attractor.applyForce(diff);
      }
    });
  };
};

/**
 * Repels a particle when it gets closer than `threshold` to any box edge.
 * Beyond threshold there’s no force; inside the box it “falls off” by a small constant.
 *
 * @param {BoundingBox} bounds
 * @param {number} threshold – distance from edge at which repulsion begins
 * @param {number} force     – maximum force when touching the edge
 * @param {number} falloff   – constant force when outside the box
 * @returns {(particle: Particle) => void}
 */
export const repulseFromEdgesBehavior = (
  bounds,
  threshold = 10,
  force = 5,
  falloff = 0.02
) => {
  return (particle) => {
    const min = bounds.getTopBackLeft();
    const max = bounds.getBottomFrontRight();
    const pos = particle.getPosition();

    // helper: compute magnitude based on distance d
    function computeMag(d) {
      if (d < 0) return falloff;
      if (d < threshold) return force / (d + 1);
      return 0;
    }

    // helper: apply a one‑axis force
    function applyIf(dist, direction) {
      const mag = computeMag(dist);
      if (mag > 0) {
        direction.setMag(mag);
        particle.applyForce(direction);
      }
    }

    // left edge
    applyIf(pos.x - min.x, new Vector3(1, 0, 0));
    // right edge
    applyIf(max.x - pos.x, new Vector3(-1, 0, 0));
    // top edge
    applyIf(pos.y - min.y, new Vector3(0, 1, 0));
    // bottom edge
    applyIf(max.y - pos.y, new Vector3(0, -1, 0));
  };
};

/**
 * Simple drag: multiplies the particle’s velocity by a constant each tick.
 * @param {number} factor – 0 < factor < 1
 * @returns {(particle: Particle) => void}
 */
export const dampenVelocityBehavior = (factor) => {
  return (particle) => {
    particle.getVelocity().mult(factor);
  };
};

/**
 * If a particle crosses any box boundary, push it back just inside and flip that velocity component.
 * @param {BoundingBox} bounds
 * @returns {(particle: Particle) => void}
 */
export const boundaryBounceBehavior = (bounds) => {
  return (particle) => {
    const pos = particle.getPosition();
    const vel = particle.getVelocity();
    const min = bounds.getTopBackLeft();
    const max = bounds.getBottomFrontRight();

    if (pos.x < min.x) {
      pos.x = min.x + 1;
      vel.x *= -1;
    } else if (pos.x > max.x) {
      pos.x = max.x - 1;
      vel.x *= -1;
    }
    if (pos.y < min.y) {
      pos.y = min.y + 1;
      vel.y *= -1;
    } else if (pos.y > max.y) {
      pos.y = max.y - 1;
      vel.y *= -1;
    }
    if (pos.z < min.z) {
      pos.z = min.z;
      vel.z *= -1;
    } else if (pos.z > max.z) {
      pos.z = max.z;
      vel.z *= -1;
    }
  };
};
