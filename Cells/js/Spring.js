import { Vector3 } from "./Vec3";
import { rand } from "./random";
import { Particle } from "./Particle";

// A spring connecting two particles.
export class Spring {
  constructor(particle1, particle2, springLength, springConstant) {
    this.removeFlag = false;
    this.particle1 = particle1;
    this.particle2 = particle2;
    this.springLength = springLength;
    this.k = springConstant;
  }

  update() {
    let delta = Vector3.sub(
      this.particle1.getPosition(),
      this.particle2.getPosition()
    );
    let forceMag = (this.springLength - delta.magnitude()) * this.k;
    delta.normalize();
    delta.mult(forceMag);
    this.particle1.applyForce(delta);
    this.particle2.applyForce(Vector3.mult(delta, -1));
  }

  other(particle) {
    if (this.particle1 === particle) return this.particle2;
    if (this.particle2 === particle) return this.particle1;
  }

  shouldRemove() {
    return this.removeFlag;
  }

  remove() {
    this.removeFlag = true;
  }

  toString() {
    return `${this.particle1.toString()} <-> ${this.particle2.toString()}`;
  }
}
