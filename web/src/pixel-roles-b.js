// Rigged 64×64 pixel citizens (11–20): teacher, gardener, photographer, courier, wizard,
// athlete, pilot, mechanic, baker, ninja — each with 7 articulated skeletal parts
// and 5 independent gag keyframe animation clips (50 clips).

import {
  SKIN, blank, buildCharacterRig, clip, clone, fill, kf, makePalette, makeRiggedSprite, partPatch, px, stamp, stamp2x,
} from "./pixel-rig.js";

// ============================================================================
// 11. 教师 (女) — 亮瞎大灯泡 / 飞页龙卷风 / 满分金星章 / 粉笔狙击 / 推镜威压
// ============================================================================
const teacherRig = buildCharacterRig({
  gender: "female", hairStyle: "bun", eyeStyle: "goldglasses", coat: "vest",
  props: {
    default: (() => { const g = blank(); stamp2x(g, 3, 19, ["WWWWW", "WwWwW", "WWWWW"], false); stamp2x(g, 23, 15, ["...b", "..b.", ".b..", "b..."], false); return g; })(),
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
    // 亮瞎大灯泡（6大拍→24帧）：背面认真写板书 → 敲黑板划重点 → 转侧面挥教鞭启发 → 转正面点题亮瞎巨型灯泡 → 扶镜点头 → 慈祥眨眼
    clip("lecture", "亮瞎大灯泡", [180, 155, 150, 155, 160, 180], [
      kf({ head: "normal", armL: "forward", armR: "up", prop: "pointerUp" }, { angle: "back" }),
      kf({ head: "normal", armL: "forward", armR: "mid", prop: "default" }, { angle: "back", fx: [[23, 4, [".YY.", "YyyY", ".YY.", ".gg."]]] }),
      kf({ head: "happy", torso: "leanR", armL: "forward", armR: "up", prop: "pointerUp" }, { angle: "side", fx: [[21, 1, ["y..y..y", ".YYYYY.", "yYWWWYy", ".YYYYY.", "..ggg.."]]] }),
      kf({ head: "glow", torso: "leanR", armL: "forward", armR: { dy: -1, variant: "up" }, prop: { dy: -1, variant: "pointerUp" } }, { angle: "front", fx: [[20, 0, ["Y.yWy.Y", "yYYYYYy", "WWWWWWW", "yYYYYYy", ".YYYYY.", "..ggg.."]]] }),
      kf({ head: "flash", armL: "forward", armR: "salute", prop: "default" }, { angle: "front", fx: [[23, 4, [".YY.", "YyyY", ".YY."]]] }),
      kf({ head: "blink", armL: "forward", armR: "mid", prop: "default" }, { angle: "front" }),
    ]),
    // 飞页龙卷风（6大拍→24帧）：侧面翻开厚书 → 加速查资料 → 书页卷起龙卷风 → 满天飞页 → 凌空一抓定页 → 正面亮答案微笑
    clip("books", "飞页龙卷风", [170, 150, 135, 135, 155, 180], [
      kf({ head: { dy: 1, variant: "normal" }, armL: "mid", armR: "forwardLow", prop: "book" }, { angle: "side" }),
      kf({ head: { dy: 1, variant: "normal" }, armL: "mid", armR: "forward", prop: "book" }, { angle: "side", fx: [[2, 12, ["WWW", "WwW"]]] }),
      kf({ head: { dy: 1, variant: "normal" }, torso: "leanL", armL: "mid", armR: { dx: -1, dy: -1, variant: "forward" }, prop: { dy: -1, variant: "book" } }, { angle: "side", fx: [[1, 3, ["WWW.....................WWW", "WwW..........Y..........wWW"]]] }),
      kf({ head: "glow", torso: "leanR", armL: "up", armR: "mid", prop: "book" }, { angle: "side", fx: [[2, 1, ["...WWW.......WWW.......WWW", "Y..WwW.......wWW....Y..WwW"]]] }),
      kf({ head: "flash", armL: "mid", armR: "up", prop: "book" }, { angle: "front", fx: [[3, 4, ["WWW...................Y.."]]] }),
      kf({ head: "happy", armL: "down", armR: "mid", prop: "default" }, { angle: "front" }),
    ]),
    // 满分金星章（6大拍→24帧）：侧面低头仔细批改 → 眼睛一亮举章 → 正面霸气盖章+红100分 → 踮脚欢呼 → 二次喝彩 → 满意收章
    clip("goldstar", "满分金星章", [175, 155, 145, 145, 155, 180], [
      kf({ head: { dy: 1, variant: "normal" }, armL: "forward", armR: "forwardLow", prop: "book" }, { angle: "side" }),
      kf({ head: "normal", armL: "down", armR: "mid", prop: { dy: 4, variant: "starStamp" } }, { angle: "side" }),
      kf({ head: "happy", torso: "leanR", armL: "mid", armR: "up", prop: { dy: -1, variant: "starStamp" } }, { angle: "front" }),
      kf({ head: "glow", armL: "up", armR: { dy: -1, variant: "up" }, legL: "step", legR: "stand", prop: { dy: -2, variant: "starStamp" } }, { angle: "front", fx: [[2, 3, ["R.RR.RR", "R.R.R.R", "R.RR.RR"]], [20, 2, ["R..Y..M"]]] }),
      kf({ head: "happy", armL: "up", armR: "up", legL: "stand", legR: "step", prop: { dy: -1, variant: "starStamp" } }, { angle: "front", fx: [[2, 2, ["Y..Y................Y..Y"]]] }),
      kf({ head: "happy", armL: "down", armR: "mid", prop: { dy: 2, variant: "starStamp" } }, { angle: "front" }),
    ]),
    // 粉笔狙击（6大拍→24帧）：背面听见背后小动作一顿 → 转侧面镜片反白锁敌 → 拉弓蓄力 → 猛弹粉笔高速出膛 → 命中爆火花 → 正面淡定拍粉笔灰
    clip("chalk", "粉笔狙击", [175, 160, 140, 130, 145, 180], [
      kf({ head: "shock", armL: "down", armR: "mid", prop: false }, { angle: "back", fx: [[22, 3, ["R", "R", ".", "R"]]] }),
      kf({ head: "flash", torso: "leanL", armL: "back", armR: "salute", prop: { dx: -1, dy: 0, variant: "chalk" } }, { angle: "side" }),
      kf({ head: "flash", torso: "leanR", armL: "back", armR: "mid", legL: "stand", legR: "wide", prop: { dx: 3, dy: -1, variant: "chalk" } }, { angle: "side", fx: [[22, 12, ["w.w.WW"]]] }),
      kf({ head: "normal", torso: "leanR", armL: "down", armR: "mid", legL: "stand", legR: "wide", prop: { dx: 6, dy: -2, variant: "chalk" } }, { angle: "side", fx: [[21, 11, ["w..w..w.."]], [29, 11, ["Y.F"]]] }),
      kf({ head: "happy", armL: "down", armR: "mid", prop: false }, { angle: "side", fx: [[25, 11, ["Y.F.Y", ".F.F."]]] }),
      kf({ head: "blink", armL: "forward", armR: "forward", prop: "default" }, { angle: "front", fx: [[13, 18, ["w.w.w"]]] }),
    ]),
    // 推镜威压（6大拍→24帧）：侧面抱书低头 → 优雅抬手推镜 → 侧面镜片反白 → 转正面银魂全屏白光紫气威压 → 气场全开 → 突然切换温柔笑眼
    clip("glasses", "推镜威压", [175, 165, 155, 155, 160, 185], [
      kf({ head: { dy: 1, variant: "normal" }, armL: "forward", armR: "down", prop: "book" }, { angle: "side" }),
      kf({ head: "normal", armL: "up", armR: "salute", prop: "book" }, { angle: "side" }),
      kf({ head: "flash", armL: { dx: 1, dy: 0, variant: "up" }, armR: "salute", prop: "book" }, { angle: "side", fx: [[2, 4, ["U....................U"]]] }),
      kf({ head: { dy: -1, variant: "flash" }, armL: "up", armR: "mid", prop: false }, { angle: "front", fx: [[1, 2, ["U..U................U..U", ".U....................U."]], [8, 10, ["W..............W"]]] }),
      kf({ head: "flash", armL: "down", armR: "down", prop: "default" }, { angle: "front", fx: [[3, 5, ["U....................U"]]] }),
      kf({ head: "happy", armL: "down", armR: "mid", prop: "default" }, { angle: "front", fx: [[23, 8, ["Y..M"]]] }),
    ]),
  ],
});

// ============================================================================
// 12. 园丁 (男) — 巨花暴长 / 落叶暴雪 / 群蝶抢帽 / 拔出巨萝卜 / 彩虹洒水
// ============================================================================
const gardenerHat = (g) => {
  stamp2x(g, 5, 2, ["......bbbbbbbb......", ".....bbbbbbbbbb.....", ".....ddAAAAAAdd.....", ".bbbbbbbbbbbbbbbbbb."]);
};
const gardenerRig = buildCharacterRig({
  gender: "male", hairStyle: "short", coat: "overalls", boots: "brown", hatKind: "straw", beardKind: "beard",
  hatFn: gardenerHat,
  beardFn(g) { stamp2x(g, 11, 15, ["BBBBBBBBBB"], false); },
  props: {
    default: (() => { const g = blank(); stamp2x(g, 22, 19, [".ggg.", "ggggg", ".ggg."]); stamp2x(g, 25, 25, [".V.", "vVv", ".v."], false); return g; })(),
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
    // 巨花暴长（7大拍→27帧）：侧面蹲身轻拍嫩芽 → 举壶温柔浇水 → 花苞萌动 → 突然暴长惊退 → 巨型向日葵冲天绽放 → 蹦跳欢呼 → 正面与巨花合影
    clip("bloom", "巨花暴长", [170, 160, 150, 145, 155, 155, 180], [
      kf({ head: { dy: 1, variant: "happy" }, armL: "down", armR: "forwardLow", legL: "crouch", legR: "crouch", prop: "default" }, { angle: "side" }),
      kf({ head: "normal", armL: "down", armR: "mid", prop: "default" }, { angle: "side", fx: [[25, 21, [".C.", "..c"]]] }),
      kf({ head: "normal", torso: "leanR", armL: "back", armR: { dy: -1, variant: "mid" }, prop: "default" }, { angle: "side", fx: [[24, 18, ["..M..", ".MYM.", "..M.."]]] }),
      kf({ head: "shock", torso: "leanL", armL: "mid", armR: "mid", legL: "wide", legR: "stand", prop: "sunflower" }, { angle: "side" }),
      kf({ head: "glow", torso: "leanL", armL: "up", armR: "up", legL: "wide", legR: "wide", prop: { dy: -2, variant: "sunflower" } }, { angle: "side", fx: [[21, 4, ["Y.......Y"]]] }),
      kf({ head: "happy", armL: "up", armR: "mid", legL: "step", legR: "stand", prop: "sunflower" }, { angle: "front", fx: [[4, 3, ["Y....................Y"]]] }),
      kf({ head: "happy", armL: "down", armR: "down", prop: "sunflower" }, { angle: "front" }),
    ]),
    // 落叶暴雪（6大拍→24帧）：侧面打量枝叶 → 开剪热身 → 翠绿落叶漫天飞 → 高举猛修 → 精准收尾一剪 → 正面擦汗欣赏
    clip("prune", "落叶暴雪", [170, 150, 130, 130, 150, 180], [
      kf({ head: "normal", armL: "back", armR: "mid", prop: "shears" }, { angle: "side" }),
      kf({ head: "normal", armL: "down", armR: "mid", prop: "shearsShut" }, { angle: "side", fx: [[24, 12, ["V.v"]]] }),
      kf({ head: "happy", torso: "leanR", armL: "mid", armR: { dy: -1, variant: "mid" }, prop: { dy: -1, variant: "shearsShut" } }, { angle: "side", fx: [[1, 2, ["V..v....................V..v", "..V......................v.."]]] }),
      kf({ head: "happy", torso: "leanL", armL: "back", armR: "up", prop: { dy: -3, variant: "shears" } }, { angle: "side", fx: [[2, 1, ["v....V.......V.......V....v", "..V..........v..........V.."]]] }),
      kf({ head: "blink", armL: "down", armR: "mid", prop: "shearsShut" }, { angle: "side", fx: [[3, 5, ["V........................v"]]] }),
      kf({ head: "happy", armL: "down", armR: "salute", prop: "shears" }, { angle: "front", fx: [[23, 8, ["Y.V"]]] }),
    ]),
    // 群蝶抢帽（6大拍→24帧）：正面蝴蝶停帽檐好奇 → 侧面轻手追蝶 → 群蝶叼帽飞空正面惊呼 → 跃起伸手抢帽 → 扣正草帽 → 笑开花挥手
    clip("butterfly", "群蝶抢帽", [175, 155, 145, 145, 155, 180], [
      kf({ head: "normal", armL: "down", armR: "down", prop: "default" }, { angle: "front", fx: [[24, 3, ["Y.Y", "YMY", "Y.Y"]]] }),
      kf({ head: "normal", armL: "mid", armR: "up", prop: false }, { angle: "side", fx: [[2, 1, ["M.M....................Y.Y", "MYM....................YCY"]]] }),
      kf({ head: "hatlessShock", armL: "up", armR: "up", legL: "wide", legR: "wide", prop: "hatFloat" }, { angle: "front", fx: [[4, 0, ["M.M..............Y.Y", "MYM..............YCY"]]] }),
      kf({ head: { dy: -2, variant: "hatless" }, torso: { dy: -2, variant: "normal" }, armL: { dy: -2, variant: "up" }, armR: { dy: -2, variant: "up" }, legL: { dy: -2, variant: "step" }, legR: { dy: -2, variant: "step" }, prop: { dy: 1, variant: "hatFloat" } }, { angle: "front", shadow: "shrink" }),
      kf({ head: "happy", armL: "down", armR: "salute", prop: false }, { angle: "front", fx: [[3, 1, ["C.C..................M.M", "CYC..................MYM"]]] }),
      kf({ head: "happy", armL: "down", armR: "mid", prop: "default" }, { angle: "front" }),
    ]),
    // 拔出巨萝卜（6大拍→24帧）：侧面发现萝卜叶摩拳擦掌 → 弓步紧拽 → 满头大汗拼命后拉 → 「啵」地拔出巨萝卜 → 转正面高举炫耀 → 满足抱紧
    clip("carrot", "拔出巨萝卜", [175, 165, 155, 145, 155, 185], [
      kf({ head: "happy", armL: "flex", armR: "flex", prop: "carrotSmall" }, { angle: "side" }),
      kf({ head: { dy: 1, variant: "normal" }, torso: "leanR", armL: "forward", armR: "mid", legL: "crouch", legR: "crouch", prop: "carrotSmall" }, { angle: "side" }),
      kf({ head: { dx: -1, dy: 1, variant: "shout" }, torso: "leanL", armL: "back", armR: "forward", legL: "wide", legR: "crouch", prop: { dy: -2, variant: "carrotSmall" } }, { angle: "side", fx: [[7, 10, ["C", "C"]]] }),
      kf({ head: "shock", torso: "leanL", armL: "up", armR: "up", legL: "kick", legR: "wide", prop: "carrotGiant" }, { angle: "side", fx: [[20, 4, ["Y.....Y"]]] }),
      kf({ head: "glow", armL: "up", armR: "up", legL: "step", legR: "stand", prop: "carrotGiant" }, { angle: "front", fx: [[4, 2, ["Y....................Y"]]] }),
      kf({ head: "happy", armL: "down", armR: "mid", prop: { dy: 3, variant: "carrotGiant" } }, { angle: "front" }),
    ]),
    // 彩虹洒水（6大拍→24帧）：侧面摇晃水壶试水 → 洒出晶莹水雾 → 彩虹初现 → 七彩彩虹全盛踏步 → 转正面指彩虹欢笑 → 开心收壶
    clip("rainbow", "彩虹洒水", [170, 160, 155, 155, 160, 180], [
      kf({ head: "normal", armL: "down", armR: "lowOut", prop: "default" }, { angle: "side" }),
      kf({ head: "normal", armL: "down", armR: "mid", prop: "default" }, { angle: "side", fx: [[24, 15, ["C.c", ".C."]]] }),
      kf({ head: "happy", torso: "leanR", armL: "back", armR: { dy: -1, variant: "mid" }, prop: "default" }, { angle: "side", fx: [[19, 3, ["...RRRR..", "..RYYYYR.", ".RYVVVVYR", "RYVCCCCVY"]]] }),
      kf({ head: "happy", armL: "mid", armR: "up", legL: "step", legR: "stand", prop: "default" }, { angle: "side", fx: [[16, 1, ["....RRRRRR....", "..RRYYYYYYRR..", ".RYVVVVVVVVYR.", "RYVCCCCCCCCVYR", "YVCMMMMMMMMCVY"]]] }),
      kf({ head: "glow", armL: "up", armR: "up", prop: "default" }, { angle: "front", fx: [[20, 4, ["..RRRR..", ".RYYYYR.", "RYVVVVYR"]]] }),
      kf({ head: "happy", armL: "down", armR: "mid", prop: "default" }, { angle: "side" }),
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
  sideProps: {
    default: partPatch(19, 17, ["..ggg....", "OOggggggg", "OOgCCCggW", "OOggggggg", "OOOOOO..."], false),
  },
});
const photographer = makeRiggedSprite({
  id: "photographer", name: "摄影师", gender: "female",
  palette: makePalette(SKIN.peach, { H: "#242638", h: "#434766", k: "#141521" }),
  rig: photographerRig,
  idleKeyframe: kf({ armL: "forward", armR: "forward", prop: "default" }),
  animations: [
    // 核爆闪光灯（7大拍→27帧）：侧面构图调焦 → 转正面架机倒数 → 核爆白金十字闪光 → 自己也被闪眯眼后退 → 揉眼看回放 → 满意点头 → 开心比心
    clip("flash", "核爆闪光灯", [170, 160, 115, 135, 155, 155, 180], [
      kf({ head: "normal", torso: "leanR", armL: "forward", armR: "forward", prop: "default" }, { angle: "side" }),
      kf({ head: "normal", armL: "forward", armR: "forward", prop: "default" }, { angle: "front" }),
      kf({ head: { dy: -1, variant: "shock" }, torso: "leanL", armL: { dy: -2, variant: "forward" }, armR: { dy: -2, variant: "forward" }, legL: "wide", legR: "stand", prop: { dy: -2, variant: "default" } }, { angle: "front", fx: [[6, 9, [".........y.........", ".........W.........", ".......yWWWy.......", "....yWWWWWWWWWy....", "..yWWWWWWWWWWWWWy..", "yWWWWWWWWWWWWWWWWWy", "..yWWWWWWWWWWWWWy..", "....yWWWWWWWWWy....", ".......yWWWy.......", ".........W........."]]] }),
      kf({ head: "blink", armL: { dy: -1, variant: "forward" }, armR: { dy: -1, variant: "forward" }, prop: { dy: -1, variant: "default" } }, { angle: "front", fx: [[10, 13, ["....y....", "..yWWWy..", "yWWWWWWWy", "..yWWWy.."]]] }),
      kf({ head: "dizzy", armL: "down", armR: "salute", prop: "default" }, { angle: "side", fx: [[13, 17, ["..W..", ".yWy.", "..W.."]]] }),
      kf({ head: { dy: 1, variant: "happy" }, armL: "forward", armR: "forward", prop: "default" }, { angle: "front" }),
      kf({ head: "happy", armL: "forward", armR: "up", prop: "peace" }, { angle: "front", fx: [[23, 7, ["M.M", "MMM"]]] }),
    ]),
    // 鬼畜贴地拍（6大拍→24帧）：左侧面贴地找角度 → 右侧面丝滑蹲拍 → 正面锁绿对焦 → 咔嚓定格闪光 → 站起转相机 → 满意笑
    clip("focus", "鬼畜贴地拍", [170, 150, 150, 140, 155, 180], [
      kf({ head: { dy: 2, variant: "normal" }, torso: { dy: 1, variant: "normal" }, armL: { dy: 1, variant: "forward" }, armR: { dy: 1, variant: "forward" }, legL: "crouch", legR: "crouch", prop: { dy: 1, variant: "default" } }, { angle: "side", facing: "left", fx: [[2, 2, ["RRR......................RRR", "R..........................R"]], [2, 27, ["R..........................R", "RRR......................RRR"]]] }),
      kf({ head: { dx: -1, dy: 2, variant: "normal" }, torso: { dx: -1, dy: 1, variant: "leanL" }, armL: { dx: -1, dy: 1, variant: "forward" }, armR: { dx: -1, dy: 1, variant: "forward" }, legL: "wide", legR: "crouch", prop: { dx: -1, dy: 1, variant: "default" } }, { angle: "side", facing: "right", fx: [[4, 4, ["RRR..................RRR", "R......................R"]], [4, 25, ["R......................R", "RRR..................RRR"]]] }),
      kf({ head: { dx: 1, dy: 2, variant: "glowV" }, torso: { dx: 1, dy: 1, variant: "leanR" }, armL: { dx: 1, dy: 1, variant: "forward" }, armR: { dx: 1, dy: 1, variant: "forward" }, legL: "crouch", legR: "wide", prop: { dx: 1, dy: 1, variant: "default" } }, { angle: "front", fx: [[6, 6, ["VVV..............VVV", "V..................V"]], [6, 23, ["V..................V", "VVV..............VVV"]]] }),
      kf({ head: "flash", armL: "forward", armR: "forward", prop: "default" }, { angle: "front", fx: [[12, 16, ["..W..", ".yWy.", "..W.."]]] }),
      kf({ head: "happy", armL: "up", armR: "mid", legL: "step", legR: "stand", prop: "default" }, { angle: "side", fx: [[22, 6, ["VVV"]]] }),
      kf({ head: "happy", armL: "forward", armR: "forward", prop: "default" }, { angle: "front" }),
    ]),
    // 绝片蹦高（6大拍→24帧）：侧面认真回看相机 → 突然看到神图双眼放粉光 → 正面激动蹦高 → 空中二次欢呼 → 落地抱紧相机 → 侧面比心
    clip("review", "绝片蹦高", [175, 155, 140, 140, 155, 180], [
      kf({ head: { dy: 1, variant: "normal" }, armL: "forward", armR: "forward", prop: "default" }, { angle: "side" }),
      kf({ head: { dy: 1, variant: "glowM" }, armL: "forward", armR: "forward", prop: "default" }, { angle: "side", fx: [[23, 8, [".M.M.", "MMMMM", ".MMM.", "..M.."]]] }),
      kf({ head: { dy: -1, variant: "glowM" }, torso: { dy: -1, variant: "normal" }, armL: { dy: -1, variant: "up" }, armR: { dy: -1, variant: "up" }, legL: { dy: -1, variant: "kick" }, legR: { dy: -1, variant: "kick" }, prop: { dy: -1, variant: "default" } }, { angle: "front", shadow: "shrink", fx: [[2, 1, ["Y..M.M................M.M..Y", "...MMM................MMM..."]]] }),
      kf({ head: { dy: -2, variant: "happy" }, torso: { dy: -2, variant: "normal" }, armL: { dy: -2, variant: "up" }, armR: { dy: -2, variant: "up" }, legL: { dy: -2, variant: "step" }, legR: { dy: -2, variant: "step" }, prop: { dy: -2, variant: "default" } }, { angle: "front", shadow: "tiny", fx: [[1, 0, [".M.M....................Y..", ".MMM...................YYY."]]] }),
      kf({ head: "happy", armL: "forward", armR: "forward", prop: "default" }, { angle: "front", fx: [[4, 3, ["Y......................M"]]] }),
      kf({ head: "happy", armL: "forward", armR: "up", prop: "peace" }, { angle: "side", fx: [[23, 6, ["M.M", "MMM"]]] }),
    ]),
    // 机关枪连拍（7大拍→27帧）：侧面深呼吸稳住长焦 → 连拍第一轮 → 高速连拍冒烟 → 第二轮狂拍 → 镜头过热冒大烟 → 吹风降温 → 正面比OK
    clip("burst", "机关枪连拍", [165, 120, 115, 115, 120, 150, 180], [
      kf({ head: "normal", armL: "forward", armR: "forward", prop: "default" }, { angle: "side" }),
      kf({ head: "normal", torso: "leanL", armL: "forward", armR: { dy: -1, variant: "forward" }, legL: "wide", legR: "wide", prop: { dx: -1, dy: -1, variant: "default" } }, { angle: "side", fx: [[23, 16, ["..W..", ".yWy.", "..W.."]]] }),
      kf({ head: "glow", torso: "leanR", armL: { dy: -1, variant: "forward" }, armR: "forward", legL: "wide", legR: "wide", prop: { dx: 1, dy: -2, variant: "default" } }, { angle: "side", fx: [[24, 15, ["..y..", ".WWW.", "yWWWy"]], [23, 10, ["w.w", ".w."]]] }),
      kf({ head: "normal", torso: "leanL", armL: "forward", armR: { dy: -1, variant: "forward" }, legL: "wide", legR: "wide", prop: { dx: -1, dy: -1, variant: "default" } }, { angle: "side", fx: [[23, 16, [".Y.W.", "WWWWW", ".W.Y."]], [4, 9, ["w.w", ".w."]]] }),
      kf({ head: "glow", torso: "leanR", armL: { dy: -1, variant: "forward" }, armR: "forward", legL: "wide", legR: "wide", prop: { dx: 1, dy: -2, variant: "default" } }, { angle: "side", fx: [[24, 15, ["..W..", "yWWWy", "..W.."]], [22, 7, ["w..w"]]] }),
      kf({ head: "blink", armL: "forward", armR: "mid", prop: "default" }, { angle: "side", fx: [[22, 13, ["w...w...w"]]] }),
      kf({ head: "happy", armL: "forward", armR: "up", prop: "peace" }, { angle: "front" }),
    ]),
    // 剪刀手自拍（6大拍→24帧）：背面找绝佳风景 → 侧面举机试角度 → 正面歪头剪刀手 → 俏皮眨眼咔嚓闪光 → 低头满意看成片 → 开心微笑
    clip("selfie", "剪刀手自拍", [175, 160, 155, 145, 160, 180], [
      kf({ head: "normal", armL: "forward", armR: "mid", prop: "peace" }, { angle: "back" }),
      kf({ head: "normal", armL: "forward", armR: "mid", prop: "default" }, { angle: "side" }),
      kf({ head: { dx: 1, variant: "happy" }, torso: "leanR", armL: "forward", armR: "up", legL: "stand", legR: "step", prop: { dy: -2, variant: "peace" } }, { angle: "front", fx: [[2, 2, ["..Y.......................M..", ".YYY.....................MMM."]]] }),
      kf({ head: { dx: 1, variant: "blink" }, torso: "leanR", armL: "forward", armR: "up", legL: "stand", legR: "step", prop: { dy: -1, variant: "peace" } }, { angle: "front", fx: [[3, 1, ["M...Y...................Y...M"]], [12, 15, ["..W..", ".yWy."]]] }),
      kf({ head: { dy: 1, variant: "happy" }, armL: "forward", armR: "forward", prop: "default" }, { angle: "side", fx: [[25, 6, ["Y"]]] }),
      kf({ head: "happy", armL: "forward", armR: "mid", prop: "default" }, { angle: "front" }),
    ]),
  ],
});

// ============================================================================
// 14. 骑士 (男) — 音爆风火轮 / 激光签收 / 天降五星 / 杂技叠箱 / 喇叭催单
// ============================================================================
const courierRig = buildCharacterRig({
  gender: "male", hairStyle: "short", coat: "jacket", hatKind: "courier",
  hatFn(g) { stamp2x(g, 8, 3, ["...AAAAAAAAAA...", "..aAAAAAAAAAAA..", ".AAAAAACCCCCCCC.", ".AAAAACWWWCCCCC.", ".dAAAACCCCCCCCC."]); },
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
    // 音爆风火轮（6大拍→24帧）：侧面扣紧护目镜起跑姿态 → 加速出青残影 → 全速音爆疾驰 → 二次加速 → 急刹漂移冒烟 → 转正面准时递包
    clip("dash", "音爆风火轮", [165, 130, 120, 120, 145, 180], [
      kf({ head: "flash", torso: "leanR", armL: "back", armR: "forward", legL: "crouch", legR: "crouch", prop: "default" }, { angle: "side" }),
      kf({ head: { dx: 1, variant: "normal" }, torso: { dx: 1, variant: "leanR" }, armL: "back", armR: "forward", legL: "step", legR: "stand", prop: { dx: 1, dy: 0, variant: "default" } }, { angle: "side", afterimage: { dx: -4, dy: 0, tint: "c" }, fx: [[0, 14, ["WWWWW.", "......", "CCCCCC"]]] }),
      kf({ head: { dx: 1, variant: "shout" }, torso: { dx: 1, variant: "leanR" }, armL: "mid", armR: "forward", legL: "stand", legR: "kick", prop: { dx: 1, dy: -1, variant: "default" } }, { angle: "side", afterimage: { dx: -5, dy: 0, tint: "c" }, fx: [[0, 11, ["CCCCC..", ".......", "WWWWWW.", ".......", ".CCCCC."]]] }),
      kf({ head: { dx: 1, variant: "glowC" }, torso: { dx: 1, variant: "leanR" }, armL: "back", armR: "forward", legL: "kick", legR: "stand", prop: { dx: 1, dy: 0, variant: "default" } }, { angle: "side", afterimage: { dx: -5, dy: 0, tint: "w" }, fx: [[0, 12, ["WWWWWW.", ".......", "CCCCCC.", ".......", "WWWWWW."]]] }),
      kf({ head: "blink", torso: "leanL", armL: "mid", armR: "forward", legL: "wide", legR: "wide", prop: "default" }, { angle: "side", fx: [[2, 24, ["w.w.W.w"]]] }),
      kf({ head: "happy", armL: "forward", armR: "mid", prop: "default" }, { angle: "front", fx: [[23, 8, ["Y.Y"]]] }),
    ]),
    // 激光签收（6大拍→24帧）：侧面抱稳包裹掏扫码枪 → 瞄准红点 → 射出红色扫描激光 → 「滴！」头顶亮超大绿勾 → 帅气敬礼 → 正面微笑递包
    clip("scan", "激光签收", [170, 155, 145, 150, 155, 180], [
      kf({ head: "normal", armL: "forward", armR: "down", prop: "default" }, { angle: "side" }),
      kf({ head: "normal", armL: "forward", armR: "mid", prop: "default" }, { angle: "side", fx: [[21, 15, ["gRR."]]] }),
      kf({ head: "normal", torso: "leanR", armL: "forward", armR: "mid", prop: "default" }, { angle: "side", fx: [[20, 14, ["gRRRRRRRRRR", ".RRRRRRRRRR"]]] }),
      kf({ head: "glowV", armL: "forward", armR: "up", prop: "default" }, { angle: "side", fx: [[22, 3, [".....VV", "....VV.", "...VV..", "V.VV...", "VVV...."]]] }),
      kf({ head: "happy", armL: "down", armR: "salute", prop: "default" }, { angle: "side", fx: [[22, 4, ["....VV", "...VV.", "V.VV..", ".VV..."]]] }),
      kf({ head: "happy", armL: "forward", armR: "mid", prop: "default" }, { angle: "front" }),
    ]),
    // 天降五星（6大拍→24帧）：侧面掂量包裹热身 → 正面高抛包裹 → 凌空旋转天降五星金雨 → 持续闪耀 → 稳稳接住包裹 → 开心敬礼致谢
    clip("fivestar", "天降五星", [170, 155, 145, 150, 155, 180], [
      kf({ head: "normal", armL: "forward", armR: "mid", prop: "default" }, { angle: "side" }),
      kf({ head: "normal", armL: "down", armR: "up", prop: "boxHigh" }, { angle: "front" }),
      kf({ head: { dy: -1, variant: "happy" }, armL: "up", armR: "up", legL: "step", legR: "stand", prop: { dy: -4, variant: "boxHigh" } }, { angle: "front", fx: [[2, 0, [".Y.....Y.....Y.....Y.....Y", "YYY...YYY...YYY...YYY...YYY"]]] }),
      kf({ head: "glow", armL: "mid", armR: "mid", legL: "stand", legR: "step", prop: "boxHigh" }, { angle: "front", fx: [[4, 1, [".Y.......Y.......Y", "YYY.....YYY.....YYY"]]] }),
      kf({ head: "happy", armL: "down", armR: "forward", prop: "default" }, { angle: "front", fx: [[5, 2, ["Y.........Y.........Y"]]] }),
      kf({ head: "happy", armL: "down", armR: "salute", prop: "default" }, { angle: "front" }),
    ]),
    // 杂技叠箱（6大拍→24帧）：正面顶起高箱 → 左侧面惊险左倾 → 右侧面急忙救场冒汗 → 再次回正稳住 → 单脚杂技炫技 → 稳稳落地笑
    clip("stack", "杂技叠箱", [170, 155, 150, 150, 155, 180], [
      kf({ head: "normal", armL: "mid", armR: "mid", prop: "stack" }, { angle: "front" }),
      kf({ head: { dx: -1, variant: "normal" }, torso: "leanL", armL: "up", armR: "down", legL: "wide", legR: "stand", prop: { dx: -1, dy: 0, variant: "stackTall" } }, { angle: "side", facing: "left" }),
      kf({ head: { dx: 1, variant: "shock" }, torso: "leanR", armL: "down", armR: "up", legL: "stand", legR: "wide", prop: { dx: 2, dy: 0, variant: "stackTall" } }, { angle: "side", facing: "right", fx: [[5, 11, ["C", "C"]]] }),
      kf({ head: "normal", armL: "mid", armR: "mid", prop: "stackTall" }, { angle: "front" }),
      kf({ head: "happy", armL: "up", armR: "up", legL: "step", legR: "stand", prop: "stackTall" }, { angle: "front", fx: [[4, 1, ["Y....................Y"]]] }),
      kf({ head: "happy", armL: "mid", armR: "mid", prop: "stack" }, { angle: "front" }),
    ]),
    // 喇叭催单（6大拍→24帧）：侧面看表焦急 → 轻按试声 → 护目镜反白狂按喇叭 → 超级声波震屏 → 听见开门声抬头 → 转正面开心递单
    clip("horn", "喇叭催单", [170, 150, 135, 135, 155, 180], [
      kf({ head: { dy: 1, variant: "blink" }, armL: "forward", armR: "salute", prop: "default" }, { angle: "side" }),
      kf({ head: "normal", armL: "down", armR: "mid", prop: "default" }, { angle: "side", fx: [[23, 10, ["Y.Y", ".Y."]]] }),
      kf({ head: "flash", torso: "leanR", armL: "back", armR: { dy: -1, variant: "mid" }, prop: "default" }, { angle: "side", fx: [[23, 6, ["..Y.F.", ".Y...F", "Y....F", ".Y...F", "..Y.F."]]] }),
      kf({ head: "shout", torso: "leanR", armL: "mid", armR: "up", legL: "stand", legR: "wide", prop: "default" }, { angle: "side", fx: [[22, 4, ["...Y.F.R", "..Y...F.", ".Y....F.", "..Y...F.", "...Y.F.R"]]] }),
      kf({ head: "normal", armL: "down", armR: "mid", prop: "default" }, { angle: "side", fx: [[24, 9, [".Y.", "Y.Y"]]] }),
      kf({ head: "happy", armL: "forward", armR: "mid", prop: "default" }, { angle: "front" }),
    ]),
  ],
});

// ============================================================================
// 15. 魔法师 (女) — 雷电星阵 / 魔球失控 / 帽尖烟花 / 变青蛙乌龙 / 扫帚狂飙
// ============================================================================
const wizardRig = buildCharacterRig({
  gender: "female", hairStyle: "long", coat: "robe", hatKind: "wizard",
  hatFn(g) {
    stamp2x(g, 7, 0, ["........A.......", ".......AAA......", "......AAYAA.....", ".....AAAAAAA....", "....AAAAAAAAA...", "..ddYYYYYYYYYdd."]);
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
    // 雷电星阵（6大拍→24帧）：背面无风自动吟唱 → 侧面举杖画星阵 → 转正面雷电星阵炸裂 → 魔力引导全开 → 潇洒收杖 → 眨眼微笑
    clip("cast", "雷电星阵", [175, 155, 145, 145, 155, 180], [
      kf({ head: "normal", armL: "mid", armR: "mid", prop: "default" }, { angle: "back", fx: [[2, 4, ["Y...", "....", "..u."]]] }),
      kf({ head: "glowC", torso: "leanL", armL: "up", armR: "up", prop: { dy: -3, variant: "default" } }, { angle: "side", fx: [[1, 1, ["Y..u....................Y..u"]], [22, 6, ["..Y.C.Y..", ".CWWWWWC.", "..YCYCY.."]]] }),
      kf({ head: "glow", torso: "leanR", armL: "mid", armR: { dy: -1, variant: "up" }, legL: "wide", legR: "wide", prop: { dy: -4, variant: "default" } }, { angle: "front", fx: [[1, 0, [".C..Y..................Y..M.", "Y..........................Y"]], [21, 5, ["..Y.M.Y..", ".CWWWWWC.", "YWWCCCWWY", ".CWWWWWC."]]] }),
      kf({ head: "glowM", torso: "leanL", armL: "up", armR: "up", legL: "wide", legR: "wide", prop: { dy: -3, variant: "default" } }, { angle: "front", fx: [[2, 1, ["Y...C...M...Y...C"]]] }),
      kf({ head: "blink", armL: "down", armR: "mid", prop: "default" }, { angle: "front", fx: [[2, 3, [".u......................u", "Y.......................Y"]]] }),
      kf({ head: "happy", armL: "down", armR: "down", prop: "default" }, { angle: "front" }),
    ]),
    // 魔球失控（6大拍→24帧）：侧面凝聚迷你光球 → 魔球膨胀 → 巨型失控魔球把人吹离地面 → 拼命按压收回 → 正面晕头转向 → 擦汗憨笑
    clip("orb", "魔球失控", [175, 155, 150, 150, 160, 180], [
      kf({ head: "normal", armL: "forward", armR: "mid", prop: "default" }, { angle: "side", fx: [[22, 11, [".UUU.", "UCCCU", ".UUU."]]] }),
      kf({ head: "glowM", torso: "leanL", armL: "mid", armR: "up", prop: "orbMid" }, { angle: "side" }),
      kf({ head: { dy: -1, variant: "shock" }, torso: { dy: -1, variant: "leanL" }, armL: { dy: -1, variant: "up" }, armR: { dy: -1, variant: "up" }, legL: { dy: -1, variant: "kick" }, legR: { dy: -1, variant: "step" }, prop: "orbHuge" }, { angle: "side", shadow: "tiny" }),
      kf({ head: "shout", torso: "leanR", armL: "forward", armR: "forward", legL: "wide", legR: "wide", prop: "orbMid" }, { angle: "side" }),
      kf({ head: "dizzy", armL: "down", armR: "mid", prop: "default" }, { angle: "front", fx: [[24, 9, ["C", "C"]]] }),
      kf({ head: "happy", armL: "down", armR: "down", prop: "default" }, { angle: "front" }),
    ]),
    // 帽尖烟花（6大拍→24帧）：侧面轻敲魔法帽蓄魔 → 正面帽尖冒星 → 踏步起舞放烟花 → 五彩流星雨大喷发 → 旋转欢呼 → 优雅鞠躬
    clip("meteor", "帽尖烟花", [170, 155, 140, 140, 155, 180], [
      kf({ head: "normal", armL: "down", armR: "salute", prop: "default" }, { angle: "side", fx: [[13, 0, ["Y..Y"]]] }),
      kf({ head: "normal", armL: "down", armR: "up", prop: "default" }, { angle: "front", fx: [[9, 0, ["Y....Y....Y", ".M.......C."]]] }),
      kf({ head: "happy", armL: "up", armR: "mid", legL: "step", legR: "stand", prop: "default" }, { angle: "front", fx: [[2, 0, ["Y.....M..Y..C.....Y", ".C...Y.......Y...M."]]] }),
      kf({ head: "glowM", armL: "mid", armR: "up", legL: "stand", legR: "step", prop: { dy: -2, variant: "default" } }, { angle: "front", fx: [[1, 0, ["M..C....Y..Y....M..C", ".Y.....M....C.....Y.", "..C...Y......Y...M.."]]] }),
      kf({ head: "happy", armL: "up", armR: "up", prop: "default" }, { angle: "side", fx: [[4, 1, ["C.....Y.....M.....C"]]] }),
      kf({ head: { dy: 1, variant: "happy" }, armL: "down", armR: "down", prop: "default" }, { angle: "front" }),
    ]),
    // 变青蛙乌龙（6大拍→24帧）：侧面自信吟唱 → 挥杖爆紫烟 → 烟散惊现呆萌绿青蛙 → 吓退冒冷汗 → 青蛙欢快高跳 → 正面无奈捂额
    clip("frog", "变青蛙乌龙", [175, 145, 165, 165, 160, 180], [
      kf({ head: "happy", armL: "down", armR: "up", prop: { dy: -2, variant: "default" } }, { angle: "side", fx: [[23, 9, ["u.U.u"]]] }),
      kf({ head: "shock", armL: "mid", armR: "mid", prop: false }, { angle: "side", fx: [[21, 18, [".uUUu.", "uUUUUu", ".uUUu."]]] }),
      kf({ head: "shock", torso: "leanL", armL: "mid", armR: "mid", legL: "wide", legR: "stand", prop: { dx: 0, dy: 0, variant: "frog" } }, { angle: "side", fx: [[6, 10, ["C", "C"]]] }),
      kf({ head: "dizzy", armL: "down", armR: "down", prop: { dx: 0, dy: -3, variant: "frog" } }, { angle: "side" }),
      kf({ head: "dizzy", armL: "mid", armR: "down", prop: { dx: 0, dy: -5, variant: "frog" } }, { angle: "front", fx: [[23, 14, ["Y.V"]]] }),
      kf({ head: "blink", armL: "down", armR: "salute", prop: { dx: 0, dy: 0, variant: "frog" } }, { angle: "front" }),
    ]),
    // 扫帚狂飙（6大拍→24帧）：侧面助跑跨扫帚 → 离地腾空 → 破空疾驰拉星尘 → 空中炫技挥手 → 俯冲滑翔 → 平稳着陆微笑
    clip("broom", "扫帚狂飙", [160, 140, 130, 130, 145, 175], [
      kf({ head: "normal", torso: "leanR", armL: "forward", armR: "forward", legL: "step", legR: "stand", prop: { dx: 0, dy: 1, variant: "broom" } }, { angle: "side", propZ: "back" }),
      kf({ head: { dy: -1, variant: "normal" }, torso: { dy: -1, variant: "leanR" }, armL: { dy: -1, variant: "forward" }, armR: { dy: -1, variant: "forward" }, legL: { dy: -1, variant: "crouch" }, legR: { dy: -1, variant: "crouch" }, prop: { dx: 0, dy: 0, variant: "broom" } }, { angle: "side", propZ: "back", shadow: "shrink" }),
      kf({ head: { dy: -2, variant: "happy" }, torso: { dy: -2, variant: "leanR" }, armL: { dy: -2, variant: "forward" }, armR: { dy: -2, variant: "up" }, legL: { dy: -2, variant: "crouch" }, legR: { dy: -2, variant: "step" }, prop: { dx: 1, dy: -1, variant: "broom" } }, { angle: "side", propZ: "back", shadow: "tiny", fx: [[0, 19, ["Y.", ".Y", "C."]]] }),
      kf({ head: { dy: -3, variant: "glow" }, torso: { dy: -3, variant: "leanR" }, armL: { dy: -3, variant: "up" }, armR: { dy: -3, variant: "up" }, legL: { dy: -3, variant: "step" }, legR: { dy: -3, variant: "crouch" }, prop: { dx: 2, dy: -2, variant: "broom" } }, { angle: "side", propZ: "back", shadow: "none", fx: [[0, 18, ["Y.C", "M.Y", "Y.."]]] }),
      kf({ head: { dy: -2, variant: "happy" }, torso: { dy: -2, variant: "leanR" }, armL: { dy: -2, variant: "forward" }, armR: { dy: -2, variant: "forward" }, legL: { dy: -2, variant: "crouch" }, legR: { dy: -2, variant: "crouch" }, prop: { dx: 1, dy: -1, variant: "broom" } }, { angle: "side", propZ: "back", shadow: "tiny", fx: [[0, 20, ["Y."]]] }),
      kf({ head: "happy", armL: "down", armR: "mid", prop: "default" }, { angle: "front" }),
    ]),
  ],
});

// ============================================================================
// 16. 运动员 (男) — 燃火运球 / 热血蛙跳 / 夺冠狂欢 / 超级暴扣 / 肌肉爆气
// ============================================================================
const athleteRig = buildCharacterRig({
  gender: "male", hairStyle: "spiky", coat: "jersey", legs: "shorts", boots: "white", hatKind: "headband",
  hatFn(g) { fill(g, 20, 14, 24, 4, "A"); fill(g, 22, 14, 8, 2, "a"); },
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
    // 燃火运球（6大拍→24帧）：侧面低姿热身拍球 → 球身起火 → 高速燃火变向推进 → 压低重心急停 → 转正面单手指尖转球 → 帅气微笑
    clip("dribble", "燃火运球", [165, 145, 130, 130, 150, 180], [
      kf({ head: "normal", armL: "down", armR: "down", legL: "stand", legR: "stand", prop: { dx: 0, dy: 0, variant: "default" } }, { angle: "side" }),
      kf({ head: "normal", armL: "mid", armR: "mid", legL: "wide", legR: "wide", prop: { dx: 0, dy: -2, variant: "default" } }, { angle: "side", fx: [[23, 16, ["..Y..", ".FYF."]]] }),
      kf({ head: { dy: 1, variant: "normal" }, torso: "leanR", armL: "back", armR: "down", legL: "crouch", legR: "crouch", prop: { dx: 0, dy: 2, variant: "default" } }, { angle: "side", fx: [[23, 20, ["..Y..", ".FYF."]]] }),
      kf({ head: "glowF", torso: "leanR", armL: "mid", armR: "mid", legL: "wide", legR: "wide", prop: { dx: 0, dy: -4, variant: "default" } }, { angle: "side", fx: [[23, 14, ["..R..", ".FYF."]]] }),
      kf({ head: "happy", armL: "mid", armR: "up", legL: "step", legR: "stand", prop: { dx: 0, dy: -8, variant: "default" } }, { angle: "front", fx: [[23, 9, ["Y..F..Y"]]] }),
      kf({ head: "happy", armL: "back", armR: "down", legL: "stand", legR: "stand", prop: { dx: 0, dy: 1, variant: "default" } }, { angle: "front", fx: [[23, 19, [".FYF."]]] }),
    ]),
    // 热血蛙跳（6大拍→24帧）：侧面压腿热身 → 深蹲蓄力 → 热血高跃飙汗 → 空中二次冲刺 → 稳稳落地缓冲 → 正面擦汗竖大拇指
    clip("warmup", "热血蛙跳", [165, 150, 130, 130, 150, 180], [
      kf({ head: "normal", torso: "leanR", armL: "down", armR: "forwardLow", legL: "wide", legR: "crouch", prop: false }, { angle: "side" }),
      kf({ head: { dy: 2, variant: "normal" }, torso: { dy: 1, variant: "normal" }, armL: { dy: 1, variant: "back" }, armR: { dy: 1, variant: "back" }, legL: "crouch", legR: "crouch", prop: false }, { angle: "side" }),
      kf({ head: { dy: -2, variant: "shout" }, torso: { dy: -2, variant: "normal" }, armL: { dy: -2, variant: "up" }, armR: { dy: -2, variant: "up" }, legL: { dy: -2, variant: "kick" }, legR: { dy: -2, variant: "kick" }, prop: false }, { angle: "side", shadow: "tiny", fx: [[2, 4, ["C........................C", ".c......................c."]]] }),
      kf({ head: { dy: -3, variant: "glowC" }, torso: { dy: -3, variant: "normal" }, armL: { dy: -3, variant: "up" }, armR: { dy: -3, variant: "up" }, legL: { dy: -3, variant: "step" }, legR: { dy: -3, variant: "step" }, prop: false }, { angle: "side", shadow: "none", fx: [[1, 2, ["C.c....................c.C"]]] }),
      kf({ head: { dy: 1, variant: "happy" }, torso: { dy: 1, variant: "normal" }, armL: "mid", armR: "mid", legL: "wide", legR: "wide", prop: false }, { angle: "side", fx: [[3, 7, ["C........................C"]]] }),
      kf({ head: "happy", armL: "down", armR: "salute", prop: false }, { angle: "front", fx: [[23, 8, ["Y.Y"]]] }),
    ]),
    // 夺冠狂欢（6大拍→24帧）：正面捧杯惊喜 → 侧面高举绕场 → 背面亮出7号球衣欢呼 → 侧面挥拳致意 → 正面彩带狂欢 → 霸气高举金杯
    clip("trophy", "夺冠狂欢", [175, 155, 150, 150, 155, 185], [
      kf({ head: "normal", armL: "down", armR: "mid", prop: { dy: 3, variant: "trophy" } }, { angle: "front" }),
      kf({ head: "glow", torso: "leanL", armL: "up", armR: "up", legL: "step", legR: "stand", prop: { dy: -3, variant: "trophy" } }, { angle: "side", facing: "right", fx: [[21, 3, ["Y......Y"]]] }),
      kf({ head: "happy", armL: "flex", armR: { dy: -1, variant: "up" }, legL: "stand", legR: "step", prop: { dy: -4, variant: "trophy" } }, { angle: "back", fx: [[1, 0, ["Y..M..................C", "..C...................Y"]]] }),
      kf({ head: "glow", armL: "up", armR: "up", legL: "step", legR: "stand", prop: { dy: -3, variant: "trophy" } }, { angle: "side", facing: "left", fx: [[3, 2, ["Y..C..M"]]] }),
      kf({ head: { dy: -1, variant: "happy" }, armL: "up", armR: "up", legL: "step", legR: "step", prop: { dy: -4, variant: "trophy" } }, { angle: "front", shadow: "shrink", fx: [[2, 0, ["Y..M..........C..Y"]]] }),
      kf({ head: "happy", armL: "down", armR: "up", prop: { dy: -1, variant: "trophy" } }, { angle: "front" }),
    ]),
    // 超级暴扣（6大拍→24帧）：侧面运球助跑 → 深蹲蓄力起跳 → 空中滞空举火球 → 轰然暴扣砸地冲击波 → 霸气屈肌怒吼 → 微笑接球
    clip("dunk", "超级暴扣", [160, 145, 135, 135, 155, 180], [
      kf({ head: "normal", torso: "leanR", armL: "back", armR: "forward", legL: "step", legR: "stand", prop: "default" }, { angle: "side" }),
      kf({ head: { dy: 1, variant: "normal" }, torso: { dy: 1, variant: "normal" }, armL: "back", armR: "back", legL: "crouch", legR: "crouch", prop: "default" }, { angle: "side" }),
      kf({ head: { dy: -1, variant: "shout" }, torso: { dy: -1, variant: "normal" }, armL: { dy: -1, variant: "up" }, armR: { dy: -1, variant: "up" }, legL: { dy: -1, variant: "kick" }, legR: { dy: -1, variant: "step" }, prop: { dy: -1, variant: "ballHigh" } }, { angle: "side", shadow: "shrink" }),
      kf({ head: { dy: -2, variant: "glowF" }, torso: { dy: -2, variant: "normal" }, armL: { dy: -2, variant: "up" }, armR: { dy: -2, variant: "up" }, legL: { dy: -2, variant: "step" }, legR: { dy: -2, variant: "kick" }, prop: { dy: -2, variant: "ballHigh" } }, { angle: "front", shadow: "tiny", fx: [[12, 0, ["Y.....Y"]], [4, 20, ["F......................F"]]] }),
      kf({ head: { dy: 1, variant: "glow" }, torso: { dy: 1, variant: "normal" }, armL: "mid", armR: "mid", legL: "wide", legR: "wide", prop: { dy: 2, variant: "default" } }, { angle: "front", fx: [[2, 26, ["Y.F.Y..................Y.F.Y", ".YYY....................YYY."]]] }),
      kf({ head: "happy", armL: "flex", armR: "flex", legL: "wide", legR: "wide", prop: "default" }, { angle: "front" }),
    ]),
    // 肌肉爆气（6大拍→24帧）：背面秀7号背肌 → 侧面单臂屈肌 → 转正面双臂蓄气 → 赛亚人金焰暴走 → 怒吼巅峰 → 微笑拍篮球收势
    clip("flex", "肌肉爆气", [175, 155, 145, 140, 155, 180], [
      kf({ head: "normal", armL: "flex", armR: "flex", legL: "wide", legR: "wide", prop: false }, { angle: "back" }),
      kf({ head: "glow", armL: { dy: -1, variant: "flex" }, armR: { dy: -1, variant: "flex" }, legL: "wide", legR: "wide", prop: false }, { angle: "side", fx: [[2, 2, ["..Y....................Y..", ".Y.Y..................Y.Y.", "Y........................Y"]]] }),
      kf({ head: "glow", armL: "flex", armR: "flex", legL: "wide", legR: "wide", prop: false }, { angle: "front", fx: [[2, 2, ["..Y....................Y.."]]] }),
      kf({ head: "glowF", torso: "normal", armL: "flex", armR: "flex", legL: "wide", legR: "wide", prop: false }, { angle: "front", fx: [[1, 0, ["..Y..Y..............Y..Y..", ".Y.YY.Y............Y.YY.Y.", "Y..FF..Y..........Y..FF..Y"]]] }),
      kf({ head: "shout", armL: "up", armR: "up", legL: "wide", legR: "wide", prop: false }, { angle: "front", fx: [[2, 1, ["Y..F..Y..........Y..F..Y"]]] }),
      kf({ head: "happy", armL: "down", armR: "flex", prop: "default" }, { angle: "front", fx: [[4, 4, ["Y......................Y"]]] }),
    ]),
  ],
});

// ============================================================================
// 17. 机长 (女) — 墨镜死光 / 战机拉升 / 塔台狂呼 / 空中炫技 / 气流颠簸
// ============================================================================
const pilotRig = buildCharacterRig({
  gender: "female", hairStyle: "bob", eyeStyle: "shades", coat: "pilot", hatKind: "pilot",
  hatFn(g) { stamp2x(g, 9, 2, ["...AAAAAAAA...", "..AAAYYYYAAA..", ".ddAAAAAAAAAdd", ".OOOOOOOOOOOO."]); },
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
    // 墨镜死光（6大拍→24帧）：侧面拉正机长帽 → 潇洒转身正面 → 抬手敬礼墨镜纯白反光 → 云海飞掠持续定格 → 自信勾唇 → 侧面挥手启航
    clip("salute", "墨镜死光", [175, 160, 145, 150, 155, 180], [
      kf({ head: "normal", armL: "down", armR: "salute", prop: { dx: 0, dy: 0, variant: "cloud" } }, { angle: "side" }),
      kf({ head: "normal", armL: "down", armR: "mid", prop: { dx: 4, dy: 0, variant: "cloud" } }, { angle: "front" }),
      kf({ head: "flash", armL: "back", armR: "salute", prop: { dx: 10, dy: -1, variant: "cloud" } }, { angle: "front" }),
      kf({ head: "flash", torso: "leanL", armL: "back", armR: "salute", prop: { dx: 18, dy: 0, variant: "cloud" } }, { angle: "front", fx: [[4, 10, ["W....................W"]]] }),
      kf({ head: "happy", armL: "down", armR: "salute", prop: { dx: 23, dy: 1, variant: "cloud" } }, { angle: "side" }),
      kf({ head: "happy", armL: "down", armR: "down", prop: false }, { angle: "side" }),
    ]),
    // 战机拉升（6大拍→24帧）：侧面推杆起飞检查 → 推满油门 → 战机拉烟爬升 → 直冲云霄 → 仰头目送 → 正面帅气敬礼
    clip("takeoff", "战机拉升", [165, 150, 135, 135, 155, 180], [
      kf({ head: "normal", armL: "forward", armR: "forwardLow", prop: { dx: 0, dy: 3, variant: "plane" } }, { angle: "side" }),
      kf({ head: "normal", armL: "forward", armR: "mid", prop: { dx: 0, dy: 2, variant: "plane" } }, { angle: "side" }),
      kf({ head: "flash", torso: "leanL", armL: "forward", armR: "up", prop: { dx: 0, dy: -3, variant: "plane" } }, { angle: "side", fx: [[20, 13, ["w"]]] }),
      kf({ head: "happy", torso: "leanL", armL: "mid", armR: "up", legL: "wide", legR: "stand", prop: { dx: -1, dy: -9, variant: "plane" } }, { angle: "side", fx: [[19, 8, ["w"]], [18, 10, ["w"]]] }),
      kf({ head: "happy", armL: "down", armR: "salute", prop: { dx: 1, dy: -12, variant: "plane" } }, { angle: "side" }),
      kf({ head: "flash", armL: "back", armR: "salute", prop: false }, { angle: "front", fx: [[22, 6, ["Y..W"]]] }),
    ]),
    // 塔台狂呼（6大拍→24帧）：侧面轻触耳麦接通 → 认真倾听点头 → 呼叫塔台青色雷达波 → 大声确认全功率扩散 → 收到回复微笑 → 正面比OK
    clip("radio", "塔台狂呼", [170, 155, 145, 145, 155, 180], [
      kf({ head: "normal", armL: "down", armR: "salute", prop: false }, { angle: "side" }),
      kf({ head: { dy: 1, variant: "normal" }, armL: "forward", armR: "salute", prop: false }, { angle: "side", fx: [[24, 9, ["..C.", ".C.C"]]] }),
      kf({ head: "shout", torso: "leanR", armL: "forward", armR: "salute", prop: false }, { angle: "side", fx: [[23, 6, ["...C..", "..C.C.", ".C..C.", "..C..."]]] }),
      kf({ head: "shout", torso: "leanR", armL: "mid", armR: "salute", legL: "stand", legR: "wide", prop: false }, { angle: "side", fx: [[23, 4, ["....C.", "...C.C", "..C..C", ".C..C.", "...C.."]]] }),
      kf({ head: "happy", armL: "down", armR: "salute", prop: false }, { angle: "side", fx: [[24, 8, [".C..", "C.C."]]] }),
      kf({ head: "flash", armL: "down", armR: "up", prop: false }, { angle: "front", fx: [[23, 5, ["..VV", "V.V."]]] }),
    ]),
    // 空中炫技（6大拍→24帧）：左侧面仰望起飞 → 正面抬头看翻滚 → 右侧面追拍尾烟 → 战机俯冲掠过 → 正面欢呼鼓掌 → 酷炫敬礼
    clip("barrel", "空中炫技", [165, 150, 140, 140, 155, 180], [
      kf({ head: "normal", armL: "up", armR: "down", prop: { dx: -19, dy: -3, variant: "plane" } }, { angle: "side", facing: "left" }),
      kf({ head: { dy: -1, variant: "flash" }, armL: "mid", armR: "mid", prop: { dx: -9, dy: -11, variant: "plane" } }, { angle: "front", fx: [[6, 5, ["w.w.Y"]]] }),
      kf({ head: { dy: -1, variant: "happy" }, armL: "down", armR: "up", prop: { dx: 1, dy: -7, variant: "plane", flip: true } }, { angle: "side", facing: "right", fx: [[14, 2, ["w.w.w.w"]]] }),
      kf({ head: "happy", armL: "down", armR: "mid", prop: { dx: 2, dy: 2, variant: "plane", flip: true } }, { angle: "side", facing: "right", fx: [[24, 10, ["Y"]]] }),
      kf({ head: "happy", armL: "up", armR: "up", legL: "step", legR: "stand", prop: false }, { angle: "front", fx: [[4, 3, ["Y....................Y"]]] }),
      kf({ head: "flash", armL: "back", armR: "salute", prop: false }, { angle: "front" }),
    ]),
    // 气流颠簸（6大拍→24帧）：正面遇强风左倾按帽 → 右倾稳下盘 → 剧烈左晃 → 切侧面双手拉杆稳住机身 → 正面云开雾散 → 墨镜反光淡定敬礼
    clip("turbulence", "气流颠簸", [155, 135, 130, 140, 155, 180], [
      kf({ head: { dx: -1, variant: "normal" }, torso: "leanL", armL: "up", armR: "mid", legL: "wide", legR: "wide", prop: false }, { angle: "front", fx: [[24, 6, ["WWWWW", "w...w"]]] }),
      kf({ head: { dx: 1, variant: "normal" }, torso: "leanR", armL: "mid", armR: "salute", legL: "wide", legR: "wide", prop: false }, { angle: "front", fx: [[2, 5, ["WWWWW", "w...w"]]] }),
      kf({ head: { dx: -1, variant: "normal" }, torso: "leanL", armL: "up", armR: "mid", legL: "wide", legR: "wide", prop: false }, { angle: "front", fx: [[23, 4, ["WWWWW"]]] }),
      kf({ head: "shout", torso: "leanL", armL: "forward", armR: "forward", legL: "wide", legR: "wide", prop: false }, { angle: "side", fx: [[2, 7, ["WWWWW"]]] }),
      kf({ head: "flash", armL: "down", armR: "salute", legL: "stand", legR: "stand", prop: false }, { angle: "front", fx: [[4, 4, ["Y......................Y"]]] }),
      kf({ head: "happy", armL: "back", armR: "salute", prop: false }, { angle: "front" }),
    ]),
  ],
});

// ============================================================================
// 18. 工程师 (男) — 电焊级猛拧 / 暴走齿轮 / 一敲修好 / 电钻震动 / 机油溅脸
// ============================================================================
const mechanicRig = buildCharacterRig({
  gender: "male", hairStyle: "short", coat: "overalls", hatKind: "hardhat", extraHeadKinds: ["oil"],
  hatFn(g) { stamp2x(g, 8, 2, ["....YYYYYY....", "..YYYYYYYYYY..", ".YYYYyYYYYYYY.", "YYYYYYYYYYYYYY"]); },
  extraHeads(normal) {
    const oil = clone(normal);
    stamp2x(oil, 10, 10, ["OO.OO..OOO", "OWEOOOWEOO", "OEEOOOEEOO", ".OO..OOOO."], false);
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
    // 电焊级猛拧（6大拍→24帧）：侧面比划螺母找卡口 → 举扳手蓄力 → 发力猛拧火花四溅 → 电焊级火花雨 → 咔哒锁紧 → 转正面擦汗得意笑
    clip("wrench", "电焊级猛拧", [170, 150, 135, 135, 155, 180], [
      kf({ head: { dy: 1, variant: "normal" }, armL: "forward", armR: "mid", prop: "default" }, { angle: "side" }),
      kf({ head: "normal", armL: "down", armR: "up", prop: { dy: -3, variant: "default" } }, { angle: "side", fx: [[23, 8, ["..Y.."]]] }),
      kf({ head: "shout", torso: "leanR", armL: "back", armR: "mid", legL: "wide", legR: "stand", prop: { dy: 1, variant: "default" } }, { angle: "side", fx: [[21, 9, [".Y..F..Y", "..F.Y.F."]]] }),
      kf({ head: "glow", torso: "leanL", armL: "mid", armR: "up", legL: "wide", legR: "wide", prop: { dy: -2, variant: "default" } }, { angle: "side", fx: [[20, 7, ["Y..W..F..Y", ".F.Y.W..F."]]] }),
      kf({ head: "blink", armL: "down", armR: "mid", prop: "default" }, { angle: "side", fx: [[23, 11, ["...Y.."]]] }),
      kf({ head: "happy", armL: "down", armR: "salute", prop: "default" }, { angle: "front", fx: [[22, 6, ["..VV", "V.V."]]] }),
    ]),
    // 暴走齿轮（6大拍→24帧）：正面观察齿轮 → 双手安装起转 → 齿轮超速变红/绿 → 侧面吹走金属屑 → 正面亮绿灯 → 满意托腮
    clip("gears", "暴走齿轮", [170, 150, 135, 135, 155, 180], [
      kf({ head: { dy: 1, variant: "normal" }, armL: "forward", armR: "mid", prop: "gear1" }, { angle: "front" }),
      kf({ head: "normal", armL: "mid", armR: "mid", prop: "gear1" }, { angle: "front" }),
      kf({ head: "glow", torso: "leanR", armL: "up", armR: "mid", prop: "gear2" }, { angle: "front", fx: [[2, 12, [".G.G.", "GGRGG", ".G.G."]]] }),
      kf({ head: "normal", torso: "leanL", armL: "mid", armR: "up", prop: "gear1" }, { angle: "front", fx: [[2, 12, ["G...G", "GGVGG", "G...G"]]] }),
      kf({ head: "blink", armL: "down", armR: "mid", prop: "gear2" }, { angle: "side", fx: [[22, 9, ["w..w"]]] }),
      kf({ head: "happy", armL: "down", armR: "mid", prop: "gear2" }, { angle: "front" }),
    ]),
    // 一敲修好（6大拍→24帧）：侧面皱眉检查故障 → 高举扳手蓄力 → 一锤砸下火花四溅 → 头顶爆出超大绿勾 → 转正面骄傲摊手 → 满意敬礼
    clip("greenlight", "一敲修好", [175, 155, 140, 150, 155, 180], [
      kf({ head: { dy: 1, variant: "blink" }, armL: "forward", armR: "mid", prop: "default" }, { angle: "side", fx: [[23, 12, ["R.R"]]] }),
      kf({ head: "normal", armL: "down", armR: "up", prop: { dy: -4, variant: "default" } }, { angle: "side" }),
      kf({ head: "shout", torso: "leanR", armL: "back", armR: "mid", legL: "stand", legR: "wide", prop: { dy: 2, variant: "default" } }, { angle: "side", fx: [[22, 15, ["Y.F.Y", "Y.F.Y"]]] }),
      kf({ head: "glowV", armL: "up", armR: "salute", prop: false }, { angle: "side", fx: [[22, 3, [".....VV", "....VV.", "...VV..", "V.VV...", "VVV...."]]] }),
      kf({ head: "happy", armL: "mid", armR: "mid", prop: "default" }, { angle: "front", fx: [[22, 4, ["....VV", "...VV.", "V.VV.."]]] }),
      kf({ head: "happy", armL: "down", armR: "salute", prop: "default" }, { angle: "front" }),
    ]),
    // 电钻震动（7大拍→27帧）：侧面试转电钻预热 → 双手紧握顶上 → 高频右震出残影 → 高频左震火花飞 → 再次猛震 → 关机晕乎乎 → 正面抖手回神
    clip("drill", "电钻震动", [165, 120, 115, 115, 120, 155, 180], [
      kf({ head: "normal", armL: "down", armR: "mid", prop: "drill" }, { angle: "side" }),
      kf({ head: { dx: -1, variant: "normal" }, torso: "leanL", armL: "forward", armR: "mid", legL: "wide", legR: "wide", prop: "drill" }, { angle: "side" }),
      kf({ head: { dx: 1, variant: "shout" }, torso: "leanR", armL: { dx: 1, variant: "forward" }, armR: { dx: 1, variant: "mid" }, legL: "wide", legR: "wide", prop: { dx: 1, dy: -1, variant: "drill" } }, { angle: "side", afterimage: { dx: -2, dy: 0, tint: "w" }, fx: [[29, 15, ["Y", "F"]]] }),
      kf({ head: { dx: -1, variant: "shout" }, torso: "leanL", armL: { dx: -1, variant: "forward" }, armR: { dx: -1, variant: "mid" }, legL: "wide", legR: "wide", prop: { dx: -1, dy: 0, variant: "drill" } }, { angle: "side", afterimage: { dx: 2, dy: 0, tint: "w" }, fx: [[29, 16, ["F", "Y"]]] }),
      kf({ head: { dx: 1, variant: "normal" }, torso: "leanR", armL: "forward", armR: "mid", legL: "wide", legR: "wide", prop: { dx: 1, dy: -1, variant: "drill" } }, { angle: "side" }),
      kf({ head: "dizzy", armL: "down", armR: "down", legL: "crouch", legR: "crouch", prop: "drill" }, { angle: "front" }),
      kf({ head: "happy", armL: "mid", armR: "mid", prop: "default" }, { angle: "front" }),
    ]),
    // 机油溅脸（6大拍→24帧）：侧面凑近查管道 → 管道噗噗冒黑泡 → 滋啦喷油惊呼 → 转正面满脸黑油只剩大白眼 → 滴冷汗无奈垂手 → 淡定擦脸微笑
    clip("oil", "机油溅脸", [175, 155, 145, 165, 165, 180], [
      kf({ head: { dy: 1, variant: "normal" }, torso: "leanR", armL: "forward", armR: "mid", prop: "default" }, { angle: "side" }),
      kf({ head: "normal", armL: "down", armR: "mid", prop: "default" }, { angle: "side", fx: [[24, 14, ["OO", "OO"]]] }),
      kf({ head: "shock", torso: "leanL", armL: "up", armR: "mid", legL: "wide", legR: "stand", prop: "default" }, { angle: "side", fx: [[14, 11, ["O..O..OO", ".OO..OOO"]]] }),
      kf({ head: "oil", armL: "down", armR: "down", legL: "crouch", legR: "crouch", prop: "default" }, { angle: "front" }),
      kf({ head: "oil", armL: "mid", armR: "down", prop: "default" }, { angle: "front", fx: [[23, 9, ["C", "C"]]] }),
      kf({ head: "happy", armL: "down", armR: "salute", prop: "default" }, { angle: "front" }),
    ]),
  ],
});

// ============================================================================
// 19. 烘焙师 (女) — 三层巨无霸 / 奶油龙卷风 / 出炉起飞 / 抛面团杂技 / 糖粉雪崩
// ============================================================================
const bakerRig = buildCharacterRig({
  gender: "female", hairStyle: "bob", coat: "apron", hatKind: "bow", extraHeadKinds: ["baker"],
  hatFn(g) { stamp2x(g, 10, 2, ["AA......AA", "AAAaaAAaaa", "AA..aa..AA"]); },
  extraHeads(normal) {
    const cream = clone(normal); stamp2x(cream, 12, 10, ["WW..W"], false);
    const sugar = clone(normal);
    stamp2x(sugar, 8, 2, ["..WWWWWWWWWW..", ".WWWWWWWWWWWW.", ".WWWWWWWWWWWW.", "WWwWWWWWWWWwWW", ".WWWWWWWWWWWW."]);
    fill(sugar, 21, 22, 6, 5, "S"); fill(sugar, 37, 22, 6, 5, "S");
    stamp(sugar, 22, 22, ["WWWW", "WEEW", "WEEW", "WWWW"]);
    stamp(sugar, 38, 22, ["WWWW", "WEEW", "WEEW", "WWWW"]);
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
    // 三层巨无霸（6大拍→24帧）：侧面精心点缀一层 → 堆出二层 → 冲天三层巨无霸发光 → 放上红樱桃大功告成 → 转正面得意展示 → 开心眨眼
    clip("frosting", "三层巨无霸", [170, 155, 150, 150, 160, 180], [
      kf({ head: "normal", armL: "down", armR: "mid", prop: "default" }, { angle: "side", fx: [[23, 11, [".M..", "...Y"]]] }),
      kf({ head: "happy", torso: "leanL", armL: "mid", armR: "mid", prop: "cake2" }, { angle: "side" }),
      kf({ head: "glowM", torso: "leanL", armL: "up", armR: "up", legL: "step", legR: "stand", prop: "cake3" }, { angle: "side", fx: [[20, 3, ["Y.....Y"]]] }),
      kf({ head: "happy", armL: "mid", armR: "up", prop: "cake3" }, { angle: "front", fx: [[19, 2, ["Y..M..Y"]]] }),
      kf({ head: "happy", armL: "down", armR: "mid", prop: "cake2" }, { angle: "front", fx: [[23, 7, [".Y.M."]]] }),
      kf({ head: "blink", armL: "down", armR: "mid", prop: "default" }, { angle: "front" }),
    ]),
    // 奶油龙卷风（6大拍→24帧）：侧面稳稳打蛋起手 → 加速打成龙卷风 → 奶油飞溅转正面糊脸 → 惊讶眨眼 → 偷尝一口觉得超甜 → 笑开花
    clip("whisk", "奶油龙卷风", [165, 135, 130, 150, 160, 180], [
      kf({ head: "normal", armL: "forward", armR: { dy: -1, variant: "mid" }, prop: "whisk" }, { angle: "side" }),
      kf({ head: "normal", torso: "leanR", armL: "forward", armR: { dx: 1, dy: 1, variant: "mid" }, prop: { dy: -1, variant: "whisk" } }, { angle: "side", fx: [[2, 4, ["W..W..................W.W"]]] }),
      kf({ head: "cream", torso: "leanL", armL: "mid", armR: "up", prop: { dy: -2, variant: "whisk" } }, { angle: "front", fx: [[1, 3, ["..W..W.............W.WWW"]]] }),
      kf({ head: "cream", armL: "down", armR: "mid", prop: "whisk" }, { angle: "front" }),
      kf({ head: "happy", armL: "down", armR: "salute", prop: "whisk" }, { angle: "side", fx: [[22, 8, ["M.M", "MMM"]]] }),
      kf({ head: "happy", armL: "down", armR: "mid", prop: "default" }, { angle: "front" }),
    ]),
    // 出炉起飞（6大拍→24帧）：背面开烤箱端出热面包 → 侧面闻香陶醉 → 转正面兴奋踮脚左踩 → 右踩满屏粉红爱心 → 开心展示 → 微笑鞠躬
    clip("fresh", "出炉起飞", [175, 160, 150, 150, 155, 180], [
      kf({ head: "normal", armL: "down", armR: "mid", prop: "bread" }, { angle: "back", fx: [[22, 12, [".W.W."]]] }),
      kf({ head: "happy", armL: "up", armR: "up", legL: "step", legR: "stand", prop: { dy: -4, variant: "bread" } }, { angle: "side", fx: [[2, 1, [".M.M....................M.M", ".MMM....................MMM"]]] }),
      kf({ head: "happy", armL: "up", armR: "up", legL: "stand", legR: "step", prop: { dy: -5, variant: "bread" } }, { angle: "front", fx: [[1, 0, ["Y.M.M..................M.M.Y", "..MMM..................MMM.."]]] }),
      kf({ head: "glowM", armL: "up", armR: "up", legL: "step", legR: "stand", prop: { dy: -4, variant: "bread" } }, { angle: "front", fx: [[2, 1, ["M.M..................M.M"]]] }),
      kf({ head: "happy", armL: "down", armR: "mid", prop: "bread" }, { angle: "front", fx: [[23, 10, ["Y..M"]]] }),
      kf({ head: "blink", armL: "down", armR: "mid", prop: "bread" }, { angle: "front" }),
    ]),
    // 抛面团杂技（6大拍→24帧）：正面搓圆蓄力 → 猛抛上天切侧面仰望 → 背面360°炫技转身 → 侧面左转张手准备 → 正面稳稳接住 → 骄傲托盘
    clip("dough", "抛面团杂技", [170, 150, 145, 145, 155, 180], [
      kf({ head: "normal", armL: "forward", armR: "forward", prop: { dy: 11, variant: "dough" } }, { angle: "front" }),
      kf({ head: { dy: -1, variant: "happy" }, armL: "up", armR: "up", prop: { dy: 0, variant: "dough" } }, { angle: "side", facing: "right" }),
      kf({ head: { dy: -1, variant: "glow" }, armL: { dy: -1, variant: "up" }, armR: { dy: -1, variant: "up" }, legL: "step", legR: "stand", prop: { dy: -2, variant: "dough", flip: true } }, { angle: "back", fx: [[4, 2, ["Y....................Y"]]] }),
      kf({ head: "happy", armL: "mid", armR: "mid", prop: { dy: 4, variant: "dough" } }, { angle: "side", facing: "left" }),
      kf({ head: "happy", armL: "forward", armR: "forward", prop: { dy: 10, variant: "dough" } }, { angle: "front", fx: [[6, 5, ["Y..............Y"]]] }),
      kf({ head: "happy", armL: "down", armR: "up", prop: "default" }, { angle: "front" }),
    ]),
    // 糖粉雪崩（6大拍→24帧）：侧面优雅轻撒糖粉 → 手抖倾泻糖粉雪崩 → 正面惊呼躲不及 → 变成雪人糖粉造型 → 无奈抖抖头 → 憨笑递蛋糕
    clip("sugar", "糖粉雪崩", [175, 150, 155, 175, 160, 180], [
      kf({ head: "happy", armL: "down", armR: "up", prop: false }, { angle: "side", fx: [[10, 0, ["W.W.W.W.W"]]] }),
      kf({ head: "shock", armL: "mid", armR: "up", prop: false }, { angle: "front", fx: [[7, 1, ["W.W.W.W.W.W.W.W", ".W.W.W.W.W.W.W.", "W.W.W.W.W.W.W.W"]]] }),
      kf({ head: "sugar", armL: "down", armR: "down", legL: "crouch", legR: "crouch", prop: false }, { angle: "front" }),
      kf({ head: "sugar", armL: "mid", armR: "mid", prop: false }, { angle: "side", fx: [[8, 4, ["w..W..w..W"]]] }),
      kf({ head: "sugar", armL: "mid", armR: "mid", prop: "default" }, { angle: "front" }),
      kf({ head: "happy", armL: "down", armR: "mid", prop: "default" }, { angle: "front" }),
    ]),
  ],
});

// ============================================================================
// 20. 忍者 (男) — 暴雨手里剑 / 砰！烟雾遁 / 影分身瞬步 / 替身术木桩 / 豪火球之术
// ============================================================================
const ninjaRig = buildCharacterRig({
  gender: "male", coat: "ninja", customKind: "ninja",
  customHead() {
    const g = blank();
    fill(g, 18, 10, 28, 24, "N");
    fill(g, 18, 10, 2, 2, "."); fill(g, 44, 10, 2, 2, ".");
    fill(g, 20, 20, 24, 8, "S");
    stamp(g, 22, 22, ["WWEE", "WEEE", "EEEE", "EEkE"]);
    stamp(g, 38, 22, ["WWEE", "WEEE", "EEEE", "EEkE"]);
    fill(g, 20, 28, 24, 6, "N");
    fill(g, 18, 16, 28, 4, "A"); fill(g, 26, 16, 12, 4, "G"); fill(g, 29, 16, 4, 2, "W");
    stamp2x(g, 3, 8, ["aAAd..", "aA....", "a....."]);
    return g;
  },
  extraHeads(normal) {
    const scarfUp = clone(normal);
    stamp2x(scarfUp, 3, 7, ["aAAd..", "a.....", "______", "______"]);
    const glowRed = clone(normal);
    fill(glowRed, 22, 22, 4, 4, "R"); fill(glowRed, 38, 22, 4, 4, "R");
    px(glowRed, 23, 23, "Y"); px(glowRed, 39, 23, "Y");
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
    // 暴雨手里剑（6大拍→24帧）：侧面指尖转镖热身 → 弓步拉满蓄力 → 甩出暴雨手里剑 → 红眼二连发 → 酷炫收势飘带扬起 → 转正面抱手待命
    clip("shuriken", "暴雨手里剑", [165, 145, 130, 130, 150, 175], [
      kf({ head: "normal", armL: "down", armR: "mid", prop: "default" }, { angle: "side" }),
      kf({ head: "scarfUp", torso: "leanL", armL: "back", armR: "up", legL: "wide", legR: "stand", prop: { dx: 0, dy: -5, variant: "shurikenX" } }, { angle: "side" }),
      kf({ head: "normal", torso: "leanR", armL: "back", armR: "mid", legL: "stand", legR: "wide", prop: "shurikenBarrage" }, { angle: "side" }),
      kf({ head: "glowRed", torso: "leanR", armL: "forward", armR: "mid", legL: "stand", legR: "wide", prop: { dx: 2, dy: -2, variant: "shurikenBarrage" } }, { angle: "side" }),
      kf({ head: "scarfUp", armL: "down", armR: "mid", prop: "shurikenX" }, { angle: "side" }),
      kf({ head: "normal", armL: "forward", armR: "forward", prop: "default" }, { angle: "front" }),
    ]),
    // 砰！烟雾遁（7大拍→27帧）：正面双手结印 → 眼神放光蓄气 → 砰！炸成白烟团 → 烟雾中睁开红眼 → 烟散背面霸气现身 → 转侧面持镖 → 正面酷炫归位
    clip("smoke", "砰！烟雾遁", [165, 140, 135, 170, 160, 155, 175], [
      kf({ head: "normal", armL: "forward", armR: "forward", prop: false }, { angle: "front" }),
      kf({ head: "glow", armL: "forward", armR: "forward", prop: false }, { angle: "front", fx: [[12, 16, ["Y.C.Y"]]] }),
      kf({ head: false, torso: false, armL: false, armR: false, legL: false, legR: false, prop: "smokeBig" }, { angle: "front", fx: [[4, 3, ["Y....................Y"]], [5, 19, ["Y..................Y"]]] }),
      kf({ head: false, torso: false, armL: false, armR: false, legL: false, legR: false, prop: "smokeEyes" }, { angle: "front" }),
      kf({ head: "scarfUp", armL: "mid", armR: "mid", legL: "wide", legR: "wide", prop: "default" }, { angle: "back", fx: [[3, 4, ["w....w..............w....w"]]] }),
      kf({ head: "normal", armL: "down", armR: "mid", prop: "shurikenX" }, { angle: "side" }),
      kf({ head: "normal", armL: "down", armR: "down", prop: "default" }, { angle: "front" }),
    ]),
    // 影分身瞬步（8大拍→30帧，旗舰多视角大秀）：正面结印压低蓄力 → 左侧面残影瞬步 → 右侧面红眼反冲 → 正面双影分身定格 → 腾空十字飞镖 → 背面霸气落地亮背刀 → 侧面回眸甩冷镖 → 正面冷静收招
    clip("shadowstep", "影分身瞬步", [175, 130, 125, 135, 130, 155, 145, 180], [
      kf({ head: { dy: 1, variant: "normal" }, torso: "leanL", armL: "forward", armR: "forward", legL: "crouch", legR: "crouch", prop: false }, { angle: "front" }),
      kf({ head: { dx: -2, variant: "scarfUp" }, torso: { dx: -2, variant: "leanR" }, armL: { dx: -2, variant: "back" }, armR: { dx: -2, variant: "forward" }, legL: { dx: -2, variant: "step" }, legR: { dx: -2, variant: "kick" }, prop: false }, { angle: "side", facing: "left", afterimage: { dx: 7, dy: 0, tint: "c" } }),
      kf({ head: { dx: 2, variant: "glowRed" }, torso: { dx: 2, variant: "leanR" }, armL: { dx: 2, variant: "forward" }, armR: { dx: 2, variant: "back" }, legL: { dx: 2, variant: "kick" }, legR: { dx: 2, variant: "step" }, prop: false }, { angle: "side", facing: "right", afterimage: { dx: -7, dy: 0, tint: "c" }, fx: [[3, 4, ["..V......v.."]]] }),
      kf({ head: "normal", torso: "normal", armL: "mid", armR: "mid", legL: "wide", legR: "wide", prop: "default" }, { angle: "front", afterimage: [{ dx: -6, dy: 0, tint: "c" }, { dx: 6, dy: 0, tint: "w" }], fx: [[1, 14, ["CCCCCC................CCCCCC"]]] }),
      kf({ head: { dy: -2, variant: "glowRed" }, torso: { dy: -2, variant: "normal" }, armL: { dy: -2, variant: "up" }, armR: { dy: -2, variant: "up" }, legL: { dy: -2, variant: "kick" }, legR: { dy: -2, variant: "step" }, prop: { dy: -3, variant: "shurikenBarrage" } }, { angle: "front", shadow: "tiny", afterimage: { dx: 0, dy: 4, tint: "c" } }),
      kf({ head: { dx: -1, variant: "scarfUp" }, torso: { dx: -1, variant: "leanL" }, armL: { dx: -1, variant: "mid" }, armR: { dx: -1, variant: "mid" }, legL: { dx: -1, variant: "wide" }, legR: { dx: -1, variant: "wide" }, prop: "shurikenX" }, { angle: "back", afterimage: { dx: 6, dy: 0, tint: "w" } }),
      kf({ head: "scarfUp", torso: "leanR", armL: "back", armR: "mid", legL: "wide", legR: "stand", prop: "shurikenX" }, { angle: "side", facing: "right", fx: [[25, 16, ["C.W"]]] }),
      kf({ head: "normal", armL: "down", armR: "down", legL: "stand", legR: "stand", prop: "default" }, { angle: "front" }),
    ], { targetFrames: 30 }),
    // 替身术木桩（7大拍→27帧）：正面察觉偷袭眼神一凛 → 结印爆白烟 → 留下萌木桩左晃 → 木桩右晃滴冷汗 → 侧面现身偷笑 → 耍帅扔镖 → 正面淡定归位
    clip("log", "替身术木桩", [165, 130, 175, 175, 155, 145, 175], [
      kf({ head: "glow", armL: "forward", armR: "forward", prop: false }, { angle: "front" }),
      kf({ head: false, torso: false, armL: false, armR: false, legL: false, legR: false, prop: "smokeBig" }, { angle: "front", fx: [[6, 6, ["Y................Y"]]] }),
      kf({ head: false, torso: false, armL: false, armR: false, legL: false, legR: false, prop: { dx: 0, dy: 0, variant: "log" } }, { angle: "front", fx: [[22, 13, ["w.w", ".w."]]] }),
      kf({ head: false, torso: false, armL: false, armR: false, legL: false, legR: false, prop: { dx: 0, dy: 1, variant: "log", flip: true } }, { angle: "front", fx: [[6, 12, ["C", "C"]]] }),
      kf({ head: "scarfUp", armL: "mid", armR: "down", prop: "default" }, { angle: "side", fx: [[5, 5, ["w....................w"]]] }),
      kf({ head: "normal", armL: "back", armR: "mid", prop: "shurikenX" }, { angle: "side" }),
      kf({ head: "normal", armL: "down", armR: "down", prop: "default" }, { angle: "front" }),
    ]),
    // 豪火球之术（6大拍→24帧）：侧面胸前结印蓄火 → 深吸气后仰 → 吐出初段火球 → 爆发超级巨型豪火球后退 → 火球余烬飘散 → 飘带飞扬正面收势
    clip("fireball", "豪火球之术", [165, 150, 140, 145, 155, 180], [
      kf({ head: "normal", armL: "forward", armR: "forward", legL: "wide", legR: "wide", prop: false }, { angle: "side" }),
      kf({ head: "glowF", torso: "leanL", armL: "forward", armR: "forward", legL: "wide", legR: "wide", prop: false }, { angle: "side" }),
      kf({ head: { dx: -2, variant: "glowF" }, torso: { dx: -2, variant: "leanL" }, armL: { dx: -2, variant: "forward" }, armR: { dx: -2, variant: "forward" }, legL: { dx: -2, variant: "wide" }, legR: { dx: -2, variant: "wide" }, prop: "fireSmall" }, { angle: "side" }),
      kf({ head: { dx: -3, variant: "glowRed" }, torso: { dx: -3, variant: "leanL" }, armL: { dx: -3, variant: "mid" }, armR: { dx: -3, variant: "forward" }, legL: { dx: -3, variant: "wide" }, legR: { dx: -3, variant: "wide" }, prop: "fireHuge" }, { angle: "side" }),
      kf({ head: { dx: -2, variant: "scarfUp" }, torso: { dx: -2, variant: "leanL" }, armL: { dx: -2, variant: "down" }, armR: { dx: -2, variant: "mid" }, legL: { dx: -2, variant: "wide" }, legR: { dx: -2, variant: "stand" }, prop: { dx: 2, dy: 2, variant: "fireSmall" } }, { angle: "side" }),
      kf({ head: "scarfUp", armL: "down", armR: "down", prop: "default" }, { angle: "front" }),
    ]),
  ],
});

export const ROLES_B = { teacher, gardener, photographer, courier, wizard, athlete, pilot, mechanic, baker, ninja };
