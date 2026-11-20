// Pixel citizen avatars: 20 hand-crafted 20×20 pixel-art characters spanning diverse genders and professions,
// each with its own independent multi-frame pixel animation and cadence.

export const PIXEL_GRID_SIZE = 20;

/** Mix a #rrggbb color toward white (amount > 0) or black (amount < 0). */
export function shade(hex, amount) {
  const clean = /^#[0-9a-fA-F]{6}$/.test(hex || "") ? hex : "#3878fb";
  const n = parseInt(clean.slice(1), 16), t = amount < 0 ? 0 : 255, k = Math.abs(amount);
  const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.round(v + (t - v) * k));
  return "#" + c.map((v) => v.toString(16).padStart(2, "0")).join("");
}

/** Parse a 20-line ASCII art grid into a mutable 20×20 character matrix. */
function grid(lines) {
  if (lines.length !== PIXEL_GRID_SIZE) throw Error(`Expected ${PIXEL_GRID_SIZE} rows, got ${lines.length}`);
  return lines.map((line, row) => {
    if (line.length !== PIXEL_GRID_SIZE) throw Error(`Row ${row} expected length ${PIXEL_GRID_SIZE}, got ${line.length}`);
    return [...line];
  });
}

function clone(src) {
  return src.map((row) => [...row]);
}

/** Shift all pixels except ground shadow `Z` by (dx, dy), keeping ground shadow optionally anchored or shrunk. */
function shiftBody(src, dx, dy, shadowMode = "keep") {
  const out = Array.from({ length: PIXEL_GRID_SIZE }, () => Array(PIXEL_GRID_SIZE).fill("."));
  for (let y = 0; y < PIXEL_GRID_SIZE; y++) {
    for (let x = 0; x < PIXEL_GRID_SIZE; x++) {
      const ch = src[y][x];
      if (ch === ".") continue;
      if (ch === "Z") {
        if (shadowMode === "keep") out[y][x] = "Z";
        continue;
      }
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && nx < PIXEL_GRID_SIZE && ny >= 0 && ny < PIXEL_GRID_SIZE) out[ny][nx] = ch;
    }
  }
  if (shadowMode === "shrink") {
    for (let x = 7; x <= 12; x++) out[18][x] = "Z";
  }
  return out;
}

/** Stamp a small patch onto a grid at (ox, oy). `.` keeps existing pixel, `_` erases to transparent. */
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

/** Close upper eye pixels on a given row for a crisp 1-frame blink. */
function blinkRow(target, y, fill = "S") {
  if (y < 0 || y >= PIXEL_GRID_SIZE) return target;
  for (let x = 5; x <= 14; x++) if (target[y][x] === "E") target[y][x] = fill;
  return target;
}

/** Walk-cycle leg swap helper: lifts left or right foot by 1px. */
function stepLegs(target, side) {
  if (side === "left") {
    stamp(target, 7, 16, ["OO", "__"]);
  } else if (side === "right") {
    stamp(target, 11, 16, ["OO", "__"]);
  }
  return target;
}

// Curated diverse skin & hair presets for natural, lively community variety.
const SKIN = {
  fair: { S: "#fde4cf", s: "#ecc0a2", P: "#f7a8a8", m: "#c87868" },
  peach: { S: "#fcd3b0", s: "#e5ac84", P: "#f49797", m: "#bd6b5b" },
  warm: { S: "#f1be94", s: "#d4976b", P: "#e88a7d", m: "#a95c4d" },
  tan: { S: "#d89a6a", s: "#b87a4c", P: "#d47969", m: "#8f4a3c" },
  deep: { S: "#b5744a", s: "#915532", P: "#b86457", m: "#6e3628" },
};

const BASE_PALETTE = {
  O: "#1e2330",
  E: "#161925",
  N: "#2f3c56",
  W: "#ffffff",
  w: "#cbd5e1",
  G: "#94a3b8",
  g: "#475569",
  B: "#7c4a2d",
  b: "#d9a76a",
  R: "#ef4444",
  r: "#b91c1c",
  Y: "#fbbf24",
  y: "#fef08a",
  C: "#22d3ee",
  c: "#a5f3fc",
  V: "#22c55e",
  v: "#15803d",
  M: "#ec4899",
  U: "#a855f7",
  u: "#d8b4fe",
  F: "#f97316",
  Z: "rgba(15, 23, 42, 0.14)",
};

function makePalette(skin, hair, extra = {}) {
  return (hex) => ({
    ...BASE_PALETTE,
    ...skin,
    ...hair,
    A: hex,
    a: shade(hex, 0.30),
    d: shade(hex, -0.30),
    ...extra,
  });
}

// ============================================================================
// 20 Hand-Crafted 20×20 Pixel Citizens (10 Female + 10 Male)
// Each citizen defines: gender, name, action (Chinese animation name),
// durations ([d0, d1, d2, d3] ms), palette(hex), and 4 distinct pixel frames.
// ============================================================================

// 1. 程序员 (男) — 敲代码：双手交替敲击键盘，发光屏幕变幻，头顶飘出绿色像素代码光点
const coderBase = grid([
  "....................",
  "....................",
  "......hhHHHh........",
  ".....HHHHHHHH.......",
  "....HHhHHHHHH.......",
  "....HHSSSSSSHH......",
  "....HSSSSSSSS.......",
  "....HOEOSSOEOS......",
  "....HSOOSSOOSS......",
  ".....SSSmmsSS.......",
  ".....ddAAAAAd.......",
  "....dAAAaaAAAd......",
  "....dAAggggAAd......",
  "....SAggCCggAS......",
  ".....AggCCggA.......",
  ".....gggggggg.......",
  "......NN..NN........",
  "......OO..OO........",
  ".....ZZZZZZZZ.......",
  "....................",
]);
const coderFrames = [
  coderBase,
  stamp(clone(coderBase), 0, 0, [
    ".......V............",
    "....................",
    "....................",
    "....................",
    "....................",
    "....................",
    "....................",
    "....................",
    "....................",
    "....................",
    "....................",
    "....................",
    "....S..gggg.........",
    ".....AggVVggAS......",
    ".....AggCCggA.......",
  ]),
  stamp(clone(coderBase), 0, 0, [
    "...........V........",
    "......V.............",
    "....................",
    "....................",
    "....................",
    "....................",
    "....................",
    "....................",
    "....................",
    "....................",
    "....................",
    "....................",
    ".......gggg..S......",
    "....SAggCVggA.......",
    ".....AggVCggA.......",
  ]),
  stamp(blinkRow(clone(coderBase), 7), 0, 0, [
    ".........V..........",
    "............C.......",
    "....................",
    "....................",
    "....................",
    "....................",
    "....................",
    "....................",
    "....................",
    "....................",
    "....................",
    "....................",
    "....S..gggg..S......",
    ".....AggCCggA.......",
    ".....AggVVggA.......",
  ]),
];

// 2. 医生 (女) — 听诊心跳：听诊器轻晃，身旁浮现搏动的红心心跳节奏（lub-dub）
const doctorBase = grid([
  "....................",
  "....................",
  "......WWWWWW........",
  ".....WWWRRWWW.......",
  ".....HHHHHHHHH......",
  "....HHhHHHHHHHh.....",
  "....HSSSSSSSSHH.....",
  "....HSEssssESHk.....",
  "....HPESssSEPHk.....",
  ".....SSSmmsSS.k.....",
  ".....WWAAAAWW.......",
  "....WWAGAAgAWW......",
  "....WWAWggWAWW......",
  "....SWWWggWWWS......",
  ".....WWWAAWWW.......",
  ".....wWWAAWWw.......",
  "......NN..NN........",
  "......OO..OO........",
  ".....ZZZZZZZZ.......",
  "....................",
]);
// Fix doctor face cleanly (skin S instead of s on forehead/bridge)
stamp(doctorBase, 5, 6, [
  "SSSSSSSS",
  "SESSSSES",
  "PESSSSEP",
  ".SSmmSS.",
]);
const doctorFrames = [
  doctorBase,
  stamp(shiftBody(doctorBase, 0, 0), 14, 5, [
    ".R.R.",
    "RRRRR",
    ".RRR.",
    "..R..",
  ]),
  stamp(clone(doctorBase), 15, 6, [
    "R.R",
    "RRR",
    ".R.",
  ]),
  stamp(blinkRow(clone(doctorBase), 7), 15, 3, [
    "R.R",
    "RRR",
    ".R.",
  ]),
];

// 3. 厨师 (男) — 颠勺起锅：厨师帽微微起伏，平底锅颠勺，火焰与热气翻腾
const chefBase = grid([
  "......WWWWWW........",
  ".....WWWWWWWW.......",
  ".....WWwWWwWW.......",
  "......WWWWWW........",
  "......wwwwww........",
  ".....HHHHHHHH.......",
  ".....HSSSSSSH.......",
  ".....SESSSSES.......",
  ".....SSSHHSSS.......",
  "......SSmmSS........",
  ".....WWAAAAWW.......",
  "....WWWWWAAWWW......",
  "....WWWWwWWWWW......",
  "....SWWWwWWWSgg.....",
  ".....WWWWWWWgggg....",
  ".....wWWWWWw.gg.....",
  "......NN..NN........",
  "......OO..OO........",
  ".....ZZZZZZZZ.......",
  "....................",
]);
const chefFrames = [
  chefBase,
  stamp(shiftBody(chefBase, 0, -1, "shrink"), 13, 8, [
    "...W..",
    "..W...",
    "....F.",
    "..FYF.",
    ".Sgggg",
    "__gggg",
    "______",
  ]),
  stamp(clone(chefBase), 13, 7, [
    "..W...",
    "...W..",
    "...Y..",
    "..FYF.",
    "..FFF.",
    "Sggggg",
    ".gggg.",
  ]),
  stamp(blinkRow(clone(chefBase), 7, "s"), 14, 8, [
    ".W...",
    "W....",
    "..F..",
    ".FY..",
  ]),
];

// 4. 画家 (女) — 挥毫泼彩：贝雷帽画师挥动画笔，空气中绽放红黄青三色颜料星点
const artistBase = grid([
  "....................",
  "........d...........",
  ".....aAAAAAA........",
  "....AAAAAAAAA.......",
  "....ddHHHHHHdd......",
  "...HHhHHHHHHhHH.....",
  "...HHSSSSSSSSHH.....",
  "...HHSESSSSESHH.....",
  "...HHPESSSSEPHH.....",
  "...HH.SSmmSS.HH.....",
  "...H.WWAAAAWW.H.....",
  "....WWAAAAAAWW..b...",
  "...bBWAAAAAAWWSb....",
  "..bRYBAAAAAAWWB.....",
  "..bVCBAAAAAAWW......",
  "....WWdAAAAdWW......",
  "......NN..NN........",
  "......OO..OO........",
  ".....ZZZZZZZZ.......",
  "....................",
]);
const artistFrames = [
  artistBase,
  stamp(clone(artistBase), 14, 7, [
    "..M..",
    "....Y",
    "..b..",
    ".b...",
    "Sb...",
    "_....",
  ]),
  stamp(shiftBody(artistBase, 0, -1, "shrink"), 14, 5, [
    ".C...",
    "...M.",
    "....Y",
    ".b...",
    "Sb...",
  ]),
  stamp(blinkRow(clone(artistBase), 7), 14, 6, [
    "...Y.",
    ".C...",
    "...b.",
    "..b..",
    ".Sb..",
  ]),
];

// 5. 科学家 (女) — 调配实验：摇晃发光烧瓶，荧光绿/青气泡咕嘟升腾
const scientistClean = grid([
  "....................",
  "....................",
  ".....hHHHHHHh.......",
  "....HHHHHHHHHH......",
  "....HgCCggCCgH......",
  "....HgCWggCWgH......",
  "....HSSSSSSSSH......",
  "....HSESSSSESH......",
  "....HPESSSSEPH......",
  ".....SSSmmsSS.......",
  ".....WWAAAAWW.......",
  "....WWAAAAAAWW..w...",
  "....WWWAAAAWWWS.w...",
  "....SWWAAAAWWwVw....",
  ".....WWAAAAWWVVV....",
  ".....wWAAAAWwVVV....",
  "......NN..NN........",
  "......OO..OO........",
  ".....ZZZZZZZZ.......",
  "....................",
]);
const scientistFrames = [
  scientistClean,
  stamp(clone(scientistClean), 15, 7, [
    "....",
    "..C.",
    "....",
    ".V..",
    ".w..",
    "Sw..",
    "wCw.",
    "CCC.",
    "VVV.",
  ]),
  stamp(clone(scientistClean), 15, 5, [
    "..V.",
    "....",
    ".C..",
    "....",
    "..V.",
    "....",
    ".w..",
    "Sw..",
    "wVw.",
    "CVC.",
  ]),
  stamp(blinkRow(clone(scientistClean), 7), 15, 3, [
    ".C..",
    "...V",
    "....",
    "..C.",
    "....",
    "....",
    ".w..",
    "Sw..",
    "wCw.",
  ]),
];

// 6. 宇航员 (男) — 失重漂浮：失重轻盈上下悬浮，头盔面罩扫过反光，星辰闪烁
const astronautBase = grid([
  "....................",
  "....................",
  ".....wWWWWWWw.......",
  "....WWWWWWWWWW......",
  "...WWgNNNNNNgWW.....",
  "...WWNCNNNNNNWW.....",
  "...WWNCCNNNNNWW.....",
  "...WWNNNNNNNNWW.....",
  "...WWgNNNNNNgWW.....",
  "....WWWWWWWWWW......",
  "....wWWAAAAWWw......",
  "...WWWWWAAWWWWW.....",
  "...WWWAWWWWaWWW.....",
  "...WWWWAAAAWWWW.....",
  "....wWWWWWWWWw......",
  ".....WWw..wWW.......",
  ".....WW....WW.......",
  ".....gg....gg.......",
  ".....ZZZZZZZZ.......",
  "....................",
]);
const astronautFrames = [
  stamp(clone(astronautBase), 1, 2, [
    "Y...................",
    "....................",
    ".................y..",
  ]),
  stamp(shiftBody(astronautBase, 0, -1, "shrink"), 0, 1, [
    "..y...............Y.",
    "....................",
    "....................",
    "......NWW...........",
    ".......NWC..........",
  ]),
  stamp(shiftBody(astronautBase, 0, -2, "shrink"), 0, 0, [
    ".................Y..",
    ".Y..................",
    "....................",
    ".......NNWW.........",
    "........NNWC........",
  ]),
  stamp(shiftBody(astronautBase, 0, -1, "shrink"), 0, 1, [
    "................y...",
    "..Y.................",
    "....................",
    "..........WW........",
    "...........C........",
  ]),
];

// 7. 咖啡师 (女) — 手冲拉花：手托热拿铁，S形热气袅袅上升，温柔眨眼
const baristaBase = grid([
  "....................",
  ".......HHHH.........",
  "......HHhHHH........",
  ".....dAAAAAAd.......",
  "....HHHHHHHHHH......",
  "....HSSSSSSSSH......",
  "....HSESSSSESH......",
  "....HPESSSSEPH......",
  ".....SSSmmsSS.......",
  "......WWAAWW........",
  ".....WWBBBBWW.......",
  "....WWBBBBBBWW......",
  "....SWBBaaBBWSBB....",
  ".....WBBBBBBWWWWw...",
  ".....WBBBBBBWWwW....",
  "......BBBBBB........",
  "......NN..NN........",
  "......OO..OO........",
  ".....ZZZZZZZZ.......",
  "....................",
]);
const baristaFrames = [
  stamp(clone(baristaBase), 15, 9, [
    ".W..",
    "W...",
    ".W..",
  ]),
  stamp(clone(baristaBase), 15, 7, [
    ".W..",
    "..W.",
    ".W..",
    "W...",
    "....",
    "SBB.",
    "WWWw",
  ]),
  stamp(blinkRow(clone(baristaBase), 6), 15, 6, [
    "..W.",
    ".W..",
    "..W.",
    ".W..",
    "....",
    "....",
    "SBB.",
  ]),
  stamp(shiftBody(baristaBase, 0, -1, "shrink"), 15, 8, [
    "W...",
    ".W..",
    "W...",
  ]),
];

// 8. 侦探 (男) — 勘查破案：举起放大镜左右搜寻，镜片闪过星芒，头顶灵光一现
const detectiveBase = grid([
  "....................",
  "......bbbbbb........",
  ".....bbbbbbbb.......",
  ".....dAAAAAAd.......",
  "...bbbbbbbbbbbb.....",
  "....HSSSSSSSSH......",
  "....HSESSSSESH......",
  "....HSSSSSSSSH......",
  ".....SSSmmsSS.......",
  ".....bbAAAAbb.......",
  "....bbBbAAbBbb......",
  "....bbBbAAbBbb.YY...",
  "....SbbBbbbBbSYCCY..",
  ".....bbBbbbBb.YCWY..",
  ".....bbbbbbbb..YY...",
  ".....bbbbbbbb.B.....",
  "......NN..NN........",
  "......OO..OO........",
  ".....ZZZZZZZZ.......",
  "....................",
]);
const detectiveFrames = [
  detectiveBase,
  stamp(clone(detectiveBase), 14, 9, [
    "..YY..",
    ".YWWY.",
    ".YCCY.",
    "..YY..",
    ".SB...",
    "______",
    "______",
  ]),
  stamp(clone(detectiveBase), 13, 3, [
    "..Y...",
    "..Y...",
    "......",
    "..Y...",
    "......",
    "......",
    "..YY..",
    ".YCWW.",
    ".YCCY.",
    "..YY..",
    ".SB...",
    "______",
    "______",
  ]),
  stamp(blinkRow(clone(detectiveBase), 6, "s"), 14, 10, [
    ".YY..",
    "YCWY.",
    "YCCY.",
    ".YY..",
    "SB...",
    "_____",
  ]),
];

// 9. 音乐家 (女) — 弹唱律动：佩戴大耳机弹吉他，随节拍左右律动，飘出彩色音符
const musicianBase = grid([
  "....................",
  "....................",
  ".....AAAAAAAA.......",
  "....AAHHHHHHAA......",
  "...AAHHhHHHHHAA.....",
  "...AAHSSSSSSHAA.....",
  "...AAHSESSSSEAA.....",
  "...ddHPESSSSEdd.....",
  "....HHSSmmSSHH......",
  "....H.dAAAAd.H......",
  "....HdAAAAAAdH......",
  "....HdAAbbbAdH......",
  "....SSbbBYBbbS......",
  ".....AbbBBBbb.......",
  ".....dAAbbbAd.......",
  "......NN..NN........",
  "......NN..NN........",
  "......OO..OO........",
  ".....ZZZZZZZZ.......",
  "....................",
]);
const musicianFrames = [
  stamp(clone(musicianBase), 1, 2, [
    ".MM",
    ".M.",
    "MM.",
  ]),
  stamp(shiftBody(musicianBase, 0, -1, "shrink"), 16, 1, [
    ".CC",
    ".C.",
    "CC.",
  ]),
  stamp(clone(musicianBase), 1, 1, [
    ".YY",
    ".Y.",
    "YY.",
  ]),
  stamp(shiftBody(blinkRow(clone(musicianBase), 6), 0, -1, "shrink"), 16, 2, [
    ".MM",
    ".M.",
    "MM.",
  ]),
];

// 10. 消防员 (男) — 喷水救援：黄色消防盔+反光条消防服，水枪喷射闪耀高压水柱
const firefighterBase = grid([
  "....................",
  ".......YYYY.........",
  ".....YYYYYYYY.......",
  "....YYYAAAAYYY......",
  "...YYYYYYYYYYYY.....",
  "....HSSSSSSSSH......",
  "....HSESSSSESH......",
  "....HSSSSSSSSH......",
  ".....SSSmmsSS.......",
  ".....dAAAAAAd.......",
  "....dAAAAAAAAd......",
  "....dYYYYYYYYd......",
  "....SAAAAAAAAgg.....",
  ".....dAAAAAAdYYC....",
  ".....YYYYYYYY.......",
  ".....dAAAAAAd.......",
  "......NN..NN........",
  "......OO..OO........",
  ".....ZZZZZZZZ.......",
  "....................",
]);
const firefighterFrames = [
  stamp(clone(firefighterBase), 15, 11, [
    "..C..",
    "CCcC.",
    "..c..",
  ]),
  stamp(shiftBody(firefighterBase, -1, 0), 14, 10, [
    "...c..",
    ".CCWW.",
    "CcCCcC",
    "..C..c",
  ]),
  stamp(clone(firefighterBase), 15, 10, [
    ".c.C.",
    "CWWCc",
    "CCcWW",
    "...c.",
  ]),
  stamp(blinkRow(clone(firefighterBase), 6, "s"), 15, 11, [
    "..W..",
    "CcCCc",
    ".c..C",
  ]),
];

// 11. 教师 (女) — 讲台授课：金丝眼镜教师手持书本教鞭，头顶亮起黄色灵感小灯泡
const teacherBase = grid([
  "....................",
  ".......HHHH.........",
  "......HHhHHH........",
  ".....HHHHHHHH.......",
  "....HHHHHHHHHH......",
  "....HSSSSSSSSH......",
  "....HYEYSSYEYH......",
  "....HPYSSSSYPH......",
  ".....SSSmmsSS.......",
  ".....WWAAAAWW.......",
  "....WWAAAAAAWW......",
  "....WWAAWWAAWW..b...",
  "...WWWWWAAWWWWSb....",
  "..WwwWWAAAAWWWb.....",
  "..WwwWAAAAAAWW......",
  ".....dAAAAAAd.......",
  "......NN..NN........",
  "......OO..OO........",
  ".....ZZZZZZZZ.......",
  "....................",
]);
const teacherFrames = [
  teacherBase,
  stamp(clone(teacherBase), 15, 2, [
    ".Y..",
    "YyY.",
    ".Y..",
    ".g..",
    "....",
    "....",
    "....",
    "..b.",
    ".b..",
    "Sb..",
  ]),
  stamp(clone(teacherBase), 14, 1, [
    "y.y.y",
    ".YYY.",
    "yYyYy",
    ".YYY.",
    "..g..",
    ".....",
    ".....",
    "....b",
    "...b.",
    "..b..",
    ".Sb..",
  ]),
  stamp(blinkRow(clone(teacherBase), 6, "s"), 15, 2, [
    ".Y..",
    "YyY.",
    ".Y..",
    ".g..",
  ]),
];

// 12. 园丁 (男) — 浇水发芽：戴草帽提喷壶浇水，身旁小绿苗长高开出粉色像素小花
const gardenerBase = grid([
  "....................",
  "......bbbbbb........",
  ".....bbbbbbbb.......",
  ".....dAAAAAAd.......",
  "..bbbbbbbbbbbbbb....",
  ".....SSSSSSSS.......",
  ".....SESSSSES.......",
  ".....SSSSSSSS.......",
  ".....BSSSSSSB.......",
  "......BBmmBB........",
  ".....WWAAAAWW.......",
  "....WWAAAAAAWW......",
  "....SWAAYYAAWSg.....",
  ".....WAAAAAAWggg....",
  ".....dAAAAAAd.gg....",
  "......AAAAAA....V...",
  "......NN..NN...vVv..",
  "......OO..OO....v...",
  ".....ZZZZZZZZ.......",
  "....................",
]);
const gardenerFrames = [
  gardenerBase,
  stamp(clone(gardenerBase), 14, 12, [
    "Sggg..",
    ".gg.C.",
    "....c.",
    "..V...",
    ".vVv..",
    "..v...",
  ]),
  stamp(clone(gardenerBase), 14, 11, [
    "......",
    "Sggg.c",
    ".gg.C.",
    "..M...",
    ".MYM..",
    ".vVv..",
    "..v...",
  ]),
  stamp(blinkRow(clone(gardenerBase), 6, "s"), 14, 12, [
    "Sggg..",
    ".gg...",
    "..M...",
    ".MYM..",
    ".vVv..",
    "..v...",
  ]),
];

// 13. 摄影师 (女) — 抓拍闪光：端起复古相机咔嚓抓拍，爆出耀眼十字闪光灯
const photographerBase = grid([
  "....................",
  "....................",
  ".....hHHHHHHh.......",
  "....HHHHHHHHHH......",
  "....HHHHHHHHHH......",
  "...HHSSSSSSSSHH.....",
  "...HHSESSSSESHH.....",
  "...HHPESSSSEPHH.....",
  "...HH.SSmmSS.HH.....",
  ".....dAAAAAAd.......",
  "....dAAAOOAAAd......",
  "....dAOOggOOAd......",
  "....SOggCCggOS......",
  ".....SOggggOS.......",
  ".....dAAAAAAd.......",
  "......AAAAAA........",
  "......NN..NN........",
  "......OO..OO........",
  ".....ZZZZZZZZ.......",
  "....................",
]);
const photographerFrames = [
  photographerBase,
  stamp(shiftBody(photographerBase, 0, -1, "shrink"), 6, 8, [
    "....y...",
    "....W...",
    "..yWWWy.",
    "yWWWWWWy",
    "..yWWWy.",
    "....W...",
    "....y...",
  ]),
  stamp(clone(photographerBase), 7, 10, [
    "...W..",
    "..yWy.",
    "...W..",
  ]),
  blinkRow(clone(photographerBase), 6),
];

// 14. 骑士 (男) — 极速派送：流线头盔+包裹箱，极速前倾冲刺，身后拉出白色速度线
const courierBase = grid([
  "....................",
  "......AAAAAA........",
  ".....aAAAAAAA.......",
  "....AAAAACCCCC......",
  "....AAAACWWCCC......",
  "....dASSSSSSS.......",
  ".....SSESSSES.......",
  ".....SSSSSSSS.......",
  "......SSmmSS........",
  ".....dAAAAAAd.......",
  "....dAAWWWWAAd......",
  "....dAAAAAAAAd......",
  "....SAAAbbbbbb......",
  ".....AAAbBBbbb......",
  ".....dAAbbbbbb......",
  "......NN..NN........",
  "......NN..NN........",
  "......OO..OO........",
  ".....ZZZZZZZZ.......",
  "....................",
]);
const courierFrames = [
  stamp(clone(courierBase), 0, 10, [
    "WW..",
    "....",
    ".CCC",
  ]),
  stamp(stepLegs(shiftBody(courierBase, 1, -1, "shrink"), "left"), 0, 8, [
    "CCC.",
    "....",
    "WW..",
    "....",
    ".WW.",
  ]),
  stamp(stepLegs(clone(courierBase), "right"), 0, 9, [
    ".WW.",
    "....",
    "CCC.",
    "....",
    "WW..",
  ]),
  stamp(stepLegs(shiftBody(blinkRow(clone(courierBase), 6, "s"), 1, -1, "shrink"), "left"), 0, 8, [
    "WW..",
    "....",
    ".CCC",
    "....",
    "WW..",
  ]),
];

// 15. 魔法师 (女) — 施放星魔法：尖顶星帽女巫举起宝石法杖，星光绕身流转
const wizardBase = grid([
  ".........A..........",
  "........AAA.........",
  ".......AAYAA........",
  "......AAAAAAA.......",
  "....ddYYYYYYYdd.....",
  "...HHhHHHHHHhHH.....",
  "...HHSSSSSSSSHH.....",
  "...HHSESSSSESHH.....",
  "...HHPESSSSEPHH.....",
  "...HH.SSmmSS.HH..C..",
  "...H.dAAAAAAd.H.CBC.",
  "....dAAAAAAAAd...B..",
  "....SAAAaaAAAS..B...",
  ".....AAAAAAAA..B....",
  ".....dAAaaAAd..B....",
  ".....dAAAAAAd.......",
  "......NN..NN........",
  "......OO..OO........",
  ".....ZZZZZZZZ.......",
  "....................",
]);
const wizardFrames = [
  stamp(clone(wizardBase), 1, 2, [
    "Y..",
    "...",
    "..u",
  ]),
  stamp(clone(wizardBase), 0, 0, [
    "..Y.............Y...",
    "....................",
    ".................u..",
    "....................",
    "....................",
    "....................",
    "....................",
    "................Y...",
    "...............YMY..",
    "................Y...",
    "...............SB...",
  ]),
  stamp(shiftBody(wizardBase, 0, -1, "shrink"), 0, 0, [
    "................Y...",
    ".u..................",
    "....................",
    "....................",
    "....................",
    "....................",
    "....................",
    "...............C....",
    "..............CYC...",
    "...............C....",
  ]),
  stamp(blinkRow(clone(wizardBase), 7), 1, 1, [
    ".u..............u",
    ".................",
    "Y................",
  ]),
];

// 16. 运动员 (男) — 运球冲刺：戴发带球衣，膝盖弹性律动，篮球拍地回弹带出动感残影
const athleteBase = grid([
  "....................",
  "....................",
  ".....hHHHHHHh.......",
  "....HHHHHHHHHH......",
  "....dAAAAAAAAd......",
  "....HSSSSSSSSH......",
  "....HSESSSSESH......",
  "....HSSSSSSSSH......",
  ".....SSSmmsSS.......",
  ".....dAAAAAAd.......",
  "....SAAAWWAAAS......",
  "....SAAAWWAAAS......",
  ".....AAAAAAAA..FF...",
  ".....dAAAAAAd.FBBF..",
  "......NN..NN...FF...",
  "......NN..NN........",
  "......SS..SS........",
  "......WW..WW........",
  ".....ZZZZZZZZ.......",
  "....................",
]);
const athleteFrames = [
  athleteBase,
  stamp(shiftBody(athleteBase, 0, 1, "keep"), 14, 12, [
    "____",
    "____",
    ".w..",
    ".FF.",
    "FBBF",
    ".FF.",
  ]),
  stamp(clone(athleteBase), 14, 12, [
    "____",
    "____",
    "____",
    ".w..",
    "FBBF",
    ".FF.",
  ]),
  stamp(shiftBody(blinkRow(clone(athleteBase), 6, "s"), 0, -1, "shrink"), 14, 11, [
    ".FF.",
    "FBBF",
    ".FF.",
    ".w..",
    "____",
    "____",
  ]),
];

// 17. 机长 (女) — 起飞巡航：金徽机长帽+酷炫飞行员墨镜，抬手敬礼，像素白云飘过
const pilotBase = grid([
  "....................",
  "......AAAAAA........",
  ".....AAAYYAAA.......",
  "....dAAAAAAAAd......",
  "....OOOOOOOOOO......",
  "...HHSSSSSSSSHH.....",
  "...HHOOOSSOOOHH.....",
  "...HHOOOSSOOOHH.....",
  "...HH.SSmmSS.HH.....",
  ".....YYAAAAYY.......",
  "....dAAAWWAAAd......",
  "....dAAAWWAAAd......",
  "....SAAAOOAAAS......",
  ".....AAAAAAAA.......",
  ".....dAAYYAAd.......",
  "......NN..NN........",
  "......NN..NN........",
  "......OO..OO........",
  ".....ZZZZZZZZ.......",
  "....................",
]);
const pilotFrames = [
  stamp(clone(pilotBase), 1, 2, [
    ".WW.",
    "WWWW",
  ]),
  stamp(clone(pilotBase), 0, 1, [
    "..WW............WW..",
    ".WWWW..........WWWW.",
    "....................",
    "....................",
    "....................",
    ".....W....W.........",
    "......W....W........",
  ]),
  stamp(clone(pilotBase), 0, 2, [
    "...WW..........WW...",
    "..WWWW........WWWW..",
    "....................",
    "..............S.....",
    "......W....W.SS.....",
    ".......W....W.......",
  ]),
  stamp(clone(pilotBase), 0, 1, [
    "....WW........WW....",
    "...WWWW......WWWW...",
  ]),
];

// 18. 工程师 (男) — 拧紧维修：黄色安全帽工装服，用力拧动大扳手，迸出金色维修火花
const mechanicBase = grid([
  "....................",
  ".......YYYY.........",
  ".....YYYYYYYY.......",
  "....YYYYyYYYYY......",
  "...YYYYYYYYYYYY.....",
  "....HSSSSSSSSH......",
  "....HSESSSSESH......",
  "....HSSSSSSSSH......",
  ".....SSSmmsSS.......",
  ".....dAAAAAAd.......",
  "....dAAAAAAAAd..G.G.",
  "....dAAYAAYAAd..GGG.",
  "....SAAAAAAAAd...G..",
  ".....AAAAAAAA...SG..",
  ".....dAAAAAAd.......",
  "......NN..NN........",
  "......NN..NN........",
  "......OO..OO........",
  ".....ZZZZZZZZ.......",
  "....................",
]);
const mechanicFrames = [
  mechanicBase,
  stamp(clone(mechanicBase), 14, 8, [
    "...Y..",
    "..G.G.",
    "..GGG.",
    "...G..",
    "..SG..",
    "______",
    "______",
  ]),
  stamp(shiftBody(mechanicBase, 0, 1, "keep"), 14, 9, [
    ".Y..F.",
    "..G.G.",
    ".YGGG.",
    "...G..",
    "..SG..",
    "______",
  ]),
  stamp(blinkRow(clone(mechanicBase), 6, "s"), 14, 8, [
    "....Y.",
    "..G.G.",
    "..GGG.",
    "...G..",
    "..SG..",
  ]),
];

// 19. 烘焙师 (女) — 点缀甜点：蝴蝶结发带+甜点围裙，手端樱桃纸杯蛋糕，粉色星光升起
const bakerBase = grid([
  "....................",
  ".....AA....AA.......",
  ".....AAAaaAAA.......",
  ".....HHHHHHHH.......",
  "....HHhHHHHHHh......",
  "...HHSSSSSSSSHH.....",
  "...HHSESSSSESHH.....",
  "...HHPESSSSEPHH.....",
  "...HH.SSmmSS.HH.....",
  ".....WWAAAAWW.......",
  "....WWAAAAAAWW...R..",
  "....WWAAWWAAWW..MMM.",
  "....SWAAWWAAWS.WWWWW",
  ".....WAAWWAAW...bbb.",
  ".....WWWWWWWW...bbb.",
  "......AAAAAA........",
  "......NN..NN........",
  "......OO..OO........",
  ".....ZZZZZZZZ.......",
  "....................",
]);
const bakerFrames = [
  bakerBase,
  stamp(shiftBody(bakerBase, 0, -1, "shrink"), 15, 6, [
    "..M.",
    "....",
    "Y...",
  ]),
  stamp(clone(bakerBase), 15, 5, [
    ".Y..",
    "...M",
    "....",
    ".W..",
  ]),
  stamp(blinkRow(clone(bakerBase), 6), 15, 6, [
    "...Y",
    ".M..",
    "....",
  ]),
];

// 20. 忍者 (男) — 影分身瞬步：红/主题色飘带猎猎飞舞，旋转手里剑泛起忍术烟雾
const ninjaBase = grid([
  "....................",
  "....................",
  ".....OOOOOOOO.......",
  "....OOOOOOOOOO......",
  "...dAAAAAAAAAAd.....",
  "..aAOOSSSSSSOO......",
  ".a..OOSEssESOO......",
  "....OOOOOOOOOO......",
  "....OOgOOOOgOO......",
  ".....OOOOOOOO.......",
  "....OOOOAAOOOO......",
  "....OOOAAAAOOO..G...",
  "....SOOOAAOOOS.GWG..",
  ".....OOOOOOOO...G...",
  ".....dAAAAAAd.......",
  "......OO..OO........",
  "......OO..OO........",
  "......gg..gg........",
  ".....ZZZZZZZZ.......",
  "....................",
]);
stamp(ninjaBase, 7, 6, ["ESSSSE"]);
const ninjaFrames = [
  ninjaBase,
  stamp(clone(ninjaBase), 0, 4, [
    "aA.d................",
    "....OO..............",
    "__..................",
    "....................",
    "....................",
    "....................",
    "...............G.G..",
    "................W...",
    "...............G.G..",
  ]),
  stamp(shiftBody(ninjaBase, 0, -1, "shrink"), 0, 3, [
    "....................",
    "aAAd................",
    "....................",
    "....................",
    "....................",
    "....................",
    "................G...",
    "...............GWG..",
    "................G...",
    "..............w...w.",
  ]),
  stamp(clone(ninjaBase), 0, 4, [
    ".aAd................",
    "a...................",
    "....................",
    "....................",
    "....................",
    "....................",
    "...............G.G..",
    "..............w.W.w.",
    "...............G.G..",
  ]),
];

export const PIXEL_SPRITES = {
  coder: {
    id: "coder", name: "程序员", gender: "male", action: "敲代码",
    durations: [230, 190, 230, 260],
    palette: makePalette(SKIN.peach, { H: "#3b2c25", h: "#5e463a", k: "#261b16" }),
    frames: coderFrames,
  },
  doctor: {
    id: "doctor", name: "医生", gender: "female", action: "听诊心跳",
    durations: [440, 150, 170, 400],
    palette: makePalette(SKIN.fair, { H: "#5c3828", h: "#85533d", k: "#3d2318" }),
    frames: doctorFrames,
  },
  chef: {
    id: "chef", name: "厨师", gender: "male", action: "颠勺起锅",
    durations: [260, 220, 220, 260],
    palette: makePalette(SKIN.warm, { H: "#4a3228", h: "#6e4b3c", k: "#2d1e18" }),
    frames: chefFrames,
  },
  artist: {
    id: "artist", name: "画家", gender: "female", action: "挥毫泼彩",
    durations: [280, 240, 280, 240],
    palette: makePalette(SKIN.fair, { H: "#9c422c", h: "#c45b41", k: "#6e2b1b" }),
    frames: artistFrames,
  },
  scientist: {
    id: "scientist", name: "科学家", gender: "female", action: "调配实验",
    durations: [270, 250, 250, 300],
    palette: makePalette(SKIN.peach, { H: "#4c4668", h: "#736b99", k: "#312d45" }),
    frames: scientistFrames,
  },
  astronaut: {
    id: "astronaut", name: "宇航员", gender: "male", action: "失重漂浮",
    durations: [360, 360, 360, 360],
    palette: makePalette(SKIN.warm, { H: "#2d3748", h: "#4a5568", k: "#1a202c" }),
    frames: astronautFrames,
  },
  barista: {
    id: "barista", name: "咖啡师", gender: "female", action: "手冲拉花",
    durations: [320, 320, 320, 320],
    palette: makePalette(SKIN.tan, { H: "#2e201b", h: "#4f372e", k: "#1a110e" }),
    frames: baristaFrames,
  },
  detective: {
    id: "detective", name: "侦探", gender: "male", action: "勘查破案",
    durations: [360, 260, 360, 240],
    palette: makePalette(SKIN.peach, { H: "#4a3b32", h: "#6b5649", k: "#2e241f" }),
    frames: detectiveFrames,
  },
  musician: {
    id: "musician", name: "音乐家", gender: "female", action: "弹唱律动",
    durations: [220, 220, 220, 220],
    palette: makePalette(SKIN.fair, { H: "#27274a", h: "#43437a", k: "#171730" }),
    frames: musicianFrames,
  },
  firefighter: {
    id: "firefighter", name: "消防员", gender: "male", action: "喷水救援",
    durations: [190, 190, 190, 190],
    palette: makePalette(SKIN.deep, { H: "#241d1a", h: "#40342e", k: "#14100e" }),
    frames: firefighterFrames,
  },
  teacher: {
    id: "teacher", name: "教师", gender: "female", action: "讲台授课",
    durations: [340, 260, 340, 260],
    palette: makePalette(SKIN.warm, { H: "#5e3d2b", h: "#855840", k: "#3d261a" }),
    frames: teacherFrames,
  },
  gardener: {
    id: "gardener", name: "园丁", gender: "male", action: "浇水发芽",
    durations: [320, 280, 280, 360],
    palette: makePalette(SKIN.tan, { H: "#5c4028", h: "#825d3c", k: "#3b2818" }),
    frames: gardenerFrames,
  },
  photographer: {
    id: "photographer", name: "摄影师", gender: "female", action: "抓拍闪光",
    durations: [420, 130, 180, 360],
    palette: makePalette(SKIN.peach, { H: "#232533", h: "#3e4259", k: "#141620" }),
    frames: photographerFrames,
  },
  courier: {
    id: "courier", name: "骑士", gender: "male", action: "极速派送",
    durations: [165, 165, 165, 165],
    palette: makePalette(SKIN.warm, { H: "#2e2621", h: "#4d4038", k: "#1c1714" }),
    frames: courierFrames,
  },
  wizard: {
    id: "wizard", name: "魔法师", gender: "female", action: "施放星魔法",
    durations: [280, 260, 260, 280],
    palette: makePalette(SKIN.fair, { H: "#6d59a8", h: "#9985d6", k: "#4a3b78" }),
    frames: wizardFrames,
  },
  athlete: {
    id: "athlete", name: "运动员", gender: "male", action: "运球冲刺",
    durations: [195, 165, 195, 165],
    palette: makePalette(SKIN.deep, { H: "#1f1d24", h: "#3b3745", k: "#111014" }),
    frames: athleteFrames,
  },
  pilot: {
    id: "pilot", name: "机长", gender: "female", action: "起飞巡航",
    durations: [340, 280, 340, 280],
    palette: makePalette(SKIN.peach, { H: "#362723", h: "#59413b", k: "#1f1614" }),
    frames: pilotFrames,
  },
  mechanic: {
    id: "mechanic", name: "工程师", gender: "male", action: "拧紧维修",
    durations: [230, 200, 230, 250],
    palette: makePalette(SKIN.warm, { H: "#423026", h: "#664b3c", k: "#291d17" }),
    frames: mechanicFrames,
  },
  baker: {
    id: "baker", name: "烘焙师", gender: "female", action: "点缀甜点",
    durations: [280, 260, 280, 260],
    palette: makePalette(SKIN.fair, { H: "#b56947", h: "#d98b68", k: "#85482e" }),
    frames: bakerFrames,
  },
  ninja: {
    id: "ninja", name: "忍者", gender: "male", action: "影分身瞬步",
    durations: [200, 175, 200, 175],
    palette: makePalette(SKIN.peach, { H: "#1e2330", h: "#374151", k: "#111827" }),
    frames: ninjaFrames,
  },
};

export const PIXEL_ROLE_IDS = Object.keys(PIXEL_SPRITES);

/** Compile a 20×20 character matrix into compact horizontal-run SVG paths grouped by color. */
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
      const fill = paletteMap[ch];
      const seg = `M${x} ${y}h${end - x}v1h${x - end}z`;
      const existing = runs.get(fill);
      if (existing) existing.push(seg);
      else runs.set(fill, [seg]);
      x = end;
    }
  }
  const layers = [];
  let index = 0;
  for (const [fill, segments] of runs) {
    layers.push({ key: `${index++}-${fill}`, fill, d: segments.join("") });
  }
  return layers;
}

const frameCache = new Map();

/** Render (and cache) one frame of a pixel citizen as a soft tinted badge + crisp SVG pixel paths. */
export function renderPixelFrame(roleId, hex = "#3878fb", frameIndex = 0) {
  const sprite = PIXEL_SPRITES[roleId] || PIXEL_SPRITES.coder;
  const color = /^#[0-9a-fA-F]{6}$/.test(hex || "") ? hex : "#3878fb";
  const index = ((frameIndex % sprite.frames.length) + sprite.frames.length) % sprite.frames.length;
  const cacheKey = `${sprite.id}|${color}|${index}`;
  const cached = frameCache.get(cacheKey);
  if (cached) return cached;
  const paletteMap = sprite.palette(color);
  const rendered = {
    bg: shade(color, 0.87),
    border: shade(color, 0.72),
    layers: compileGrid(sprite.frames[index], paletteMap),
  };
  frameCache.set(cacheKey, rendered);
  return rendered;
}

/** Return the sprite metadata for a role id (falling back to coder). */
export function getPixelSprite(roleId) {
  return PIXEL_SPRITES[roleId] || PIXEL_SPRITES.coder;
}
