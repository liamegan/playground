// --- TagIndex: helper for fast lookup of particles by tag ---
export class TagIndex {
  constructor() {
    this.particles = [];
    this.tagIndex = new Map(); // Map<string, Particle[]>
  }

  // Add an entity and index all its tags
  add(entity) {
    this.particles.push(entity);
    entity.tags.forEach((tag) => this.addTag(entity, tag));
  }

  // Remove an entity and de‑index its tags
  remove(entity) {
    const i = this.particles.indexOf(entity);
    if (i >= 0) this.particles.splice(i, 1);
    entity.tags.forEach((tag) => this.removeTag(entity, tag));
  }

  // Query by { and: [...], or: [...] } — or return all if no filter
  query(filter = {}) {
    if (Object.keys(filter).length === 0) {
      return [...this.particles];
    }
    if (filter.and) {
      return filter.and
        .map((tag) => this.tagIndex.get(tag) || [])
        .reduce((acc, arr) => acc.filter((p) => arr.includes(p)));
    }
    if (filter.or) {
      let result = [];
      filter.or.forEach((tag) => {
        const arr = this.tagIndex.get(tag);
        if (arr) result.push(...arr);
      });
      return result;
    }
    return [];
  }

  // Does this index contain the entity?
  contains(entity) {
    return this.particles.includes(entity);
  }

  // Add a single tag→entity mapping
  addTag(entity, tag) {
    if (!this.tagIndex.has(tag)) {
      this.tagIndex.set(tag, []);
    }
    const arr = this.tagIndex.get(tag);
    if (!arr.includes(entity)) {
      arr.push(entity);
    }
  }

  // Remove a single tag→entity mapping
  removeTag(entity, tag) {
    const arr = this.tagIndex.get(tag);
    if (!arr) return;
    const i = arr.indexOf(entity);
    if (i >= 0) arr.splice(i, 1);
  }
}

// --- SpatialGrid: partitions space into cells of size `cellSize` for fast neighbor queries ---
export class SpatialGrid {
  constructor(bounds, cellSize) {
    this.bounds = bounds;
    this.cellSize = cellSize;

    // Flat array of all particles (for global queries)
    this.particles = [];

    // Determine grid dimensions
    this.rows = Math.ceil((bounds.getHeight() + cellSize) / cellSize);
    this.cols = Math.ceil((bounds.getWidth() + cellSize) / cellSize);

    // One TagIndex per cell + one global index
    this.cells = Array.from(
      { length: this.rows * this.cols },
      () => new TagIndex()
    );
    this.globalTagIndex = new TagIndex();
  }

  getRows() {
    return this.rows;
  }
  getCols() {
    return this.cols;
  }

  // Adds particle to global list and its appropriate cell
  addParticle(particle) {
    if (!this.bounds.containsVector(particle.getPosition())) {
      throw new Error(
        `Cannot add particle to SpatialGrid; out of bounds: ${particle.getPosition()}`
      );
    }
    this.particles.push(particle);
    const idx = this.hashPosition(particle.getPosition());
    this.cells[idx].add(particle);
    this.globalTagIndex.add(particle);
  }

  // Removes particle from grid and global index
  removeParticle(particle) {
    const idx = this.hashPosition(particle.getPosition());
    if (idx >= 0) this.cells[idx].remove(particle);

    const i = this.particles.indexOf(particle);
    if (i >= 0) this.particles.splice(i, 1);

    // Detach any springs it held on to
    particle.detachSprings();
    this.globalTagIndex.remove(particle);
  }

  // Query by tag filters and/or spatial region:
  //   filter = { tags:{ and:[...], or:[...] }, position:{ at:Vector3, radius:cells } }
  query({ tags = {}, position } = {}) {
    // If no spatial constraint, just query globalTagIndex
    if (!position || Object.keys(position).length === 0) {
      return this.globalTagIndex.query(tags);
    }

    const cellX = Math.floor(position.at.x / this.cellSize);
    const cellY = Math.floor(position.at.y / this.cellSize);
    const radius = position.radius || 0;
    let out = [];

    for (let x = cellX - radius; x <= cellX + radius; x++) {
      for (let y = cellY - radius; y <= cellY + radius; y++) {
        if (x >= 0 && x < this.cols && y >= 0 && y < this.rows) {
          out.push(...this.cells[x + y * this.cols].query(tags));
        }
      }
    }
    return out;
  }

  // Converts a world‐position to a cell index (or –1 if outside)
  hashPosition(pos) {
    const col = Math.floor(pos.x / this.cellSize);
    const row = Math.floor(pos.y / this.cellSize);
    if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) return -1;
    return row * this.cols + col;
  }

  // After a particle moves, update its cell membership
  updateCell(particle, oldIndex) {
    const newIndex = this.hashPosition(particle.getPosition());
    if (newIndex !== oldIndex) {
      if (oldIndex >= 0 && oldIndex < this.cells.length) {
        this.cells[oldIndex].remove(particle);
      }
      if (newIndex >= 0 && newIndex < this.cells.length) {
        this.cells[newIndex].add(particle);
      }
    }
  }

  // When a particle gains a tag, update both the cell‐index and global index
  addTag(particle, tag) {
    const idx = this.hashPosition(particle.getPosition());
    if (idx >= 0 && idx < this.cells.length) {
      this.cells[idx].addTag(particle, tag);
    }
    this.globalTagIndex.addTag(particle, tag);
  }

  // Similarly for removing a tag
  removeTag(particle, tag) {
    const idx = this.hashPosition(particle.getPosition());
    if (idx >= 0 && idx < this.cells.length) {
      this.cells[idx].removeTag(particle, tag);
    }
    this.globalTagIndex.removeTag(particle, tag);
  }

  // Direct cell lookup by grid coords
  getCell(col, row) {
    const i = col + row * this.cols;
    return this.cells[i];
  }
}
