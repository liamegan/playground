import { prng } from "../../Global/prng";

let random;
export const initializeRandom = (seed) => {
  random = prng(seed);
};
export const randomInt = (min, max) => {
  return Math.floor(random() * (max - min + 1)) + min;
};
export const randomFloat = (min, max) => {
  return random() * (max - min) + min;
};
export const randomBool = () => {
  return random() < 0.5;
};
export const randomChoice = (arr) => {
  return arr[randomInt(0, arr.length - 1)];
};
export const randomSign = () => {
  return randomBool() ? 1 : -1;
};
export const rand = () => {
  return random();
};
