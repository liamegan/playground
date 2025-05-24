import { Particle } from "./Particle.js";
import { Spring } from "./Spring.js";
import { SpatialGrid } from "./SpatialGrid.js";

class ParticleSystem {
  /**
   * @param {BoundingBox} bounds      – simulation bounds
   * @param {number}     cellSize    – size of one grid cell
   * @param {number}     maxParticles=1000 – hard cap on live particles
   * @param {number}     maxDensity=0.1   – max per‑cell density
   */
  constructor(bounds, cellSize, maxParticles = 1e3, maxDensity = 0.1) {
    this.bounds = bounds;
    this.grid = new SpatialGrid(bounds, cellSize);

    this.maxParticles = maxParticles;
    this.maxDensity = maxDensity;
    this.maxForce = -1; // no cap by default

    this.particleCreationQueue = [];
    this.springs = [];
    this.springCreationQueue = [];

    this.behaviors = []; // single‑particle behaviors
    this.interactions = []; // one‑way interactions
    this.symmetricInteractions = []; // two‑way interactions
  }

  // ——— Main Loop ———
  update() {
    // 1) Add newly created particles
    this.particleCreationQueue.forEach((p) => this.grid.addParticle(p));
    this.particleCreationQueue.length = 0;

    // 2) Add newly created springs
    this.springs.push(...this.springCreationQueue);
    this.springCreationQueue.length = 0;

    // 3) Springs
    this.updateSprings();

    // 4) Particle‑level behaviors & interactions
    this.updateBehaviors();

    // 5) Move particles
    this.updateParticles();

    // 6) Remove dead particles & springs
    this.cleanUpParticles();
  }

  updateSprings() {
    this.springs.forEach((s) => s.update());
  }

  updateParticles() {
    this.grid.particles.forEach((p) => {
      const oldCell = this.grid.hashPosition(p.getPosition());
      p.update(this.maxForce);
      this.grid.updateCell(p, oldCell);
    });
  }

  updateBehaviors() {
    // One‑way interactions
    this.interactions.forEach(({ interaction, filter, neighborFilter }) => {
      this.grid.query({ tags: filter }).forEach((p) => {
        // find neighbors (excluding self)
        const neighbors = this.grid
          .query({
            tags: neighborFilter,
            position: { at: p.getPosition(), radius: 1 },
          })
          .filter((n) => n !== p);
        interaction(p, neighbors);
      });
    });

    // Symmetric (pairwise) interactions
    this.symmetricInteractions.forEach(({ interaction, filter }) => {
      const cols = this.grid.cols,
        rows = this.grid.rows;
      for (let cx = 0; cx < cols; cx++) {
        for (let cy = 0; cy < rows; cy++) {
          // Check within cell and neighboring cells
          this._applySymmetricCell(interaction, filter, cx, cy, cx, cy);
          this._applySymmetricCell(interaction, filter, cx, cy, cx + 1, cy);
          this._applySymmetricCell(interaction, filter, cx, cy, cx + 1, cy + 1);
          this._applySymmetricCell(interaction, filter, cx, cy, cx, cy + 1);
          this._applySymmetricCell(interaction, filter, cx, cy, cx - 1, cy + 1);
        }
      }
    });

    // Single‑particle behaviors
    this.behaviors.forEach(({ behavior, filter }) => {
      this.grid.query({ tags: filter }).forEach((p) => behavior(p));
    });
  }

  _applySymmetricCell(interaction, filter, cx1, cy1, cx2, cy2) {
    if (cx2 < 0 || cy2 < 0 || cx2 >= this.grid.cols || cy2 >= this.grid.rows)
      return;

    const cellA = this.grid.getCell(cx1, cy1);
    const cellB = this.grid.getCell(cx2, cy2);
    if (!cellA || !cellB) return;

    const listA = cellA.query(filter);
    const listB = cellB.query(filter);

    if (cx1 === cx2 && cy1 === cy2) {
      // within same cell: avoid double‑counting
      for (let i = 0; i < listA.length; i++) {
        for (let j = i + 1; j < listA.length; j++) {
          interaction(listA[i], listA[j]);
        }
      }
    } else {
      // cross‑cell interactions
      listA.forEach((a) => listB.forEach((b) => interaction(a, b)));
    }
  }

  cleanUpParticles() {
    // Remove particles flagged for removal
    this.grid
      .query()
      .filter((p) => p.shouldRemove())
      .forEach((p) => this.grid.removeParticle(p));

    // Remove springs flagged for removal
    this.springs
      .filter((s) => s.shouldRemove())
      .forEach((s) => {
        const idx = this.springs.indexOf(s);
        if (idx >= 0) this.springs.splice(idx, 1);
        s.getN1().removeSpring(s);
        s.getN2().removeSpring(s);
      });
  }

  // ——— Public Utility Methods ———

  /**
   * Query particles by tag filter and optional spatial constraint.
   * @param {{ tags?: { and?: string[], or?: string[]}, position?: { at: Vector3, radius: number } }} options
   * @returns {Particle[]}
   */
  query(options = {}) {
    return this.grid.query(options);
  }

  /**
   * Returns the density of particles in the cell containing `pos`.
   * If outside bounds, returns 1 (effectively blocking creation).
   */
  getDensity(pos) {
    if (!this.bounds.containsVector(pos)) return 1;
    const col = Math.floor(pos.x / this.grid.cellSize);
    const row = Math.floor(pos.y / this.grid.cellSize);
    const cell = this.grid.getCell(col, row);
    return cell.particles.length / this.grid.cellSize ** 2;
  }

  /**
   * Can we place a particle at `pos`?
   * Optionally override the density cap per‑cell.
   */
  checkPosition(pos, maxPerCell = 1) {
    const dens = this.getDensity(pos);
    return (
      this.grid.particles.length < this.maxParticles &&
      dens < this.maxDensity &&
      dens < maxPerCell
    );
  }

  /**
   * Schedule a particle for creation next frame.
   * @param {Vector3} pos
   * @param {boolean} allowOutside – if true, skips density check
   */
  createParticle(pos, allowOutside = false) {
    if (allowOutside || this.checkPosition(pos)) {
      const p = new Particle(this.bounds.constrained(pos), this);
      this.particleCreationQueue.push(p);
      return p;
    }
  }

  /**
   * Convenience: fill `n` new particles at random positions.
   * @param {number} n
   * @param {2|3} dim – 2D or 3D random inside bounds
   * @returns {Particle[]}
   */
  fill(n, dim = 2) {
    const out = [];
    for (let i = 0; i < n; i++) {
      const p = this.createParticle(this.bounds.getRandomPointInside(dim));
      if (p) out.push(p);
    }
    return out;
  }

  /** Add a one‑way interaction: (particle, neighbors[]) => void */
  addParticleInteraction(interactionFn, filter = {}, neighborFilter = {}) {
    this.interactions.push({
      interaction: interactionFn,
      filter,
      neighborFilter,
    });
  }

  /** Add a symmetric (pairwise) interaction: (a, b) => void */
  addSymmetricParticleInteraction(interactionFn, filter = {}) {
    this.symmetricInteractions.push({ interaction: interactionFn, filter });
  }

  /** Add a single‑particle behavior: (particle) => void */
  addParticleBehavior(behaviorFn, filter = {}) {
    this.behaviors.push({ behavior: behaviorFn, filter });
  }

  /** Tag management (for external uses like particle tags) */
  addTag(particle, tag) {
    this.grid.addTag(particle, tag);
  }
  removeTag(particle, tag) {
    this.grid.removeTag(particle, tag);
  }

  /** Create a spring between two particles */
  createSpring(a, b, restLength, k) {
    const s = new Spring(a, b, restLength, k);
    this.springCreationQueue.push(s);
    a.addConnection(s);
    b.addConnection(s);
    return s;
  }

  /** Setters & getters */
  setMaxParticles(n) {
    this.maxParticles = n;
  }
  setMaxForce(n) {
    this.maxForce = n;
  }
  setMaxDensity(d) {
    this.maxDensity = d;
  }
  getParticles() {
    return this.grid.particles;
  }
  getSprings() {
    return this.springs;
  }
}
