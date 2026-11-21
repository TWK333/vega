// Rigged 64×64 pixel citizens (1–10): coder, doctor, chef, artist, scientist,
// astronaut, barista, detective, musician, firefighter — each with 7 articulated skeletal parts
// and 5 independent gag keyframe animation clips (50 clips).

import {
  SKIN, blank, buildCharacterRig, clip, clone, fill, kf, makePalette, makeRiggedSprite, partPatch, px, stamp, stamp2x,
} from "./pixel-rig.js";

// 1. 程序员 (男) — 敲到冒火 / 咖啡续命 / 全绿庆祝 / 蓝屏瘫倒 / 疯狂抓虫
const coderRig = buildCharacterRig({
  gender: "male", hairStyle: "spiky", eyeStyle: "glasses", coat: "hoodie",
  props: {
    default: partPatch(11, 20, ["gggggggggg", "gCCCCCCCCg", "gCWWVVCCCg", "gCCVVWWCCg", "gggggggggg"]),
    laptopGreen: partPatch(11, 20, ["gggggggggg", "gVVVVVVVVg", "gVWWVVWWVg", "gVVVVWWVVg", "gggggggggg"]),
    laptopFire: partPatch(11, 20, ["gggggggggg", "gFFYYYYFFg", "gFRRYYRRFg", "gFFFFFFFFg", "gggggggggg"]),
    laptopBsod: partPatch(11, 20, ["gggggggggg", "gCCCCCCCCg", "gCWCCWWCCg", "gCCWCCCCCg", "gggggggggg"]),
    coffee: partPatch(23, 18, ["WWWW", "WBBWw", "WWWW"]),
    swatter: partPatch(22, 10, ["ggggg", "gWgWg", "ggggg", "..B..", "..B..", "..B.."]),
  },
});
const coder = makeRiggedSprite({
  id: "coder", name: "程序员", gender: "male",
  palette: makePalette(SKIN.peach, { H: "#3b2c25", h: "#664d40", k: "#241914" }),
  rig: coderRig,
  idleKeyframe: kf({ armL: "forward", armR: "forward", prop: "default" }),
  animations: [
    // 敲到冒火（6大拍→18帧完整叙事）：蓄力俯身 → 绿屏狂敲 → 火星四起 → 烈焰暴走 → 惊呼后仰 → 冒烟眨眼收势
    clip("typing", "敲到冒火", [220, 120, 100, 95, 130, 190], [
      kf({ head: { dy: 0, variant: "normal" }, armL: "forwardLow", armR: "forwardLow", prop: "default" }),
      kf({ head: { dy: 1, variant: "normal" }, armL: { dy: -1, variant: "forward" }, armR: { dy: 1, variant: "forward" }, prop: "laptopGreen" }, { fx: [[9, 1, ["V........V"]]] }),
      kf({ head: { dy: 1, variant: "glowF" }, torso: "leanL", armL: { dy: 1, variant: "forwardHigh" }, armR: { dy: -1, variant: "forward" }, prop: { dy: -1, variant: "laptopFire" } }, { fx: [[11, 15, ["..F....F..", ".FYF..FYF.", "FFYFFYFF.."]]] }),
      kf({ head: { dy: 0, variant: "glowF" }, torso: "leanR", armL: { dx: 1, dy: -1, variant: "forward" }, armR: { dx: -1, dy: 1, variant: "forwardHigh" }, prop: { dy: 0, variant: "laptopFire" } }, { fx: [[10, 13, ["...Y..F..Y..", "..FYRFFRYF..", ".FFYYYYYYFF.", ".FRRYYYYRRF."]], [6, 1, ["F...V....Y...F"]]] }),
      kf({ head: { dy: -1, variant: "shock" }, torso: "leanL", armL: "highOut", armR: "highOut", legL: "wide", legR: "wide", prop: { dy: -1, variant: "laptopFire" } }, { fx: [[11, 13, ["...F..Y..F..", "..FFYYYYFF.."]], [8, 0, ["Y....F....V"]]] }),
      kf({ head: { dy: 0, variant: "blink" }, armL: "forward", armR: "forward", prop: "default" }, { fx: [[11, 16, [".w...w...w..", "..w....w...."]]] }),
    ], { targetFrames: 18 }),
    clip("coffee", "咖啡续命", [200, 160, 140, 140, 190], [
      kf({ head: "normal", armL: "down", armR: "mid", prop: { dx: 1, dy: 0, variant: "coffee" } }, { fx: [[24, 14, [".W.", "..W"]]] }),
      kf({ head: { dy: 1, variant: "blink" }, armL: "down", armR: { dx: -1, dy: -2, variant: "salute" }, prop: { dx: -3, dy: -4, variant: "coffee" } }, { fx: [[21, 10, [".W..W."]]] }),
      kf({ head: { dy: -1, variant: "glowC" }, torso: "leanR", armL: "mid", armR: "up", legL: "wide", legR: "wide", prop: { dx: 1, dy: -5, variant: "coffee" } }, { fx: [[8, 0, ["..W..W....W..W..", ".W....W..W....W."]]] }),
      kf({ head: { dy: -2, variant: "flash" }, torso: { dy: -1, variant: "normal" }, armL: "up", armR: "up", legL: { dy: -1, variant: "step" }, legR: { dy: -1, variant: "step" }, prop: false }, { shadow: "shrink", fx: [[5, 0, ["C...W....Y....W...C", "..Y..W..CCC..W..Y.."]]] }),
      kf({ head: "happy", armL: "down", armR: "mid", prop: { dx: 0, dy: -1, variant: "coffee" } }, { fx: [[24, 13, ["W.Y."]]] }),
    ]),
    clip("deploy", "全绿庆祝", [180, 140, 140, 170], [
      kf({ head: "flash", armL: "forward", armR: "forward", prop: "laptopGreen" }),
      kf({ head: { dy: -1, variant: "flash" }, armL: "up", armR: "up", legL: "step", legR: "stand", prop: "laptopGreen" }, { fx: [[3, 1, ["Y..M....V....C..Y", ".C.............M."]]] }),
      kf({ head: { dy: -1, variant: "happy" }, torso: "leanR", armL: { dy: -1, variant: "up" }, armR: { dy: -1, variant: "up" }, legL: "stand", legR: "step", prop: "laptopGreen" }, { fx: [[1, 0, ["Y.M..Y......Y..C.Y", "..C....VVVV....M.."]]] }),
      kf({ head: "flash", armL: "mid", armR: "up", prop: "laptopGreen" }, { fx: [[4, 2, ["Y....C....M....Y"]]] }),
    ]),
    clip("bsod", "蓝屏瘫倒", [200, 170, 180, 220, 200], [
      kf({ head: "shock", armL: "mid", armR: "mid", prop: "laptopBsod" }),
      kf({ head: { dy: 1, variant: "shock" }, torso: { dy: 1, variant: "normal" }, armL: { dy: 1, variant: "down" }, armR: { dy: 1, variant: "down" }, legL: "crouch", legR: "crouch", prop: "laptopBsod" }, { petrify: true, fx: [[23, 6, [".WW.", "WWWW", ".WW."]]] }),
      kf({ head: { dy: 2, variant: "dizzy" }, torso: { dy: 1, variant: "leanL" }, armL: { dy: 2, variant: "down" }, armR: { dy: 2, variant: "down" }, legL: "crouch", legR: "crouch", prop: "laptopBsod" }, { petrify: true, fx: [[22, 2, [".WWW.", "WWWWW", "WEWEW", "W.W.W"]]] }),
      kf({ head: { dy: 2, variant: "dizzy" }, torso: { dy: 2, variant: "leanL" }, armL: { dy: 2, variant: "down" }, armR: { dy: 2, variant: "down" }, legL: "crouch", legR: "crouch", prop: "laptopBsod" }, { petrify: true, fx: [[21, 0, [".WWW.", "WEWEW", "WWWWW", "W.W.W"]], [5, 11, ["C", "C"]]] }),
      kf({ head: "dizzy", armL: "down", armR: "down", prop: "default" }, { fx: [[23, 8, ["C", "C"]]] }),
    ]),
    clip("debug", "疯狂抓虫", [150, 120, 110, 120, 160], [
      kf({ head: "shock", armL: "back", armR: "mid", prop: { dx: 1, dy: 2, variant: "swatter" } }, { fx: [[25, 16, ["R.R", "RRR", "R.R"]]] }),
      kf({ head: "shout", torso: "leanL", armL: "mid", armR: "up", legL: "wide", legR: "stand", prop: { dx: 0, dy: -3, variant: "swatter" } }, { fx: [[25, 14, ["R.R", "RRR", "R.R"]]] }),
      kf({ head: "shout", torso: "leanR", armL: "back", armR: { dx: 1, dy: 1, variant: "mid" }, legL: "stand", legR: "wide", prop: { dx: 1, dy: 5, variant: "swatter" } }, { fx: [[22, 14, ["Y.F.Y", "FWRWF", "Y.F.Y"]]] }),
      kf({ head: "glow", torso: "leanL", armL: "mid", armR: "up", prop: { dx: 0, dy: -2, variant: "swatter" } }, { fx: [[22, 11, ["Y...Y", ".F.F.", "..R.."]]] }),
      kf({ head: "happy", armL: "down", armR: "mid", prop: "default" }, { fx: [[24, 8, ["...VV", "..VV.", "V.VV.", ".VV.."]]] }),
    ]),
  ],
});

// 2. 医生 (女) — 听诊弹飞 / 狂写病历 / 巨型针筒 / 电击除颤 / 挂瓶回血
const doctorRig = buildCharacterRig({
  gender: "female", hairStyle: "ponytail", coat: "labcoat",
  hatFn(g) { stamp2x(g, 11, 4, ["..WWWWWW..", ".WWWRRWWW.", ".WWWRRWWW."]); },
  extraTorso(g) { stamp2x(g, 13, 18, ["g....g", "g....g", ".g..g.", "..gg..", "..GG.."], false); },
  props: {
    default: partPatch(23, 18, [".g.", "gGg", ".g."]),
    patient: partPatch(24, 17, [".SS.", "SESS", ".SS.", "CCCC", "CCCC", "N..N"], false),
    patientShock: partPatch(24, 17, [".SS.", "SWSW", ".SS.", "CCCC", "N..N"], false),
    chart: partPatch(22, 16, ["WWWWW", "WgggW", "WggWW", "WWWWW"], false),
    syringe: partPatch(22, 8, ["..G..", ".ggg.", "WVVVW", "WVCVW", "WVVVW", ".ggg.", "..g.."], false),
    defib: (() => { const g = blank(); stamp2x(g, 3, 17, ["ggg", "gCg", "ggg"], false); stamp2x(g, 25, 17, ["ggg", "gCg", "ggg"], false); return g; })(),
    iv: partPatch(24, 4, ["ggggg", "..g..", ".WVW.", ".WVW.", "..V..", "..g..", "..g..", "..g.."], false),
  },
});
const doctor = makeRiggedSprite({
  id: "doctor", name: "医生", gender: "female",
  palette: makePalette(SKIN.fair, { H: "#5c3828", h: "#8f5b43", k: "#3b2116" }),
  rig: doctorRig,
  idleKeyframe: kf({ prop: false }),
  animations: [
    clip("heartbeat", "听诊弹飞", [190, 130, 130, 140, 190], [
      kf({ head: "normal", armL: "down", armR: "mid", prop: { dx: 0, dy: 0, variant: "patient" } }),
      kf({ head: "shock", torso: "leanL", armL: "mid", armR: "mid", legL: "wide", legR: "stand", prop: { dx: 0, dy: -8, variant: "patientShock" } }, { fx: [[22, 16, [".RR.RR.", "RRRRRRR", ".RRRRR.", "..RRR.."]]] }),
      kf({ head: { dy: -1, variant: "shock" }, torso: "leanL", armL: "up", armR: "up", legL: "wide", legR: "wide", prop: { dx: 0, dy: -14, variant: "patientShock" } }, { fx: [[21, 13, ["Y.RR.RR.Y", ".RRRRRRR.", ".RRWWRRR.", "..RRRRR.."]]] }),
      kf({ head: "normal", armL: "down", armR: "mid", prop: { dx: 0, dy: -5, variant: "patient" } }, { fx: [[24, 19, ["R.R", "RRR", ".R."]]] }),
      kf({ head: "happy", armL: "down", armR: "down", prop: { dx: 0, dy: 0, variant: "patient" } }, { fx: [[25, 12, ["R.R", "RRR", ".R."]]] }),
    ]),
    clip("chart", "狂写病历", [150, 120, 120, 150], [
      kf({ head: { dy: 1, variant: "normal" }, armL: "forward", armR: { dx: -1, dy: 0, variant: "mid" }, prop: "chart" }),
      kf({ head: { dy: 1, variant: "normal" }, torso: "leanR", armL: "forward", armR: { dx: 1, dy: -1, variant: "mid" }, prop: { dy: -1, variant: "chart" } }, { fx: [[2, 2, ["WWW...................WWW", "Wgg...................ggW"]]] }),
      kf({ head: { dy: 0, variant: "glow" }, torso: "leanL", armL: "forward", armR: { dx: -1, dy: -1, variant: "forward" }, prop: { dy: 0, variant: "chart" } }, { fx: [[1, 1, ["..WWW.......WWW.....WWW..", "..Wgg.......ggW.....Wgg.."]]] }),
      kf({ head: "blink", armL: "down", armR: "mid", prop: "chart" }, { fx: [[2, 5, ["WWW...................WWW"]]] }),
    ]),
    clip("remedy", "巨型针筒", [180, 140, 140, 180], [
      kf({ head: "normal", armL: "down", armR: "mid", prop: { dx: 0, dy: 3, variant: "syringe" } }),
      kf({ head: "glowV", torso: "leanL", armL: "mid", armR: "up", legL: "wide", legR: "stand", prop: { dx: 0, dy: -3, variant: "syringe" } }, { fx: [[20, 1, ["V...C...V"]]] }),
      kf({ head: "glowV", torso: "leanL", armL: "up", armR: { dy: -1, variant: "up" }, legL: "wide", legR: "wide", prop: { dx: 0, dy: -5, variant: "syringe" } }, { fx: [[2, 4, ["V.V", "VVV", ".V."]], [21, 0, ["V.C.V"]]] }),
      kf({ head: "happy", armL: "down", armR: "mid", prop: { dx: 0, dy: 1, variant: "syringe" } }, { fx: [[22, 6, [".V.V."]]] }),
    ]),
    clip("defib", "电击除颤", [160, 120, 120, 150], [
      kf({ head: "normal", armL: "mid", armR: "mid", prop: "defib" }),
      kf({ head: "glowC", torso: "normal", armL: "flex", armR: "flex", legL: "wide", legR: "wide", prop: { dy: -3, variant: "defib" } }, { fx: [[2, 11, ["Y.C.Y"]], [25, 11, ["Y.C.Y"]], [8, 5, ["C...Y...C...Y...C"]]] }),
      kf({ head: "flash", armL: "up", armR: "up", legL: "wide", legR: "wide", prop: { dy: -5, variant: "defib" } }, { fx: [[6, 1, ["..C..Y..W..Y..C..", ".Y.............Y."]]] }),
      kf({ head: "blink", armL: "down", armR: "down", prop: "defib" }),
    ]),
    clip("coffee_iv", "挂瓶回血", [200, 160, 150, 190], [
      kf({ head: { dy: 1, variant: "dizzy" }, armL: "down", armR: "down", legL: "crouch", legR: "crouch", prop: "iv" }),
      kf({ head: "normal", armL: "mid", armR: "down", prop: "iv" }, { fx: [[3, 7, ["VV", "VV"]]] }),
      kf({ head: "glowV", armL: "up", armR: "mid", legL: "step", legR: "stand", prop: "iv" }, { fx: [[2, 3, ["..V..", "VVVVV", "..V.."]], [6, 1, ["Y........Y"]]] }),
      kf({ head: "happy", armL: "up", armR: "up", legL: "stand", legR: "step", prop: "iv" }, { fx: [[2, 1, ["Y..V..Y", "..VVV.."]]] }),
    ]),
  ],
});

// 3. 厨师 (男) — 烈焰颠勺 / 撒盐暴雪 / 小当家金光 / 残影快刀 / 帽飞起锅
const chefHat = (g) => {
  stamp2x(g, 10, 1, ["..WWWWWWWW..", ".WWWWWWWWWW.", ".WWwWWWWwWW.", ".WWWWWWWWWW.", "..wwwwwwww.."]);
};
const chefRig = buildCharacterRig({
  gender: "male", hairStyle: "short", coat: "chef",
  hatFn: chefHat,
  beardFn(g) { stamp2x(g, 13, 13, ["HH..HH"], false); },
  props: {
    default: partPatch(22, 21, ["gggggg", ".gggg."]),
    wokUp: partPatch(22, 18, ["ggggggg", ".ggggg."]),
    knife: partPatch(22, 17, ["WWWWW", "WWWWW", "gBBBB"]),
    hatFloat: partPatch(10, 0, [".WWWWWWWW.", "WWWWWWWWWW", ".wwwwwwww."]),
  },
});
const chef = makeRiggedSprite({
  id: "chef", name: "厨师", gender: "male",
  palette: makePalette(SKIN.warm, { H: "#4a3228", h: "#755141", k: "#2b1c16" }),
  rig: chefRig,
  animations: [
    // 烈焰颠勺（6大拍→18帧完整叙事）：扎马步蓄力 → 猛然颠锅 → 冲天龙焰+煎蛋飞空 → 凌空接蛋 → 完美收锅点赞
    clip("wok", "烈焰颠勺", [210, 130, 110, 110, 140, 190], [
      kf({ head: { dy: 1, variant: "normal" }, armL: "back", armR: "lowOut", legL: "crouch", legR: "crouch", prop: "default" }),
      kf({ head: "normal", armL: "back", armR: "mid", legL: "wide", legR: "wide", prop: "default" }, { fx: [[22, 16, ["..F..", ".FYF."]]] }),
      kf({ head: { dy: -1, variant: "shout" }, torso: "leanL", armL: "mid", armR: "up", legL: "wide", legR: "wide", prop: { dy: -2, variant: "wokUp" } }, { fx: [[23, 3, [".WW.", "WYYW", ".WW."]], [21, 9, ["...Y...", "..FYF..", ".FFYFF.", ".FRYRF.", ".FFFFF."]]] }),
      kf({ head: "glowF", torso: "leanL", armL: "up", armR: { dy: -1, variant: "up" }, legL: "wide", legR: "stand", prop: { dy: -3, variant: "wokUp" } }, { fx: [[22, 0, [".WW.", "WYYW", ".WW."]], [20, 6, ["....Y....", "...FYF...", "..FFYFF..", "..FRYRF..", ".FFYYYFF.", ".FRRRRRF."]]] }),
      kf({ head: "normal", armL: "down", armR: "mid", prop: "wokUp" }, { fx: [[23, 8, [".WW.", "WYYW", ".WW."]], [21, 13, ["..FYF..", ".FFYFF."]]] }),
      kf({ head: "happy", armL: "down", armR: "down", prop: "default" }, { fx: [[23, 17, [".W..W.", "W....W"]]] }),
    ], { targetFrames: 18 }),
    clip("salt", "撒盐暴雪", [170, 140, 140, 170], [
      kf({ head: "normal", armL: "back", armR: "salute", prop: "default" }, { fx: [[24, 13, ["W", ".Y"]]] }),
      kf({ head: { dx: -1, variant: "blink" }, torso: "leanL", armL: "back", armR: { dx: 1, dy: -1, variant: "up" }, legL: "wide", legR: "stand", prop: false }, { fx: [[22, 12, ["..W.Y.W.", ".Y.W.y.W", "..W.Y.W.", ".y.W.Y.."]]] }),
      kf({ head: "happy", torso: "leanL", armL: "mid", armR: { dx: 1, dy: -2, variant: "up" }, legL: "wide", legR: "stand", prop: false }, { fx: [[21, 11, [".Y.W.y.W", "W.y.W.Y.", ".Y.W.W.y", "W.Y.y.W."]]] }),
      kf({ head: "normal", armL: "down", armR: "salute", prop: "default" }, { fx: [[23, 14, [".W.Y", "y.W."]]] }),
    ]),
    clip("taste", "小当家金光", [190, 150, 150, 190], [
      kf({ head: "happy", armL: "forward", armR: "salute", prop: false }, { fx: [[3, 5, ["Y....................Y"]]] }),
      kf({ head: "glow", torso: "normal", armL: "mid", armR: "up", legL: "wide", legR: "wide", prop: false }, { fx: [[1, 1, ["Y..Y..............Y..Y", ".Y...Y..........Y...Y.", "Y....................Y", ".F..................F."]]] }),
      kf({ head: { dy: -1, variant: "glow" }, armL: "up", armR: "up", legL: "step", legR: "step", prop: false }, { shadow: "shrink", fx: [[0, 0, ["Y.F.Y..Y........Y..Y.F.Y", ".YYYY..............YYYY.", "Y..F................F..Y", "F......................F"]]] }),
      kf({ head: "happy", armL: "down", armR: "salute", prop: "default" }, { fx: [[2, 3, ["Y....................Y"]]] }),
    ]),
    clip("chop", "残影快刀", [110, 100, 100, 120], [
      kf({ head: { dy: 1, variant: "normal" }, armL: "forward", armR: "up", prop: { dy: -4, variant: "knife" } }),
      kf({ head: { dy: 1, variant: "glow" }, torso: "leanR", armL: "forward", armR: "mid", prop: { dy: 0, variant: "knife" } }, { fx: [[21, 10, ["..F..V..", ".V..F...", "WWwWWwWW"]]] }),
      kf({ head: { dy: 1, variant: "flash" }, torso: "leanR", armL: "forward", armR: { dy: -2, variant: "mid" }, prop: { dy: -2, variant: "knife" } }, { fx: [[19, 6, ["F...V...F", "..V...F..", "wWWwWWwWW", "WWwWWwWWw"]]] }),
      kf({ head: "happy", armL: "down", armR: "down", prop: "knife" }, { fx: [[22, 12, [".F..V.", "V....F"]]] }),
    ]),
    clip("hat_pop", "帽飞起锅", [180, 150, 150, 190], [
      kf({ head: "normal", armL: "down", armR: "mid", prop: "default" }, { fx: [[22, 15, [".W..W.", "W....W"]]] }),
      kf({ head: "hatlessShock", armL: "up", armR: "up", legL: "wide", legR: "wide", prop: { dx: 0, dy: 0, variant: "hatFloat" } }, { fx: [[8, 5, ["W..w....w..W", ".W..W..W..W."]]] }),
      kf({ head: { dy: 1, variant: "hatlessShock" }, armL: "mid", armR: "mid", legL: "crouch", legR: "crouch", prop: { dx: 1, dy: -1, variant: "hatFloat" } }, { fx: [[5, 4, ["W...W.....W...W", "..W...W.W...W.."]]] }),
      kf({ head: "happy", armL: "down", armR: "down", prop: "default" }, { fx: [[6, 3, ["W................W"]]] }),
    ]),
  ],
});

// 4. 画家 (女) — 颜料狂轰 / 灵感帽飞 / 七彩旋涡 / 灵魂画作 / 颜料糊脸
const artistHat = (g) => {
  stamp2x(g, 9, 2, ["......d......", "..aaAAAAAAA..", ".AAAAAAAAAAA.", ".ddAAAAAAAAdd"]);
};
const artistRig = buildCharacterRig({
  gender: "female", hairStyle: "wavy", coat: "apron",
  hatFn: artistHat,
  extraHeads(normal) {
    const paint = clone(normal);
    fill(paint, 21, 22, 6, 5, "S"); fill(paint, 37, 22, 6, 5, "S");
    stamp(paint, 22, 22, ["E..E", ".EE.", ".EE.", "E..E"]);
    stamp(paint, 38, 22, ["E..E", ".EE.", ".EE.", "E..E"]);
    stamp2x(paint, 10, 10, ["M...C..Y..", "....R.....", "Y......M..", "..C..R..C.", "...M...Y.."], false);
    return { paint };
  },
  props: {
    default: (() => { const g = blank(); stamp2x(g, 3, 20, [".bBBb", "bRYBb", "bVCBb", ".bBBb"]); stamp2x(g, 24, 17, ["..M", ".b.", "b..", "B.."], false); return g; })(),
    brushHigh: partPatch(23, 10, ["..M", ".b.", "b..", "B.."]),
    beretFloat: partPatch(10, 0, ["..aAAAAAAA..", ".AAAAAAAAAAA."]),
    canvas: partPatch(21, 9, ["bbbbbbbb", "bWWWWWWb", "bWROORWb", "bW.MM.Wb", "bW.CC.Wb", "bbbbbbbb"]),
    bucket: partPatch(23, 8, ["gggg", "gMMg", "gMMg"]),
  },
});
const artist = makeRiggedSprite({
  id: "artist", name: "画家", gender: "female",
  palette: makePalette(SKIN.fair, { H: "#a6422b", h: "#d45e42", k: "#6e2919" }),
  rig: artistRig,
  animations: [
    clip("splash", "颜料狂轰", [150, 130, 130, 150], [
      kf({ head: "normal", armL: "mid", armR: "mid", prop: "default" }, { fx: [[24, 11, ["M..Y", "..C."]]] }),
      kf({ head: "glowM", torso: "leanR", armL: "mid", armR: "up", prop: "brushHigh" }, { fx: [[2, 2, ["R..M................C..Y", "..Y..................M.."]], [23, 7, [".R.Y.", "C...M"]]] }),
      kf({ head: "glowM", torso: "leanL", armL: "down", armR: { dx: 1, dy: 0, variant: "mid" }, legL: "wide", legR: "stand", prop: { dx: 1, dy: 3, variant: "brushHigh" } }, { fx: [[21, 3, [".M.Y.C.R.", "R..M..Y..", ".C..R..M."]], [2, 6, ["C.M", ".Y."]]] }),
      kf({ head: "happy", armL: "down", armR: "down", prop: "default" }, { fx: [[23, 9, ["Y..C", ".M.R"]]] }),
    ]),
    clip("eureka", "灵感帽飞", [180, 150, 150, 180], [
      kf({ head: "normal", armL: "down", armR: "salute", prop: false }, { fx: [[5, 2, ["Y....................Y"]]] }),
      kf({ head: "hatlessShock", armL: "up", armR: "up", legL: "wide", legR: "wide", prop: { dx: 0, dy: 0, variant: "beretFloat" } }, { fx: [[2, 2, ["M..Y............C..R", ".C..R..........Y..M."]]] }),
      kf({ head: { dy: -1, variant: "hatless" }, armL: "mid", armR: "up", prop: { dx: -1, dy: -1, variant: "beretFloat" } }, { fx: [[1, 1, ["Y.C.M..............R.Y.C", ".R.Y................C.M."]]] }),
      kf({ head: "happy", armL: "down", armR: "down", prop: "default" }, { fx: [[4, 2, ["M....Y....C....R"]]] }),
    ]),
    clip("palette", "七彩旋涡", [160, 130, 130, 160], [
      kf({ head: "normal", armL: "mid", armR: "forward", prop: "default" }, { fx: [[1, 15, [".M.C.", "Y.R.V", ".U.Y."]]] }),
      kf({ head: "glow", torso: "leanL", armL: { dy: -1, variant: "mid" }, armR: { dx: -1, dy: -1, variant: "forward" }, prop: "default" }, { fx: [[0, 11, ["..C.M.Y..", ".R.U.C.M.", "Y.MWRWY.R", ".V.C.U.V.", "..Y.R.C.."]]] }),
      kf({ head: "glowM", torso: "leanL", armL: { dy: 0, variant: "mid" }, armR: { dx: -1, dy: 1, variant: "forward" }, prop: "default" }, { fx: [[0, 10, ["..Y.R.C..", ".M.C.Y.U.", "C.UWWWM.Y", ".R.Y.C.R.", "..M.V.Y.."]]] }),
      kf({ head: "blink", armL: "down", armR: "down", prop: "default" }, { fx: [[1, 14, [".R.Y.", "C.M.V"]]] }),
    ]),
    clip("portrait", "灵魂画作", [200, 160, 160, 200], [
      kf({ head: "normal", armL: "down", armR: "mid", prop: { dy: 2, variant: "canvas" } }),
      kf({ head: "glow", torso: "leanL", armL: "mid", armR: "up", prop: { dy: -1, variant: "canvas" } }, { fx: [[21, 5, ["Y..Y..Y."]]] }),
      kf({ head: "happy", torso: "leanL", armL: "up", armR: "up", legL: "step", legR: "stand", prop: { dy: -2, variant: "canvas" } }, { fx: [[20, 3, ["Y...Y...Y"]], [20, 7, ["Y"]]] }),
      kf({ head: "happy", armL: "down", armR: "mid", prop: { dy: 1, variant: "canvas" } }),
    ]),
    clip("paint_face", "颜料糊脸", [180, 140, 190, 210], [
      kf({ head: "normal", armL: "down", armR: "up", prop: "bucket" }),
      kf({ head: "shock", torso: "leanL", armL: "up", armR: "mid", legL: "wide", legR: "wide", prop: { dx: -1, dy: -2, variant: "bucket" } }, { fx: [[11, 5, ["M.C.Y.R.M", ".R.M.Y.C."]]] }),
      kf({ head: "paint", armL: "mid", armR: "mid", legL: "crouch", legR: "crouch", prop: false }),
      kf({ head: "paint", armL: "down", armR: "down", prop: "default" }, { fx: [[24, 9, ["C", "C"]]] }),
    ]),
  ],
});

// 5. 科学家 (女) — 毒液喷泉 / 护目反光 / 炸成爆炸头 / 迷你变身 / 公式刷屏
const scientistRig = buildCharacterRig({
  gender: "female", hairStyle: "fluffy", coat: "labcoat",
  hatFn(g) { stamp2x(g, 10, 6, ["ggCCCggCCCgg", "ggCWWggCWWgg", "gggggggggggg"], false); },
  extraHeads(normal) {
    const goggleFlash = clone(normal);
    stamp2x(goggleFlash, 10, 6, ["ggWWWggWWWgg", "ggWWWggWWWgg"], false);
    const afro = clone(normal);
    stamp2x(afro, 6, 1, [
      "....OOOOOOOOOOOO....", "..OOkOOOkOOOkOOOOO..", ".OOOOOkOOOOOkOOOOOO.",
      ".OOkOOOOOOOOOOOkOOO.", ".OOOOOOOOOOOOOOOOOO.", "..OOOOOOOOOOOOOOOO..",
    ]);
    fill(afro, 21, 22, 6, 5, "S"); fill(afro, 37, 22, 6, 5, "S");
    stamp(afro, 22, 22, ["WWWW", "WEEW", "WEEW", "WWWW"]);
    stamp(afro, 38, 22, ["WWWW", "WEEW", "WEEW", "WWWW"]);
    stamp(afro, 29, 28, [".OOOO.", "ORRRRO", "ORRRRO", ".OOOO."]);
    const afroDizzy = clone(afro);
    fill(afroDizzy, 21, 22, 6, 5, "S"); fill(afroDizzy, 37, 22, 6, 5, "S");
    stamp(afroDizzy, 22, 22, ["E..E", ".EE.", ".EE.", "E..E"]);
    stamp(afroDizzy, 38, 22, ["E..E", ".EE.", ".EE.", "E..E"]);
    return { goggleFlash, afro, afroDizzy };
  },
  props: {
    default: partPatch(23, 18, ["..ww..", "..ww..", ".wVVw.", "wVVVVw", "wVVVVw"]),
    flaskPurple: partPatch(23, 17, ["..ww..", "..ww..", ".wUUw.", "wUUUUw", "wUUUUw"]),
  },
});
const scientist = makeRiggedSprite({
  id: "scientist", name: "科学家", gender: "female",
  palette: makePalette(SKIN.peach, { H: "#4e476e", h: "#7d74a8", k: "#302b45" }),
  rig: scientistRig,
  animations: [
    clip("flask", "毒液喷泉", [160, 130, 120, 140], [
      kf({ head: "normal", armL: "down", armR: "mid", prop: { dx: 0, dy: 0, variant: "default" } }, { fx: [[24, 12, [".C.", "V.."]]] }),
      kf({ head: "glowV", torso: "leanL", armL: "mid", armR: "up", prop: { dx: -1, dy: -4, variant: "default" } }, { fx: [[22, 5, ["..V.C..", ".C..V..", "..VVV..", ".C.V.C."]]] }),
      kf({ head: "glowV", torso: "leanR", armL: "back", armR: { dx: 1, dy: -2, variant: "mid" }, legL: "wide", legR: "stand", prop: { dx: 1, dy: -2, variant: "default" } }, { fx: [[21, 0, ["C.V.C.V.C", ".V.C.V.C.", "..VVVVV..", "...CVV..."]]] }),
      kf({ head: "blink", armL: "down", armR: "down", prop: "default" }, { fx: [[23, 8, [".V..C.", "..C..."]]] }),
    ]),
    clip("atom", "护目反光", [180, 150, 150, 180], [
      kf({ head: "goggleFlash", armL: "up", armR: "down", prop: "default" }),
      kf({ head: "goggleFlash", armL: "mid", armR: "mid", prop: "default" }, { fx: [[9, 0, ["...C..U..C...", ".U....Y....U.", "...C..U..C..."]]] }),
      kf({ head: "glowC", torso: "leanR", armL: "up", armR: "up", prop: false }, { fx: [[7, 0, ["....U...C...U....", "..C...U.Y.U...C..", "....U...C...U...."]]] }),
      kf({ head: "goggleFlash", armL: "down", armR: "down", prop: "default" }, { fx: [[10, 1, ["..C.U.C..", ".U..Y..U.", "..C.U.C.."]]] }),
    ]),
    clip("boom", "炸成爆炸头", [170, 120, 150, 220, 220], [
      kf({ head: "normal", armL: "down", armR: "mid", prop: "default" }, { fx: [[23, 14, [".Y..", "FYF."]]] }),
      kf({ head: "shock", torso: "leanL", armL: "up", armR: "back", legL: "wide", legR: "wide", prop: false }, { fx: [[16, 4, ["...uWWWuu...", "..WWWWWWWW..", ".WWuYYYYuWW.", ".WWYFFFFYWW.", "..WWWWWWWW.."]]] }),
      kf({ head: "afro", armL: { dy: 1, variant: "down" }, armR: { dy: 1, variant: "down" }, legL: "crouch", legR: "crouch", prop: false }, { fx: [[5, 0, ["w....u........w....u"]]] }),
      kf({ head: "afroDizzy", armL: "down", armR: "down", prop: false }, { fx: [[7, 0, ["w......w......u"]]] }),
      kf({ head: "blink", armL: "down", armR: "down", prop: "default" }, { fx: [[9, 2, ["w....u....w"]]] }),
    ]),
    clip("shrink", "迷你变身", [180, 150, 210, 160, 180], [
      kf({ head: "normal", armL: "down", armR: "salute", prop: { dx: -2, dy: -4, variant: "flaskPurple" } }),
      kf({ head: "shock", armL: "mid", armR: "mid", legL: "crouch", legR: "crouch", prop: false }, { fx: [[6, 6, ["U...u.....u...U"]]] }),
      kf({ head: "shock", armL: "up", armR: "up", legL: "wide", legR: "wide", prop: "default" }, { scale: 0.5, shadow: "tiny", fx: [[9, 8, ["..u..U..u..", "U.........U"]]] }),
      kf({ head: "happy", armL: "mid", armR: "up", legL: "step", legR: "stand", prop: "default" }, { scale: 0.5, shadow: "tiny", fx: [[8, 6, ["Y...U...Y"]]] }),
      kf({ head: "happy", armL: "up", armR: "up", prop: "default" }, { fx: [[5, 4, ["U....................U"]]] }),
    ]),
    clip("eureka_eq", "公式刷屏", [160, 140, 140, 160], [
      kf({ head: "normal", armL: "down", armR: "up", prop: false }, { fx: [[2, 2, ["CC..C.", "C..CCC"]]] }),
      kf({ head: "glowC", torso: "leanR", armL: "mid", armR: { dx: 1, dy: -1, variant: "up" }, prop: false }, { fx: [[1, 1, ["C.C...Y.....C.CC...Y", ".C...Y.Y....CC.C..Y."]]] }),
      kf({ head: "goggleFlash", torso: "leanL", armL: "up", armR: "mid", prop: "default" }, { fx: [[1, 0, ["Y.CC...CC.C...Y.CC..", "..C.....C.C.....C..."]]] }),
      kf({ head: "happy", armL: "down", armR: "down", prop: "default" }, { fx: [[4, 2, ["C..Y..C..Y..C"]]] }),
    ]),
  ],
});

// 6. 宇航员 (男) — 失重翻滚 / 宇宙SOS / 火箭暴走 / 外星搭讪 / 太空漫步
const astronautRig = buildCharacterRig({
  gender: "male", coat: "spacesuit",
  customHead() {
    const g = blank();
    fill(g, 16, 8, 32, 26, "W");
    fill(g, 16, 8, 3, 3, "."); fill(g, 45, 8, 3, 3, ".");
    fill(g, 16, 31, 3, 3, "."); fill(g, 45, 31, 3, 3, ".");
    px(g, 18, 10, "W"); px(g, 45, 10, "W"); px(g, 18, 31, "W"); px(g, 45, 31, "W");
    fill(g, 42, 12, 6, 18, "w");
    fill(g, 20, 12, 24, 16, "N");
    px(g, 20, 12, "W"); px(g, 43, 12, "w"); px(g, 20, 27, "W"); px(g, 43, 27, "w");
    fill(g, 22, 14, 6, 4, "C"); fill(g, 22, 14, 3, 2, "W");
    return g;
  },
  extraHeads(normal) {
    const sweep1 = clone(normal); stamp2x(sweep1, 13, 7, ["CWW", ".CC"], false);
    const sweep2 = clone(normal); stamp2x(sweep2, 16, 7, ["CWW", ".CC"], false);
    const visorHappy = clone(normal); stamp2x(visorHappy, 12, 9, ["WW..WW"], false);
    return { sweep1, sweep2, visorHappy };
  },
  props: {
    alien: partPatch(23, 14, [".V..V.", "..VV..", ".VVVV.", "VEVEVV", ".VVVV.", "..VV.."]),
    alienWave: partPatch(23, 11, [".Y..Y.", "..VV..", ".VVVV.", "VWVWVV", ".VVVV.", "V.VV.V", "..VV.."]),
    ufo: partPatch(2, 1, ["..CCC..", ".CCCCC.", "gYYYYYg"]),
  },
});
const astronaut = makeRiggedSprite({
  id: "astronaut", name: "宇航员", gender: "male",
  palette: makePalette(SKIN.warm, { H: "#2d3748", h: "#4a5568", k: "#1a202c" }),
  rig: astronautRig,
  idleKeyframe: kf({ prop: false }),
  animations: [
    clip("float", "失重翻滚", [220, 200, 200, 220], [
      kf({ head: { dy: -1, variant: "normal" }, torso: { dy: -1, variant: "normal" }, armL: { dy: -1, variant: "mid" }, armR: { dy: -1, variant: "down" }, legL: { dy: -1, variant: "step" }, legR: { dy: -1, variant: "stand" }, prop: false }, { shadow: "shrink", fx: [[2, 2, ["Y.........................y"]]] }),
      kf({ head: { dx: -1, dy: -2, variant: "sweep1" }, torso: { dy: -2, variant: "leanL" }, armL: { dy: -2, variant: "up" }, armR: { dy: -2, variant: "mid" }, legL: { dy: -2, variant: "kick" }, legR: { dy: -2, variant: "step" }, prop: false }, { shadow: "tiny", fx: [[1, 1, [".y.......................Y"]]] }),
      kf({ head: { dx: 1, dy: -2, variant: "sweep2" }, torso: { dy: -2, variant: "leanR" }, armL: { dy: -2, variant: "mid" }, armR: { dy: -2, variant: "up" }, legL: { dy: -2, variant: "step" }, legR: { dy: -2, variant: "kick" }, prop: false }, { shadow: "tiny", fx: [[2, 0, ["Y........................Y"]]] }),
      kf({ head: { dy: -1, variant: "normal" }, torso: { dy: -1, variant: "normal" }, armL: { dy: -1, variant: "down" }, armR: { dy: -1, variant: "mid" }, legL: { dy: -1, variant: "stand" }, legR: { dy: -1, variant: "step" }, prop: false }, { shadow: "shrink", fx: [[3, 2, ["y.......................Y"]]] }),
    ]),
    clip("wave", "宇宙SOS", [170, 140, 140, 170], [
      kf({ head: "normal", armL: "mid", armR: "up", prop: false }),
      kf({ head: "sweep1", torso: "leanL", armL: "up", armR: "mid", legL: "step", legR: "stand", prop: false }, { fx: [[23, 5, ["..C.c", ".C..C"]], [1, 5, ["c.C..", "C..C."]]] }),
      kf({ head: "visorHappy", torso: "leanR", armL: "mid", armR: "up", legL: "stand", legR: "step", prop: false }, { fx: [[22, 2, ["...C.c.", "..C..C.", ".C.C..."]], [1, 2, ["c.C...", "C..C.."]]] }),
      kf({ head: "normal", armL: "down", armR: "up", prop: false }, { fx: [[23, 7, [".C.C."]]] }),
    ]),
    clip("boost", "火箭暴走", [150, 110, 110, 130, 170], [
      kf({ head: "normal", armL: "back", armR: "back", legL: "stand", legR: "stand", prop: false }, { fx: [[9, 28, ["..FF....FF.."]]] }),
      kf({ head: { dy: -1, variant: "sweep1" }, torso: { dy: -1, variant: "normal" }, armL: { dy: -1, variant: "back" }, armR: { dy: -1, variant: "back" }, legL: { dy: -1, variant: "stand" }, legR: { dy: -1, variant: "stand" }, prop: false }, { shadow: "shrink", fx: [[8, 26, ["..FFF....FFF..", "..FYF....FYF..", "...C......C..."]]] }),
      kf({ head: { dy: -3, variant: "sweep2" }, torso: { dy: -3, variant: "normal" }, armL: { dy: -3, variant: "up" }, armR: { dy: -3, variant: "up" }, legL: { dy: -3, variant: "stand" }, legR: { dy: -3, variant: "stand" }, prop: false }, { shadow: "none", fx: [[7, 24, ["..FFFF....FFFF..", "..FYYF....FYYF..", "...CC......CC...", "..w..w....w..w.."]]] }),
      kf({ head: { dy: -4, variant: "visorHappy" }, torso: { dy: -4, variant: "normal" }, armL: { dy: -4, variant: "up" }, armR: { dy: -4, variant: "up" }, legL: { dy: -4, variant: "kick" }, legR: { dy: -4, variant: "kick" }, prop: false }, { shadow: "none", fx: [[6, 23, ["..FYYF....FYYF..", "..FFFF....FFFF..", "...CC......CC...", ".w..w..ww..w..w."]]] }),
      kf({ head: { dy: -1, variant: "normal" }, torso: { dy: -1, variant: "normal" }, armL: { dy: -1, variant: "down" }, armR: { dy: -1, variant: "down" }, legL: { dy: -1, variant: "stand" }, legR: { dy: -1, variant: "stand" }, prop: false }, { shadow: "shrink", fx: [[9, 27, ["..w......w.."]]] }),
    ]),
    clip("alien", "外星搭讪", [190, 160, 160, 190], [
      kf({ head: { dx: -1, variant: "normal" }, torso: { dx: -1, variant: "leanL" }, armL: { dx: -1, variant: "down" }, armR: { dx: -1, variant: "mid" }, legL: { dx: -1, variant: "stand" }, legR: { dx: -1, variant: "stand" }, prop: { dx: 0, dy: 2, variant: "alien" } }),
      kf({ head: { dx: -1, variant: "visorHappy" }, torso: { dx: -1, variant: "leanL" }, armL: { dx: -1, variant: "mid" }, armR: { dx: -1, variant: "up" }, legL: { dx: -1, variant: "stand" }, legR: { dx: -1, variant: "stand" }, prop: { dx: 0, dy: -1, variant: "alienWave" } }, { fx: [[24, 6, ["C.C", ".C."]]] }),
      kf({ head: { dx: -1, variant: "visorHappy" }, torso: { dx: -1, variant: "leanL" }, armL: { dx: -1, variant: "up" }, armR: { dx: -1, variant: "mid" }, legL: { dx: -1, variant: "step" }, legR: { dx: -1, variant: "stand" }, prop: { dx: 0, dy: -3, variant: "alienWave" } }),
      kf({ head: "normal", armL: "down", armR: "mid", prop: { dx: 1, dy: 1, variant: "alien" } }),
    ]),
    clip("moonwalk", "太空漫步", [170, 150, 150, 170], [
      kf({ head: "normal", torso: "leanL", armL: "forward", armR: "back", legL: "step", legR: "stand", prop: { dx: 0, dy: 0, variant: "ufo" } }, { fx: [[6, 28, ["y.Y.y"]]] }),
      kf({ head: "sweep1", torso: "normal", armL: "back", armR: "forward", legL: "stand", legR: "step", prop: { dx: 8, dy: -1, variant: "ufo" } }, { fx: [[18, 28, ["y.Y.y"]]] }),
      kf({ head: "sweep2", torso: "leanR", armL: "forward", armR: "back", legL: "kick", legR: "stand", prop: { dx: 17, dy: 0, variant: "ufo" } }, { fx: [[21, 28, ["Y.y.Y"]]] }),
      kf({ head: "normal", torso: "normal", armL: "back", armR: "forward", legL: "stand", legR: "kick", prop: { dx: 10, dy: -1, variant: "ufo" } }, { fx: [[8, 28, ["Y.y"]]] }),
    ]),
  ],
});

// 7. 咖啡师 (女) — 香雾冲天 / 豆子机枪 / 圣光特调 / 奶泡山崩 / 浓缩觉醒
const baristaRig = buildCharacterRig({
  gender: "female", hairStyle: "bun", coat: "cafe", boots: "brown",
  hatFn(g) { fill(g, 20, 12, 24, 4, "A"); fill(g, 22, 12, 8, 2, "a"); },
  props: {
    default: partPatch(23, 20, ["BBBB", "WWWWw", "WWWw"]),
    grinder: partPatch(22, 17, ["..gg.", "BBBBB", "BKKKB", "BBBBB"]),
    foamMid: partPatch(20, 11, ["..WWWW..", ".WWWWWW.", "WWWWWWWW", "wWWWWWWw", ".WWWWWW."]),
    foamBig: partPatch(18, 5, ["...WWWWWW...", "..WWWWWWWW..", ".WWWWWWWWWW.", "WWWWwWWWWWWW", "WWWWWWWWwWWW", ".WWWWWWWWWW."]),
  },
});
const barista = makeRiggedSprite({
  id: "barista", name: "咖啡师", gender: "female",
  palette: makePalette(SKIN.tan, { H: "#2e201b", h: "#543b32", k: "#19100d" }),
  rig: baristaRig,
  animations: [
    clip("latte", "香雾冲天", [200, 170, 170, 200], [
      kf({ head: "normal", armL: "down", armR: "mid", prop: "default" }, { fx: [[23, 14, [".W..", "..W.", ".W.."]]] }),
      kf({ head: { dy: -1, variant: "happy" }, torso: "leanL", armL: "forward", armR: { dy: -1, variant: "mid" }, prop: { dy: -1, variant: "default" } }, { fx: [[20, 5, ["..WW..", ".W..W.", "..WW..", ".W....", "..WW.."]]] }),
      kf({ head: { dy: -1, variant: "happy" }, torso: "leanR", armL: "mid", armR: { dy: -2, variant: "mid" }, legL: "step", legR: "stand", prop: { dy: -2, variant: "default" } }, { fx: [[18, 1, ["..WWW..", ".W...W.", "..WWW..", ".W..W..", "..WWW.."]], [3, 4, ["W.W", ".W."]]] }),
      kf({ head: "blink", armL: "down", armR: "down", prop: "default" }, { fx: [[22, 10, [".W..", "..W.", ".W.."]]] }),
    ]),
    clip("grind", "豆子机枪", [130, 110, 110, 130], [
      kf({ head: "normal", armL: "forward", armR: { dy: -1, variant: "mid" }, prop: "grinder" }),
      kf({ head: "shout", torso: "leanR", armL: "forward", armR: { dx: 1, dy: 1, variant: "mid" }, prop: { dy: -1, variant: "grinder" } }, { fx: [[1, 3, ["B...B.................B..B", "..B...................B..."]]] }),
      kf({ head: "shout", torso: "leanL", armL: "forward", armR: { dx: -1, dy: -2, variant: "up" }, prop: { dy: 0, variant: "grinder" } }, { fx: [[1, 1, ["..B....B...........B...B..", "B..B.................B..B."]]] }),
      kf({ head: "blink", armL: "down", armR: "mid", prop: "grinder" }, { fx: [[22, 11, [".B..B.", "....B."]]] }),
    ]),
    clip("serve", "圣光特调", [190, 150, 150, 190], [
      kf({ head: "normal", armL: "forward", armR: "mid", prop: "default" }, { fx: [[22, 12, [".M.M.", "MMMMM", ".MMM.", "..M.."]]] }),
      kf({ head: "happy", torso: "leanR", armL: "mid", armR: "up", legL: "stand", legR: "step", prop: { dy: -4, variant: "default" } }, { fx: [[20, 4, ["Y..M.M..Y", "..MMMMM..", "...MMM..."]], [2, 6, [".M.M.", "MMMMM", ".MMM."]]] }),
      kf({ head: "glow", armL: "up", armR: "up", legL: "step", legR: "stand", prop: { dy: -5, variant: "default" } }, { fx: [[1, 1, ["Y.M.M..............M.M.Y", "..MMM..............MMM..", "...M................M..."]]] }),
      kf({ head: "happy", armL: "down", armR: "mid", prop: "default" }, { fx: [[23, 9, ["M.M", "MMM", ".M."]]] }),
    ]),
    clip("foam", "奶泡山崩", [180, 150, 160, 190], [
      kf({ head: "normal", armL: "down", armR: "mid", prop: "default" }, { fx: [[22, 16, [".WWW.", "WWWWW"]]] }),
      kf({ head: "shock", torso: "leanL", armL: "mid", armR: "mid", legL: "wide", legR: "stand", prop: "foamMid" }),
      kf({ head: "shock", torso: { dx: -1, variant: "leanL" }, armL: "up", armR: "up", legL: "wide", legR: "wide", prop: "foamBig" }),
      kf({ head: "dizzy", armL: "down", armR: "down", prop: "foamMid" }),
    ]),
    clip("espresso", "浓缩觉醒", [180, 140, 130, 160], [
      kf({ head: "normal", armL: "down", armR: "salute", prop: { dx: -4, dy: -6, variant: "default" } }),
      kf({ head: "glowC", armL: "mid", armR: "mid", legL: "wide", legR: "wide", prop: false }, { fx: [[1, 10, ["CCCCCCCCC", "WWWWWWWWW"]], [22, 10, ["CCCCCCCCC", "WWWWWWWWW"]]] }),
      kf({ head: "flash", armL: "up", armR: "up", legL: "wide", legR: "wide", prop: false }, { fx: [[0, 9, ["YCCCCCCCCC", "WWWWWWWWWW"]], [22, 9, ["CCCCCCCCCY", "WWWWWWWWWW"]], [10, 1, ["Y...C...Y"]]] }),
      kf({ head: "happy", armL: "down", armR: "down", prop: "default" }, { fx: [[5, 3, ["C....................C"]]] }),
    ]),
  ],
});

// 8. 侦探 (男) — 死光放大镜 / 真相只有一个 / 问号弹幕 / 烟圈推理 / 瞬间变装
const detectiveHat = (g) => {
  stamp2x(g, 7, 2, ["....bbbbbbbb....", "...bbbbbbbbbb...", "...ddAAAAAAdd...", ".bbbbbbbbbbbbbb."]);
};
const detectiveRig = buildCharacterRig({
  gender: "male", hairStyle: "short", coat: "trench", boots: "brown",
  hatFn: detectiveHat,
  extraHeads(normal) {
    const disguise = clone(normal);
    stamp2x(disguise, 9, 10, ["OOOOO..OOOOO", "OWOOO..OWOOO", ".OOO....OOO."], false);
    stamp2x(disguise, 10, 14, [".KKKKKKKKKK.", "KKKkkkkkkKKK", "..KKKKKKKK.."]);
    return { disguise };
  },
  props: {
    default: partPatch(23, 17, [".YYY.", "YCCWY", "YCCCY", ".YYY.", "B...."]),
    bigLens: partPatch(16, 9, ["..YYYYYY..", ".YCCWWCCY.", "YCCWWWWCCY", "YCCCWWCCCY", ".YCCCCCCY.", "..YYYYYY..", ".B........"]),
    flashLens: partPatch(14, 7, ["..YYYYYY..", ".YWWWWWWY.", "YWWWWWWWWY", "YWWWWWWWWY", ".YWWWWWWY.", "..YYYYYY..", ".B........"]),
    hatFloat: partPatch(8, 0, ["..bbbbbbbb..", ".ddAAAAAAdd.", "bbbbbbbbbbbb"]),
    notebook: partPatch(22, 17, ["WWWWW", "WgYgW", "WWWWW"]),
    pipe: partPatch(18, 14, ["BBB", "..BB"]),
  },
});
const detective = makeRiggedSprite({
  id: "detective", name: "侦探", gender: "male",
  palette: makePalette(SKIN.peach, { H: "#4a3b32", h: "#705a4d", k: "#2b221d" }),
  rig: detectiveRig,
  animations: [
    clip("inspect", "死光放大镜", [200, 160, 150, 190], [
      kf({ head: "normal", armL: "back", armR: "mid", prop: "default" }),
      kf({ head: "normal", torso: "leanR", armL: "back", armR: "forward", prop: "bigLens" }),
      kf({ head: "flash", torso: "leanR", armL: "mid", armR: "forward", legL: "stand", legR: "wide", prop: "flashLens" }, { fx: [[18, 5, ["W"]], [18, 15, ["W"]]] }),
      kf({ head: "blink", armL: "down", armR: "mid", prop: "default" }),
    ]),
    clip("aha", "真相只有一个", [180, 140, 140, 200], [
      kf({ head: "normal", armL: "down", armR: "mid", prop: "default" }, { fx: [[24, 5, [".YY.", ".YY.", ".YY.", "....", ".YY."]]] }),
      kf({ head: "hatlessShock", torso: "leanL", armL: "back", armR: "up", legL: "wide", legR: "stand", prop: "hatFloat" }, { fx: [[24, 2, ["YYYY", "YYYY", "YYYY", "....", "YYYY"]]] }),
      kf({ head: "hatless", torso: "leanR", armL: "mid", armR: { dy: -1, variant: "up" }, legL: "stand", legR: "wide", prop: { dx: 1, dy: -1, variant: "hatFloat" } }, { fx: [[2, 1, ["YYYY", "YYYY", "YYYY", "....", "YYYY"]], [25, 1, ["YYYY", "YYYY", "YYYY", "....", "YYYY"]]] }),
      kf({ head: "glow", armL: "down", armR: "up", prop: "default" }, { fx: [[24, 3, ["yYYy", ".YY.", ".YY.", "....", ".YY."]]] }),
    ]),
    clip("clues", "问号弹幕", [160, 140, 140, 160], [
      kf({ head: { dy: 1, variant: "normal" }, armL: "down", armR: "mid", prop: "notebook" }, { fx: [[24, 4, ["YYYY", "...Y", "..Y.", "....", "..Y."]]] }),
      kf({ head: { dx: -1, variant: "normal" }, torso: "leanL", armL: "mid", armR: "salute", prop: "notebook" }, { fx: [[2, 2, ["RRRR....................YYYY", "...R.......................Y", "..R.......................Y."]]] }),
      kf({ head: { dx: 1, variant: "glow" }, torso: "leanR", armL: "forward", armR: "mid", prop: { dy: -1, variant: "notebook" } }, { fx: [[1, 1, ["YYYY...................RRRR", "...Y......................R", "..Y......................R."]]] }),
      kf({ head: "blink", armL: "down", armR: "down", prop: "notebook" }, { fx: [[3, 4, ["YYYY...................RRRR"]]] }),
    ]),
    clip("pipe", "烟圈推理", [210, 180, 180, 210], [
      kf({ head: "blink", armL: "back", armR: "salute", prop: "pipe" }, { fx: [[23, 11, [".W.", "W.W", ".W."]]] }),
      kf({ head: { dy: -1, variant: "blink" }, armL: "back", armR: "down", prop: "pipe" }, { fx: [[22, 6, [".WWW.", "W...W", "W...W", ".WWW."]]] }),
      kf({ head: "blink", armL: "back", armR: "salute", prop: "pipe" }, { fx: [[21, 1, ["..WWW..", ".W...W.", "W.....W", ".W...W.", "..WWW.."]], [23, 10, [".W.", "W.W", ".W."]]] }),
      kf({ head: "normal", armL: "down", armR: "down", prop: "pipe" }, { fx: [[22, 4, [".wWw.", "w...w", ".wWw."]]] }),
    ]),
    clip("disguise", "瞬间变装", [190, 130, 220, 200], [
      kf({ head: "normal", armL: "mid", armR: "mid", prop: false }),
      kf({ head: "normal", torso: "leanR", armL: "up", armR: "up", legL: "wide", legR: "wide", prop: false }, { fx: [[6, 9, ["w..W..w..W..w..W..w", ".W..w..W..w..W..w.."]]] }),
      kf({ head: "disguise", armL: "back", armR: "salute", prop: "default" }),
      kf({ head: "disguise", torso: "leanL", armL: "back", armR: "down", prop: "default" }, { fx: [[24, 6, ["Y..Y"]]] }),
    ]),
  ],
});

// 9. 音乐家 (女) — 音符导弹 / 低音震屏 / 雷电独奏 / 破音飙高音 / 金属甩头
const musicianRig = buildCharacterRig({
  gender: "female", hairStyle: "long", coat: "jacket",
  hatFn(g) {
    stamp2x(g, 8, 4, ["...AAAAAAAAAA...", "..AA........AA..", ".AA..........AA.", "AA............AA", "AA............AA", "dd............dd"]);
  },
  props: {
    default: partPatch(10, 19, ["........bbb.", ".....bbBYBbb", "....bbBBBBB.", ".....bbbb..."]),
    guitarHigh: partPatch(9, 16, [".........bbb", "......bbBYBb", ".....bbBBBB.", "......bbbb.."]),
    mic: partPatch(22, 14, [".GG.", "GGGG", "..g.", "..g."]),
  },
});
const musician = makeRiggedSprite({
  id: "musician", name: "音乐家", gender: "female",
  palette: makePalette(SKIN.fair, { H: "#292952", h: "#4b4b8c", k: "#161630" }),
  rig: musicianRig,
  animations: [
    clip("strum", "音符导弹", [150, 130, 130, 150], [
      kf({ head: "normal", armL: "forward", armR: { dy: -1, variant: "forward" }, legL: "stand", legR: "stand", prop: "default" }, { fx: [[2, 4, ["..MM", "..M.", ".MM."]]] }),
      kf({ head: { dy: 1, variant: "happy" }, torso: "leanL", armL: "forward", armR: { dy: 1, variant: "forward" }, legL: "step", legR: "stand", prop: "default" }, { fx: [[1, 2, [".YY.....................CC", ".Y......................C.", "YY.....................CC."]]] }),
      kf({ head: { dy: 0, variant: "glowM" }, torso: "leanR", armL: { dy: -1, variant: "forward" }, armR: { dy: -1, variant: "forward" }, legL: "stand", legR: "step", prop: { dy: -1, variant: "default" } }, { fx: [[1, 1, ["..CC...................MM.", "..C....................M..", ".CC...................MM.."]]] }),
      kf({ head: "happy", armL: "forward", armR: "forward", prop: "default" }, { fx: [[2, 3, [".MM...................YY", ".M....................Y.", "MM...................YY."]]] }),
    ]),
    clip("bass", "低音震屏", [140, 120, 120, 140], [
      kf({ head: "blink", armL: "up", armR: "up", prop: false }, { fx: [[2, 7, [".C", "C.", "C.", ".C"]], [28, 7, ["C.", ".C", ".C", "C."]]] }),
      kf({ head: { dx: -1, variant: "glowC" }, torso: "leanL", armL: { dx: -1, variant: "up" }, armR: { dx: -1, variant: "up" }, legL: "wide", legR: "stand", prop: false }, { fx: [[0, 5, ["..M.", ".M.C", "M.C.", "M.C.", ".M.C"]], [28, 5, [".M..", "C.M.", ".C.M", ".C.M", "C.M."]]] }),
      kf({ head: { dx: 1, variant: "glowM" }, torso: "leanR", armL: { dx: 1, variant: "up" }, armR: { dx: 1, variant: "up" }, legL: "stand", legR: "wide", prop: false }, { fx: [[0, 6, [".Y.C", "Y.C.", "Y.C.", ".Y.C"]], [28, 6, ["C.Y.", ".C.Y", ".C.Y", "C.Y."]]] }),
      kf({ head: "happy", armL: "mid", armR: "mid", prop: "default" }, { fx: [[1, 7, [".M", "M.", ".M"]], [29, 7, ["M.", ".M", "M."]]] }),
    ]),
    clip("solo", "雷电独奏", [150, 120, 120, 150], [
      kf({ head: "shout", armL: "forward", armR: "mid", legL: "wide", legR: "wide", prop: "default" }, { fx: [[24, 4, ["..YY", ".YY.", "..Y."]]] }),
      kf({ head: { dy: -1, variant: "glow" }, torso: { dy: -1, variant: "leanR" }, armL: { dy: -1, variant: "forward" }, armR: { dy: -1, variant: "up" }, legL: { dy: -1, variant: "kick" }, legR: { dy: -1, variant: "kick" }, prop: { dy: -1, variant: "guitarHigh" } }, { shadow: "shrink", fx: [[1, 1, ["..YY...................YY.", ".YY.....................YY", "..Y.....................Y."]]] }),
      kf({ head: { dy: -2, variant: "glowM" }, torso: { dy: -2, variant: "leanL" }, armL: { dy: -2, variant: "up" }, armR: { dy: -2, variant: "up" }, legL: { dy: -2, variant: "kick" }, legR: { dy: -2, variant: "kick" }, prop: { dy: -2, variant: "guitarHigh" } }, { shadow: "tiny", fx: [[1, 0, ["Y..MM.................CC..Y", ".YY.M.................C.YY."]]] }),
      kf({ head: "happy", armL: "forward", armR: "forward", prop: "default" }, { fx: [[2, 3, ["Y..Y...................Y..Y"]]] }),
    ]),
    clip("mic", "破音飙高音", [170, 140, 130, 160], [
      kf({ head: "normal", armL: "down", armR: "salute", prop: "mic" }),
      kf({ head: "shout", torso: "leanL", armL: "mid", armR: "salute", prop: { dx: -1, dy: -1, variant: "mic" } }, { fx: [[25, 8, [".R.", "..R", "..R", ".R."]]] }),
      kf({ head: { dy: -1, variant: "shock" }, torso: "leanL", armL: "up", armR: { dx: -1, dy: -1, variant: "salute" }, legL: "wide", legR: "wide", prop: { dx: -1, dy: -2, variant: "mic" } }, { fx: [[24, 4, [".R..Y..", "..R..Y.", "...R..Y", "...R..Y", "..R..Y.", ".R..Y.."]]] }),
      kf({ head: "shout", armL: "mid", armR: "salute", prop: "mic" }, { fx: [[25, 9, ["Y.", ".Y", "Y."]]] }),
    ]),
    clip("headbang", "金属甩头", [110, 100, 100, 110], [
      kf({ head: { dy: 2, variant: "glowR" }, torso: "leanL", armL: "forward", armR: "mid", legL: "wide", legR: "wide", prop: "default" }, { fx: [[4, 2, ["F.......................F"]]] }),
      kf({ head: { dx: -1, dy: 3, variant: "glowR" }, torso: "leanL", armL: "back", armR: "up", legL: "wide", legR: "wide", prop: "default" }, { afterimage: { dx: 2, dy: -2, tint: "u" }, fx: [[1, 4, ["F.R.Y", ".FYF."]], [26, 4, ["Y.R.F", ".FYF."]]] }),
      kf({ head: { dx: 1, dy: -1, variant: "shout" }, torso: "leanR", armL: "up", armR: "back", legL: "wide", legR: "wide", prop: "guitarHigh" }, { afterimage: { dx: -2, dy: 2, tint: "y" }, fx: [[2, 1, ["R..F..Y..............Y..F..R"]]] }),
      kf({ head: { dy: 2, variant: "glowR" }, torso: "leanL", armL: "forward", armR: "mid", legL: "wide", legR: "wide", prop: "default" }, { fx: [[4, 2, ["Y.......................Y"]]] }),
    ]),
  ],
});

// 10. 消防员 (男) — 暴走水炮 / 迪斯科警灯 / 浓烟点赞 / 极速攀梯 / 泡沫狂喷
const firefighterRig = buildCharacterRig({
  gender: "male", hairStyle: "short", coat: "fire",
  hatFn(g) { stamp2x(g, 7, 2, [".....YYYYYY.....", "...YYYYYYYYYY...", "..YYYYAAAAYYYY..", ".YYYYYYYYYYYYYY."]); },
  props: {
    default: partPatch(22, 20, ["gggY", "gggY"]),
    ladder: partPatch(24, 3, ["G..G", "GGGG", "G..G", "GGGG", "G..G", "GGGG", "G..G", "GGGG", "G..G", "GGGG", "G..G", "GGGG"]),
    extinguisher: partPatch(21, 16, ["..g.", "RRRR", "RRRR", "RRRR"]),
  },
});
const firefighter = makeRiggedSprite({
  id: "firefighter", name: "消防员", gender: "male",
  palette: makePalette(SKIN.deep, { H: "#241d1a", h: "#453832", k: "#14100e" }),
  rig: firefighterRig,
  animations: [
    clip("hose", "暴走水炮", [140, 110, 110, 140], [
      kf({ head: "normal", armL: "forward", armR: "mid", legL: "wide", legR: "stand", prop: "default" }, { fx: [[25, 18, ["..C..", "CCcCC", "..c.."]]] }),
      kf({ head: { dx: -1, variant: "shout" }, torso: "leanL", armL: "forward", armR: "mid", legL: "wide", legR: "wide", prop: { dx: -1, dy: 0, variant: "default" } }, { fx: [[22, 16, ["...c..W..", ".CCWWCCcC", "CWWCCWWCC", ".cCCWWcCC"]]] }),
      kf({ head: { dx: -2, variant: "shout" }, torso: { dx: -1, variant: "leanL" }, armL: { dx: -1, variant: "forward" }, armR: { dx: -1, variant: "mid" }, legL: "wide", legR: "kick", prop: { dx: -2, dy: -1, variant: "default" } }, { fx: [[20, 14, ["....C..c..W.", "..CCWWCCWWCC", "CCWWCCWWCCWW", "..cCCWWcCCWW"]]] }),
      kf({ head: "normal", torso: "leanL", armL: "forward", armR: "mid", legL: "wide", legR: "wide", prop: "default" }, { fx: [[24, 17, [".W.c.", "CcWWc", "CCcCW"]]] }),
    ]),
    clip("siren", "迪斯科警灯", [130, 130, 130, 130], [
      kf({ head: "normal", torso: "leanR", armL: "forward", armR: "back", legL: "step", legR: "stand", prop: false }, { fx: [[9, 0, ["RRRR......CC", "..RR....CC.."]]] }),
      kf({ head: "shout", torso: "leanR", armL: "back", armR: "forward", legL: "stand", legR: "step", prop: false }, { fx: [[9, 0, ["CC......RRRR", "..CC....RR.."]]] }),
      kf({ head: "normal", torso: "leanR", armL: "forward", armR: "back", legL: "kick", legR: "stand", prop: false }, { fx: [[5, 0, ["RR...RRRR...CC...CC", ".....RR.....CC....."]]] }),
      kf({ head: "shout", torso: "leanR", armL: "back", armR: "forward", legL: "stand", legR: "kick", prop: false }, { fx: [[5, 0, ["CC...CCCC...RR...RR", ".....CC.....RR....."]]] }),
    ]),
    clip("victory", "浓烟点赞", [190, 160, 160, 190], [
      kf({ head: "normal", armL: "down", armR: "mid", prop: false }, { fx: [[23, 12, [".w..w.", "w....w"]]] }),
      kf({ head: "glow", torso: "leanL", armL: "back", armR: "salute", prop: false }, { fx: [[3, 2, ["w..w................w..w"]], [22, 11, [".Y.Y.", "SYYYY"]]] }),
      kf({ head: "happy", armL: "mid", armR: "up", prop: false }, { fx: [[4, 3, ["w....w............w....w"]], [23, 9, ["Y.Y.Y", "SYYYY"]]] }),
      kf({ head: "happy", armL: "down", armR: "salute", prop: false }, { fx: [[23, 12, [".Y.Y."]]] }),
    ]),
    clip("ladder", "极速攀梯", [150, 130, 130, 150], [
      kf({ head: { dx: -1, variant: "normal" }, torso: { dx: -1, variant: "normal" }, armL: { dx: -1, variant: "up" }, armR: { dx: -1, variant: "mid" }, legL: { dx: -1, variant: "step" }, legR: { dx: -1, variant: "stand" }, prop: "ladder" }),
      kf({ head: { dx: -1, dy: -1, variant: "normal" }, torso: { dx: -1, dy: -1, variant: "normal" }, armL: { dx: -1, dy: -1, variant: "mid" }, armR: { dx: -1, dy: -1, variant: "up" }, legL: { dx: -1, dy: -1, variant: "stand" }, legR: { dx: -1, dy: -1, variant: "step" }, prop: "ladder" }, { shadow: "shrink", fx: [[4, 3, ["Y.Y"]]] }),
      kf({ head: { dx: -1, dy: -2, variant: "happy" }, torso: { dx: -1, dy: -2, variant: "normal" }, armL: { dx: -1, dy: -2, variant: "up" }, armR: { dx: -1, dy: -2, variant: "mid" }, legL: { dx: -1, dy: -2, variant: "step" }, legR: { dx: -1, dy: -2, variant: "stand" }, prop: "ladder" }, { shadow: "tiny", fx: [[2, 1, ["Y..Y"]]] }),
      kf({ head: { dx: -1, dy: -1, variant: "normal" }, torso: { dx: -1, dy: -1, variant: "normal" }, armL: { dx: -1, dy: -1, variant: "mid" }, armR: { dx: -1, dy: -1, variant: "up" }, legL: { dx: -1, dy: -1, variant: "stand" }, legR: { dx: -1, dy: -1, variant: "step" }, prop: "ladder" }, { shadow: "shrink" }),
    ]),
    clip("extinguish", "泡沫狂喷", [160, 130, 130, 170], [
      kf({ head: "normal", armL: "forward", armR: "mid", prop: "extinguisher" }),
      kf({ head: "shout", torso: "leanL", armL: "forward", armR: "mid", legL: "wide", legR: "stand", prop: "extinguisher" }, { fx: [[23, 14, ["..WW..", "WWWWWW", "wWWWWw"]]] }),
      kf({ head: "shout", torso: "leanL", armL: "forward", armR: "mid", legL: "wide", legR: "wide", prop: { dx: -1, dy: 0, variant: "extinguisher" } }, { fx: [[21, 10, ["...WWWWWW...", "..WWWWWWWW..", ".WWWWWWWWWW.", "wWWWWWWWWWWw", ".WWWWWWWWWW."]]] }),
      kf({ head: "happy", armL: "down", armR: "down", prop: "extinguisher" }, { fx: [[23, 13, [".WWWWW.", "wWWWWWw"]]] }),
    ]),
  ],
});

export const ROLES_A = { coder, doctor, chef, artist, scientist, astronaut, barista, detective, musician, firefighter };
