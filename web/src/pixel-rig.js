// 32×32 Skeletal Pixel Rig & Keyframe Compositor Engine.
// Each character is split into 7 independent parts:
//   head (hair/hat/face expression), torso, armL, armR, legL, legR, prop.
// Each animation clip stores a table of per-part keyframes { dx, dy, variant, flip, visible }
// so limbs, head, torso and props move with true local articulation instead of whole-body sliding.

export const PIXEL_GRID_SIZE = 32;
export const RIG_PARTS = Object.freeze(["head", "torso", "armL", "armR", "legL", "legR", "prop"]);

/** Mix a #rrggbb color toward white (amount > 0) or black (amount < 0). */
export function shade(hex, amount) {
  const clean = /^#[0-9a-fA-F]{6}$/.test(hex || "") ? hex : "#3878fb";
  const n = parseInt(clean.slice(1), 16), t = amount < 0 ? 0 : 255, k = Math.abs(amount);
  const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.round(v + (t - v) * k));
  return "#" + c.map((v) => v.toString(16).padStart(2, "0")).join("");
}

// ============================================================================
// Low-level 32×32 Grid Primitives
// ============================================================================

export function blank() {
  return Array.from({ length: PIXEL_GRID_SIZE }, () => Array(PIXEL_GRID_SIZE).fill("."));
}

export function clone(src) {
  return src.map((row) => [...row]);
}

export function px(g, x, y, ch) {
  if (x >= 0 && x < PIXEL_GRID_SIZE && y >= 0 && y < PIXEL_GRID_SIZE) g[y][x] = ch;
  return g;
}

export function fill(g, x, y, w, h, ch) {
  for (let r = y; r < y + h; r++) {
    if (r < 0 || r >= PIXEL_GRID_SIZE) continue;
    for (let c = x; c < x + w; c++) {
      if (c >= 0 && c < PIXEL_GRID_SIZE) g[r][c] = ch;
    }
  }
  return g;
}

/** Stamp an ASCII art patch at (ox, oy). `.` keeps existing pixel, `_` erases to transparent. */
export function stamp(target, ox, oy, lines) {
  for (let r = 0; r < lines.length; r++) {
    const y = oy + r;
    if (y < 0 || y >= PIXEL_GRID_SIZE) continue;
    const row = lines[r];
    for (let c = 0; c < row.length; c++) {
      const x = ox + c;
      if (x < 0 || x >= PIXEL_GRID_SIZE) continue;
      const ch = row[c];
      if (ch === ".") continue;
      target[y][x] = ch === "_" ? "." : ch;
    }
  }
  return target;
}

/** Create a 32×32 part sprite from an ASCII patch at (ox, oy). */
export function partPatch(ox, oy, lines) {
  return stamp(blank(), ox, oy, lines);
}

/** Horizontally flip a 32×32 part around the sprite center axis (x ↔ 31 - x). */
export function flipMatrixH(src) {
  const out = blank();
  for (let y = 0; y < PIXEL_GRID_SIZE; y++) {
    for (let x = 0; x < PIXEL_GRID_SIZE; x++) {
      const ch = src[y][x];
      if (ch !== ".") out[y][PIXEL_GRID_SIZE - 1 - x] = ch;
    }
  }
  return out;
}

/** Blit a 32×32 part matrix onto `target` with local offset `(dx, dy)` and optional horizontal flip. */
function blitPart(target, src, dx = 0, dy = 0, flip = false) {
  if (!src) return;
  const mat = flip ? flipMatrixH(src) : src;
  for (let y = 0; y < PIXEL_GRID_SIZE; y++) {
    const ny = y + dy;
    if (ny < 0 || ny >= PIXEL_GRID_SIZE) continue;
    const row = mat[y];
    for (let x = 0; x < PIXEL_GRID_SIZE; x++) {
      const ch = row[x];
      if (ch === ".") continue;
      const nx = x + dx;
      if (nx >= 0 && nx < PIXEL_GRID_SIZE) target[ny][nx] = ch;
    }
  }
}

/** Add a crisp 1px dark-ink silhouette outline around solid body/prop pixels (skipping shadow `Z`). */
export function outline(src, ch = "O") {
  const out = clone(src);
  const solid = (x, y) => {
    if (x < 0 || x >= PIXEL_GRID_SIZE || y < 0 || y >= PIXEL_GRID_SIZE) return false;
    const c = src[y][x];
    return c !== "." && c !== "Z" && c !== ch;
  };
  for (let y = 0; y < PIXEL_GRID_SIZE; y++) {
    for (let x = 0; x < PIXEL_GRID_SIZE; x++) {
      if (src[y][x] !== ".") continue;
      if (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1)) out[y][x] = ch;
    }
  }
  return out;
}

/** Overlay a translucent/tinted silhouette copy of `src` shifted by (dx, dy) BEHIND `target`. */
function blitAfterimage(target, src, dx, dy, tint = "c") {
  for (let y = 0; y < PIXEL_GRID_SIZE; y++) {
    const ny = y + dy;
    if (ny < 0 || ny >= PIXEL_GRID_SIZE) continue;
    for (let x = 0; x < PIXEL_GRID_SIZE; x++) {
      const ch = src[y][x];
      if (ch === "." || ch === "Z") continue;
      const nx = x + dx;
      if (nx >= 0 && nx < PIXEL_GRID_SIZE && target[ny][nx] === ".") target[ny][nx] = tint;
    }
  }
}

/** Gintama-style petrified grayscale despair transform. */
export function petrifyMatrix(src) {
  const map = {
    S: "w", s: "G", P: "w", m: "g", A: "G", a: "w", d: "g", H: "g", h: "G", k: "O",
    N: "g", n: "G", B: "g", b: "G", R: "g", Y: "w", F: "G", C: "w", V: "G", M: "G", U: "g",
  };
  return src.map((row) => row.map((c) => map[c] || c));
}

/** Shrink a 32×32 articulated pose to 50% anchored on the floor (for scientist shrink gag). */
function miniMatrix(src) {
  const out = blank();
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const c = src[y * 2]?.[x * 2];
      if (c && c !== "." && c !== "Z") out[y + 13][x + 8] = c;
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
  O: "#1d2133", E: "#141826", N: "#2c3954", n: "#415273",
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
// Articulated Skeletal Part Builders (head, torso, armL, armR, legL, legR)
// ============================================================================

function drawBaseHead({ gender = "male", hairStyle = "short", eyeStyle, hatFn, beardFn } = {}) {
  const g = blank();
  const isF = gender === "female";

  // Back hair layer
  if (hairStyle === "long") {
    fill(g, 8, 9, 16, 10, "H");
    fill(g, 8, 15, 2, 5, "k"); fill(g, 22, 15, 2, 5, "k");
  } else if (hairStyle === "wavy") {
    fill(g, 7, 9, 18, 9, "H");
    stamp(g, 7, 16, ["HH..............HH", "kH..............Hk", ".k..............k."]);
  } else if (hairStyle === "ponytail") {
    stamp(g, 22, 9, ["HHH.", ".HHH", "..Hk", "..kk", "...k"]);
  } else if (hairStyle === "bob") {
    fill(g, 8, 9, 16, 9, "H");
    fill(g, 8, 16, 2, 2, "k"); fill(g, 22, 16, 2, 2, "k");
  }

  // Face & ears
  fill(g, 10, 9, 12, 7, "S");
  fill(g, 11, 16, 10, 1, "s");
  px(g, 10, 15, "s"); px(g, 21, 15, "s");
  px(g, 9, 12, "S"); px(g, 9, 13, "s");
  px(g, 22, 12, "S"); px(g, 22, 13, "s");

  // Crown & bangs
  if (hairStyle === "spiky") {
    stamp(g, 9, 5, [
      "...H...HH..H..", "..HHHHHHHHHH..", ".HHhhhHHhhhHH.",
      ".HHHHHHHHHHHH.", ".HkkHSSSSSkkH.", ".Hk........kH.",
    ]);
  } else if (hairStyle === "bun") {
    stamp(g, 12, 3, ["..HHHH..", ".HHhhHH.", ".HHHHHH."]);
    stamp(g, 9, 6, [
      "..HHHHHHHHHH..", ".HHhhHHHHhhHH.", ".HHHHHHHHHHHH.",
      ".HkkHHHHHHkkH.", ".Hk........kH.",
    ]);
  } else if (hairStyle === "fluffy") {
    stamp(g, 8, 5, [
      "...HHHHHHHHHH...", ".HHHhhhHHhhhHHH.", ".HHHHHHHHHHHHHH.",
      "HHkHHkHHHHkHHkHH", "Hk............kH",
    ]);
  } else {
    stamp(g, 9, 6, [
      "..HHHHHHHHHH..", ".HHhhhHHhhhHH.", ".HHHHHHHHHHHH.",
      ".HkkHHkHHkHkH.", ".Hk........kH.",
    ]);
  }

  // Default eyes & mouth
  const eStyle = eyeStyle || (isF ? "sparkle" : "crisp");
  if (eStyle === "sparkle") {
    stamp(g, 11, 11, ["WE", "EE", "kE"]); stamp(g, 19, 11, ["WE", "EE", "Ek"]);
    stamp(g, 10, 13, ["P", "P"]); stamp(g, 21, 13, ["P", "P"]);
    stamp(g, 15, 14, ["mm"]);
  } else if (eStyle === "crisp") {
    stamp(g, 11, 10, ["kk"]); stamp(g, 19, 10, ["kk"]);
    stamp(g, 11, 11, ["WE", "EE"]); stamp(g, 19, 11, ["WE", "EE"]);
    stamp(g, 15, 14, ["mm"]);
  } else if (eStyle === "glasses") {
    stamp(g, 10, 10, ["OOOO..OOOO"]);
    stamp(g, 10, 11, ["OWEOOOOWEO", "OEEO..OEEO", "OOOO..OOOO"]);
    stamp(g, 15, 14, ["mm"]);
  } else if (eStyle === "goldglasses") {
    stamp(g, 10, 10, ["YYYY..YYYY"]);
    stamp(g, 10, 11, ["YWEYYYYWEY", "YEEY..YEEY", "YYYY..YYYY"]);
    px(g, 10, 14, "P"); px(g, 21, 14, "P");
    stamp(g, 15, 14, ["mm"]);
  } else if (eStyle === "shades") {
    stamp(g, 10, 11, ["OOOO..OOOO", "OgOO..OOgO", ".OO....OO."]);
    px(g, 10, 14, "P"); px(g, 21, 14, "P");
    stamp(g, 15, 14, ["mm"]);
  }

  if (beardFn) beardFn(g);
  if (hatFn) hatFn(g);
  return g;
}

/** Build the full dictionary of head expression & gag variants for a character. */
export function buildHeadParts(spec) {
  const normal = spec.customHead ? spec.customHead() : drawBaseHead(spec);
  const mod = (fn) => { const c = clone(normal); fn(c); return c; };
  const parts = {
    normal,
    blink: mod((g) => { stamp(g, 11, 11, ["SS", "kk", "SS"]); stamp(g, 19, 11, ["SS", "kk", "SS"]); }),
    happy: mod((g) => { stamp(g, 11, 11, ["EE", "SS", "SS"]); stamp(g, 19, 11, ["EE", "SS", "SS"]); stamp(g, 15, 14, ["mm", "WW"]); }),
    glow: mod((g) => { stamp(g, 11, 11, ["YY", "YY"]); stamp(g, 19, 11, ["YY", "YY"]); }),
    glowF: mod((g) => { stamp(g, 11, 11, ["FF", "FF"]); stamp(g, 19, 11, ["FF", "FF"]); stamp(g, 14, 14, [".RR.", "RWW."]); }),
    glowC: mod((g) => { stamp(g, 11, 11, ["CC", "CC"]); stamp(g, 19, 11, ["CC", "CC"]); }),
    glowV: mod((g) => { stamp(g, 11, 11, ["VV", "VV"]); stamp(g, 19, 11, ["VV", "VV"]); }),
    glowM: mod((g) => { stamp(g, 11, 11, ["MM", "MM"]); stamp(g, 19, 11, ["MM", "MM"]); }),
    glowR: mod((g) => { stamp(g, 11, 11, ["RR", "RR"]); stamp(g, 19, 11, ["RR", "RR"]); }),
    shock: mod((g) => { stamp(g, 11, 11, ["WW", "WE", "WW"]); stamp(g, 19, 11, ["WW", "EW", "WW"]); stamp(g, 15, 14, ["OO", "RR"]); }),
    dizzy: mod((g) => { stamp(g, 11, 11, ["EW", "WE"]); stamp(g, 19, 11, ["WE", "EW"]); stamp(g, 15, 14, ["mm", "SS"]); }),
    shout: mod((g) => { stamp(g, 14, 14, [".RR.", "RWW."]); }),
    flash: mod((g) => { stamp(g, 10, 11, ["WWWWWWWWWWWW", ".WWWWWWWWWW."]); }),
  };
  if (spec.hatFn) {
    // Hatless variant for hilarious hat-popping gags (chef, artist, detective, gardener)
    parts.hatless = drawBaseHead({ ...spec, hatFn: null });
    parts.hatlessShock = (() => {
      const c = clone(parts.hatless);
      stamp(c, 11, 11, ["WW", "WE", "WW"]); stamp(c, 19, 11, ["WW", "EW", "WW"]); stamp(c, 15, 14, ["OO", "RR"]);
      return c;
    })();
  }
  if (spec.extraHeads) Object.assign(parts, spec.extraHeads(normal, mod));
  return parts;
}

/** Build the torso part (with normal + slight lean/crouch variants). */
export function buildTorsoParts(coat = "hoodie", extraTorso) {
  const g = blank();
  fill(g, 14, 17, 4, 1, "s"); // neck

  if (coat === "hoodie") {
    fill(g, 10, 18, 12, 7, "A"); fill(g, 10, 18, 3, 2, "a"); fill(g, 19, 20, 3, 5, "d"); fill(g, 10, 24, 12, 1, "d");
    px(g, 14, 19, "W"); px(g, 14, 20, "W"); px(g, 17, 19, "W"); px(g, 17, 20, "W");
    fill(g, 12, 22, 8, 2, "d"); fill(g, 13, 22, 6, 1, "A");
  } else if (coat === "labcoat") {
    fill(g, 10, 18, 12, 7, "W"); fill(g, 13, 18, 6, 7, "A"); fill(g, 13, 18, 2, 2, "a");
    fill(g, 10, 23, 3, 2, "w"); fill(g, 19, 23, 3, 2, "w");
    px(g, 11, 21, "w"); px(g, 20, 21, "w");
  } else if (coat === "chef") {
    fill(g, 10, 18, 12, 7, "W"); fill(g, 19, 20, 3, 5, "w"); fill(g, 10, 24, 12, 1, "w");
    stamp(g, 13, 17, ["aAAAAd", ".AAd.."]);
    px(g, 14, 20, "g"); px(g, 17, 20, "g"); px(g, 14, 22, "g"); px(g, 17, 22, "g");
  } else if (coat === "apron") {
    fill(g, 10, 18, 12, 7, "W"); fill(g, 12, 18, 8, 7, "A"); fill(g, 12, 18, 2, 2, "a");
    fill(g, 18, 20, 2, 5, "d"); fill(g, 10, 23, 2, 2, "w"); fill(g, 20, 23, 2, 2, "w");
  } else if (coat === "cafe") {
    fill(g, 10, 18, 12, 7, "W"); fill(g, 12, 19, 8, 6, "B");
    fill(g, 12, 18, 1, 2, "B"); fill(g, 19, 18, 1, 2, "B");
    fill(g, 14, 21, 4, 2, "A"); fill(g, 18, 20, 2, 5, "K");
  } else if (coat === "trench") {
    fill(g, 10, 18, 12, 7, "b"); fill(g, 14, 18, 4, 3, "W"); fill(g, 15, 18, 2, 4, "A");
    fill(g, 10, 22, 12, 1, "B"); px(g, 15, 22, "Y"); px(g, 16, 22, "Y"); fill(g, 19, 20, 3, 5, "B");
  } else if (coat === "fire") {
    fill(g, 10, 18, 12, 7, "A"); fill(g, 19, 20, 3, 5, "d");
    fill(g, 10, 20, 12, 1, "Y"); fill(g, 10, 23, 12, 1, "Y"); fill(g, 15, 18, 2, 7, "g");
  } else if (coat === "vest") {
    fill(g, 10, 18, 12, 7, "W"); fill(g, 11, 18, 10, 7, "A");
    fill(g, 14, 18, 4, 2, "W"); px(g, 15, 19, "d"); px(g, 16, 19, "d"); fill(g, 19, 20, 2, 5, "d");
  } else if (coat === "overalls") {
    fill(g, 10, 18, 12, 7, "W"); fill(g, 11, 20, 10, 5, "A");
    fill(g, 12, 18, 2, 2, "A"); fill(g, 18, 18, 2, 2, "A");
    px(g, 12, 20, "Y"); px(g, 19, 20, "Y"); fill(g, 14, 22, 4, 2, "d");
  } else if (coat === "robe") {
    fill(g, 9, 18, 14, 8, "A"); fill(g, 9, 18, 3, 2, "a"); fill(g, 20, 20, 3, 6, "d");
    fill(g, 14, 18, 4, 8, "d"); px(g, 15, 20, "Y"); px(g, 16, 22, "Y"); px(g, 15, 24, "Y");
  } else if (coat === "jersey") {
    fill(g, 10, 18, 12, 7, "A"); fill(g, 10, 18, 3, 2, "a"); fill(g, 19, 20, 3, 5, "d");
    fill(g, 14, 18, 4, 1, "W"); stamp(g, 14, 20, ["WWWW", ".WW.", ".WW."]);
  } else if (coat === "pilot") {
    fill(g, 10, 18, 12, 7, "A"); fill(g, 10, 18, 3, 1, "Y"); fill(g, 19, 18, 3, 1, "Y");
    fill(g, 14, 18, 4, 4, "W"); fill(g, 15, 18, 2, 4, "O"); fill(g, 19, 20, 3, 5, "d");
    px(g, 12, 20, "Y"); px(g, 13, 20, "Y");
  } else if (coat === "ninja") {
    fill(g, 10, 18, 12, 7, "N"); fill(g, 19, 20, 3, 5, "O");
    stamp(g, 12, 19, ["aA....Aa", "..aAAa..", "....AA.."]); fill(g, 10, 23, 12, 1, "A");
  } else if (coat === "spacesuit") {
    fill(g, 9, 17, 14, 9, "W"); fill(g, 20, 19, 3, 7, "w");
    fill(g, 11, 17, 10, 2, "A");
    fill(g, 13, 20, 6, 3, "g"); px(g, 14, 21, "R"); px(g, 16, 21, "V"); px(g, 17, 21, "C");
    fill(g, 9, 24, 14, 2, "A");
  } else {
    // jacket
    fill(g, 10, 18, 12, 7, "A"); fill(g, 10, 18, 3, 2, "a"); fill(g, 14, 18, 4, 7, "W"); fill(g, 19, 20, 3, 5, "d");
  }

  if (extraTorso) extraTorso(g);
  // Subtle lean variants shift upper chest by 1px while keeping waist anchored!
  const leanL = blank(), leanR = blank();
  for (let y = 17; y <= 25; y++) {
    const shift = y <= 21 ? -1 : 0;
    for (let x = 0; x < PIXEL_GRID_SIZE; x++) {
      if (g[y][x] !== ".") {
        if (x + shift >= 0) leanL[y][x + shift] = g[y][x];
        if (x - shift < PIXEL_GRID_SIZE) leanR[y][x - shift] = g[y][x];
      }
    }
  }
  return { normal: g, leanL, leanR };
}

/** Build articulated left & right arm pose variants anchored to shoulders (8..9,18) & (22..23,18). */
export function buildArmParts({ sleeveL = "A", sleeveR = "d", hand = "S", cuff = null } = {}) {
  const makeL = (fn) => { const g = blank(); fn(g, sleeveL, hand); return g; };
  const makeR = (fn) => { const g = blank(); fn(g, sleeveR, hand); return g; };

  const armL = {
    down: makeL((g, s, h) => {
      fill(g, 8, 18, 2, 4, s); if (cuff) fill(g, 8, 21, 2, 1, cuff); fill(g, 8, 22, 2, 2, h);
    }),
    up: makeL((g, s, h) => {
      fill(g, 6, 12, 2, 2, h); fill(g, 6, 14, 2, 3, s); fill(g, 7, 17, 3, 2, s);
      if (cuff) fill(g, 6, 14, 2, 1, cuff);
    }),
    mid: makeL((g, s, h) => {
      fill(g, 4, 18, 2, 2, h); fill(g, 6, 18, 4, 2, s); if (cuff) fill(g, 6, 18, 1, 2, cuff);
    }),
    forward: makeL((g, s, h) => {
      fill(g, 8, 18, 2, 3, s); fill(g, 9, 20, 3, 2, s); fill(g, 11, 21, 2, 2, h);
    }),
    back: makeL((g, s, h) => {
      fill(g, 7, 18, 3, 2, s); fill(g, 6, 20, 2, 3, s); fill(g, 5, 22, 2, 2, h);
    }),
    flex: makeL((g, s, h) => {
      fill(g, 5, 14, 2, 2, h); fill(g, 5, 16, 2, 3, s); fill(g, 7, 18, 3, 2, s);
    }),
  };

  const armR = {
    down: makeR((g, s, h) => {
      fill(g, 22, 18, 2, 4, s); if (cuff) fill(g, 22, 21, 2, 1, cuff); fill(g, 22, 22, 2, 2, h);
    }),
    up: makeR((g, s, h) => {
      fill(g, 24, 12, 2, 2, h); fill(g, 24, 14, 2, 3, s); fill(g, 22, 17, 3, 2, s);
      if (cuff) fill(g, 24, 14, 2, 1, cuff);
    }),
    mid: makeR((g, s, h) => {
      fill(g, 26, 18, 2, 2, h); fill(g, 22, 18, 4, 2, s); if (cuff) fill(g, 25, 18, 1, 2, cuff);
    }),
    forward: makeR((g, s, h) => {
      fill(g, 22, 18, 2, 3, s); fill(g, 20, 20, 3, 2, s); fill(g, 19, 21, 2, 2, h);
    }),
    back: makeR((g, s, h) => {
      fill(g, 22, 18, 3, 2, s); fill(g, 24, 20, 2, 3, s); fill(g, 25, 22, 2, 2, h);
    }),
    salute: makeR((g, s, h) => {
      fill(g, 22, 18, 3, 2, s); fill(g, 24, 14, 2, 4, s); fill(g, 22, 11, 3, 3, h);
    }),
    flex: makeR((g, s, h) => {
      fill(g, 25, 14, 2, 2, h); fill(g, 25, 16, 2, 3, s); fill(g, 22, 18, 3, 2, s);
    }),
  };

  return { armL, armR };
}

/** Build articulated left & right leg+boot variants anchored at hips (11..14,25) & (17..20,25). */
export function buildLegParts({ legs = "pants", boots = "dark", pants = "N", pantsHi = "n" } = {}) {
  const bMain = boots === "white" ? "W" : boots === "brown" ? "B" : boots === "space" ? "W" : "g";
  const bSole = boots === "white" ? "w" : boots === "space" ? "g" : "O";
  const drawLeg = (g, x, y, h, footDx, isLeft) => {
    if (legs === "shorts") {
      fill(g, x, y, 4, 1, pants);
      fill(g, x, y + 1, 4, Math.max(1, h - 1), isLeft ? "S" : "s");
    } else {
      fill(g, x, y, 4, h, pants);
      if (isLeft) fill(g, x, y, 2, h, pantsHi);
    }
    fill(g, x + footDx, y + h, 4, 1, bMain);
    fill(g, x + footDx + (isLeft ? -1 : 0), y + h + 1, 5, 1, bSole);
  };

  const mk = (fn) => { const g = blank(); fn(g); return g; };
  const legL = {
    stand: mk((g) => drawLeg(g, 11, 25, 2, 0, true)),
    step: mk((g) => drawLeg(g, 10, 24, 1, -1, true)),
    wide: mk((g) => drawLeg(g, 9, 25, 2, -1, true)),
    kick: mk((g) => drawLeg(g, 8, 24, 1, -1, true)),
    crouch: mk((g) => drawLeg(g, 10, 26, 1, 0, true)),
  };
  const legR = {
    stand: mk((g) => drawLeg(g, 17, 25, 2, 0, false)),
    step: mk((g) => drawLeg(g, 18, 24, 1, 1, false)),
    wide: mk((g) => drawLeg(g, 19, 25, 2, 1, false)),
    kick: mk((g) => drawLeg(g, 20, 24, 1, 1, false)),
    crouch: mk((g) => drawLeg(g, 18, 26, 1, 0, false)),
  };
  return { legL, legR };
}

/** Build a complete 7-part skeletal rig for a citizen. */
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
  const head = buildHeadParts(spec);
  const torso = buildTorsoParts(spec.coat, spec.extraTorso);
  const { armL, armR } = buildArmParts({ sleeveL, sleeveR, hand, cuff });
  const { legL, legR } = buildLegParts({
    legs: spec.legs || "pants",
    boots: spec.boots || (spec.coat === "spacesuit" ? "space" : "dark"),
    pants: spec.coat === "spacesuit" ? "W" : "N",
    pantsHi: spec.coat === "spacesuit" ? "W" : "n",
  });
  const prop = spec.props || {};
  return { head, torso, armL, armR, legL, legR, prop };
}

// ============================================================================
// Keyframe Authoring & Articulated Skeletal Compositor
// ============================================================================

const DEFAULT_PART_VARIANTS = {
  head: "normal",
  torso: "normal",
  armL: "down",
  armR: "down",
  legL: "stand",
  legR: "stand",
  prop: "default",
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

/**
 * Create a normalized skeletal keyframe covering all 7 parts:
 * head, torso, armL, armR, legL, legR, prop — each with { dx, dy, variant, flip, visible }.
 * Optional frame extras: { fx, afterimage, petrify, scale, shadow, propZ }.
 */
export function kf(parts = {}, extras = {}) {
  const frame = {
    head: normPart("head", parts.head),
    torso: normPart("torso", parts.torso),
    armL: normPart("armL", parts.armL),
    armR: normPart("armR", parts.armR),
    legL: normPart("legL", parts.legL),
    legR: normPart("legR", parts.legR),
    prop: normPart("prop", parts.prop, parts.prop !== undefined ? true : true),
    shadow: extras.shadow ?? "keep",
    propZ: extras.propZ ?? "front",
  };
  if (extras.fx) frame.fx = extras.fx;
  if (extras.afterimage) frame.afterimage = extras.afterimage;
  if (extras.petrify) frame.petrify = true;
  if (extras.scale) frame.scale = extras.scale;
  return frame;
}

/** Helper to define one occupation animation clip from durations & skeletal keyframes. */
export function clip(id, name, durations, keyframes) {
  if (keyframes.length < 4 || keyframes.length > 8) throw Error(`Clip ${id} expected 4-8 keyframes, got ${keyframes.length}`);
  if (durations.length !== keyframes.length) throw Error(`Clip ${id} durations length mismatch`);
  return { id, name, durations, keyframes };
}

/**
 * Compose a 32×32 pixel matrix from a character's 7-part skeletal rig and one keyframe.
 * Respects anatomical Z-order, crisp 1px silhouette outlining, articulated afterimages, and un-outlined FX.
 */
export function composeKeyframe(rig, keyframe) {
  const body = blank();
  const draw = (partName) => {
    const t = keyframe[partName];
    if (!t || !t.visible) return;
    const dict = rig[partName];
    if (!dict) return;
    const mat = dict[t.variant] || (partName !== "prop" ? dict[DEFAULT_PART_VARIANTS[partName]] : null);
    if (mat) blitPart(body, mat, t.dx, t.dy, t.flip);
  };

  // Z-order: back-prop → legs → torso → non-forward arms → head → forward arms → front-prop
  if (keyframe.propZ === "back") draw("prop");
  draw("legL");
  draw("legR");
  draw("torso");
  if (keyframe.armL.variant !== "forward") draw("armL");
  if (keyframe.armR.variant !== "forward") draw("armR");
  draw("head");
  if (keyframe.armL.variant === "forward") draw("armL");
  if (keyframe.armR.variant === "forward") draw("armR");
  if (keyframe.propZ !== "back") draw("prop");

  let processed = body;
  if (keyframe.petrify) processed = petrifyMatrix(processed);
  if (keyframe.scale && keyframe.scale < 1) processed = miniMatrix(processed);

  const composed = outline(processed);

  // Articulated afterimage copies (e.g. ninja shadow-clones, courier sonic dash, drill vibration)
  if (keyframe.afterimage) {
    const list = Array.isArray(keyframe.afterimage) ? keyframe.afterimage : [keyframe.afterimage];
    for (const ghost of list) {
      blitAfterimage(composed, processed, ghost.dx ?? 0, ghost.dy ?? 0, ghost.tint ?? "c");
    }
  }

  // Ground shadow
  const sh = keyframe.shadow ?? "keep";
  if (sh === "keep") {
    for (let x = 9; x < 23; x++) if (composed[29][x] === ".") composed[29][x] = "Z";
  } else if (sh === "shrink") {
    for (let x = 11; x < 21; x++) if (composed[29][x] === ".") composed[29][x] = "Z";
  } else if (sh === "tiny") {
    for (let x = 13; x < 19; x++) if (composed[29][x] === ".") composed[29][x] = "Z";
  }

  // Un-outlined luminous FX patches: array of [ox, oy, lines]
  if (keyframe.fx) {
    for (const [ox, oy, lines] of keyframe.fx) stamp(composed, ox, oy, lines);
  }
  return composed;
}

/** Compile a 32×32 character matrix into compact horizontal-run SVG paths grouped by color. */
export function compileGrid(matrix, paletteMap) {
  const runs = new Map();
  for (let y = 0; y < PIXEL_GRID_SIZE; y++) {
    const row = matrix[y];
    let x = 0;
    while (x < PIXEL_GRID_SIZE) {
      const ch = row[x];
      if (ch === "." || !paletteMap[ch]) { x++; continue; }
      let end = x + 1;
      while (end < PIXEL_GRID_SIZE && row[end] === ch) end++;
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

/** Build a sprite entry with skeletal `rig`, `idleKeyframe`, and keyframe-based `animations`. */
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
