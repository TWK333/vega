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
    extinguisher: partPatch(21, 16, ["..g.", "RRRR", "RRRR", "RRRR"]),
  },
  sideProps: {
    default: partPatch(19, 17, ["......gg", ".....gCg", "....gCVg", "....gCWg", "gggggggg", ".gggggg."], false),
    laptopGreen: partPatch(19, 17, ["......gg", ".....gVg", "....gVWg", "....gVVg", "gggggggg", ".gggggg."], false),
    laptopFire: partPatch(19, 17, ["......gg", ".....gFg", "....gFYg", "....gFRg", "gggggggg", ".gggggg."], false),
  },
});
const coder = makeRiggedSprite({
  id: "coder", name: "程序员", gender: "male",
  palette: makePalette(SKIN.peach, { H: "#3b2c25", h: "#664d40", k: "#241914" }),
  rig: coderRig,
  idleKeyframe: kf({ armL: "forward", armR: "forward", prop: "default" }),
  animations: [
    // 敲到冒火（8大拍→30帧）：正面伸懒腰活动手指 → 俯身就位 → 切侧面过肩绿屏狂敲 → 火星四起 → 烈焰暴走 → 正面惊呼后仰 → 侧面抄起灭火器狂喷白烟扑火 → 正面冒烟擦汗眨眼
    clip("typing", "敲到冒火", [190, 150, 130, 120, 115, 145, 160, 190], [
      kf({ head: { dy: -1, variant: "happy" }, armL: "up", armR: "up", prop: false }, { angle: "front", fx: [[8, 2, ["Y..............Y"]]] }),
      kf({ head: { dy: 0, variant: "normal" }, armL: "forwardLow", armR: "forwardLow", prop: "default" }, { angle: "front" }),
      kf({ head: { dy: 1, variant: "normal" }, torso: "leanR", armL: { dy: -1, variant: "forward" }, armR: { dy: 1, variant: "forward" }, prop: "laptopGreen" }, { angle: "side", fx: [[19, 4, ["V....V"]]] }),
      kf({ head: { dy: 1, variant: "glowF" }, torso: "leanR", armL: { dy: 1, variant: "forwardHigh" }, armR: { dy: -1, variant: "forward" }, prop: { dy: -1, variant: "laptopFire" } }, { angle: "side", fx: [[18, 12, ["..F...F..", ".FYF.FYF.", "FFYFFYFF."]]] }),
      kf({ head: { dy: 0, variant: "glowF" }, torso: "leanR", armL: { dx: 1, dy: -1, variant: "forward" }, armR: { dx: -1, dy: 1, variant: "forwardHigh" }, prop: { dy: 0, variant: "laptopFire" } }, { angle: "side", fx: [[17, 10, ["...Y..F..Y.", "..FYRFFRYF.", ".FFYYYYYYFF", ".FRRYYYYRRF"]], [8, 1, ["F...V....Y...F"]]] }),
      kf({ head: { dy: -1, variant: "shock" }, torso: "leanL", armL: "highOut", armR: "highOut", legL: "wide", legR: "wide", prop: { dy: -1, variant: "laptopFire" } }, { angle: "front", fx: [[11, 13, ["...F..Y..F..", "..FFYYYYFF.."]], [8, 0, ["Y....F....V"]]] }),
      kf({ head: "shout", torso: "leanL", armL: "forward", armR: "mid", legL: "wide", legR: "wide", prop: "extinguisher" }, { angle: "side", fx: [[22, 12, ["..WWWWWW..", ".WWWWWWWW.", "wWWWWWWWWw"]]] }),
      kf({ head: { dy: 0, variant: "blink" }, armL: "forward", armR: "forward", prop: "default" }, { angle: "front", fx: [[11, 16, [".w...w...w..", "..w....w...."]]] }),
    ], { targetFrames: 30 }),
    // 咖啡续命（7大拍→27帧）：侧面犯困低头打哈欠 → 闻到香气抬头 → 仰头豪饮 → 蓝光冲脑 → 正面悬浮通电觉醒 → 潇洒甩杯 → 满血点赞
    clip("coffee", "咖啡续命", [185, 165, 150, 140, 145, 155, 185], [
      kf({ head: { dy: 1, variant: "dizzy" }, torso: "leanL", armL: "down", armR: "down", legL: "crouch", legR: "crouch", prop: false }, { angle: "side", fx: [[21, 7, ["z..Z"]]] }),
      kf({ head: "normal", armL: "down", armR: "mid", prop: { dx: 0, dy: 0, variant: "coffee" } }, { angle: "side", fx: [[23, 14, [".W.", "..W"]]] }),
      kf({ head: { dy: 1, variant: "blink" }, torso: "leanL", armL: "back", armR: { dx: -1, dy: -2, variant: "salute" }, prop: { dx: -3, dy: -4, variant: "coffee" } }, { angle: "side", fx: [[21, 10, [".W..W."]]] }),
      kf({ head: { dy: -1, variant: "glowC" }, torso: "leanR", armL: "mid", armR: "up", legL: "wide", legR: "wide", prop: { dx: 1, dy: -5, variant: "coffee" } }, { angle: "side", fx: [[8, 0, ["..W..W....W..W..", ".W....W..W....W."]]] }),
      kf({ head: { dy: -2, variant: "flash" }, torso: { dy: -1, variant: "normal" }, armL: "up", armR: "up", legL: { dy: -1, variant: "step" }, legR: { dy: -1, variant: "step" }, prop: false }, { angle: "front", shadow: "shrink", fx: [[5, 0, ["C...W....Y....W...C", "..Y..W..CCC..W..Y.."]]] }),
      kf({ head: "happy", torso: "leanR", armL: "mid", armR: "up", prop: { dx: 0, dy: -4, variant: "coffee" } }, { angle: "side", fx: [[22, 8, ["Y.C.Y"]]] }),
      kf({ head: "happy", armL: "down", armR: "mid", prop: { dx: 0, dy: -1, variant: "coffee" } }, { angle: "front", fx: [[24, 13, ["W.Y."]]] }),
    ]),
    // 全绿庆祝（6大拍→24帧）：侧面紧张盯进度条祈祷 → 绿屏闪亮 → 侧面跃起欢呼 → 背面360°抛彩带 → 正面振臂高呼 → 微笑擦汗
    clip("deploy", "全绿庆祝", [180, 165, 145, 145, 150, 180], [
      kf({ head: { dy: 1, variant: "blink" }, armL: "forwardLow", armR: "forwardLow", prop: "default" }, { angle: "side", fx: [[21, 9, ["C..C"]]] }),
      kf({ head: "flash", armL: "forward", armR: "forward", prop: "laptopGreen" }, { angle: "front", fx: [[12, 16, ["VVVV"]]] }),
      kf({ head: { dy: -1, variant: "flash" }, armL: "up", armR: "up", legL: "step", legR: "stand", prop: "laptopGreen" }, { angle: "side", fx: [[3, 1, ["Y..M....V....C..Y", ".C.............M."]]] }),
      kf({ head: { dy: -1, variant: "happy" }, torso: "leanR", armL: { dy: -1, variant: "up" }, armR: { dy: -1, variant: "up" }, legL: "stand", legR: "step", prop: false }, { angle: "back", fx: [[1, 0, ["Y.M..Y......Y..C.Y", "..C....VVVV....M.."]]] }),
      kf({ head: "flash", armL: "mid", armR: "up", prop: "laptopGreen" }, { angle: "front", fx: [[4, 2, ["Y....C....M....Y"]]] }),
      kf({ head: "happy", armL: "down", armR: "salute", prop: "laptopGreen" }, { angle: "front", fx: [[23, 8, ["..VV", "V.V.", ".V.."]]] }),
    ]),
    // 蓝屏瘫倒（7大拍→27帧）：侧面自信回车 → 突然蓝屏正面惊呆 → 石化下蹲 → 灵魂出窍飘走 → 歪头石化 → 侧面狂按重启键 → 正面重启擦汗
    clip("bsod", "蓝屏瘫倒", [165, 175, 165, 180, 190, 150, 180], [
      kf({ head: "happy", torso: "leanR", armL: "forward", armR: "forwardHigh", prop: "default" }, { angle: "side" }),
      kf({ head: "shock", armL: "mid", armR: "mid", prop: "laptopBsod" }, { angle: "front" }),
      kf({ head: { dy: 1, variant: "shock" }, torso: { dy: 1, variant: "normal" }, armL: { dy: 1, variant: "down" }, armR: { dy: 1, variant: "down" }, legL: "crouch", legR: "crouch", prop: "laptopBsod" }, { angle: "front", petrify: true, fx: [[23, 6, [".WW.", "WWWW", ".WW."]]] }),
      kf({ head: { dy: 2, variant: "dizzy" }, torso: { dy: 1, variant: "leanL" }, armL: { dy: 2, variant: "down" }, armR: { dy: 2, variant: "down" }, legL: "crouch", legR: "crouch", prop: "laptopBsod" }, { angle: "front", petrify: true, fx: [[22, 2, [".WWW.", "WWWWW", "WEWEW", "W.W.W"]]] }),
      kf({ head: { dy: 2, variant: "dizzy" }, torso: { dy: 2, variant: "leanL" }, armL: { dy: 2, variant: "down" }, armR: { dy: 2, variant: "down" }, legL: "crouch", legR: "crouch", prop: "laptopBsod" }, { angle: "front", petrify: true, fx: [[21, 0, [".WWW.", "WEWEW", "WWWWW", "W.W.W"]], [5, 11, ["C", "C"]]] }),
      kf({ head: "shout", torso: "leanR", armL: "forward", armR: "forwardHigh", prop: "default" }, { angle: "side", fx: [[22, 13, ["Y.C.Y"]]] }),
      kf({ head: "blink", armL: "down", armR: "down", prop: "default" }, { angle: "front", fx: [[23, 8, ["C", "C"]]] }),
    ]),
    // 疯狂抓虫（7大拍→27帧）：背面突感背脊发凉 → 转侧面右顾发现红Bug → 蓄力高举 → 猛拍爆火花 → 翻转左向补拍 → 正面高举拍子庆祝 → 绿勾收势
    clip("debug", "疯狂抓虫", [170, 145, 130, 125, 135, 145, 175], [
      kf({ head: "shock", armL: "mid", armR: "mid", prop: false }, { angle: "back", fx: [[15, 2, ["R", "R", ".", "R"]]] }),
      kf({ head: "shock", armL: "back", armR: "mid", prop: { dx: 1, dy: 2, variant: "swatter" } }, { angle: "side", facing: "right", fx: [[25, 16, ["R.R", "RRR", "R.R"]]] }),
      kf({ head: "shout", torso: "leanL", armL: "mid", armR: "up", legL: "wide", legR: "stand", prop: { dx: 0, dy: -3, variant: "swatter" } }, { angle: "side", facing: "right", fx: [[25, 14, ["R.R", "RRR", "R.R"]]] }),
      kf({ head: "shout", torso: "leanR", armL: "back", armR: { dx: 1, dy: 1, variant: "mid" }, legL: "stand", legR: "wide", prop: { dx: 1, dy: 5, variant: "swatter" } }, { angle: "side", facing: "right", fx: [[22, 14, ["Y.F.Y", "FWRWF", "Y.F.Y"]]] }),
      kf({ head: "glow", torso: "leanL", armL: "mid", armR: "up", prop: { dx: 0, dy: -2, variant: "swatter" } }, { angle: "side", facing: "left", fx: [[5, 11, ["Y...Y", ".F.F.", "..R.."]]] }),
      kf({ head: "happy", armL: "up", armR: "up", legL: "step", legR: "stand", prop: { dx: 0, dy: -2, variant: "swatter" } }, { angle: "front", fx: [[24, 8, ["...VV", "..VV.", "V.VV.", ".VV.."]]] }),
      kf({ head: "happy", armL: "down", armR: "mid", prop: "default" }, { angle: "front" }),
    ]),
  ],
});

// 2. 医生 (女) — 听诊弹飞 / 狂写病历 / 巨型针筒 / 电击除颤 / 挂瓶回血
const doctorRig = buildCharacterRig({
  gender: "female", hairStyle: "ponytail", coat: "labcoat", hatKind: "nurse", torsoDetail: "stethoscope",
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
    bandaid: partPatch(21, 16, ["bbbbbb", "bWWWWb", "bbbbbb"], false),
  },
});
const doctor = makeRiggedSprite({
  id: "doctor", name: "医生", gender: "female",
  palette: makePalette(SKIN.fair, { H: "#5c3828", h: "#8f5b43", k: "#3b2116" }),
  rig: doctorRig,
  idleKeyframe: kf({ prop: false }),
  animations: [
    // 听诊弹飞（7大拍→27帧）：侧面礼貌鞠躬准备 → 凑近听诊 → 病人心跳暴走弹飞 → 正面惊吓仰望 → 侧面急冲稳稳接住 → 贴爱心安抚 → 正面安心微笑
    clip("heartbeat", "听诊弹飞", [175, 165, 135, 140, 145, 155, 180], [
      kf({ head: { dy: 1, variant: "happy" }, torso: "leanR", armL: "down", armR: "forwardLow", prop: { dx: 0, dy: 0, variant: "patient" } }, { angle: "side" }),
      kf({ head: "normal", armL: "down", armR: "mid", prop: { dx: 0, dy: 0, variant: "patient" } }, { angle: "side" }),
      kf({ head: "shock", torso: "leanL", armL: "mid", armR: "mid", legL: "wide", legR: "stand", prop: { dx: 0, dy: -8, variant: "patientShock" } }, { angle: "side", fx: [[22, 16, [".RR.RR.", "RRRRRRR", ".RRRRR.", "..RRR.."]]] }),
      kf({ head: { dy: -1, variant: "shock" }, torso: "leanL", armL: "up", armR: "up", legL: "wide", legR: "wide", prop: { dx: 0, dy: -14, variant: "patientShock" } }, { angle: "front", fx: [[21, 13, ["Y.RR.RR.Y", ".RRRRRRR.", ".RRWWRRR.", "..RRRRR.."]]] }),
      kf({ head: "shout", torso: "leanR", armL: "forward", armR: "forwardHigh", legL: "step", legR: "stand", prop: { dx: 0, dy: -5, variant: "patient" } }, { angle: "side", fx: [[24, 19, ["R.R", "RRR", ".R."]]] }),
      kf({ head: "happy", armL: "down", armR: "mid", prop: { dx: 0, dy: 0, variant: "patient" } }, { angle: "side", fx: [[25, 12, ["R.R", "RRR", ".R."]]] }),
      kf({ head: "happy", armL: "down", armR: "salute", prop: false }, { angle: "front", fx: [[24, 9, ["R.R", "RRR", ".R."]]] }),
    ]),
    // 狂写病历（6大拍→24帧）：侧面深吸气甩手腕 → 伏案疾书 → 病历纸满天飞 → 狂草暴走 → 转正面亮绿勾盖章 → 满意抱板
    clip("chart", "狂写病历", [175, 155, 135, 135, 155, 180], [
      kf({ head: "blink", armL: "forward", armR: "up", prop: "chart" }, { angle: "side" }),
      kf({ head: { dy: 1, variant: "normal" }, armL: "forward", armR: { dx: -1, dy: 0, variant: "mid" }, prop: "chart" }, { angle: "side" }),
      kf({ head: { dy: 1, variant: "normal" }, torso: "leanR", armL: "forward", armR: { dx: 1, dy: -1, variant: "mid" }, prop: { dy: -1, variant: "chart" } }, { angle: "side", fx: [[2, 2, ["WWW...................WWW", "Wgg...................ggW"]]] }),
      kf({ head: { dy: 0, variant: "glow" }, torso: "leanL", armL: "forward", armR: { dx: -1, dy: -1, variant: "forward" }, prop: { dy: 0, variant: "chart" } }, { angle: "side", fx: [[1, 1, ["..WWW.......WWW.....WWW..", "..Wgg.......ggW.....Wgg.."]]] }),
      kf({ head: "happy", armL: "down", armR: "up", prop: "chart" }, { angle: "front", fx: [[22, 4, ["...VV", "..VV.", "V.VV.", ".VV.."]]] }),
      kf({ head: "blink", armL: "forward", armR: "mid", prop: "chart" }, { angle: "side", fx: [[2, 5, ["WWW...................WWW"]]] }),
    ]),
    // 巨型针筒（6大拍→24帧）：侧面举针弹管排气滋水珠 → 蓄力拉栓 → 侧面猛推 → 正面绿光爆闪 → 送上可爱创可贴 → 眨眼微笑
    clip("remedy", "巨型针筒", [175, 160, 145, 150, 160, 180], [
      kf({ head: "normal", armL: "forward", armR: "mid", prop: { dx: 0, dy: 2, variant: "syringe" } }, { angle: "side", fx: [[23, 5, [".C.", "C.."]]] }),
      kf({ head: "normal", torso: "leanR", armL: "down", armR: "mid", prop: { dx: 0, dy: 3, variant: "syringe" } }, { angle: "side" }),
      kf({ head: "glowV", torso: "leanL", armL: "mid", armR: "up", legL: "wide", legR: "stand", prop: { dx: 0, dy: -3, variant: "syringe" } }, { angle: "side", fx: [[20, 1, ["V...C...V"]]] }),
      kf({ head: "glowV", torso: "leanL", armL: "up", armR: { dy: -1, variant: "up" }, legL: "wide", legR: "wide", prop: { dx: 0, dy: -5, variant: "syringe" } }, { angle: "front", fx: [[2, 4, ["V.V", "VVV", ".V."]], [21, 0, ["V.C.V"]]] }),
      kf({ head: "happy", armL: "down", armR: "mid", prop: "bandaid" }, { angle: "front", fx: [[22, 11, ["Y...Y"]]] }),
      kf({ head: "blink", armL: "down", armR: "down", prop: "bandaid" }, { angle: "front" }),
    ]),
    // 电击除颤（6大拍→24帧）：正面摩擦电极板预热充电 → 大喊Clear → 双臂弯举电弧狂闪 → 高举纯白爆闪 → 侧面擦汗比OK → 微笑收板
    clip("defib", "电击除颤", [170, 155, 135, 140, 155, 180], [
      kf({ head: "normal", armL: "forward", armR: "forward", prop: "defib" }, { angle: "front", fx: [[12, 13, ["C.Y.C"]]] }),
      kf({ head: "shout", armL: "mid", armR: "mid", prop: "defib" }, { angle: "front", fx: [[2, 13, ["Y.C"]], [26, 13, ["C.Y"]]] }),
      kf({ head: "glowC", torso: "normal", armL: "flex", armR: "flex", legL: "wide", legR: "wide", prop: { dy: -3, variant: "defib" } }, { angle: "front", fx: [[2, 11, ["Y.C.Y"]], [25, 11, ["Y.C.Y"]], [8, 5, ["C...Y...C...Y...C"]]] }),
      kf({ head: "flash", armL: "up", armR: "up", legL: "wide", legR: "wide", prop: { dy: -5, variant: "defib" } }, { angle: "front", fx: [[6, 1, ["..C..Y..W..Y..C..", ".Y.............Y."]]] }),
      kf({ head: "happy", armL: "down", armR: "salute", prop: false }, { angle: "side", fx: [[23, 8, ["..VV", "V.V."]]] }),
      kf({ head: "blink", armL: "down", armR: "down", prop: "defib" }, { angle: "front" }),
    ]),
    // 挂瓶回血（6大拍→24帧）：背面扶额蹒跚 → 侧面挂瓶期待 → 绿血回涌 → 正面跳起回血 → 双臂屈肌活力满格 → 欢快收势
    clip("coffee_iv", "挂瓶回血", [190, 175, 155, 150, 160, 185], [
      kf({ head: { dy: 1, variant: "dizzy" }, armL: "down", armR: "down", legL: "crouch", legR: "crouch", prop: "iv" }, { angle: "back" }),
      kf({ head: "normal", armL: "mid", armR: "down", prop: "iv" }, { angle: "side", fx: [[3, 7, ["VV", "VV"]]] }),
      kf({ head: "glowV", armL: "up", armR: "mid", legL: "step", legR: "stand", prop: "iv" }, { angle: "front", fx: [[2, 3, ["..V..", "VVVVV", "..V.."]], [6, 1, ["Y........Y"]]] }),
      kf({ head: { dy: -1, variant: "happy" }, torso: { dy: -1, variant: "normal" }, armL: "up", armR: "up", legL: "step", legR: "step", prop: "iv" }, { angle: "front", shadow: "shrink", fx: [[2, 1, ["Y..V..Y", "..VVV.."]]] }),
      kf({ head: "glowV", armL: "flex", armR: "flex", legL: "wide", legR: "wide", prop: "iv" }, { angle: "front", fx: [[4, 2, ["Y....................Y"]]] }),
      kf({ head: "happy", armL: "down", armR: "mid", prop: "iv" }, { angle: "side" }),
    ]),
  ],
});

// 3. 厨师 (男) — 烈焰颠勺 / 撒盐暴雪 / 小当家金光 / 残影快刀 / 帽飞起锅
const chefHat = (g) => {
  stamp2x(g, 10, 1, ["..WWWWWWWW..", ".WWWWWWWWWW.", ".WWwWWWWwWW.", ".WWWWWWWWWW.", "..wwwwwwww.."]);
};
const chefRig = buildCharacterRig({
  gender: "male", hairStyle: "short", coat: "chef", hatKind: "chef", beardKind: "mustache",
  hatFn: chefHat,
  beardFn(g) { stamp2x(g, 13, 13, ["HH..HH"], false); },
  props: {
    default: partPatch(22, 21, ["gggggg", ".gggg."]),
    wokUp: partPatch(22, 18, ["ggggggg", ".ggggg."]),
    knife: partPatch(22, 17, ["WWWWW", "WWWWW", "gBBBB"]),
    hatFloat: partPatch(10, 0, [".WWWWWWWW.", "WWWWWWWWWW", ".wwwwwwww."]),
    plate: partPatch(19, 17, ["...YYY...", "..YFFFY..", ".WWWWWwW.", "..wwwww.."], false),
  },
  sideProps: {
    default: partPatch(20, 20, ["BBggggggg", "...ggggg."], false),
    wokUp: partPatch(20, 17, ["BBgggggggg", "...gggggg."], false),
  },
});
const chef = makeRiggedSprite({
  id: "chef", name: "厨师", gender: "male",
  palette: makePalette(SKIN.warm, { H: "#4a3228", h: "#755141", k: "#2b1c16" }),
  rig: chefRig,
  animations: [
    // 烈焰颠勺（8大拍→30帧）：正面整理领巾热身 → 切侧面扎马步蓄力 → 起火颠锅 → 冲天龙焰+飞蛋 → 凌空接蛋 → 二次花式小翻锅收汁 → 转正面端出金盘摆盘 → 竖拇指点赞
    clip("wok", "烈焰颠勺", [180, 165, 130, 125, 120, 135, 165, 190], [
      kf({ head: "happy", armL: "flex", armR: "flex", prop: false }, { angle: "front", fx: [[8, 4, ["Y..............Y"]]] }),
      kf({ head: { dy: 1, variant: "normal" }, armL: "back", armR: "lowOut", legL: "crouch", legR: "crouch", prop: "default" }, { angle: "side" }),
      kf({ head: "normal", armL: "back", armR: "mid", legL: "wide", legR: "wide", prop: "default" }, { angle: "side", fx: [[22, 16, ["..F..", ".FYF."]]] }),
      kf({ head: { dy: -1, variant: "shout" }, torso: "leanL", armL: "mid", armR: "up", legL: "wide", legR: "wide", prop: { dy: -2, variant: "wokUp" } }, { angle: "side", fx: [[23, 3, [".WW.", "WYYW", ".WW."]], [21, 9, ["...Y...", "..FYF..", ".FFYFF.", ".FRYRF.", ".FFFFF."]]] }),
      kf({ head: "glowF", torso: "leanL", armL: "up", armR: { dy: -1, variant: "up" }, legL: "wide", legR: "stand", prop: { dy: -3, variant: "wokUp" } }, { angle: "side", fx: [[22, 0, [".WW.", "WYYW", ".WW."]], [20, 6, ["....Y....", "...FYF...", "..FFYFF..", "..FRYRF..", ".FFYYYFF.", ".FRRRRRF."]]] }),
      kf({ head: "happy", torso: "leanR", armL: "down", armR: "highOut", prop: { dy: -1, variant: "wokUp" } }, { angle: "side", fx: [[23, 8, [".WW.", "WYYW", ".WW."]], [21, 13, ["..FYF..", ".FFYFF."]]] }),
      kf({ head: "glow", armL: "forward", armR: "mid", prop: "plate" }, { angle: "front", fx: [[18, 12, ["Y...Y...Y"]]] }),
      kf({ head: "happy", armL: "down", armR: "salute", prop: "plate" }, { angle: "front", fx: [[23, 13, [".W..W.", "W....W"]]] }),
    ], { targetFrames: 30 }),
    // 撒盐暴雪（6大拍→24帧）：侧面俯身审视菜品 → 屈肘起范 → 招牌撒盐暴雪 → 金盐风暴 → 转正面潇洒吹指尖 → 微笑收锅
    clip("salt", "撒盐暴雪", [170, 160, 145, 145, 160, 180], [
      kf({ head: { dy: 1, variant: "normal" }, torso: "leanR", armL: "back", armR: "forwardLow", prop: "plate" }, { angle: "side" }),
      kf({ head: "normal", armL: "back", armR: "salute", prop: "default" }, { angle: "side", fx: [[24, 13, ["W", ".Y"]]] }),
      kf({ head: { dx: -1, variant: "blink" }, torso: "leanL", armL: "back", armR: { dx: 1, dy: -1, variant: "up" }, legL: "wide", legR: "stand", prop: false }, { angle: "side", fx: [[22, 12, ["..W.Y.W.", ".Y.W.y.W", "..W.Y.W.", ".y.W.Y.."]]] }),
      kf({ head: "happy", torso: "leanL", armL: "mid", armR: { dx: 1, dy: -2, variant: "up" }, legL: "wide", legR: "stand", prop: false }, { angle: "side", fx: [[21, 11, [".Y.W.y.W", "W.y.W.Y.", ".Y.W.W.y", "W.Y.y.W."]]] }),
      kf({ head: "flash", armL: "back", armR: "salute", prop: "plate" }, { angle: "front", fx: [[22, 9, ["Y..W..Y"]]] }),
      kf({ head: "happy", armL: "down", armR: "down", prop: "default" }, { angle: "side", fx: [[23, 14, [".W.Y", "y.W."]]] }),
    ]),
    // 小当家金光（6大拍→24帧）：背面掀神秘锅盖 → 试吃瞳孔地震 → 转正面金光炸裂 → 腾空发光 → 侧面端金盘谢幕 → 满意鞠躬
    clip("taste", "小当家金光", [185, 165, 150, 155, 165, 185], [
      kf({ head: "normal", armL: "forward", armR: "up", prop: false }, { angle: "back", fx: [[10, 4, ["Y........Y"]]] }),
      kf({ head: "shock", armL: "forward", armR: "salute", prop: false }, { angle: "side", fx: [[3, 5, ["Y....................Y"]]] }),
      kf({ head: "glow", torso: "normal", armL: "mid", armR: "up", legL: "wide", legR: "wide", prop: false }, { angle: "front", fx: [[1, 1, ["Y..Y..............Y..Y", ".Y...Y..........Y...Y.", "Y....................Y", ".F..................F."]]] }),
      kf({ head: { dy: -1, variant: "glow" }, armL: "up", armR: "up", legL: "step", legR: "step", prop: false }, { angle: "front", shadow: "shrink", fx: [[0, 0, ["Y.F.Y..Y........Y..Y.F.Y", ".YYYY..............YYYY.", "Y..F................F..Y", "F......................F"]]] }),
      kf({ head: "happy", armL: "forward", armR: "mid", prop: "plate" }, { angle: "side", fx: [[20, 10, ["Y..Y..Y"]]] }),
      kf({ head: { dy: 1, variant: "happy" }, torso: "leanR", armL: "down", armR: "salute", prop: "plate" }, { angle: "front", fx: [[2, 3, ["Y....................Y"]]] }),
    ]),
    // 残影快刀（6大拍→24帧）：侧面磨刀冒火花 → 高举起刀 → 快刀残影狂切 → 食材飞空 → 转正面甩刀定格 → 端盘展示完美刀工
    clip("chop", "残影快刀", [165, 130, 115, 115, 145, 180], [
      kf({ head: "flash", armL: "forward", armR: "forward", prop: "knife" }, { angle: "side", fx: [[22, 14, ["Y.W.Y"]]] }),
      kf({ head: { dy: 1, variant: "normal" }, armL: "forward", armR: "up", prop: { dy: -4, variant: "knife" } }, { angle: "side" }),
      kf({ head: { dy: 1, variant: "glow" }, torso: "leanR", armL: "forward", armR: "mid", prop: { dy: 0, variant: "knife" } }, { angle: "side", fx: [[21, 10, ["..F..V..", ".V..F...", "WWwWWwWW"]]] }),
      kf({ head: { dy: 1, variant: "flash" }, torso: "leanR", armL: "forward", armR: { dy: -2, variant: "mid" }, prop: { dy: -2, variant: "knife" } }, { angle: "side", fx: [[19, 6, ["F...V...F", "..V...F..", "wWWwWWwWW", "WWwWWwWWw"]]] }),
      kf({ head: "flash", armL: "back", armR: "mid", prop: "knife" }, { angle: "front", fx: [[22, 12, [".F..V.", "V....F"]]] }),
      kf({ head: "happy", armL: "down", armR: "mid", prop: "plate" }, { angle: "front", fx: [[20, 12, ["Y...Y"]]] }),
    ]),
    // 帽飞起锅（6大拍→24帧）：侧面闻锅香陶醉 → 蒸汽炸裂正面帽飞惊呆 → 蹲身抱头 → 仰头蹦起追帽 → 精准用头接住高帽 → 得意笑
    clip("hat_pop", "帽飞起锅", [175, 160, 145, 145, 155, 185], [
      kf({ head: "happy", torso: "leanR", armL: "down", armR: "mid", prop: "default" }, { angle: "side", fx: [[22, 15, [".W..W.", "W....W"]]] }),
      kf({ head: "hatlessShock", armL: "up", armR: "up", legL: "wide", legR: "wide", prop: { dx: 0, dy: 0, variant: "hatFloat" } }, { angle: "front", fx: [[8, 5, ["W..w....w..W", ".W..W..W..W."]]] }),
      kf({ head: { dy: 1, variant: "hatlessShock" }, armL: "mid", armR: "mid", legL: "crouch", legR: "crouch", prop: { dx: 1, dy: -1, variant: "hatFloat" } }, { angle: "front", fx: [[5, 4, ["W...W.....W...W", "..W...W.W...W.."]]] }),
      kf({ head: { dy: -2, variant: "hatless" }, torso: { dy: -2, variant: "normal" }, armL: { dy: -2, variant: "up" }, armR: { dy: -2, variant: "up" }, legL: { dy: -2, variant: "step" }, legR: { dy: -2, variant: "step" }, prop: { dx: 0, dy: 1, variant: "hatFloat" } }, { angle: "front", shadow: "shrink" }),
      kf({ head: "glow", armL: "mid", armR: "mid", legL: "wide", legR: "wide", prop: false }, { angle: "front", fx: [[6, 1, ["Y..Y............Y..Y"]]] }),
      kf({ head: "happy", armL: "down", armR: "down", prop: "default" }, { angle: "front", fx: [[6, 3, ["W................W"]]] }),
    ]),
  ],
});

// 4. 画家 (女) — 颜料狂轰 / 灵感帽飞 / 七彩旋涡 / 灵魂画作 / 颜料糊脸
const artistHat = (g) => {
  stamp2x(g, 9, 2, ["......d......", "..aaAAAAAAA..", ".AAAAAAAAAAA.", ".ddAAAAAAAAdd"]);
};
const artistRig = buildCharacterRig({
  gender: "female", hairStyle: "wavy", coat: "apron", hatKind: "beret", extraHeadKinds: ["paint"],
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
    // 颜料狂轰（6大拍→24帧）：侧面托腮构思 → 蘸颜料蓄力 → 豪迈挥毫甩彩 → 低位扫射 → 转正面旋转收笔 → 骄傲欣赏
    clip("splash", "颜料狂轰", [175, 150, 135, 135, 150, 180], [
      kf({ head: "blink", armL: "mid", armR: "salute", prop: "default" }, { angle: "side", fx: [[23, 7, ["Y..M"]]] }),
      kf({ head: "normal", armL: "mid", armR: "mid", prop: "default" }, { angle: "side", fx: [[24, 11, ["M..Y", "..C."]]] }),
      kf({ head: "glowM", torso: "leanR", armL: "mid", armR: "up", prop: "brushHigh" }, { angle: "side", fx: [[2, 2, ["R..M................C..Y", "..Y..................M.."]], [23, 7, [".R.Y.", "C...M"]]] }),
      kf({ head: "glowM", torso: "leanL", armL: "down", armR: { dx: 1, dy: 0, variant: "mid" }, legL: "wide", legR: "stand", prop: { dx: 1, dy: 3, variant: "brushHigh" } }, { angle: "side", fx: [[21, 3, [".M.Y.C.R.", "R..M..Y..", ".C..R..M."]], [2, 6, ["C.M", ".Y."]]] }),
      kf({ head: "happy", armL: "up", armR: "up", legL: "step", legR: "stand", prop: "default" }, { angle: "front", fx: [[2, 2, ["M..C....Y....R..M"]]] }),
      kf({ head: "happy", armL: "down", armR: "down", prop: "default" }, { angle: "side", fx: [[23, 9, ["Y..C", ".M.R"]]] }),
    ]),
    // 灵感帽飞（6大拍→24帧）：侧面苦思问号 → 突然顿悟 → 正面贝雷帽冲天惊呼 → 仰头跃起追帽 → 精准戴回灵光四射 → 兴奋挥笔
    clip("eureka", "灵感帽飞", [180, 165, 150, 150, 160, 180], [
      kf({ head: "blink", armL: "down", armR: "salute", prop: false }, { angle: "side", fx: [[23, 3, ["YY", ".Y", "..", ".Y"]]] }),
      kf({ head: "normal", armL: "down", armR: "salute", prop: false }, { angle: "front", fx: [[5, 2, ["Y....................Y"]]] }),
      kf({ head: "hatlessShock", armL: "up", armR: "up", legL: "wide", legR: "wide", prop: { dx: 0, dy: 0, variant: "beretFloat" } }, { angle: "front", fx: [[2, 2, ["M..Y............C..R", ".C..R..........Y..M."]]] }),
      kf({ head: { dy: -1, variant: "hatless" }, armL: "mid", armR: "up", prop: { dx: -1, dy: -1, variant: "beretFloat" } }, { angle: "front", fx: [[1, 1, ["Y.C.M..............R.Y.C", ".R.Y................C.M."]]] }),
      kf({ head: "glow", armL: "up", armR: "up", legL: "step", legR: "stand", prop: "brushHigh" }, { angle: "front", fx: [[4, 2, ["M....Y....C....R"]]] }),
      kf({ head: "happy", armL: "down", armR: "down", prop: "default" }, { angle: "front" }),
    ]),
    // 七彩旋涡（6大拍→24帧）：正面调色起势 → 侧面右旋甩彩 → 背面飞旋彩环 → 侧面左旋 → 正面彩光定格 → 眨眼比心
    clip("palette", "七彩旋涡", [165, 145, 140, 140, 155, 175], [
      kf({ head: "normal", armL: "mid", armR: "forward", prop: "default" }, { angle: "front", fx: [[1, 15, [".M.C.", "Y.R.V", ".U.Y."]]] }),
      kf({ head: "glow", torso: "leanL", armL: { dy: -1, variant: "mid" }, armR: { dx: -1, dy: -1, variant: "forward" }, prop: "default" }, { angle: "side", facing: "right", fx: [[0, 11, ["..C.M.Y..", ".R.U.C.M.", "Y.MWRWY.R", ".V.C.U.V.", "..Y.R.C.."]]] }),
      kf({ head: "glowM", torso: "leanL", armL: { dy: 0, variant: "mid" }, armR: { dx: -1, dy: 1, variant: "forward" }, prop: "default" }, { angle: "back", fx: [[0, 10, ["..Y.R.C..", ".M.C.Y.U.", "C.UWWWM.Y", ".R.Y.C.R.", "..M.V.Y.."]]] }),
      kf({ head: "glow", torso: "leanR", armL: "up", armR: "mid", prop: "default" }, { angle: "side", facing: "left", fx: [[21, 11, ["..C.M.Y..", ".R.U.C.M.", "..Y.R.C.."]]] }),
      kf({ head: "happy", armL: "up", armR: "up", legL: "step", legR: "stand", prop: "default" }, { angle: "front", fx: [[2, 2, ["R..Y....C....M..V"]]] }),
      kf({ head: "blink", armL: "down", armR: "down", prop: "default" }, { angle: "front", fx: [[1, 14, [".R.Y.", "C.M.V"]]] }),
    ]),
    // 灵魂画作（6大拍→24帧）：背面起笔构图 → 背面狂画抖笔 → 侧面吹干画布 → 转正面高举灵魂大作 → 踮脚欢呼 → 开心端画
    clip("portrait", "灵魂画作", [180, 150, 155, 160, 155, 185], [
      kf({ head: "normal", armL: "down", armR: "mid", prop: { dy: 2, variant: "canvas" } }, { angle: "back" }),
      kf({ head: { dy: 1, variant: "glow" }, torso: "leanR", armL: "forward", armR: "up", prop: { dy: 1, variant: "canvas" } }, { angle: "back", fx: [[21, 7, ["M.Y.C"]]] }),
      kf({ head: "glow", torso: "leanL", armL: "mid", armR: "up", prop: { dy: -1, variant: "canvas" } }, { angle: "side", fx: [[21, 5, ["Y..Y..Y."]]] }),
      kf({ head: "happy", torso: "leanL", armL: "up", armR: "up", legL: "step", legR: "stand", prop: { dy: -2, variant: "canvas" } }, { angle: "front", fx: [[20, 3, ["Y...Y...Y"]], [20, 7, ["Y"]]] }),
      kf({ head: "glowM", armL: "up", armR: "up", legL: "stand", legR: "step", prop: { dy: -2, variant: "canvas" } }, { angle: "front", fx: [[4, 2, ["M.M..................Y..Y"]]] }),
      kf({ head: "happy", armL: "down", armR: "mid", prop: { dy: 1, variant: "canvas" } }, { angle: "front" }),
    ]),
    // 颜料糊脸（6大拍→24帧）：侧面踮脚够颜料桶 → 失手倾倒正面惊呼 → 满脸彩漆蹲下石化 → 侧面袖子一擦更花 → 正面滴冷汗 → 尴尬笑比耶
    clip("paint_face", "颜料糊脸", [175, 150, 175, 165, 165, 185], [
      kf({ head: { dy: -1, variant: "normal" }, armL: "down", armR: "up", legL: "step", legR: "stand", prop: "bucket" }, { angle: "side" }),
      kf({ head: "shock", torso: "leanL", armL: "up", armR: "mid", legL: "wide", legR: "wide", prop: { dx: -1, dy: -2, variant: "bucket" } }, { angle: "front", fx: [[11, 5, ["M.C.Y.R.M", ".R.M.Y.C."]]] }),
      kf({ head: "paint", armL: "mid", armR: "mid", legL: "crouch", legR: "crouch", prop: false }, { angle: "front" }),
      kf({ head: "paint", armL: "back", armR: "salute", prop: false }, { angle: "side", fx: [[22, 10, ["M.C", ".Y."]]] }),
      kf({ head: "paint", armL: "down", armR: "down", prop: "default" }, { angle: "front", fx: [[24, 9, ["C", "C"]]] }),
      kf({ head: "happy", armL: "down", armR: "up", prop: "default" }, { angle: "front", fx: [[24, 6, ["Y..M"]]] }),
    ]),
  ],
});

// 5. 科学家 (女) — 毒液喷泉 / 护目反光 / 炸成爆炸头 / 迷你变身 / 公式刷屏
const scientistRig = buildCharacterRig({
  gender: "female", hairStyle: "fluffy", coat: "labcoat", hatKind: "goggles", extraHeadKinds: ["scientist"],
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
    // 毒液喷泉（6大拍→24帧）：侧面小心滴液 → 摇晃冒泡 → 绿色毒液冲天喷泉 → 惊退捂头 → 正面兴奋鼓掌 → 淡定收瓶
    clip("flask", "毒液喷泉", [170, 150, 135, 135, 155, 175], [
      kf({ head: { dy: 1, variant: "normal" }, armL: "forward", armR: "mid", prop: { dx: 0, dy: 0, variant: "default" } }, { angle: "side", fx: [[24, 14, [".V."]]] }),
      kf({ head: "normal", armL: "down", armR: "mid", prop: { dx: 0, dy: 0, variant: "default" } }, { angle: "side", fx: [[24, 12, [".C.", "V.."]]] }),
      kf({ head: "glowV", torso: "leanL", armL: "mid", armR: "up", prop: { dx: -1, dy: -4, variant: "default" } }, { angle: "side", fx: [[22, 5, ["..V.C..", ".C..V..", "..VVV..", ".C.V.C."]]] }),
      kf({ head: "glowV", torso: "leanR", armL: "back", armR: { dx: 1, dy: -2, variant: "mid" }, legL: "wide", legR: "stand", prop: { dx: 1, dy: -2, variant: "default" } }, { angle: "side", fx: [[21, 0, ["C.V.C.V.C", ".V.C.V.C.", "..VVVVV..", "...CVV..."]]] }),
      kf({ head: "happy", armL: "up", armR: "up", legL: "step", legR: "stand", prop: "default" }, { angle: "front", fx: [[6, 2, ["V....C....V"]]] }),
      kf({ head: "blink", armL: "down", armR: "down", prop: "default" }, { angle: "side", fx: [[23, 8, [".V..C.", "..C..."]]] }),
    ]),
    // 护目反光（6大拍→24帧）：侧面拉下护目镜 → 正面镜片爆白光 → 原子环初现 → 原子环全速环绕 → 双臂掌电 → 推镜自信笑
    clip("atom", "护目反光", [170, 165, 150, 150, 155, 180], [
      kf({ head: "normal", armL: "down", armR: "salute", prop: "default" }, { angle: "side" }),
      kf({ head: "goggleFlash", armL: "up", armR: "down", prop: "default" }, { angle: "front" }),
      kf({ head: "goggleFlash", armL: "mid", armR: "mid", prop: "default" }, { angle: "front", fx: [[9, 0, ["...C..U..C...", ".U....Y....U.", "...C..U..C..."]]] }),
      kf({ head: "glowC", torso: "leanR", armL: "up", armR: "up", prop: false }, { angle: "front", fx: [[7, 0, ["....U...C...U....", "..C...U.Y.U...C..", "....U...C...U...."]]] }),
      kf({ head: "glowC", torso: "leanL", armL: "flex", armR: "flex", legL: "wide", legR: "wide", prop: false }, { angle: "front", fx: [[8, 0, ["..C.Y.U.Y.C.."]]] }),
      kf({ head: "goggleFlash", armL: "down", armR: "down", prop: "default" }, { angle: "front", fx: [[10, 1, ["..C.U.C..", ".U..Y..U.", "..C.U.C.."]]] }),
    ]),
    // 炸成爆炸头（7大拍→27帧）：侧面得意摇烧瓶 → 突然发红冒火星警报 → 轰然巨爆 → 转正面炸成大爆炸头惊呆 → 冒黑烟晕眩 → 猛拍头发抖烟灰 → 眨眼回神
    clip("boom", "炸成爆炸头", [170, 145, 125, 165, 185, 155, 180], [
      kf({ head: "happy", armL: "down", armR: "mid", prop: "flaskPurple" }, { angle: "side" }),
      kf({ head: "normal", armL: "down", armR: "mid", prop: "default" }, { angle: "side", fx: [[23, 14, [".Y..", "FYF."]]] }),
      kf({ head: "shock", torso: "leanL", armL: "up", armR: "back", legL: "wide", legR: "wide", prop: false }, { angle: "side", fx: [[16, 4, ["...uWWWuu...", "..WWWWWWWW..", ".WWuYYYYuWW.", ".WWYFFFFYWW.", "..WWWWWWWW.."]]] }),
      kf({ head: "afro", armL: { dy: 1, variant: "down" }, armR: { dy: 1, variant: "down" }, legL: "crouch", legR: "crouch", prop: false }, { angle: "front", fx: [[5, 0, ["w....u........w....u"]]] }),
      kf({ head: "afroDizzy", armL: "down", armR: "down", prop: false }, { angle: "front", fx: [[7, 0, ["w......w......u"]]] }),
      kf({ head: "afro", armL: "up", armR: "up", prop: false }, { angle: "side", fx: [[4, 1, ["w.w.w.........w.w"]]] }),
      kf({ head: "blink", armL: "down", armR: "down", prop: "default" }, { angle: "front", fx: [[9, 2, ["w....u....w"]]] }),
    ]),
    // 迷你变身（7大拍→27帧）：侧面端详神秘紫药 → 仰头喝下 → 紫雾收缩 → 正面变迷你惊呼 → 侧面迷你小跑 → 啵地弹回原尺寸 → 欢呼庆祝
    clip("shrink", "迷你变身", [170, 155, 145, 175, 155, 150, 180], [
      kf({ head: "normal", armL: "down", armR: "mid", prop: "flaskPurple" }, { angle: "side", fx: [[23, 12, [".U.u."]]] }),
      kf({ head: "normal", armL: "down", armR: "salute", prop: { dx: -2, dy: -4, variant: "flaskPurple" } }, { angle: "side" }),
      kf({ head: "shock", armL: "mid", armR: "mid", legL: "crouch", legR: "crouch", prop: false }, { angle: "side", fx: [[6, 6, ["U...u.....u...U"]]] }),
      kf({ head: "shock", armL: "up", armR: "up", legL: "wide", legR: "wide", prop: "default" }, { angle: "front", scale: 0.5, shadow: "tiny", fx: [[9, 8, ["..u..U..u..", "U.........U"]]] }),
      kf({ head: "happy", armL: "mid", armR: "up", legL: "step", legR: "stand", prop: "default" }, { angle: "side", scale: 0.5, shadow: "tiny", fx: [[8, 6, ["Y...U...Y"]]] }),
      kf({ head: "glowC", armL: "up", armR: "up", legL: "wide", legR: "wide", prop: "default" }, { angle: "front", fx: [[5, 4, ["U....................U"]]] }),
      kf({ head: "happy", armL: "down", armR: "mid", prop: "default" }, { angle: "front" }),
    ]),
    // 公式刷屏（6大拍→24帧）：侧面扶额苦思 → 眼前一亮起笔 → 侧面连刷公式 → 背面狂写整墙 → 护目反光划等号 → 正面比V得意笑
    clip("eureka_eq", "公式刷屏", [175, 155, 145, 145, 155, 180], [
      kf({ head: "blink", armL: "down", armR: "salute", prop: false }, { angle: "side", fx: [[22, 4, ["C..Y"]]] }),
      kf({ head: "normal", armL: "down", armR: "up", prop: false }, { angle: "side", fx: [[2, 2, ["CC..C.", "C..CCC"]]] }),
      kf({ head: "glowC", torso: "leanR", armL: "mid", armR: { dx: 1, dy: -1, variant: "up" }, prop: false }, { angle: "side", fx: [[1, 1, ["C.C...Y.....C.CC...Y", ".C...Y.Y....CC.C..Y."]]] }),
      kf({ head: "glowC", torso: "leanL", armL: "up", armR: "up", prop: false }, { angle: "back", fx: [[1, 0, ["Y.CC...CC.C...Y.CC..", "..C.....C.C.....C..."]]] }),
      kf({ head: "goggleFlash", torso: "leanL", armL: "up", armR: "mid", prop: "default" }, { angle: "side", fx: [[1, 0, ["Y.CC...CC.C...Y.CC.."]]] }),
      kf({ head: "happy", armL: "down", armR: "up", prop: "default" }, { angle: "front", fx: [[4, 2, ["C..Y..C..Y..C"]]] }),
    ]),
  ],
});

// 6. 宇航员 (男) — 失重翻滚 / 宇宙SOS / 火箭暴走 / 外星搭讪 / 太空漫步
const astronautRig = buildCharacterRig({
  gender: "male", coat: "spacesuit", customKind: "astronaut",
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
    flag: partPatch(24, 10, ["gAAAA", "gAAYA", "gAAAA", "g....", "g....", "g....", "g....", "g...."], false),
  },
});
const astronaut = makeRiggedSprite({
  id: "astronaut", name: "宇航员", gender: "male",
  palette: makePalette(SKIN.warm, { H: "#2d3748", h: "#4a5568", k: "#1a202c" }),
  rig: astronautRig,
  idleKeyframe: kf({ prop: false }),
  animations: [
    // 失重翻滚（6大拍→24帧）：正面试探蹬地飘起 → 侧面右翻滚 → 背面喷气调整 → 侧面左翻滚 → 正面缓缓飘落 → 招手致意
    clip("float", "失重翻滚", [185, 165, 165, 165, 165, 185], [
      kf({ head: { dy: 1, variant: "normal" }, torso: { dy: 1, variant: "normal" }, armL: "down", armR: "down", legL: "crouch", legR: "crouch", prop: false }, { angle: "front" }),
      kf({ head: { dy: -1, variant: "normal" }, torso: { dy: -1, variant: "normal" }, armL: { dy: -1, variant: "mid" }, armR: { dy: -1, variant: "down" }, legL: { dy: -1, variant: "step" }, legR: { dy: -1, variant: "stand" }, prop: false }, { angle: "front", shadow: "shrink", fx: [[2, 2, ["Y.........................y"]]] }),
      kf({ head: { dx: -1, dy: -2, variant: "sweep1" }, torso: { dy: -2, variant: "leanL" }, armL: { dy: -2, variant: "up" }, armR: { dy: -2, variant: "mid" }, legL: { dy: -2, variant: "kick" }, legR: { dy: -2, variant: "step" }, prop: false }, { angle: "side", facing: "right", shadow: "tiny", fx: [[1, 1, [".y.......................Y"]]] }),
      kf({ head: { dx: 1, dy: -2, variant: "sweep2" }, torso: { dy: -2, variant: "leanR" }, armL: { dy: -2, variant: "mid" }, armR: { dy: -2, variant: "up" }, legL: { dy: -2, variant: "step" }, legR: { dy: -2, variant: "kick" }, prop: false }, { angle: "back", shadow: "tiny", fx: [[2, 0, ["Y........................Y"]]] }),
      kf({ head: { dy: -1, variant: "normal" }, torso: { dy: -1, variant: "normal" }, armL: { dy: -1, variant: "down" }, armR: { dy: -1, variant: "mid" }, legL: { dy: -1, variant: "stand" }, legR: { dy: -1, variant: "step" }, prop: false }, { angle: "side", facing: "left", shadow: "shrink", fx: [[3, 2, ["y.......................Y"]]] }),
      kf({ head: "visorHappy", armL: "down", armR: "up", prop: false }, { angle: "front", fx: [[23, 5, ["Y..C"]]] }),
    ]),
    // 宇宙SOS（6大拍→24帧）：侧面左顾右盼找飞船 → 发现飞船正面起挥 → 发射青色SOS电波 → 双臂狂挥跃起 → 收到回波 → 面罩笑眼致意
    clip("wave", "宇宙SOS", [175, 160, 145, 145, 155, 180], [
      kf({ head: "sweep1", armL: "down", armR: "salute", prop: false }, { angle: "side", facing: "left" }),
      kf({ head: "normal", armL: "mid", armR: "up", prop: false }, { angle: "front" }),
      kf({ head: "sweep1", torso: "leanL", armL: "up", armR: "mid", legL: "step", legR: "stand", prop: false }, { angle: "front", fx: [[23, 5, ["..C.c", ".C..C"]], [1, 5, ["c.C..", "C..C."]]] }),
      kf({ head: "visorHappy", torso: "leanR", armL: "mid", armR: "up", legL: "stand", legR: "step", prop: false }, { angle: "front", fx: [[22, 2, ["...C.c.", "..C..C.", ".C.C..."]], [1, 2, ["c.C...", "C..C.."]]] }),
      kf({ head: { dy: -1, variant: "visorHappy" }, armL: "up", armR: "up", legL: "step", legR: "step", prop: false }, { angle: "front", shadow: "shrink", fx: [[23, 3, ["Y.C.Y"]]] }),
      kf({ head: "visorHappy", armL: "down", armR: "salute", prop: false }, { angle: "front", fx: [[23, 7, [".C.C."]]] }),
    ]),
    // 火箭暴走（7大拍→27帧）：背面下蹲检查背包 → 点火预热冒小火 → 轰然升空 → 高空全力推进 → 侧面高速翻滚 → 熄火缓冲下降 → 正面帅气落地竖拇指
    clip("boost", "火箭暴走", [170, 145, 130, 125, 135, 150, 180], [
      kf({ head: { dy: 1, variant: "normal" }, torso: { dy: 1, variant: "normal" }, armL: "back", armR: "back", legL: "crouch", legR: "crouch", prop: false }, { angle: "back" }),
      kf({ head: "normal", armL: "back", armR: "back", legL: "stand", legR: "stand", prop: false }, { angle: "back", fx: [[9, 28, ["..FF....FF.."]]] }),
      kf({ head: { dy: -1, variant: "sweep1" }, torso: { dy: -1, variant: "normal" }, armL: { dy: -1, variant: "back" }, armR: { dy: -1, variant: "back" }, legL: { dy: -1, variant: "stand" }, legR: { dy: -1, variant: "stand" }, prop: false }, { angle: "back", shadow: "shrink", fx: [[8, 26, ["..FFF....FFF..", "..FYF....FYF..", "...C......C..."]]] }),
      kf({ head: { dy: -3, variant: "sweep2" }, torso: { dy: -3, variant: "normal" }, armL: { dy: -3, variant: "up" }, armR: { dy: -3, variant: "up" }, legL: { dy: -3, variant: "stand" }, legR: { dy: -3, variant: "stand" }, prop: false }, { angle: "back", shadow: "none", fx: [[7, 24, ["..FFFF....FFFF..", "..FYYF....FYYF..", "...CC......CC...", "..w..w....w..w.."]]] }),
      kf({ head: { dy: -4, variant: "visorHappy" }, torso: { dy: -4, variant: "normal" }, armL: { dy: -4, variant: "up" }, armR: { dy: -4, variant: "up" }, legL: { dy: -4, variant: "kick" }, legR: { dy: -4, variant: "kick" }, prop: false }, { angle: "side", shadow: "none", fx: [[6, 23, ["..FYYF....FYYF..", "..FFFF....FFFF..", "...CC......CC...", ".w..w..ww..w..w."]]] }),
      kf({ head: { dy: -1, variant: "normal" }, torso: { dy: -1, variant: "normal" }, armL: { dy: -1, variant: "down" }, armR: { dy: -1, variant: "down" }, legL: { dy: -1, variant: "stand" }, legR: { dy: -1, variant: "stand" }, prop: false }, { angle: "front", shadow: "shrink", fx: [[9, 27, ["..w......w.."]]] }),
      kf({ head: "visorHappy", armL: "down", armR: "salute", prop: false }, { angle: "front", fx: [[23, 9, ["Y..Y"]]] }),
    ]),
    // 外星搭讪（6大拍→24帧）：侧面警惕发现信号 → 试探打招呼 → 外星人现身互挥手 → 一起蹦跶欢呼 → 插登月小旗留念 → 正面开心合影
    clip("alien", "外星搭讪", [175, 160, 150, 150, 160, 180], [
      kf({ head: { dx: -1, variant: "sweep1" }, torso: { dx: -1, variant: "leanL" }, armL: { dx: -1, variant: "back" }, armR: { dx: -1, variant: "forwardLow" }, legL: { dx: -1, variant: "wide" }, legR: { dx: -1, variant: "stand" }, prop: { dx: 1, dy: 4, variant: "alien" } }, { angle: "side", fx: [[24, 9, ["C", ".", "C"]]] }),
      kf({ head: { dx: -1, variant: "normal" }, torso: { dx: -1, variant: "leanL" }, armL: { dx: -1, variant: "down" }, armR: { dx: -1, variant: "mid" }, legL: { dx: -1, variant: "stand" }, legR: { dx: -1, variant: "stand" }, prop: { dx: 0, dy: 2, variant: "alien" } }, { angle: "side" }),
      kf({ head: { dx: -1, variant: "visorHappy" }, torso: { dx: -1, variant: "leanL" }, armL: { dx: -1, variant: "mid" }, armR: { dx: -1, variant: "up" }, legL: { dx: -1, variant: "stand" }, legR: { dx: -1, variant: "stand" }, prop: { dx: 0, dy: -1, variant: "alienWave" } }, { angle: "side", fx: [[24, 6, ["C.C", ".C."]]] }),
      kf({ head: { dx: -1, variant: "visorHappy" }, torso: { dx: -1, variant: "leanL" }, armL: { dx: -1, variant: "up" }, armR: { dx: -1, variant: "mid" }, legL: { dx: -1, variant: "step" }, legR: { dx: -1, variant: "stand" }, prop: { dx: 0, dy: -3, variant: "alienWave" } }, { angle: "side", fx: [[23, 4, ["Y.C.Y"]]] }),
      kf({ head: "visorHappy", armL: "down", armR: "mid", prop: "flag" }, { angle: "side", fx: [[24, 6, ["Y..Y"]]] }),
      kf({ head: "visorHappy", armL: "up", armR: "mid", prop: "flag" }, { angle: "front" }),
    ]),
    // 太空漫步（6大拍→24帧）：侧面插下登月小旗 → 太空滑步启程 → UFO掠过头顶 → 帅气迈步招手 → 反向滑步 → 正面定格敬礼
    clip("moonwalk", "太空漫步", [175, 160, 145, 145, 155, 180], [
      kf({ head: "normal", armL: "down", armR: "mid", prop: "flag" }, { angle: "side", fx: [[24, 7, ["Y..Y"]]] }),
      kf({ head: "normal", torso: "leanL", armL: "forward", armR: "back", legL: "step", legR: "stand", prop: { dx: 0, dy: 0, variant: "ufo" } }, { angle: "side", fx: [[6, 28, ["y.Y.y"]]] }),
      kf({ head: "sweep1", torso: "normal", armL: "back", armR: "forward", legL: "stand", legR: "step", prop: { dx: 8, dy: -1, variant: "ufo" } }, { angle: "side", fx: [[18, 28, ["y.Y.y"]]] }),
      kf({ head: "sweep2", torso: "leanR", armL: "forward", armR: "back", legL: "kick", legR: "stand", prop: { dx: 17, dy: 0, variant: "ufo" } }, { angle: "side", fx: [[21, 28, ["Y.y.Y"]]] }),
      kf({ head: "normal", torso: "normal", armL: "back", armR: "forward", legL: "stand", legR: "kick", prop: { dx: 10, dy: -1, variant: "ufo" } }, { angle: "side", fx: [[8, 28, ["Y.y"]]] }),
      kf({ head: "visorHappy", armL: "down", armR: "salute", prop: "flag" }, { angle: "front" }),
    ]),
  ],
});

// 7. 咖啡师 (女) — 香雾冲天 / 豆子机枪 / 圣光特调 / 奶泡山崩 / 浓缩觉醒
const baristaRig = buildCharacterRig({
  gender: "female", hairStyle: "bun", coat: "cafe", boots: "brown", hatKind: "barista",
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
    // 香雾冲天（6大拍→24帧）：侧面温杯热身 → 优雅倾倒拉花 → 巨型香雾冲天 → 闭眼陶醉闻香 → 转正面高举特调 → 满意眨眼
    clip("latte", "香雾冲天", [175, 165, 155, 155, 160, 180], [
      kf({ head: "normal", armL: "forward", armR: "forwardLow", prop: "default" }, { angle: "side" }),
      kf({ head: "normal", armL: "down", armR: "mid", prop: "default" }, { angle: "side", fx: [[23, 14, [".W..", "..W.", ".W.."]]] }),
      kf({ head: { dy: -1, variant: "happy" }, torso: "leanL", armL: "forward", armR: { dy: -1, variant: "mid" }, prop: { dy: -1, variant: "default" } }, { angle: "side", fx: [[20, 5, ["..WW..", ".W..W.", "..WW..", ".W....", "..WW.."]]] }),
      kf({ head: { dy: -1, variant: "happy" }, torso: "leanR", armL: "mid", armR: { dy: -2, variant: "mid" }, legL: "step", legR: "stand", prop: { dy: -2, variant: "default" } }, { angle: "side", fx: [[18, 1, ["..WWW..", ".W...W.", "..WWW..", ".W..W..", "..WWW.."]], [3, 4, ["W.W", ".W."]]] }),
      kf({ head: "happy", armL: "down", armR: "up", prop: { dy: -2, variant: "default" } }, { angle: "front", fx: [[22, 7, [".M.M.", "MMMMM", ".MMM."]]] }),
      kf({ head: "blink", armL: "down", armR: "down", prop: "default" }, { angle: "front", fx: [[22, 10, [".W..", "..W.", ".W.."]]] }),
    ]),
    // 豆子机枪（6大拍→24帧）：侧面倒豆热身 → 慢摇起步 → 暴走连射咖啡豆 → 豆雨狂飙 → 紧急捂住机口 → 正面擦汗松口气
    clip("grind", "豆子机枪", [165, 140, 125, 125, 150, 180], [
      kf({ head: "happy", armL: "forward", armR: "up", prop: "grinder" }, { angle: "side", fx: [[23, 12, ["B.B"]]] }),
      kf({ head: "normal", armL: "forward", armR: { dy: -1, variant: "mid" }, prop: "grinder" }, { angle: "side" }),
      kf({ head: "shout", torso: "leanR", armL: "forward", armR: { dx: 1, dy: 1, variant: "mid" }, prop: { dy: -1, variant: "grinder" } }, { angle: "side", fx: [[1, 3, ["B...B.................B..B", "..B...................B..."]]] }),
      kf({ head: "shout", torso: "leanL", armL: "forward", armR: { dx: -1, dy: -2, variant: "up" }, prop: { dy: 0, variant: "grinder" } }, { angle: "side", fx: [[1, 1, ["..B....B...........B...B..", "B..B.................B..B."]]] }),
      kf({ head: "shock", torso: "leanL", armL: "forward", armR: "forward", legL: "wide", legR: "wide", prop: "grinder" }, { angle: "side", fx: [[22, 11, [".B..B.", "....B."]]] }),
      kf({ head: "blink", armL: "down", armR: "salute", prop: "default" }, { angle: "front", fx: [[24, 9, ["C", "C"]]] }),
    ]),
    // 圣光特调（6大拍→24帧）：背面神秘摇杯调制 → 侧面端杯亮相 → 转正面圣光爆射 → 踮脚高举满屏爱心 → 优雅鞠躬呈上 → 开心眨眼
    clip("serve", "圣光特调", [180, 165, 150, 150, 160, 180], [
      kf({ head: "normal", armL: "forward", armR: "mid", prop: "default" }, { angle: "back", fx: [[22, 12, [".M.M.", "MMMMM", ".MMM.", "..M.."]]] }),
      kf({ head: "happy", torso: "leanR", armL: "mid", armR: "up", legL: "stand", legR: "step", prop: { dy: -4, variant: "default" } }, { angle: "side", fx: [[20, 4, ["Y..M.M..Y", "..MMMMM..", "...MMM..."]], [2, 6, [".M.M.", "MMMMM", ".MMM."]]] }),
      kf({ head: "glow", armL: "up", armR: "up", legL: "step", legR: "stand", prop: { dy: -5, variant: "default" } }, { angle: "front", fx: [[1, 1, ["Y.M.M..............M.M.Y", "..MMM..............MMM..", "...M................M..."]]] }),
      kf({ head: { dy: -1, variant: "happy" }, armL: "mid", armR: "up", legL: "stand", legR: "step", prop: { dy: -4, variant: "default" } }, { angle: "front", fx: [[2, 3, ["Y...M.M...........M.M...Y"]]] }),
      kf({ head: { dy: 1, variant: "happy" }, torso: "leanR", armL: "forward", armR: "mid", prop: "default" }, { angle: "side", fx: [[23, 9, ["M.M", "MMM", ".M."]]] }),
      kf({ head: "blink", armL: "down", armR: "mid", prop: "default" }, { angle: "front" }),
    ]),
    // 奶泡山崩（6大拍→24帧）：侧面打发奶泡微笑 → 奶泡失控膨胀 → 正面巨型奶泡山爆发 → 吓晕后退 → 偷偷舔一口奶泡 → 笑开花点赞
    clip("foam", "奶泡山崩", [175, 155, 150, 160, 160, 180], [
      kf({ head: "happy", armL: "down", armR: "mid", prop: "default" }, { angle: "side", fx: [[22, 16, [".WWW.", "WWWWW"]]] }),
      kf({ head: "shock", torso: "leanL", armL: "mid", armR: "mid", legL: "wide", legR: "stand", prop: "foamMid" }, { angle: "front" }),
      kf({ head: "shock", torso: { dx: -1, variant: "leanL" }, armL: "up", armR: "up", legL: "wide", legR: "wide", prop: "foamBig" }, { angle: "front" }),
      kf({ head: "dizzy", armL: "down", armR: "down", legL: "crouch", legR: "crouch", prop: "foamMid" }, { angle: "front" }),
      kf({ head: "happy", armL: "down", armR: "salute", prop: "foamMid" }, { angle: "side", fx: [[22, 8, ["M.M", "MMM"]]] }),
      kf({ head: "happy", armL: "down", armR: "mid", prop: "default" }, { angle: "front" }),
    ]),
    // 浓缩觉醒（6大拍→24帧）：侧面斟满浓黑浓缩 → 仰头一口闷 → 浑身电颤 → 正面双目蓝光激光 → 银魂全屏电光 → 侧面冷静放下空杯
    clip("espresso", "浓缩觉醒", [175, 155, 140, 140, 150, 180], [
      kf({ head: "normal", armL: "down", armR: "mid", prop: "default" }, { angle: "side" }),
      kf({ head: "blink", armL: "down", armR: "salute", prop: { dx: -4, dy: -6, variant: "default" } }, { angle: "side" }),
      kf({ head: "glowC", armL: "mid", armR: "mid", legL: "wide", legR: "wide", prop: false }, { angle: "front", fx: [[1, 10, ["CCCCCCCCC", "WWWWWWWWW"]], [22, 10, ["CCCCCCCCC", "WWWWWWWWW"]]] }),
      kf({ head: "flash", armL: "up", armR: "up", legL: "wide", legR: "wide", prop: false }, { angle: "front", fx: [[0, 9, ["YCCCCCCCCC", "WWWWWWWWWW"]], [22, 9, ["CCCCCCCCCY", "WWWWWWWWWW"]], [10, 1, ["Y...C...Y"]]] }),
      kf({ head: "glowC", armL: "flex", armR: "flex", legL: "wide", legR: "wide", prop: false }, { angle: "front", fx: [[5, 3, ["C....................C"]]] }),
      kf({ head: "happy", armL: "down", armR: "down", prop: "default" }, { angle: "side" }),
    ]),
  ],
});

// 8. 侦探 (男) — 死光放大镜 / 真相只有一个 / 问号弹幕 / 烟圈推理 / 瞬间变装
const detectiveHat = (g) => {
  stamp2x(g, 7, 2, ["....bbbbbbbb....", "...bbbbbbbbbb...", "...ddAAAAAAdd...", ".bbbbbbbbbbbbbb."]);
};
const detectiveRig = buildCharacterRig({
  gender: "male", hairStyle: "short", coat: "trench", boots: "brown", hatKind: "detective", extraHeadKinds: ["disguise"],
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
    // 死光放大镜（6大拍→24帧）：侧面俯身贴地寻脚印 → 举起放大镜 → 逼近细看 → 镜片死光反白 → 惊呼发现证据 → 正面记入笔记
    clip("inspect", "死光放大镜", [180, 165, 150, 155, 155, 180], [
      kf({ head: { dy: 2, variant: "normal" }, torso: "leanR", armL: "back", armR: "forwardLow", legL: "crouch", legR: "crouch", prop: { dy: 2, variant: "default" } }, { angle: "side" }),
      kf({ head: "normal", armL: "back", armR: "mid", prop: "default" }, { angle: "side" }),
      kf({ head: "normal", torso: "leanR", armL: "back", armR: "forward", prop: "bigLens" }, { angle: "side" }),
      kf({ head: "flash", torso: "leanR", armL: "mid", armR: "forward", legL: "stand", legR: "wide", prop: "flashLens" }, { angle: "side", fx: [[18, 5, ["W"]], [18, 15, ["W"]]] }),
      kf({ head: "glow", armL: "down", armR: "up", prop: "default" }, { angle: "front", fx: [[24, 4, ["YY", "YY", "..", "YY"]]] }),
      kf({ head: "blink", armL: "forward", armR: "mid", prop: "notebook" }, { angle: "front" }),
    ]),
    // 真相只有一个（6大拍→24帧）：背面背手沉思 → 突发灵感头顶惊叹号 → 猛然转正面帽飞一指 → 侧面补刀指认 → 扶帽微笑 → 自信亮眼
    clip("aha", "真相只有一个", [185, 160, 145, 145, 155, 185], [
      kf({ head: "normal", armL: "back", armR: "back", prop: false }, { angle: "back" }),
      kf({ head: "normal", armL: "down", armR: "mid", prop: "default" }, { angle: "back", fx: [[24, 5, [".YY.", ".YY.", ".YY.", "....", ".YY."]]] }),
      kf({ head: "hatlessShock", torso: "leanL", armL: "back", armR: "up", legL: "wide", legR: "stand", prop: "hatFloat" }, { angle: "front", fx: [[24, 2, ["YYYY", "YYYY", "YYYY", "....", "YYYY"]]] }),
      kf({ head: "hatless", torso: "leanR", armL: "mid", armR: { dy: -1, variant: "up" }, legL: "stand", legR: "wide", prop: { dx: 1, dy: -1, variant: "hatFloat" } }, { angle: "side", fx: [[2, 1, ["YYYY", "YYYY", "YYYY", "....", "YYYY"]], [25, 1, ["YYYY", "YYYY", "YYYY", "....", "YYYY"]]] }),
      kf({ head: "glow", armL: "down", armR: "up", prop: "default" }, { angle: "front", fx: [[24, 3, ["yYYy", ".YY.", ".YY.", "....", ".YY."]]] }),
      kf({ head: "happy", armL: "back", armR: "salute", prop: "default" }, { angle: "front" }),
    ]),
    // 问号弹幕（6大拍→24帧）：左侧面张望 → 右侧面张望 → 正面问号轰炸 → 灵光一闪破谜 → 迅速记录 → 自信合本
    clip("clues", "问号弹幕", [165, 150, 145, 150, 155, 180], [
      kf({ head: { dy: 1, variant: "normal" }, armL: "down", armR: "mid", prop: "notebook" }, { angle: "side", facing: "left", fx: [[24, 4, ["YYYY", "...Y", "..Y.", "....", "..Y."]]] }),
      kf({ head: { dx: -1, variant: "normal" }, torso: "leanL", armL: "mid", armR: "salute", prop: "notebook" }, { angle: "side", facing: "right", fx: [[2, 2, ["RRRR....................YYYY", "...R.......................Y", "..R.......................Y."]]] }),
      kf({ head: { dx: 1, variant: "glow" }, torso: "leanR", armL: "forward", armR: "mid", prop: { dy: -1, variant: "notebook" } }, { angle: "front", fx: [[1, 1, ["YYYY...................RRRR", "...Y......................R", "..Y......................R."]]] }),
      kf({ head: "flash", armL: "up", armR: "up", prop: "notebook" }, { angle: "front", fx: [[13, 1, ["YYYYY", ".YYY."]]] }),
      kf({ head: "happy", armL: "forward", armR: "mid", prop: "notebook" }, { angle: "side", fx: [[23, 5, ["..VV", "V.V."]]] }),
      kf({ head: "blink", armL: "down", armR: "down", prop: "notebook" }, { angle: "front" }),
    ]),
    // 烟圈推理（6大拍→24帧）：侧面点燃烟斗 → 吐出小烟圈 → 烟圈涨大 → 连环大烟圈 → 烟圈里灵光一闪 → 转正面满意点头
    clip("pipe", "烟圈推理", [180, 175, 165, 165, 165, 185], [
      kf({ head: "normal", armL: "back", armR: "mid", prop: "pipe" }, { angle: "side", fx: [[23, 14, [".F.", "YFY"]]] }),
      kf({ head: "blink", armL: "back", armR: "salute", prop: "pipe" }, { angle: "side", fx: [[23, 11, [".W.", "W.W", ".W."]]] }),
      kf({ head: { dy: -1, variant: "blink" }, armL: "back", armR: "down", prop: "pipe" }, { angle: "side", fx: [[22, 6, [".WWW.", "W...W", "W...W", ".WWW."]]] }),
      kf({ head: "blink", armL: "back", armR: "salute", prop: "pipe" }, { angle: "side", fx: [[21, 1, ["..WWW..", ".W...W.", "W.....W", ".W...W.", "..WWW.."]], [23, 10, [".W.", "W.W", ".W."]]] }),
      kf({ head: "glow", armL: "back", armR: "up", prop: "pipe" }, { angle: "side", fx: [[22, 3, ["Y.W.Y", ".WWW."]]] }),
      kf({ head: "happy", armL: "down", armR: "down", prop: "pipe" }, { angle: "front", fx: [[22, 4, [".wWw.", "w...w", ".wWw."]]] }),
    ]),
    // 瞬间变装（6大拍→24帧）：背面拉风衣遮身 → 侧面旋转烟幕 → 正面闪亮墨镜大胡子登场 → 侧面帅气扶墨镜 → 正面俏皮眨眼 → 摘装微笑
    clip("disguise", "瞬间变装", [175, 140, 180, 165, 165, 180], [
      kf({ head: "normal", armL: "mid", armR: "mid", prop: false }, { angle: "back" }),
      kf({ head: "normal", torso: "leanR", armL: "up", armR: "up", legL: "wide", legR: "wide", prop: false }, { angle: "side", fx: [[6, 9, ["w..W..w..W..w..W..w", ".W..w..W..w..W..w.."]]] }),
      kf({ head: "disguise", armL: "back", armR: "salute", prop: "default" }, { angle: "front" }),
      kf({ head: "disguise", torso: "leanL", armL: "back", armR: "salute", prop: "default" }, { angle: "side", fx: [[24, 6, ["Y..Y"]]] }),
      kf({ head: "disguise", armL: "mid", armR: "down", prop: "default" }, { angle: "front", fx: [[23, 5, ["Y.W.Y"]]] }),
      kf({ head: "happy", armL: "down", armR: "down", prop: "default" }, { angle: "front" }),
    ]),
  ],
});

// 9. 音乐家 (女) — 音符导弹 / 低音震屏 / 雷电独奏 / 破音飙高音 / 金属甩头
const musicianRig = buildCharacterRig({
  gender: "female", hairStyle: "long", coat: "jacket", hatKind: "headphones",
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
    // 音符导弹（6大拍→24帧）：侧面拨弦调音 → 点头起拍 → 狂扫吉他发射音符导弹 → 飞跃连扫 → 正面高举吉他谢幕 → 俏皮眨眼
    clip("strum", "音符导弹", [170, 150, 135, 135, 155, 180], [
      kf({ head: "blink", armL: "forward", armR: "forwardLow", prop: "default" }, { angle: "side", fx: [[24, 9, [".M"]]] }),
      kf({ head: "normal", armL: "forward", armR: { dy: -1, variant: "forward" }, legL: "stand", legR: "stand", prop: "default" }, { angle: "side", fx: [[2, 4, ["..MM", "..M.", ".MM."]]] }),
      kf({ head: { dy: 1, variant: "happy" }, torso: "leanL", armL: "forward", armR: { dy: 1, variant: "forward" }, legL: "step", legR: "stand", prop: "default" }, { angle: "side", fx: [[1, 2, [".YY.....................CC", ".Y......................C.", "YY.....................CC."]]] }),
      kf({ head: { dy: 0, variant: "glowM" }, torso: "leanR", armL: { dy: -1, variant: "forward" }, armR: { dy: -1, variant: "forward" }, legL: "stand", legR: "step", prop: { dy: -1, variant: "default" } }, { angle: "side", fx: [[1, 1, ["..CC...................MM.", "..C....................M..", ".CC...................MM.."]]] }),
      kf({ head: "happy", armL: "up", armR: "up", legL: "step", legR: "stand", prop: "guitarHigh" }, { angle: "front", fx: [[2, 3, [".MM...................YY", ".M....................Y.", "MM...................YY."]]] }),
      kf({ head: "blink", armL: "forward", armR: "forward", prop: "default" }, { angle: "front" }),
    ]),
    // 低音震屏（6大拍→24帧）：正面扶耳机数拍 → 双手按耳罩 → 左震屏低音 → 右震屏低音 → 侧面酷炫甩发 → 正面收拍微笑
    clip("bass", "低音震屏", [165, 145, 135, 135, 150, 175], [
      kf({ head: "normal", armL: "mid", armR: "salute", prop: false }, { angle: "front", fx: [[27, 7, ["C"]]] }),
      kf({ head: "blink", armL: "up", armR: "up", prop: false }, { angle: "front", fx: [[2, 7, [".C", "C.", "C.", ".C"]], [28, 7, ["C.", ".C", ".C", "C."]]] }),
      kf({ head: { dx: -1, variant: "glowC" }, torso: "leanL", armL: { dx: -1, variant: "up" }, armR: { dx: -1, variant: "up" }, legL: "wide", legR: "stand", prop: false }, { angle: "front", fx: [[0, 5, ["..M.", ".M.C", "M.C.", "M.C.", ".M.C"]], [28, 5, [".M..", "C.M.", ".C.M", ".C.M", "C.M."]]] }),
      kf({ head: { dx: 1, variant: "glowM" }, torso: "leanR", armL: { dx: 1, variant: "up" }, armR: { dx: 1, variant: "up" }, legL: "stand", legR: "wide", prop: false }, { angle: "front", fx: [[0, 6, [".Y.C", "Y.C.", "Y.C.", ".Y.C"]], [28, 6, ["C.Y.", ".C.Y", ".C.Y", "C.Y."]]] }),
      kf({ head: "glowC", torso: "leanR", armL: "back", armR: "up", prop: false }, { angle: "side", fx: [[23, 5, ["M.C.Y"]]] }),
      kf({ head: "happy", armL: "mid", armR: "mid", prop: "default" }, { angle: "front", fx: [[1, 7, [".M", "M.", ".M"]], [29, 7, ["M.", ".M", "M."]]] }),
    ]),
    // 雷电独奏（6大拍→24帧）：正面起范拨弦 → 侧面腾空劈雷 → 背面360°炫技甩发 → 侧面滑跪扫弦 → 正面定格欢呼 → 鞠躬谢幕
    clip("solo", "雷电独奏", [165, 140, 135, 140, 155, 180], [
      kf({ head: "shout", armL: "forward", armR: "mid", legL: "wide", legR: "wide", prop: "default" }, { angle: "front", fx: [[24, 4, ["..YY", ".YY.", "..Y."]]] }),
      kf({ head: { dy: -1, variant: "glow" }, torso: { dy: -1, variant: "leanR" }, armL: { dy: -1, variant: "forward" }, armR: { dy: -1, variant: "up" }, legL: { dy: -1, variant: "kick" }, legR: { dy: -1, variant: "kick" }, prop: { dy: -1, variant: "guitarHigh" } }, { angle: "side", shadow: "shrink", fx: [[1, 1, ["..YY...................YY.", ".YY.....................YY", "..Y.....................Y."]]] }),
      kf({ head: { dy: -2, variant: "glowM" }, torso: { dy: -2, variant: "leanL" }, armL: { dy: -2, variant: "up" }, armR: { dy: -2, variant: "up" }, legL: { dy: -2, variant: "kick" }, legR: { dy: -2, variant: "kick" }, prop: false }, { angle: "back", shadow: "tiny", fx: [[1, 0, ["Y..MM.................CC..Y", ".YY.M.................C.YY."]]] }),
      kf({ head: "glow", torso: "leanL", armL: "forward", armR: "mid", legL: "crouch", legR: "wide", prop: "default" }, { angle: "side", facing: "left", fx: [[2, 4, ["..YY..C..M.."]]] }),
      kf({ head: "happy", armL: "up", armR: "up", legL: "step", legR: "stand", prop: "guitarHigh" }, { angle: "front", fx: [[2, 3, ["Y..Y...................Y..Y"]]] }),
      kf({ head: "happy", armL: "forward", armR: "forward", prop: "default" }, { angle: "front" }),
    ]),
    // 破音飙高音（6大拍→24帧）：侧面拍麦清嗓 → 深吸气蓄力 → 开嗓飙高音 → 破音超级音浪 → 被声浪震懵 → 正面害羞捂嘴笑
    clip("mic", "破音飙高音", [170, 155, 145, 145, 155, 180], [
      kf({ head: "blink", armL: "down", armR: "mid", prop: "mic" }, { angle: "side" }),
      kf({ head: "normal", armL: "down", armR: "salute", prop: "mic" }, { angle: "side" }),
      kf({ head: "shout", torso: "leanL", armL: "mid", armR: "salute", prop: { dx: -1, dy: -1, variant: "mic" } }, { angle: "side", fx: [[25, 8, [".R.", "..R", "..R", ".R."]]] }),
      kf({ head: { dy: -1, variant: "shock" }, torso: "leanL", armL: "up", armR: { dx: -1, dy: -1, variant: "salute" }, legL: "wide", legR: "wide", prop: { dx: -1, dy: -2, variant: "mic" } }, { angle: "side", fx: [[24, 4, [".R..Y..", "..R..Y.", "...R..Y", "...R..Y", "..R..Y.", ".R..Y.."]]] }),
      kf({ head: "dizzy", armL: "mid", armR: "salute", prop: "mic" }, { angle: "side", fx: [[25, 9, ["Y.", ".Y", "Y."]]] }),
      kf({ head: "happy", armL: "forward", armR: "salute", prop: "mic" }, { angle: "front", fx: [[23, 8, ["C", "C"]]] }),
    ]),
    // 金属甩头（6大拍→24帧）：正面低头起鼓点 → 侧面右甩 → 侧面左甩出紫影 → 侧面右甩暴走 → 正面高举吉他 → 飙电眼定格
    clip("headbang", "金属甩头", [155, 130, 120, 120, 140, 175], [
      kf({ head: { dy: 2, variant: "blink" }, armL: "forward", armR: "forward", legL: "wide", legR: "wide", prop: "default" }, { angle: "front" }),
      kf({ head: { dy: 2, variant: "glowR" }, torso: "leanL", armL: "forward", armR: "mid", legL: "wide", legR: "wide", prop: "default" }, { angle: "side", facing: "right", fx: [[4, 2, ["F.......................F"]]] }),
      kf({ head: { dx: -1, dy: 3, variant: "glowR" }, torso: "leanL", armL: "back", armR: "up", legL: "wide", legR: "wide", prop: "default" }, { angle: "side", facing: "left", afterimage: { dx: 2, dy: -2, tint: "u" }, fx: [[1, 4, ["F.R.Y", ".FYF."]], [26, 4, ["Y.R.F", ".FYF."]]] }),
      kf({ head: { dx: 1, dy: -1, variant: "shout" }, torso: "leanR", armL: "up", armR: "back", legL: "wide", legR: "wide", prop: "guitarHigh" }, { angle: "side", facing: "right", afterimage: { dx: -2, dy: 2, tint: "y" }, fx: [[2, 1, ["R..F..Y..............Y..F..R"]]] }),
      kf({ head: "glowR", armL: "up", armR: "up", legL: "wide", legR: "wide", prop: "guitarHigh" }, { angle: "front", fx: [[4, 2, ["Y.......................Y"]]] }),
      kf({ head: "happy", armL: "forward", armR: "mid", prop: "default" }, { angle: "front" }),
    ]),
  ],
});

// 10. 消防员 (男) — 暴走水炮 / 迪斯科警灯 / 浓烟点赞 / 极速攀梯 / 泡沫狂喷
const firefighterRig = buildCharacterRig({
  gender: "male", hairStyle: "short", coat: "fire", hatKind: "fire",
  hatFn(g) { stamp2x(g, 7, 2, [".....YYYYYY.....", "...YYYYYYYYYY...", "..YYYYAAAAYYYY..", ".YYYYYYYYYYYYYY."]); },
  props: {
    default: partPatch(22, 20, ["gggY", "gggY"]),
    ladder: partPatch(24, 3, ["G..G", "GGGG", "G..G", "GGGG", "G..G", "GGGG", "G..G", "GGGG", "G..G", "GGGG", "G..G", "GGGG"]),
    extinguisher: partPatch(21, 16, ["..g.", "RRRR", "RRRR", "RRRR"]),
  },
  backProps: {
    ladder: partPatch(9, 1, [
      "GG..........GG", "GGGGGGGGGGGGGG", "GG..........GG", "GG..........GG",
      "GGGGGGGGGGGGGG", "GG..........GG", "GG..........GG", "GGGGGGGGGGGGGG",
      "GG..........GG", "GG..........GG", "GGGGGGGGGGGGGG", "GG..........GG",
      "GG..........GG", "GGGGGGGGGGGGGG", "GG..........GG", "GG..........GG",
      "GGGGGGGGGGGGGG", "GG..........GG", "GG..........GG", "GGGGGGGGGGGGGG",
      "GG..........GG", "GG..........GG", "GGGGGGGGGGGGGG", "GG..........GG",
      "GG..........GG", "GGGGGGGGGGGGGG", "GG..........GG",
    ], false),
  },
});
const firefighter = makeRiggedSprite({
  id: "firefighter", name: "消防员", gender: "male",
  palette: makePalette(SKIN.deep, { H: "#241d1a", h: "#453832", k: "#14100e" }),
  rig: firefighterRig,
  animations: [
    // 暴走水炮（6大拍→24帧）：侧面拧开水阀瞄准 → 初段水柱 → 高压水炮猛烈后坐 → 马步硬顶压制 → 关阀收管 → 转正面擦汗点赞
    clip("hose", "暴走水炮", [165, 145, 130, 130, 150, 180], [
      kf({ head: "normal", armL: "forward", armR: "forwardLow", legL: "wide", legR: "stand", prop: "default" }, { angle: "side" }),
      kf({ head: "normal", armL: "forward", armR: "mid", legL: "wide", legR: "stand", prop: "default" }, { angle: "side", fx: [[25, 18, ["..C..", "CCcCC", "..c.."]]] }),
      kf({ head: { dx: -1, variant: "shout" }, torso: "leanL", armL: "forward", armR: "mid", legL: "wide", legR: "wide", prop: { dx: -1, dy: 0, variant: "default" } }, { angle: "side", fx: [[22, 16, ["...c..W..", ".CCWWCCcC", "CWWCCWWCC", ".cCCWWcCC"]]] }),
      kf({ head: { dx: -2, variant: "shout" }, torso: { dx: -1, variant: "leanL" }, armL: { dx: -1, variant: "forward" }, armR: { dx: -1, variant: "mid" }, legL: "wide", legR: "kick", prop: { dx: -2, dy: -1, variant: "default" } }, { angle: "side", fx: [[20, 14, ["....C..c..W.", "..CCWWCCWWCC", "CCWWCCWWCCWW", "..cCCWWcCCWW"]]] }),
      kf({ head: "normal", torso: "leanL", armL: "forward", armR: "mid", legL: "wide", legR: "wide", prop: "default" }, { angle: "side", fx: [[24, 17, [".W.c.", "CcWWc", "CCcCW"]]] }),
      kf({ head: "happy", armL: "down", armR: "salute", prop: false }, { angle: "front", fx: [[23, 10, ["Y.Y"]]] }),
    ]),
    // 迪斯科警灯（6大拍→24帧）：正面按下头盔警灯 → 侧面右奔闪红蓝 → 正面跃起换向 → 侧面左奔 → 正面刹车停稳 → 帅气敬礼
    clip("siren", "迪斯科警灯", [160, 135, 135, 135, 145, 175], [
      kf({ head: "normal", armL: "down", armR: "salute", prop: false }, { angle: "front", fx: [[12, 0, ["RR..CC"]]] }),
      kf({ head: "normal", torso: "leanR", armL: "forward", armR: "back", legL: "step", legR: "stand", prop: false }, { angle: "side", facing: "right", fx: [[9, 0, ["RRRR......CC", "..RR....CC.."]]] }),
      kf({ head: "shout", torso: "leanR", armL: "back", armR: "forward", legL: "stand", legR: "step", prop: false }, { angle: "front", fx: [[9, 0, ["CC......RRRR", "..CC....RR.."]]] }),
      kf({ head: "normal", torso: "leanR", armL: "forward", armR: "back", legL: "kick", legR: "stand", prop: false }, { angle: "side", facing: "left", fx: [[5, 0, ["RR...RRRR...CC...CC", ".....RR.....CC....."]]] }),
      kf({ head: "shout", torso: "leanR", armL: "back", armR: "forward", legL: "stand", legR: "kick", prop: false }, { angle: "front", fx: [[5, 0, ["CC...CCCC...RR...RR", ".....CC.....RR....."]]] }),
      kf({ head: "happy", armL: "down", armR: "salute", prop: false }, { angle: "front", fx: [[10, 0, ["RR....CC"]]] }),
    ]),
    // 浓烟点赞（6大拍→24帧）：背面无畏冲入浓烟 → 背面挥手驱烟 → 侧面破烟而出亮拇指 → 正面阳光灿笑高举 → 帅气抱臂 → 敬礼致意
    clip("victory", "浓烟点赞", [175, 155, 155, 155, 160, 180], [
      kf({ head: "normal", armL: "down", armR: "mid", legL: "step", legR: "stand", prop: false }, { angle: "back", fx: [[23, 12, [".w..w.", "w....w"]]] }),
      kf({ head: "normal", torso: "leanR", armL: "mid", armR: "up", prop: false }, { angle: "back", fx: [[3, 2, ["w..w................w..w"]]] }),
      kf({ head: "glow", torso: "leanL", armL: "back", armR: "salute", prop: false }, { angle: "side", fx: [[3, 2, ["w..w................w..w"]], [22, 11, [".Y.Y.", "SYYYY"]]] }),
      kf({ head: "happy", armL: "mid", armR: "up", prop: false }, { angle: "front", fx: [[4, 3, ["w....w............w....w"]], [23, 9, ["Y.Y.Y", "SYYYY"]]] }),
      kf({ head: "happy", armL: "flex", armR: "flex", legL: "wide", legR: "wide", prop: false }, { angle: "front", fx: [[23, 12, [".Y.Y."]]] }),
      kf({ head: "happy", armL: "down", armR: "salute", prop: false }, { angle: "front" }),
    ]),
    // 极速攀梯（6大拍→24帧）：背面抓住底级仰望 → 左手右脚起攀 → 右手左脚攀升 → 极速登顶冒金星 → 登顶转侧面挥手报平安 → 稳步回位
    clip("ladder", "极速攀梯", [165, 145, 140, 140, 155, 175], [
      kf({ head: "normal", torso: "normal", armL: "forward", armR: "forward", legL: "stand", legR: "stand", prop: "ladder" }, { angle: "back", propZ: "back" }),
      kf({ head: "normal", torso: "normal", armL: "up", armR: "highOut", legL: "step", legR: "stand", prop: "ladder" }, { angle: "back", propZ: "back" }),
      kf({ head: { dy: -1, variant: "normal" }, torso: { dy: -1, variant: "normal" }, armL: { dy: -1, variant: "highOut" }, armR: { dy: -1, variant: "up" }, legL: { dy: -1, variant: "stand" }, legR: { dy: -1, variant: "step" }, prop: "ladder" }, { angle: "back", propZ: "back", shadow: "shrink", fx: [[4, 3, ["Y.Y"]]] }),
      kf({ head: { dy: -2, variant: "happy" }, torso: { dy: -2, variant: "normal" }, armL: { dy: -2, variant: "up" }, armR: { dy: -2, variant: "highOut" }, legL: { dy: -2, variant: "step" }, legR: { dy: -2, variant: "stand" }, prop: "ladder" }, { angle: "back", propZ: "back", shadow: "tiny", fx: [[2, 1, ["Y..Y"]]] }),
      kf({ head: { dy: -2, variant: "happy" }, torso: { dy: -2, variant: "normal" }, armL: { dy: -2, variant: "down" }, armR: { dy: -2, variant: "salute" }, legL: { dy: -2, variant: "stand" }, legR: { dy: -2, variant: "stand" }, prop: false }, { angle: "side", shadow: "tiny", fx: [[22, 4, ["Y..Y"]]] }),
      kf({ head: { dy: -1, variant: "normal" }, torso: { dy: -1, variant: "normal" }, armL: { dy: -1, variant: "highOut" }, armR: { dy: -1, variant: "up" }, legL: { dy: -1, variant: "stand" }, legR: { dy: -1, variant: "step" }, prop: "ladder" }, { angle: "back", propZ: "back", shadow: "shrink" }),
    ]),
    // 泡沫狂喷（6大拍→24帧）：侧面拔保险销准备 → 瞄准起喷 → 狂喷巨型白泡沫 → 弓步压枪覆盖 → 吹灭喷嘴余烟 → 正面自信微笑
    clip("extinguish", "泡沫狂喷", [170, 150, 135, 135, 155, 180], [
      kf({ head: "normal", armL: "forward", armR: "salute", prop: "extinguisher" }, { angle: "side", fx: [[22, 14, ["Y"]]] }),
      kf({ head: "normal", armL: "forward", armR: "mid", prop: "extinguisher" }, { angle: "side" }),
      kf({ head: "shout", torso: "leanL", armL: "forward", armR: "mid", legL: "wide", legR: "stand", prop: "extinguisher" }, { angle: "side", fx: [[23, 14, ["..WW..", "WWWWWW", "wWWWWw"]]] }),
      kf({ head: "shout", torso: "leanL", armL: "forward", armR: "mid", legL: "wide", legR: "wide", prop: { dx: -1, dy: 0, variant: "extinguisher" } }, { angle: "side", fx: [[21, 10, ["...WWWWWW...", "..WWWWWWWW..", ".WWWWWWWWWW.", "wWWWWWWWWWWw", ".WWWWWWWWWW."]]] }),
      kf({ head: "blink", armL: "down", armR: "mid", prop: "extinguisher" }, { angle: "side", fx: [[23, 13, [".w..w.", "w....w"]]] }),
      kf({ head: "happy", armL: "down", armR: "salute", prop: "extinguisher" }, { angle: "front" }),
    ]),
  ],
});

export const ROLES_A = { coder, doctor, chef, artist, scientist, astronaut, barista, detective, musician, firefighter };
