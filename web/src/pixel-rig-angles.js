// 64×64 Multi-Angle ("Pixel 3D" / 2.5D) Skeletal Part Builders: Side (Profile) & Back (Rear).
// Produces authentic directional 64×64 pixel-art parts with profile noses, side temple-arm glasses,
// depth-layered near/far limbs, rear hair/backpacks/hoods/straps, and directional 3D volume shading.

import { PIXEL_GRID_SIZE, blank, clone, fill, px, stamp, stamp2x, shade } from "./pixel-rig.js";

// ============================================================================
// Directional 3D Lighting Shift per Angle (front → side → back)
// ============================================================================

const SHADABLE_KEYS = ["A", "a", "d", "S", "s", "P", "m", "H", "h", "k", "N", "n", "B", "b", "K", "w", "G", "g"];

/**
 * Shift character material shading subtly by viewing angle to create 2.5D sculptural depth:
 *   - front: full key-light clarity
 *   - side:  slightly cooler/deeper midtones (-6%) while rim highlights & luminous FX stay crisp
 *   - back:  deeper back-lit shading (-12%) so turning away reads immediately as 3D volume
 */
export function shadePaletteForAngle(paletteMap, angle = "front") {
  if (!angle || angle === "front") return paletteMap;
  const shift = angle === "side" ? -0.065 : angle === "back" ? -0.125 : 0;
  if (!shift) return paletteMap;
  const out = { ...paletteMap };
  for (const key of SHADABLE_KEYS) {
    const val = out[key];
    if (typeof val === "string" && /^#[0-9a-fA-F]{6}$/.test(val)) {
      // Keep specular hair/accent highlights slightly livelier in side view for directional rim light
      const kShift = angle === "side" && (key === "a" || key === "h") ? shift * 0.3 : shift;
      out[key] = shade(val, kShift);
    }
  }
  return out;
}

// ============================================================================
// Role-Specific Profile (Side) & Rear (Back) Hat / Custom Head Craft
// ============================================================================

function drawHatByKind(g, kind, view) {
  if (!kind) return;
  if (view === "side") {
    if (kind === "nurse") {
      // Side profile nurse cap perched neatly above crown with red cross facing right
      stamp(g, 24, 6, [
        "...WWWWWW...",
        "..WWWWWWWW..",
        ".WWWWWRRWWW.",
        ".WWWWWRRWWW.",
        "..wwwwwwww..",
      ]);
    } else if (kind === "chef") {
      // Tall puffed toque leaning slightly back with soft side shadow
      stamp2x(g, 9, 1, [
        "..WWWWWWWW..",
        ".wWWWWWWWWW.",
        ".wWWwWWWWWW.",
        "..wWWWWWWWW.",
        "...wwwwwww..",
      ]);
    } else if (kind === "beret") {
      // Angled French beret drooping toward the back (left) with little stem
      stamp2x(g, 8, 2, [
        ".....d.......",
        "..ddAAAAAAAA.",
        ".ddAAAAAAAAa.",
        "..ddAAAAAAAA.",
      ]);
    } else if (kind === "goggles") {
      // Forehead lab goggles: dark elastic band wrapping back + glowing cyan lens jutting front-right
      fill(g, 19, 13, 18, 4, "g");
      fill(g, 35, 11, 8, 7, "g");
      fill(g, 37, 12, 5, 5, "C");
      fill(g, 38, 12, 3, 2, "W");
    } else if (kind === "barista") {
      // Cafe headband wrapping profile crown
      fill(g, 20, 12, 22, 4, "A");
      fill(g, 20, 12, 6, 4, "d");
      fill(g, 34, 12, 7, 2, "a");
    } else if (kind === "detective") {
      // Classic Sherlock deerstalker / fedora with protruding right front brim & rear flap
      stamp2x(g, 8, 2, [
        "...bbbbbbbb...",
        "..Bbbbbbbbbb..",
        "..BddAAAAAAdd.",
        "BBBBbbbbbbbbbb",
      ]);
    } else if (kind === "headphones") {
      // Studio over-ear headphones: band over crown + big circular earcup right over the ear!
      fill(g, 25, 8, 6, 4, "A");
      fill(g, 24, 12, 4, 10, "A");
      fill(g, 22, 21, 9, 9, "A");
      px(g, 22, 21, "."); px(g, 30, 21, "."); px(g, 22, 29, "."); px(g, 30, 29, ".");
      fill(g, 24, 23, 5, 5, "d");
      fill(g, 25, 24, 3, 3, "a");
    } else if (kind === "fire") {
      // Iconic firefighter helmet: long rear neck shield on left + high ridge + bright front shield
      stamp2x(g, 7, 2, [
        ".....YYYYYY....",
        "...YYyYYYYYY...",
        "..YYYYYYAAAYY..",
        ".YYYYYYYYYYYYYY",
        "YYY............",
      ]);
    } else if (kind === "straw") {
      // Wide-brimmed gardener straw hat in crisp side profile
      stamp2x(g, 6, 2, [
        ".....bbbbbbbb.....",
        "....Bbbbbbbbbb....",
        "....BddAAAAAAdd...",
        ".BBBbbbbbbbbbbbbb.",
      ]);
    } else if (kind === "courier") {
      // Delivery helmet with protruding cyan visor shield on the front-right
      stamp2x(g, 9, 3, [
        "..AAAAAAAAAA..",
        ".dAAAAAAAAAAa.",
        ".dAAAAAAACCCCC",
        ".dAAAAAACWWCCC",
        "..ddAAAACCCCC.",
      ]);
    } else if (kind === "wizard") {
      // Pointed witch hat curving jauntily backward to the left!
      stamp2x(g, 7, 0, [
        "..A.............",
        "...AAA..........",
        "....AAAA........",
        ".....AAYAAA.....",
        "....AAAAAAAA....",
        ".dddYYYYYYYYYdd.",
      ]);
    } else if (kind === "headband") {
      // Athletic headband with fluttering tie ends streaming behind (left)
      fill(g, 20, 14, 22, 4, "A");
      fill(g, 34, 14, 7, 2, "a");
      stamp(g, 13, 15, ["..AAAAA", ".AAd...", "AA.....", "..AAd.."]);
    } else if (kind === "pilot") {
      // Peaked airline captain cap with glossy black visor jutting out on the right
      stamp2x(g, 9, 2, [
        "..AAAAAAAAA...",
        ".dAAAAYYAAAA..",
        ".ddAAAAAAAAAA.",
        "....OOOOOOOOOO",
      ]);
    } else if (kind === "hardhat") {
      // Yellow construction hard hat with protruding right front brim
      stamp2x(g, 9, 2, [
        "...YYYYYYY....",
        "..YYYYyYYYY...",
        ".YYYYYYYYYYY..",
        ".YYYYYYYYYYYYY",
      ]);
    } else if (kind === "bow") {
      // Cute side-profile hair bow perched on top-front
      stamp2x(g, 11, 2, ["..AA..AA", ".AAAaaAA", "..AA..AA"]);
    }
    return;
  }

  // BACK VIEW HATS
  if (kind === "nurse") {
    stamp2x(g, 11, 4, ["..wwwwww..", ".wWWWWWWw.", ".wwwwwwww."]);
  } else if (kind === "chef") {
    stamp2x(g, 10, 1, ["..wWWWWWWw..", ".wWWWWWWWWw.", ".wWWwWWwWWw.", ".wWWWWWWWWw.", "..wwwwwwww.."]);
  } else if (kind === "beret") {
    stamp2x(g, 9, 2, ["......d......", "..ddAAAAAAA..", ".dAAAAAAAAAd.", ".ddAAAAAAAAdd"]);
  } else if (kind === "goggles") {
    // Goggle strap wrapping horizontally around back of head with buckle!
    fill(g, 18, 15, 28, 4, "g");
    fill(g, 29, 15, 6, 4, "G");
    fill(g, 31, 16, 2, 2, "O");
  } else if (kind === "barista") {
    fill(g, 20, 12, 24, 4, "A"); fill(g, 20, 14, 24, 2, "d");
  } else if (kind === "detective") {
    stamp2x(g, 7, 2, ["....BbbbbbbB....", "...BbbbbbbbbB...", "...ddAAAAAAdd...", ".BBbbbbbbbbbbBB."]);
  } else if (kind === "headphones") {
    stamp2x(g, 8, 4, ["...ddAAAAAAAdd..", "..dd........dd..", ".AA..........AA.", "AA............AA", "dd............dd", "dd............dd"]);
  } else if (kind === "fire") {
    // Broad protective rear neck guard on firefighter helmet!
    stamp2x(g, 7, 2, [".....YYYYYY.....", "...YYYYYYYYYY...", "..YYYYYYYYYYYY..", ".YYYYYYYYYYYYYY.", ".YYyyyyyyyyyyYY."]);
  } else if (kind === "straw") {
    stamp2x(g, 5, 2, ["......bbbbbbbb......", ".....BbbbbbbbbB.....", ".....ddAAAAAAdd.....", ".BBbbbbbbbbbbbbbbBB."]);
  } else if (kind === "courier") {
    // Rear of delivery helmet with reflective safety band
    stamp2x(g, 8, 3, ["...dAAAAAAAAd...", "..dAAAAAAAAAAd..", ".dAAAAAAAAAAAAd.", ".dAAYYYYYYYYAAd.", "..ddAAAAAAAAAdd."]);
  } else if (kind === "wizard") {
    stamp2x(g, 7, 0, [".......A........", "......AAA.......", ".....AAAAA......", "....AAAAAAA.....", "...AAAAAAAAA....", "..ddYYYYYYYYYdd."]);
  } else if (kind === "headband") {
    fill(g, 20, 14, 24, 4, "A");
    // Tied headband knot + twin ribbons streaming down back of head!
    fill(g, 30, 14, 4, 4, "d");
    stamp(g, 28, 18, [".AA.AA.", "AA...AA", "d.....d"]);
  } else if (kind === "pilot") {
    stamp2x(g, 9, 2, ["...dAAAAAAAd..", "..dAAAAAAAAAd.", ".ddAAAAAAAAAdd", "..ddddddddddd."]);
  } else if (kind === "hardhat") {
    stamp2x(g, 8, 2, ["....YYYYYY....", "..YYYYYYYYYY..", ".YYYYYYYYYYYY.", ".yyyyyyyyyyyy."]);
  } else if (kind === "bow") {
    stamp2x(g, 10, 2, ["dd......dd", "ddAAaaAAdd", "dd..aa..dd"]);
  }
}

// ============================================================================
// Side-Profile (Right-Facing) 64×64 Head Builder
// ============================================================================

function drawSideHead64(spec, includeHat = true) {
  if (spec.customKind === "astronaut") {
    const g = blank();
    // 3D side-view rounded space helmet facing right with curved wrap-around visor!
    fill(g, 17, 8, 29, 26, "W");
    fill(g, 17, 8, 3, 3, "."); fill(g, 43, 8, 3, 3, ".");
    fill(g, 17, 31, 3, 3, "."); fill(g, 43, 31, 3, 3, ".");
    px(g, 19, 10, "W"); px(g, 43, 10, "W"); px(g, 19, 31, "W"); px(g, 43, 31, "W");
    fill(g, 17, 12, 8, 19, "w"); // shaded rear dome
    fill(g, 23, 19, 4, 5, "G"); // side ear comms module
    fill(g, 32, 12, 13, 16, "N"); // wrap-around right-side visor
    px(g, 44, 12, "W"); px(g, 44, 27, "W");
    fill(g, 36, 14, 6, 4, "C"); fill(g, 39, 14, 3, 2, "W"); // visor shine
    return g;
  }
  if (spec.customKind === "ninja") {
    const g = blank();
    // Side-profile ninja hood facing right with eye cutout, forehead metal plate, and streaming rear scarf!
    fill(g, 19, 10, 24, 24, "N");
    fill(g, 19, 10, 2, 2, "."); fill(g, 41, 10, 2, 2, ".");
    fill(g, 19, 12, 6, 21, "O"); // rear hood shadow
    // Eye slit on right face
    fill(g, 34, 20, 9, 7, "S");
    stamp(g, 36, 22, ["EEWW", "EEEW", "EEEE", "EkEE"]);
    // Forehead mask ridge & nose contour
    fill(g, 42, 25, 2, 3, "N");
    // Headband + metallic forehead plate on right + long flowing tails streaming left!
    fill(g, 19, 16, 24, 4, "A");
    fill(g, 36, 16, 7, 4, "G"); fill(g, 38, 16, 4, 2, "W");
    stamp2x(g, 3, 8, ["aAAd...", "aAA....", "a..d..."]);
    return g;
  }

  const g = blank();
  const isF = spec.gender === "female";
  const hairStyle = spec.hairStyle || "short";
  const eyeStyle = spec.eyeStyle || (isF ? "sparkle" : "crisp");

  // 1. Back hair trailing behind neck/ear (profile left side)
  if (hairStyle === "long") {
    fill(g, 16, 17, 13, 23, "H");
    fill(g, 15, 22, 6, 18, "k");
    px(g, 15, 39, "."); px(g, 28, 39, ".");
  } else if (hairStyle === "wavy") {
    fill(g, 15, 17, 14, 22, "H");
    fill(g, 13, 24, 8, 13, "H");
    fill(g, 14, 34, 6, 7, "k");
  } else if (hairStyle === "ponytail") {
    stamp2x(g, 5, 9, [
      "..HHH.", ".HHHHH", "HHkHH.", "Hkk...", ".kk...",
    ]);
    fill(g, 19, 18, 3, 4, "A"); // hairband
  } else if (hairStyle === "bob") {
    fill(g, 17, 17, 12, 18, "H");
    fill(g, 16, 24, 5, 10, "k");
  }

  // 2. Sculpted 64×64 Side-Profile Face (facing right, protruding nose at x=42..43!)
  fill(g, 22, 18, 20, 14, "S");
  fill(g, 25, 32, 16, 2, "S");
  fill(g, 26, 33, 14, 1, "s"); // chin shadow
  px(g, 41, 31, "s"); px(g, 41, 32, "."); // rounded profile chin
  // Iconic chibi nose silhouette protruding on the right!
  fill(g, 42, 25, 2, 3, "S");
  px(g, 43, 25, "."); px(g, 42, 27, "s"); px(g, 43, 27, "s");

  // 3. Profile Hair Crown + Back of Skull + Ear
  if (hairStyle === "spiky") {
    fill(g, 19, 13, 23, 7, "H"); fill(g, 21, 11, 19, 3, "H");
    stamp(g, 18, 8, [
      "..HH....HHH...HH....",
      ".HHHH..HHHHH.HHHH...",
      "HHHHHHHHHHHHHHHHHH..",
    ]);
  } else if (hairStyle === "bun") {
    fill(g, 21, 6, 11, 7, "H");
    px(g, 21, 6, "."); px(g, 31, 6, "."); px(g, 21, 12, "."); px(g, 31, 12, ".");
    fill(g, 24, 7, 5, 2, "h");
    fill(g, 19, 13, 23, 7, "H"); fill(g, 21, 11, 19, 3, "H");
  } else if (hairStyle === "fluffy") {
    fill(g, 17, 12, 26, 8, "H"); fill(g, 20, 10, 21, 3, "H");
    px(g, 17, 12, "."); px(g, 42, 12, ".");
  } else {
    fill(g, 19, 13, 23, 7, "H"); fill(g, 21, 11, 20, 3, "H");
    px(g, 19, 13, "."); px(g, 41, 13, ".");
  }
  // Back-of-head hair mass + deep left-side shadow + front-top rim highlight + bangs
  fill(g, 19, 18, 10, 13, "H");
  fill(g, 19, 20, 5, 11, "k");
  fill(g, 29, 19, 3, 6, "H"); // sideburn in front of ear
  fill(g, 31, 13, 8, 2, "h"); // directional right-side crown highlight!
  fill(g, 33, 19, 9, 2, "k"); // front bangs
  // Side ear peeking neatly out from hair
  fill(g, 26, 24, 3, 5, "S");
  px(g, 26, 24, "s"); px(g, 27, 26, "s"); px(g, 27, 28, "s");

  // 4. Profile Eye, Glasses w/ Temple Arm, Blush & Side Mouth
  if (eyeStyle === "sparkle") {
    stamp(g, 36, 22, ["EEEE", "EEWW", "EEEW", "EWEE", "kEEk"]);
    fill(g, 33, 27, 4, 2, "P");
    stamp(g, 38, 29, ["...m", "mmm."]);
  } else if (eyeStyle === "crisp") {
    fill(g, 36, 20, 4, 1, "k");
    stamp(g, 36, 22, ["EEWW", "EEEW", "EEEE", "EkEE"]);
    stamp(g, 38, 29, ["mmm."]);
  } else if (eyeStyle === "glasses") {
    // Sleek temple arm from ear to front lens!
    fill(g, 27, 23, 9, 1, "O");
    stamp(g, 35, 21, [
      ".OOOOOO.",
      "OcEEWWcO",
      "OcEEEWcO",
      "OcEEEEcO",
      "OccEEccO",
      ".OOOOOO.",
    ]);
    stamp(g, 38, 29, ["mmm."]);
  } else if (eyeStyle === "goldglasses") {
    fill(g, 27, 23, 9, 1, "Y");
    stamp(g, 35, 21, [
      ".YYYYYY.",
      "YcEEWWcY",
      "YcEEEWcY",
      "YcEEEEcY",
      "YccEEccY",
      ".YYYYYY.",
    ]);
    fill(g, 33, 27, 4, 2, "P");
    stamp(g, 38, 29, ["...m", "mmm."]);
  } else if (eyeStyle === "shades") {
    fill(g, 27, 23, 9, 1, "O");
    stamp(g, 35, 21, [
      ".OOOOOOO",
      "OOOWgOOO",
      "OOWgOOOO",
      ".OOOOOO.",
      "..OOOO..",
    ]);
    fill(g, 33, 27, 3, 2, "P");
    stamp(g, 38, 29, ["mmm."]);
  }

  // 5. Side-profile beards
  if (spec.beardKind === "mustache") {
    stamp(g, 37, 27, [".HHHH.", "HHHHHH"]);
  } else if (spec.beardKind === "beard") {
    fill(g, 33, 29, 9, 5, "B");
    px(g, 41, 33, ".");
  }

  if (includeHat && spec.hatKind) drawHatByKind(g, spec.hatKind, "side");
  return g;
}

export function buildSideHeadParts(spec) {
  const normal = drawSideHead64(spec, true);
  const mod = (fn) => { const c = clone(normal); fn(c); return c; };
  const hasGlasses = spec.eyeStyle === "glasses" || spec.eyeStyle === "goldglasses";
  const eyeFill = hasGlasses ? "c" : "S";
  const eyeH = hasGlasses ? 4 : 5;
  const clearEye = (g) => fill(g, 36, 22, 4, eyeH, eyeFill);

  const parts = {
    normal,
    blink: mod((g) => {
      if (spec.customKind === "astronaut") return;
      clearEye(g);
      fill(g, 36, 24, 4, 1, "k");
    }),
    happy: mod((g) => {
      if (spec.customKind === "astronaut") { fill(g, 36, 18, 6, 2, "W"); return; }
      clearEye(g);
      stamp(g, 36, 23, [".EE.", "E..E"]);
      if (spec.customKind !== "ninja") stamp(g, 37, 28, ["mmmm.", "mWWm.", ".mmm."]);
    }),
    glow: mod((g) => { fill(g, 36, 22, 4, 4, "Y"); px(g, 38, 23, "W"); }),
    glowF: mod((g) => {
      fill(g, 36, 22, 4, 4, "F"); px(g, 38, 23, "Y");
      if (spec.customKind !== "ninja" && spec.customKind !== "astronaut") stamp(g, 37, 28, [".RRRR", "RWWWR", ".RRRR"]);
    }),
    glowC: mod((g) => { fill(g, 36, 22, 4, 4, "C"); px(g, 38, 23, "W"); }),
    glowV: mod((g) => { fill(g, 36, 22, 4, 4, "V"); px(g, 38, 23, "W"); }),
    glowM: mod((g) => { fill(g, 36, 22, 4, 4, "M"); px(g, 38, 23, "W"); }),
    glowR: mod((g) => { fill(g, 36, 22, 4, 4, "R"); px(g, 38, 23, "Y"); }),
    shock: mod((g) => {
      if (spec.customKind === "astronaut") return;
      clearEye(g);
      stamp(g, 36, 22, ["WWWW", "WEEW", "WEEW", "WWWW"]);
      if (spec.customKind !== "ninja") stamp(g, 38, 28, [".OOO", "ORRO", "ORRO", ".OOO"]);
    }),
    dizzy: mod((g) => {
      if (spec.customKind === "astronaut") return;
      clearEye(g);
      stamp(g, 36, 22, ["E..E", ".EE.", ".EE.", "E..E"]);
      if (spec.customKind !== "ninja") stamp(g, 38, 29, ["m.mm"]);
    }),
    shout: mod((g) => {
      if (spec.customKind !== "ninja" && spec.customKind !== "astronaut") {
        stamp(g, 37, 28, [".RRRR", "RWWWR", "RRRRR", "..RRR"]);
      }
    }),
    flash: mod((g) => {
      // Dramatic anime side-profile white glint shooting right!
      fill(g, 33, 22, 13, 3, "W");
      fill(g, 35, 25, 11, 1, "c");
    }),
  };

  if (spec.hatFn || spec.hatKind) {
    parts.hatless = drawSideHead64(spec, false);
    parts.hatlessShock = (() => {
      const c = clone(parts.hatless);
      clearEye(c);
      stamp(c, 36, 22, ["WWWW", "WEEW", "WEEW", "WWWW"]);
      stamp(c, 38, 28, [".OOO", "ORRO", "ORRO", ".OOO"]);
      return c;
    })();
  }

  // Role-specific extraHead side variants so 100% of custom heads exist in side view!
  if (spec.id === "artist" || spec.extraHeadKinds?.includes("paint")) {
    parts.paint = mod((g) => {
      clearEye(g); stamp(g, 36, 22, ["E..E", ".EE.", ".EE.", "E..E"]);
      stamp2x(g, 15, 11, ["M.Y.", "..C.", "R..M"], false);
    });
  }
  if (spec.extraHeadKinds?.includes("scientist")) {
    parts.goggleFlash = mod((g) => { fill(g, 37, 12, 5, 5, "W"); fill(g, 42, 13, 3, 2, "W"); });
    const afro = mod((g) => {
      stamp2x(g, 7, 1, [
        "...OOOOOOOOOOO...",
        ".OOkOOOkOOOkOOOO.",
        "OOOOOkOOOOOkOOOOO",
        ".OOkOOOOOOOOOkOO.",
        "..OOOOOOOOOOOOO..",
      ]);
      clearEye(g); stamp(g, 36, 22, ["WWWW", "WEEW", "WEEW", "WWWW"]);
      stamp(g, 38, 28, [".OOO", "ORRO", "ORRO", ".OOO"]);
    });
    const afroDizzy = clone(afro);
    clearEye(afroDizzy); stamp(afroDizzy, 36, 22, ["E..E", ".EE.", ".EE.", "E..E"]);
    parts.afro = afro;
    parts.afroDizzy = afroDizzy;
  }
  if (spec.customKind === "astronaut") {
    parts.sweep1 = mod((g) => { fill(g, 35, 14, 5, 3, "W"); fill(g, 34, 17, 5, 2, "C"); });
    parts.sweep2 = mod((g) => { fill(g, 38, 17, 5, 3, "W"); fill(g, 37, 20, 5, 2, "C"); });
    parts.visorHappy = mod((g) => { stamp(g, 36, 17, [".WW.", "W..W"]); });
  }
  if (spec.extraHeadKinds?.includes("disguise")) {
    parts.disguise = mod((g) => {
      fill(g, 27, 23, 9, 1, "O");
      stamp(g, 35, 21, [".OOOOOO", "OOWOOOO", ".OOOOO."]);
      stamp(g, 36, 27, [".KKKKKK", "KKkkkKK", ".KKKKK."]);
    });
  }
  if (spec.extraHeadKinds?.includes("oil")) {
    parts.oil = mod((g) => {
      fill(g, 32, 20, 10, 12, "O");
      stamp(g, 36, 22, ["WWWW", "WEEW", "WEEW", "WWWW"]);
    });
  }
  if (spec.extraHeadKinds?.includes("baker")) {
    parts.cream = mod((g) => { fill(g, 37, 26, 6, 3, "W"); });
    parts.sugar = mod((g) => {
      stamp2x(g, 9, 2, ["..WWWWWWWW..", ".WWWWWWWWWW.", "WWwWWWWWWwWW", ".WWWWWWWWWW."]);
      clearEye(g); stamp(g, 36, 22, ["WWWW", "WEEW", "WEEW", "WWWW"]);
    });
  }
  if (spec.customKind === "ninja") {
    parts.scarfUp = mod((g) => {
      stamp2x(g, 3, 7, ["aAAd...", "aA.....", "_______", "_______"]);
    });
    parts.glowRed = mod((g) => { fill(g, 36, 22, 4, 4, "R"); px(g, 38, 23, "Y"); });
  }
  return parts;
}

// ============================================================================
// Rear-View (Back) 64×64 Head Builder
// ============================================================================

function drawBackHead64(spec, includeHat = true) {
  if (spec.customKind === "astronaut") {
    const g = blank();
    // Solid white rear helmet dome with center shell seam & comms antenna (NO front visor!)
    fill(g, 16, 8, 32, 26, "W");
    fill(g, 16, 8, 3, 3, "."); fill(g, 45, 8, 3, 3, ".");
    fill(g, 16, 31, 3, 3, "."); fill(g, 45, 31, 3, 3, ".");
    px(g, 18, 10, "W"); px(g, 45, 10, "W"); px(g, 18, 31, "W"); px(g, 45, 31, "W");
    fill(g, 16, 24, 32, 8, "w"); // lower rear shading
    fill(g, 31, 10, 2, 22, "w"); // helmet rear ridge
    fill(g, 26, 27, 12, 4, "G"); fill(g, 29, 28, 6, 2, "A"); // rear neck lock ring
    return g;
  }
  if (spec.customKind === "ninja") {
    const g = blank();
    // Rear ninja hood: full dark cloth + tied headband knot in center + twin fluttering tails!
    fill(g, 18, 10, 28, 24, "N");
    fill(g, 18, 10, 2, 2, "."); fill(g, 44, 10, 2, 2, ".");
    fill(g, 18, 22, 28, 12, "O"); // deeper rear hood shading
    fill(g, 18, 16, 28, 4, "A"); // headband around back
    fill(g, 29, 15, 6, 6, "d"); fill(g, 30, 16, 4, 4, "A"); // central knot!
    // Twin scarf tails hanging down center-back
    stamp(g, 25, 21, [
      "...AA..AA...",
      "..AAd..dAA..",
      ".AAd....dAA.",
      "AAd......dAA",
      "dd........dd",
    ]);
    return g;
  }

  const g = blank();
  const hairStyle = spec.hairStyle || "short";

  // 1. Nape of neck & ears peeking out on left/right sides
  fill(g, 26, 29, 12, 5, "s");
  fill(g, 18, 24, 2, 4, "S"); px(g, 18, 24, "."); px(g, 19, 27, "s");
  fill(g, 44, 24, 2, 4, "S"); px(g, 45, 24, "."); px(g, 44, 27, "s");

  // 2. Full Back-of-Head Hair Crown & Silhouette (NO face!)
  if (hairStyle === "spiky") {
    fill(g, 19, 12, 26, 20, "H");
    stamp(g, 20, 8, [
      "..HH.....HHH...HH...",
      ".HHHH...HHHHH.HHHH..",
      "HHHHHHHHHHHHHHHHHHHH",
    ]);
    fill(g, 19, 25, 26, 7, "k");
    fill(g, 23, 13, 18, 2, "h");
  } else if (hairStyle === "bun") {
    fill(g, 26, 6, 12, 7, "H");
    px(g, 26, 6, "."); px(g, 37, 6, "."); px(g, 26, 12, "."); px(g, 37, 12, ".");
    fill(g, 28, 7, 6, 2, "h");
    fill(g, 27, 12, 10, 2, "A"); // hairband at base of bun
    fill(g, 19, 13, 26, 19, "H");
    fill(g, 19, 25, 26, 7, "k");
    fill(g, 24, 15, 16, 2, "h");
  } else if (hairStyle === "fluffy") {
    fill(g, 17, 12, 30, 20, "H"); fill(g, 20, 10, 24, 3, "H");
    px(g, 17, 12, "."); px(g, 46, 12, ".");
    fill(g, 17, 25, 30, 7, "k");
    fill(g, 22, 13, 20, 2, "h");
  } else if (hairStyle === "long") {
    fill(g, 17, 12, 30, 27, "H"); fill(g, 20, 10, 24, 3, "H");
    fill(g, 16, 20, 32, 18, "H");
    fill(g, 16, 32, 32, 8, "k");
    // Layered hair vertical shadow streaks for rich 64×64 hair craft
    fill(g, 23, 22, 2, 17, "k"); fill(g, 31, 20, 2, 19, "k"); fill(g, 39, 22, 2, 17, "k");
    fill(g, 23, 13, 18, 2, "h");
  } else if (hairStyle === "wavy") {
    fill(g, 16, 12, 32, 27, "H"); fill(g, 19, 10, 26, 3, "H");
    fill(g, 14, 22, 36, 15, "H");
    fill(g, 15, 33, 34, 7, "k");
    fill(g, 22, 22, 2, 16, "k"); fill(g, 31, 21, 2, 18, "k"); fill(g, 40, 22, 2, 16, "k");
    fill(g, 23, 13, 18, 2, "h");
  } else if (hairStyle === "bob") {
    fill(g, 17, 12, 30, 22, "H"); fill(g, 20, 10, 24, 3, "H");
    fill(g, 16, 20, 32, 13, "H");
    fill(g, 17, 29, 30, 5, "k");
    fill(g, 24, 13, 16, 2, "h");
  } else if (hairStyle === "ponytail") {
    fill(g, 19, 12, 26, 19, "H"); fill(g, 21, 10, 22, 3, "H");
    fill(g, 19, 25, 26, 6, "k");
    fill(g, 24, 13, 16, 2, "h");
    // Centered ponytail cascading down back of head!
    fill(g, 28, 19, 8, 3, "A"); // bright hair tie
    fill(g, 27, 22, 10, 12, "H");
    fill(g, 28, 31, 8, 6, "k");
    fill(g, 29, 23, 3, 5, "h");
  } else {
    // short
    fill(g, 19, 12, 26, 19, "H"); fill(g, 21, 10, 22, 3, "H");
    px(g, 19, 12, "."); px(g, 44, 12, ".");
    fill(g, 19, 25, 26, 6, "k");
    fill(g, 24, 13, 16, 2, "h");
  }

  if (includeHat && spec.hatKind) drawHatByKind(g, spec.hatKind, "back");
  return g;
}

export function buildBackHeadParts(spec) {
  const normal = drawBackHead64(spec, true);
  const mod = (fn) => { const c = clone(normal); fn(c); return c; };
  // Back expressions maintain subtle visual drama (rim glow, shock hair spikes, sweat drop, scarf flutter)
  const parts = {
    normal,
    blink: clone(normal),
    happy: mod((g) => { px(g, 22, 10, "Y"); px(g, 41, 10, "Y"); }),
    glow: mod((g) => { fill(g, 22, 11, 20, 2, "Y"); }),
    glowF: mod((g) => { fill(g, 22, 11, 20, 2, "F"); }),
    glowC: mod((g) => { fill(g, 22, 11, 20, 2, "C"); }),
    glowV: mod((g) => { fill(g, 22, 11, 20, 2, "V"); }),
    glowM: mod((g) => { fill(g, 22, 11, 20, 2, "M"); }),
    glowR: mod((g) => { fill(g, 22, 11, 20, 2, "R"); }),
    shock: mod((g) => { fill(g, 44, 16, 2, 4, "C"); }),
    dizzy: mod((g) => { fill(g, 26, 8, 12, 2, "Y"); }),
    shout: mod((g) => { fill(g, 20, 10, 24, 1, "W"); }),
    flash: mod((g) => { fill(g, 18, 14, 28, 2, "W"); }),
  };
  if (spec.hatFn || spec.hatKind) {
    parts.hatless = drawBackHead64(spec, false);
    parts.hatlessShock = clone(parts.hatless);
  }
  if (spec.extraHeadKinds?.includes("paint")) parts.paint = clone(normal);
  if (spec.extraHeadKinds?.includes("scientist")) {
    parts.goggleFlash = clone(normal);
    parts.afro = mod((g) => {
      stamp2x(g, 6, 1, [
        "....OOOOOOOOOOOO....", "..OOkOOOkOOOkOOOOO..", ".OOOOOkOOOOOkOOOOOO.",
        ".OOkOOOOOOOOOOOkOOO.", ".OOOOOOOOOOOOOOOOOO.", "..OOOOOOOOOOOOOOOO..",
      ]);
    });
    parts.afroDizzy = clone(parts.afro);
  }
  if (spec.customKind === "astronaut") {
    parts.sweep1 = clone(normal);
    parts.sweep2 = clone(normal);
    parts.visorHappy = clone(normal);
  }
  if (spec.extraHeadKinds?.includes("disguise")) parts.disguise = clone(normal);
  if (spec.extraHeadKinds?.includes("oil")) parts.oil = clone(normal);
  if (spec.extraHeadKinds?.includes("baker")) {
    parts.cream = clone(normal);
    parts.sugar = mod((g) => {
      stamp2x(g, 8, 2, ["..WWWWWWWWWW..", ".WWWWWWWWWWWW.", ".WWWWWWWWWWWW.", "WWwWWWWWWWWwWW", ".WWWWWWWWWWWW."]);
    });
  }
  if (spec.customKind === "ninja") {
    parts.scarfUp = mod((g) => {
      // Scarf tails billowing upward dramatically from behind!
      fill(g, 25, 21, 14, 6, "O");
      stamp(g, 22, 16, ["AA..........AA", ".AA........AA.", "..AAd....dAA.."]);
    });
    parts.glowRed = mod((g) => { fill(g, 22, 11, 20, 2, "R"); });
  }
  return parts;
}

// ============================================================================
// Side-Profile & Back-View 64×64 Torso Builders (with 5 Smooth Lean Variants)
// ============================================================================

function addLeanVariants(g) {
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
  return { normal: g, leanL1: makeLean(-1, 1), leanL: makeLean(-1, 2), leanR1: makeLean(1, 1), leanR: makeLean(1, 2) };
}

export function buildSideTorsoParts(coat = "hoodie", detail = null) {
  const g = blank();
  fill(g, 28, 33, 7, 3, "s"); // profile neck

  if (coat === "hoodie") {
    fill(g, 23, 36, 18, 14, "A"); fill(g, 23, 36, 5, 14, "d"); fill(g, 36, 36, 5, 6, "a"); fill(g, 23, 48, 18, 2, "d");
    fill(g, 19, 34, 6, 5, "d"); fill(g, 20, 35, 4, 3, "A"); // bunched hood behind neck!
    fill(g, 38, 37, 2, 5, "W"); // front drawstring
    fill(g, 33, 44, 8, 4, "d"); // kangaroo pocket profile
  } else if (coat === "labcoat") {
    fill(g, 23, 36, 18, 14, "W"); fill(g, 23, 36, 6, 14, "w"); fill(g, 37, 36, 4, 14, "A"); fill(g, 38, 36, 2, 5, "a");
    fill(g, 30, 43, 5, 2, "w"); // side pocket
  } else if (coat === "chef") {
    fill(g, 23, 36, 18, 14, "W"); fill(g, 23, 36, 6, 14, "w"); fill(g, 23, 48, 18, 2, "w");
    fill(g, 26, 34, 15, 3, "A"); fill(g, 36, 34, 5, 2, "a"); // neckerchief
    fill(g, 37, 40, 2, 2, "g"); fill(g, 37, 44, 2, 2, "g"); // front buttons
  } else if (coat === "apron") {
    fill(g, 23, 36, 18, 14, "W"); fill(g, 23, 36, 6, 14, "w");
    fill(g, 31, 36, 10, 14, "A"); fill(g, 36, 36, 5, 5, "a");
    fill(g, 20, 42, 4, 4, "A"); fill(g, 20, 43, 2, 2, "d"); // apron tie bow at back!
  } else if (coat === "cafe") {
    fill(g, 23, 36, 18, 14, "W"); fill(g, 23, 36, 5, 14, "w");
    fill(g, 30, 38, 11, 12, "B"); fill(g, 30, 38, 4, 12, "K");
    fill(g, 35, 42, 5, 4, "A");
    fill(g, 20, 42, 4, 4, "B"); // apron tie bow
  } else if (coat === "trench") {
    fill(g, 23, 36, 18, 14, "b"); fill(g, 23, 36, 6, 14, "B");
    fill(g, 25, 34, 15, 3, "b"); // upturned Sherlock collar!
    fill(g, 37, 36, 4, 7, "W"); fill(g, 39, 36, 2, 7, "A");
    fill(g, 23, 44, 18, 2, "B"); fill(g, 38, 44, 3, 2, "Y"); // belt buckle
  } else if (coat === "fire") {
    fill(g, 23, 36, 18, 14, "A"); fill(g, 23, 36, 5, 14, "d");
    fill(g, 18, 36, 5, 11, "G"); fill(g, 19, 37, 3, 9, "g"); // breathing air tank on back!
    fill(g, 23, 40, 18, 2, "Y"); fill(g, 23, 46, 18, 2, "Y");
  } else if (coat === "vest") {
    fill(g, 23, 36, 18, 14, "W"); fill(g, 25, 36, 16, 14, "A");
    fill(g, 25, 36, 5, 14, "d"); fill(g, 36, 36, 5, 5, "a");
  } else if (coat === "overalls") {
    fill(g, 23, 36, 18, 14, "W"); fill(g, 23, 40, 18, 10, "A"); fill(g, 23, 40, 5, 10, "d");
    fill(g, 30, 36, 4, 5, "A"); fill(g, 31, 40, 2, 2, "Y");
  } else if (coat === "robe") {
    fill(g, 20, 36, 21, 16, "A"); fill(g, 20, 36, 7, 16, "d"); fill(g, 36, 36, 5, 7, "a");
    fill(g, 38, 40, 3, 2, "Y"); fill(g, 38, 44, 3, 2, "Y"); fill(g, 38, 48, 3, 2, "Y");
  } else if (coat === "jersey") {
    fill(g, 23, 36, 18, 14, "A"); fill(g, 23, 36, 5, 14, "d"); fill(g, 35, 36, 6, 5, "a");
    fill(g, 30, 36, 3, 14, "W"); // sporty side stripe
  } else if (coat === "pilot") {
    fill(g, 23, 36, 18, 14, "A"); fill(g, 23, 36, 5, 14, "d");
    fill(g, 29, 36, 6, 2, "Y"); // shoulder epaulette
    fill(g, 37, 36, 4, 8, "W"); fill(g, 39, 36, 2, 8, "O");
  } else if (coat === "ninja") {
    fill(g, 23, 36, 18, 14, "N"); fill(g, 23, 36, 6, 14, "O");
    // Sword hilt peeking behind back!
    stamp(g, 17, 33, ["OO..", ".GO.", "..OO", "...G"]);
    fill(g, 23, 46, 18, 2, "A"); // belt sash
  } else if (coat === "spacesuit") {
    // Chunky life-support jetpack protruding behind back!
    fill(g, 14, 35, 9, 14, "w"); fill(g, 15, 36, 6, 11, "W"); fill(g, 14, 46, 8, 3, "g");
    fill(g, 22, 34, 19, 18, "W"); fill(g, 22, 38, 5, 14, "w");
    fill(g, 24, 34, 16, 4, "A");
    fill(g, 36, 40, 5, 6, "g"); fill(g, 38, 41, 2, 2, "R"); fill(g, 38, 44, 2, 2, "C");
    fill(g, 22, 48, 19, 4, "A");
  } else {
    fill(g, 23, 36, 18, 14, "A"); fill(g, 23, 36, 5, 14, "d"); fill(g, 37, 36, 4, 14, "W");
  }
  if (detail === "stethoscope") {
    // Stethoscope tube wrapping side of collar with metallic chestpiece!
    fill(g, 27, 35, 11, 2, "g");
    fill(g, 36, 37, 2, 6, "g");
    fill(g, 35, 43, 4, 3, "G");
  }
  return addLeanVariants(g);
}

export function buildBackTorsoParts(coat = "hoodie", detail = null) {
  const g = blank();
  fill(g, 28, 33, 8, 3, "s"); // back of neck

  if (coat === "hoodie") {
    fill(g, 20, 36, 24, 14, "A"); fill(g, 20, 44, 24, 6, "d");
    // Unmistakable draped hood across upper back!
    fill(g, 22, 34, 20, 7, "d"); fill(g, 24, 35, 16, 5, "A"); fill(g, 26, 35, 12, 2, "a");
  } else if (coat === "labcoat") {
    fill(g, 20, 36, 24, 14, "W"); fill(g, 20, 44, 24, 6, "w");
    fill(g, 22, 43, 20, 2, "w"); fill(g, 31, 44, 2, 6, "G"); // back belt & vent slit
  } else if (coat === "chef") {
    fill(g, 20, 36, 24, 14, "W"); fill(g, 20, 45, 24, 5, "w");
    fill(g, 25, 34, 14, 3, "A"); fill(g, 30, 36, 4, 3, "d"); // rear neckerchief knot
  } else if (coat === "apron") {
    fill(g, 20, 36, 24, 14, "W"); fill(g, 20, 45, 24, 5, "w");
    // Crossed apron straps + cute bow tied on lower back!
    stamp(g, 23, 36, ["AA............AA", ".AA..........AA.", "..AA........AA..", "...AA......AA...", "....AAAAAAAA....", "...AAAdAAdAAA...", "..AAA..AA..AAA.."]);
  } else if (coat === "cafe") {
    fill(g, 20, 36, 24, 14, "W"); fill(g, 20, 45, 24, 5, "w");
    stamp(g, 23, 36, ["BB............BB", ".BB..........BB.", "..BB........BB..", "...BBBBBBBBBB...", "..BBBKBBBBKBBB..", "..BBB..BB..BBB.."]);
  } else if (coat === "trench") {
    fill(g, 20, 36, 24, 14, "b"); fill(g, 20, 44, 24, 6, "B");
    fill(g, 22, 36, 20, 5, "B"); fill(g, 23, 36, 18, 4, "b"); // trench storm flap
    fill(g, 20, 44, 24, 2, "B"); fill(g, 31, 46, 2, 4, "K"); // rear vent
  } else if (coat === "fire") {
    fill(g, 20, 36, 24, 14, "A"); fill(g, 20, 40, 24, 2, "Y"); fill(g, 20, 46, 24, 2, "Y");
    // Rear oxygen tank pack!
    fill(g, 26, 36, 12, 12, "G"); fill(g, 28, 37, 8, 10, "g"); fill(g, 30, 38, 4, 2, "Y");
  } else if (coat === "vest") {
    fill(g, 20, 36, 24, 14, "W"); fill(g, 22, 36, 20, 14, "A"); fill(g, 22, 45, 20, 5, "d");
    fill(g, 31, 37, 2, 12, "d");
  } else if (coat === "overalls") {
    fill(g, 20, 36, 24, 14, "W"); fill(g, 22, 42, 20, 8, "A"); fill(g, 22, 46, 20, 4, "d");
    // Classic X-crossed denim suspender straps across back!
    stamp(g, 23, 36, ["AAA..........AAA", ".AAA........AAA.", "..AAA......AAA..", "...AAAA..AAAA...", "....AAAAAAAA....", ".....AAAAAA....."]);
  } else if (coat === "robe") {
    fill(g, 18, 36, 28, 16, "A"); fill(g, 18, 44, 28, 8, "d");
    fill(g, 20, 49, 24, 2, "Y"); // gold cloak hem trim
  } else if (coat === "jersey") {
    fill(g, 20, 36, 24, 14, "A"); fill(g, 20, 46, 24, 4, "d");
    fill(g, 27, 36, 10, 2, "W");
    // Bold jersey back number "7" / "1"!
    stamp(g, 28, 39, ["WWWWWWWW", "WWWWWWWW", ".....WW.", "....WW..", "...WW...", "...WW...", "...WW..."]);
  } else if (coat === "pilot") {
    fill(g, 20, 36, 24, 14, "A"); fill(g, 20, 45, 24, 5, "d");
    fill(g, 20, 36, 6, 2, "Y"); fill(g, 38, 36, 6, 2, "Y"); // shoulder epaulettes
    fill(g, 31, 38, 2, 11, "d");
  } else if (coat === "ninja") {
    fill(g, 20, 36, 24, 14, "N"); fill(g, 20, 43, 24, 7, "O");
    fill(g, 20, 46, 24, 2, "A");
    // Diagonal ninja sword sheath strapped across the back!
    stamp(g, 22, 34, ["..GG................", "...GG...............", "....OOO.............", "......OOO...........", "........OOO.........", "..........OOO.......", "............OOO.....", "..............OOO...", "................OO.."]);
  } else if (coat === "spacesuit") {
    fill(g, 18, 34, 28, 18, "W"); fill(g, 18, 48, 28, 4, "A");
    // Big centered life-support jetpack with twin thruster nozzles!
    fill(g, 21, 35, 22, 13, "w"); fill(g, 23, 36, 18, 10, "W");
    fill(g, 25, 38, 14, 3, "A");
    fill(g, 24, 47, 5, 3, "g"); fill(g, 35, 47, 5, 3, "g");
    fill(g, 26, 43, 2, 2, "R"); fill(g, 36, 43, 2, 2, "C");
  } else {
    fill(g, 20, 36, 24, 14, "A"); fill(g, 20, 45, 24, 5, "d");
    fill(g, 31, 37, 2, 12, "d");
  }
  if (detail === "stethoscope") {
    // Stethoscope tube resting across back of collar!
    fill(g, 24, 35, 16, 2, "g");
    fill(g, 26, 36, 12, 2, "G");
  }
  return addLeanVariants(g);
}

// ============================================================================
// Side-Profile (Near/Far Depth) & Back-View 64×64 Arm Builders
// ============================================================================

export function buildSideArmParts({ sleeveL = "A", sleeveR = "d", hand = "S", cuff = null } = {}) {
  const drawLimb = (g, segs, s, h) => {
    for (const [x, y, w, hh, col] of segs) fill(g, x, y, w, hh, col === "s" ? s : col === "h" ? h : col);
  };
  // armL = FAR arm (behind torso, darker sleeveR & s hand); armR = NEAR arm (in front of torso, brighter sleeveL & hand)
  const farHand = hand === "S" ? "s" : "w";
  const mkFar = (segs) => { const g = blank(); drawLimb(g, segs, sleeveR, farHand); return g; };
  const mkNear = (segs) => { const g = blank(); drawLimb(g, segs, sleeveL, hand); return g; };
  const cNear = cuff ? [[29, 42, 5, 2, cuff]] : [];

  const armL = {
    back: mkFar([[23, 37, 5, 4, "s"], [19, 40, 5, 4, "s"], [16, 43, 4, 4, "h"]]),
    down: mkFar([[36, 36, 4, 8, "s"], [36, 44, 4, 4, "h"]]),
    lowOut: mkFar([[36, 36, 5, 4, "s"], [39, 39, 5, 4, "s"], [43, 42, 4, 4, "h"]]),
    mid: mkFar([[36, 36, 9, 4, "s"], [45, 36, 4, 4, "h"]]),
    highOut: mkFar([[36, 34, 5, 4, "s"], [40, 30, 5, 5, "s"], [44, 27, 4, 4, "h"]]),
    up: mkFar([[35, 33, 5, 5, "s"], [37, 27, 4, 6, "s"], [38, 23, 4, 4, "h"]]),
    forwardLow: mkFar([[36, 36, 5, 4, "s"], [40, 39, 5, 4, "s"], [44, 41, 4, 4, "h"]]),
    forward: mkFar([[36, 36, 5, 5, "s"], [40, 38, 6, 4, "s"], [45, 38, 4, 4, "h"]]),
    forwardHigh: mkFar([[36, 35, 5, 4, "s"], [40, 33, 6, 4, "s"], [45, 31, 4, 4, "h"]]),
    flex: mkFar([[36, 36, 6, 4, "s"], [40, 31, 4, 6, "s"], [39, 27, 4, 4, "h"]]),
  };

  const armR = {
    back: mkNear([[26, 36, 5, 4, "s"], [21, 39, 5, 4, "s"], [17, 42, 4, 4, "h"]]),
    down: mkNear([[29, 36, 5, 8, "s"], ...cNear, [29, 44, 5, 4, "h"]]),
    lowOut: mkNear([[30, 36, 5, 4, "s"], [33, 40, 5, 4, "s"], [37, 43, 4, 4, "h"]]),
    mid: mkNear([[30, 36, 12, 4, "s"], [42, 36, 4, 4, "h"]]),
    highOut: mkNear([[30, 34, 6, 4, "s"], [35, 30, 6, 5, "s"], [41, 27, 4, 4, "h"]]),
    up: mkNear([[29, 32, 5, 6, "s"], [30, 26, 5, 6, "s"], [31, 22, 5, 4, "h"]]),
    forwardLow: mkNear([[30, 36, 5, 5, "s"], [34, 40, 6, 4, "s"], [40, 41, 4, 4, "h"]]),
    forward: mkNear([[30, 36, 5, 6, "s"], [34, 39, 8, 4, "s"], [42, 39, 4, 4, "h"]]),
    forwardHigh: mkNear([[30, 35, 5, 5, "s"], [34, 33, 7, 4, "s"], [41, 31, 4, 4, "h"]]),
    flex: mkNear([[30, 36, 7, 4, "s"], [35, 31, 4, 6, "s"], [34, 27, 4, 4, "h"]]),
    salute: mkNear([[30, 36, 6, 4, "s"], [35, 30, 5, 7, "s"], [37, 23, 5, 5, "h"]]),
  };

  return { armL, armR };
}

export function buildBackArmParts({ sleeveL = "A", sleeveR = "d", hand = "S", cuff = null } = {}) {
  // Rear view: arms mirror front silhouette with deeper rear tones so elbows/shoulders read back-lit
  const drawLimb = (g, segs, s, h) => {
    for (const [x, y, w, hh, col] of segs) fill(g, x, y, w, hh, col === "s" ? s : col === "h" ? h : col);
  };
  const backHand = hand === "S" ? "s" : "w";
  const mkL = (segs) => { const g = blank(); drawLimb(g, segs, sleeveR, backHand); return g; };
  const mkR = (segs) => { const g = blank(); drawLimb(g, segs, sleeveL, backHand); return g; };
  const cL = cuff ? [[16, 42, 4, 2, cuff]] : [];
  const cR = cuff ? [[44, 42, 4, 2, cuff]] : [];

  const armL = {
    back: mkL([[15, 36, 5, 4, "s"], [13, 40, 4, 5, "s"], [11, 44, 4, 4, "h"]]),
    down: mkL([[16, 36, 4, 8, "s"], ...cL, [16, 44, 4, 4, "h"]]),
    lowOut: mkL([[15, 36, 5, 4, "s"], [12, 39, 5, 4, "s"], [10, 42, 4, 4, "h"]]),
    mid: mkL([[12, 36, 8, 4, "s"], [8, 36, 4, 4, "h"]]),
    highOut: mkL([[15, 34, 5, 4, "s"], [12, 30, 4, 5, "s"], [9, 27, 4, 4, "h"]]),
    up: mkL([[14, 34, 6, 4, "s"], [12, 28, 4, 6, "s"], [12, 24, 4, 4, "h"]]),
    forwardLow: mkL([[16, 36, 4, 6, "s"], [17, 42, 4, 4, "h"]]),
    forward: mkL([[16, 36, 4, 5, "s"], [16, 41, 4, 4, "h"]]),
    forwardHigh: mkL([[15, 35, 5, 5, "s"], [15, 31, 4, 4, "h"]]),
    flex: mkL([[14, 36, 6, 4, "s"], [10, 32, 4, 6, "s"], [10, 28, 4, 4, "h"]]),
  };
  const armR = {
    back: mkR([[44, 36, 5, 4, "s"], [47, 40, 4, 5, "s"], [49, 44, 4, 4, "h"]]),
    down: mkR([[44, 36, 4, 8, "s"], ...cR, [44, 44, 4, 4, "h"]]),
    lowOut: mkR([[44, 36, 5, 4, "s"], [47, 39, 5, 4, "s"], [50, 42, 4, 4, "h"]]),
    mid: mkR([[44, 36, 8, 4, "s"], [52, 36, 4, 4, "h"]]),
    highOut: mkR([[44, 34, 5, 4, "s"], [48, 30, 4, 5, "s"], [51, 27, 4, 4, "h"]]),
    up: mkR([[44, 34, 6, 4, "s"], [48, 28, 4, 6, "s"], [48, 24, 4, 4, "h"]]),
    forwardLow: mkR([[44, 36, 4, 6, "s"], [43, 42, 4, 4, "h"]]),
    forward: mkR([[44, 36, 4, 5, "s"], [44, 41, 4, 4, "h"]]),
    forwardHigh: mkR([[44, 35, 5, 5, "s"], [45, 31, 4, 4, "h"]]),
    flex: mkR([[44, 36, 6, 4, "s"], [50, 32, 4, 6, "s"], [50, 28, 4, 4, "h"]]),
    salute: mkR([[44, 36, 6, 4, "s"], [48, 28, 4, 8, "s"], [45, 22, 5, 6, "h"]]),
  };
  return { armL, armR };
}

// ============================================================================
// Side-Profile (Forward-Pointing Scissor Stride) & Back-View Leg Builders
// ============================================================================

export function buildSideLegParts({ legs = "pants", boots = "dark", pants = "N", pantsHi = "n" } = {}) {
  const bMain = boots === "white" ? "W" : boots === "brown" ? "B" : boots === "space" ? "W" : "g";
  const bDark = boots === "white" ? "w" : boots === "brown" ? "K" : boots === "space" ? "w" : "O";
  const bSole = boots === "white" ? "w" : boots === "space" ? "g" : "O";

  const drawSideLeg = (g, x, y, h, isNear) => {
    const pCol = isNear ? pants : "O";
    if (legs === "shorts") {
      fill(g, x, y, 7, 2, pCol);
      fill(g, x, y + 2, 7, Math.max(2, h - 2), isNear ? "S" : "s");
    } else {
      fill(g, x, y, 7, h, pCol);
      if (isNear) fill(g, x + 4, y, 3, h, pantsHi); // front-facing shin highlight!
    }
    // Right-pointing boot silhouette (toe juts +3px forward to the right!)
    fill(g, x, y + h, 9, 2, isNear ? bMain : bDark);
    fill(g, x, y + h + 2, 10, 2, bSole);
  };
  const mk = (fn) => { const g = blank(); fn(g); return g; };

  // legL = FAR leg (steps forward-right); legR = NEAR leg (braces/pushes back-left) for true scissor stride!
  const legL = {
    stand: mk((g) => drawSideLeg(g, 30, 50, 4, false)),
    halfStep: mk((g) => drawSideLeg(g, 33, 49, 4, false)),
    step: mk((g) => drawSideLeg(g, 36, 48, 4, false)),
    kick: mk((g) => drawSideLeg(g, 39, 47, 3, false)),
    halfWide: mk((g) => drawSideLeg(g, 34, 50, 4, false)),
    wide: mk((g) => drawSideLeg(g, 37, 50, 4, false)),
    halfCrouch: mk((g) => drawSideLeg(g, 32, 51, 3, false)),
    crouch: mk((g) => drawSideLeg(g, 34, 52, 2, false)),
  };
  const legR = {
    stand: mk((g) => drawSideLeg(g, 26, 50, 4, true)),
    halfStep: mk((g) => drawSideLeg(g, 23, 49, 4, true)),
    step: mk((g) => drawSideLeg(g, 20, 49, 4, true)),
    kick: mk((g) => drawSideLeg(g, 17, 48, 3, true)),
    halfWide: mk((g) => drawSideLeg(g, 23, 50, 4, true)),
    wide: mk((g) => drawSideLeg(g, 20, 50, 4, true)),
    halfCrouch: mk((g) => drawSideLeg(g, 25, 51, 3, true)),
    crouch: mk((g) => drawSideLeg(g, 23, 52, 2, true)),
  };
  return { legL, legR };
}

export function buildBackLegParts({ legs = "pants", boots = "dark", pants = "N", pantsHi = "n" } = {}) {
  const bMain = boots === "white" ? "w" : boots === "brown" ? "K" : boots === "space" ? "w" : "g";
  const bSole = boots === "white" ? "G" : boots === "space" ? "g" : "O";
  const drawLeg = (g, x, y, h, footDx) => {
    if (legs === "shorts") {
      fill(g, x, y, 8, 2, pants);
      fill(g, x, y + 2, 8, Math.max(2, h - 2), "s");
    } else {
      fill(g, x, y, 8, h, pants);
      fill(g, x + 2, y, 4, h, pants === "W" ? "w" : "O"); // rear crease shadow
    }
    // Rounded rear heel of boots
    fill(g, x + footDx, y + h, 8, 2, bMain);
    fill(g, x + footDx, y + h + 2, 8, 2, bSole);
  };
  const mk = (fn) => { const g = blank(); fn(g); return g; };
  const legL = {
    stand: mk((g) => drawLeg(g, 22, 50, 4, 0)),
    halfStep: mk((g) => drawLeg(g, 21, 49, 3, -1)),
    step: mk((g) => drawLeg(g, 20, 48, 2, -2)),
    kick: mk((g) => drawLeg(g, 16, 47, 2, -2)),
    halfWide: mk((g) => drawLeg(g, 20, 50, 4, -1)),
    wide: mk((g) => drawLeg(g, 18, 50, 4, -2)),
    halfCrouch: mk((g) => drawLeg(g, 21, 51, 3, 0)),
    crouch: mk((g) => drawLeg(g, 20, 52, 2, 0)),
  };
  const legR = {
    stand: mk((g) => drawLeg(g, 34, 50, 4, 0)),
    halfStep: mk((g) => drawLeg(g, 35, 49, 3, 1)),
    step: mk((g) => drawLeg(g, 36, 48, 2, 2)),
    kick: mk((g) => drawLeg(g, 40, 47, 2, 2)),
    halfWide: mk((g) => drawLeg(g, 36, 50, 4, 1)),
    wide: mk((g) => drawLeg(g, 38, 50, 4, 2)),
    halfCrouch: mk((g) => drawLeg(g, 35, 51, 3, 0)),
    crouch: mk((g) => drawLeg(g, 36, 52, 2, 0)),
  };
  return { legL, legR };
}

// ============================================================================
// Multi-Angle Prop Adapter (Preserves Front Props + Adds Side/Back Overrides)
// ============================================================================

function shiftMatrixX(src, dx) {
  if (!dx) return clone(src);
  const n = src.length, out = blank(n);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const ch = src[y][x];
      if (ch !== "." && x + dx >= 0 && x + dx < n) out[y][x + dx] = ch;
    }
  }
  return out;
}

/**
 * Build front / side / back prop dictionaries so every prop variant exists in all 3 views.
 * Center-held props automatically nudge slightly forward (+6px right) in side profile unless
 * an explicit hand-crafted `sideProps` or `backProps` override is supplied!
 */
export function buildAngleProps(frontProps = {}, sideOverrides = {}, backOverrides = {}) {
  const side = {};
  const back = {};
  for (const [key, mat] of Object.entries(frontProps)) {
    if (sideOverrides[key]) {
      side[key] = sideOverrides[key];
    } else {
      // Detect center-chest props (centroid near x=32) vs right-hand props (x>40) and gently project forward in side view
      let sumX = 0, cnt = 0;
      for (let y = 0; y < PIXEL_GRID_SIZE; y++) {
        for (let x = 0; x < PIXEL_GRID_SIZE; x++) {
          if (mat[y][x] !== ".") { sumX += x; cnt++; }
        }
      }
      const cx = cnt ? sumX / cnt : 32;
      const autoShift = cx >= 22 && cx <= 40 ? 8 : 0;
      side[key] = shiftMatrixX(mat, autoShift);
    }
    back[key] = backOverrides[key] ? backOverrides[key] : clone(mat);
  }
  return { front: frontProps, side, back };
}
