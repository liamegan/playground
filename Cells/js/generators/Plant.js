import { Container } from "../Container";
import { BranchNode } from "./BranchNode";
import { rand } from "../random";

// ——— Default DNA for all Plants ———
export const defaultPlantDNA = {
  // How deep the recursion can go
  maxDepth: (node) => 5 + 5 * rand(),
  // Chance per update that a PlantNode will spawn a child
  growthChance: 0.01,
  // How many branches to try initially
  initialBranchingFactor: 8,
  // Probability a node will branch instead of extending
  branchingChance: 0.5,
  // How many branches after the first level
  branchingFactor: (node) => rand() * node.depthCounter,
  // After how many growths to create a branch
  branchLength: 3,
  // Distance between parent & child particles
  connectionLength: 10,
  springStrength: 0.01,
  // When a node becomes a “flower,” how many petals
  numPetals: 5,
  petalConnectionLength: 1,
  petalConnectionStrength: 0.5,
  flowerSize: 2,
  // A function of depth → branch color
  branchColor: (node) => {
    // blend white→black as depth increases
    const t = node.depthCounter / 10;
    return (
      (Math.round(255 * (1 - t)) << 16) |
      (Math.round(255 * (1 - t)) << 8) |
      Math.round(255 * (1 - t))
    );
  },
  petalColor: 0xffffff,
  flowerColor: 0xffffff,
  maxDensity: 0.05,
};

/**
 * Plant container: spawns a tree‐like structure of PlantNodes.
 */
export class Plant extends Container {
  /**
   * @param {object} dnaOverrides  – overrides to defaultPlantDNA
   */
  constructor(dnaOverrides = {}) {
    super("Plant", null);
    this.dna = { ...defaultPlantDNA, ...dnaOverrides };
  }

  setup() {
    // Create the root particle inside bounds (static = true)
    const system = this.particleSystem;
    const rootParticle = system.createParticle(
      system.bounds.getRandomPointInside(),
      /* allowOutside = */ true
    );

    // Kick off the first BranchNode at depth 0
    this.addChild(new BranchNode(this, rootParticle, this.dna, /* depth */ 0));
  }

  update() {
    // Tell every PlantNode to try growing
    this.children.forEach((child) => child.grow());
    // Then proceed with the normal container update (which handles removal, draw order, etc.)
    super.update();
  }
}

// Assumes you have already imported/referenced:
//   Container      – your generic scene‐graph container
//   BranchNode     – the class for branching nodes
//   StemNode       – the class for straight‐growing nodes
//   FlowerNode     – the class for flower‐tipped nodes
//   fxrand()       – your seeded random function
export class PlantNode extends Container {
  /**
   * @param {Plant}      plant           – parent Plant container
   * @param {Particle}   particle        – the “seed” particle for this node
   * @param {object}     dna             – full DNA parameters for the plant
   * @param {number}     depth           – current depth in the recursion
   * @param {number}     countSinceBranch– how many growths since last branch
   */
  constructor(plant, particle, dna, depth = 0, countSinceBranch = 0) {
    super("PlantNode", plant.particleSystem);
    this.plant = plant;
    this.particle = particle;
    this.dna = dna;
    this.depthCounter = depth;
    this.countSinceBranch = countSinceBranch;

    // This node can spawn exactly once by default; subclass constructors
    // can override growthCounter if they like.
    this.growthCounter = 1;

    this.children = [];
    this.springs = [];

    // Tag this particle so any “or: ['plant']” filters will catch it
    this.particle.addTag("plant");
  }

  /**
   * Helper to evaluate a DNA parameter that might be a number or a function.
   * If it’s a function, call it with this node; else return it directly.
   */
  p(param) {
    return typeof param === "function" ? param(this) : param;
  }

  /**
   * Called each tick to maybe grow a new node.
   */
  grow() {
    const system = this.plant.particleSystem;
    // Check if we still have a growth “slot,” and roll the dice
    if (this.growthCounter > 0 && fxrand() < this.dna.growthChance) {
      this.growthCounter--;

      // Pick a jittered position off our current particle
      const newPos = this.particle.position.jittered(
        this.dna.connectionLength / 2
      );

      // Only proceed if density allows
      if (!system.checkPosition(newPos, this.dna.maxDensity)) return;

      const childParticle = system.createParticle(newPos);
      if (!childParticle) return;

      let childNode;

      // If we still have depth left, either branch or extend
      if (this.depthCounter < this.p(this.dna.maxDepth)) {
        if (
          this.countSinceBranch >= this.dna.branchLength &&
          fxrand() < this.dna.branchingChance
        ) {
          // Create a new branching node
          childNode = new BranchNode(
            this.plant,
            childParticle,
            this.dna,
            this.depthCounter + 1
          );
        } else {
          // Continue a straight “stem” node
          childNode = new StemNode(
            this.plant,
            childParticle,
            this.dna,
            this.depthCounter + 1,
            this.countSinceBranch + 1
          );
        }
      } else {
        // Depth limit reached → flower node
        childNode = new FlowerNode(this.plant, childParticle, this.dna);
      }

      this.attachNode(childNode, this.dna.connectionLength);
    }
  }

  /**
   * Hook up a new child node with a spring and add to the graph.
   */
  attachNode(childNode, restLength) {
    const spring = this.plant.particleSystem.createSpring(
      this.particle,
      childNode.particle,
      restLength,
      this.dna.springStrength
    );
    this.springs.push(spring);
    this.children.push(childNode);
    this.plant.addChild(childNode);
  }

  /**
   * Draws all the connecting springs for this node.
   */
  draw(renderer) {
    this.springs.forEach((s) => {
      renderer.line(
        s.particle1.getPosition(),
        s.particle2.getPosition(),
        2, // thickness
        this.p(this.dna.branchColor)
      );
    });
  }
}

/**
 * A straight‐growing stem node (no branching beyond its one child per growth).
 */
export class StemNode extends PlantNode {
  /**
   * @param {Plant}    plant
   * @param {Particle} particle
   * @param {object}   dna
   * @param {number}   depth             – how deep we are in the plant
   * @param {number}   countSinceBranch  – how many growths since last branch
   */
  constructor(plant, particle, dna, depth = 0, countSinceBranch = 0) {
    super(plant, particle, dna, depth, countSinceBranch);
    this.type = "StemNode";
    // Tag for behaviors/interactions that filter on “stem”
    this.particle.addTag("stem");
    // By default PlantNode.growthCounter = 1, so each stem node extends once
  }
  // Inherits the generic grow() and draw() from PlantNode
}

/**
 * A flower‐tipped node: sprouts petals instead of further stems/branches.
 */
export class FlowerNode extends PlantNode {
  /**
   * @param {Plant}    plant
   * @param {Particle} particle
   * @param {object}   dna
   */
  constructor(plant, particle, dna) {
    // No countSinceBranch needed here
    super(plant, particle, dna);
    this.type = "FlowerNode";
    // Number of petals to sprout
    this.growthCounter = this.dna.numPetals;
    this.particle.addTag("flower");
  }

  /** Override: instead of branching, sprout petal nodes */
  grow() {
    const system = this.plant.particleSystem;
    if (this.growthCounter > 0 && fxrand() < this.dna.growthChance) {
      this.growthCounter--;
      // jitter out from the center
      const pos = this.particle.position.jittered(
        this.dna.petalConnectionLength / 2
      );
      const petalP = system.createParticle(pos);
      if (petalP) {
        this.attachNode(
          new PetalNode(this.plant, petalP, this.dna),
          this.dna.petalConnectionLength
        );
      }
    }
  }

  /** Override: draw the petal‐springs and then the flower center */
  draw(renderer) {
    // draw each petal connection
    this.springs.forEach((s) => {
      renderer.line(
        s.particle1.getPosition(),
        s.particle2.getPosition(),
        1, // thin line for petals
        this.p(this.dna.petalColor)
      );
    });
    // draw the flower center
    renderer.circle(
      this.particle.position,
      this.dna.flowerSize,
      this.p(this.dna.flowerColor)
    );
  }
}

/**
 * A PlantNode that produces branches.
 * Extends the generic PlantNode logic (growth, attachment, drawing).
 */
export class BranchNode extends PlantNode {
  /**
   * @param {Plant}      plant   – the parent Plant container
   * @param {Particle}   particle– the seed particle for this node
   * @param {object}     dna     – the plant’s DNA parameters
   * @param {number}     depth   – current depth in the plant tree
   */
  constructor(plant, particle, dna, depth) {
    // countSinceBranch = 0 for a fresh branch node
    super(plant, particle, dna, depth, /* countSinceBranch */ 0);

    this.type = "BranchNode";

    // Determine how many children this node will try to spawn:
    //  - at depth 0: use initialBranchingFactor
    //  - afterwards: use branchingFactor(dna, depth)
    this.growthCounter =
      depth === 0
        ? this.p(dna.initialBranchingFactor)
        : this.p(dna.branchingFactor);

    // Tag it so interactions/behaviors that filter on "branch" will pick it up
    this.particle.addTag("branch");
  }

  // (inherits grow(), attachNode(), draw(), etc. from PlantNode)
}

/**
 * Generator that adds one Plant to the scene with a bit of customization.
 *
 * @param {ParticleSystem} system  – your physics simulation
 * @param {Container}       stage   – the Stage container
 * @param {ColorManager}    colors  – for theme color lookups
 */
export const addPlant = (system, stage, colors) => {
  stage.addChild(
    new Plant({
      // Override the DNA to spawn slightly larger, fewer petals, custom colors:
      maxDepth: () => 10 + fxrand() * 2,
      branchLength: 10,
      initialBranchingFactor: fxrand() * 2 + 2,
      numPetals: 0,
      connectionLength: 1,
      branchColor: () => colors.get("long_boi_branch"),
      flowerColor: () => colors.get("long_boi_flower"),
    })
  );
};

/**
 * Spawns a shallow “branch” variant of Plant (no flowers/petals).
 *
 * @param {ParticleSystem} system – your simulation
 * @param {Container}       stage  – the Stage container
 * @param {ColorManager}    colors – for palette lookups
 */
export const addBranch = (system, stage, colors) => {
  stage.addChild(
    new Plant({
      // Only 6 levels deep
      maxDepth: () => 6,
      // After 2 growths, force a branch
      branchLength: 2,
      // Start with 4 possible children
      initialBranchingFactor: 4,
      // Always create 3 branches thereafter
      branchingFactor: () => 3,
      // 60% chance to branch instead of extend
      branchingChance: 0.6,
      // No petals or flowers on this variant
      numPetals: 0,
      petalConnectionLength: 1,
      // Pick one of the three branch colors at random
      branchColor: () =>
        chooseRandom(
          colors.get("branch_1"),
          colors.get("branch_2"),
          colors.get("branch_3")
        ),
      // Pick one of the three flower colors (unused here)
      flowerColor: () =>
        chooseRandom(
          colors.get("flower_1"),
          colors.get("flower_2"),
          colors.get("flower_3")
        ),
      // Distance between connected nodes
      connectionLength: 5,
    })
  );
};
