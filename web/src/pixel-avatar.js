// Pixel citizen avatars: 20 refined 32×32 pixel-art characters spanning diverse genders and professions.
// Each profession ships 5 independent exaggerated gag/shonen-style occupation animations (100 clips total, 4-6 frames each)
// randomly selected and played while the citizen is running a task.

export const PIXEL_GRID_SIZE = 32;

/** Mix a #rrggbb color toward white (amount > 0) or black (amount < 0). */
export function shade(hex, amount) {
  const clean = /^#[0-9a-fA-F]{6}$/.test(hex || "") ? hex : "#3878fb";
  const n = parseInt(clean.slice(1), 16), t = amount < 0 ? 0 : 255, k = Math.abs(amount);
  const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.round(v + (t - v) * k));
  return "#" + c.map((v) => v.toString(16).padStart(2, "0")).join("");
}

// ============================================================================
// 32×32 Pixel Grid Primitives & Composition Helpers
// ============================================================================

function blank() {
  return Array.from({ length: PIXEL_GRID_SIZE }, () => Array(PIXEL_GRID_SIZE).fill("."));
}

function clone(src) {
  return src.map((row) => [...row]);
}

function px(g, x, y, ch) {
  if (x >= 0 && x < PIXEL_GRID_SIZE && y >= 0 && y < PIXEL_GRID_SIZE) g[y][x] = ch;
  return g;
}

function fill(g, x, y, w, h, ch) {
  for (let r = y; r < y + h; r++) {
    if (r < 0 || r >= PIXEL_GRID_SIZE) continue;
    for (let c = x; c < x + w; c++) {
      if (c >= 0 && c < PIXEL_GRID_SIZE) g[r][c] = ch;
    }
  }
  return g;
}

/** Stamp an ASCII art patch at (ox, oy). `.` keeps existing pixel, `_` erases to transparent. */
function stamp(target, ox, oy, lines) {
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

/** Shift all body pixels (excluding ground shadow `Z`) by (dx, dy) and re-draw ground shadow. */
function shiftBody(src, dx, dy, shadowMode = "keep") {
  const out = blank();
  for (let y = 0; y < PIXEL_GRID_SIZE; y++) {
    for (let x = 0; x < PIXEL_GRID_SIZE; x++) {
      const ch = src[y][x];
      if (ch === "." || ch === "Z") continue;
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && nx < PIXEL_GRID_SIZE && ny >= 0 && ny < PIXEL_GRID_SIZE) out[ny][nx] = ch;
    }
  }
  if (shadowMode === "keep") fill(out, 9, 29, 14, 1, "Z");
  else if (shadowMode === "shrink") fill(out, 11, 29, 10, 1, "Z");
  else if (shadowMode === "tiny") fill(out, 13, 29, 6, 1, "Z");
  return out;
}

/** Add a crisp 1px dark-ink silhouette outline around solid body/prop pixels (skipping shadow `Z`). */
function outline(src, ch = "O") {
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

/** Finalize a character pose: outline the body first, then run optional luminous FX decorator(s) un-outlined. */
function finalize(body, fxFn, shadowMode = "keep") {
  const outlined = outline(body);
  if (shadowMode === "keep") {
    for (let x = 9; x < 23; x++) if (outlined[29][x] === ".") outlined[29][x] = "Z";
  } else if (shadowMode === "shrink") {
    for (let x = 11; x < 21; x++) if (outlined[29][x] === ".") outlined[29][x] = "Z";
  } else if (shadowMode === "tiny") {
    for (let x = 13; x < 19; x++) if (outlined[29][x] === ".") outlined[29][x] = "Z";
  }
  if (fxFn) fxFn(outlined);
  return outlined;
}

/** Render a translucent/tinted silhouette afterimage of `src` shifted by (dx, dy) BEHIND `target`. */
function withAfterimage(target, src, dx, dy, tint = "c") {
  const out = clone(target);
  for (let y = 0; y < PIXEL_GRID_SIZE; y++) {
    for (let x = 0; x < PIXEL_GRID_SIZE; x++) {
      const ch = src[y][x];
      if (ch === "." || ch === "Z") continue;
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && nx < PIXEL_GRID_SIZE && ny >= 0 && ny < PIXEL_GRID_SIZE && out[ny][nx] === ".") {
        out[ny][nx] = tint;
      }
    }
  }
  return out;
}

/** Gintama-style petrified grayscale despair filter (for BSOD / shock). */
function petrify(src) {
  const map = { S: "w", s: "G", P: "w", m: "g", A: "G", a: "w", d: "g", H: "g", h: "G", k: "O", N: "g", B: "g", b: "G", R: "g", Y: "w", F: "G", C: "w", V: "G", M: "G", U: "g" };
  return src.map((row) => row.map((c) => map[c] || c));
}

/** Shrink a character sprite into an adorable mini-chibi anchored on the ground (for scientist shrink gag). */
function miniChibi(src) {
  const out = blank();
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const c = src[y * 2]?.[x * 2];
      if (c && c !== "." && c !== "Z") out[y + 13][x + 8] = c;
    }
  }
  return out;
}

// Expressive 32×32 face modifiers (eyes live at x=11..12 & x=19..20, y=11..13; mouth at x=15..16, y=14..15)
function eyesBlink(g, y = 11) {
  stamp(g, 11, y, ["SS", "kk", "SS"]);
  stamp(g, 19, y, ["SS", "kk", "SS"]);
  return g;
}
function eyesHappy(g, y = 11) {
  stamp(g, 11, y, ["EE", "SS", "SS"]);
  stamp(g, 19, y, ["EE", "SS", "SS"]);
  stamp(g, 15, 14, ["mm", "WW"]);
  return g;
}
function eyesGlow(g, ch = "Y", y = 11) {
  stamp(g, 11, y, [ch + ch, ch + ch]);
  stamp(g, 19, y, [ch + ch, ch + ch]);
  return g;
}
function eyesShock(g, y = 11) {
  stamp(g, 11, y, ["WW", "WE", "WW"]);
  stamp(g, 19, y, ["WW", "EW", "WW"]);
  stamp(g, 15, 14, ["OO", "RR"]);
  return g;
}
function eyesDizzy(g, y = 11) {
  stamp(g, 11, y, ["EW", "WE"]);
  stamp(g, 19, y, ["WE", "EW"]);
  stamp(g, 15, 14, ["mm", "SS"]);
  return g;
}
function glassesFlash(g, y = 11) {
  stamp(g, 10, y, ["WWWWWWWWWWWW", ".WWWWWWWWWW."]);
  return g;
}
function mouthShout(g) {
  stamp(g, 14, 14, [".RR.", "RWW."]);
  return g;
}
function stepFeet(g, side) {
  if (side === "left") {
    stamp(g, 11, 25, ["NNNN", "OOOO", "____", "____"]);
  } else if (side === "right") {
    stamp(g, 17, 25, ["NNNN", "OOOO", "____", "____"]);
  }
  return g;
}
function armsUp(g, armColor = "A") {
  // Erase side resting arms and draw raised cheering arms!
  stamp(g, 7, 18, ["___", "___", "___", "___", "___", "___"]);
  stamp(g, 22, 18, ["___", "___", "___", "___", "___", "___"]);
  stamp(g, 6, 13, ["SS", "SS", armColor + armColor, armColor + armColor, "." + armColor, "." + armColor]);
  stamp(g, 24, 13, ["SS", "SS", armColor + armColor, armColor + armColor, armColor + ".", armColor + "."]);
  return g;
}

/** Helper to define one occupation animation clip (4-6 frames). */
function clip(id, name, durations, frames) {
  if (frames.length < 4 || frames.length > 8) throw Error(`Clip ${id} expected 4-8 frames, got ${frames.length}`);
  if (durations.length !== frames.length) throw Error(`Clip ${id} durations length mismatch`);
  return { id, name, durations, frames };
}

// Curated diverse skin & rich 3-tone color palette
const SKIN = {
  fair: { S: "#fde4cf", s: "#e7b99a", P: "#f79ea4", m: "#c26c62" },
  peach: { S: "#fcd2ae", s: "#dfa179", P: "#f28f93", m: "#b86154" },
  warm: { S: "#f0bc90", s: "#cf8f62", P: "#e58178", m: "#a65446" },
  tan: { S: "#d69666", s: "#b17244", P: "#d17266", m: "#8c4438" },
  deep: { S: "#b27046", s: "#894d2b", P: "#b35e52", m: "#6a3124" },
};

const BASE_PALETTE = {
  O: "#1d2133", // deep navy-slate pixel ink outline
  E: "#141826", // crisp eye ink
  N: "#2c3954", // pants / dark navy
  n: "#415273", // pants highlight
  W: "#ffffff", // pure highlight white
  w: "#cbd5e1", // cool coat/steam shade
  G: "#94a3b8", // light steel / silver
  g: "#475569", // dark steel / charcoal
  B: "#7a472a", // rich wood / espresso / leather
  b: "#dba86c", // warm tan / straw / cardboard
  K: "#4e2d1a", // deep leather / dark wood
  R: "#ef4444", // vivid crimson
  r: "#b91c1c", // deep red
  Y: "#fbbf24", // bright gold
  y: "#fef08a", // pale glow yellow
  C: "#22d3ee", // bright cyan
  c: "#a5f3fc", // ice cyan
  V: "#22c55e", // vivid green
  v: "#15803d", // deep leaf green
  M: "#ec4899", // vivid pink / magenta
  U: "#a855f7", // royal violet
  u: "#d8b4fe", // soft lavender
  F: "#f97316", // blaze orange
  Z: "rgba(15, 23, 42, 0.14)",
};

function makePalette(skin, hair, extra = {}) {
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
// Refined 32×32 Chibi Character Portrait Builder
// Produces rich 3-tone shaded head, distinct male/female hairstyles & eyes,
// detailed profession uniform, collar/accents, legs & shaded boots.
// ============================================================================

function buildChibi({ gender = "male", hairStyle = "short", eyeStyle, coat = "hoodie", legs = "pants", boots = "dark", extras } = {}) {
  const g = blank();
  const isF = gender === "female";

  // 1. Back hair layer for long / wavy / ponytail / bob female hairstyles
  if (hairStyle === "long") {
    fill(g, 8, 9, 16, 11, "H");
    fill(g, 8, 15, 2, 6, "k");
    fill(g, 22, 15, 2, 6, "k");
  } else if (hairStyle === "wavy") {
    fill(g, 7, 9, 18, 10, "H");
    stamp(g, 7, 17, ["HH..............HH", "kH..............Hk", ".k..............k."]);
  } else if (hairStyle === "ponytail") {
    stamp(g, 22, 9, ["HHH.", ".HHH", "..Hk", "..kk", "...k"]);
  } else if (hairStyle === "bob") {
    fill(g, 8, 9, 16, 9, "H");
    fill(g, 8, 16, 2, 2, "k");
    fill(g, 22, 16, 2, 2, "k");
  }

  // 2. Chibi Face (x=10..21, y=9..16) with soft chin shadow
  fill(g, 10, 9, 12, 7, "S");
  fill(g, 11, 16, 10, 1, "s");
  px(g, 10, 15, "s"); px(g, 21, 15, "s");
  // Subtle ears
  px(g, 9, 12, "S"); px(g, 9, 13, "s");
  px(g, 22, 12, "S"); px(g, 22, 13, "s");

  // 3. Hair Crown & Bangs (rich 3-tone H / h highlight / k shadow)
  if (hairStyle === "spiky") {
    stamp(g, 9, 5, [
      "...H...HH..H..",
      "..HHHHHHHHHH..",
      ".HHhhhHHhhhHH.",
      ".HHHHHHHHHHHH.",
      ".HkkHSSSSSkkH.",
      ".Hk........kH.",
    ]);
  } else if (hairStyle === "bun") {
    stamp(g, 12, 3, ["..HHHH..", ".HHhhHH.", ".HHHHHH."]);
    stamp(g, 9, 6, [
      "..HHHHHHHHHH..",
      ".HHhhHHHHhhHH.",
      ".HHHHHHHHHHHH.",
      ".HkkHHHHHHkkH.",
      ".Hk........kH.",
    ]);
  } else if (hairStyle === "fluffy") {
    stamp(g, 8, 5, [
      "...HHHHHHHHHH...",
      ".HHHhhhHHhhhHHH.",
      ".HHHHHHHHHHHHHH.",
      "HHkHHkHHHHkHHkHH",
      "Hk............kH",
    ]);
  } else if (hairStyle === "short" || hairStyle === "ponytail" || hairStyle === "long" || hairStyle === "wavy" || hairStyle === "bob") {
    stamp(g, 9, 6, [
      "..HHHHHHHHHH..",
      ".HHhhhHHhhhHH.",
      ".HHHHHHHHHHHH.",
      ".HkkHHkHHkHkH.",
      ".Hk........kH.",
    ]);
  } else if (hairStyle === "swept") {
    stamp(g, 9, 6, [
      "..HHHHHHHHHH..",
      ".HHhhhHHHHhHH.",
      ".HHHHHHHHHHHH.",
      ".HkkHHHHk...H.",
      ".Hk.........H.",
    ]);
  }

  // 4. Eyes, Brows, Blush & Smile
  const eStyle = eyeStyle || (isF ? "sparkle" : "crisp");
  if (eStyle === "sparkle") {
    stamp(g, 11, 11, ["WE", "EE", "kE"]);
    stamp(g, 19, 11, ["WE", "EE", "Ek"]);
    stamp(g, 10, 13, ["P", "P"]);
    stamp(g, 21, 13, ["P", "P"]);
    stamp(g, 15, 14, ["mm"]);
  } else if (eStyle === "crisp") {
    stamp(g, 11, 10, ["kk"]);
    stamp(g, 19, 10, ["kk"]);
    stamp(g, 11, 11, ["WE", "EE"]);
    stamp(g, 19, 11, ["WE", "EE"]);
    stamp(g, 15, 14, ["mm"]);
  } else if (eStyle === "glasses") {
    stamp(g, 10, 10, ["OOOO..OOOO"]);
    stamp(g, 10, 11, ["OWEOOOOWEO", "OEEO..OEEO", "OOOO..OOOO"]);
    stamp(g, 15, 14, ["mm"]);
  } else if (eStyle === "goldglasses") {
    stamp(g, 10, 10, ["YYYY..YYYY"]);
    stamp(g, 10, 11, ["YWEYYYYWEY", "YEEY..YEEY", "YYYY..YYYY"]);
    stamp(g, 10, 14, ["P"]); px(g, 21, 14, "P");
    stamp(g, 15, 14, ["mm"]);
  } else if (eStyle === "shades") {
    stamp(g, 10, 11, ["OOOO..OOOO", "OgOO..OOgO", ".OO....OO."]);
    stamp(g, 10, 14, ["P"]); px(g, 21, 14, "P");
    stamp(g, 15, 14, ["mm"]);
  }

  // 5. Neck & Collar
  fill(g, 14, 17, 4, 1, "s");

  // 6. Layered 3-Tone Occupation Torso (x=10..21, y=18..24) + Arms (x=8..9 & x=22..23)
  if (coat === "hoodie") {
    fill(g, 10, 18, 12, 7, "A");
    fill(g, 10, 18, 3, 2, "a");
    fill(g, 19, 20, 3, 5, "d");
    fill(g, 10, 24, 12, 1, "d");
    // Hoodie drawstrings + pocket
    px(g, 14, 19, "W"); px(g, 14, 20, "W"); px(g, 17, 19, "W"); px(g, 17, 20, "W");
    fill(g, 12, 22, 8, 2, "d"); fill(g, 13, 22, 6, 1, "A");
    // Arms
    fill(g, 8, 18, 2, 4, "A"); px(g, 8, 18, "a"); fill(g, 8, 22, 2, 2, "S");
    fill(g, 22, 18, 2, 4, "d"); fill(g, 22, 22, 2, 2, "S");
  } else if (coat === "labcoat") {
    fill(g, 10, 18, 12, 7, "W");
    fill(g, 13, 18, 6, 7, "A");
    fill(g, 13, 18, 2, 2, "a");
    fill(g, 10, 23, 3, 2, "w"); fill(g, 19, 23, 3, 2, "w");
    px(g, 11, 21, "w"); px(g, 20, 21, "w"); // pockets
    fill(g, 8, 18, 2, 4, "W"); fill(g, 8, 22, 2, 2, "S");
    fill(g, 22, 18, 2, 4, "w"); fill(g, 22, 22, 2, 2, "S");
  } else if (coat === "chef") {
    fill(g, 10, 18, 12, 7, "W");
    fill(g, 19, 20, 3, 5, "w");
    fill(g, 10, 24, 12, 1, "w");
    // Theme neckerchief + double-breasted buttons
    stamp(g, 13, 17, ["aAAAAd", ".AAd.."]);
    px(g, 14, 20, "g"); px(g, 17, 20, "g"); px(g, 14, 22, "g"); px(g, 17, 22, "g");
    fill(g, 8, 18, 2, 4, "W"); fill(g, 8, 22, 2, 2, "S");
    fill(g, 22, 18, 2, 4, "w"); fill(g, 22, 22, 2, 2, "S");
  } else if (coat === "apron") {
    fill(g, 10, 18, 12, 7, "W");
    fill(g, 12, 18, 8, 7, "A");
    fill(g, 12, 18, 2, 2, "a");
    fill(g, 18, 20, 2, 5, "d");
    fill(g, 10, 23, 2, 2, "w"); fill(g, 20, 23, 2, 2, "w");
    fill(g, 8, 18, 2, 4, "W"); fill(g, 8, 22, 2, 2, "S");
    fill(g, 22, 18, 2, 4, "w"); fill(g, 22, 22, 2, 2, "S");
  } else if (coat === "cafe") {
    fill(g, 10, 18, 12, 7, "W");
    fill(g, 12, 19, 8, 6, "B");
    fill(g, 12, 18, 1, 2, "B"); fill(g, 19, 18, 1, 2, "B");
    fill(g, 14, 21, 4, 2, "A"); // theme coffee badge on apron
    fill(g, 18, 20, 2, 5, "K");
    fill(g, 8, 18, 2, 4, "W"); fill(g, 8, 22, 2, 2, "S");
    fill(g, 22, 18, 2, 4, "w"); fill(g, 22, 22, 2, 2, "S");
  } else if (coat === "trench") {
    fill(g, 10, 18, 12, 7, "b");
    fill(g, 14, 18, 4, 3, "W");
    fill(g, 15, 18, 2, 4, "A"); // tie
    fill(g, 10, 22, 12, 1, "B"); px(g, 15, 22, "Y"); px(g, 16, 22, "Y"); // belt
    fill(g, 19, 20, 3, 5, "B");
    fill(g, 8, 18, 2, 4, "b"); fill(g, 8, 22, 2, 2, "S");
    fill(g, 22, 18, 2, 4, "B"); fill(g, 22, 22, 2, 2, "S");
  } else if (coat === "fire") {
    fill(g, 10, 18, 12, 7, "A");
    fill(g, 19, 20, 3, 5, "d");
    fill(g, 10, 20, 12, 1, "Y"); fill(g, 10, 23, 12, 1, "Y"); // reflective stripes
    fill(g, 15, 18, 2, 7, "g");
    fill(g, 8, 18, 2, 4, "A"); px(g, 8, 20, "Y"); px(g, 9, 20, "Y"); fill(g, 8, 22, 2, 2, "S");
    fill(g, 22, 18, 2, 4, "d"); px(g, 22, 20, "Y"); px(g, 23, 20, "Y"); fill(g, 22, 22, 2, 2, "S");
  } else if (coat === "vest") {
    fill(g, 10, 18, 12, 7, "W");
    fill(g, 11, 18, 10, 7, "A");
    fill(g, 14, 18, 4, 2, "W"); px(g, 15, 19, "d"); px(g, 16, 19, "d");
    fill(g, 19, 20, 2, 5, "d");
    fill(g, 8, 18, 2, 4, "W"); fill(g, 8, 22, 2, 2, "S");
    fill(g, 22, 18, 2, 4, "w"); fill(g, 22, 22, 2, 2, "S");
  } else if (coat === "overalls") {
    fill(g, 10, 18, 12, 7, "W");
    fill(g, 11, 20, 10, 5, "A");
    fill(g, 12, 18, 2, 2, "A"); fill(g, 18, 18, 2, 2, "A");
    px(g, 12, 20, "Y"); px(g, 19, 20, "Y"); // brass buttons
    fill(g, 14, 22, 4, 2, "d");
    fill(g, 8, 18, 2, 4, "W"); fill(g, 8, 22, 2, 2, "S");
    fill(g, 22, 18, 2, 4, "w"); fill(g, 22, 22, 2, 2, "S");
  } else if (coat === "robe") {
    fill(g, 9, 18, 14, 8, "A");
    fill(g, 9, 18, 3, 2, "a");
    fill(g, 20, 20, 3, 6, "d");
    fill(g, 14, 18, 4, 8, "d");
    px(g, 15, 20, "Y"); px(g, 16, 22, "Y"); px(g, 15, 24, "Y"); // starry trim
    fill(g, 7, 18, 2, 4, "A"); fill(g, 7, 22, 2, 2, "S");
    fill(g, 23, 18, 2, 4, "d"); fill(g, 23, 22, 2, 2, "S");
  } else if (coat === "jersey") {
    fill(g, 10, 18, 12, 7, "A");
    fill(g, 10, 18, 3, 2, "a");
    fill(g, 19, 20, 3, 5, "d");
    fill(g, 14, 18, 4, 1, "W");
    stamp(g, 14, 20, ["WWWW", ".WW.", ".WW."]); // jersey number
    fill(g, 8, 18, 2, 6, "S"); px(g, 8, 18, "A"); px(g, 9, 18, "A");
    fill(g, 22, 18, 2, 6, "s"); px(g, 22, 18, "d"); px(g, 23, 18, "d");
  } else if (coat === "pilot") {
    fill(g, 10, 18, 12, 7, "A");
    fill(g, 10, 18, 3, 1, "Y"); fill(g, 19, 18, 3, 1, "Y"); // gold epaulettes
    fill(g, 14, 18, 4, 4, "W"); fill(g, 15, 18, 2, 4, "O"); // shirt & tie
    fill(g, 19, 20, 3, 5, "d");
    px(g, 12, 20, "Y"); px(g, 13, 20, "Y"); // wing pin
    fill(g, 8, 18, 2, 4, "A"); px(g, 8, 21, "Y"); px(g, 9, 21, "Y"); fill(g, 8, 22, 2, 2, "S");
    fill(g, 22, 18, 2, 4, "d"); px(g, 22, 21, "Y"); px(g, 23, 21, "Y"); fill(g, 22, 22, 2, 2, "S");
  } else if (coat === "ninja") {
    fill(g, 10, 18, 12, 7, "N");
    fill(g, 19, 20, 3, 5, "O");
    stamp(g, 12, 19, ["aA....Aa", "..aAAa..", "....AA.."]); // cross strap
    fill(g, 10, 23, 12, 1, "A"); // shinobi sash
    fill(g, 8, 18, 2, 4, "N"); fill(g, 8, 22, 2, 2, "S");
    fill(g, 22, 18, 2, 4, "O"); fill(g, 22, 22, 2, 2, "S");
  } else if (coat === "jacket") {
    fill(g, 10, 18, 12, 7, "A");
    fill(g, 10, 18, 3, 2, "a");
    fill(g, 14, 18, 4, 7, "W"); // inner tee
    fill(g, 19, 20, 3, 5, "d");
    fill(g, 8, 18, 2, 4, "A"); fill(g, 8, 22, 2, 2, "S");
    fill(g, 22, 18, 2, 4, "d"); fill(g, 22, 22, 2, 2, "S");
  }

  // 7. Legs & Boots (y=25..28)
  if (legs === "shorts") {
    fill(g, 11, 25, 4, 1, "N"); fill(g, 17, 25, 4, 1, "N");
    fill(g, 11, 26, 4, 1, "S"); fill(g, 17, 26, 4, 1, "s");
  } else {
    fill(g, 11, 25, 4, 2, "N"); fill(g, 11, 25, 2, 2, "n");
    fill(g, 17, 25, 4, 2, "N");
  }
  const bootMain = boots === "white" ? "W" : boots === "brown" ? "B" : "g";
  const bootSole = boots === "white" ? "w" : "O";
  fill(g, 11, 27, 4, 1, bootMain); fill(g, 10, 28, 5, 1, bootSole);
  fill(g, 17, 27, 4, 1, bootMain); fill(g, 17, 28, 5, 1, bootSole);

  if (extras) extras(g);
  return g;
}

// ============================================================================
// 20 Refined 32×32 Citizens × 5 Hilarious Occupation Animations Each (100 Clips)
// ============================================================================

// --- 1. 程序员 (男) ---
const coderRaw = buildChibi({
  gender: "male", hairStyle: "spiky", eyeStyle: "glasses", coat: "hoodie",
  extras(g) {
    // Glowing laptop held in front
    stamp(g, 11, 20, [
      "gggggggggg",
      "gCCCCCCCCg",
      "gCWWVVCCCg",
      "gCCVVWWCCg",
      "gggggggggg",
    ]);
    stamp(g, 9, 22, ["SS"]); stamp(g, 21, 22, ["SS"]);
  },
});
const coderBase = finalize(coderRaw);
const coderAnimations = [
  clip("typing", "敲到冒火", [130, 110, 100, 110, 140], [
    finalize(stamp(clone(coderRaw), 11, 21, ["gVVVVVVVVg", "gVWWVVWWVg"]), (g) => {
      stamp(g, 9, 1, ["V........V", "...V......"]);
    }),
    finalize(shiftBody(coderRaw, 0, -1, "shrink"), (g) => {
      stamp(g, 11, 16, ["..F....F..", ".FYF..FYF.", "gFFYFFYFFg"]);
      stamp(g, 8, 2, ["H..H..H..H"]);
    }, "shrink"),
    finalize(eyesGlow(shiftBody(coderRaw, -1, 0), "F"), (g) => {
      stamp(g, 9, 15, [
        "....Y..F..Y...",
        "...FYRFFRYF...",
        "..FFYYYYYYFF..",
        "..FRRYYYYRRF..",
        "..FFFFFFFFFF..",
      ]);
      stamp(g, 6, 1, ["F...V....Y...F"]);
    }),
    finalize(eyesGlow(shiftBody(coderRaw, 1, -1, "shrink"), "Y"), (g) => {
      stamp(g, 10, 14, [
        "....F..Y..F...",
        "...FFYYYYFF...",
        "..FFRYYYYRFF..",
        "..FFYYYYYYFF..",
        "..gFFRRFFg....",
      ]);
      stamp(g, 8, 0, ["Y....F....V..."]);
    }, "shrink"),
    finalize(eyesBlink(clone(coderRaw)), (g) => {
      stamp(g, 10, 15, [".w...w...w..", "..w....w....", "....F..Y...."]);
    }),
  ]),
  clip("coffee", "咖啡续命", [200, 160, 140, 140, 190], [
    finalize(clone(coderRaw), (g) => {
      stamp(g, 23, 17, [".W..", "..W.", "WWWW", "WBBWw", "WWWW"]);
    }),
    finalize(shiftBody(coderRaw, 0, -1, "shrink"), (g) => {
      stamp(g, 19, 14, [".W..W.", "WBBWW.", ".WWWWw"]);
    }, "shrink"),
    finalize(eyesGlow(shiftBody(coderRaw, 0, -2, "tiny"), "C"), (g) => {
      stamp(g, 8, 0, [
        "..W..W....W..W..",
        ".W....W..W....W.",
        "................",
        "................",
        "................",
        "................",
        "................",
        "................",
        "................",
        "..WWWWWWWWWWWW..",
      ]);
    }, "tiny"),
    finalize(eyesGlow(shiftBody(coderRaw, 0, -3, "none"), "W"), (g) => {
      stamp(g, 5, 0, [
        "C...W....Y....W...C",
        "..Y..W..CCC..W..Y..",
      ]);
      stamp(g, 10, 8, ["WWWWWWWWWWWW"]);
    }, "none"),
    finalize(shiftBody(coderRaw, 0, -1, "shrink"), (g) => {
      stamp(g, 23, 15, ["W.Y.", ".W..", "WWWW", "WBBWw", "WWWW"]);
    }, "shrink"),
  ]),
  clip("deploy", "全绿庆祝", [180, 140, 140, 170], [
    finalize(glassesFlash(clone(coderRaw))),
    finalize(armsUp(glassesFlash(shiftBody(coderRaw, 0, -1, "shrink"))), (g) => {
      stamp(g, 12, 20, ["VVVVVVVV", "VVWWVVVV", "VVVVWWVV"]);
      stamp(g, 3, 1, ["Y..M....V....C..Y", ".C.............M."]);
    }, "shrink"),
    finalize(armsUp(shiftBody(coderRaw, 0, -2, "tiny")), (g) => {
      stamp(g, 1, 0, [
        "Y.M..Y......Y..C.Y",
        "..C....VVVV....M..",
        "Y.....VVWWVV.....Y",
      ]);
    }, "tiny"),
    finalize(glassesFlash(clone(coderRaw)), (g) => {
      stamp(g, 12, 21, ["VVVVVVVV", "VVWWVVVV"]);
      stamp(g, 4, 2, ["Y....C....M....Y"]);
    }),
  ]),
  clip("bsod", "蓝屏瘫倒", [220, 180, 180, 240, 220], [
    finalize(eyesShock(clone(coderRaw)), (g) => {
      stamp(g, 11, 20, ["gggggggggg", "gAAAAAAAAg", "gAWAAWWAAg", "gAAWAAAAAg", "gggggggggg"]);
    }),
    finalize(petrify(eyesShock(shiftBody(coderRaw, 0, 1))), (g) => {
      stamp(g, 11, 21, ["gCCCCCCCCg", "gCWCCWWCCg", "gCCWCCCCCg"]);
      stamp(g, 23, 6, [".WW.", "WWWW", "WWWW", ".WW.", "..W."]);
    }),
    finalize(petrify(eyesDizzy(shiftBody(coderRaw, 0, 2))), (g) => {
      // 灵魂出窍飘上天！
      stamp(g, 22, 1, [".WWW.", "WWWWW", "WEWEW", "WWWWW", "W.W.W"]);
      stamp(g, 11, 22, ["gCCCCCCCCg", "gCWCCWWCCg"]);
    }),
    finalize(petrify(shiftBody(coderRaw, 0, 3)), (g) => {
      stamp(g, 21, 0, [".WWW.", "WEWEW", "WWWWW", "W.W.W"]);
      stamp(g, 5, 11, ["C", "C"]);
    }),
    finalize(eyesDizzy(clone(coderRaw)), (g) => {
      stamp(g, 23, 8, ["C", "C"]);
    }),
  ]),
  clip("debug", "疯狂抓虫", [150, 130, 120, 130, 160], [
    finalize(clone(coderRaw), (g) => {
      // 屏幕爬出一只大红BUG虫！
      stamp(g, 24, 15, ["R.R", ".R.", "RRR", "R.R"]);
    }),
    finalize(shiftBody(coderRaw, 1, -1, "shrink"), (g) => {
      stamp(g, 21, 7, ["ggggg", "gWgWg", "ggggg", "..B..", "..B.."]);
      stamp(g, 25, 13, ["R.R", "RRR", "R.R"]);
    }, "shrink"),
    finalize(mouthShout(shiftBody(coderRaw, 2, 0)), (g) => {
      // 猛拍一拍子，火花四溅！
      stamp(g, 22, 12, ["Y.F.Y", "ggggg", "FWRWF", "ggggg", "Y.F.Y"]);
    }),
    finalize(shiftBody(coderRaw, 1, -1, "shrink"), (g) => {
      stamp(g, 22, 10, ["Y...Y", ".F.F.", "..R..", ".Y.Y."]);
    }, "shrink"),
    finalize(eyesHappy(clone(coderRaw)), (g) => {
      stamp(g, 24, 8, ["...VV", "..VV.", "V.VV.", ".VV.."]);
    }),
  ]),
];

// --- 2. 医生 (女) ---
const doctorRaw = buildChibi({
  gender: "female", hairStyle: "ponytail", coat: "labcoat",
  extras(g) {
    // Nurse/Doctor headband with crisp red cross
    stamp(g, 11, 4, ["..WWWWWW..", ".WWWRRWWW.", ".WWWRRWWW."]);
    // Stethoscope draped on chest
    stamp(g, 13, 18, ["g....g", "g....g", ".g..g.", "..gg..", "..GG.."]);
  },
});
const doctorBase = finalize(doctorRaw);
const doctorAnimations = [
  clip("heartbeat", "听诊弹飞", [200, 130, 130, 140, 200], [
    // 旁边有个像素小病人正乖乖等听诊
    finalize(clone(doctorRaw), (g) => {
      stamp(g, 24, 17, [".SS.", "SESS", ".SS.", "CCCC", "CCCC", "N..N"]);
    }),
    // 心跳爆表！巨大红心弹出，小病人原地弹飞！
    finalize(eyesShock(shiftBody(doctorRaw, -1, 0)), (g) => {
      stamp(g, 23, 8, [".SS.", "SWSW", ".SS.", "CCCC", "N..N"]);
      stamp(g, 22, 16, [".RR.RR.", "RRRRRRR", ".RRRRR.", "..RRR..", "...R..."]);
    }),
    finalize(shiftBody(doctorRaw, -1, -1, "shrink"), (g) => {
      stamp(g, 23, 2, [".SS.", "SWSW", "CCCC", "N..N"]);
      stamp(g, 21, 12, ["Y.RR.RR.Y", ".RRRRRRR.", ".RRWWRRR.", "..RRRRR..", "...RRR...", "....R...."]);
    }, "shrink"),
    finalize(shiftBody(doctorRaw, 0, 0), (g) => {
      stamp(g, 24, 11, [".SS.", "SESS", "CCCC", "N..N"]);
      stamp(g, 24, 19, ["R.R", "RRR", ".R."]);
    }),
    finalize(eyesHappy(clone(doctorRaw)), (g) => {
      stamp(g, 24, 17, [".SS.", "SESS", ".SS.", "CCCC", "CCCC", "N..N"]);
      stamp(g, 25, 12, ["R.R", "RRR", ".R."]);
    }),
  ]),
  clip("chart", "狂写病历", [150, 120, 120, 150], [
    finalize(clone(doctorRaw), (g) => {
      stamp(g, 23, 16, ["WWWWW", "WgggW", "WggWW", "WWWWW"]);
    }),
    finalize(shiftBody(doctorRaw, 0, -1, "shrink"), (g) => {
      stamp(g, 2, 2, ["WWW...................WWW", "Wgg...................ggW"]);
      stamp(g, 22, 15, ["WWWWWW", "WgYYgW", "WgggWW", "WWWWWW"]);
    }, "shrink"),
    finalize(shiftBody(doctorRaw, -1, 0), (g) => {
      stamp(g, 1, 1, ["..WWW.......WWW.....WWW..", "..Wgg.......ggW.....Wgg.."]);
      stamp(g, 4, 8, ["WWW"]);
      stamp(g, 22, 16, ["WWWWWW", "WgggWW", "WgYYgW", "WWWWWW"]);
    }),
    finalize(eyesBlink(clone(doctorRaw)), (g) => {
      stamp(g, 2, 5, ["WWW...................WWW", "Wgg...................ggW"]);
    }),
  ]),
  clip("remedy", "巨型针筒", [190, 150, 150, 190], [
    finalize(clone(doctorRaw), (g) => {
      stamp(g, 23, 10, ["..G..", ".ggg.", ".WVW.", ".WVW.", ".WVW.", ".ggg.", "..g.."]);
    }),
    finalize(shiftBody(doctorRaw, -1, -1, "shrink"), (g) => {
      // 比人还大的超级核能针筒！
      stamp(g, 22, 3, [
        "...G...",
        "...G...",
        "..ggg..",
        ".WVVVW.",
        ".WVCVW.",
        ".WVVVW.",
        ".WVCVW.",
        "..ggg..",
        "...g...",
        "..ggg..",
      ]);
      stamp(g, 20, 1, ["V...C...V"]);
    }, "shrink"),
    finalize(eyesGlow(shiftBody(doctorRaw, -1, -2, "tiny"), "V"), (g) => {
      stamp(g, 22, 1, [
        "..VGV..",
        "..cGc..",
        "..ggg..",
        ".WVVVW.",
        ".WWVWW.",
        ".WVVVW.",
        "..ggg..",
        "...g...",
        "..ggg..",
      ]);
      stamp(g, 2, 4, ["V.V", "VVV", ".V."]);
    }, "tiny"),
    finalize(eyesHappy(clone(doctorRaw)), (g) => {
      stamp(g, 23, 8, [".V.V.", ".ggg.", ".WVW.", ".WVW.", ".ggg."]);
    }),
  ]),
  clip("defib", "电击除颤", [170, 120, 120, 150], [
    finalize(clone(doctorRaw), (g) => {
      stamp(g, 4, 17, ["ggg", "gCg", "ggg"]);
      stamp(g, 24, 17, ["ggg", "gCg", "ggg"]);
    }),
    finalize(eyesGlow(shiftBody(doctorRaw, 0, -1, "shrink"), "C"), (g) => {
      stamp(g, 3, 13, ["Y.C.Y", "gCCCg", "gCWCg"]);
      stamp(g, 23, 13, ["Y.C.Y", "gCCCg", "gCWCg"]);
      stamp(g, 8, 5, ["C...Y...C...Y...C"]);
    }, "shrink"),
    finalize(eyesGlow(shiftBody(doctorRaw, 0, -2, "tiny"), "W"), (g) => {
      stamp(g, 2, 10, ["C.Y.W", ".CYC.", "gWWWg"]);
      stamp(g, 24, 10, ["W.Y.C", ".CYC.", "gWWWg"]);
      stamp(g, 6, 2, ["..C..Y..W..Y..C..", ".Y.............Y."]);
    }, "tiny"),
    finalize(eyesBlink(clone(doctorRaw)), (g) => {
      stamp(g, 5, 16, ["ggg", "gCg"]); stamp(g, 24, 16, ["ggg", "gCg"]);
    }),
  ]),
  clip("coffee_iv", "挂瓶回血", [200, 160, 160, 200], [
    finalize(eyesDizzy(clone(doctorRaw)), (g) => {
      // 输液架+能量绿点滴瓶
      stamp(g, 24, 4, ["ggggg", "..g..", ".WVW.", ".WVW.", "..g..", "..g..", "..g..", "..g.."]);
    }),
    finalize(clone(doctorRaw), (g) => {
      stamp(g, 24, 4, ["ggggg", "..g..", ".WVW.", ".WVW.", "..V..", "..g..", "..g..", "..g.."]);
      stamp(g, 3, 7, ["VV", "VV"]);
    }),
    finalize(eyesGlow(shiftBody(doctorRaw, 0, -1, "shrink"), "V"), (g) => {
      stamp(g, 24, 4, ["ggggg", "..g..", ".WVW.", ".WWW.", "..V..", "..g..", "..g.."]);
      stamp(g, 2, 3, ["..V..", "VVVVV", "..V.."]);
      stamp(g, 6, 1, ["Y........Y"]);
    }, "shrink"),
    finalize(eyesHappy(shiftBody(doctorRaw, 0, -2, "tiny")), (g) => {
      stamp(g, 2, 1, ["Y..V..Y", "..VVV..", "Y..V..Y"]);
      stamp(g, 23, 3, ["..V..", "VVVVV", "..V.."]);
    }, "tiny"),
  ]),
];

// --- 3. 厨师 (男) ---
const chefRaw = buildChibi({
  gender: "male", hairStyle: "short", coat: "chef",
  extras(g) {
    // Tall pleated white chef toque
    stamp(g, 10, 1, [
      "..WWWWWWWW..",
      ".WWWWWWWWWW.",
      ".WWwWWWWwWW.",
      ".WWWWWWWWWW.",
      "..wwwwwwww..",
    ]);
    // Cute chef mustache
    stamp(g, 13, 13, ["HH..HH"]);
    // Cast-iron wok in right hand
    stamp(g, 22, 21, ["gggggg", ".gggg."]);
  },
});
const chefBase = finalize(chefRaw);
const chefAnimations = [
  clip("wok", "烈焰颠勺", [150, 120, 110, 130, 170], [
    finalize(clone(chefRaw), (g) => {
      stamp(g, 22, 16, ["..F..", ".FYF.", "gggggg", ".gggg."]);
    }),
    finalize(shiftBody(chefRaw, 0, -1, "shrink"), (g) => {
      // 煎蛋高高飞起，冲天烈焰烧起！
      stamp(g, 23, 3, [".WW.", "WYYW", ".WW."]);
      stamp(g, 21, 9, ["...Y...", "..FYF..", ".FFYFF.", ".FRYRF.", ".FFFFF.", "ggggggg"]);
    }, "shrink"),
    finalize(eyesGlow(shiftBody(chefRaw, -1, -1, "shrink"), "F"), (g) => {
      stamp(g, 22, 0, [".WW.", "WYYW", ".WW."]);
      stamp(g, 20, 6, ["....Y....", "...FYF...", "..FFYFF..", "..FRYRF..", ".FFYYYFF.", ".FRRRRRF.", "ggggggggg"]);
    }, "shrink"),
    finalize(shiftBody(chefRaw, 0, -1, "shrink"), (g) => {
      stamp(g, 23, 7, [".WW.", "WYYW", ".WW."]);
      stamp(g, 21, 13, ["..FYF..", ".FFYFF.", "ggggggg"]);
    }, "shrink"),
    finalize(eyesHappy(clone(chefRaw)), (g) => {
      stamp(g, 23, 17, [".W..W.", "W....W", ".WWYY."]);
    }),
  ]),
  clip("salt", "撒盐暴雪", [170, 140, 140, 170], [
    finalize(clone(chefRaw), (g) => {
      stamp(g, 22, 10, ["...SS", "..SS.", ".S..W", "...Y."]);
    }),
    finalize(shiftBody(chefRaw, -1, 0), (g) => {
      stamp(g, 21, 6, [
        "....SSW",
        "...SS..",
        "..S..W.",
        "...Y.W.y",
        "..W.y.W.",
        ".Y.W.Y.W",
        "..W.y.W.",
        "...Y.W..",
      ]);
    }),
    finalize(eyesBlink(clone(chefRaw)), (g) => {
      stamp(g, 20, 5, [
        ".....SSW",
        "....SS.y",
        "...S.W..",
        "..Y.W.y.",
        ".W.y.W.Y",
        "..Y.W.W.",
        ".W.Y.y.W",
        "..W.W.Y.",
      ]);
    }),
    finalize(shiftBody(chefRaw, 0, -1, "shrink"), (g) => {
      stamp(g, 21, 8, ["...SS", "..S.Y", "...W.", "..y.W", "...Y."]);
    }, "shrink"),
  ]),
  clip("taste", "小当家金光", [190, 150, 150, 190], [
    finalize(eyesHappy(clone(chefRaw)), (g) => {
      stamp(g, 3, 5, ["Y....................Y"]);
    }),
    finalize(eyesGlow(shiftBody(chefRaw, 0, -1, "shrink"), "Y"), (g) => {
      // 中华小当家式超级金色龙焰背景光环！
      stamp(g, 1, 1, [
        "Y..Y..............Y..Y",
        ".Y...Y..........Y...Y.",
        "Y....................Y",
        "......................",
        "Y....................Y",
        ".F..................F.",
        "Y....................Y",
      ]);
    }, "shrink"),
    finalize(eyesGlow(shiftBody(chefRaw, 0, -2, "tiny"), "Y"), (g) => {
      stamp(g, 0, 0, [
        "Y.F.Y..Y........Y..Y.F.Y",
        ".YYYY..............YYYY.",
        "Y..F................F..Y",
        "........................",
        "F......................F",
        "Y......................Y",
      ]);
      stamp(g, 23, 15, ["SYYY", "SSY."]);
    }, "tiny"),
    finalize(eyesHappy(clone(chefRaw)), (g) => {
      stamp(g, 2, 3, ["Y....................Y", ".y..................y."]);
    }),
  ]),
  clip("chop", "残影快刀", [120, 110, 110, 130], [
    finalize(clone(chefRaw), (g) => {
      stamp(g, 22, 16, ["WWWWW", "WWWWW", "gBBBB"]);
    }),
    finalize(shiftBody(chefRaw, 1, 0), (g) => {
      stamp(g, 21, 10, ["..F..V..", ".V..F...", "WWwWWwWW", "WWwWWwWW", ".gBBBB.."]);
    }),
    finalize(eyesGlow(shiftBody(chefRaw, 0, -1, "shrink"), "W"), (g) => {
      stamp(g, 19, 6, [
        "F...V...F",
        "..V...F..",
        "F...V....",
        "wWWwWWwWW",
        "WWwWWwWWw",
        "..gBBBB..",
      ]);
    }, "shrink"),
    finalize(clone(chefRaw), (g) => {
      stamp(g, 22, 12, [".F..V.", "V....F", "WWWWW.", "gBBBB."]);
    }),
  ]),
  clip("hat_pop", "帽飞起锅", [180, 150, 150, 190], [
    finalize(clone(chefRaw), (g) => {
      stamp(g, 22, 15, [".W..W.", "W....W", "gggggg"]);
    }),
    finalize(stamp(eyesShock(stamp(clone(chefRaw), 10, 1, ["____________", "____________", "____________", "____________", "____________"])), 10, 0, [".WWWWWWWW.", "WWWWWWWWWW", ".wwwwwwww."]), (g) => {
      // 厨师帽被滚滚香雾顶飞到最顶端（带清晰描边）！
      stamp(g, 8, 5, ["W..w....w..W", ".W..W..W..W."]);
    }),
    finalize(stamp(eyesShock(stamp(shiftBody(chefRaw, 0, 1), 10, 2, ["____________", "____________", "____________", "____________", "____________"])), 11, 0, ["WWWWWWWW", "WWwWWwWW", ".wwwwww."]), (g) => {
      stamp(g, 5, 4, ["W...W.....W...W", "..W...W.W...W.."]);
    }),
    finalize(eyesHappy(clone(chefRaw)), (g) => {
      stamp(g, 6, 3, ["W................W"]);
    }),
  ]),
];

// --- 4. 画家 (女) ---
const artistRaw = buildChibi({
  gender: "female", hairStyle: "wavy", coat: "apron",
  extras(g) {
    // French tilted beret
    stamp(g, 9, 2, [
      "......d......",
      "..aaAAAAAAA..",
      ".AAAAAAAAAAA.",
      ".ddAAAAAAAAdd",
    ]);
    // Wooden palette (left) + brush (right)
    stamp(g, 3, 20, [".bBBb", "bRYBb", "bVCBb", ".bBBb"]);
    stamp(g, 24, 17, ["..M", ".b.", "b..", "B.."]);
  },
});
const artistBase = finalize(artistRaw);
const artistAnimations = [
  clip("splash", "颜料狂轰", [150, 130, 130, 150], [
    finalize(clone(artistRaw), (g) => {
      stamp(g, 24, 11, ["M..Y", "..C.", ".b..", "b..."]);
    }),
    finalize(shiftBody(artistRaw, 0, -1, "shrink"), (g) => {
      stamp(g, 2, 2, ["R..M................C..Y", "..Y..................M.."]);
      stamp(g, 23, 8, [".R.Y.", "C...M", "..b..", ".b..."]);
    }, "shrink"),
    finalize(eyesGlow(shiftBody(artistRaw, -1, 0), "M"), (g) => {
      stamp(g, 21, 3, [
        ".M.Y.C.R.",
        "R..M..Y..",
        ".C..R..M.",
        "Y..C..b..",
        ".....b...",
        "....b....",
      ]);
      stamp(g, 2, 6, ["C.M", ".Y."]);
    }),
    finalize(eyesHappy(clone(artistRaw)), (g) => {
      stamp(g, 23, 9, ["Y..C", ".M.R", "..b."]);
    }),
  ]),
  clip("eureka", "灵感帽飞", [190, 150, 150, 190], [
    finalize(clone(artistRaw), (g) => {
      stamp(g, 5, 2, ["Y....................Y"]);
    }),
    finalize(eyesGlow(stamp(shiftBody(artistRaw, 0, -1, "shrink"), 9, 1, ["_____________", "_____________", "_____________", "_____________"]), "Y"), (g) => {
      // 贝雷帽震飞到顶，彩虹星芒爆炸！
      stamp(g, 10, 0, ["..aAAAAAAA..", ".AAAAAAAAAAA."]);
      stamp(g, 2, 2, ["M..Y............C..R", ".C..R..........Y..M."]);
    }, "shrink"),
    finalize(eyesGlow(stamp(clone(artistRaw), 9, 2, ["_____________", "_____________", "_____________", "_____________"]), "Y"), (g) => {
      stamp(g, 11, 0, ["aAAAAAAA", "AAAAAAAA"]);
      stamp(g, 1, 1, ["Y.C.M..............R.Y.C", ".R.Y................C.M."]);
    }),
    finalize(eyesHappy(clone(artistRaw)), (g) => {
      stamp(g, 4, 2, ["M....Y....C....R"]);
    }),
  ]),
  clip("palette", "七彩旋涡", [160, 130, 130, 160], [
    finalize(clone(artistRaw), (g) => {
      stamp(g, 1, 15, [".M.C.", "Y.R.V", ".U.Y."]);
    }),
    finalize(shiftBody(artistRaw, 1, 0), (g) => {
      stamp(g, 0, 11, [
        "..C.M.Y..",
        ".R.U.C.M.",
        "Y.MWRWY.R",
        ".V.C.U.V.",
        "..Y.R.C..",
      ]);
    }),
    finalize(shiftBody(artistRaw, 1, -1, "shrink"), (g) => {
      stamp(g, 0, 10, [
        "..Y.R.C..",
        ".M.C.Y.U.",
        "C.UWWWM.Y",
        ".R.Y.C.R.",
        "..M.V.Y..",
      ]);
    }, "shrink"),
    finalize(eyesBlink(clone(artistRaw)), (g) => {
      stamp(g, 1, 14, [".R.Y.", "C.M.V", ".Y.C."]);
    }),
  ]),
  clip("portrait", "灵魂画作", [200, 170, 170, 200], [
    finalize(clone(artistRaw), (g) => {
      stamp(g, 22, 10, ["bbbbbbbb", "bWWWWWWb", "bWO..OWb", "bW.mm.Wb", "bWWWWWWb", "bbbbbbbb"]);
    }),
    finalize(shiftBody(artistRaw, -1, -1, "shrink"), (g) => {
      // 举起魔性抽象简笔画板+圣光！
      stamp(g, 21, 7, [
        "Y..Y..Y.",
        "bbbbbbbb",
        "bWWWWWWb",
        "bWROORWb",
        "bW.MM.Wb",
        "bW.CC.Wb",
        "bbbbbbbb",
      ]);
    }, "shrink"),
    finalize(eyesGlow(shiftBody(artistRaw, -1, -1, "shrink"), "Y"), (g) => {
      stamp(g, 20, 5, [
        "Y...Y...Y",
        ".bbbbbbbb",
        "YbWWWWWWb",
        ".bWROORWb",
        ".bW.MM.Wb",
        ".bW.CC.Wb",
        ".bbbbbbbb",
      ]);
    }, "shrink"),
    finalize(eyesHappy(clone(artistRaw)), (g) => {
      stamp(g, 22, 10, ["bbbbbbbb", "bWWWWWWb", "bWO..OWb", "bW.mm.Wb", "bbbbbbbb"]);
    }),
  ]),
  clip("paint_face", "颜料糊脸", [190, 150, 180, 220], [
    finalize(clone(artistRaw), (g) => {
      stamp(g, 23, 6, ["gggg", "gMMg", "gMMg"]);
    }),
    finalize(eyesShock(shiftBody(artistRaw, 0, 1)), (g) => {
      stamp(g, 11, 5, ["M.C.Y.R.M", ".R.M.Y.C."]);
      stamp(g, 10, 10, ["M..C....Y.", "..R....M.."]);
    }),
    finalize(eyesDizzy(clone(artistRaw)), (g) => {
      // 满脸花花绿绿颜料点！
      stamp(g, 10, 10, ["M...C..Y..", "....R.....", "Y......M..", "..C..R..C.", "...M...Y.."]);
    }),
    finalize(eyesBlink(clone(artistRaw)), (g) => {
      stamp(g, 10, 10, ["M...C..Y..", "....R.....", "Y......M..", "..C.....C."]);
    }),
  ]),
];

// --- 5. 科学家 (女) ---
const scientistRaw = buildChibi({
  gender: "female", hairStyle: "fluffy", coat: "labcoat",
  extras(g) {
    // Lab goggles on forehead
    stamp(g, 10, 6, ["ggCCCggCCCgg", "ggCWWggCWWgg", "gggggggggggg"]);
    // Glowing green Erlenmeyer flask in right hand
    stamp(g, 23, 18, ["..ww..", "..ww..", ".wVVw.", "wVVVVw", "wVVVVw"]);
  },
});
const scientistBase = finalize(scientistRaw);
const scientistAnimations = [
  clip("flask", "毒液喷泉", [160, 130, 120, 140], [
    finalize(clone(scientistRaw), (g) => {
      stamp(g, 24, 12, [".C.", "V..", ".V."]);
    }),
    finalize(shiftBody(scientistRaw, -1, 0), (g) => {
      stamp(g, 22, 5, ["..V.C..", ".C..V..", "..VVV..", ".C.V.C.", "..VVV..", "..wVw..", ".wVVVw."]);
    }),
    finalize(eyesGlow(shiftBody(scientistRaw, 1, -1, "shrink"), "V"), (g) => {
      stamp(g, 21, 0, [
        "C.V.C.V.C",
        ".V.C.V.C.",
        "..VVVVV..",
        "...CVV...",
        "...VVV...",
        "...wVw...",
        "..wCVVw..",
      ]);
    }, "shrink"),
    finalize(eyesBlink(clone(scientistRaw)), (g) => {
      stamp(g, 23, 8, [".V..C.", "..C...", ".V...."]);
    }),
  ]),
  clip("atom", "护目反光", [180, 150, 150, 180], [
    finalize(stamp(clone(scientistRaw), 10, 6, ["ggWWWggWWWgg", "ggWWWggWWWgg"])),
    finalize(stamp(shiftBody(scientistRaw, 0, -1, "shrink"), 10, 5, ["ggWWWggWWWgg", "ggWWWggWWWgg"]), (g) => {
      stamp(g, 9, 0, ["...C..U..C...", ".U....Y....U.", "...C..U..C..."]);
    }, "shrink"),
    finalize(eyesGlow(stamp(clone(scientistRaw), 10, 6, ["ggWWWggWWWgg", "ggWWWggWWWgg"]), "C"), (g) => {
      stamp(g, 7, 0, [
        "....U...C...U....",
        "..C...U.Y.U...C..",
        "....U...C...U....",
      ]);
    }),
    finalize(clone(scientistRaw), (g) => {
      stamp(g, 10, 1, ["..C.U.C..", ".U..Y..U.", "..C.U.C.."]);
    }),
  ]),
  clip("boom", "炸成爆炸头", [170, 120, 150, 220, 220], [
    finalize(clone(scientistRaw), (g) => {
      stamp(g, 23, 14, [".Y..", "FYF.", "wVw."]);
    }),
    finalize(eyesShock(shiftBody(scientistRaw, -1, -1, "shrink")), (g) => {
      stamp(g, 16, 4, [
        "...uWWWuu...",
        "..WWWWWWWW..",
        ".WWuYYYYuWW.",
        ".WWYFFFFYWW.",
        "..WWWWWWWW..",
        "...uWWWWu...",
      ]);
    }, "shrink"),
    // 炸成焦黑超级爆炸头+冒烟呆滞白眼！
    finalize(eyesShock(stamp(clone(scientistRaw), 6, 1, [
      "....OOOOOOOOOOOO....",
      "..OOkOOOkOOOkOOOOO..",
      ".OOOOOkOOOOOkOOOOOO.",
      ".OOkOOOOOOOOOOOkOOO.",
      ".OOOOOOOOOOOOOOOOOO.",
      "..OOOOOOOOOOOOOOOO..",
    ])), (g) => {
      stamp(g, 5, 0, ["w....u........w....u"]);
      stamp(g, 12, 12, ["g..g..g"]);
    }),
    finalize(eyesDizzy(stamp(clone(scientistRaw), 6, 1, [
      "....OOOOOOOOOOOO....",
      "..OOOkOOOOOkOOOOOO..",
      ".OOOOOOOOOOOOOOOOOO.",
      ".OOOOOOOOOOOOOOOOOO.",
      "..OOOOOOOOOOOOOOOO..",
    ])), (g) => {
      stamp(g, 7, 0, ["w......w......u"]);
    }),
    finalize(eyesBlink(clone(scientistRaw)), (g) => {
      stamp(g, 9, 2, ["w....u....w"]);
    }),
  ]),
  clip("shrink", "迷你变身", [190, 150, 220, 150, 180], [
    finalize(clone(scientistRaw), (g) => {
      stamp(g, 21, 13, ["..U..", ".uUu.", "wUUUw"]);
    }),
    finalize(shiftBody(scientistRaw, 0, 1), (g) => {
      stamp(g, 6, 6, ["U...u.....u...U", "..u.........u.."]);
    }),
    // 咻！缩成超迷你像素小豆丁！
    finalize(miniChibi(scientistRaw), (g) => {
      stamp(g, 9, 8, ["..u..U..u..", "U.........U"]);
    }, "tiny"),
    finalize(miniChibi(shiftBody(scientistRaw, 0, -2, "tiny")), (g) => {
      stamp(g, 8, 6, ["Y...U...Y"]);
    }, "tiny"),
    finalize(eyesHappy(shiftBody(scientistRaw, 0, -1, "shrink")), (g) => {
      stamp(g, 5, 4, ["U....................U"]);
    }, "shrink"),
  ]),
  clip("eureka_eq", "公式刷屏", [160, 140, 140, 160], [
    finalize(clone(scientistRaw), (g) => {
      stamp(g, 2, 2, ["CC..C.", "C..CCC"]);
    }),
    finalize(shiftBody(scientistRaw, 0, -1, "shrink"), (g) => {
      stamp(g, 1, 1, [
        "C.C...Y.....C.CC...Y",
        ".C...Y.Y....CC.C..Y.",
        "C.C.........C.C.....",
      ]);
    }, "shrink"),
    finalize(eyesGlow(clone(scientistRaw), "C"), (g) => {
      stamp(g, 1, 0, [
        "Y.CC...CC.C...Y.CC..",
        "..C.....C.C.....C...",
        "C.CC...CC.C...C.CC..",
      ]);
    }),
    finalize(eyesHappy(clone(scientistRaw)), (g) => {
      stamp(g, 4, 2, ["C..Y..C..Y..C"]);
    }),
  ]),
];

// --- 6. 宇航员 (男) ---
const astronautRaw = (() => {
  const g = blank();
  // Rounded space helmet
  fill(g, 8, 4, 16, 13, "W");
  px(g, 8, 4, "."); px(g, 23, 4, "."); px(g, 8, 16, "."); px(g, 23, 16, ".");
  fill(g, 21, 6, 3, 9, "w");
  // Dark reflective visor
  fill(g, 10, 6, 12, 8, "N");
  fill(g, 11, 7, 3, 2, "C"); px(g, 11, 7, "W");
  // Spacesuit torso + backpack edges
  fill(g, 7, 17, 18, 9, "W");
  fill(g, 21, 19, 4, 7, "w");
  fill(g, 11, 17, 10, 2, "A"); // theme chest stripe
  fill(g, 13, 20, 6, 3, "g"); px(g, 14, 21, "R"); px(g, 16, 21, "V"); px(g, 17, 21, "C"); // control panel
  fill(g, 9, 24, 14, 2, "A"); // belt
  // Legs & space boots
  fill(g, 10, 26, 4, 2, "W"); fill(g, 18, 26, 4, 2, "w");
  fill(g, 9, 28, 5, 1, "g"); fill(g, 18, 28, 5, 1, "g");
  return g;
})();
const astronautBase = finalize(astronautRaw);
const astronautAnimations = [
  clip("float", "失重翻滚", [220, 200, 200, 220], [
    finalize(shiftBody(astronautRaw, 0, -1, "shrink"), (g) => {
      stamp(g, 2, 2, ["Y.........................y"]);
    }, "shrink"),
    finalize(shiftBody(astronautRaw, -1, -2, "tiny"), (g) => {
      stamp(g, 12, 5, ["CWW", ".CC"]);
      stamp(g, 1, 1, [".y.......................Y"]);
    }, "tiny"),
    finalize(shiftBody(astronautRaw, 1, -3, "none"), (g) => {
      stamp(g, 15, 4, ["CWW", ".CC"]);
      stamp(g, 2, 0, ["Y........................Y"]);
      stamp(g, 4, 25, ["y.....................y"]);
    }, "none"),
    finalize(shiftBody(astronautRaw, 0, -2, "tiny"), (g) => {
      stamp(g, 17, 5, ["WW", ".C"]);
      stamp(g, 3, 2, ["y.......................Y"]);
    }, "tiny"),
  ]),
  clip("wave", "宇宙SOS", [170, 140, 140, 170], [
    finalize(shiftBody(astronautRaw, 0, -1, "shrink"), (g) => {
      stamp(g, 24, 10, ["..WW", ".WW.", "WW.."]);
    }, "shrink"),
    finalize(shiftBody(astronautRaw, 0, -1, "shrink"), (g) => {
      stamp(g, 23, 5, ["..C.c", ".C..C", "C.WW.", ".WW..", "WW..."]);
      stamp(g, 1, 5, ["c.C..", "C..C.", "..C.."]);
    }, "shrink"),
    finalize(shiftBody(astronautRaw, 0, -2, "tiny"), (g) => {
      stamp(g, 22, 2, ["...C.c.", "..C..C.", ".C.C...", "..WW...", ".WW...."]);
      stamp(g, 1, 2, ["c.C...", "C..C..", ".C..C."]);
    }, "tiny"),
    finalize(shiftBody(astronautRaw, 0, -1, "shrink"), (g) => {
      stamp(g, 23, 7, [".C.C.", "..WW.", ".WW.."]);
    }, "shrink"),
  ]),
  clip("boost", "火箭暴走", [150, 110, 110, 130, 170], [
    finalize(shiftBody(astronautRaw, 0, -1, "shrink"), (g) => {
      stamp(g, 9, 27, ["..FF....FF..", "..YY....YY.."]);
    }, "shrink"),
    finalize(shiftBody(astronautRaw, 0, -2, "tiny"), (g) => {
      stamp(g, 8, 25, ["..FFF....FFF..", "..FYF....FYF..", "...C......C...", "..w..w..w..w.."]);
    }, "tiny"),
    finalize(shiftBody(astronautRaw, 0, -4, "none"), (g) => {
      stamp(g, 7, 23, [
        "..FFFF....FFFF..",
        "..FYYF....FYYF..",
        "...CC......CC...",
        "..w..w....w..w..",
        ".w....w..w....w.",
      ]);
    }, "none"),
    finalize(shiftBody(astronautRaw, 0, -5, "none"), (g) => {
      stamp(g, 6, 22, [
        "..FYYF....FYYF..",
        "..FFFF....FFFF..",
        "...CC......CC...",
        "..w..w....w..w..",
        ".w..w..ww..w..w.",
        "w....w....w....w",
      ]);
    }, "none"),
    finalize(shiftBody(astronautRaw, 0, -2, "tiny"), (g) => {
      stamp(g, 9, 26, ["..FF....FF..", "..w......w.."]);
    }, "tiny"),
  ]),
  clip("alien", "外星搭讪", [200, 170, 170, 200], [
    finalize(shiftBody(astronautRaw, -2, -1, "shrink"), (g) => {
      // 绿色三眼迷你外星人冒出头！
      stamp(g, 23, 15, [".V..V.", "..VV..", ".VVVV.", "VEVEVV", ".VVVV.", "..VV.."]);
    }, "shrink"),
    finalize(shiftBody(astronautRaw, -2, -1, "shrink"), (g) => {
      stamp(g, 23, 12, [".Y..Y.", "..VV..", ".VVVV.", "VEVEVV", ".VVVV.", "V.VV.V", "..VV.."]);
      stamp(g, 24, 6, ["C.C", ".C."]);
    }, "shrink"),
    finalize(shiftBody(astronautRaw, -2, -2, "tiny"), (g) => {
      stamp(g, 23, 10, [".Y..Y.", "..VV..", ".VVVV.", "VWVWVV", ".VVVV.", "V.VV.V", "..VV.."]);
      stamp(g, 12, 8, ["WW..WW"]);
    }, "tiny"),
    finalize(shiftBody(astronautRaw, -1, -1, "shrink"), (g) => {
      stamp(g, 24, 14, [".V..V.", ".VVVV.", "VEVEVV", ".VVVV."]);
    }, "shrink"),
  ]),
  clip("moonwalk", "太空漫步", [180, 150, 150, 180], [
    finalize(shiftBody(astronautRaw, 2, 0), (g) => {
      stamp(g, 2, 1, ["..CCC..", ".CCCCC.", "gYYYYYg"]);
      stamp(g, 6, 28, ["y.Y.y"]);
    }),
    finalize(shiftBody(astronautRaw, 0, -1, "shrink"), (g) => {
      stamp(g, 10, 0, ["..CCC..", ".CCCCC.", "gYYYYYg"]);
      stamp(g, 22, 27, ["y.Y.y"]);
    }, "shrink"),
    finalize(shiftBody(astronautRaw, -2, 0), (g) => {
      stamp(g, 19, 1, ["..CCC..", ".CCCCC.", "gYYYYYg"]);
      stamp(g, 21, 28, ["Y.y.Y"]);
    }),
    finalize(shiftBody(astronautRaw, 0, -1, "shrink"), (g) => {
      stamp(g, 12, 0, ["..CCC..", ".CCCCC.", "gYYYYYg"]);
      stamp(g, 8, 27, ["Y.y"]);
    }, "shrink"),
  ]),
];

// --- 7. 咖啡师 (女) ---
const baristaRaw = buildChibi({
  gender: "female", hairStyle: "bun", coat: "cafe", boots: "brown",
  extras(g) {
    // Theme cafe headband around hair
    fill(g, 10, 6, 12, 2, "A"); fill(g, 11, 6, 4, 1, "a");
    // Steaming ceramic latte cup in right hand
    stamp(g, 23, 20, ["BBBB", "WWWWw", "WWWw"]);
  },
});
const baristaBase = finalize(baristaRaw);
const baristaAnimations = [
  clip("latte", "香雾冲天", [200, 170, 170, 200], [
    finalize(clone(baristaRaw), (g) => {
      stamp(g, 23, 14, [".W..", "..W.", ".W..", "W..."]);
    }),
    finalize(eyesHappy(clone(baristaRaw)), (g) => {
      stamp(g, 20, 5, ["..WW..", ".W..W.", "..WW..", ".W....", "..WW..", ".W....", "..WW..", "...W.."]);
    }),
    finalize(eyesHappy(shiftBody(baristaRaw, 0, -2, "tiny")), (g) => {
      stamp(g, 18, 1, ["..WWW..", ".W...W.", "..WWW..", ".W..W..", "..WWW..", ".W....", "..WW..", "...W.."]);
      stamp(g, 3, 4, ["W.W", ".W.", "W.W"]);
    }, "tiny"),
    finalize(clone(baristaRaw), (g) => {
      stamp(g, 22, 10, [".W..", "..W.", ".W..", "W..."]);
    }),
  ]),
  clip("grind", "豆子机枪", [130, 110, 110, 130], [
    finalize(shiftBody(baristaRaw, -1, 0), (g) => {
      stamp(g, 22, 16, ["..gg.", "BBBBB", "BKKKB", "BBBBB"]);
    }),
    finalize(shiftBody(baristaRaw, 1, -1, "shrink"), (g) => {
      stamp(g, 1, 3, ["B...B.................B..B", "..B...................B..."]);
      stamp(g, 22, 14, [".gg..", "BBBBB", "BKKKB", "BBBBB"]);
    }, "shrink"),
    finalize(mouthShout(shiftBody(baristaRaw, -1, 0)), (g) => {
      stamp(g, 1, 1, ["..B....B...........B...B..", "B..B.................B..B."]);
      stamp(g, 22, 15, ["..gg.", "BBBBB", "BKKKB"]);
    }),
    finalize(eyesBlink(clone(baristaRaw)), (g) => {
      stamp(g, 22, 11, [".B..B.", "....B.", "..gg..", "BBBBB."]);
    }),
  ]),
  clip("serve", "圣光特调", [190, 150, 150, 190], [
    finalize(clone(baristaRaw), (g) => {
      stamp(g, 22, 12, [".M.M.", "MMMMM", ".MMM.", "..M.."]);
    }),
    finalize(eyesHappy(shiftBody(baristaRaw, 0, -1, "shrink")), (g) => {
      stamp(g, 20, 4, ["Y..M.M..Y", "..MMMMM..", "...MMM...", "....M...."]);
      stamp(g, 2, 6, [".M.M.", "MMMMM", ".MMM.", "..M.."]);
    }, "shrink"),
    finalize(eyesGlow(shiftBody(baristaRaw, 0, -2, "tiny"), "Y"), (g) => {
      stamp(g, 1, 1, ["Y.M.M..............M.M.Y", "..MMM..............MMM..", "...M................M..."]);
      stamp(g, 22, 14, ["Y.Y", "WWW", "WWW"]);
    }, "tiny"),
    finalize(eyesHappy(clone(baristaRaw)), (g) => {
      stamp(g, 23, 9, ["M.M", "MMM", ".M."]);
    }),
  ]),
  clip("foam", "奶泡山崩", [180, 150, 150, 200], [
    finalize(clone(baristaRaw), (g) => {
      stamp(g, 22, 16, [".WWW.", "WWWWW", "WWWWw"]);
    }),
    finalize(eyesShock(clone(baristaRaw)), (g) => {
      stamp(g, 20, 10, ["..WWWW..", ".WWWWWW.", "WWWWWWWW", "wWWWWWWw", ".WWWWWW."]);
    }),
    finalize(eyesShock(shiftBody(baristaRaw, -1, 0)), (g) => {
      // 雪白巨型奶油泡沫山淹没半边屏幕！
      stamp(g, 18, 4, [
        "...WWWWWW...",
        "..WWWWWWWW..",
        ".WWWWWWWWWW.",
        "WWWWwWWWWWWW",
        "WWWWWWWWwWWW",
        ".WWWWWWWWWW.",
        "..WWWWWWWW..",
      ]);
    }),
    finalize(eyesBlink(clone(baristaRaw)), (g) => {
      stamp(g, 21, 13, [".WWWWW.", "WWWWWWW", "wWWWWWw"]);
    }),
  ]),
  clip("espresso", "浓缩觉醒", [180, 140, 130, 160], [
    finalize(clone(baristaRaw), (g) => {
      stamp(g, 19, 14, ["KKK", "WWWw"]);
    }),
    finalize(eyesGlow(shiftBody(baristaRaw, 0, -1, "shrink"), "C"), (g) => {
      stamp(g, 1, 10, ["CCCCCCCCC", "WWWWWWWWW"]);
      stamp(g, 22, 10, ["CCCCCCCCC", "WWWWWWWWW"]);
    }, "shrink"),
    finalize(eyesGlow(shiftBody(baristaRaw, 0, -2, "tiny"), "W"), (g) => {
      stamp(g, 0, 8, ["YCCCCCCCCC", "WWWWWWWWWW"]);
      stamp(g, 22, 8, ["CCCCCCCCCY", "WWWWWWWWWW"]);
      stamp(g, 10, 1, ["Y...C...Y"]);
    }, "tiny"),
    finalize(eyesHappy(clone(baristaRaw)), (g) => {
      stamp(g, 5, 3, ["C....................C"]);
    }),
  ]),
];

// --- 8. 侦探 (男) ---
const detectiveRaw = buildChibi({
  gender: "male", hairStyle: "short", coat: "trench", boots: "brown",
  extras(g) {
    // Classic detective fedora
    stamp(g, 7, 2, [
      "....bbbbbbbb....",
      "...bbbbbbbbbb...",
      "...ddAAAAAAdd...",
      ".bbbbbbbbbbbbbb.",
    ]);
    // Brass magnifying glass in right hand
    stamp(g, 23, 17, [".YYY.", "YCCWY", "YCCCY", ".YYY.", "B...."]);
  },
});
const detectiveBase = finalize(detectiveRaw);
const detectiveAnimations = [
  clip("inspect", "死光放大镜", [200, 160, 150, 190], [
    finalize(clone(detectiveRaw), (g) => {
      stamp(g, 22, 15, [".YYY.", "YWWCY", "YCCCY", ".YYY."]);
    }),
    finalize(shiftBody(detectiveRaw, 1, 0), (g) => {
      stamp(g, 16, 9, [
        "..YYYYYY..",
        ".YCCWWCCY.",
        "YCCWWWWCCY",
        "YCCCWWCCCY",
        ".YCCCCCCY.",
        "..YYYYYY..",
        ".B........",
      ]);
    }),
    finalize(clone(detectiveRaw), (g) => {
      // 放大镜大到遮脸+名侦探纯白死光！
      stamp(g, 14, 7, [
        "....W.....",
        "..YYYYYY..",
        ".YWWWWWWY.",
        "YWWWWWWWWY",
        "YWWWWWWWWY",
        ".YWWWWWWY.",
        "..YYYYYY..",
        ".B........",
      ]);
    }),
    finalize(eyesBlink(clone(detectiveRaw)), (g) => {
      stamp(g, 22, 16, [".YYY.", "YCWY.", "YCCCY", ".YYY."]);
    }),
  ]),
  clip("aha", "真相只有一个", [180, 140, 140, 200], [
    finalize(clone(detectiveRaw), (g) => {
      stamp(g, 24, 5, [".YY.", ".YY.", ".YY.", "....", ".YY."]);
    }),
    finalize(eyesGlow(stamp(shiftBody(detectiveRaw, 0, -1, "shrink"), 7, 1, ["________________", "________________", "________________", "________________"]), "Y"), (g) => {
      // 礼帽震飞，巨大金色感叹号炸裂！
      stamp(g, 8, 0, ["..bbbbbbbb..", ".ddAAAAAAdd.", "bbbbbbbbbbbb"]);
      stamp(g, 24, 2, ["YYYY", "YYYY", "YYYY", "....", "YYYY"]);
    }, "shrink"),
    finalize(eyesGlow(stamp(clone(detectiveRaw), 7, 2, ["________________", "________________", "________________", "________________"]), "W"), (g) => {
      stamp(g, 9, 0, [".bbbbbbbb.", "bbbbbbbbbb"]);
      stamp(g, 2, 1, ["YYYY", "YYYY", "YYYY", "....", "YYYY"]);
      stamp(g, 25, 1, ["YYYY", "YYYY", "YYYY", "....", "YYYY"]);
    }),
    finalize(clone(detectiveRaw), (g) => {
      stamp(g, 24, 3, ["yYYy", ".YY.", ".YY.", "....", ".YY."]);
    }),
  ]),
  clip("clues", "问号弹幕", [160, 140, 140, 160], [
    finalize(clone(detectiveRaw), (g) => {
      stamp(g, 24, 4, ["YYYY", "...Y", "..Y.", "....", "..Y."]);
    }),
    finalize(shiftBody(detectiveRaw, -1, 0), (g) => {
      stamp(g, 2, 2, ["RRRR....................YYYY", "...R.......................Y", "..R.......................Y.", "............................", "..R.......................Y."]);
    }),
    finalize(shiftBody(detectiveRaw, 1, -1, "shrink"), (g) => {
      stamp(g, 1, 1, ["YYYY...................RRRR", "...Y......................R", "..Y......................R.", "...........................", "..Y......................R."]);
      stamp(g, 23, 17, ["WWWWW", "WgYgW", "WWWWW"]);
    }, "shrink"),
    finalize(eyesBlink(clone(detectiveRaw)), (g) => {
      stamp(g, 3, 4, ["YYYY...................RRRR", "...Y......................R", "..Y......................R."]);
    }),
  ]),
  clip("pipe", "烟圈推理", [210, 180, 180, 210], [
    finalize(eyesBlink(clone(detectiveRaw)), (g) => {
      stamp(g, 18, 14, ["BBB", "..BB"]);
      stamp(g, 23, 11, [".W.", "W.W", ".W."]);
    }),
    finalize(eyesBlink(clone(detectiveRaw)), (g) => {
      stamp(g, 18, 14, ["BBB", "..BB"]);
      stamp(g, 22, 6, [".WWW.", "W...W", "W...W", ".WWW."]);
    }),
    finalize(eyesBlink(clone(detectiveRaw)), (g) => {
      stamp(g, 18, 14, ["BBB", "..BB"]);
      stamp(g, 21, 1, ["..WWW..", ".W...W.", "W.....W", ".W...W.", "..WWW.."]);
      stamp(g, 23, 10, [".W.", "W.W", ".W."]);
    }),
    finalize(clone(detectiveRaw), (g) => {
      stamp(g, 22, 4, [".wWw.", "w...w", ".wWw."]);
    }),
  ]),
  clip("disguise", "瞬间变装", [190, 140, 220, 200], [
    finalize(clone(detectiveRaw), (g) => {
      stamp(g, 5, 16, ["b..b", ".bb."]);
    }),
    finalize(shiftBody(detectiveRaw, 0, -1, "shrink"), (g) => {
      // 斗篷一挥白烟闪烁！
      stamp(g, 7, 10, ["w..W..w..W..w..W..w"]);
    }, "shrink"),
    finalize(clone(detectiveRaw), (g) => {
      // 超夸张大黑墨镜 + 浓密大胡子路人伪装！
      stamp(g, 9, 10, ["OOOOO..OOOOO", "OWOOO..OWOOO", ".OOO....OOO."]);
      stamp(g, 10, 14, [".KKKKKKKKKK.", "KKKkkkkkkKKK", "..KKKKKKKK.."]);
    }),
    finalize(clone(detectiveRaw), (g) => {
      stamp(g, 9, 10, ["OOOOO..OOOOO", "OOWOO..OOWOO", ".OOO....OOO."]);
      stamp(g, 10, 14, [".KKKKKKKKKK.", "KKKkkkkkkKKK", "..KKKKKKKK.."]);
      stamp(g, 24, 6, ["Y..Y"]);
    }),
  ]),
];

// --- 9. 音乐家 (女) ---
const musicianRaw = buildChibi({
  gender: "female", hairStyle: "long", coat: "jacket",
  extras(g) {
    // Chunky theme headphones
    stamp(g, 8, 4, [
      "...AAAAAAAAAA...",
      "..AA........AA..",
      ".AA..........AA.",
      "AA............AA",
      "AA............AA",
      "dd............dd",
    ]);
    // Acoustic/electric guitar across torso
    stamp(g, 10, 19, [
      "........bbb.",
      ".....bbBYBbb",
      "....bbBBBBB.",
      ".....bbbb...",
    ]);
  },
});
const musicianBase = finalize(musicianRaw);
const musicianAnimations = [
  clip("strum", "音符导弹", [150, 130, 130, 150], [
    finalize(clone(musicianRaw), (g) => {
      stamp(g, 2, 4, ["..MM", "..M.", ".MM.", ".MM."]);
    }),
    finalize(shiftBody(musicianRaw, 0, -1, "shrink"), (g) => {
      stamp(g, 1, 2, [".YY.....................CC", ".Y......................C.", "YY.....................CC."]);
    }, "shrink"),
    finalize(shiftBody(musicianRaw, -1, 0), (g) => {
      stamp(g, 1, 1, ["..CC...................MM.", "..C....................M..", ".CC...................MM.."]);
    }),
    finalize(eyesHappy(shiftBody(musicianRaw, 1, -1, "shrink")), (g) => {
      stamp(g, 2, 3, [".MM...................YY", ".M....................Y.", "MM...................YY."]);
    }, "shrink"),
  ]),
  clip("bass", "低音震屏", [140, 120, 120, 140], [
    finalize(clone(musicianRaw), (g) => {
      stamp(g, 2, 7, [".C", "C.", "C.", ".C"]);
      stamp(g, 28, 7, ["C.", ".C", ".C", "C."]);
    }),
    finalize(shiftBody(musicianRaw, 0, -1, "shrink"), (g) => {
      stamp(g, 0, 5, ["..M.", ".M.C", "M.C.", "M.C.", ".M.C", "..M."]);
      stamp(g, 28, 5, [".M..", "C.M.", ".C.M", ".C.M", "C.M.", ".M.."]);
    }, "shrink"),
    finalize(eyesGlow(shiftBody(musicianRaw, 0, 1), "C"), (g) => {
      stamp(g, 0, 6, [".Y.C", "Y.C.", "Y.C.", ".Y.C"]);
      stamp(g, 28, 6, ["C.Y.", ".C.Y", ".C.Y", "C.Y."]);
    }),
    finalize(eyesBlink(shiftBody(musicianRaw, 0, -1, "shrink")), (g) => {
      stamp(g, 1, 7, [".M", "M.", "M.", ".M"]);
      stamp(g, 29, 7, ["M.", ".M", ".M", "M."]);
    }, "shrink"),
  ]),
  clip("solo", "雷电独奏", [150, 120, 120, 150], [
    finalize(shiftBody(musicianRaw, 0, -1, "shrink"), (g) => {
      stamp(g, 24, 4, ["..YY", ".YY.", "..Y.", ".Y.."]);
    }, "shrink"),
    finalize(eyesGlow(shiftBody(musicianRaw, 0, -2, "tiny"), "Y"), (g) => {
      stamp(g, 1, 1, ["..YY...................YY.", ".YY.....................YY", "..Y.....................Y.", ".Y.......................Y"]);
    }, "tiny"),
    finalize(eyesGlow(shiftBody(musicianRaw, 0, -3, "none"), "M"), (g) => {
      stamp(g, 1, 0, [
        "Y..MM.................CC..Y",
        ".YY.M.................C.YY.",
        "..YMM.................CCY..",
      ]);
      stamp(g, 3, 12, ["Y.........................Y"]);
    }, "none"),
    finalize(shiftBody(musicianRaw, 0, -1, "shrink"), (g) => {
      stamp(g, 2, 3, ["Y..Y...................Y..Y"]);
    }, "shrink"),
  ]),
  clip("mic", "破音飙高音", [170, 140, 130, 160], [
    finalize(clone(musicianRaw), (g) => {
      stamp(g, 22, 14, [".GG.", "GGGG", "..g.", "..g."]);
    }),
    finalize(mouthShout(shiftBody(musicianRaw, -1, 0)), (g) => {
      stamp(g, 21, 13, [".GG.", "GGGG", "..g."]);
      stamp(g, 25, 8, [".R.", "..R", "..R", ".R."]);
    }),
    finalize(eyesShock(mouthShout(shiftBody(musicianRaw, -1, -1, "shrink"))), (g) => {
      // 超高海豚音声波震裂屏幕！
      stamp(g, 20, 12, [".GG.", "GGGG", "..g."]);
      stamp(g, 24, 4, [
        ".R..Y..",
        "..R..Y.",
        "...R..Y",
        "...R..Y",
        "..R..Y.",
        ".R..Y..",
      ]);
    }, "shrink"),
    finalize(mouthShout(clone(musicianRaw)), (g) => {
      stamp(g, 21, 13, [".GG.", "GGGG"]);
      stamp(g, 25, 9, ["Y.", ".Y", "Y."]);
    }),
  ]),
  clip("headbang", "金属甩头", [110, 100, 100, 110], [
    finalize(shiftBody(musicianRaw, 0, 1), (g) => {
      stamp(g, 4, 2, ["F.......................F"]);
    }),
    finalize(eyesGlow(shiftBody(musicianRaw, -2, 2), "R"), (g) => {
      stamp(g, 1, 4, ["F.R.Y", ".FYF."]);
      stamp(g, 26, 4, ["Y.R.F", ".FYF."]);
    }),
    withAfterimage(finalize(shiftBody(musicianRaw, 2, -1, "shrink"), (g) => {
      stamp(g, 2, 1, ["R..F..Y..............Y..F..R"]);
    }, "shrink"), musicianRaw, -3, 1, "u"),
    withAfterimage(finalize(shiftBody(musicianRaw, -2, 1), (g) => {
      stamp(g, 4, 2, ["Y.......................Y"]);
    }), musicianRaw, 3, -1, "y"),
  ]),
];

// --- 10. 消防员 (男) ---
const firefighterRaw = buildChibi({
  gender: "male", hairStyle: "short", coat: "fire",
  extras(g) {
    // Yellow fire helmet with front shield badge
    stamp(g, 7, 2, [
      ".....YYYYYY.....",
      "...YYYYYYYYYY...",
      "..YYYYAAAAYYYY..",
      ".YYYYYYYYYYYYYY.",
    ]);
    // Brass hose nozzle in right hand
    stamp(g, 22, 20, ["gggY", "gggY"]);
  },
});
const firefighterBase = finalize(firefighterRaw);
const firefighterAnimations = [
  clip("hose", "暴走水炮", [140, 110, 110, 140], [
    finalize(clone(firefighterRaw), (g) => {
      stamp(g, 25, 18, ["..C..", "CCcCC", "..c.."]);
    }),
    finalize(shiftBody(firefighterRaw, -2, 0), (g) => {
      stamp(g, 22, 16, ["...c..W..", ".CCWWCCcC", "CWWCCWWCC", ".cCCWWcCC", "...c..W.."]);
    }),
    finalize(mouthShout(shiftBody(firefighterRaw, -3, -1, "shrink")), (g) => {
      stamp(g, 20, 14, [
        "....C..c..W.",
        "..CCWWCCWWCC",
        "CCWWCCWWCCWW",
        "..cCCWWcCCWW",
        "....c..W..C.",
      ]);
    }, "shrink"),
    finalize(shiftBody(firefighterRaw, -1, 0), (g) => {
      stamp(g, 24, 17, [".W.c.", "CcWWc", "CCcCW", "..c.."]);
    }),
  ]),
  clip("siren", "迪斯科警灯", [130, 130, 130, 130], [
    finalize(stepFeet(clone(firefighterRaw), "left"), (g) => {
      stamp(g, 9, 0, ["RRRR......CC", "..RR....CC.."]);
    }),
    finalize(stepFeet(shiftBody(firefighterRaw, 1, -1, "shrink"), "right"), (g) => {
      stamp(g, 9, 0, ["CC......RRRR", "..CC....RR.."]);
    }, "shrink"),
    finalize(stepFeet(clone(firefighterRaw), "left"), (g) => {
      stamp(g, 5, 0, ["RR...RRRR...CC...CC", ".....RR.....CC....."]);
    }),
    finalize(stepFeet(shiftBody(firefighterRaw, 1, -1, "shrink"), "right"), (g) => {
      stamp(g, 5, 0, ["CC...CCCC...RR...RR", ".....CC.....RR....."]);
    }, "shrink"),
  ]),
  clip("victory", "浓烟点赞", [190, 160, 160, 190], [
    finalize(clone(firefighterRaw), (g) => {
      stamp(g, 23, 12, [".w..w.", "w....w", "......", ".SYY.."]);
    }),
    finalize(eyesGlow(shiftBody(firefighterRaw, 0, -1, "shrink"), "Y"), (g) => {
      stamp(g, 3, 2, ["w..w................w..w", ".w....................w."]);
      stamp(g, 22, 13, [".Y.Y.", "SYYYY", ".SSY."]);
    }, "shrink"),
    finalize(eyesHappy(clone(firefighterRaw)), (g) => {
      stamp(g, 4, 3, ["w....w............w....w"]);
      stamp(g, 22, 13, ["Y.Y.Y", "SYYYY", ".SSY."]);
    }),
    finalize(clone(firefighterRaw), (g) => {
      stamp(g, 23, 14, [".Y.Y.", "SYYY."]);
    }),
  ]),
  clip("ladder", "极速攀梯", [150, 130, 130, 150], [
    finalize(shiftBody(firefighterRaw, -2, 0), (g) => {
      stamp(g, 24, 3, ["G..G", "GGGG", "G..G", "GGGG", "G..G", "GGGG", "G..G", "GGGG", "G..G", "GGGG", "G..G", "GGGG"]);
    }),
    finalize(stepFeet(shiftBody(firefighterRaw, -1, -2, "shrink"), "left"), (g) => {
      stamp(g, 24, 2, ["G..G", "GGGG", "G..G", "GGGG", "G..G", "GGGG", "G..G", "GGGG", "G..G", "GGGG", "G..G", "GGGG"]);
      stamp(g, 4, 3, ["Y.Y"]);
    }, "shrink"),
    finalize(stepFeet(shiftBody(firefighterRaw, -1, -3, "tiny"), "right"), (g) => {
      stamp(g, 24, 1, ["G..G", "GGGG", "G..G", "GGGG", "G..G", "GGGG", "G..G", "GGGG", "G..G", "GGGG", "G..G", "GGGG"]);
      stamp(g, 2, 1, ["Y..Y"]);
    }, "tiny"),
    finalize(shiftBody(firefighterRaw, -2, -1, "shrink"), (g) => {
      stamp(g, 24, 3, ["G..G", "GGGG", "G..G", "GGGG", "G..G", "GGGG", "G..G", "GGGG", "G..G", "GGGG"]);
    }, "shrink"),
  ]),
  clip("extinguish", "泡沫狂喷", [160, 130, 130, 170], [
    finalize(clone(firefighterRaw), (g) => {
      stamp(g, 22, 17, [".g..", "RRRR", "RRRR", "RRRR"]);
    }),
    finalize(shiftBody(firefighterRaw, -1, 0), (g) => {
      stamp(g, 21, 15, ["..g.WW..", "RRRRWWWW", "RRRRwWWw", "RRRR.WW."]);
    }),
    finalize(shiftBody(firefighterRaw, -2, 0), (g) => {
      // 铺天盖地雪白灭火泡沫云！
      stamp(g, 20, 11, [
        "...WWWWWW...",
        "..WWWWWWWW..",
        ".gWWWWWWWWW.",
        "RRRRwWWWWWWw",
        "RRRRWWWWWWWW",
        "RRRR.WWWWWW.",
      ]);
    }),
    finalize(eyesHappy(clone(firefighterRaw)), (g) => {
      stamp(g, 23, 13, [".WWWWW.", "wWWWWWw", ".WWWWW."]);
    }),
  ]),
];

// --- 11. 教师 (女) ---
const teacherRaw = buildChibi({
  gender: "female", hairStyle: "bun", eyeStyle: "goldglasses", coat: "vest",
  extras(g) {
    // Open textbook (left) + pointer stick (right)
    stamp(g, 3, 19, ["WWWWW", "WwWwW", "WWWWW"]);
    stamp(g, 23, 15, ["...b", "..b.", ".b..", "b..."]);
  },
});
const teacherBase = finalize(teacherRaw);
const teacherAnimations = [
  clip("lecture", "亮瞎大灯泡", [200, 150, 150, 190], [
    finalize(clone(teacherRaw), (g) => {
      stamp(g, 23, 4, [".YY.", "YyyY", ".YY.", ".gg."]);
    }),
    finalize(shiftBody(teacherRaw, 0, -1, "shrink"), (g) => {
      stamp(g, 21, 1, ["y..y..y", ".YYYYY.", "yYWWWYy", ".YYYYY.", "..ggg.."]);
    }, "shrink"),
    finalize(eyesGlow(clone(teacherRaw), "Y"), (g) => {
      stamp(g, 20, 0, ["Y.yWy.Y", "yYYYYYy", "WWWWWWW", "yYYYYYy", ".YYYYY.", "..ggg.."]);
    }),
    finalize(eyesBlink(clone(teacherRaw)), (g) => {
      stamp(g, 23, 4, [".YY.", "YyyY", ".YY.", ".gg."]);
    }),
  ]),
  clip("books", "飞页龙卷风", [150, 130, 130, 150], [
    finalize(clone(teacherRaw), (g) => {
      stamp(g, 2, 12, ["WWW", "WwW"]);
    }),
    finalize(shiftBody(teacherRaw, 0, -1, "shrink"), (g) => {
      stamp(g, 1, 3, ["WWW.....................WWW", "WwW..........Y..........wWW"]);
      stamp(g, 3, 11, ["WWW...................WWW"]);
    }, "shrink"),
    finalize(shiftBody(teacherRaw, -1, 0), (g) => {
      stamp(g, 2, 1, ["...WWW.......WWW.......WWW", "Y..WwW.......wWW....Y..WwW"]);
      stamp(g, 1, 9, ["WWW...................WWW"]);
    }),
    finalize(eyesHappy(clone(teacherRaw)), (g) => {
      stamp(g, 3, 4, ["WWW...................Y.."]);
    }),
  ]),
  clip("goldstar", "满分金星章", [190, 140, 140, 190], [
    finalize(clone(teacherRaw), (g) => {
      stamp(g, 23, 10, ["..Y..", ".YYY.", "YYYYY", ".YYY.", "..Y.."]);
    }),
    finalize(shiftBody(teacherRaw, 0, -1, "shrink"), (g) => {
      stamp(g, 21, 4, ["...Y...", "..YYY..", "YYYYYYY", ".YYWYY.", "..YYY..", ".Y...Y."]);
    }, "shrink"),
    finalize(eyesGlow(shiftBody(teacherRaw, 0, -2, "tiny"), "Y"), (g) => {
      stamp(g, 20, 2, ["R..Y..M", "..YYY..", "YYYYYYY", ".YWWWY.", "..YYY..", ".Y.C.Y."]);
      stamp(g, 2, 3, ["R.RR.RR", "R.R.R.R", "R.RR.RR"]); // 100!
    }, "tiny"),
    finalize(eyesHappy(clone(teacherRaw)), (g) => {
      stamp(g, 22, 8, [".R.Y.R.", "..YYY..", ".YYYYY.", "..YYY.."]);
    }),
  ]),
  clip("chalk", "粉笔狙击", [200, 130, 120, 160], [
    finalize(glassesFlash(clone(teacherRaw)), (g) => {
      stamp(g, 23, 13, ["WW"]);
    }),
    finalize(glassesFlash(shiftBody(teacherRaw, -1, 0)), (g) => {
      // 银魂/校园名场面：超高速粉笔狙击！
      stamp(g, 22, 12, ["w.w.WWWWW"]);
    }),
    finalize(shiftBody(teacherRaw, 1, 0), (g) => {
      stamp(g, 21, 11, ["w..w..w..WWW", ".........Y.F"]);
    }),
    finalize(eyesHappy(clone(teacherRaw)), (g) => {
      stamp(g, 25, 11, ["Y.F.Y", ".F.F."]);
    }),
  ]),
  clip("glasses", "推镜威压", [200, 160, 160, 200], [
    finalize(clone(teacherRaw), (g) => {
      stamp(g, 8, 12, ["SS"]);
    }),
    finalize(glassesFlash(clone(teacherRaw)), (g) => {
      stamp(g, 2, 4, ["U....................U"]);
    }),
    finalize(glassesFlash(shiftBody(teacherRaw, 0, -1, "shrink")), (g) => {
      stamp(g, 1, 2, ["U..U................U..U", ".U....................U."]);
      stamp(g, 8, 10, ["W..............W"]);
    }, "shrink"),
    finalize(glassesFlash(clone(teacherRaw)), (g) => {
      stamp(g, 3, 5, ["U....................U"]);
    }),
  ]),
];

// --- 12. 园丁 (男) ---
const gardenerRaw = buildChibi({
  gender: "male", hairStyle: "short", coat: "overalls", boots: "brown",
  extras(g) {
    // Wide golden straw hat with theme ribbon
    stamp(g, 5, 2, [
      "......bbbbbbbb......",
      ".....bbbbbbbbbb.....",
      ".....ddAAAAAAdd.....",
      ".bbbbbbbbbbbbbbbbbb.",
    ]);
    // Friendly warm stubble beard
    stamp(g, 11, 15, ["BBBBBBBBBB"]);
    // Metal watering can + little sprout on right
    stamp(g, 22, 19, [".ggg.", "ggggg", ".ggg."]);
    stamp(g, 25, 25, [".V.", "vVv", ".v."]);
  },
});
const gardenerBase = finalize(gardenerRaw);
const gardenerAnimations = [
  clip("bloom", "巨花暴长", [180, 150, 150, 170, 200], [
    finalize(clone(gardenerRaw), (g) => {
      stamp(g, 25, 21, [".C.", "..c"]);
    }),
    finalize(clone(gardenerRaw), (g) => {
      stamp(g, 24, 18, ["..M..", ".MYM.", "..M..", ".vVv.", "..v.."]);
    }),
    finalize(shiftBody(gardenerRaw, -2, 0), (g) => {
      // 比人还高的巨型狂野向日葵拔地而起！
      stamp(g, 22, 8, [
        "..YYYYY..",
        ".YYBBBYY.",
        "YYBWWWBYY",
        ".YYBBBYY.",
        "..YYYYY..",
        "....v....",
        "...vVv...",
        "....v....",
        "...vVv...",
        "....v....",
      ]);
    }),
    finalize(eyesGlow(shiftBody(gardenerRaw, -2, -1, "shrink"), "Y"), (g) => {
      stamp(g, 21, 5, [
        ".Y.YYYYY.Y",
        "..YYBBBYY.",
        ".YYBWWWBYY",
        "..YYBBBYY.",
        ".Y.YYYYY.Y",
        ".....v....",
        "....vVv...",
        ".....v....",
      ]);
    }, "shrink"),
    finalize(eyesHappy(clone(gardenerRaw)), (g) => {
      stamp(g, 24, 17, [".MMM.", "MYYYM", ".MMM.", ".vVv."]);
    }),
  ]),
  clip("prune", "落叶暴雪", [150, 120, 120, 150], [
    finalize(clone(gardenerRaw), (g) => {
      stamp(g, 23, 16, ["G.G", ".G.", "GGG"]);
    }),
    finalize(shiftBody(gardenerRaw, 0, -1, "shrink"), (g) => {
      stamp(g, 1, 2, ["V..v....................V..v", "..V......................v.."]);
      stamp(g, 23, 15, ["GG.", ".GG", "GGG"]);
    }, "shrink"),
    finalize(shiftBody(gardenerRaw, 1, 0), (g) => {
      stamp(g, 2, 1, ["v....V.......V.......V....v", "..V..........v..........V.."]);
      stamp(g, 23, 16, ["G.G", ".G.", "GGG"]);
    }),
    finalize(eyesHappy(clone(gardenerRaw)), (g) => {
      stamp(g, 3, 5, ["V........................v"]);
    }),
  ]),
  clip("butterfly", "群蝶抢帽", [170, 150, 150, 170], [
    finalize(clone(gardenerRaw), (g) => {
      stamp(g, 24, 3, ["Y.Y", "YMY", "Y.Y"]);
    }),
    finalize(shiftBody(gardenerRaw, 0, -1, "shrink"), (g) => {
      stamp(g, 2, 1, ["M.M....................Y.Y", "MYM....................YCY", "M.M....................Y.Y"]);
    }, "shrink"),
    finalize(eyesShock(stamp(clone(gardenerRaw), 5, 2, ["____________________", "____________________", "____________________", "____________________"])), (g) => {
      // 群蝶把大草帽直接叼飞半空！
      stamp(g, 6, 0, ["M.M.bbbbbbbb.Y.Y", "MYMbbbbbbbbbbYCY", "....ddAAAAAAdd.."]);
    }),
    finalize(eyesHappy(clone(gardenerRaw)), (g) => {
      stamp(g, 3, 1, ["C.C..................M.M", "CYC..................MYM"]);
    }),
  ]),
  clip("carrot", "拔出巨萝卜", [200, 170, 140, 180], [
    finalize(shiftBody(gardenerRaw, -1, 1), (g) => {
      stamp(g, 23, 21, ["vVv", ".v.", "FFF"]);
    }),
    finalize(mouthShout(shiftBody(gardenerRaw, -2, 1)), (g) => {
      stamp(g, 7, 10, ["C", "C"]);
      stamp(g, 23, 17, ["vVvVv", ".vVv.", ".FFF.", ".FFF.", "..F.."]);
    }),
    finalize(eyesShock(shiftBody(gardenerRaw, -2, -2, "tiny")), (g) => {
      // 拔出比人还大的超级巨无霸橙萝卜！
      stamp(g, 21, 5, [
        ".vVvVvV.",
        "..vVvV..",
        ".FFFFFF.",
        "FFYFFFFF",
        ".FFFFFF.",
        "..FFFF..",
        "...FF...",
        "....F...",
      ]);
      stamp(g, 20, 3, ["Y.....Y"]);
    }, "tiny"),
    finalize(eyesHappy(clone(gardenerRaw)), (g) => {
      stamp(g, 23, 12, [".vVv.", "FFFFF", ".FFF.", "..F.."]);
    }),
  ]),
  clip("rainbow", "彩虹洒水", [180, 160, 160, 180], [
    finalize(clone(gardenerRaw), (g) => {
      stamp(g, 24, 15, ["C.c", ".C."]);
    }),
    finalize(clone(gardenerRaw), (g) => {
      stamp(g, 19, 3, ["...RRRR..", "..RYYYYR.", ".RYVVVVYR", "RYVCCCCVY"]);
    }),
    finalize(eyesHappy(shiftBody(gardenerRaw, 0, -1, "shrink")), (g) => {
      stamp(g, 16, 1, [
        "....RRRRRR....",
        "..RRYYYYYYRR..",
        ".RYVVVVVVVVYR.",
        "RYVCCCCCCCCVYR",
        "YVCMMMMMMMMCVY",
      ]);
    }, "shrink"),
    finalize(eyesHappy(clone(gardenerRaw)), (g) => {
      stamp(g, 20, 4, ["..RRRR..", ".RYYYYR.", "RYVVVVYR"]);
    }),
  ]),
];

// --- 13. 摄影师 (女) ---
const photographerRaw = buildChibi({
  gender: "female", hairStyle: "bob", coat: "jacket",
  extras(g) {
    // Retro silver-black camera hung in front
    stamp(g, 11, 19, [
      "..gggggg..",
      "OOggCCggOO",
      "OOgCWWCgOO",
      "OOggCCggOO",
      "OOOOOOOOOO",
    ]);
  },
});
const photographerBase = finalize(photographerRaw);
const photographerAnimations = [
  clip("flash", "核爆闪光灯", [220, 100, 120, 150, 200], [
    photographerBase,
    finalize(shiftBody(photographerRaw, 0, -1, "shrink"), (g) => {
      // 核爆级纯白金十字闪光灯！
      stamp(g, 6, 9, [
        ".........y.........",
        ".........W.........",
        ".......yWWWy.......",
        "....yWWWWWWWWWy....",
        "..yWWWWWWWWWWWWWy..",
        "yWWWWWWWWWWWWWWWWWy",
        "..yWWWWWWWWWWWWWy..",
        "....yWWWWWWWWWy....",
        ".......yWWWy.......",
        ".........W.........",
        ".........y.........",
      ]);
    }, "shrink"),
    finalize(shiftBody(photographerRaw, 0, -1, "shrink"), (g) => {
      stamp(g, 10, 13, ["....y....", "..yWWWy..", "yWWWWWWWy", "..yWWWy..", "....y...."]);
    }, "shrink"),
    finalize(clone(photographerRaw), (g) => {
      stamp(g, 13, 17, ["..W..", ".yWy.", "..W.."]);
    }),
    finalize(eyesBlink(clone(photographerRaw))),
  ]),
  clip("focus", "鬼畜贴地拍", [180, 140, 140, 180], [
    finalize(shiftBody(photographerRaw, 0, 2), (g) => {
      stamp(g, 2, 2, ["RRR......................RRR", "R..........................R"]);
      stamp(g, 2, 27, ["R..........................R", "RRR......................RRR"]);
    }),
    finalize(shiftBody(photographerRaw, -2, 2), (g) => {
      stamp(g, 4, 4, ["RRR..................RRR", "R......................R"]);
      stamp(g, 4, 25, ["R......................R", "RRR..................RRR"]);
    }),
    finalize(shiftBody(photographerRaw, 2, 2), (g) => {
      stamp(g, 6, 6, ["VVV..............VVV", "V..................V"]);
      stamp(g, 6, 23, ["V..................V", "VVV..............VVV"]);
    }),
    finalize(clone(photographerRaw), (g) => {
      stamp(g, 6, 6, ["VVV..............VVV", "V..................V"]);
    }),
  ]),
  clip("review", "绝片蹦高", [170, 140, 140, 170], [
    finalize(clone(photographerRaw), (g) => {
      stamp(g, 23, 8, [".M.M.", "MMMMM", ".MMM.", "..M.."]);
    }),
    finalize(eyesGlow(shiftBody(photographerRaw, 0, -2, "tiny"), "M"), (g) => {
      stamp(g, 2, 1, ["Y..M.M................M.M..Y", "...MMM................MMM...", "....M..................M...."]);
    }, "tiny"),
    finalize(eyesHappy(shiftBody(photographerRaw, 0, -3, "none")), (g) => {
      stamp(g, 1, 0, [".M.M....................Y..", ".MMM...................YYY.", "..M.....................Y.."]);
    }, "none"),
    finalize(eyesHappy(clone(photographerRaw)), (g) => {
      stamp(g, 4, 3, ["Y......................M"]);
    }),
  ]),
  clip("burst", "机关枪连拍", [100, 100, 100, 100, 140], [
    finalize(shiftBody(photographerRaw, -1, 0), (g) => {
      stamp(g, 12, 16, ["..W..", ".yWy.", "..W.."]);
    }),
    finalize(shiftBody(photographerRaw, 1, -1, "shrink"), (g) => {
      stamp(g, 13, 15, ["..y..", ".WWW.", "yWWWy", ".WWW."]);
      stamp(g, 23, 10, ["w.w", ".w."]);
    }, "shrink"),
    finalize(shiftBody(photographerRaw, -1, 0), (g) => {
      stamp(g, 11, 16, [".Y.W.", "WWWWW", ".W.Y."]);
      stamp(g, 4, 9, ["w.w", ".w."]);
    }),
    finalize(shiftBody(photographerRaw, 1, -1, "shrink"), (g) => {
      stamp(g, 13, 15, ["..W..", "yWWWy", "..W.."]);
      stamp(g, 22, 7, ["w..w", ".w.."]);
    }, "shrink"),
    finalize(eyesBlink(clone(photographerRaw)), (g) => {
      stamp(g, 12, 13, ["w...w...w"]);
    }),
  ]),
  clip("selfie", "剪刀手自拍", [190, 160, 160, 190], [
    finalize(clone(photographerRaw), (g) => {
      stamp(g, 23, 13, ["S.S", "S.S", "SSS"]);
    }),
    finalize(eyesHappy(shiftBody(photographerRaw, 1, -1, "shrink")), (g) => {
      stamp(g, 23, 10, ["S.S", "S.S", "SSS"]);
      stamp(g, 2, 2, ["..Y.......................M..", ".YYY.....................MMM.", "..Y.......................M.."]);
    }, "shrink"),
    finalize(eyesHappy(clone(photographerRaw)), (g) => {
      stamp(g, 23, 11, ["S.S", "S.S", "SSS"]);
      stamp(g, 3, 1, ["M...Y...................Y...M"]);
    }),
    finalize(clone(photographerRaw), (g) => {
      stamp(g, 24, 12, ["S.S", "SSS"]);
      stamp(g, 25, 6, ["Y"]);
    }),
  ]),
];

// --- 14. 骑士 (男) ---
const courierRaw = buildChibi({
  gender: "male", hairStyle: "short", coat: "jacket",
  extras(g) {
    // Aerodynamic helmet + clear cyan visor
    stamp(g, 8, 3, [
      "...AAAAAAAAAA...",
      "..aAAAAAAAAAAA..",
      ".AAAAAACCCCCCCC.",
      ".AAAAACWWWCCCCC.",
      ".dAAAACCCCCCCCC.",
    ]);
    // Cardboard delivery box in right arm
    stamp(g, 20, 19, ["bbbbbbbb", "bbbBBbbb", "bbbbbbbb", "bbbbbbbb"]);
  },
});
const courierBase = finalize(courierRaw);
const courierAnimations = [
  clip("dash", "音爆风火轮", [110, 100, 100, 110], [
    finalize(withAfterimage(shiftBody(courierRaw, 2, 0), courierRaw, -3, 0, "c"), (g) => {
      stamp(g, 0, 14, ["WWWWW.", "......", "CCCCCC"]);
    }),
    finalize(withAfterimage(stepFeet(shiftBody(courierRaw, 3, -1, "shrink"), "left"), courierRaw, -3, -1, "c"), (g) => {
      stamp(g, 0, 11, ["CCCCC..", ".......", "WWWWWW.", ".......", ".CCCCC."]);
    }, "shrink"),
    finalize(withAfterimage(stepFeet(shiftBody(courierRaw, 2, 0), "right"), courierRaw, -4, 0, "w"), (g) => {
      stamp(g, 0, 12, ["WWWWWW.", ".......", "CCCCCC.", ".......", "WWWWWW."]);
    }),
    finalize(withAfterimage(stepFeet(shiftBody(courierRaw, 3, -1, "shrink"), "left"), courierRaw, -3, 0, "c"), (g) => {
      stamp(g, 0, 13, ["CCCCC.", "......", "WWWWW."]);
    }, "shrink"),
  ]),
  clip("scan", "激光签收", [180, 140, 140, 200], [
    finalize(clone(courierRaw), (g) => {
      stamp(g, 21, 15, ["gRR."]);
    }),
    finalize(clone(courierRaw), (g) => {
      stamp(g, 20, 14, ["gRRRRRRRRRR", ".RRRRRRRRRR"]);
    }),
    finalize(eyesGlow(shiftBody(courierRaw, 0, -1, "shrink"), "V"), (g) => {
      stamp(g, 22, 3, [".....VV", "....VV.", "...VV..", "V.VV...", "VVV....", ".V....."]);
    }, "shrink"),
    finalize(eyesHappy(clone(courierRaw)), (g) => {
      stamp(g, 22, 4, ["....VV", "...VV.", "V.VV..", ".VV..."]);
    }),
  ]),
  clip("fivestar", "天降五星", [170, 150, 150, 180], [
    finalize(shiftBody(courierRaw, 0, -1, "shrink"), (g) => {
      stamp(g, 20, 9, ["bbbbbbbb", "bbbBBbbb", "bbbbbbbb"]);
    }, "shrink"),
    finalize(shiftBody(courierRaw, 0, -2, "tiny"), (g) => {
      stamp(g, 2, 0, [".Y.....Y.....Y.....Y.....Y", "YYY...YYY...YYY...YYY...YYY", ".Y.....Y.....Y.....Y.....Y"]);
    }, "tiny"),
    finalize(eyesGlow(shiftBody(courierRaw, 0, -1, "shrink"), "Y"), (g) => {
      stamp(g, 4, 1, [".Y.......Y.......Y", "YYY.....YYY.....YYY", ".Y.......Y.......Y"]);
    }, "shrink"),
    finalize(eyesHappy(clone(courierRaw)), (g) => {
      stamp(g, 5, 2, ["Y.........Y.........Y"]);
    }),
  ]),
  clip("stack", "杂技叠箱", [180, 150, 150, 180], [
    finalize(clone(courierRaw), (g) => {
      stamp(g, 11, 0, ["bbbbbbbb", "bbbBBbbb", "bbbbbbbb"]);
    }),
    finalize(shiftBody(courierRaw, -1, 0), (g) => {
      stamp(g, 13, 0, ["bbbbbb", "bbBBbb"]);
      stamp(g, 9, 2, ["bbbbbbbb", "bbbBBbbb"]);
    }),
    finalize(shiftBody(courierRaw, 1, 0), (g) => {
      stamp(g, 11, 0, ["bbbbbb", "bbBBbb"]);
      stamp(g, 13, 2, ["bbbbbbbb", "bbbBBbbb"]);
      stamp(g, 5, 11, ["C", "C"]);
    }),
    finalize(eyesHappy(clone(courierRaw)), (g) => {
      stamp(g, 12, 0, ["bbbbbbbb", "bbbBBbbb"]);
    }),
  ]),
  clip("horn", "喇叭催单", [160, 130, 130, 160], [
    finalize(clone(courierRaw), (g) => {
      stamp(g, 23, 10, ["Y.Y", ".Y."]);
    }),
    finalize(shiftBody(courierRaw, 1, -1, "shrink"), (g) => {
      stamp(g, 23, 6, ["..Y.F.", ".Y...F", "Y....F", ".Y...F", "..Y.F."]);
      stamp(g, 14, 5, ["WWWWWWWW"]);
    }, "shrink"),
    finalize(mouthShout(clone(courierRaw)), (g) => {
      stamp(g, 22, 4, ["...Y.F.R", "..Y...F.", ".Y....F.", "..Y...F.", "...Y.F.R"]);
    }),
    finalize(clone(courierRaw), (g) => {
      stamp(g, 24, 9, [".Y.", "Y.Y"]);
    }),
  ]),
];

// --- 15. 魔法师 (女) ---
const wizardRaw = buildChibi({
  gender: "female", hairStyle: "long", coat: "robe",
  extras(g) {
    // Tall pointed starry wizard hat
    stamp(g, 7, 0, [
      "........A.......",
      ".......AAA......",
      "......AAYAA.....",
      ".....AAAAAAA....",
      "....AAAAAAAAA...",
      "..ddYYYYYYYYYdd.",
    ]);
    // Wooden crystal magic staff
    stamp(g, 24, 12, [".CCC.", "CCWCC", ".CCC.", "..B..", "..B..", "..B..", "..B..", "..B..", "..B.."]);
  },
});
const wizardBase = finalize(wizardRaw);
const wizardAnimations = [
  clip("cast", "雷电星阵", [170, 140, 140, 170], [
    finalize(clone(wizardRaw), (g) => {
      stamp(g, 2, 4, ["Y...", "....", "..u."]);
    }),
    finalize(eyesGlow(shiftBody(wizardRaw, 0, -1, "shrink"), "C"), (g) => {
      stamp(g, 1, 1, ["Y..u....................Y..u"]);
      stamp(g, 22, 8, ["..Y.C.Y..", ".CWWWWWC.", "..YCYCY.."]);
    }, "shrink"),
    finalize(eyesGlow(shiftBody(wizardRaw, 0, -2, "tiny"), "Y"), (g) => {
      stamp(g, 1, 0, [".C..Y..................Y..M.", "Y..........................Y"]);
      stamp(g, 21, 7, ["..Y.M.Y..", ".CWWWWWC.", "YWWCCCWWY", ".CWWWWWC.", "..Y.C.Y.."]);
    }, "tiny"),
    finalize(eyesBlink(clone(wizardRaw)), (g) => {
      stamp(g, 2, 3, [".u......................u", "Y.......................Y"]);
    }),
  ]),
  clip("orb", "魔球失控", [190, 150, 150, 190], [
    finalize(shiftBody(wizardRaw, 0, -1, "shrink"), (g) => {
      stamp(g, 22, 11, [".UUU.", "UCCCU", ".UUU."]);
    }, "shrink"),
    finalize(eyesGlow(shiftBody(wizardRaw, 0, -2, "tiny"), "U"), (g) => {
      stamp(g, 20, 7, ["..UUUUU..", ".UWWCWWU.", "UWCCWCCWU", ".UCWWWCW.", "..UUUUU.."]);
    }, "tiny"),
    finalize(eyesShock(shiftBody(wizardRaw, 0, -3, "none")), (g) => {
      // 失控超级发光魔球把魔法师自己都吹浮空！
      stamp(g, 19, 4, [
        "...uUUUUu...",
        "..UWWWWWWU..",
        ".UWCCWWCCWU.",
        ".UWWWWWWWWU.",
        "..UWWWWWWU..",
        "...uUUUUu...",
      ]);
    }, "none"),
    finalize(shiftBody(wizardRaw, 0, -1, "shrink"), (g) => {
      stamp(g, 22, 10, [".uUUu.", "UCCCCU", ".uUUu."]);
    }, "shrink"),
  ]),
  clip("meteor", "帽尖烟花", [160, 130, 130, 160], [
    finalize(clone(wizardRaw), (g) => {
      stamp(g, 9, 0, ["Y....Y....Y", ".M.......C."]);
    }),
    finalize(shiftBody(wizardRaw, 0, -1, "shrink"), (g) => {
      stamp(g, 2, 0, ["Y.....M..Y..C.....Y", ".C...Y.......Y...M.", "..M.............C.."]);
    }, "shrink"),
    finalize(eyesGlow(clone(wizardRaw), "M"), (g) => {
      stamp(g, 1, 0, [
        "M..C....Y..Y....M..C",
        ".Y.....M....C.....Y.",
        "..C...Y......Y...M..",
        "Y..................Y",
      ]);
    }),
    finalize(eyesHappy(clone(wizardRaw)), (g) => {
      stamp(g, 4, 1, ["C.....Y.....M.....C"]);
    }),
  ]),
  clip("frog", "变青蛙乌龙", [190, 140, 190, 190], [
    finalize(clone(wizardRaw), (g) => {
      stamp(g, 23, 11, ["u.U.u"]);
    }),
    finalize(eyesShock(clone(wizardRaw)), (g) => {
      stamp(g, 21, 18, [".uUUu.", "uUUUUu", ".uUUu."]);
    }),
    finalize(eyesShock(clone(wizardRaw)), (g) => {
      // 砰！蹦出一只吐红舌的像素小绿蛙！
      stamp(g, 23, 21, [".V..V.", "VEVVEV", "VVVVVV", "VVRRVV", "V....V"]);
      stamp(g, 6, 10, ["C", "C"]);
    }),
    finalize(eyesDizzy(clone(wizardRaw)), (g) => {
      stamp(g, 23, 18, [".V..V.", "VEVVEV", "VVVVVV", "V....V"]);
    }),
  ]),
  clip("broom", "扫帚狂飙", [140, 120, 120, 140], [
    finalize(shiftBody(wizardRaw, 0, -2, "tiny"), (g) => {
      stamp(g, 3, 22, ["bbBBBBBBBBBBBBBBBBBBBBbb"]);
      stamp(g, 0, 21, ["bbb", "bbY", "bbb"]);
    }, "tiny"),
    finalize(shiftBody(wizardRaw, 1, -3, "none"), (g) => {
      stamp(g, 4, 21, ["bbBBBBBBBBBBBBBBBBBBBB"]);
      stamp(g, 0, 20, ["Y.bbb", ".YbbY", "C.bbb"]);
    }, "none"),
    finalize(eyesHappy(shiftBody(wizardRaw, 2, -4, "none")), (g) => {
      stamp(g, 5, 20, ["bbBBBBBBBBBBBBBBBBBBBB"]);
      stamp(g, 0, 19, ["Y.C.bbb", "M.Y.bbY", "Y...bbb"]);
    }, "none"),
    finalize(shiftBody(wizardRaw, 0, -2, "tiny"), (g) => {
      stamp(g, 3, 22, ["bbBBBBBBBBBBBBBBBBBBBB"]);
      stamp(g, 0, 21, ["Ybb", "bbb"]);
    }, "tiny"),
  ]),
];

// --- 16. 运动员 (男) ---
const athleteRaw = buildChibi({
  gender: "male", hairStyle: "spiky", coat: "jersey", legs: "shorts", boots: "white",
  extras(g) {
    // Theme sweatband across forehead
    fill(g, 10, 7, 12, 2, "A"); fill(g, 11, 7, 4, 1, "a");
    // Basketball on right
    stamp(g, 23, 21, [".FFF.", "FFBFF", "FBBBF", "FFBFF", ".FFF."]);
  },
});
const athleteBase = finalize(athleteRaw);
const athleteAnimations = [
  clip("dribble", "燃火运球", [140, 120, 120, 140], [
    finalize(clone(athleteRaw), (g) => {
      stamp(g, 23, 18, ["..Y..", ".FYF."]);
    }),
    finalize(shiftBody(athleteRaw, 0, 1), (g) => {
      stamp(g, 22, 22, ["..Y..", ".FYF.", ".FFF.", "FBBBF", ".FFF."]);
    }),
    finalize(eyesGlow(clone(athleteRaw), "F"), (g) => {
      stamp(g, 22, 16, ["..R..", ".FYF.", "FFYFF", "FBBBF", ".FFF."]);
    }),
    finalize(shiftBody(athleteRaw, 0, -1, "shrink"), (g) => {
      stamp(g, 22, 15, ["..Y..", ".FYF.", ".FFF.", "FBBBF", ".FYF."]);
    }, "shrink"),
  ]),
  clip("warmup", "热血蛙跳", [140, 120, 120, 150], [
    finalize(shiftBody(athleteRaw, 0, 2)),
    finalize(armsUp(shiftBody(athleteRaw, 0, -2, "tiny")), (g) => {
      stamp(g, 2, 4, ["C........................C", ".c......................c."]);
    }, "tiny"),
    finalize(eyesGlow(armsUp(shiftBody(athleteRaw, 0, -4, "none")), "C"), (g) => {
      stamp(g, 1, 2, ["C.c....................c.C", "..C....................C.."]);
    }, "none"),
    finalize(shiftBody(athleteRaw, 0, 1), (g) => {
      stamp(g, 3, 7, ["C........................C"]);
    }),
  ]),
  clip("trophy", "夺冠狂欢", [190, 150, 150, 190], [
    finalize(clone(athleteRaw), (g) => {
      stamp(g, 22, 12, ["YYYYYY", ".YYYY.", "..YY..", ".YYYY."]);
    }),
    finalize(eyesGlow(shiftBody(athleteRaw, 0, -1, "shrink"), "Y"), (g) => {
      stamp(g, 21, 5, ["Y......Y", ".YYYYYY.", ".YYWWYY.", "..YYYY..", "...YY...", "..YYYY.."]);
    }, "shrink"),
    finalize(eyesGlow(shiftBody(athleteRaw, 0, -2, "tiny"), "Y"), (g) => {
      stamp(g, 1, 0, ["Y..M..............YYYYYY..C", "..C...............YYWWYY.Y.", "...................YYYY....", "....................YY.....", "...................YYYY...."]);
    }, "tiny"),
    finalize(eyesHappy(clone(athleteRaw)), (g) => {
      stamp(g, 22, 10, [".Y..Y.", "YYYYYY", ".YYYY.", "..YY..", ".YYYY."]);
    }),
  ]),
  clip("dunk", "超级暴扣", [150, 130, 120, 160], [
    finalize(shiftBody(athleteRaw, 0, 1)),
    finalize(shiftBody(athleteRaw, 0, -3, "tiny"), (g) => {
      stamp(g, 13, 0, [".FFF.", "FFBFF", "FBBBF", ".FFF."]);
    }, "tiny"),
    finalize(eyesGlow(shiftBody(athleteRaw, 0, -2, "none"), "F"), (g) => {
      stamp(g, 13, 0, ["YFFFY", "FBBBF", "YFFFY"]);
      stamp(g, 4, 20, ["F......................F"]);
    }, "none"),
    finalize(shiftBody(athleteRaw, 0, 2), (g) => {
      // 暴扣落地金色冲击波！
      stamp(g, 2, 26, ["Y.F.Y..................Y.F.Y", ".YYY....................YYY."]);
    }),
  ]),
  clip("flex", "肌肉爆气", [180, 140, 130, 170], [
    finalize(clone(athleteRaw), (g) => {
      stamp(g, 4, 15, ["SS", "SS"]); stamp(g, 26, 15, ["SS", "SS"]);
    }),
    finalize(eyesGlow(shiftBody(athleteRaw, 0, -1, "shrink"), "Y"), (g) => {
      // 赛亚人式金色气焰！
      stamp(g, 2, 2, ["..Y....................Y..", ".Y.Y..................Y.Y.", "Y........................Y"]);
      stamp(g, 3, 14, ["YSS", "SSS"]); stamp(g, 26, 14, ["SSY", "SSS"]);
    }, "shrink"),
    finalize(eyesGlow(mouthShout(shiftBody(athleteRaw, 0, -1, "shrink")), "Y"), (g) => {
      stamp(g, 1, 0, [
        "..Y..Y..............Y..Y..",
        ".Y.YY.Y............Y.YY.Y.",
        "Y..FF..Y..........Y..FF..Y",
        ".Y....Y............Y....Y.",
      ]);
      stamp(g, 3, 14, ["FSS", "SSS"]); stamp(g, 26, 14, ["SSF", "SSS"]);
    }, "shrink"),
    finalize(eyesHappy(clone(athleteRaw)), (g) => {
      stamp(g, 4, 4, ["Y......................Y"]);
    }),
  ]),
];

// --- 17. 机长 (女) ---
const pilotRaw = buildChibi({
  gender: "female", hairStyle: "bob", eyeStyle: "shades", coat: "pilot",
  extras(g) {
    // Captain peaked cap with gold wing emblem
    stamp(g, 9, 2, [
      "...AAAAAAAA...",
      "..AAAYYYYAAA..",
      ".ddAAAAAAAAAdd",
      ".OOOOOOOOOOOO.",
    ]);
  },
});
const pilotBase = finalize(pilotRaw);
const pilotAnimations = [
  clip("salute", "墨镜死光", [190, 140, 140, 180], [
    finalize(clone(pilotRaw), (g) => {
      stamp(g, 2, 3, [".WW.", "WWWW"]);
    }),
    finalize(glassesFlash(clone(pilotRaw)), (g) => {
      stamp(g, 1, 2, ["..WW..................WW..", ".WWWW................WWWW."]);
    }),
    finalize(shiftBody(pilotRaw, 0, -1, "shrink"), (g) => {
      stamp(g, 22, 8, ["SS", "SS"]);
      stamp(g, 1, 2, ["....WW..............WW....", "...WWWW............WWWW..."]);
      stamp(g, 11, 10, ["WW....WW"]);
    }, "shrink"),
    finalize(clone(pilotRaw), (g) => {
      stamp(g, 5, 3, [".WW..............WW.", "WWWW............WWWW"]);
    }),
  ]),
  clip("takeoff", "战机拉升", [150, 130, 130, 150], [
    finalize(clone(pilotRaw), (g) => {
      stamp(g, 22, 14, ["...W..", "..WWW.", ".WWWWW", "w..W.."]);
    }),
    finalize(shiftBody(pilotRaw, -1, 0), (g) => {
      stamp(g, 21, 9, ["....W...", "...WWW..", "..WWWWW.", ".w..W...", "w......."]);
    }),
    finalize(shiftBody(pilotRaw, -1, -1, "shrink"), (g) => {
      stamp(g, 20, 3, [".....W..", "....WWW.", "...WWWWW", "..w..W..", ".w......", "w......."]);
    }, "shrink"),
    finalize(clone(pilotRaw), (g) => {
      stamp(g, 22, 1, ["...W..", "..WWW.", ".WWWWW", "w..W.."]);
    }),
  ]),
  clip("radio", "塔台狂呼", [170, 140, 140, 170], [
    finalize(clone(pilotRaw), (g) => {
      stamp(g, 23, 9, ["..C.", ".C.C", "S.C."]);
    }),
    finalize(mouthShout(shiftBody(pilotRaw, 0, -1, "shrink")), (g) => {
      stamp(g, 22, 6, ["...C..", "..C.C.", ".C..C.", "S.C.C.", "..C..."]);
    }, "shrink"),
    finalize(mouthShout(clone(pilotRaw)), (g) => {
      stamp(g, 22, 4, ["....C.", "...C.C", "..C..C", ".C..C.", "S.C.C.", "...C.."]);
    }),
    finalize(clone(pilotRaw), (g) => {
      stamp(g, 23, 8, [".C..", "C.C.", "S.C."]);
    }),
  ]),
  clip("barrel", "空中炫技", [160, 130, 130, 160], [
    finalize(clone(pilotRaw), (g) => {
      stamp(g, 2, 10, ["WW.", "WWW", "WW."]);
    }),
    finalize(shiftBody(pilotRaw, 0, -1, "shrink"), (g) => {
      stamp(g, 8, 2, ["..WWW..", "w..W..Y"]);
    }, "shrink"),
    finalize(shiftBody(pilotRaw, 0, -1, "shrink"), (g) => {
      stamp(g, 23, 6, ["Y..W..", ".WWWWW", "...W.."]);
      stamp(g, 14, 1, ["w.w.w.w"]);
    }, "shrink"),
    finalize(clone(pilotRaw), (g) => {
      stamp(g, 23, 14, [".WW", "WWW", ".WW"]);
      stamp(g, 24, 9, ["Y"]);
    }),
  ]),
  clip("turbulence", "气流颠簸", [120, 110, 110, 130], [
    finalize(shiftBody(pilotRaw, -2, 0), (g) => {
      stamp(g, 24, 6, ["WWWWW", "w...w"]);
    }),
    finalize(shiftBody(pilotRaw, 2, -1, "shrink"), (g) => {
      stamp(g, 2, 5, ["WWWWW", "w...w"]);
      stamp(g, 22, 4, ["SS"]); // 扶住机长帽！
    }, "shrink"),
    finalize(shiftBody(pilotRaw, -2, 1), (g) => {
      stamp(g, 23, 4, ["WWWWW"]);
      stamp(g, 8, 4, ["SS"]);
    }),
    finalize(glassesFlash(clone(pilotRaw)), (g) => {
      stamp(g, 4, 4, ["Y......................Y"]);
    }),
  ]),
];

// --- 18. 工程师 (男) ---
const mechanicRaw = buildChibi({
  gender: "male", hairStyle: "short", coat: "overalls",
  extras(g) {
    // Yellow safety hard hat
    stamp(g, 8, 2, [
      "....YYYYYY....",
      "..YYYYYYYYYY..",
      ".YYYYyYYYYYYY.",
      "YYYYYYYYYYYYYY",
    ]);
    // Chunky silver wrench in right hand
    stamp(g, 23, 14, ["G..G", "GGGG", ".GG.", ".GG.", ".GG.", ".GG."]);
  },
});
const mechanicBase = finalize(mechanicRaw);
const mechanicAnimations = [
  clip("wrench", "电焊级猛拧", [150, 120, 120, 150], [
    finalize(clone(mechanicRaw), (g) => {
      stamp(g, 23, 10, ["..Y.."]);
    }),
    finalize(shiftBody(mechanicRaw, -1, 1), (g) => {
      stamp(g, 21, 9, [".Y..F..Y", "..F.Y.F.", "...G..G.", "..YGGGGF"]);
    }),
    finalize(eyesGlow(shiftBody(mechanicRaw, 1, -1, "shrink"), "Y"), (g) => {
      stamp(g, 20, 7, ["Y..W..F..Y", ".F.Y.W..F.", "..YG..GY..", "...GGGG..."]);
    }, "shrink"),
    finalize(eyesBlink(clone(mechanicRaw)), (g) => {
      stamp(g, 23, 11, ["...Y.."]);
    }),
  ]),
  clip("gears", "暴走齿轮", [160, 130, 130, 160], [
    finalize(clone(mechanicRaw), (g) => {
      stamp(g, 22, 10, [".G.G.", "GGYGG", ".GGG.", "GGYGG", ".G.G."]);
    }),
    finalize(shiftBody(mechanicRaw, 0, -1, "shrink"), (g) => {
      stamp(g, 22, 10, ["G...G", ".GGG.", "GGVGG", ".GGG.", "G...G"]);
      stamp(g, 2, 12, [".G.G.", "GGRGG", ".G.G."]);
    }, "shrink"),
    finalize(clone(mechanicRaw), (g) => {
      stamp(g, 22, 10, [".G.G.", "GGRGG", ".GGG.", "GGYGG", ".G.G."]);
      stamp(g, 2, 12, ["G...G", "GGVGG", "G...G"]);
    }),
    finalize(eyesHappy(clone(mechanicRaw)), (g) => {
      stamp(g, 22, 10, ["G...G", ".GGG.", "GGVGG", ".GGG.", "G...G"]);
    }),
  ]),
  clip("greenlight", "一敲修好", [180, 140, 140, 190], [
    finalize(shiftBody(mechanicRaw, 0, -1, "shrink"), (g) => {
      stamp(g, 23, 8, ["G..G", "GGGG", ".GG."]);
    }, "shrink"),
    finalize(shiftBody(mechanicRaw, 1, 1), (g) => {
      // 物理维修神技：一敲下去火花四溅！
      stamp(g, 22, 15, ["Y.F.Y", "GGGG.", "Y.F.Y"]);
    }),
    finalize(eyesGlow(shiftBody(mechanicRaw, 0, -1, "shrink"), "V"), (g) => {
      stamp(g, 22, 3, [".....VV", "....VV.", "...VV..", "V.VV...", "VVV....", ".V....."]);
    }, "shrink"),
    finalize(eyesHappy(clone(mechanicRaw)), (g) => {
      stamp(g, 22, 4, ["....VV", "...VV.", "V.VV..", ".VV..."]);
    }),
  ]),
  clip("drill", "电钻震动", [90, 90, 90, 90, 130], [
    finalize(shiftBody(mechanicRaw, -1, 0), (g) => {
      stamp(g, 22, 17, ["YYYYgGG", "YYYYg..", "YY....."]);
    }),
    finalize(withAfterimage(shiftBody(mechanicRaw, 2, 0), mechanicRaw, -2, 0, "w"), (g) => {
      stamp(g, 23, 16, ["YYYYgGGG", "YYYYg..Y", "YY.....F"]);
    }),
    finalize(withAfterimage(shiftBody(mechanicRaw, -2, 0), mechanicRaw, 2, 0, "w"), (g) => {
      stamp(g, 21, 17, ["YYYYgGGG", "YYYYg..F", "YY.....Y"]);
    }),
    finalize(shiftBody(mechanicRaw, 1, 0), (g) => {
      stamp(g, 22, 16, ["YYYYgGG", "YYYYg.Y"]);
    }),
    finalize(eyesDizzy(clone(mechanicRaw))),
  ]),
  clip("oil", "机油溅脸", [180, 140, 200, 200], [
    finalize(clone(mechanicRaw), (g) => {
      stamp(g, 24, 14, ["OO", "OO"]);
    }),
    finalize(eyesShock(shiftBody(mechanicRaw, -1, 0)), (g) => {
      stamp(g, 14, 11, ["O..O..OO", ".OO..OOO"]);
    }),
    finalize(eyesShock(clone(mechanicRaw)), (g) => {
      // 黑亮机油糊在脸上，只剩大白眼！
      stamp(g, 10, 10, ["OO.OO..OOO", "OWEOOOWEOO", "OEEOOOEEOO", ".OO..OOOO."]);
    }),
    finalize(eyesBlink(clone(mechanicRaw)), (g) => {
      stamp(g, 10, 10, ["OO.OO..OOO", "..........", ".OO..OOOO."]);
    }),
  ]),
];

// --- 19. 烘焙师 (女) ---
const bakerRaw = buildChibi({
  gender: "female", hairStyle: "bob", coat: "apron",
  extras(g) {
    // Big theme bow headband
    stamp(g, 10, 2, [
      "AA......AA",
      "AAAaaAAaaa",
      "AA..aa..AA",
    ]);
    // Cherry cupcake in right hand
    stamp(g, 23, 17, ["..R..", ".MMM.", "WWWWW", ".bbb.", ".bbb."]);
  },
});
const bakerBase = finalize(bakerRaw);
const bakerAnimations = [
  clip("frosting", "三层巨无霸", [170, 150, 150, 190], [
    finalize(clone(bakerRaw), (g) => {
      stamp(g, 23, 11, [".M..", "...Y", "..R.", ".MMM.", "WWWWW"]);
    }),
    finalize(shiftBody(bakerRaw, 0, -1, "shrink"), (g) => {
      stamp(g, 22, 8, ["..R..", ".MMM.", "WWWWW", ".MMM.", "WWWWW", ".bbb.", ".bbb."]);
    }, "shrink"),
    finalize(eyesGlow(shiftBody(bakerRaw, 0, -1, "shrink"), "M"), (g) => {
      // 冲天三层巨无霸樱桃蛋糕！
      stamp(g, 21, 3, [
        "Y..R..Y",
        "..MMM..",
        ".WWWWW.",
        "..MMM..",
        ".WWWWW.",
        "..MMM..",
        ".WWWWW.",
        "..bbb..",
        "..bbb..",
      ]);
    }, "shrink"),
    finalize(eyesHappy(clone(bakerRaw)), (g) => {
      stamp(g, 23, 9, [".Y.M.", "..R..", ".MMM.", "WWWWW"]);
    }),
  ]),
  clip("whisk", "奶油龙卷风", [130, 110, 110, 140], [
    finalize(shiftBody(bakerRaw, -1, 0), (g) => {
      stamp(g, 22, 14, [".W.W.", "WWWWW", ".ggg."]);
    }),
    finalize(shiftBody(bakerRaw, 1, -1, "shrink"), (g) => {
      stamp(g, 2, 4, ["W..W..................W.W", ".....................WWWWW"]);
      stamp(g, 13, 11, ["W"]);
      stamp(g, 22, 13, ["WWWWW", ".ggg."]);
    }, "shrink"),
    finalize(eyesShock(shiftBody(bakerRaw, -1, 0)), (g) => {
      stamp(g, 1, 3, ["..W..W.............W.WWW", ".....W................W."]);
      stamp(g, 12, 10, ["WW..W"]); // 奶油溅脸上！
      stamp(g, 22, 14, ["WWWWW", ".ggg."]);
    }),
    finalize(eyesHappy(clone(bakerRaw)), (g) => {
      stamp(g, 13, 12, ["W"]);
      stamp(g, 23, 12, [".W..W", "WWWWW"]);
    }),
  ]),
  clip("fresh", "出炉起飞", [180, 150, 150, 180], [
    finalize(clone(bakerRaw), (g) => {
      stamp(g, 22, 13, [".W.W.", ".bbb.", "bFFFb", ".bbb."]);
    }),
    finalize(eyesHappy(shiftBody(bakerRaw, 0, -2, "tiny")), (g) => {
      stamp(g, 2, 1, [".M.M....................M.M", ".MMM....................MMM", "..M......................M."]);
      stamp(g, 22, 11, [".W..W.", "bbbbbb", "bFFFFb"]);
    }, "tiny"),
    finalize(eyesHappy(shiftBody(bakerRaw, 0, -3, "none")), (g) => {
      stamp(g, 1, 0, ["Y.M.M..................M.M.Y", "..MMM..................MMM..", "...M....................M..."]);
    }, "none"),
    finalize(eyesHappy(clone(bakerRaw)), (g) => {
      stamp(g, 23, 10, ["Y..M", ".W..", "bbbb", "bFFb"]);
    }),
  ]),
  clip("dough", "抛面团杂技", [170, 140, 140, 170], [
    finalize(clone(bakerRaw), (g) => {
      stamp(g, 12, 14, ["bbbbbbbb", "bWWWWWWb"]);
    }),
    finalize(armsUp(shiftBody(bakerRaw, 0, -1, "shrink"), "W"), (g) => {
      stamp(g, 10, 2, ["..WWWWWW..", ".WWbbbbWW.", "..WWWWWW.."]);
    }, "shrink"),
    finalize(armsUp(shiftBody(bakerRaw, 0, -2, "tiny"), "W"), (g) => {
      stamp(g, 9, 0, [".WWWWWWWWWW.", "WWbbbbbbbbWW"]);
      stamp(g, 4, 2, ["Y....................Y"]);
    }, "tiny"),
    finalize(eyesHappy(clone(bakerRaw)), (g) => {
      stamp(g, 11, 12, ["WWWWWWWWWW", ".bbbbbbbb."]);
    }),
  ]),
  clip("sugar", "糖粉雪崩", [180, 150, 200, 200], [
    finalize(clone(bakerRaw), (g) => {
      stamp(g, 10, 0, ["W.W.W.W.W"]);
    }),
    finalize(eyesShock(clone(bakerRaw)), (g) => {
      stamp(g, 7, 1, ["W.W.W.W.W.W.W.W", ".W.W.W.W.W.W.W.", "W.W.W.W.W.W.W.W"]);
    }),
    finalize(eyesShock(clone(bakerRaw)), (g) => {
      // 整个人被雪白糖粉盖成萌萌雪人！
      stamp(g, 8, 2, [
        "..WWWWWWWWWW..",
        ".WWWWWWWWWWWW.",
        ".WWWWWWWWWWWW.",
        "WWwWWWWWWWWwWW",
        ".WWWWWWWWWWWW.",
      ]);
      stamp(g, 10, 13, ["W..W..W..W"]);
    }),
    finalize(eyesBlink(clone(bakerRaw)), (g) => {
      stamp(g, 9, 3, ["WWWWWWWWWWWW", ".wWWwWWwWWw."]);
    }),
  ]),
];

// --- 20. 忍者 (男) ---
const ninjaRaw = (() => {
  const g = buildChibi({
    gender: "male", hairStyle: "short", coat: "ninja",
    extras(g) {
      // Dark shinobi hood + mask leaving sharp eyes exposed
      fill(g, 9, 5, 14, 12, "N");
      fill(g, 10, 10, 12, 4, "S");
      stamp(g, 11, 11, ["WE", "EE"]); stamp(g, 19, 11, ["WE", "EE"]);
      fill(g, 10, 14, 12, 3, "N"); // mask lower face
      // Flowing theme headband + tails streaming left
      fill(g, 9, 8, 14, 2, "A"); fill(g, 13, 8, 6, 2, "G"); px(g, 15, 8, "W"); // metal forehead plate
      stamp(g, 3, 8, ["aAAd..", "aA....", "a....."]);
      // Steel shuriken in right hand
      stamp(g, 24, 18, [".G.", "GWG", ".G."]);
    },
  });
  return g;
})();
const ninjaBase = finalize(ninjaRaw);
const ninjaAnimations = [
  clip("shuriken", "暴雨手里剑", [130, 110, 110, 130], [
    finalize(clone(ninjaRaw), (g) => {
      stamp(g, 2, 7, ["aAAd.", "a...."]);
      stamp(g, 24, 17, ["G.G", ".W.", "G.G"]);
    }),
    finalize(shiftBody(ninjaRaw, -1, -1, "shrink"), (g) => {
      stamp(g, 21, 13, [".G...G.", "GWG.GWG", ".G...G."]);
    }, "shrink"),
    finalize(eyesGlow(shiftBody(ninjaRaw, 1, 0), "R"), (g) => {
      stamp(g, 22, 10, ["G.G..G.", ".W..GWG", "G.G..G.", ".......", "..G.G..", "...W...", "..G.G.."]);
    }),
    finalize(clone(ninjaRaw), (g) => {
      stamp(g, 23, 16, ["G.G", "wWw", "G.G"]);
    }),
  ]),
  clip("smoke", "砰！烟雾遁", [170, 120, 190, 190, 180], [
    // 双手胸前结印蓄力！
    finalize(eyesGlow(clone(ninjaRaw), "Y"), (g) => {
      stamp(g, 13, 18, ["SS..SS", ".SSSS."]);
    }),
    // 砰！炸成巨大白烟团（多层明暗烟云+金色「砰」星火）！
    (() => {
      const g = blank();
      stamp(g, 5, 5, [
        ".....GGGGGGGGGG.....",
        "...GGwwwwWWWWwwGG...",
        "..GwwWWWWWWWWWWwwG..",
        ".GwWWWWWWwWWwWWWWwG.",
        ".GWWWWWWWWWWWWWWWWG.",
        "GWWWWWwWWWWWWwWWWWWG",
        "GWWWWWWWWWWWWWWWWWWG",
        ".GWWWWWWWWWWWWWWWWG.",
        ".GwWWWWWWWWWWWWWWwG.",
        "..GwwWWWWWWWWWWwwG..",
        "...GGwwwwWWWWwwGG...",
        ".....GGGGGGGGGG.....",
      ]);
      stamp(g, 4, 3, ["Y....................Y"]);
      stamp(g, 5, 19, ["Y..................Y"]);
      fill(g, 9, 29, 14, 1, "Z");
      return g;
    })(),
    // 烟雾里只露出一对锐利红眼！
    (() => {
      const g = blank();
      stamp(g, 6, 6, [
        "....wWWWWWWWWw....",
        "..wWWWWWWWWWWWWw..",
        ".WWWWWWWWWWWWWWWW.",
        ".WWWWWOOOOOOWWWWW.",
        ".WWWRRWWWWWWWRRWW.",
        ".WWWWWWWWWWWWWWWW.",
        "..wWWWWWWWWWWWWw..",
        "....wWWWWWWWWw....",
      ]);
      fill(g, 11, 29, 10, 1, "Z");
      return g;
    })(),
    finalize(clone(ninjaRaw), (g) => {
      stamp(g, 3, 4, ["w....w..............w....w", "w........................w"]);
    }),
    ninjaBase,
  ]),
  clip("shadowstep", "影分身瞬步", [120, 100, 100, 120], [
    finalize(withAfterimage(shiftBody(ninjaRaw, -5, 0), ninjaRaw, 5, 0, "c")),
    finalize(withAfterimage(shiftBody(ninjaRaw, 5, -1, "shrink"), ninjaRaw, -5, 0, "c"), (g) => {
      stamp(g, 3, 4, ["..V......v.."]);
    }, "shrink"),
    finalize(withAfterimage(withAfterimage(clone(ninjaRaw), ninjaRaw, -6, 0, "c"), ninjaRaw, 6, 0, "w"), (g) => {
      stamp(g, 1, 14, ["CCCCCC................CCCCCC"]);
      stamp(g, 4, 2, ["V......................v"]);
    }),
    finalize(withAfterimage(shiftBody(ninjaRaw, -4, -1, "shrink"), ninjaRaw, 6, 0, "w"), (g) => {
      stamp(g, 2, 15, ["CCCC"]);
    }, "shrink"),
  ]),
  clip("log", "替身术木桩", [160, 110, 240, 220, 170], [
    finalize(eyesGlow(clone(ninjaRaw), "Y")),
    // 砰！白烟闪现！
    (() => {
      const g = blank();
      stamp(g, 7, 8, [
        "...GGwwwwwwGG...",
        ".GGwwWWWWWWwwGG.",
        "GwwWWWWWWWWWWwwG",
        "GWWWWWWWWWWWWWWG",
        ".GGwwWWWWWWwwGG.",
        "...GGwwwwwwGG...",
      ]);
      stamp(g, 6, 6, ["Y................Y"]);
      fill(g, 11, 29, 10, 1, "Z");
      return g;
    })(),
    // 经典火影/银魂替身术：原地只剩一截带小绿芽的萌萌木桩！
    finalize((() => {
      const g = blank();
      stamp(g, 11, 15, [
        "....vV....",
        "....v.....",
        ".bbbbbbbb.",
        "bbBBbbBBbb",
        "BBBBBBBBBB",
        "BKKBBBBKKB",
        "BBBBBBBBBB",
        "BBBKKBBBBB",
        "BBBBBBBBBB",
        "BKKBBBBKKB",
        "BBBBBBBBBB",
        ".BBBBBBBB.",
      ]);
      return g;
    })(), (g) => {
      stamp(g, 22, 13, ["w.w", ".w."]);
    }),
    finalize((() => {
      const g = blank();
      stamp(g, 11, 16, [
        ".....vV...",
        "....v.....",
        ".bbbbbbbb.",
        "bbBBbbBBbb",
        "BBBBBBBBBB",
        "BKKBBBBKKB",
        "BBBBBBBBBB",
        "BBBKKBBBBB",
        "BBBBBBBBBB",
        ".BBBBBBBB.",
      ]);
      return g;
    })(), (g) => {
      stamp(g, 6, 12, ["C", "C"]);
    }),
    finalize(clone(ninjaRaw), (g) => {
      stamp(g, 5, 5, ["w....................w"]);
    }),
  ]),
  clip("fireball", "豪火球之术", [160, 130, 130, 150], [
    finalize(eyesGlow(shiftBody(ninjaRaw, -2, 0), "F"), (g) => {
      stamp(g, 13, 18, ["SS..SS"]);
    }),
    finalize(shiftBody(ninjaRaw, -3, 0), (g) => {
      stamp(g, 19, 11, [".FF.", "FYYF", ".FF."]);
    }),
    finalize(shiftBody(ninjaRaw, -4, -1, "shrink"), (g) => {
      // 超级巨大豪火球喷射！
      stamp(g, 18, 6, [
        "...RRRR...",
        ".RRFFFFRR.",
        "RFFYYYYFFR",
        "RFYYWWYYFR",
        "RFFYYYYFFR",
        ".RRFFFFRR.",
        "...RRRR...",
      ]);
    }, "shrink"),
    finalize(shiftBody(ninjaRaw, -3, 0), (g) => {
      stamp(g, 20, 8, [
        "..RRFFRR..",
        ".RFFYYFFR.",
        ".RFFYYFFR.",
        "..RRFFRR..",
      ]);
    }),
  ]),
];

// ============================================================================
// Sprite Registry & Public API
// ============================================================================

function makeSprite(id, name, gender, palette, idle, animations) {
  return {
    id,
    name,
    gender,
    action: animations[0].name,
    actions: animations.map((a) => a.name),
    durations: animations[0].durations,
    frames: animations[0].frames,
    idle,
    animations,
    palette,
  };
}

export const PIXEL_SPRITES = {
  coder: makeSprite("coder", "程序员", "male", makePalette(SKIN.peach, { H: "#3b2c25", h: "#664d40", k: "#241914" }), coderBase, coderAnimations),
  doctor: makeSprite("doctor", "医生", "female", makePalette(SKIN.fair, { H: "#5c3828", h: "#8f5b43", k: "#3b2116" }), doctorBase, doctorAnimations),
  chef: makeSprite("chef", "厨师", "male", makePalette(SKIN.warm, { H: "#4a3228", h: "#755141", k: "#2b1c16" }), chefBase, chefAnimations),
  artist: makeSprite("artist", "画家", "female", makePalette(SKIN.fair, { H: "#a6422b", h: "#d45e42", k: "#6e2919" }), artistBase, artistAnimations),
  scientist: makeSprite("scientist", "科学家", "female", makePalette(SKIN.peach, { H: "#4e476e", h: "#7d74a8", k: "#302b45" }), scientistBase, scientistAnimations),
  astronaut: makeSprite("astronaut", "宇航员", "male", makePalette(SKIN.warm, { H: "#2d3748", h: "#4a5568", k: "#1a202c" }), astronautBase, astronautAnimations),
  barista: makeSprite("barista", "咖啡师", "female", makePalette(SKIN.tan, { H: "#2e201b", h: "#543b32", k: "#19100d" }), baristaBase, baristaAnimations),
  detective: makeSprite("detective", "侦探", "male", makePalette(SKIN.peach, { H: "#4a3b32", h: "#705a4d", k: "#2b221d" }), detectiveBase, detectiveAnimations),
  musician: makeSprite("musician", "音乐家", "female", makePalette(SKIN.fair, { H: "#292952", h: "#4b4b8c", k: "#161630" }), musicianBase, musicianAnimations),
  firefighter: makeSprite("firefighter", "消防员", "male", makePalette(SKIN.deep, { H: "#241d1a", h: "#453832", k: "#14100e" }), firefighterBase, firefighterAnimations),
  teacher: makeSprite("teacher", "教师", "female", makePalette(SKIN.warm, { H: "#5e3d2b", h: "#8c5e44", k: "#3b2418" }), teacherBase, teacherAnimations),
  gardener: makeSprite("gardener", "园丁", "male", makePalette(SKIN.tan, { H: "#5c4028", h: "#87613f", k: "#382617" }), gardenerBase, gardenerAnimations),
  photographer: makeSprite("photographer", "摄影师", "female", makePalette(SKIN.peach, { H: "#242638", h: "#434766", k: "#141521" }), photographerBase, photographerAnimations),
  courier: makeSprite("courier", "骑士", "male", makePalette(SKIN.warm, { H: "#2e2621", h: "#52443b", k: "#1a1512" }), courierBase, courierAnimations),
  wizard: makeSprite("wizard", "魔法师", "female", makePalette(SKIN.fair, { H: "#6d59a8", h: "#9d88db", k: "#473873" }), wizardBase, wizardAnimations),
  athlete: makeSprite("athlete", "运动员", "male", makePalette(SKIN.deep, { H: "#1f1d24", h: "#3e3a4a", k: "#111014" }), athleteBase, athleteAnimations),
  pilot: makeSprite("pilot", "机长", "female", makePalette(SKIN.peach, { H: "#362723", h: "#5e453e", k: "#1f1614" }), pilotBase, pilotAnimations),
  mechanic: makeSprite("mechanic", "工程师", "male", makePalette(SKIN.warm, { H: "#423026", h: "#6b4f3f", k: "#261b15" }), mechanicBase, mechanicAnimations),
  baker: makeSprite("baker", "烘焙师", "female", makePalette(SKIN.fair, { H: "#b86844", h: "#e08d67", k: "#82452a" }), bakerBase, bakerAnimations),
  ninja: makeSprite("ninja", "忍者", "male", makePalette(SKIN.peach, { H: "#1e2330", h: "#374151", k: "#111827" }), ninjaBase, ninjaAnimations),
};

export const PIXEL_ROLE_IDS = Object.keys(PIXEL_SPRITES);

/** Pick a random occupation animation clip for a role, avoiding immediate repeats when `excludeClipId` is given. */
export function pickRandomAnimation(roleId, excludeClipId = "", random = Math.random) {
  const sprite = PIXEL_SPRITES[roleId] || PIXEL_SPRITES.coder;
  const clips = sprite.animations;
  const pool = excludeClipId && clips.length > 1 ? clips.filter((c) => c.id !== excludeClipId) : clips;
  return pool[Math.floor(random() * pool.length)] || clips[0];
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

const frameCache = new Map();

/**
 * Render (and cache) one frame of a 32×32 pixel citizen as a soft tinted badge + crisp SVG pixel paths.
 * `clipId`: omit/"" for default clip 0 (backward compatible), `"idle"` for calm resting pose, or any clip id in `sprite.animations`.
 */
export function renderPixelFrame(roleId, hex = "#3878fb", frameIndex = 0, clipId = "") {
  const sprite = PIXEL_SPRITES[roleId] || PIXEL_SPRITES.coder;
  const color = /^#[0-9a-fA-F]{6}$/.test(hex || "") ? hex : "#3878fb";
  let matrix, cacheKey;
  if (clipId === "idle") {
    matrix = sprite.idle || sprite.frames[0];
    cacheKey = `${sprite.id}|${color}|idle|0`;
  } else {
    const active = clipId ? (sprite.animations.find((c) => c.id === clipId) || sprite.animations[0]) : sprite.animations[0];
    const index = ((frameIndex % active.frames.length) + active.frames.length) % active.frames.length;
    matrix = active.frames[index];
    cacheKey = `${sprite.id}|${color}|${active.id}|${index}`;
  }
  const cached = frameCache.get(cacheKey);
  if (cached) return cached;
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
