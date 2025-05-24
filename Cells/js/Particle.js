import { Vector3 } from "./Vector3.js";

// Represents a single particle with position, velocity, forces, mass, etc.
export class Particle {
  static create(x, y, z = 0) {
    return new Particle(new Vector3(x, y, z));
  }

  constructor(position, system) {
    this.position = position.copy();
    this.velocity = Vector3.zero();
    this.forces = Vector3.zero();
    this.life = 0;
    this.removeFlag = false;
    this.mass = 1;
    this.connections = [];
    this.staticBody = false;
    this.tags = new Set();
    this.system = system;
  }

  getPosition() {
    return this.position;
  }

  setPosition(v) {
    this.position = v.copy();
  }

  getVelocity() {
    return this.velocity;
  }

  setVelocity(v) {
    this.velocity = v;
  }

  update(maxForce = -1) {
    this.lastPosition = this.position.copy();
    this.flushForces(maxForce);
    this.position.addVector(this.velocity);
    this.life++;
  }

  addTag(tag) {
    this.tags.add(tag);
    if (this.system) this.system.addTag(this, tag);
  }

  hasTag(tag) {
    return this.tags.has(tag);
  }

  removeTag(tag) {
    this.tags.delete(tag);
    if (this.system) this.system.removeTag(this, tag);
  }

  flushForces(limit = -1) {
    if (limit >= 0) this.forces.limit(limit);
    this.forces.div(this.mass);
    this.velocity.addVector(this.forces);
    // Reset forces
    this.forces.x = 0;
    this.forces.y = 0;
  }

  applyForce(force) {
    if (!this.staticBody) this.forces.addVector(force);
  }

  addConnection(conn) {
    this.connections.push(conn);
  }

  getConnections() {
    return this.connections;
  }

  removeSpring(spring) {
    let idx = this.connections.indexOf(spring);
    if (idx >= 0) this.connections.splice(idx, 1);
  }

  detachSprings() {
    this.connections.forEach((conn) => (conn.removeFlag = true));
  }

  getMass() {
    return this.mass;
  }

  setMass(m) {
    this.mass = m;
  }

  shouldRemove() {
    return this.removeFlag;
  }

  setRemoveFlag(flag) {
    this.removeFlag = flag;
  }

  findConnection(otherParticle) {
    return this.connections.find((conn) => conn.other(this) === otherParticle);
  }

  getLastPosition() {
    return this.lastPosition;
  }
}
