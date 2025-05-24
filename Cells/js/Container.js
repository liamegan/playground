// A base container that holds child nodes and provides update/draw loops.
export class Container {
  constructor(type, particleSystem) {
    this.children = [];
    this.removalQueue = [];
    this.type = type;
    this.particleSystem = particleSystem;
  }

  addChild(child) {
    child.parent = this;
    child.particleSystem = this.particleSystem;
    child.setup();
    this.children.push(child);
  }

  removeChild(child) {
    child.parent = undefined;
    this.removalQueue.push(child);
  }

  update() {
    this.children.forEach((child) => child.update());
    this.children = this.children.filter(
      (child) => !this.removalQueue.includes(child)
    );
    this.removalQueue = [];
  }

  draw(renderer) {
    this.children.forEach((child) => child.draw(renderer));
  }

  // Returns attachable particles from children.
  getAttachables() {
    let attachables = [];
    this.children.forEach((child) => {
      attachables.push(...child.getAttachables());
    });
    return attachables;
  }

  toString() {
    return `${this.type}`;
  }
}

// A Stage is simply a top-level container.
class Stage extends Container {
  constructor(particleSystem) {
    super("Stage", particleSystem);
  }
}
