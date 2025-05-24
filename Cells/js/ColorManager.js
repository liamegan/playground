import { colorToInt, chooseRandom } from "./utils.js";
import { predefinedColorPalettes } from "./colorPalettes.js";
import { rand } from "./random";
export class ColorManager {
  constructor() {
    // Available palettes with weights.
    const palettes = [
      { colorMap: "springNight", weight: 5 },
      { colorMap: "fallNight", weight: 5 },
      { colorMap: "springDay", weight: 2 },
      { colorMap: "fallDay", weight: 2 },
      { colorMap: "desert", weight: 1 },
    ];
    // Build a weighted array.
    const weightedPalettes = palettes
      .map((p) => Array.from({ length: p.weight }, () => p))
      .reduce((acc, arr) => acc.concat(arr), []);
    let chosen = chooseRandom(...weightedPalettes).colorMap;
    this.colorMap = predefinedColorPalettes[chosen];

    // Randomly select one background option.
    const bg1 = this.colorMap.background1;
    const bg2 = this.colorMap.background2;
    let index = Math.floor(rand() * bg1.length);
    this.colorMap.background1 = bg1[index];
    this.colorMap.background2 = bg2[index];
    this.colorList = Object.keys(this.colorMap);
  }

  get(key) {
    // Lazy-load a default if key is not present.
    if (this.colorMap[key] === undefined) {
      this.colorMap[key] = colorToInt(0.5, 0.5, 0.5);
      this.colorList.push(key);
    }
    return this.colorMap[key];
  }

  async serializeColors() {
    let json = JSON.stringify(this.colorMap, null, 2);
    await navigator.clipboard.writeText(json);
  }
}
