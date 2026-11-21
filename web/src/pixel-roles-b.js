// Rigged 32×32 pixel citizens (11–20): teacher, gardener, photographer, courier, wizard,
// athlete, pilot, mechanic, baker, ninja — each with 7 articulated skeletal parts
// and 5 independent gag keyframe animation clips (50 clips).

import {
  SKIN, blank, buildCharacterRig, clip, clone, fill, kf, makePalette, makeRiggedSprite, partPatch, px, stamp,
} from "./pixel-rig.js";

// ============================================================================
// 11. 教师 (女) — 亮瞎大灯泡 / 飞页龙卷风 / 满分金星章 / 粉笔狙击 / 推镜威压
// ============================================================================
const teacherRig = buildCharacterRig({
  gender: "female", hairStyle: "bun", eyeStyle: "goldglasses", coat: "vest",
  props: {
    default: (() => { const g = blank(); stamp(g, 3, 19, ["WWWWW", "WwWwW", "WWWWW"]); stamp(g, 23, 15, ["...b", "..b.", ".b..", "b..."]); return g; })(),
    pointerUp: partPatch(23, 10, ["...b", "..b.", ".b..", "b..."]),
    book: partPatch(3, 19, ["WWWWW", "WwWwW", "WWWWW"]),
    starStamp: partPatch(21, 5, ["...Y...", "..YYY..", "YYYYYYY", ".YYWYY.", "..YYY..", ".Y...Y."]),
    chalk: partPatch(24, 13, ["WW"]),
  },
});
const teacher = makeRiggedSprite({
  id: "teacher", name: "教师", gender: "female",
  palette: makePalette(SKIN.warm, { H: "#5e3d2b", h: "#8c5e44", k: "#3b2418" }),
  rig: teacherRig,
  animations: [
    // 亮瞎大灯泡：左臂抱书稳立，右臂高挥教鞭点题，头顶巨型灯泡越来越亮
    clip("lecture", "亮瞎大灯泡", [200, 150, 150, 190], [
      kf({ head: "normal", armL: "forward", armR: "mid", prop: "default" }, { fx: [[23, 4, [".YY.", "YyyY", ".YY.", ".gg."]]] }),
      kf({ head: "happy", torso: "leanR", armL: "forward", armR: "up", prop: "pointerUp" }, { fx: [[21, 1, ["y..y..y", ".YYYYY.", "yYWWWYy", ".YYYYY.", "..ggg.."]]] }),
      kf({ head: "glow", torso: "leanR", armL: "forward", armR: { dy: -1, variant: "up" }, prop: { dy: -1, variant: "pointerUp" } }, { fx: [[20, 0, ["Y.yWy.Y", "yYYYYYy", "WWWWWWW", "yYYYYYy", ".YYYYY.", "..ggg.."]]] }),
      kf({ head: "blink", armL: "forward", armR: "mid", prop: "default" }, { fx: [[23, 4, [".YY.", "YyyY", ".YY."]]] }),
    ]),
    // 飞页龙卷风：左臂捧书，右臂高速翻页，白色书页卷成龙卷风
    clip("books", "飞页龙卷风", [150, 130, 130, 150], [
      kf({ head: { dy: 1, variant: "normal" }, armL: "mid", armR: "forward", prop: "book" }, { fx: [[2, 12, ["WWW", "WwW"]]] }),
      kf({ head: { dy: 1, variant: "normal" }, torso: "leanL", armL: "mid", armR: { dx: -1, dy: -1, variant: "forward" }, prop: { dy: -1, variant: "book" } }, { fx: [[1, 3, ["WWW.....................WWW", "WwW..........Y..........wWW"]]] }),
      kf({ head: "glow", torso: "leanR", armL: "up", armR: "mid", prop: "book" }, { fx: [[2, 1, ["...WWW.......WWW.......WWW", "Y..WwW.......wWW....Y..WwW"]]] }),
      kf({ head: "happy", armL: "down", armR: "down", prop: "default" }, { fx: [[3, 4, ["WWW...................Y.."]]] }),
    ]),
    // 满分金星章：右臂霸气盖下巨型满分金星章，左臂举起100分喝彩
    clip("goldstar", "满分金星章", [190, 140, 140, 190], [
      kf({ head: "normal", armL: "down", armR: "mid", prop: { dy: 4, variant: "starStamp" } }),
      kf({ head: "happy", torso: "leanR", armL: "mid", armR: "up", prop: { dy: -1, variant: "starStamp" } }),
      kf({ head: "glow", armL: "up", armR: { dy: -1, variant: "up" }, legL: "step", legR: "stand", prop: { dy: -2, variant: "starStamp" } }, { fx: [[2, 3, ["R.RR.RR", "R.R.R.R", "R.RR.RR"]], [20, 2, ["R..Y..M"]]] }),
      kf({ head: "happy", armL: "down", armR: "mid", prop: { dy: 2, variant: "starStamp" } }),
    ]),
    // 粉笔狙击：眼镜反白光，右臂拉弓→猛弹粉笔头，粉笔独立高速飞出！
    clip("chalk", "粉笔狙击", [200, 130, 120, 160], [
      kf({ head: "flash", torso: "leanL", armL: "back", armR: "salute", prop: { dx: -1, dy: 0, variant: "chalk" } }),
      kf({ head: "flash", torso: "leanR", armL: "back", armR: "mid", legL: "stand", legR: "wide", prop: { dx: 3, dy: -1, variant: "chalk" } }, { fx: [[22, 12, ["w.w.WW"]]] }),
      kf({ head: "normal", torso: "leanR", armL: "down", armR: "mid", legL: "stand", legR: "wide", prop: { dx: 6, dy: -2, variant: "chalk" } }, { fx: [[21, 11, ["w..w..w.."]], [29, 11, ["Y.F"]]] }),
      kf({ head: "happy", armL: "down", armR: "down", prop: "default" }, { fx: [[25, 11, ["Y.F.Y", ".F.F."]]] }),
    ]),
    // 推镜威压：左臂优雅抬手扶眼镜，眼镜横贯银魂纯白反光！
    clip("glasses", "推镜威压", [200, 160, 160, 200], [
      kf({ head: "normal", armL: "up", armR: "down", prop: "book" }),
      kf({ head: "flash", armL: { dx: 1, dy: 0, variant: "up" }, armR: "down", prop: "book" }, { fx: [[2, 4, ["U....................U"]]] }),
      kf({ head: { dy: -1, variant: "flash" }, armL: "up", armR: "mid", prop: false }, { fx: [[1, 2, ["U..U................U..U", ".U....................U."]], [8, 10, ["W..............W"]]] }),
      kf({ head: "flash", armL: "down", armR: "down", prop: "default" }, { fx: [[3, 5, ["U....................U"]]] }),
    ]),
  ],
});

// ============================================================================
// 12. 园丁 (男) — 巨花暴长 / 落叶暴雪 / 群蝶抢帽 / 拔出巨萝卜 / 彩虹洒水
// ============================================================================
const gardenerHat = (g) => {
  stamp(g, 5, 2, ["......bbbbbbbb......", ".....bbbbbbbbbb.....", ".....ddAAAAAAdd.....", ".bbbbbbbbbbbbbbbbbb."]);
};
const gardenerRig = buildCharacterRig({
  gender: "male", hairStyle: "short", coat: "overalls", boots: "brown",
  hatFn: gardenerHat,
  beardFn(g) { stamp(g, 11, 15, ["BBBBBBBBBB"]); },
  props: {
    default: (() => { const g = blank(); stamp(g, 22, 19, [".ggg.", "ggggg", ".ggg."]); stamp(g, 25, 25, [".V.", "vVv", ".v."]); return g; })(),
    sunflower: partPatch(22, 8, ["..YYYYY..", ".YYBBBYY.", "YYBWWWBYY", ".YYBBBYY.", "..YYYYY..", "....v....", "...vVv...", "....v....", "...vVv...", "....v...."]),
    shears: partPatch(23, 16, ["G.G", ".G.", "GGG"]),
    shearsShut: partPatch(23, 16, ["GG.", ".GG", "GGG"]),
    hatFloat: partPatch(6, 0, ["..bbbbbbbb..", ".bbbbbbbbbb.", "..ddAAAAAAdd."]),
    carrotSmall: partPatch(23, 21, ["vVv", ".v.", "FFF"]),
    carrotGiant: partPatch(21, 7, [".vVvVvV.", "..vVvV..", ".FFFFFF.", "FFYFFFFF", ".FFFFFF.", "..FFFF..", "...FF...", "....F..."]),
  },
});
const gardener = makeRiggedSprite({
  id: "gardener", name: "园丁", gender: "male",
  palette: makePalette(SKIN.tan, { H: "#5c4028", h: "#87613f", k: "#382617" }),
  rig: gardenerRig,
  animations: [
    // 巨花暴长：右臂倾斜喷壶浇水，花朵在道具层自己拔节长成巨型向日葵！
    clip("bloom", "巨花暴长", [180, 150, 150, 170, 200], [
      kf({ head: "normal", armL: "down", armR: "mid", prop: "default" }, { fx: [[25, 21, [".C.", "..c"]]] }),
      kf({ head: "normal", torso: "leanR", armL: "back", armR: { dy: -1, variant: "mid" }, prop: "default" }, { fx: [[24, 18, ["..M..", ".MYM.", "..M.."]]] }),
      kf({ head: "shock", torso: "leanL", armL: "mid", armR: "mid", legL: "wide", legR: "stand", prop: "sunflower" }),
      kf({ head: "glow", torso: "leanL", armL: "up", armR: "up", legL: "wide", legR: "wide", prop: { dy: -2, variant: "sunflower" } }, { fx: [[21, 4, ["Y.......Y"]]] }),
      kf({ head: "happy", armL: "down", armR: "down", prop: "sunflower" }),
    ]),
    // 落叶暴雪：右臂高频开合园艺剪，左臂扶稳，翠绿嫩叶像暴风雪漫天飞
    clip("prune", "落叶暴雪", [150, 120, 120, 150], [
      kf({ head: "normal", armL: "down", armR: "mid", prop: "shears" }),
      kf({ head: "happy", torso: "leanR", armL: "mid", armR: { dy: -1, variant: "mid" }, prop: { dy: -1, variant: "shearsShut" } }, { fx: [[1, 2, ["V..v....................V..v", "..V......................v.."]]] }),
      kf({ head: "happy", torso: "leanL", armL: "back", armR: "up", prop: { dy: -3, variant: "shears" } }, { fx: [[2, 1, ["v....V.......V.......V....v", "..V..........v..........V.."]]] }),
      kf({ head: "blink", armL: "down", armR: "mid", prop: "shearsShut" }, { fx: [[3, 5, ["V........................v"]]] }),
    ]),
    // 群蝶抢帽：草帽作为独立 prop 被蝴蝶群叼飞上天，园丁仰头惊慌伸手抓！
    clip("butterfly", "群蝶抢帽", [170, 150, 150, 170], [
      kf({ head: "normal", armL: "down", armR: "down", prop: "default" }, { fx: [[24, 3, ["Y.Y", "YMY", "Y.Y"]]] }),
      kf({ head: "normal", armL: "mid", armR: "up", prop: false }, { fx: [[2, 1, ["M.M....................Y.Y", "MYM....................YCY"]]] }),
      kf({ head: "hatlessShock", armL: "up", armR: "up", legL: "wide", legR: "wide", prop: "hatFloat" }, { fx: [[4, 0, ["M.M..............Y.Y", "MYM..............YCY"]]] }),
      kf({ head: "happy", armL: "down", armR: "mid", prop: "default" }, { fx: [[3, 1, ["C.C..................M.M", "CYC..................MYM"]]] }),
    ]),
    // 拔出巨萝卜：双腿宽蹲发力，双臂紧拽向后拉，巨型超级橙萝卜「啵」地拔出！
    clip("carrot", "拔出巨萝卜", [200, 170, 140, 180], [
      kf({ head: { dy: 1, variant: "normal" }, torso: "leanR", armL: "forward", armR: "mid", legL: "crouch", legR: "crouch", prop: "carrotSmall" }),
      kf({ head: { dx: -1, dy: 1, variant: "shout" }, torso: "leanL", armL: "back", armR: "forward", legL: "wide", legR: "crouch", prop: { dy: -2, variant: "carrotSmall" } }, { fx: [[7, 10, ["C", "C"]]] }),
      kf({ head: "shock", torso: "leanL", armL: "up", armR: "up", legL: "kick", legR: "wide", prop: "carrotGiant" }, { fx: [[20, 4, ["Y.....Y"]]] }),
      kf({ head: "happy", armL: "down", armR: "mid", prop: { dy: 3, variant: "carrotGiant" } }),
    ]),
    // 彩虹洒水：右臂平稳洒水，水雾化出绚丽像素小彩虹
    clip("rainbow", "彩虹洒水", [180, 160, 160, 180], [
      kf({ head: "normal", armL: "down", armR: "mid", prop: "default" }, { fx: [[24, 15, ["C.c", ".C."]]] }),
      kf({ head: "happy", torso: "leanR", armL: "back", armR: { dy: -1, variant: "mid" }, prop: "default" }, { fx: [[19, 3, ["...RRRR..", "..RYYYYR.", ".RYVVVVYR", "RYVCCCCVY"]]] }),
      kf({ head: "happy", armL: "mid", armR: "up", legL: "step", legR: "stand", prop: "default" }, { fx: [[16, 1, ["....RRRRRR....", "..RRYYYYYYRR..", ".RYVVVVVVVVYR.", "RYVCCCCCCCCVYR", "YVCMMMMMMMMCVY"]]] }),
      kf({ head: "happy", armL: "down", armR: "mid", prop: "default" }, { fx: [[20, 4, ["..RRRR..", ".RYYYYR.", "RYVVVVYR"]]] }),
    ]),
  ],
});

// ============================================================================
// 13. 摄影师 (女) — 核爆闪光灯 / 鬼畜贴地拍 / 绝片蹦高 / 机关枪连拍 / 剪刀手自拍
// ============================================================================
const photographerRig = buildCharacterRig({
  gender: "female", hairStyle: "bob", coat: "jacket",
  props: {
    default: partPatch(11, 19, ["..gggggg..", "OOggCCggOO", "OOgCWWCgOO", "OOggCCggOO", "OOOOOOOOOO"]),
    peace: partPatch(23, 12, ["S.S", "S.S", "SSS"]),
  },
});
const photographer = makeRiggedSprite({
  id: "photographer", name: "摄影师", gender: "female",
  palette: makePalette(SKIN.peach, { H: "#242638", h: "#434766", k: "#141521" }),
  rig: photographerRig,
  idleKeyframe: kf({ armL: "forward", armR: "forward", prop: "default" }),
  animations: [
    // 核爆闪光灯：双手举机对准镜头，按快门瞬间爆出遮屏白金十字光+微微后坐
    clip("flash", "核爆闪光灯", [200, 100, 120, 150, 200], [
      kf({ head: "normal", armL: "forward", armR: "forward", prop: "default" }),
      kf({ head: { dy: -1, variant: "shock" }, torso: "leanL", armL: { dy: -2, variant: "forward" }, armR: { dy: -2, variant: "forward" }, legL: "wide", legR: "stand", prop: { dy: -2, variant: "default" } }, { fx: [[6, 9, [".........y.........", ".........W.........", ".......yWWWy.......", "....yWWWWWWWWWy....", "..yWWWWWWWWWWWWWy..", "yWWWWWWWWWWWWWWWWWy", "..yWWWWWWWWWWWWWy..", "....yWWWWWWWWWy....", ".......yWWWy.......", ".........W........."]]] }),
      kf({ head: "blink", armL: { dy: -1, variant: "forward" }, armR: { dy: -1, variant: "forward" }, prop: { dy: -1, variant: "default" } }, { fx: [[10, 13, ["....y....", "..yWWWy..", "yWWWWWWWy", "..yWWWy.."]]] }),
      kf({ head: "normal", armL: "forward", armR: "forward", prop: "default" }, { fx: [[13, 17, ["..W..", ".yWy.", "..W.."]]] }),
      kf({ head: "happy", armL: "forward", armR: "forward", prop: "default" }),
    ]),
    // 鬼畜贴地拍：双腿真实下蹲(crouch)并左右闪身找角度，对焦框逐步锁绿
    clip("focus", "鬼畜贴地拍", [180, 140, 140, 180], [
      kf({ head: { dy: 2, variant: "normal" }, torso: { dy: 1, variant: "normal" }, armL: { dy: 1, variant: "forward" }, armR: { dy: 1, variant: "forward" }, legL: "crouch", legR: "crouch", prop: { dy: 1, variant: "default" } }, { fx: [[2, 2, ["RRR......................RRR", "R..........................R"]], [2, 27, ["R..........................R", "RRR......................RRR"]]] }),
      kf({ head: { dx: -1, dy: 2, variant: "normal" }, torso: { dx: -1, dy: 1, variant: "leanL" }, armL: { dx: -1, dy: 1, variant: "forward" }, armR: { dx: -1, dy: 1, variant: "forward" }, legL: "wide", legR: "crouch", prop: { dx: -1, dy: 1, variant: "default" } }, { fx: [[4, 4, ["RRR..................RRR", "R......................R"]], [4, 25, ["R......................R", "RRR..................RRR"]]] }),
      kf({ head: { dx: 1, dy: 2, variant: "glowV" }, torso: { dx: 1, dy: 1, variant: "leanR" }, armL: { dx: 1, dy: 1, variant: "forward" }, armR: { dx: 1, dy: 1, variant: "forward" }, legL: "crouch", legR: "wide", prop: { dx: 1, dy: 1, variant: "default" } }, { fx: [[6, 6, ["VVV..............VVV", "V..................V"]], [6, 23, ["V..................V", "VVV..............VVV"]]] }),
      kf({ head: "happy", armL: "forward", armR: "forward", prop: "default" }, { fx: [[6, 6, ["VVV..............VVV"]]] }),
    ]),
    // 绝片蹦高：低头看相机→激动得高举双臂双腿踢起蹦高高！
    clip("review", "绝片蹦高", [170, 140, 140, 170], [
      kf({ head: { dy: 1, variant: "normal" }, armL: "forward", armR: "forward", prop: "default" }, { fx: [[23, 8, [".M.M.", "MMMMM", ".MMM.", "..M.."]]] }),
      kf({ head: { dy: -1, variant: "glowM" }, torso: { dy: -1, variant: "normal" }, armL: { dy: -1, variant: "up" }, armR: { dy: -1, variant: "up" }, legL: { dy: -1, variant: "kick" }, legR: { dy: -1, variant: "kick" }, prop: { dy: -1, variant: "default" } }, { shadow: "shrink", fx: [[2, 1, ["Y..M.M................M.M..Y", "...MMM................MMM..."]]] }),
      kf({ head: { dy: -2, variant: "happy" }, torso: { dy: -2, variant: "normal" }, armL: { dy: -2, variant: "up" }, armR: { dy: -2, variant: "up" }, legL: { dy: -2, variant: "step" }, legR: { dy: -2, variant: "step" }, prop: { dy: -2, variant: "default" } }, { shadow: "tiny", fx: [[1, 0, [".M.M....................Y..", ".MMM...................YYY."]]] }),
      kf({ head: "happy", armL: "forward", armR: "forward", prop: "default" }, { fx: [[4, 3, ["Y......................M"]]] }),
    ]),
    // 机关枪连拍：双腿扎稳，右手食指高频按快门、相机与手臂高频颤动冒烟
    clip("burst", "机关枪连拍", [100, 100, 100, 100, 140], [
      kf({ head: "normal", torso: "leanL", armL: "forward", armR: { dy: -1, variant: "forward" }, legL: "wide", legR: "wide", prop: { dx: -1, dy: -1, variant: "default" } }, { fx: [[12, 16, ["..W..", ".yWy.", "..W.."]]] }),
      kf({ head: "glow", torso: "leanR", armL: { dy: -1, variant: "forward" }, armR: "forward", legL: "wide", legR: "wide", prop: { dx: 1, dy: -2, variant: "default" } }, { fx: [[13, 15, ["..y..", ".WWW.", "yWWWy"]], [23, 10, ["w.w", ".w."]]] }),
      kf({ head: "normal", torso: "leanL", armL: "forward", armR: { dy: -1, variant: "forward" }, legL: "wide", legR: "wide", prop: { dx: -1, dy: -1, variant: "default" } }, { fx: [[11, 16, [".Y.W.", "WWWWW", ".W.Y."]], [4, 9, ["w.w", ".w."]]] }),
      kf({ head: "glow", torso: "leanR", armL: { dy: -1, variant: "forward" }, armR: "forward", legL: "wide", legR: "wide", prop: { dx: 1, dy: -2, variant: "default" } }, { fx: [[13, 15, ["..W..", "yWWWy", "..W.."]], [22, 7, ["w..w"]]] }),
      kf({ head: "blink", armL: "forward", armR: "forward", prop: "default" }, { fx: [[12, 13, ["w...w...w"]]] }),
    ]),
    // 剪刀手自拍：左臂举机，右臂优雅抬起比剪刀手，头歪一下眨眼！
    clip("selfie", "剪刀手自拍", [190, 160, 160, 190], [
      kf({ head: "normal", armL: "forward", armR: "mid", prop: "peace" }),
      kf({ head: { dx: 1, variant: "happy" }, torso: "leanR", armL: "forward", armR: "up", legL: "stand", legR: "step", prop: { dy: -2, variant: "peace" } }, { fx: [[2, 2, ["..Y.......................M..", ".YYY.....................MMM."]]] }),
      kf({ head: { dx: 1, variant: "blink" }, torso: "leanR", armL: "forward", armR: "up", legL: "stand", legR: "step", prop: { dy: -1, variant: "peace" } }, { fx: [[3, 1, ["M...Y...................Y...M"]]] }),
      kf({ head: "happy", armL: "forward", armR: "mid", prop: "default" }, { fx: [[25, 6, ["Y"]]] }),
    ]),
  ],
});

// ============================================================================
// 14. 骑士 (男) — 音爆风火轮 / 激光签收 / 天降五星 / 杂技叠箱 / 喇叭催单
// ============================================================================
const courierRig = buildCharacterRig({
  gender: "male", hairStyle: "short", coat: "jacket",
  hatFn(g) { stamp(g, 8, 3, ["...AAAAAAAAAA...", "..aAAAAAAAAAAA..", ".AAAAAACCCCCCCC.", ".AAAAACWWWCCCCC.", ".dAAAACCCCCCCCC."]); },
  props: {
    default: partPatch(20, 19, ["bbbbbbbb", "bbbBBbbb", "bbbbbbbb", "bbbbbbbb"]),
    boxHigh: partPatch(20, 10, ["bbbbbbbb", "bbbBBbbb", "bbbbbbbb"]),
    stack: partPatch(11, 0, ["bbbbbbbb", "bbbBBbbb", "bbbbbbbb"]),
    stackTall: partPatch(10, 0, ["..bbbbbb..", "..bbBBbb..", "bbbbbbbb..", "bbbBBbbb.."]),
  },
});
const courier = makeRiggedSprite({
  id: "courier", name: "骑士", gender: "male",
  palette: makePalette(SKIN.warm, { H: "#2e2621", h: "#52443b", k: "#1a1512" }),
  rig: courierRig,
  animations: [
    // 音爆风火轮：双腿高速交替踏步/踢腿，左臂后摆，躯干前倾，残影跟在身后！
    clip("dash", "音爆风火轮", [110, 100, 100, 110], [
      kf({ head: { dx: 1, variant: "normal" }, torso: { dx: 1, variant: "leanR" }, armL: "back", armR: "forward", legL: "step", legR: "stand", prop: { dx: 1, dy: 0, variant: "default" } }, { afterimage: { dx: -4, dy: 0, tint: "c" }, fx: [[0, 14, ["WWWWW.", "......", "CCCCCC"]]] }),
      kf({ head: { dx: 1, variant: "shout" }, torso: { dx: 1, variant: "leanR" }, armL: "mid", armR: "forward", legL: "stand", legR: "kick", prop: { dx: 1, dy: -1, variant: "default" } }, { afterimage: { dx: -5, dy: 0, tint: "c" }, fx: [[0, 11, ["CCCCC..", ".......", "WWWWWW.", ".......", ".CCCCC."]]] }),
      kf({ head: { dx: 1, variant: "glowC" }, torso: { dx: 1, variant: "leanR" }, armL: "back", armR: "forward", legL: "kick", legR: "stand", prop: { dx: 1, dy: 0, variant: "default" } }, { afterimage: { dx: -5, dy: 0, tint: "w" }, fx: [[0, 12, ["WWWWWW.", ".......", "CCCCCC.", ".......", "WWWWWW."]]] }),
      kf({ head: { dx: 1, variant: "blink" }, torso: { dx: 1, variant: "leanR" }, armL: "mid", armR: "forward", legL: "stand", legR: "step", prop: { dx: 1, dy: -1, variant: "default" } }, { afterimage: { dx: -4, dy: 0, tint: "c" }, fx: [[0, 13, ["CCCCC.", "......", "WWWWW."]]] }),
    ]),
    // 激光签收：左臂稳抱包裹，右臂抬枪发射红色扫描激光，头顶爆出大绿勾
    clip("scan", "激光签收", [180, 140, 140, 200], [
      kf({ head: "normal", armL: "forward", armR: "mid", prop: "default" }, { fx: [[21, 15, ["gRR."]]] }),
      kf({ head: "normal", torso: "leanR", armL: "forward", armR: "mid", prop: "default" }, { fx: [[20, 14, ["gRRRRRRRRRR", ".RRRRRRRRRR"]]] }),
      kf({ head: "glowV", armL: "forward", armR: "up", prop: "default" }, { fx: [[22, 3, [".....VV", "....VV.", "...VV..", "V.VV...", "VVV...."]]] }),
      kf({ head: "happy", armL: "down", armR: "salute", prop: "default" }, { fx: [[22, 4, ["....VV", "...VV.", "V.VV..", ".VV..."]]] }),
    ]),
    // 天降五星：右臂把包裹高高抛起独立升空再接住，头顶降下五星好评！
    clip("fivestar", "天降五星", [170, 150, 150, 180], [
      kf({ head: "normal", armL: "down", armR: "up", prop: "boxHigh" }),
      kf({ head: { dy: -1, variant: "happy" }, armL: "up", armR: "up", legL: "step", legR: "stand", prop: { dy: -4, variant: "boxHigh" } }, { fx: [[2, 0, [".Y.....Y.....Y.....Y.....Y", "YYY...YYY...YYY...YYY...YYY"]]] }),
      kf({ head: "glow", armL: "mid", armR: "mid", legL: "stand", legR: "step", prop: "boxHigh" }, { fx: [[4, 1, [".Y.......Y.......Y", "YYY.....YYY.....YYY"]]] }),
      kf({ head: "happy", armL: "down", armR: "forward", prop: "default" }, { fx: [[5, 2, ["Y.........Y.........Y"]]] }),
    ]),
    // 杂技叠箱：双臂张开维持平衡，头顶高耸快递箱左右晃动！
    clip("stack", "杂技叠箱", [180, 150, 150, 180], [
      kf({ head: "normal", armL: "mid", armR: "mid", prop: "stack" }),
      kf({ head: { dx: -1, variant: "normal" }, torso: "leanL", armL: "up", armR: "down", legL: "wide", legR: "stand", prop: { dx: -1, dy: 0, variant: "stackTall" } }),
      kf({ head: { dx: 1, variant: "shock" }, torso: "leanR", armL: "down", armR: "up", legL: "stand", legR: "wide", prop: { dx: 2, dy: 0, variant: "stackTall" } }, { fx: [[5, 11, ["C", "C"]]] }),
      kf({ head: "happy", armL: "mid", armR: "mid", prop: "stack" }),
    ]),
    // 喇叭催单：右臂狂按喇叭，护目镜闪过白光，声波震屏
    clip("horn", "喇叭催单", [160, 130, 130, 160], [
      kf({ head: "normal", armL: "down", armR: "mid", prop: "default" }, { fx: [[23, 10, ["Y.Y", ".Y."]]] }),
      kf({ head: "flash", torso: "leanR", armL: "back", armR: { dy: -1, variant: "mid" }, prop: "default" }, { fx: [[23, 6, ["..Y.F.", ".Y...F", "Y....F", ".Y...F", "..Y.F."]]] }),
      kf({ head: "shout", torso: "leanR", armL: "mid", armR: "up", legL: "stand", legR: "wide", prop: "default" }, { fx: [[22, 4, ["...Y.F.R", "..Y...F.", ".Y....F.", "..Y...F.", "...Y.F.R"]]] }),
      kf({ head: "normal", armL: "down", armR: "mid", prop: "default" }, { fx: [[24, 9, [".Y.", "Y.Y"]]] }),
    ]),
  ],
});

// ============================================================================
// 15. 魔法师 (女) — 雷电星阵 / 魔球失控 / 帽尖烟花 / 变青蛙乌龙 / 扫帚狂飙
// ============================================================================
const wizardRig = buildCharacterRig({
  gender: "female", hairStyle: "long", coat: "robe",
  hatFn(g) {
    stamp(g, 7, 0, ["........A.......", ".......AAA......", "......AAYAA.....", ".....AAAAAAA....", "....AAAAAAAAA...", "..ddYYYYYYYYYdd."]);
  },
  props: {
    default: partPatch(24, 12, [".CCC.", "CCWCC", ".CCC.", "..B..", "..B..", "..B..", "..B..", "..B..", "..B.."]),
    orbMid: partPatch(20, 7, ["..UUUUU..", ".UWWCWWU.", "UWCCWCCWU", ".UCWWWCW.", "..UUUUU.."]),
    orbHuge: partPatch(19, 4, ["...uUUUUu...", "..UWWWWWWU..", ".UWCCWWCCWU.", ".UWWWWWWWWU.", "..UWWWWWWU..", "...uUUUUu..."]),
    frog: partPatch(23, 21, [".V..V.", "VEVVEV", "VVVVVV", "VVRRVV", "V....V"]),
    broom: partPatch(1, 20, ["bbb...............", "bbYBBBBBBBBBBBBBBB", "bbb..............."]),
  },
});
const wizard = makeRiggedSprite({
  id: "wizard", name: "魔法师", gender: "female",
  palette: makePalette(SKIN.fair, { H: "#6d59a8", h: "#9d88db", k: "#473873" }),
  rig: wizardRig,
  animations: [
    // 雷电星阵：右臂挥舞法杖画阵，左臂蓄力，紫金魔法星辰绕身炸裂
    clip("cast", "雷电星阵", [170, 140, 140, 170], [
      kf({ head: "normal", armL: "mid", armR: "mid", prop: "default" }, { fx: [[2, 4, ["Y...", "....", "..u."]]] }),
      kf({ head: "glowC", torso: "leanL", armL: "up", armR: "up", prop: { dy: -3, variant: "default" } }, { fx: [[1, 1, ["Y..u....................Y..u"]], [22, 6, ["..Y.C.Y..", ".CWWWWWC.", "..YCYCY.."]]] }),
      kf({ head: "glow", torso: "leanR", armL: "mid", armR: { dy: -1, variant: "up" }, legL: "wide", legR: "wide", prop: { dy: -4, variant: "default" } }, { fx: [[1, 0, [".C..Y..................Y..M.", "Y..........................Y"]], [21, 5, ["..Y.M.Y..", ".CWWWWWC.", "YWWCCCWWY", ".CWWWWWC."]]] }),
      kf({ head: "blink", armL: "down", armR: "mid", prop: "default" }, { fx: [[2, 3, [".u......................u", "Y.......................Y"]]] }),
    ]),
    // 魔球失控：魔球越涨越大把双腿吹离地面！
    clip("orb", "魔球失控", [190, 150, 150, 190], [
      kf({ head: "normal", armL: "forward", armR: "mid", prop: "default" }, { fx: [[22, 11, [".UUU.", "UCCCU", ".UUU."]]] }),
      kf({ head: "glowM", torso: "leanL", armL: "mid", armR: "up", prop: "orbMid" }),
      kf({ head: { dy: -1, variant: "shock" }, torso: { dy: -1, variant: "leanL" }, armL: { dy: -1, variant: "up" }, armR: { dy: -1, variant: "up" }, legL: { dy: -1, variant: "kick" }, legR: { dy: -1, variant: "step" }, prop: "orbHuge" }, { shadow: "tiny" }),
      kf({ head: "dizzy", armL: "down", armR: "mid", prop: "orbMid" }),
    ]),
    // 帽尖烟花：双臂兴奋挥舞，帽尖喷出五彩流星雨
    clip("meteor", "帽尖烟花", [160, 130, 130, 160], [
      kf({ head: "normal", armL: "down", armR: "up", prop: "default" }, { fx: [[9, 0, ["Y....Y....Y", ".M.......C."]]] }),
      kf({ head: "happy", armL: "up", armR: "mid", legL: "step", legR: "stand", prop: "default" }, { fx: [[2, 0, ["Y.....M..Y..C.....Y", ".C...Y.......Y...M."]]] }),
      kf({ head: "glowM", armL: "mid", armR: "up", legL: "stand", legR: "step", prop: { dy: -2, variant: "default" } }, { fx: [[1, 0, ["M..C....Y..Y....M..C", ".Y.....M....C.....Y.", "..C...Y......Y...M.."]]] }),
      kf({ head: "happy", armL: "down", armR: "down", prop: "default" }, { fx: [[4, 1, ["C.....Y.....M.....C"]]] }),
    ]),
    // 变青蛙乌龙：右臂抖法杖冒紫烟，青蛙在右下角独立蹦跶吐舌！
    clip("frog", "变青蛙乌龙", [180, 140, 190, 190], [
      kf({ head: "normal", armL: "down", armR: "up", prop: { dy: -2, variant: "default" } }, { fx: [[23, 9, ["u.U.u"]]] }),
      kf({ head: "shock", armL: "mid", armR: "mid", prop: false }, { fx: [[21, 18, [".uUUu.", "uUUUUu", ".uUUu."]]] }),
      kf({ head: "shock", torso: "leanL", armL: "mid", armR: "mid", legL: "wide", legR: "stand", prop: { dx: 0, dy: 0, variant: "frog" } }, { fx: [[6, 10, ["C", "C"]]] }),
      kf({ head: "dizzy", armL: "down", armR: "down", prop: { dx: 0, dy: -3, variant: "frog" } }),
    ]),
    // 扫帚狂飙：跨上魔法扫帚（propZ:"back"）离地疾驰，双腿收起、星尘拖尾
    clip("broom", "扫帚狂飙", [140, 120, 120, 140], [
      kf({ head: { dy: -1, variant: "normal" }, torso: { dy: -1, variant: "leanR" }, armL: { dy: -1, variant: "forward" }, armR: { dy: -1, variant: "forward" }, legL: { dy: -1, variant: "crouch" }, legR: { dy: -1, variant: "crouch" }, prop: { dx: 0, dy: 0, variant: "broom" } }, { propZ: "back", shadow: "shrink" }),
      kf({ head: { dy: -2, variant: "happy" }, torso: { dy: -2, variant: "leanR" }, armL: { dy: -2, variant: "forward" }, armR: { dy: -2, variant: "up" }, legL: { dy: -2, variant: "crouch" }, legR: { dy: -2, variant: "step" }, prop: { dx: 1, dy: -1, variant: "broom" } }, { propZ: "back", shadow: "tiny", fx: [[0, 19, ["Y.", ".Y", "C."]]] }),
      kf({ head: { dy: -3, variant: "glow" }, torso: { dy: -3, variant: "leanR" }, armL: { dy: -3, variant: "up" }, armR: { dy: -3, variant: "up" }, legL: { dy: -3, variant: "step" }, legR: { dy: -3, variant: "crouch" }, prop: { dx: 2, dy: -2, variant: "broom" } }, { propZ: "back", shadow: "none", fx: [[0, 18, ["Y.C", "M.Y", "Y.."]]] }),
      kf({ head: { dy: -2, variant: "happy" }, torso: { dy: -2, variant: "leanR" }, armL: { dy: -2, variant: "forward" }, armR: { dy: -2, variant: "forward" }, legL: { dy: -2, variant: "crouch" }, legR: { dy: -2, variant: "crouch" }, prop: { dx: 1, dy: -1, variant: "broom" } }, { propZ: "back", shadow: "tiny", fx: [[0, 20, ["Y."]]] }),
    ]),
  ],
});

// ============================================================================
// 16. 运动员 (男) — 燃火运球 / 热血蛙跳 / 夺冠狂欢 / 超级暴扣 / 肌肉爆气
// ============================================================================
const athleteRig = buildCharacterRig({
  gender: "male", hairStyle: "spiky", coat: "jersey", legs: "shorts", boots: "white",
  hatFn(g) { fill(g, 10, 7, 12, 2, "A"); fill(g, 11, 7, 4, 1, "a"); },
  props: {
    default: partPatch(23, 21, [".FFF.", "FFBFF", "FBBBF", "FFBFF", ".FFF."]),
    ballHigh: partPatch(13, 2, [".FFF.", "FFBFF", "FBBBF", "FFBFF", ".FFF."]),
    trophy: partPatch(21, 9, ["YYYYYY", ".YYYY.", "..YY..", ".YYYY."]),
  },
});
const athlete = makeRiggedSprite({
  id: "athlete", name: "运动员", gender: "male",
  palette: makePalette(SKIN.deep, { H: "#1f1d24", h: "#3e3a4a", k: "#111014" }),
  rig: athleteRig,
  animations: [
    // 燃火运球：双腿微蹲弹性发力，右臂拍球，橙色篮球独立上下回弹并带熊熊烈焰！
    clip("dribble", "燃火运球", [140, 120, 120, 140], [
      kf({ head: "normal", armL: "mid", armR: "mid", legL: "wide", legR: "wide", prop: { dx: 0, dy: -2, variant: "default" } }, { fx: [[23, 16, ["..Y..", ".FYF."]]] }),
      kf({ head: { dy: 1, variant: "normal" }, torso: "leanR", armL: "back", armR: "down", legL: "crouch", legR: "crouch", prop: { dx: 0, dy: 2, variant: "default" } }, { fx: [[23, 20, ["..Y..", ".FYF."]]] }),
      kf({ head: "glowF", torso: "leanR", armL: "mid", armR: "mid", legL: "wide", legR: "wide", prop: { dx: 0, dy: -4, variant: "default" } }, { fx: [[23, 14, ["..R..", ".FYF."]]] }),
      kf({ head: "blink", armL: "back", armR: "down", legL: "stand", legR: "stand", prop: { dx: 0, dy: 1, variant: "default" } }, { fx: [[23, 19, [".FYF."]]] }),
    ]),
    // 热血蛙跳：深蹲蓄力→双臂高举+双腿踢起跃空→落地缓冲，狂飙汗珠！
    clip("warmup", "热血蛙跳", [140, 120, 120, 150], [
      kf({ head: { dy: 2, variant: "normal" }, torso: { dy: 1, variant: "normal" }, armL: { dy: 1, variant: "back" }, armR: { dy: 1, variant: "back" }, legL: "crouch", legR: "crouch", prop: false }),
      kf({ head: { dy: -2, variant: "shout" }, torso: { dy: -2, variant: "normal" }, armL: { dy: -2, variant: "up" }, armR: { dy: -2, variant: "up" }, legL: { dy: -2, variant: "kick" }, legR: { dy: -2, variant: "kick" }, prop: false }, { shadow: "tiny", fx: [[2, 4, ["C........................C", ".c......................c."]]] }),
      kf({ head: { dy: -3, variant: "glowC" }, torso: { dy: -3, variant: "normal" }, armL: { dy: -3, variant: "up" }, armR: { dy: -3, variant: "up" }, legL: { dy: -3, variant: "step" }, legR: { dy: -3, variant: "step" }, prop: false }, { shadow: "none", fx: [[1, 2, ["C.c....................c.C"]]] }),
      kf({ head: { dy: 1, variant: "happy" }, torso: { dy: 1, variant: "normal" }, armL: "mid", armR: "mid", legL: "wide", legR: "wide", prop: false }, { fx: [[3, 7, ["C........................C"]]] }),
    ]),
    // 夺冠狂欢：右臂高举巨型金奖杯，左臂挥拳，双腿交替踏步欢呼
    clip("trophy", "夺冠狂欢", [190, 150, 150, 190], [
      kf({ head: "normal", armL: "down", armR: "mid", prop: { dy: 3, variant: "trophy" } }),
      kf({ head: "glow", torso: "leanL", armL: "up", armR: "up", legL: "step", legR: "stand", prop: { dy: -3, variant: "trophy" } }, { fx: [[21, 3, ["Y......Y"]]] }),
      kf({ head: "happy", armL: "flex", armR: { dy: -1, variant: "up" }, legL: "stand", legR: "step", prop: { dy: -4, variant: "trophy" } }, { fx: [[1, 0, ["Y..M..................C", "..C...................Y"]]] }),
      kf({ head: "happy", armL: "down", armR: "up", prop: { dy: -1, variant: "trophy" } }),
    ]),
    // 超级暴扣：下蹲→腾空双手高举火球→砸地爆出金色冲击波！
    clip("dunk", "超级暴扣", [150, 130, 120, 160], [
      kf({ head: { dy: 1, variant: "normal" }, torso: { dy: 1, variant: "normal" }, armL: "back", armR: "back", legL: "crouch", legR: "crouch", prop: "default" }),
      kf({ head: { dy: -1, variant: "shout" }, torso: { dy: -1, variant: "normal" }, armL: { dy: -1, variant: "up" }, armR: { dy: -1, variant: "up" }, legL: { dy: -1, variant: "kick" }, legR: { dy: -1, variant: "step" }, prop: { dy: -1, variant: "ballHigh" } }, { shadow: "shrink" }),
      kf({ head: { dy: -2, variant: "glowF" }, torso: { dy: -2, variant: "normal" }, armL: { dy: -2, variant: "up" }, armR: { dy: -2, variant: "up" }, legL: { dy: -2, variant: "step" }, legR: { dy: -2, variant: "kick" }, prop: { dy: -2, variant: "ballHigh" } }, { shadow: "tiny", fx: [[12, 0, ["Y.....Y"]], [4, 20, ["F......................F"]]] }),
      kf({ head: { dy: 1, variant: "glow" }, torso: { dy: 1, variant: "normal" }, armL: "mid", armR: "mid", legL: "wide", legR: "wide", prop: { dy: 2, variant: "default" } }, { fx: [[2, 26, ["Y.F.Y..................Y.F.Y", ".YYY....................YYY."]]] }),
    ]),
    // 肌肉爆气：双腿宽蹲，双臂屈肌(flex)蓄力，赛亚人金色气焰腾起！
    clip("flex", "肌肉爆气", [180, 140, 130, 170], [
      kf({ head: "normal", armL: "flex", armR: "flex", legL: "wide", legR: "wide", prop: false }),
      kf({ head: "glow", armL: { dy: -1, variant: "flex" }, armR: { dy: -1, variant: "flex" }, legL: "wide", legR: "wide", prop: false }, { fx: [[2, 2, ["..Y....................Y..", ".Y.Y..................Y.Y.", "Y........................Y"]]] }),
      kf({ head: "glowF", torso: "normal", armL: "flex", armR: "flex", legL: "wide", legR: "wide", prop: false }, { fx: [[1, 0, ["..Y..Y..............Y..Y..", ".Y.YY.Y............Y.YY.Y.", "Y..FF..Y..........Y..FF..Y"]]] }),
      kf({ head: "happy", armL: "down", armR: "flex", prop: "default" }, { fx: [[4, 4, ["Y......................Y"]]] }),
    ]),
  ],
});

// ============================================================================
// 17. 机长 (女) — 墨镜死光 / 战机拉升 / 塔台狂呼 / 空中炫技 / 气流颠簸
// ============================================================================
const pilotRig = buildCharacterRig({
  gender: "female", hairStyle: "bob", eyeStyle: "shades", coat: "pilot",
  hatFn(g) { stamp(g, 9, 2, ["...AAAAAAAA...", "..AAAYYYYAAA..", ".ddAAAAAAAAAdd", ".OOOOOOOOOOOO."]); },
  props: {
    plane: partPatch(21, 13, ["...W..", "..WWW.", ".WWWWW", "w..W.."]),
    cloud: partPatch(2, 2, [".WW.", "WWWW"]),
  },
});
const pilot = makeRiggedSprite({
  id: "pilot", name: "机长", gender: "female",
  palette: makePalette(SKIN.peach, { H: "#362723", h: "#5e453e", k: "#1f1614" }),
  rig: pilotRig,
  idleKeyframe: kf({ prop: false }),
  animations: [
    // 墨镜死光：右臂帅气抬手敬礼(salute)，墨镜横贯银魂纯白反光，白云独立从左向右掠过！
    clip("salute", "墨镜死光", [190, 140, 140, 180], [
      kf({ head: "normal", armL: "down", armR: "mid", prop: { dx: 0, dy: 0, variant: "cloud" } }),
      kf({ head: "flash", armL: "back", armR: "salute", prop: { dx: 8, dy: -1, variant: "cloud" } }),
      kf({ head: "flash", torso: "leanL", armL: "back", armR: "salute", prop: { dx: 18, dy: 0, variant: "cloud" } }),
      kf({ head: "happy", armL: "down", armR: "down", prop: { dx: 23, dy: 1, variant: "cloud" } }),
    ]),
    // 战机拉升：机长稳站推杆，迷你战机在右侧独立拉烟爬升直冲云霄！
    clip("takeoff", "战机拉升", [150, 130, 130, 150], [
      kf({ head: "normal", armL: "forward", armR: "mid", prop: { dx: 0, dy: 2, variant: "plane" } }),
      kf({ head: "flash", torso: "leanL", armL: "forward", armR: "up", prop: { dx: 0, dy: -3, variant: "plane" } }, { fx: [[20, 13, ["w"]]] }),
      kf({ head: "happy", torso: "leanL", armL: "mid", armR: "up", legL: "wide", legR: "stand", prop: { dx: -1, dy: -9, variant: "plane" } }, { fx: [[19, 8, ["w"]], [18, 10, ["w"]]] }),
      kf({ head: "happy", armL: "down", armR: "salute", prop: { dx: 1, dy: -12, variant: "plane" } }),
    ]),
    // 塔台狂呼：右臂按住耳麦通话，左臂握杆，青色雷达声波层层扩散
    clip("radio", "塔台狂呼", [170, 140, 140, 170], [
      kf({ head: "normal", armL: "forward", armR: "salute", prop: false }, { fx: [[24, 9, ["..C.", ".C.C"]]] }),
      kf({ head: "shout", torso: "leanR", armL: "forward", armR: "salute", prop: false }, { fx: [[23, 6, ["...C..", "..C.C.", ".C..C.", "..C..."]]] }),
      kf({ head: "shout", torso: "leanR", armL: "mid", armR: "salute", legL: "stand", legR: "wide", prop: false }, { fx: [[23, 4, ["....C.", "...C.C", "..C..C", ".C..C.", "...C.."]]] }),
      kf({ head: "happy", armL: "down", armR: "salute", prop: false }, { fx: [[24, 8, [".C..", "C.C."]]] }),
    ]),
    // 空中炫技：机长抬头仰望，纸飞机从左→顶→右翻转轨迹拉烟飞过！
    clip("barrel", "空中炫技", [160, 130, 130, 160], [
      kf({ head: "normal", armL: "up", armR: "down", prop: { dx: -19, dy: -3, variant: "plane" } }),
      kf({ head: { dy: -1, variant: "flash" }, armL: "mid", armR: "mid", prop: { dx: -9, dy: -11, variant: "plane" } }, { fx: [[6, 5, ["w.w.Y"]]] }),
      kf({ head: { dy: -1, variant: "happy" }, armL: "down", armR: "up", prop: { dx: 1, dy: -7, variant: "plane", flip: true } }, { fx: [[14, 2, ["w.w.w.w"]]] }),
      kf({ head: "happy", armL: "down", armR: "mid", prop: { dx: 2, dy: 2, variant: "plane", flip: true } }, { fx: [[24, 10, ["Y"]]] }),
    ]),
    // 气流颠簸：双腿宽站稳住下盘，左/右臂交替按住机长帽，上身左右大幅晃动！
    clip("turbulence", "气流颠簸", [120, 110, 110, 130], [
      kf({ head: { dx: -1, variant: "normal" }, torso: "leanL", armL: "up", armR: "mid", legL: "wide", legR: "wide", prop: false }, { fx: [[24, 6, ["WWWWW", "w...w"]]] }),
      kf({ head: { dx: 1, variant: "normal" }, torso: "leanR", armL: "mid", armR: "salute", legL: "wide", legR: "wide", prop: false }, { fx: [[2, 5, ["WWWWW", "w...w"]]] }),
      kf({ head: { dx: -1, variant: "normal" }, torso: "leanL", armL: "up", armR: "mid", legL: "wide", legR: "wide", prop: false }, { fx: [[23, 4, ["WWWWW"]]] }),
      kf({ head: "flash", armL: "down", armR: "salute", legL: "stand", legR: "stand", prop: false }, { fx: [[4, 4, ["Y......................Y"]]] }),
    ]),
  ],
});

// ============================================================================
// 18. 工程师 (男) — 电焊级猛拧 / 暴走齿轮 / 一敲修好 / 电钻震动 / 机油溅脸
// ============================================================================
const mechanicRig = buildCharacterRig({
  gender: "male", hairStyle: "short", coat: "overalls",
  hatFn(g) { stamp(g, 8, 2, ["....YYYYYY....", "..YYYYYYYYYY..", ".YYYYyYYYYYYY.", "YYYYYYYYYYYYYY"]); },
  extraHeads(normal) {
    const oil = clone(normal);
    stamp(oil, 10, 10, ["OO.OO..OOO", "OWEOOOWEOO", "OEEOOOEEOO", ".OO..OOOO."]);
    return { oil };
  },
  props: {
    default: partPatch(23, 14, ["G..G", "GGGG", ".GG.", ".GG.", ".GG.", ".GG."]),
    gear1: partPatch(22, 10, [".G.G.", "GGYGG", ".GGG.", "GGYGG", ".G.G."]),
    gear2: partPatch(22, 10, ["G...G", ".GGG.", "GGVGG", ".GGG.", "G...G"]),
    drill: partPatch(22, 17, ["YYYYgGG", "YYYYg..", "YY....."]),
  },
});
const mechanic = makeRiggedSprite({
  id: "mechanic", name: "工程师", gender: "male",
  palette: makePalette(SKIN.warm, { H: "#423026", h: "#6b4f3f", k: "#261b15" }),
  rig: mechanicRig,
  animations: [
    // 电焊级猛拧：下盘扎稳，右臂大幅上下拧扳手，迸发电焊级火花
    clip("wrench", "电焊级猛拧", [150, 120, 120, 150], [
      kf({ head: "normal", armL: "down", armR: "up", prop: { dy: -3, variant: "default" } }, { fx: [[23, 8, ["..Y.."]]] }),
      kf({ head: "shout", torso: "leanR", armL: "back", armR: "mid", legL: "wide", legR: "stand", prop: { dy: 1, variant: "default" } }, { fx: [[21, 9, [".Y..F..Y", "..F.Y.F."]]] }),
      kf({ head: "glow", torso: "leanL", armL: "mid", armR: "up", legL: "wide", legR: "wide", prop: { dy: -2, variant: "default" } }, { fx: [[20, 7, ["Y..W..F..Y", ".F.Y.W..F."]]] }),
      kf({ head: "blink", armL: "down", armR: "mid", prop: "default" }, { fx: [[23, 11, ["...Y.."]]] }),
    ]),
    // 暴走齿轮：双臂协同调试，大齿轮道具在原地两态高频旋转！
    clip("gears", "暴走齿轮", [150, 130, 130, 150], [
      kf({ head: "normal", armL: "mid", armR: "mid", prop: "gear1" }),
      kf({ head: "glow", torso: "leanR", armL: "up", armR: "mid", prop: "gear2" }, { fx: [[2, 12, [".G.G.", "GGRGG", ".G.G."]]] }),
      kf({ head: "normal", torso: "leanL", armL: "mid", armR: "up", prop: "gear1" }, { fx: [[2, 12, ["G...G", "GGVGG", "G...G"]]] }),
      kf({ head: "happy", armL: "down", armR: "mid", prop: "gear2" }),
    ]),
    // 一敲修好：右臂高举扳手→一锤砸下火花四溅→头顶亮起超大绿勾！
    clip("greenlight", "一敲修好", [180, 140, 140, 190], [
      kf({ head: "normal", armL: "down", armR: "up", prop: { dy: -4, variant: "default" } }),
      kf({ head: "shout", torso: "leanR", armL: "back", armR: "mid", legL: "stand", legR: "wide", prop: { dy: 2, variant: "default" } }, { fx: [[22, 15, ["Y.F.Y", "Y.F.Y"]]] }),
      kf({ head: "glowV", armL: "up", armR: "salute", prop: false }, { fx: [[22, 3, [".....VV", "....VV.", "...VV..", "V.VV...", "VVV...."]]] }),
      kf({ head: "happy", armL: "down", armR: "mid", prop: "default" }, { fx: [[22, 4, ["....VV", "...VV.", "V.VV.."]]] }),
    ]),
    // 电钻震动：双腿死蹬地面，上身、手臂与电钻超高速左右震颤出残影！
    clip("drill", "电钻震动", [90, 90, 90, 90, 140], [
      kf({ head: { dx: -1, variant: "normal" }, torso: "leanL", armL: "forward", armR: "mid", legL: "wide", legR: "wide", prop: "drill" }),
      kf({ head: { dx: 1, variant: "shout" }, torso: "leanR", armL: { dx: 1, variant: "forward" }, armR: { dx: 1, variant: "mid" }, legL: "wide", legR: "wide", prop: { dx: 1, dy: -1, variant: "drill" } }, { afterimage: { dx: -2, dy: 0, tint: "w" }, fx: [[29, 15, ["Y", "F"]]] }),
      kf({ head: { dx: -1, variant: "shout" }, torso: "leanL", armL: { dx: -1, variant: "forward" }, armR: { dx: -1, variant: "mid" }, legL: "wide", legR: "wide", prop: { dx: -1, dy: 0, variant: "drill" } }, { afterimage: { dx: 2, dy: 0, tint: "w" }, fx: [[29, 16, ["F", "Y"]]] }),
      kf({ head: { dx: 1, variant: "normal" }, torso: "leanR", armL: "forward", armR: "mid", legL: "wide", legR: "wide", prop: { dx: 1, dy: -1, variant: "drill" } }),
      kf({ head: "dizzy", armL: "down", armR: "down", prop: "default" }),
    ]),
    // 机油溅脸：管道滋出一股黑油→头切 oil 只剩大白眼，无奈垂手！
    clip("oil", "机油溅脸", [180, 140, 200, 200], [
      kf({ head: "normal", armL: "down", armR: "mid", prop: "default" }, { fx: [[24, 14, ["OO", "OO"]]] }),
      kf({ head: "shock", torso: "leanL", armL: "up", armR: "mid", legL: "wide", legR: "stand", prop: "default" }, { fx: [[14, 11, ["O..O..OO", ".OO..OOO"]]] }),
      kf({ head: "oil", armL: "down", armR: "down", legL: "crouch", legR: "crouch", prop: "default" }),
      kf({ head: "oil", armL: "mid", armR: "down", prop: "default" }, { fx: [[23, 9, ["C", "C"]]] }),
    ]),
  ],
});

// ============================================================================
// 19. 烘焙师 (女) — 三层巨无霸 / 奶油龙卷风 / 出炉起飞 / 抛面团杂技 / 糖粉雪崩
// ============================================================================
const bakerRig = buildCharacterRig({
  gender: "female", hairStyle: "bob", coat: "apron",
  hatFn(g) { stamp(g, 10, 2, ["AA......AA", "AAAaaAAaaa", "AA..aa..AA"]); },
  extraHeads(normal) {
    const cream = clone(normal); stamp(cream, 12, 10, ["WW..W"]);
    const sugar = clone(normal);
    stamp(sugar, 8, 2, ["..WWWWWWWWWW..", ".WWWWWWWWWWWW.", ".WWWWWWWWWWWW.", "WWwWWWWWWWWwWW", ".WWWWWWWWWWWW."]);
    stamp(sugar, 11, 11, ["WW", "WE", "WW"]); stamp(sugar, 19, 11, ["WW", "EW", "WW"]);
    return { cream, sugar };
  },
  props: {
    default: partPatch(23, 17, ["..R..", ".MMM.", "WWWWW", ".bbb.", ".bbb."]),
    cake2: partPatch(22, 11, ["..R..", ".MMM.", "WWWWW", ".MMM.", "WWWWW", ".bbb.", ".bbb."]),
    cake3: partPatch(21, 5, ["..R..", ".MMM.", "WWWWW", ".MMM.", "WWWWW", ".MMM.", "WWWWW", ".bbb.", ".bbb."]),
    whisk: partPatch(22, 14, [".W.W.", "WWWWW", ".ggg."]),
    bread: partPatch(22, 15, [".bbb.", "bFFFb", ".bbb."]),
    dough: partPatch(10, 2, ["..WWWWWW..", ".WWbbbbWW.", "..WWWWWW.."]),
  },
});
const baker = makeRiggedSprite({
  id: "baker", name: "烘焙师", gender: "female",
  palette: makePalette(SKIN.fair, { H: "#b86844", h: "#e08d67", k: "#82452a" }),
  rig: bakerRig,
  animations: [
    // 三层巨无霸：左臂托盘，右臂挤奶油，蛋糕从 1层→2层→冲天3层巨无霸！
    clip("frosting", "三层巨无霸", [170, 150, 150, 190], [
      kf({ head: "normal", armL: "down", armR: "mid", prop: "default" }, { fx: [[23, 11, [".M..", "...Y"]]] }),
      kf({ head: "happy", torso: "leanL", armL: "mid", armR: "mid", prop: "cake2" }),
      kf({ head: "glowM", torso: "leanL", armL: "up", armR: "up", legL: "step", legR: "stand", prop: "cake3" }, { fx: [[20, 3, ["Y.....Y"]]] }),
      kf({ head: "happy", armL: "down", armR: "mid", prop: "cake2" }, { fx: [[23, 7, [".Y.M."]]] }),
    ]),
    // 奶油龙卷风：右臂疯狂打蛋搅拌，雪白奶油糊到脸上(cream)！
    clip("whisk", "奶油龙卷风", [130, 110, 110, 140], [
      kf({ head: "normal", armL: "forward", armR: { dy: -1, variant: "mid" }, prop: "whisk" }),
      kf({ head: "normal", torso: "leanR", armL: "forward", armR: { dx: 1, dy: 1, variant: "mid" }, prop: { dy: -1, variant: "whisk" } }, { fx: [[2, 4, ["W..W..................W.W"]]] }),
      kf({ head: "cream", torso: "leanL", armL: "mid", armR: "up", prop: { dy: -2, variant: "whisk" } }, { fx: [[1, 3, ["..W..W.............W.WWW"]]] }),
      kf({ head: "cream", armL: "down", armR: "mid", prop: "whisk" }),
    ]),
    // 出炉起飞：端热面包兴奋踮脚左右踩步，粉红爱心满屏飘
    clip("fresh", "出炉起飞", [180, 150, 150, 180], [
      kf({ head: "normal", armL: "down", armR: "mid", prop: "bread" }, { fx: [[22, 12, [".W.W."]]] }),
      kf({ head: "happy", armL: "up", armR: "up", legL: "step", legR: "stand", prop: { dy: -4, variant: "bread" } }, { fx: [[2, 1, [".M.M....................M.M", ".MMM....................MMM"]]] }),
      kf({ head: "happy", armL: "up", armR: "up", legL: "stand", legR: "step", prop: { dy: -5, variant: "bread" } }, { fx: [[1, 0, ["Y.M.M..................M.M.Y", "..MMM..................MMM.."]]] }),
      kf({ head: "happy", armL: "down", armR: "mid", prop: "bread" }, { fx: [[23, 10, ["Y..M"]]] }),
    ]),
    // 抛面团杂技：双臂向上猛抛→面团独自旋转飞到头顶最高处→稳稳接住！
    clip("dough", "抛面团杂技", [170, 140, 140, 170], [
      kf({ head: "normal", armL: "forward", armR: "forward", prop: { dy: 11, variant: "dough" } }),
      kf({ head: { dy: -1, variant: "happy" }, armL: "up", armR: "up", prop: { dy: 0, variant: "dough" } }),
      kf({ head: { dy: -1, variant: "glow" }, armL: { dy: -1, variant: "up" }, armR: { dy: -1, variant: "up" }, legL: "step", legR: "stand", prop: { dy: -2, variant: "dough", flip: true } }, { fx: [[4, 2, ["Y....................Y"]]] }),
      kf({ head: "happy", armL: "forward", armR: "forward", prop: { dy: 10, variant: "dough" } }),
    ]),
    // 糖粉雪崩：右臂抖撒糖粉失手，头切换成雪人糖粉造型(sugar)！
    clip("sugar", "糖粉雪崩", [180, 150, 200, 200], [
      kf({ head: "normal", armL: "down", armR: "up", prop: false }, { fx: [[10, 0, ["W.W.W.W.W"]]] }),
      kf({ head: "shock", armL: "mid", armR: "up", prop: false }, { fx: [[7, 1, ["W.W.W.W.W.W.W.W", ".W.W.W.W.W.W.W.", "W.W.W.W.W.W.W.W"]]] }),
      kf({ head: "sugar", armL: "down", armR: "down", legL: "crouch", legR: "crouch", prop: false }),
      kf({ head: "sugar", armL: "mid", armR: "mid", prop: "default" }),
    ]),
  ],
});

// ============================================================================
// 20. 忍者 (男) — 暴雨手里剑 / 砰！烟雾遁 / 影分身瞬步 / 替身术木桩 / 豪火球之术
// ============================================================================
const ninjaRig = buildCharacterRig({
  gender: "male", coat: "ninja",
  customHead() {
    const g = blank();
    fill(g, 9, 5, 14, 12, "N");
    fill(g, 10, 10, 12, 4, "S");
    stamp(g, 11, 11, ["WE", "EE"]); stamp(g, 19, 11, ["WE", "EE"]);
    fill(g, 10, 14, 12, 3, "N");
    fill(g, 9, 8, 14, 2, "A"); fill(g, 13, 8, 6, 2, "G"); px(g, 15, 8, "W");
    stamp(g, 3, 8, ["aAAd..", "aA....", "a....."]);
    return g;
  },
  extraHeads(normal) {
    const scarfUp = clone(normal);
    stamp(scarfUp, 3, 7, ["aAAd..", "a.....", "______", "______"]);
    const glowRed = clone(normal);
    stamp(glowRed, 11, 11, ["RR", "RR"]); stamp(glowRed, 19, 11, ["RR", "RR"]);
    return { scarfUp, glowRed };
  },
  props: {
    default: partPatch(24, 18, [".G.", "GWG", ".G."]),
    shurikenX: partPatch(24, 18, ["G.G", ".W.", "G.G"]),
    shurikenBarrage: partPatch(21, 12, [".G...G.", "GWG.GWG", ".G...G.", ".......", "..G.G..", "...W...", "..G.G.."]),
    smokeBig: partPatch(5, 5, [
      ".....GGGGGGGGGG.....", "...GGwwwwWWWWwwGG...", "..GwwWWWWWWWWWWwwG..", ".GwWWWWWWwWWwWWWWwG.",
      ".GWWWWWWWWWWWWWWWWG.", "GWWWWWwWWWWWWwWWWWWG", "GWWWWWWWWWWWWWWWWWWG", ".GWWWWWWWWWWWWWWWWG.",
      ".GwWWWWWWWWWWWWWWwG.", "..GwwWWWWWWWWWWwwG..", "...GGwwwwWWWWwwGG...", ".....GGGGGGGGGG.....",
    ]),
    smokeEyes: partPatch(6, 6, [
      "....wWWWWWWWWw....", "..wWWWWWWWWWWWWw..", ".WWWWWWWWWWWWWWWW.", ".WWWWWOOOOOOWWWWW.",
      ".WWWRRWWWWWWWRRWW.", ".WWWWWWWWWWWWWWWW.", "..wWWWWWWWWWWWWw..", "....wWWWWWWWWw....",
    ]),
    log: partPatch(11, 15, [
      "....vV....", "....v.....", ".bbbbbbbb.", "bbBBbbBBbb", "BBBBBBBBBB", "BKKBBBBKKB",
      "BBBBBBBBBB", "BBBKKBBBBB", "BBBBBBBBBB", "BKKBBBBKKB", "BBBBBBBBBB", ".BBBBBBBB.",
    ]),
    fireSmall: partPatch(20, 11, [".FF.", "FYYF", ".FF."]),
    fireHuge: partPatch(18, 6, ["...RRRR...", ".RRFFFFRR.", "RFFYYYYFFR", "RFYYWWYYFR", "RFFYYYYFFR", ".RRFFFFRR.", "...RRRR..."]),
  },
});
const ninja = makeRiggedSprite({
  id: "ninja", name: "忍者", gender: "male",
  palette: makePalette(SKIN.peach, { H: "#1e2330", h: "#374151", k: "#111827" }),
  rig: ninjaRig,
  animations: [
    // 暴雨手里剑：双腿弓步稳站，右臂蓄力甩出连发旋转手里剑，飘带猎猎飞舞
    clip("shuriken", "暴雨手里剑", [130, 110, 110, 130], [
      kf({ head: "scarfUp", torso: "leanL", armL: "back", armR: "up", legL: "wide", legR: "stand", prop: { dx: 0, dy: -5, variant: "shurikenX" } }),
      kf({ head: "normal", torso: "leanR", armL: "back", armR: "mid", legL: "stand", legR: "wide", prop: "shurikenBarrage" }),
      kf({ head: "glowRed", torso: "leanR", armL: "forward", armR: "mid", legL: "stand", legR: "wide", prop: { dx: 2, dy: -2, variant: "shurikenBarrage" } }),
      kf({ head: "scarfUp", armL: "down", armR: "mid", prop: "shurikenX" }),
    ]),
    // 砰！烟雾遁：双臂胸前结印→全身部件隐藏(visible:false)炸成多层白烟团→烟中睁开红眼→重新现身！
    clip("smoke", "砰！烟雾遁", [170, 120, 190, 190, 170], [
      kf({ head: "glow", armL: "forward", armR: "forward", prop: false }),
      kf({ head: false, torso: false, armL: false, armR: false, legL: false, legR: false, prop: "smokeBig" }, { fx: [[4, 3, ["Y....................Y"]], [5, 19, ["Y..................Y"]]] }),
      kf({ head: false, torso: false, armL: false, armR: false, legL: false, legR: false, prop: "smokeEyes" }),
      kf({ head: "scarfUp", armL: "mid", armR: "mid", legL: "wide", legR: "wide", prop: "default" }, { fx: [[3, 4, ["w....w..............w....w"]]] }),
      kf({ head: "normal", armL: "down", armR: "down", prop: "default" }),
    ]),
    // 影分身瞬步：四肢按疾跑不同相位摆动，躯干+四肢半透明青白影分身残影左右高频闪现！
    clip("shadowstep", "影分身瞬步", [120, 100, 100, 120], [
      kf({ head: { dx: -2, variant: "scarfUp" }, torso: { dx: -2, variant: "leanL" }, armL: { dx: -2, variant: "back" }, armR: { dx: -2, variant: "forward" }, legL: { dx: -2, variant: "step" }, legR: { dx: -2, variant: "kick" }, prop: false }, { afterimage: { dx: 7, dy: 0, tint: "c" } }),
      kf({ head: { dx: 2, variant: "glowRed" }, torso: { dx: 2, variant: "leanR" }, armL: { dx: 2, variant: "forward" }, armR: { dx: 2, variant: "back" }, legL: { dx: 2, variant: "kick" }, legR: { dx: 2, variant: "step" }, prop: false }, { afterimage: { dx: -7, dy: 0, tint: "c" }, fx: [[3, 4, ["..V......v.."]]] }),
      kf({ head: "normal", torso: "normal", armL: "mid", armR: "mid", legL: "wide", legR: "wide", prop: "default" }, { afterimage: [{ dx: -6, dy: 0, tint: "c" }, { dx: 6, dy: 0, tint: "w" }], fx: [[1, 14, ["CCCCCC................CCCCCC"]]] }),
      kf({ head: { dx: -1, variant: "scarfUp" }, torso: { dx: -1, variant: "leanL" }, armL: { dx: -1, variant: "forward" }, armR: { dx: -1, variant: "back" }, legL: { dx: -1, variant: "stand" }, legR: { dx: -1, variant: "step" }, prop: "shurikenX" }, { afterimage: { dx: 6, dy: 0, tint: "w" } }),
    ]),
    // 替身术木桩：结印→白烟→全身部件隐藏只剩一截摇晃的带绿芽萌木桩→重新现身！
    clip("log", "替身术木桩", [160, 110, 230, 210, 170], [
      kf({ head: "glow", armL: "forward", armR: "forward", prop: false }),
      kf({ head: false, torso: false, armL: false, armR: false, legL: false, legR: false, prop: "smokeBig" }, { fx: [[6, 6, ["Y................Y"]]] }),
      kf({ head: false, torso: false, armL: false, armR: false, legL: false, legR: false, prop: { dx: 0, dy: 0, variant: "log" } }, { fx: [[22, 13, ["w.w", ".w."]]] }),
      kf({ head: false, torso: false, armL: false, armR: false, legL: false, legR: false, prop: { dx: 0, dy: 1, variant: "log", flip: true } }, { fx: [[6, 12, ["C", "C"]]] }),
      kf({ head: "scarfUp", armL: "mid", armR: "down", prop: "default" }, { fx: [[5, 5, ["w....................w"]]] }),
    ]),
    // 豪火球之术：双腿马步稳蹬，双臂结印→向后仰头蓄力→喷出超级巨型烈焰火球！
    clip("fireball", "豪火球之术", [160, 130, 130, 150], [
      kf({ head: "glowF", torso: "leanL", armL: "forward", armR: "forward", legL: "wide", legR: "wide", prop: false }),
      kf({ head: { dx: -2, variant: "glowF" }, torso: { dx: -2, variant: "leanL" }, armL: { dx: -2, variant: "forward" }, armR: { dx: -2, variant: "forward" }, legL: { dx: -2, variant: "wide" }, legR: { dx: -2, variant: "wide" }, prop: "fireSmall" }),
      kf({ head: { dx: -3, variant: "glowRed" }, torso: { dx: -3, variant: "leanL" }, armL: { dx: -3, variant: "mid" }, armR: { dx: -3, variant: "forward" }, legL: { dx: -3, variant: "wide" }, legR: { dx: -3, variant: "wide" }, prop: "fireHuge" }),
      kf({ head: { dx: -2, variant: "scarfUp" }, torso: { dx: -2, variant: "leanL" }, armL: { dx: -2, variant: "down" }, armR: { dx: -2, variant: "mid" }, legL: { dx: -2, variant: "wide" }, legR: { dx: -2, variant: "stand" }, prop: { dx: 2, dy: 2, variant: "fireSmall" } }),
    ]),
  ],
});

export const ROLES_B = { teacher, gardener, photographer, courier, wizard, athlete, pilot, mechanic, baker, ninja };
