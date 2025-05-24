import { Container } from "../Container.js";
import { Vector3 } from "../Vec3.js";
import { rand } from "../random.js";

export class Blob extends Container {
  constructor(
    startSize,
    radius,
    maxSize,
    springLength,
    springK,
    innerColor,
    outerColor,
    spikes,
    thickness = 2,
    startPosition
  ) {
    super("Blob", null);
    this.startSize = startSize;
    this.radius = radius;
    this.maxSize = maxSize;
    this.springLength = springLength;
    this.springK = springK;
    this.startPosition = startPosition;
    this.innerParticles = [];
    this.outerParticles = [];
    this.innerSprings = [];
    this.outerSprings = [];
    this.spikes = spikes;
    this.internalGrowths = [];
    this.thickness = thickness;
    this.innerColor = innerColor;
    this.outerColor = outerColor;
  }

  setup() {
    const system = this.particleSystem;
    let center = this.attachedParticle
      ? this.attachedParticle.getPosition().jittered(this.springLength)
      : this.positionHint ||
        this.startPosition ||
        system.bounds.getCenter().copy();

    // Create inner circle of particles.
    let angleOffset = rand() * Math.PI * 2;
    for (let i = 0; i < this.startSize; i++) {
      let angle = ((2 * Math.PI) / this.startSize) * i + angleOffset;
      let p = system.createParticle(
        new Vector3(
          center.x + Math.cos(angle) * this.radius,
          center.y + Math.sin(angle) * this.radius
        ),
        true
      );
      this.addParticle(p);
      this.innerParticles.push(p);
    }

    // Create springs between inner particles.
    let first = this.innerParticles[0];
    let last = this.innerParticles[this.innerParticles.length - 1];
    this.innerSprings.push(
      system.createSpring(last, first, this.springLength, this.springK)
    );
    for (let i = 0; i < this.innerParticles.length - 1; i++) {
      let p = this.innerParticles[i];
      this.innerSprings.push(
        system.createSpring(
          p,
          this.innerParticles[i + 1],
          this.springLength,
          this.springK
        )
      );
    }

    // Optionally create outer spikes.
    if (this.spikes) {
      for (let i = 0; i < this.startSize; i++) {
        let angle = ((2 * Math.PI) / this.startSize) * i + angleOffset;
        let baseParticle = this.innerParticles[i];
        let spikeParticle = system.createParticle(
          new Vector3(
            center.x + Math.cos(angle) * (this.radius + 1),
            center.y + Math.sin(angle) * (this.radius + 1)
          ),
          true
        );
        this.outerSprings.push(
          system.createSpring(
            baseParticle,
            spikeParticle,
            this.springLength,
            this.springK
          )
        );
        this.outerParticles.push(spikeParticle);
        this.addParticle(spikeParticle);
      }
    }

    // Add all created springs to the container.
    this.addSprings(this.innerSprings);
    this.addSprings(this.outerSprings);
  }

  // (update, draw, and growth functions follow a similar pattern.)

  draw(renderer) {
    // Draw inner and outer springs with specified thickness and colors.
    this.innerSprings.forEach((spring) => {
      renderer.line(
        spring.particle1.getPosition(),
        spring.particle2.getPosition(),
        this.thickness,
        this.innerColor()
      );
    });
    this.outerSprings.forEach((spring) => {
      renderer.line(
        spring.particle1.getPosition(),
        spring.particle2.getPosition(),
        this.thickness,
        this.outerColor()
      );
    });
    super.draw(renderer);
  }
}
/**
 * Spawns a “blob” with some internal growth sprouting.
 *
 * @param {ParticleSystem} system  – your simulation
 * @param {Container} stage        – the root container (Stage)
 * @param {ColorManager} colors    – your color lookup
 */
export const addBlob = (system, stage, colors) => {
  // 1) Choose a random “max size” for this blob
  const maxSize = rand() * 30 + 5;

  // 2) Create the main blob (no spikes)
  const blob = new Blob(
    /* startSize:   */ 3,
    /* radius:      */ 5,
    /* maxSize:     */ maxSize,
    /* springLength:*/ 1,
    /* springK:     */ 0.1,
    /* innerColor:  */ () => colors.get("blob_inner"),
    /* outerColor:  */ () => colors.get("blob_outer"),
    /* spikes:      */ false,
    /* thickness:   */ 2,
    /* startPos:    */ system.bounds.getRandomPointInside()
  );

  // 3) Schedule a few “internal growths” (small blobs sprouting inside)
  const growthCount = Math.floor(maxSize / 10);
  for (let i = 0; i < growthCount; i++) {
    blob.addInternalGrowth(
      () =>
        new Blob(
          /* startSize:   */ 3,
          /* radius:      */ 5,
          /* maxSize:     */ 5,
          /* springLength:*/ 0.5,
          /* springK:     */ 0.1,
          /* innerColor:  */ () => colors.get("blob_inner"),
          /* outerColor:  */ () => colors.get("blob_outer"),
          /* spikes:      */ false,
          /* thickness:   */ 1
          // no explicit startPosition → will default to blob’s centroid
        )
    );
  }

  // 4) Add it to the stage graph
  stage.addChild(blob);
};

/**
 * Spawns one large, spiky blob.
 *
 * @param {ParticleSystem} system  – the simulation
 * @param {Container}       stage   – your Stage container
 * @param {ColorManager}    colors  – for looking up theme colors
 */
export const addBigBlob = (system, stage, colors) => {
  // Pick a random “maximum size” between 5 and 20
  const maxSize = 5 + fxrand() * 15;

  // Create a spiky blob (spikes = true)
  const bigBlob = new Blob(
    /* startSize:    */ 3,
    /* radius:       */ 5,
    /* maxSize:      */ maxSize,
    /* springLength: */ 1,
    /* springK:      */ 0.1,
    /* innerColor:   */ () => colors.get("blob_inner"),
    /* outerColor:   */ () => colors.get("blob_outer"),
    /* spikes:       */ true,
    /* thickness:    */ 2,
    /* startPosition:*/ system.bounds.getRandomPointInside()
  );

  // Add it to the scene
  stage.addChild(bigBlob);
};
