/** Legacy zodiac presets: no longer offered in the picker, but stored values keep rendering. */
export const ZODIAC_AVATARS = [
  { id: "aries", name: "白羊座" }, { id: "taurus", name: "金牛座" },
  { id: "gemini", name: "双子座" }, { id: "cancer", name: "巨蟹座" },
  { id: "leo", name: "狮子座" }, { id: "virgo", name: "处女座" },
  { id: "libra", name: "天秤座" }, { id: "scorpio", name: "天蝎座" },
  { id: "sagittarius", name: "射手座" }, { id: "capricorn", name: "摩羯座" },
  { id: "aquarius", name: "水瓶座" }, { id: "pisces", name: "双鱼座" },
] as const;

/** Legacy bot shapes: no longer offered in the picker; stored `bot:<shape>:<color>` values map cleanly onto pixel citizens. */
export const BOT_AVATAR_SHAPES = [
  { id: "round", name: "圆团" }, { id: "cloud", name: "云朵" }, { id: "tile", name: "方块" },
  { id: "sparkle", name: "星芒" }, { id: "clover", name: "四叶" }, { id: "chonk", name: "胖墩" },
  { id: "flower", name: "花朵" }, { id: "drop", name: "水滴" }, { id: "bean", name: "豆子" },
  { id: "triangle", name: "三角" }, { id: "gem", name: "宝石" }, { id: "cog", name: "齿轮" },
  { id: "hexagon", name: "六边" }, { id: "apple", name: "苹果" }, { id: "star", name: "星星" },
  { id: "heart", name: "爱心" }, { id: "blob", name: "软糖" }, { id: "ghost", name: "幽灵" },
] as const;

export type PixelGender = "male" | "female";

export const PIXEL_AVATAR_GENDERS = [
  { id: "all", name: "全部" },
  { id: "female", name: "女生" },
  { id: "male", name: "男生" },
] as const;

/** Pixel citizen roles across genders and professions; sprites & per-role animations live in web/src/pixel-avatar.js. */
export const PIXEL_AVATAR_ROLES = [
  { id: "coder", name: "程序员", gender: "male" as PixelGender, action: "敲代码", defaultColor: "blue" },
  { id: "doctor", name: "医生", gender: "female" as PixelGender, action: "听诊心跳", defaultColor: "teal" },
  { id: "chef", name: "厨师", gender: "male" as PixelGender, action: "颠勺起锅", defaultColor: "orange" },
  { id: "artist", name: "画家", gender: "female" as PixelGender, action: "挥毫泼彩", defaultColor: "pink" },
  { id: "scientist", name: "科学家", gender: "female" as PixelGender, action: "调配实验", defaultColor: "purple" },
  { id: "astronaut", name: "宇航员", gender: "male" as PixelGender, action: "失重漂浮", defaultColor: "sky" },
  { id: "barista", name: "咖啡师", gender: "female" as PixelGender, action: "手冲拉花", defaultColor: "brown" },
  { id: "detective", name: "侦探", gender: "male" as PixelGender, action: "勘查破案", defaultColor: "amber" },
  { id: "musician", name: "音乐家", gender: "female" as PixelGender, action: "弹唱律动", defaultColor: "red" },
  { id: "firefighter", name: "消防员", gender: "male" as PixelGender, action: "喷水救援", defaultColor: "red" },
  { id: "teacher", name: "教师", gender: "female" as PixelGender, action: "讲台授课", defaultColor: "green" },
  { id: "gardener", name: "园丁", gender: "male" as PixelGender, action: "浇水发芽", defaultColor: "green" },
  { id: "photographer", name: "摄影师", gender: "female" as PixelGender, action: "抓拍闪光", defaultColor: "black" },
  { id: "courier", name: "骑士", gender: "male" as PixelGender, action: "极速派送", defaultColor: "amber" },
  { id: "wizard", name: "魔法师", gender: "female" as PixelGender, action: "施放星魔法", defaultColor: "purple" },
  { id: "athlete", name: "运动员", gender: "male" as PixelGender, action: "运球冲刺", defaultColor: "orange" },
  { id: "pilot", name: "机长", gender: "female" as PixelGender, action: "起飞巡航", defaultColor: "blue" },
  { id: "mechanic", name: "工程师", gender: "male" as PixelGender, action: "拧紧维修", defaultColor: "gray" },
  { id: "baker", name: "烘焙师", gender: "female" as PixelGender, action: "点缀甜点", defaultColor: "pink" },
  { id: "ninja", name: "忍者", gender: "male" as PixelGender, action: "影分身瞬步", defaultColor: "red" },
] as const;

export const BOT_AVATAR_COLORS = [
  { id: "black", name: "黑色", hex: "#1d1d21" }, { id: "brown", name: "棕色", hex: "#94603d" },
  { id: "red", name: "红色", hex: "#f2374a" }, { id: "orange", name: "橙色", hex: "#ff6b25" },
  { id: "amber", name: "琥珀", hex: "#ffa424" }, { id: "green", name: "绿色", hex: "#1cc46f" },
  { id: "teal", name: "青色", hex: "#0fb4a3" }, { id: "blue", name: "蓝色", hex: "#3878fb" },
  { id: "purple", name: "紫色", hex: "#9b4ff0" }, { id: "pink", name: "粉色", hex: "#f2389d" },
  { id: "gray", name: "灰色", hex: "#7c7c84" }, { id: "sky", name: "天蓝", hex: "#30b4f0" },
] as const;

export const PIXEL_AVATAR_COLORS = BOT_AVATAR_COLORS;

export type BotAvatar = { shape: string; color: string; hex: string };
export type PixelAvatar = { role: string; color: string; hex: string; gender: PixelGender };

function fnv1a(seed: string) {
  let hash = 2166136261;
  for (const char of seed) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
  return hash;
}

/** `pixel:<role>:<color>` → parts, or undefined for anything else. */
export function parsePixelAvatar(value: unknown): PixelAvatar | undefined {
  if (typeof value !== "string") return undefined;
  const match = /^pixel:([a-z]+):([a-z]+)$/.exec(value);
  if (!match) return undefined;
  const role = PIXEL_AVATAR_ROLES.find((item) => item.id === match[1]);
  const color = PIXEL_AVATAR_COLORS.find((item) => item.id === match[2]);
  return role && color ? { role: role.id, color: color.id, hex: color.hex, gender: role.gender } : undefined;
}

export function pixelAvatarPreset(role: string, color: string) {
  return `pixel:${role}:${color}`;
}

/** Stable pixel citizen used when an employee has no explicit preset. */
export function defaultPixelAvatar(seed = ""): PixelAvatar {
  const hash = fnv1a(seed);
  const role = PIXEL_AVATAR_ROLES[hash % PIXEL_AVATAR_ROLES.length];
  const color = PIXEL_AVATAR_COLORS[(hash >>> 8) % PIXEL_AVATAR_COLORS.length];
  return { role: role.id, color: color.id, hex: color.hex, gender: role.gender };
}

/** `bot:<shape>:<color>` → legacy parts, or undefined for anything else. */
export function parseBotAvatar(value: unknown): BotAvatar | undefined {
  if (typeof value !== "string") return undefined;
  const match = /^bot:([a-z]+):([a-z]+)$/.exec(value);
  if (!match || !BOT_AVATAR_SHAPES.some(shape => shape.id === match[1])) return undefined;
  const color = BOT_AVATAR_COLORS.find(color => color.id === match[2]);
  return color && { shape: match[1], color: color.id, hex: color.hex };
}

export function botAvatarPreset(shape: string, color: string) {
  return `bot:${shape}:${color}`;
}

export function defaultBotAvatar(seed = ""): BotAvatar {
  const hash = fnv1a(seed);
  const shape = BOT_AVATAR_SHAPES[hash % BOT_AVATAR_SHAPES.length].id;
  const color = BOT_AVATAR_COLORS[(hash >>> 8) % BOT_AVATAR_COLORS.length];
  return { shape, color: color.id, hex: color.hex };
}

/** Resolve any stored avatar (pixel preset, legacy bot preset, or empty default) to a pixel citizen. */
export function resolvePixelAvatar(value: unknown, seed = ""): PixelAvatar {
  const pixel = parsePixelAvatar(value);
  if (pixel) return pixel;
  const legacy = parseBotAvatar(value);
  if (legacy) {
    const index = BOT_AVATAR_SHAPES.findIndex((shape) => shape.id === legacy.shape);
    const role = PIXEL_AVATAR_ROLES[Math.max(0, index) % PIXEL_AVATAR_ROLES.length];
    return { role: role.id, color: legacy.color, hex: legacy.hex, gender: role.gender };
  }
  return defaultPixelAvatar(seed);
}

export function isAvatarPreset(value: unknown): value is string {
  return typeof value === "string" && (
    value === "" ||
    ZODIAC_AVATARS.some(avatar => value === "zodiac:" + avatar.id) ||
    !!parseBotAvatar(value) ||
    !!parsePixelAvatar(value)
  );
}

/** Image URL for raster avatars; empty for default, pixel and legacy bot avatars, which render as inline SVG. */
export function employeeAvatarURL(employeeId?: string, avatar?: string) {
  if (!avatar) return "";
  if (avatar.startsWith("zodiac:") && isAvatarPreset(avatar)) return "/avatars/zodiac/" + avatar.slice(7) + ".webp";
  if (employeeId && /^blob-[a-f\d]{32}$/.test(avatar)) return `/api/employees/${encodeURIComponent(employeeId)}/avatar?v=${avatar}`;
  return "";
}

/** A user's uploaded avatar (blob id from /bootstrap or a group view); "" shows the initial instead. */
export function userAvatarURL(userId?: string, avatar?: string) {
  return userId && avatar && /^blob-[a-f\d]{32}$/.test(avatar) ? `/api/avatars/users/${encodeURIComponent(userId)}?v=${avatar}` : "";
}

/** 白字盖在这个填色上的对比度（WCAG）。用户气泡不用黑字，亮色只能压暗到白字可读。 */
function onWhite(hex: string) {
  const [r, g, b] = [1, 3, 5].map(at => Number.parseInt(hex.slice(at, at + 2), 16) / 255)
    .map(value => value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 1.05 / (0.2126 * r + 0.7152 * g + 0.0722 * b + 0.05);
}

/** A chosen avatar color as a fill plus its ink: bubbles always use white text, so a bright fill is deepened only as far as 4.5:1 needs. */
export function bubbleTint(hex: string) {
  const dim = (amount: number) => "#" + hex.slice(1).replace(/../g, (pair) => Math.round(Number.parseInt(pair, 16) * amount).toString(16).padStart(2, "0"));
  for (let amount = 1; amount > 0.4; amount -= 0.02) {
    const fill = amount === 1 ? hex : dim(amount);
    if (onWhite(fill) >= 4.5) return { fill, ink: "#fff" };
  }
  return { fill: dim(0.4), ink: "#fff" };
}

/** The fill and ink of my own message bubbles inside one employee's chat: that employee's avatar color, deepened only enough for white text. */
export function avatarBubble(avatar: unknown, seed = "") {
  return bubbleTint(resolvePixelAvatar(avatar, seed).hex);
}
