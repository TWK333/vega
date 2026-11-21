// Pixel citizen avatars: 20 rigged 32×32 pixel-art characters spanning diverse genders and professions.
// Each character is composed of 7 independent skeletal parts (head, torso, armL, armR, legL, legR, prop)
// and 5 independent occupation keyframe animation clips (100 clips total), cached per (role, clip, frame, hex).

import { PIXEL_GRID_SIZE, RIG_PARTS, compileGrid, composeKeyframe, shade } from "./pixel-rig.js";
import { ROLES_A } from "./pixel-roles-a.js";
import { ROLES_B } from "./pixel-roles-b.js";

export { PIXEL_GRID_SIZE, RIG_PARTS, compileGrid, composeKeyframe, shade };

export const PIXEL_SPRITES = { ...ROLES_A, ...ROLES_B };
export const PIXEL_ROLE_IDS = Object.keys(PIXEL_SPRITES);

/** Pick a random occupation animation clip for a role, avoiding immediate repeats when `excludeClipId` is given. */
export function pickRandomAnimation(roleId, excludeClipId = "", random = Math.random) {
  const sprite = PIXEL_SPRITES[roleId] || PIXEL_SPRITES.coder;
  const clips = sprite.animations;
  const pool = excludeClipId && clips.length > 1 ? clips.filter((c) => c.id !== excludeClipId) : clips;
  return pool[Math.floor(random() * pool.length)] || clips[0];
}

// Composed + compiled frame cache keyed strictly by (role, clip, frame, hex).
const frameCache = new Map();

export function clearPixelFrameCache() {
  frameCache.clear();
}

export function getPixelFrameCacheSize() {
  return frameCache.size;
}

/**
 * Render (and cache) one frame of a rigged 32×32 pixel citizen as a soft tinted badge + crisp SVG pixel paths.
 * `clipId`: omit/"" for default clip 0 (backward compatible), `"idle"` for calm resting pose, or any clip id in `sprite.animations`.
 */
export function renderPixelFrame(roleId, hex = "#3878fb", frameIndex = 0, clipId = "") {
  const sprite = PIXEL_SPRITES[roleId] || PIXEL_SPRITES.coder;
  const color = /^#[0-9a-fA-F]{6}$/.test(hex || "") ? hex : "#3878fb";

  let keyframe, clipKey, index;
  if (clipId === "idle") {
    clipKey = "idle";
    index = 0;
    keyframe = sprite.idleKeyframe;
  } else {
    const active = clipId ? (sprite.animations.find((c) => c.id === clipId) || sprite.animations[0]) : sprite.animations[0];
    clipKey = active.id;
    index = ((frameIndex % active.keyframes.length) + active.keyframes.length) % active.keyframes.length;
    keyframe = active.keyframes[index];
  }

  const cacheKey = `${sprite.id}|${clipKey}|${index}|${color}`;
  const cached = frameCache.get(cacheKey);
  if (cached) return cached;

  const matrix = composeKeyframe(sprite.rig, keyframe);
  const paletteMap = sprite.palette(color);
  const rendered = {
    bg: shade(color, 0.87),
    border: shade(color, 0.72),
    layers: compileGrid(matrix, paletteMap),
  };
  frameCache.set(cacheKey, rendered);
  return rendered;
}

/** Return the sprite metadata for a role id (falling back to coder). */
export function getPixelSprite(roleId) {
  return PIXEL_SPRITES[roleId] || PIXEL_SPRITES.coder;
}
