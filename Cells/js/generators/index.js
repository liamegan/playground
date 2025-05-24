// Helper to pick a random item from a list
function chooseRandom(...items) {
  return items[Math.floor(fxrand() * items.length)];
}

/**
 * All of your generator configurations, keyed by name.
 * Each entry has:
 *  - name       : string label
 *  - weight     : how often it’s chosen
 *  - creatures  : array of { fn, min, max } entries to spawn
 *  - constraints: array of { fn, weight } entries to apply one constraint
 */
const generatorOptions = {
  everything: {
    name: "everything",
    weight: 30,
    creatures: [
      { fn: addDust, min: 1, max: 1 },
      { fn: addPlant, min: 2, max: 3 },
      { fn: addBranch, min: 3, max: 6 },
      { fn: addLongWorm, min: 3, max: 5 },
      // { fn: addWormFlock, min: 2, max: 4 },
      { fn: addBigBlob, min: 0, max: 2 },
      { fn: addCircle, min: 0, max: 3 },
      { fn: addBlob, min: 3, max: 4 },
      { fn: addOrganelle, min: 0, max: 3 },
    ],
    constraints: [
      { fn: doNothing, weight: 1 },
      { fn: applyCircleField, weight: 1 },
      { fn: applyBlobField, weight: 1 },
    ],
  },
  planets: {
    name: "space",
    weight: 20,
    creatures: [
      { fn: addDust, min: 1, max: 1 },
      { fn: addPlant, min: 2, max: 3 },
      { fn: addBranch, min: 2, max: 5 },
      { fn: addLongWorm, min: 2, max: 4 },
      // { fn: addWormFlock, min: 2, max: 4 },
      { fn: addBigBlob, min: 0, max: 1 },
      { fn: addCircle, min: 0, max: 3 },
      { fn: addBlob, min: 2, max: 3 },
      { fn: addOrganelle, min: 0, max: 2 },
    ],
    constraints: [
      { fn: applyCircleField, weight: 1 },
      { fn: applyBlobField, weight: 1 },
    ],
  },
  // ...repeat for plantHeaven, wormHeaven, longWorms, blobHeaven, angelPlant, bigCell...
};

/**
 * Picks one generator from generatorOptions (weighted), spawns its creatures,
 * then picks one of its constraints (weighted) and applies it.
 *
 * @param {ParticleSystem} system
 * @param {Container} stage
 * @param {ColorManager} colors
 * @param {Renderer} renderer
 */
function generateCreatures(system, stage, colors, renderer) {
  // 1) Choose generator
  const allGens = Object.values(generatorOptions);
  const weightedGens = allGens.flatMap((gen) => Array(gen.weight).fill(gen));
  const chosenGen = chooseRandom(...weightedGens);

  window.$fxhashFeatures.generator = chosenGen.name;

  // 2) Spawn creatures
  chosenGen.creatures.forEach((entry) => {
    const count = Math.round(fxrand() * (entry.max - entry.min) + entry.min);
    for (let i = 0; i < count; i++) {
      entry.fn(system, stage, colors);
    }
  });

  // 3) Apply one random constraint
  const weightedConstraints = chosenGen.constraints.flatMap((c) =>
    Array(c.weight).fill(c)
  );
  const chosenConstraint = chooseRandom(...weightedConstraints);
  chosenConstraint.fn(system, renderer);
}
