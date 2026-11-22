// 64×64 Multi-Angle ("Pixel 3D" / 2.5D) Skeletal Pixel Rig & Keyframe Arc-Interpolation Engine.
// Each character consists of 7 independent 64×64 skeletal parts (head, torso, armL, armR, legL, legR, prop)
// across 3 viewing perspectives: front, side (profile with facing flip), and back (rear).
// Each animation clip stores 12–20 per-part keyframes { dx, dy, variant, flip, visible } + { angle, facing }
// generated with anatomical joint-arc transitions, smooth eased trajectories, and 3D turntable angle transitions.

import {
  buildAngleProps,
  buildBackArmParts,
  buildBackHeadParts,
  buildBackLegParts,
  buildBackTorsoParts,
  buildSideArmParts,
  buildSideHeadParts,
  buildSideLegParts,
  buildSideTorsoParts,
  shadePaletteForAngle,
} from "./pixel-rig-angles.js";

export { shadePaletteForAngle };

export const PIXEL_GRID_SIZE = 64;
export const RIG_PARTS = Object.freeze(["head", "torso", "armL", "armR", "legL", "legR", "prop"]);
export const RIG_ANGLES = Object.freeze(["front", "side", "back"]);

/** Mix a #rrggbb color toward white (amount > 0) or black (amount < 0). */
export function shade(hex, amount) {
  const clean = /^#[0-9a-fA-F]{6}$/.test(hex || "") ? hex : "#3878fb";
  const n = parseInt(clean.slice(1), 16), t = amount < 0 ? 0 : 255, k = Math.abs(amount);
  const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.round(v + (t - v) * k));
  return "#" + c.map((v) => v.toString(16).padStart(2, "0")).join("");
}

// ============================================================================
// Low-level 64×64 Grid Primitives & Pixel-Art 2× Bevel Upscaler
// ============================================================================

export function blank(size = PIXEL_GRID_SIZE) {
  return Array.from({ length: size }, () => Array(size).fill("."));
}

export function clone(src) {
  return src.map((row) => [...row]);
}

export function px(g, x, y, ch) {
  if (x >= 0 && x < g.length && y >= 0 && y < g.length) g[y][x] = ch;
  return g;
}

export function fill(g, x, y, w, h, ch) {
  const n = g.length;
  for (let r = y; r < y + h; r++) {
    if (r < 0 || r >= n) continue;
    for (let c = x; c < x + w; c++) {
      if (c >= 0 && c < n) g[r][c] = ch;
    }
  }
  return g;
}

/** Stamp a native-resolution ASCII patch at (ox, oy). `.` keeps existing pixel, `_` erases to transparent. */
export function stamp(target, ox, oy, lines) {
  const n = target.length;
  for (let r = 0; r < lines.length; r++) {
    const y = oy + r;
    if (y < 0 || y >= n) continue;
    const row = lines[r];
    for (let c = 0; c < row.length; c++) {
      const x = ox + c;
      if (x < 0 || x >= n) continue;
      const ch = row[c];
      if (ch === ".") continue;
      target[y][x] = ch === "_" ? "." : ch;
    }
  }
  return target;
}

/**
 * Stamp a 32×32-coordinate ASCII art patch into 64×64 space using EPX-style pixel-art corner beveling,
 * turning chunky diagonal staircases into crisp, organic 64×64 pixel curves while staying 100% pixel art.
 */
export function stamp2x(target, ox32, oy32, lines, smooth = true) {
  const h = lines.length, w = Math.max(0, ...lines.map((l) => l.length));
  const at = (c, r) => (r >= 0 && r < h && c >= 0 && c < lines[r].length ? lines[r][c] : ".");
  const solid = (ch) => ch !== "." && ch !== "_";
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < lines[r].length; c++) {
      const P = at(c, r);
      if (P === ".") continue;
      const x = (ox32 + c) * 2, y = (oy32 + r) * 2;
      if (P === "_") {
        fill(target, x, y, 2, 2, ".");
        continue;
      }
      if (!smooth) {
        fill(target, x, y, 2, 2, P);
        continue;
      }
      const U = at(c, r - 1), D = at(c, r + 1), L = at(c - 1, r), R = at(c + 1, r);
      let q0 = P, q1 = P, q2 = P, q3 = P;
      // EPX corner smoothing: blend inner corners where orthogonal neighbors match & differ from opposite pair
      if (U === L && U !== D && L !== R && solid(U)) q0 = U;
      if (U === R && U !== D && R !== L && solid(U)) q1 = U;
      if (D === L && D !== U && L !== R && solid(D)) q2 = D;
      if (D === R && D !== U && R !== L && solid(D)) q3 = D;
      // Outer silhouette corner chamfer: soften isolated 90° protruding corners on multi-pixel shapes
      const count = (solid(U) ? 1 : 0) + (solid(D) ? 1 : 0) + (solid(L) ? 1 : 0) + (solid(R) ? 1 : 0);
      if (count >= 2) {
        if (!solid(U) && !solid(L) && solid(D) && solid(R)) q0 = ".";
        if (!solid(U) && !solid(R) && solid(D) && solid(L)) q1 = ".";
        if (!solid(D) && !solid(L) && solid(U) && solid(R)) q2 = ".";
        if (!solid(D) && !solid(R) && solid(U) && solid(L)) q3 = ".";
      }
      if (q0 !== ".") px(target, x, y, q0);
      if (q1 !== ".") px(target, x + 1, y, q1);
      if (q2 !== ".") px(target, x, y + 1, q2);
      if (q3 !== ".") px(target, x + 1, y + 1, q3);
    }
  }
  return target;
}

/** Stamp a 32-space FX patch directly at native 64×64 pixel offset (ox64, oy64) so 1px 64×64 drift is crisp. */
function stamp2xAt64(target, ox64, oy64, lines) {
  for (let r = 0; r < lines.length; r++) {
    const row = lines[r];
    for (let c = 0; c < row.length; c++) {
      const ch = row[c];
      if (ch === ".") continue;
      fill(target, ox64 + c * 2, oy64 + r * 2, 2, 2, ch === "_" ? "." : ch);
    }
  }
  return target;
}

/** Create a 64×64 part sprite from a 32-space patch (with EPX pixel beveling for smooth 64×64 pixel craft). */
export function partPatch(ox32, oy32, lines, smooth = true) {
  return stamp2x(blank(), ox32, oy32, lines, smooth);
}

/** Create a 64×64 part sprite directly from native 64×64 coordinates. */
export function partNative(ox64, oy64, lines) {
  return stamp(blank(), ox64, oy64, lines);
}

/** Horizontally flip a 64×64 part around the center axis (x ↔ 63 - x). */
export function flipMatrixH(src) {
  const n = src.length, out = blank(n);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const ch = src[y][x];
      if (ch !== ".") out[y][n - 1 - x] = ch;
    }
  }
  return out;
}

function blitPart(target, src, dx = 0, dy = 0, flip = false) {
  if (!src) return;
  const n = target.length, mat = flip ? flipMatrixH(src) : src;
  for (let y = 0; y < n; y++) {
    const ny = y + dy;
    if (ny < 0 || ny >= n) continue;
    const row = mat[y];
    for (let x = 0; x < n; x++) {
      const ch = row[x];
      if (ch === ".") continue;
      const nx = x + dx;
      if (nx >= 0 && nx < n) target[ny][nx] = ch;
    }
  }
}

/** Add a delicate, crisp 1px native-64×64 dark-ink outline around solid body/prop pixels (skipping `Z`). */
export function outline(src, ch = "O") {
  const n = src.length, out = clone(src);
  const solid = (x, y) => {
    if (x < 0 || x >= n || y < 0 || y >= n) return false;
    const c = src[y][x];
    return c !== "." && c !== "Z" && c !== ch;
  };
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (src[y][x] !== ".") continue;
      if (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1)) out[y][x] = ch;
    }
  }
  return out;
}

function blitAfterimage(target, src, dx, dy, tint = "c") {
  const n = target.length;
  for (let y = 0; y < n; y++) {
    const ny = y + dy;
    if (ny < 0 || ny >= n) continue;
    for (let x = 0; x < n; x++) {
      const ch = src[y][x];
      if (ch === "." || ch === "Z") continue;
      const nx = x + dx;
      if (nx >= 0 && nx < n && target[ny][nx] === ".") target[ny][nx] = tint;
    }
  }
}

export function petrifyMatrix(src) {
  const map = {
    S: "w", s: "G", P: "w", m: "g", A: "G", a: "w", d: "g", H: "g", h: "G", k: "O",
    N: "g", n: "G", B: "g", b: "G", R: "g", Y: "w", F: "G", C: "w", V: "G", M: "G", U: "g",
  };
  return src.map((row) => row.map((c) => map[c] || c));
}

function scaleMatrix(src, factor) {
  const n = src.length, out = blank(n);
  const dstSize = Math.max(8, Math.round(n * factor));
  const ox = Math.floor((n - dstSize) / 2);
  const oy = Math.min(n - 6 - dstSize, Math.round(58 - dstSize));
  for (let y = 0; y < dstSize; y++) {
    const sy = Math.min(n - 1, Math.floor(y / factor));
    for (let x = 0; x < dstSize; x++) {
      const sx = Math.min(n - 1, Math.floor(x / factor));
      const c = src[sy][sx];
      if (c && c !== "." && c !== "Z") px(out, ox + x, oy + y, c);
    }
  }
  return out;
}

// ============================================================================
// Shared Color Palettes
// ============================================================================

export const SKIN = {
  fair: { S: "#fde4cf", s: "#e7b99a", P: "#f79ea4", m: "#c26c62" },
  peach: { S: "#fcd2ae", s: "#dfa179", P: "#f28f93", m: "#b86154" },
  warm: { S: "#f0bc90", s: "#cf8f62", P: "#e58178", m: "#a65446" },
  tan: { S: "#d69666", s: "#b17244", P: "#d17266", m: "#8c4438" },
  deep: { S: "#b27046", s: "#894d2b", P: "#b35e52", m: "#6a3124" },
};

export const BASE_PALETTE = {
  O: "#1c2033", E: "#141826", N: "#2c3954", n: "#44567a",
  W: "#ffffff", w: "#cbd5e1", G: "#94a3b8", g: "#475569",
  B: "#7a472a", b: "#dba86c", K: "#4e2d1a",
  R: "#ef4444", r: "#b91c1c", Y: "#fbbf24", y: "#fef08a",
  C: "#22d3ee", c: "#a5f3fc", V: "#22c55e", v: "#15803d",
  M: "#ec4899", U: "#a855f7", u: "#d8b4fe", F: "#f97316",
  Z: "rgba(15, 23, 42, 0.14)",
};

export function makePalette(skin, hair, extra = {}) {
  return (hex) => ({
    ...BASE_PALETTE,
    ...skin,
    ...hair,
    A: hex,
    a: shade(hex, 0.30),
    d: shade(hex, -0.32),
    ...extra,
  });
}

// ============================================================================
// Native 64×64 Skeletal Part Builders (head, torso, armL, armR, legL, legR)
// ============================================================================

function drawBaseHead64({ gender = "male", hairStyle = "short", eyeStyle, hatFn, beardFn } = {}) {
  const g = blank();
  const isF = gender === "female";

  // 1. Back hair silhouettes (native 64×64 curves & layered locks)
  if (hairStyle === "long") {
    fill(g, 16, 18, 32, 21, "H");
    fill(g, 15, 22, 34, 15, "H");
    fill(g, 16, 31, 4, 9, "k"); fill(g, 44, 31, 4, 9, "k");
    px(g, 15, 37, "k"); px(g, 48, 37, "k");
  } else if (hairStyle === "wavy") {
    fill(g, 15, 18, 34, 19, "H");
    fill(g, 13, 23, 38, 13, "H");
    fill(g, 14, 34, 5, 6, "k"); fill(g, 45, 34, 5, 6, "k");
    fill(g, 15, 39, 3, 2, "k"); fill(g, 46, 39, 3, 2, "k");
  } else if (hairStyle === "ponytail") {
    stamp(g, 44, 17, [
      "HHHHH..", ".HHHHHH", "..HHHHH", "...HHHk", "...HHkk", "....kkk", ".....kk",
    ]);
    px(g, 44, 18, "h"); px(g, 45, 18, "h");
  } else if (hairStyle === "bob") {
    fill(g, 16, 18, 32, 18, "H");
    fill(g, 15, 22, 34, 12, "H");
    fill(g, 16, 32, 4, 4, "k"); fill(g, 44, 32, 4, 4, "k");
  }

  // 2. Sculpted 64×64 Chibi Face (x=20..43, y=18..33) with chamfered jaw & soft ears
  fill(g, 20, 18, 24, 14, "S");
  fill(g, 22, 32, 20, 2, "S");
  fill(g, 23, 33, 18, 1, "s"); // delicate chin shadow
  px(g, 20, 31, "s"); px(g, 21, 32, "s"); px(g, 43, 31, "s"); px(g, 42, 32, "s");
  px(g, 20, 31, "."); px(g, 43, 31, "."); // rounded cheeks
  // Rounded ears
  fill(g, 18, 24, 2, 4, "S"); px(g, 18, 24, "."); px(g, 19, 27, "s");
  fill(g, 44, 24, 2, 4, "S"); px(g, 45, 24, "."); px(g, 44, 27, "s");

  // 3. Native 64×64 Layered Hair Crown & Specular Shine
  if (hairStyle === "spiky") {
    fill(g, 19, 13, 26, 7, "H");
    fill(g, 21, 11, 22, 3, "H");
    // Dynamic hair spikes
    stamp(g, 20, 8, [
      "..HH.....HHH...HH...",
      ".HHHH...HHHHH.HHHH..",
      "HHHHHHHHHHHHHHHHHHHH",
    ]);
    // Curved highlight band + bangs
    fill(g, 23, 14, 6, 2, "h"); fill(g, 34, 14, 6, 2, "h");
    fill(g, 18, 18, 3, 6, "H"); fill(g, 43, 18, 3, 6, "H");
    fill(g, 20, 19, 4, 2, "k"); fill(g, 27, 19, 4, 2, "k"); fill(g, 35, 19, 4, 2, "k"); fill(g, 41, 19, 3, 2, "k");
  } else if (hairStyle === "bun") {
    // High top bun with curved highlight
    fill(g, 26, 6, 12, 7, "H");
    px(g, 26, 6, "."); px(g, 37, 6, "."); px(g, 26, 12, "."); px(g, 37, 12, ".");
    fill(g, 28, 7, 6, 2, "h");
    fill(g, 19, 13, 26, 7, "H"); fill(g, 21, 11, 22, 3, "H");
    fill(g, 23, 14, 7, 2, "h"); fill(g, 34, 14, 6, 2, "h");
    fill(g, 18, 18, 3, 6, "H"); fill(g, 43, 18, 3, 6, "H");
    fill(g, 20, 19, 24, 1, "k");
  } else if (hairStyle === "fluffy") {
    fill(g, 17, 12, 30, 8, "H"); fill(g, 20, 10, 24, 3, "H");
    px(g, 17, 12, "."); px(g, 46, 12, ".");
    fill(g, 21, 13, 8, 2, "h"); fill(g, 34, 13, 8, 2, "h");
    fill(g, 16, 18, 4, 6, "H"); fill(g, 44, 18, 4, 6, "H");
    fill(g, 20, 19, 5, 2, "k"); fill(g, 29, 19, 6, 2, "k"); fill(g, 39, 19, 5, 2, "k");
  } else {
    fill(g, 19, 13, 26, 7, "H"); fill(g, 21, 11, 22, 3, "H");
    px(g, 19, 13, "."); px(g, 44, 13, ".");
    fill(g, 23, 14, 7, 2, "h"); fill(g, 34, 14, 7, 2, "h");
    fill(g, 18, 18, 3, 6, "H"); fill(g, 43, 18, 3, 6, "H");
    fill(g, 20, 19, 5, 2, "k"); fill(g, 28, 19, 5, 2, "k"); fill(g, 37, 19, 6, 2, "k");
  }

  // 4. Native 64×64 Expressive Anime Eyes, Brows, Blush & Smile
  const eStyle = eyeStyle || (isF ? "sparkle" : "crisp");
  if (eStyle === "sparkle") {
    // 4×5 sparkling anime eyes with top lash, bright catchlight, and soft rosy cheeks
    stamp(g, 22, 22, ["EEEE", "WWEE", "WEEE", "EEWE", "kEEk"]);
    stamp(g, 38, 22, ["EEEE", "WWEE", "WEEE", "EEWE", "kEEk"]);
    fill(g, 20, 27, 3, 2, "P"); fill(g, 41, 27, 3, 2, "P");
    stamp(g, 29, 29, ["m....m", ".mmmm."]);
  } else if (eStyle === "crisp") {
    // Sculpted male brows + 4×4 crisp eyes with catchlight
    fill(g, 22, 20, 4, 1, "k"); fill(g, 38, 20, 4, 1, "k");
    stamp(g, 22, 22, ["WWEE", "WEEE", "EEEE", "EEkE"]);
    stamp(g, 38, 22, ["WWEE", "WEEE", "EEEE", "EEkE"]);
    stamp(g, 29, 29, [".mmmm."]);
  } else if (eStyle === "glasses") {
    stamp(g, 20, 21, [
      ".OOOOOOO........OOOOOOO.",
      "OcWWEEccOOOOOOOOccWWEEcO",
      "OcWEEEccO......OccWEEEcO",
      "OcEEEEccO......OccEEEEcO",
      "OccEEcccO......OcccEEccO",
      ".OOOOOOO........OOOOOOO.",
    ]);
    stamp(g, 29, 29, [".mmmm."]);
  } else if (eStyle === "goldglasses") {
    stamp(g, 20, 21, [
      ".YYYYYYY........YYYYYYY.",
      "YcWWEEccYYYYYYYYccWWEEcY",
      "YcWEEEccY......YccWEEEcY",
      "YcEEEEccY......YccEEEEcY",
      "YccEEcccY......YcccEEccY",
      ".YYYYYYY........YYYYYYY.",
    ]);
    fill(g, 20, 27, 3, 2, "P"); fill(g, 41, 27, 3, 2, "P");
    stamp(g, 29, 29, ["m....m", ".mmmm."]);
  } else if (eStyle === "shades") {
    stamp(g, 20, 21, [
      ".OOOOOOO........OOOOOOO.",
      "OOWgOOOOOOOOOOOOOWgOOOOO",
      "OWgOOOOOO......OWgOOOOOO",
      ".OOOOOOO........OOOOOOO.",
      "..OOOOO..........OOOOO..",
    ]);
    fill(g, 20, 27, 3, 2, "P"); fill(g, 41, 27, 3, 2, "P");
    stamp(g, 29, 29, [".mmmm."]);
  }

  if (beardFn) beardFn(g);
  if (hatFn) hatFn(g);
  return g;
}

/** Build the full dictionary of native 64×64 head expression & gag variants. */
export function buildHeadParts(spec) {
  const normal = spec.customHead ? spec.customHead() : drawBaseHead64(spec);
  const mod = (fn) => { const c = clone(normal); fn(c); return c; };
  const hasGlasses = spec.eyeStyle === "glasses" || spec.eyeStyle === "goldglasses";
  const eyeFill = hasGlasses ? "c" : "S";
  const eyeH = hasGlasses ? 4 : 5;
  const clearEyes = (g) => { fill(g, 22, 22, 4, eyeH, eyeFill); fill(g, 38, 22, 4, eyeH, eyeFill); };
  const parts = {
    normal,
    blink: mod((g) => {
      clearEyes(g);
      fill(g, 22, 24, 4, 1, "k"); fill(g, 38, 24, 4, 1, "k");
    }),
    happy: mod((g) => {
      clearEyes(g);
      stamp(g, 22, 23, [".EE.", "E..E"]); stamp(g, 38, 23, [".EE.", "E..E"]);
      stamp(g, 29, 28, ["mmmmmm", "mWWWWm", ".mmmm."]);
    }),
    glow: mod((g) => { fill(g, 22, 22, 4, 4, "Y"); fill(g, 38, 22, 4, 4, "Y"); px(g, 23, 23, "W"); px(g, 39, 23, "W"); }),
    glowF: mod((g) => {
      fill(g, 22, 22, 4, 4, "F"); fill(g, 38, 22, 4, 4, "F");
      px(g, 23, 23, "Y"); px(g, 39, 23, "Y");
      stamp(g, 28, 28, [".RRRRRR.", "RWWWWWWR", ".RRRRRR."]);
    }),
    glowC: mod((g) => { fill(g, 22, 22, 4, 4, "C"); fill(g, 38, 22, 4, 4, "C"); px(g, 23, 23, "W"); px(g, 39, 23, "W"); }),
    glowV: mod((g) => { fill(g, 22, 22, 4, 4, "V"); fill(g, 38, 22, 4, 4, "V"); px(g, 23, 23, "W"); px(g, 39, 23, "W"); }),
    glowM: mod((g) => { fill(g, 22, 22, 4, 4, "M"); fill(g, 38, 22, 4, 4, "M"); px(g, 23, 23, "W"); px(g, 39, 23, "W"); }),
    glowR: mod((g) => { fill(g, 22, 22, 4, 4, "R"); fill(g, 38, 22, 4, 4, "R"); px(g, 23, 23, "Y"); px(g, 39, 23, "Y"); }),
    shock: mod((g) => {
      clearEyes(g);
      stamp(g, 22, 22, ["WWWW", "WEEW", "WEEW", "WWWW"]);
      stamp(g, 38, 22, ["WWWW", "WEEW", "WEEW", "WWWW"]);
      stamp(g, 29, 28, [".OOOO.", "ORRRRO", "ORRRRO", ".OOOO."]);
    }),
    dizzy: mod((g) => {
      clearEyes(g);
      stamp(g, 22, 22, ["E..E", ".EE.", ".EE.", "E..E"]);
      stamp(g, 38, 22, ["E..E", ".EE.", ".EE.", "E..E"]);
      stamp(g, 29, 29, ["m.mm.m"]);
    }),
    shout: mod((g) => {
      stamp(g, 28, 28, [".RRRRRR.", "RWWWWWWR", "RRRRRRRR", "..RRRR.."]);
    }),
    flash: mod((g) => {
      // Classic Gintama blinding white reflection bar across eyes/glasses!
      fill(g, 20, 22, 24, 3, "W");
      fill(g, 22, 25, 20, 1, "c");
    }),
  };
  if (spec.hatFn) {
    parts.hatless = drawBaseHead64({ ...spec, hatFn: null });
    parts.hatlessShock = (() => {
      const c = clone(parts.hatless);
      clearEyes(c);
      stamp(c, 22, 22, ["WWWW", "WEEW", "WEEW", "WWWW"]);
      stamp(c, 38, 22, ["WWWW", "WEEW", "WEEW", "WWWW"]);
      stamp(c, 29, 28, [".OOOO.", "ORRRRO", "ORRRRO", ".OOOO."]);
      return c;
    })();
  }
  if (spec.extraHeads) Object.assign(parts, spec.extraHeads(normal, mod));
  return parts;
}

/** Build native 64×64 detailed occupation torso with 5 smooth lean variants (normal, leanL1, leanL, leanR1, leanR). */
export function buildTorsoParts(coat = "hoodie", extraTorso) {
  const g = blank();
  fill(g, 28, 33, 8, 3, "s"); // neck

  if (coat === "hoodie") {
    fill(g, 20, 36, 24, 14, "A"); fill(g, 20, 36, 6, 4, "a"); fill(g, 38, 40, 6, 10, "d"); fill(g, 20, 48, 24, 2, "d");
    fill(g, 28, 37, 2, 5, "W"); fill(g, 34, 37, 2, 5, "W");
    fill(g, 24, 44, 16, 4, "d"); fill(g, 26, 44, 12, 2, "A");
  } else if (coat === "labcoat") {
    fill(g, 20, 36, 24, 14, "W"); fill(g, 26, 36, 12, 14, "A"); fill(g, 26, 36, 4, 4, "a");
    fill(g, 20, 46, 6, 4, "w"); fill(g, 38, 46, 6, 4, "w");
    fill(g, 21, 42, 4, 1, "w"); fill(g, 39, 42, 4, 1, "w"); // pockets
  } else if (coat === "chef") {
    fill(g, 20, 36, 24, 14, "W"); fill(g, 38, 40, 6, 10, "w"); fill(g, 20, 48, 24, 2, "w");
    stamp(g, 26, 34, ["..aaaaaaaa..", "aaAAAAAAAAdd", "..AAAAdddd..", "....AAdd...."]);
    fill(g, 27, 40, 2, 2, "g"); fill(g, 35, 40, 2, 2, "g");
    fill(g, 27, 44, 2, 2, "g"); fill(g, 35, 44, 2, 2, "g");
  } else if (coat === "apron") {
    fill(g, 20, 36, 24, 14, "W"); fill(g, 24, 36, 16, 14, "A"); fill(g, 24, 36, 4, 4, "a");
    fill(g, 36, 40, 4, 10, "d"); fill(g, 20, 46, 4, 4, "w"); fill(g, 40, 46, 4, 4, "w");
    fill(g, 27, 44, 10, 3, "d"); fill(g, 28, 44, 8, 2, "a"); // front pocket
  } else if (coat === "cafe") {
    fill(g, 20, 36, 24, 14, "W"); fill(g, 24, 38, 16, 12, "B");
    fill(g, 24, 36, 2, 4, "B"); fill(g, 38, 36, 2, 4, "B");
    fill(g, 28, 42, 8, 4, "A"); fill(g, 29, 43, 6, 2, "a"); fill(g, 36, 40, 4, 10, "K");
  } else if (coat === "trench") {
    fill(g, 20, 36, 24, 14, "b"); fill(g, 28, 36, 8, 6, "W"); fill(g, 30, 36, 4, 8, "A");
    fill(g, 20, 44, 24, 2, "B"); fill(g, 30, 44, 4, 2, "Y"); fill(g, 38, 40, 6, 10, "B");
  } else if (coat === "fire") {
    fill(g, 20, 36, 24, 14, "A"); fill(g, 38, 40, 6, 10, "d");
    fill(g, 20, 40, 24, 2, "Y"); fill(g, 20, 46, 24, 2, "Y"); fill(g, 30, 36, 4, 14, "g");
  } else if (coat === "vest") {
    fill(g, 20, 36, 24, 14, "W"); fill(g, 22, 36, 20, 14, "A");
    fill(g, 28, 36, 8, 4, "W"); fill(g, 30, 38, 4, 2, "d"); fill(g, 38, 40, 4, 10, "d");
  } else if (coat === "overalls") {
    fill(g, 20, 36, 24, 14, "W"); fill(g, 22, 40, 20, 10, "A");
    fill(g, 24, 36, 4, 4, "A"); fill(g, 36, 36, 4, 4, "A");
    fill(g, 25, 40, 2, 2, "Y"); fill(g, 37, 40, 2, 2, "Y"); fill(g, 28, 44, 8, 4, "d");
  } else if (coat === "robe") {
    fill(g, 18, 36, 28, 16, "A"); fill(g, 18, 36, 6, 4, "a"); fill(g, 40, 40, 6, 12, "d");
    fill(g, 28, 36, 8, 16, "d"); fill(g, 30, 40, 4, 2, "Y"); fill(g, 30, 44, 4, 2, "Y"); fill(g, 30, 48, 4, 2, "Y");
  } else if (coat === "jersey") {
    fill(g, 20, 36, 24, 14, "A"); fill(g, 20, 36, 6, 4, "a"); fill(g, 38, 40, 6, 10, "d");
    fill(g, 27, 36, 10, 2, "W"); stamp(g, 28, 40, ["WWWWWWWW", "..WWWW..", "..WWWW..", "..WWWW..", "..WWWW.."]);
  } else if (coat === "pilot") {
    fill(g, 20, 36, 24, 14, "A"); fill(g, 20, 36, 6, 2, "Y"); fill(g, 38, 36, 6, 2, "Y");
    fill(g, 28, 36, 8, 8, "W"); fill(g, 30, 36, 4, 8, "O"); fill(g, 38, 40, 6, 10, "d");
    fill(g, 23, 40, 4, 2, "Y");
  } else if (coat === "ninja") {
    fill(g, 20, 36, 24, 14, "N"); fill(g, 38, 40, 6, 10, "O");
    stamp2x(g, 12, 19, ["aA....Aa", "..aAAa..", "....AA.."], false);
    fill(g, 20, 46, 24, 2, "A");
  } else if (coat === "spacesuit") {
    fill(g, 18, 34, 28, 18, "W"); fill(g, 40, 38, 6, 14, "w");
    fill(g, 22, 34, 20, 4, "A");
    fill(g, 26, 40, 12, 6, "g"); fill(g, 28, 42, 2, 2, "R"); fill(g, 32, 42, 2, 2, "V"); fill(g, 35, 42, 2, 2, "C");
    fill(g, 18, 48, 28, 4, "A");
  } else {
    fill(g, 20, 36, 24, 14, "A"); fill(g, 20, 36, 6, 4, "a"); fill(g, 28, 36, 8, 14, "W"); fill(g, 38, 40, 6, 10, "d");
  }

  if (extraTorso) extraTorso(g);

  const makeLean = (dir, mag) => {
    const out = blank();
    for (let y = 33; y <= 51; y++) {
      const shift = y <= 41 ? dir * mag : y <= 45 ? dir * Math.trunc(mag / 2) : 0;
      for (let x = 0; x < PIXEL_GRID_SIZE; x++) {
        if (g[y][x] !== ".") px(out, x + shift, y, g[y][x]);
      }
    }
    return out;
  };
  return {
    normal: g,
    leanL1: makeLean(-1, 1),
    leanL: makeLean(-1, 2),
    leanR1: makeLean(1, 1),
    leanR: makeLean(1, 2),
  };
}

/**
 * Build 10 articulated 64×64 left-arm poses & 11 right-arm poses with smooth intermediate arc angles!
 * Arc order: back ↔ down ↔ lowOut ↔ mid ↔ highOut ↔ up; down ↔ forwardLow ↔ forward ↔ forwardHigh ↔ salute.
 */
export function buildArmParts({ sleeveL = "A", sleeveR = "d", hand = "S", cuff = null } = {}) {
  const drawLimb = (g, segments, s, h) => {
    for (const [x, y, w, hh, col] of segments) fill(g, x, y, w, hh, col === "s" ? s : col === "h" ? h : col);
  };
  const mkL = (segs) => { const g = blank(); drawLimb(g, segs, sleeveL, hand); return g; };
  const mkR = (segs) => { const g = blank(); drawLimb(g, segs, sleeveR, hand); return g; };
  const cL = cuff ? [[16, 42, 4, 2, cuff]] : [];
  const cR = cuff ? [[44, 42, 4, 2, cuff]] : [];

  const armL = {
    back: mkL([[15, 36, 5, 4, "s"], [13, 40, 4, 5, "s"], [11, 44, 4, 4, "h"]]),
    down: mkL([[16, 36, 4, 8, "s"], ...cL, [16, 44, 4, 4, "h"]]),
    lowOut: mkL([[15, 36, 5, 4, "s"], [12, 39, 5, 4, "s"], [10, 42, 4, 4, "h"]]),
    mid: mkL([[12, 36, 8, 4, "s"], [8, 36, 4, 4, "h"]]),
    highOut: mkL([[15, 34, 5, 4, "s"], [12, 30, 4, 5, "s"], [9, 27, 4, 4, "h"]]),
    up: mkL([[14, 34, 6, 4, "s"], [12, 28, 4, 6, "s"], [12, 24, 4, 4, "h"]]),
    forwardLow: mkL([[16, 36, 4, 5, "s"], [18, 40, 4, 4, "s"], [20, 43, 4, 4, "h"]]),
    forward: mkL([[16, 36, 4, 6, "s"], [18, 40, 6, 4, "s"], [22, 41, 4, 4, "h"]]),
    forwardHigh: mkL([[16, 36, 4, 5, "s"], [18, 37, 5, 4, "s"], [21, 35, 4, 4, "h"]]),
    flex: mkL([[14, 36, 6, 4, "s"], [10, 32, 4, 6, "s"], [10, 28, 4, 4, "h"]]),
  };

  const armR = {
    back: mkR([[44, 36, 5, 4, "s"], [47, 40, 4, 5, "s"], [49, 44, 4, 4, "h"]]),
    down: mkR([[44, 36, 4, 8, "s"], ...cR, [44, 44, 4, 4, "h"]]),
    lowOut: mkR([[44, 36, 5, 4, "s"], [47, 39, 5, 4, "s"], [50, 42, 4, 4, "h"]]),
    mid: mkR([[44, 36, 8, 4, "s"], [52, 36, 4, 4, "h"]]),
    highOut: mkR([[44, 34, 5, 4, "s"], [48, 30, 4, 5, "s"], [51, 27, 4, 4, "h"]]),
    up: mkR([[44, 34, 6, 4, "s"], [48, 28, 4, 6, "s"], [48, 24, 4, 4, "h"]]),
    forwardLow: mkR([[44, 36, 4, 5, "s"], [42, 40, 4, 4, "s"], [40, 43, 4, 4, "h"]]),
    forward: mkR([[44, 36, 4, 6, "s"], [40, 40, 6, 4, "s"], [38, 41, 4, 4, "h"]]),
    forwardHigh: mkR([[44, 36, 4, 5, "s"], [41, 37, 5, 4, "s"], [39, 35, 4, 4, "h"]]),
    flex: mkR([[44, 36, 6, 4, "s"], [50, 32, 4, 6, "s"], [50, 28, 4, 4, "h"]]),
    salute: mkR([[44, 36, 6, 4, "s"], [48, 28, 4, 8, "s"], [44, 22, 6, 6, "h"]]),
  };

  return { armL, armR };
}

/** Build 8 articulated 64×64 leg+boot variants per side (with intermediate halfStep/halfWide/halfCrouch). */
export function buildLegParts({ legs = "pants", boots = "dark", pants = "N", pantsHi = "n" } = {}) {
  const bMain = boots === "white" ? "W" : boots === "brown" ? "B" : boots === "space" ? "W" : "g";
  const bSole = boots === "white" ? "w" : boots === "space" ? "g" : "O";
  const drawLeg = (g, x, y, h, footDx, isLeft) => {
    if (legs === "shorts") {
      fill(g, x, y, 8, 2, pants);
      fill(g, x, y + 2, 8, Math.max(2, h - 2), isLeft ? "S" : "s");
    } else {
      fill(g, x, y, 8, h, pants);
      if (isLeft) fill(g, x, y, 4, h, pantsHi);
    }
    fill(g, x + footDx, y + h, 8, 2, bMain);
    fill(g, x + footDx + (isLeft ? -2 : 0), y + h + 2, 10, 2, bSole);
  };
  const mk = (fn) => { const g = blank(); fn(g); return g; };
  const legL = {
    stand: mk((g) => drawLeg(g, 22, 50, 4, 0, true)),
    halfStep: mk((g) => drawLeg(g, 21, 49, 3, -1, true)),
    step: mk((g) => drawLeg(g, 20, 48, 2, -2, true)),
    kick: mk((g) => drawLeg(g, 16, 47, 2, -2, true)),
    halfWide: mk((g) => drawLeg(g, 20, 50, 4, -1, true)),
    wide: mk((g) => drawLeg(g, 18, 50, 4, -2, true)),
    halfCrouch: mk((g) => drawLeg(g, 21, 51, 3, 0, true)),
    crouch: mk((g) => drawLeg(g, 20, 52, 2, 0, true)),
  };
  const legR = {
    stand: mk((g) => drawLeg(g, 34, 50, 4, 0, false)),
    halfStep: mk((g) => drawLeg(g, 35, 49, 3, 1, false)),
    step: mk((g) => drawLeg(g, 36, 48, 2, 2, false)),
    kick: mk((g) => drawLeg(g, 40, 47, 2, 2, false)),
    halfWide: mk((g) => drawLeg(g, 36, 50, 4, 1, false)),
    wide: mk((g) => drawLeg(g, 38, 50, 4, 2, false)),
    halfCrouch: mk((g) => drawLeg(g, 35, 51, 3, 0, false)),
    crouch: mk((g) => drawLeg(g, 36, 52, 2, 0, false)),
  };
  return { legL, legR };
}

/** Build a complete 7-part native 64×64 multi-angle (front / side / back) skeletal rig for a citizen. */
export function buildCharacterRig(spec) {
  const sleeveMap = {
    hoodie: ["A", "d"], labcoat: ["W", "w"], chef: ["W", "w"], apron: ["W", "w"],
    cafe: ["W", "w"], trench: ["b", "B"], fire: ["A", "d"], vest: ["W", "w"],
    overalls: ["W", "w"], robe: ["A", "d"], jersey: ["S", "s"], pilot: ["A", "d"],
    ninja: ["N", "O"], spacesuit: ["W", "w"], jacket: ["A", "d"],
  };
  const [sleeveL, sleeveR] = spec.sleeves || sleeveMap[spec.coat || "hoodie"] || ["A", "d"];
  const cuff = spec.coat === "fire" || spec.coat === "pilot" ? "Y" : null;
  const hand = spec.coat === "spacesuit" ? "W" : "S";
  const armOpts = { sleeveL, sleeveR, hand, cuff };
  const legOpts = {
    legs: spec.legs || "pants",
    boots: spec.boots || (spec.coat === "spacesuit" ? "space" : "dark"),
    pants: spec.coat === "spacesuit" ? "W" : "N",
    pantsHi: spec.coat === "spacesuit" ? "W" : "n",
  };

  // Front-facing 7 parts
  const head = buildHeadParts(spec);
  const torso = buildTorsoParts(spec.coat, spec.extraTorso);
  const { armL, armR } = buildArmParts(armOpts);
  const { legL, legR } = buildLegParts(legOpts);
  const angleProps = buildAngleProps(spec.props || {}, spec.sideProps || {}, spec.backProps || {});
  const prop = angleProps.front;

  // Side-profile & Rear-view 7 parts (guaranteeing full variant parity with front)
  const sideHead = buildSideHeadParts(spec);
  const backHead = buildBackHeadParts(spec);
  for (const key of Object.keys(head)) {
    if (!sideHead[key]) sideHead[key] = clone(sideHead.normal);
    if (!backHead[key]) backHead[key] = clone(backHead.normal);
  }
  const sideTorso = buildSideTorsoParts(spec.coat, spec.torsoDetail);
  const backTorso = buildBackTorsoParts(spec.coat, spec.torsoDetail);
  const { armL: sideArmL, armR: sideArmR } = buildSideArmParts(armOpts);
  const { armL: backArmL, armR: backArmR } = buildBackArmParts(armOpts);
  const { legL: sideLegL, legR: sideLegR } = buildSideLegParts(legOpts);
  const { legL: backLegL, legR: backLegR } = buildBackLegParts(legOpts);

  const front = { head, torso, armL, armR, legL, legR, prop };
  const side = { head: sideHead, torso: sideTorso, armL: sideArmL, armR: sideArmR, legL: sideLegL, legR: sideLegR, prop: angleProps.side };
  const back = { head: backHead, torso: backTorso, armL: backArmL, armR: backArmR, legL: backLegL, legR: backLegR, prop: angleProps.back };

  return { head, torso, armL, armR, legL, legR, prop, angles: { front, side, back } };
}

// ============================================================================
// Keyframe Normalization & Smooth Joint-Arc Interpolation (12–20 Frames/Clip)
// ============================================================================

const DEFAULT_PART_VARIANTS = {
  head: "normal", torso: "normal", armL: "down", armR: "down", legL: "stand", legR: "stand", prop: "default",
};

function normPart(partName, input, defaultVisible = true) {
  if (input === false || input === null) {
    return { dx: 0, dy: 0, variant: DEFAULT_PART_VARIANTS[partName], flip: false, visible: false };
  }
  if (typeof input === "string") {
    return { dx: 0, dy: 0, variant: input, flip: false, visible: true };
  }
  const obj = input || {};
  return {
    dx: obj.dx ?? 0,
    dy: obj.dy ?? 0,
    variant: obj.variant ?? DEFAULT_PART_VARIANTS[partName],
    flip: !!obj.flip,
    visible: obj.visible ?? defaultVisible,
  };
}

const VALID_ANGLES = new Set(RIG_ANGLES);
const EXPLICIT_ANGLE = new WeakSet();
const EXPLICIT_FACING = new WeakSet();

/**
 * Create one normalized 64×64 skeletal keyframe covering all 7 parts + perspective (`angle`, `facing`).
 * Note: `dx`/`dy` in `kf(...)` are accepted in 32-unit convenience coordinates (auto-scaled ×2 to 64×64)
 * unless `extras.native64 === true`, so hand-authored beats & interpolated sub-steps align cleanly!
 */
export function kf(parts = {}, extras = {}) {
  const s = extras.native64 ? 1 : 2;
  const scalePart = (name, val) => {
    const p = normPart(name, val);
    return { dx: Math.round(p.dx * s), dy: Math.round(p.dy * s), variant: p.variant, flip: p.flip, visible: p.visible };
  };
  const angle = VALID_ANGLES.has(extras.angle) ? extras.angle : "front";
  const facing = extras.facing === "left" ? "left" : "right";
  const frame = {
    head: scalePart("head", parts.head),
    torso: scalePart("torso", parts.torso),
    armL: scalePart("armL", parts.armL),
    armR: scalePart("armR", parts.armR),
    legL: scalePart("legL", parts.legL),
    legR: scalePart("legR", parts.legR),
    prop: scalePart("prop", parts.prop),
    angle,
    facing,
    shadow: extras.shadow ?? "keep",
    propZ: extras.propZ ?? "front",
  };
  if (extras.angle !== undefined) EXPLICIT_ANGLE.add(frame);
  if (extras.facing !== undefined) EXPLICIT_FACING.add(frame);
  if (extras.fx) {
    frame.fx = extras.native64 ? extras.fx : extras.fx.map(([ox, oy, lines]) => [ox * 2, oy * 2, lines, true]);
  }
  if (extras.afterimage) {
    const list = Array.isArray(extras.afterimage) ? extras.afterimage : [extras.afterimage];
    frame.afterimage = list.map((a) => ({ dx: Math.round((a.dx ?? 0) * s), dy: Math.round((a.dy ?? 0) * s), tint: a.tint ?? "c" }));
  }
  if (extras.petrify) frame.petrify = true;
  if (extras.scale) frame.scale = extras.scale;
  return frame;
}

// Anatomical joint-arc transition graphs (BFS shortest path between any two limb variants!)
const ARM_GRAPH = {
  back: ["down"],
  down: ["back", "lowOut", "forwardLow"],
  lowOut: ["down", "mid"],
  mid: ["lowOut", "highOut", "flex", "forward"],
  highOut: ["mid", "up", "forwardHigh"],
  up: ["highOut", "salute"],
  forwardLow: ["down", "forward"],
  forward: ["forwardLow", "forwardHigh", "mid"],
  forwardHigh: ["forward", "highOut", "salute"],
  flex: ["mid", "highOut"],
  salute: ["forwardHigh", "up"],
};

const LEG_GRAPH = {
  stand: ["halfStep", "halfWide", "halfCrouch"],
  halfStep: ["stand", "step"],
  step: ["halfStep", "kick"],
  kick: ["step"],
  halfWide: ["stand", "wide", "halfCrouch"],
  wide: ["halfWide", "crouch"],
  halfCrouch: ["stand", "crouch", "halfWide"],
  crouch: ["halfCrouch", "wide"],
};

const TORSO_GRAPH = {
  leanL: ["leanL1"],
  leanL1: ["leanL", "normal"],
  normal: ["leanL1", "leanR1"],
  leanR1: ["normal", "leanR"],
  leanR: ["leanR1"],
};

const pathCache = new Map();

function shortestArc(graph, from, to) {
  if (from === to || !graph[from] || !graph[to]) return [from, to];
  const key = `${from}>${to}`;
  if (pathCache.has(key)) return pathCache.get(key);
  const queue = [[from]], seen = new Set([from]);
  while (queue.length) {
    const path = queue.shift();
    const last = path[path.length - 1];
    if (last === to) { pathCache.set(key, path); return path; }
    for (const nxt of graph[last] || []) {
      if (!seen.has(nxt)) { seen.add(nxt); queue.push([...path, nxt]); }
    }
  }
  return [from, to];
}

function pickArcVariant(partName, fromV, toV, t) {
  if (fromV === toV) return fromV;
  const graph = partName === "armL" || partName === "armR" ? ARM_GRAPH
    : partName === "legL" || partName === "legR" ? LEG_GRAPH
    : partName === "torso" ? TORSO_GRAPH : null;
  if (!graph) return t < 0.55 ? fromV : toV;
  const path = shortestArc(graph, fromV, toV);
  const idx = Math.min(path.length - 1, Math.floor(t * path.length));
  return path[idx];
}

/** Smooth cubic ease-in-out for natural acceleration & deceleration across joint arcs. */
function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

/** Interpolate viewing perspective smoothly: 180° turns (front↔back) pass through side; left↔right side flips pass through front! */
function pickTurnAngle(a, b, t) {
  const aa = a.angle || "front", ba = b.angle || "front";
  const af = a.facing || "right", bf = b.facing || "right";
  if (aa === ba) {
    if (aa === "side" && af !== bf) {
      if (t >= 0.30 && t < 0.72) return { angle: "front", facing: "right" };
      return { angle: "side", facing: t < 0.5 ? af : bf };
    }
    return { angle: aa, facing: t < 0.5 ? af : bf };
  }
  if ((aa === "front" && ba === "back") || (aa === "back" && ba === "front")) {
    if (t < 0.30) return { angle: aa, facing: af };
    if (t < 0.72) return { angle: "side", facing: bf };
    return { angle: ba, facing: bf };
  }
  return { angle: t < 0.5 ? aa : ba, facing: t < 0.5 ? af : bf };
}

/** Create one interpolated intermediate 64×64 keyframe between keyframe `a` and keyframe `b` at progress `t ∈ (0, 1)`. */
function tweenKeyframe(a, b, t) {
  const e = easeInOut(t);
  const turn = pickTurnAngle(a, b, t);
  const out = {
    angle: turn.angle,
    facing: turn.facing,
    shadow: t < 0.5 ? a.shadow : b.shadow,
    propZ: t < 0.5 ? a.propZ : b.propZ,
  };
  for (const part of RIG_PARTS) {
    const pa = a[part], pb = b[part];
    const visible = pa.visible && pb.visible ? true : (t < 0.5 ? pa.visible : pb.visible);
    const variant = !visible
      ? (t < 0.5 ? pa.variant : pb.variant)
      : (!pa.visible ? pb.variant : !pb.visible ? pa.variant : pickArcVariant(part, pa.variant, pb.variant, t));
    out[part] = {
      dx: Math.round(pa.dx + (pb.dx - pa.dx) * e),
      dy: Math.round(pa.dy + (pb.dy - pa.dy) * e),
      variant,
      flip: t < 0.5 ? pa.flip : pb.flip,
      visible,
    };
  }
  if (a.petrify && b.petrify) out.petrify = true;
  else if (a.petrify || b.petrify) out.petrify = t < 0.5 ? !!a.petrify : !!b.petrify;
  if (a.scale || b.scale) {
    const sa = a.scale ?? 1, sb = b.scale ?? 1;
    const sc = sa + (sb - sa) * e;
    if (sc < 0.98) out.scale = Math.round(sc * 100) / 100;
  }
  // Interpolate articulated afterimages smoothly too!
  if (a.afterimage || b.afterimage) {
    const src = t < 0.5 ? (a.afterimage || b.afterimage) : (b.afterimage || a.afterimage);
    const scaleA = a.afterimage && b.afterimage ? 1 : (t < 0.5 ? 0.7 : 0.85);
    out.afterimage = src.map((g) => ({ dx: Math.round(g.dx * scaleA), dy: Math.round(g.dy * scaleA), tint: g.tint }));
  }
  // Carry luminous FX with gentle sinusoidal shimmer across multi-frame transitions!
  const fxSrc = t < 0.5 ? a.fx : b.fx;
  if (fxSrc) {
    const driftY = Math.round(Math.sin(t * Math.PI * 2) * -1.4);
    out.fx = fxSrc.map(([ox, oy, lines, is2x]) => [ox, oy + driftY, lines, is2x]);
  }
  return out;
}

/**
 * Expand a rich multi-beat story (6–8 story beats) into a crisp, natural-speed **20–30 frame / 3–6s** clip!
 * Automatically inserts:
 *   - Smooth anatomical joint-arc transitions (`lowOut`/`highOut`, `halfStep`/`halfWide`, `leanL1`/`leanR1`)
 *   - Extra transition frames on multi-angle 3D turns (`front ↔ side ↔ back`, `left ↔ right`)
 *   - Natural pixel-art pacing (crisp ~100–145ms transitions, expressive ~140–270ms story beats — never slow-motion!)
 */
export function clip(id, name, beatDurations, beats, options = {}) {
  if (beats.length < 4) throw Error(`Clip ${id} needs at least 4 story beats`);
  if (beatDurations.length !== beats.length) throw Error(`Clip ${id} durations length mismatch`);

  // Apply clip-level default angle / facing to any beats that didn't explicitly override them
  const defaultAngle = VALID_ANGLES.has(options.angle) ? options.angle : null;
  const defaultFacing = options.facing === "left" || options.facing === "right" ? options.facing : null;
  const resolvedBeats = (defaultAngle || defaultFacing)
    ? beats.map((b) => ({
      ...b,
      angle: EXPLICIT_ANGLE.has(b) ? b.angle : (defaultAngle ?? b.angle),
      facing: EXPLICIT_FACING.has(b) ? b.facing : (defaultFacing ?? b.facing),
    }))
    : beats;

  // Target 22–30 smooth keyframes naturally proportional to the number of story beats (6→24f, 7→27f, 8→30f)
  const segments = resolvedBeats.length;
  const defaultFrames = segments <= 5 ? 22 : segments === 6 ? 24 : segments === 7 ? 27 : 30;
  const desired = options.targetFrames ?? defaultFrames;
  const totalInBetweens = Math.max(20 - segments, Math.min(30 - segments, desired - segments));

  // Allocate extra transition frames to segments that rotate camera perspective (`angle`/`facing` turns)
  const segWeights = [];
  for (let i = 0; i < segments; i++) {
    const curr = resolvedBeats[i], next = resolvedBeats[(i + 1) % segments];
    const hasTurn = curr.angle !== next.angle || curr.facing !== next.facing;
    segWeights.push(1 + (hasTurn ? 0.45 : 0) + (i === segments - 1 ? 0.1 : 0));
  }
  const weightSum = segWeights.reduce((a, b) => a + b, 0);
  const segTweens = segWeights.map((w) => Math.max(2, Math.floor((w / weightSum) * totalInBetweens)));
  let diff = totalInBetweens - segTweens.reduce((a, b) => a + b, 0);
  for (let pass = 0; diff > 0; pass++) {
    const order = segWeights.map((w, idx) => ({ w, idx })).sort((a, b) => b.w - a.w);
    const pick = order[pass % order.length].idx;
    segTweens[pick]++;
    diff--;
  }
  while (diff < 0) {
    const idx = segTweens.findIndex((c) => c > 2);
    if (idx < 0) break;
    segTweens[idx]--;
    diff++;
  }

  // Natural crisp pixel-animation timing: anticipation & climax hold slightly longer, action hits stay snappy!
  const climaxIdx = segments >= 6 ? Math.floor(segments * 0.55) : Math.max(2, segments - 2);
  const keyframes = [];
  const rawDurations = [];

  for (let i = 0; i < segments; i++) {
    const curr = resolvedBeats[i];
    const next = resolvedBeats[(i + 1) % segments];
    const tweens = segTweens[i];
    const hasTurn = curr.angle !== next.angle || curr.facing !== next.facing;

    const phaseMul = i === 0 ? 1.24 : i === climaxIdx ? 1.32 : i === segments - 1 ? 1.20 : 1.04;
    const beatMs = Math.max(130, Math.min(275, Math.round(beatDurations[i] * phaseMul)));
    keyframes.push(curr);
    rawDurations.push(beatMs);

    // Crisp ~8–10 fps motion frames (never sluggish; slightly steadier on 3D perspective turns)
    const baseTweenMs = Math.max(95, Math.min(148, Math.round(beatDurations[i] * (hasTurn ? 0.78 : 0.70))));
    for (let step = 1; step <= tweens; step++) {
      const t = step / (tweens + 1);
      keyframes.push(tweenKeyframe(curr, next, t));
      rawDurations.push(baseTweenMs);
    }
  }

  // Soft bounds into 3.0–6.0s (3050–5850ms) preserving natural speed & per-clip tempo personality!
  const rawTotal = rawDurations.reduce((a, b) => a + b, 0);
  const scale = rawTotal < 3060 ? 3120 / rawTotal : rawTotal > 5850 ? 5800 / rawTotal : 1;
  const durations = rawDurations.map((ms) => Math.max(90, Math.min(300, Math.round(ms * scale))));

  if (keyframes.length < 20 || keyframes.length > 30) {
    throw Error(`Clip ${id} expanded to ${keyframes.length} frames, expected 20–30`);
  }
  return { id, name, durations, keyframes, beatCount: resolvedBeats.length };
}

// ============================================================================
// 64×64 Articulated Skeletal Compositor & SVG Path Compiler
// ============================================================================

const FORWARD_ARMS = new Set(["forward", "forwardLow", "forwardHigh"]);

/**
 * Compose a 64×64 pixel matrix from a character's 7-part multi-angle skeletal rig and one keyframe.
 * Supports front, side (with facing left/right flip), and back perspectives with angle-accurate Z-order,
 * delicate 1px 64×64 outlining, articulated afterimages, and crisp un-outlined FX.
 */
export function composeKeyframe(rig, keyframe) {
  const angle = VALID_ANGLES.has(keyframe.angle) ? keyframe.angle : "front";
  const facingLeft = keyframe.facing === "left";
  const angleRig = (rig.angles && rig.angles[angle]) || rig;
  const body = blank();
  const draw = (partName) => {
    const t = keyframe[partName];
    if (!t || !t.visible) return;
    const dict = angleRig[partName] || rig[partName];
    if (!dict) return;
    const mat = dict[t.variant] || (partName !== "prop" ? dict[DEFAULT_PART_VARIANTS[partName]] : null);
    if (mat) blitPart(body, mat, t.dx, t.dy, !!t.flip !== facingLeft);
  };

  if (angle === "side") {
    // Side-profile 2.5D depth Z-order: back-prop → far armL → far legL → near legR → torso → head → near armR → front-prop
    if (keyframe.propZ === "back") draw("prop");
    draw("armL");
    draw("legL");
    draw("legR");
    draw("torso");
    draw("head");
    draw("armR");
    if (keyframe.propZ !== "back") draw("prop");
  } else if (angle === "back") {
    // Back-view Z-order: back-prop → forward arms (tucked behind chest!) → legs → torso → side/up arms → head (hair over shoulders!) → front-prop
    if (keyframe.propZ === "back") draw("prop");
    if (FORWARD_ARMS.has(keyframe.armL.variant)) draw("armL");
    if (FORWARD_ARMS.has(keyframe.armR.variant)) draw("armR");
    draw("legL");
    draw("legR");
    draw("torso");
    if (!FORWARD_ARMS.has(keyframe.armL.variant)) draw("armL");
    if (!FORWARD_ARMS.has(keyframe.armR.variant)) draw("armR");
    draw("head");
    if (keyframe.propZ !== "back") draw("prop");
  } else {
    // Front-view Z-order: back-prop → legs → torso → side/up/back arms → head → forward arms → front-prop
    if (keyframe.propZ === "back") draw("prop");
    draw("legL");
    draw("legR");
    draw("torso");
    if (!FORWARD_ARMS.has(keyframe.armL.variant)) draw("armL");
    if (!FORWARD_ARMS.has(keyframe.armR.variant)) draw("armR");
    draw("head");
    if (FORWARD_ARMS.has(keyframe.armL.variant)) draw("armL");
    if (FORWARD_ARMS.has(keyframe.armR.variant)) draw("armR");
    if (keyframe.propZ !== "back") draw("prop");
  }

  let processed = body;
  if (keyframe.petrify) processed = petrifyMatrix(processed);
  if (keyframe.scale && keyframe.scale < 1) processed = scaleMatrix(processed, keyframe.scale);

  const composed = outline(processed);

  if (keyframe.afterimage) {
    const list = Array.isArray(keyframe.afterimage) ? keyframe.afterimage : [keyframe.afterimage];
    for (const ghost of list) {
      blitAfterimage(composed, processed, ghost.dx ?? 0, ghost.dy ?? 0, ghost.tint ?? "c");
    }
  }

  // Tapered 64×64 pixel ground shadow across y=58..59 (slightly sleeker in side profile!)
  const sh = keyframe.shadow ?? "keep";
  const drawShadow = (x0, x1) => {
    for (let x = x0; x < x1; x++) if (composed[58][x] === ".") composed[58][x] = "Z";
    for (let x = x0 + 2; x < x1 - 2; x++) if (composed[59][x] === ".") composed[59][x] = "Z";
  };
  if (sh === "keep") drawShadow(angle === "side" ? 20 : 18, angle === "side" ? 44 : 46);
  else if (sh === "shrink") drawShadow(22, 42);
  else if (sh === "tiny") drawShadow(26, 38);

  // Un-outlined luminous FX particles
  if (keyframe.fx) {
    for (const item of keyframe.fx) {
      const [ox, oy, lines, is2x] = item;
      if (is2x) stamp2xAt64(composed, ox, oy, lines);
      else stamp(composed, ox, oy, lines);
    }
  }
  return composed;
}

/** Compile a 64×64 character matrix into compact horizontal-run SVG paths grouped by color. */
export function compileGrid(matrix, paletteMap) {
  const n = matrix.length, runs = new Map();
  for (let y = 0; y < n; y++) {
    const row = matrix[y];
    let x = 0;
    while (x < n) {
      const ch = row[x];
      if (ch === "." || !paletteMap[ch]) { x++; continue; }
      let end = x + 1;
      while (end < n && row[end] === ch) end++;
      const fillColor = paletteMap[ch];
      const seg = `M${x} ${y}h${end - x}v1h${x - end}z`;
      const existing = runs.get(fillColor);
      if (existing) existing.push(seg);
      else runs.set(fillColor, [seg]);
      x = end;
    }
  }
  const layers = [];
  let index = 0;
  for (const [fillColor, segments] of runs) {
    layers.push({ key: `${index++}-${fillColor}`, fill: fillColor, d: segments.join("") });
  }
  return layers;
}

/** Build a sprite entry with native 64×64 skeletal `rig`, `idleKeyframe`, and 12–20 frame keyframe `animations`. */
export function makeRiggedSprite({ id, name, gender, palette, rig, idleKeyframe, animations }) {
  const idle = idleKeyframe || kf({ prop: rig.prop.default ? "default" : false });
  return {
    id,
    name,
    gender,
    action: animations[0].name,
    actions: animations.map((a) => a.name),
    durations: animations[0].durations,
    rig,
    idleKeyframe: idle,
    animations,
    palette,
  };
}
