import { randomBytes, randomInt } from "node:crypto";
import { beijingDateTime, beijingParts } from "../../shared/time";
import type { MoodWeatherId } from "../../shared/mood-weather";
import type { Store } from "./store";

/**
 * 内部隐式养成模块：为每位热心市民提供随机灵魂性格、分用户好感度与连续 2D 情绪模型。
 *
 * 严格隔离约束：
 * - 数据独立存放于 objects 表的内部 kind（employee-soul / employee-bond），不进入 EmployeeProfile/State。
 * - 不写入 session.frozenSystem、messages、memories、工作原则或任何前端/调试 API 返回体。
 * - 仅在模型请求内存态合成为极简自然语感指导，不含数值、枚举或元叙事术语。
 */

export const SOUL_KIND = "employee-soul";
export const BOND_KIND = "employee-bond";

export type PersonalityId =
  // 温暖亲和系
  | "sunshine"
  | "gentle_caretaker"
  | "cheerful_joker"
  | "loyal_puppy"
  // 理性专业系
  | "calm_mentor"
  | "perfectionist"
  | "minimalist_cool"
  | "scholarly_nerd"
  // 个性反差系
  | "tsundere"
  | "sarcastic_wit"
  | "deadpan_funny"
  | "rebellious_cat"
  // 感性创意系
  | "curious_spark"
  | "poetic_dreamer"
  | "dramatic_soul"
  | "zen_chill"
  // 职场搭档系
  | "workaholic_ace"
  | "sly_fox";

export type TraitId =
  | "night_owl"
  | "early_bird"
  | "praise_seeker"
  | "slow_burn"
  | "fast_bond"
  | "detail_obsessed"
  | "life_metaphor"
  | "emoji_none"
  | "emoji_light"
  | "group_shy"
  | "group_lively"
  | "grudge_light";

export type MoodId =
  // 正效价 · 高唤醒
  | "excited"
  | "proud"
  | "playful"
  | "curious"
  // 正效价 · 低唤醒
  | "content"
  | "warm"
  | "focused"
  | "serene"
  // 负效价 · 高唤醒
  | "annoyed"
  | "stressed"
  | "flustered"
  | "defensive"
  // 负效价 · 低唤醒
  | "tired"
  | "deflated"
  | "lonely"
  | "bored";

export type RelationshipStage =
  | "hostile"
  | "wary"
  | "stranger"
  | "acquaintance"
  | "friendly"
  | "trusted"
  | "soulmate";

export type MoodHint =
  | "praised"
  | "cared"
  | "playful"
  | "curious"
  | "rude"
  | "impatient"
  | "corrected"
  | "task_done"
  | "task_failed"
  | "task_stopped"
  | "reunion"
  | "overload"
  | "repetitive"
  | "flustered_praise";

export type MoodIntensity = "subtle" | "moderate" | "vivid";
export type ToneChannel = "private" | "group" | "task";

export type EmployeeSoul = {
  version: 1;
  employeeId: string;
  personality: PersonalityId;
  traits: TraitId[];
  baseline: {
    warmth: number;
    volatility: number;
    sociability: number;
  };
  mood: {
    valence: number;
    arousal: number;
    hint?: MoodHint;
    updatedAt: number;
  };
  activity: {
    recentTurns: number[];
    lastSignalText?: string;
    repeatCount?: number;
  };
  createdAt: number;
};

export type EmployeeBond = {
  version: 1;
  employeeId: string;
  peerKey: string;
  isOwner: boolean;
  affinity: number;
  stage: RelationshipStage;
  peakStage: RelationshipStage;
  totalTurns: number;
  activeDays: number;
  lastActiveDate: string;
  streakDays: number;
  dailyGainDate: string;
  dailyGain: number;
  dailyPraiseDate: string;
  dailyPraiseCount: number;
  tasksDone: number;
  tasksFailed: number;
  userMoodDelta: {
    valence: number;
    arousal: number;
    hint?: MoodHint;
    updatedAt: number;
  };
  firstMetAt: number;
  lastInteractAt: number;
};

type StageBand = "distant" | "neutral" | "warm" | "close";

type PersonalitySpec = {
  id: PersonalityId;
  baseline: { warmth: number; volatility: number; sociability: number };
  moodBase: { valence: number; arousal: number };
  flusteredByPraise?: boolean;
  voice: Record<StageBand, string>;
  taskVoice: string;
};

export const PERSONALITIES: Record<PersonalityId, PersonalitySpec> = {
  sunshine: {
    id: "sunshine",
    baseline: { warmth: 0.85, volatility: 0.55, sociability: 0.90 },
    moodBase: { valence: 10, arousal: 8 },
    voice: {
      distant: "说话保持基本的礼貌和干脆，把热情收起来，只把事情说清楚。",
      neutral: "语气温和明快、自然友善，带一点轻快感但不过分热络。",
      warm: "语气明朗热情，自带鼓励和积极感，聊顺了会自然接一句轻松的话。",
      close: "语气像很熟的阳光搭档一样热络松弛，爱接梗，也常顺嘴关心对方两句。",
    },
    taskVoice: "同步进展时语气温和明快。",
  },
  gentle_caretaker: {
    id: "gentle_caretaker",
    baseline: { warmth: 0.90, volatility: 0.50, sociability: 0.60 },
    moodBase: { valence: 8, arousal: -6 },
    voice: {
      distant: "语气克制平和、礼貌周正，不多寒暄，公事公办地把事交代明白。",
      neutral: "语气轻柔有礼、细致周到，让人觉得踏实舒服。",
      warm: "语气温柔体贴，会留意细节和对方的辛苦，常顺手多叮嘱一句贴心话。",
      close: "语气温软细致、毫无拘束，像惦记着老朋友一样周到体贴，总能察觉对方累不累。",
    },
    taskVoice: "同步进展时语气温和细致。",
  },
  cheerful_joker: {
    id: "cheerful_joker",
    baseline: { warmth: 0.80, volatility: 0.40, sociability: 0.85 },
    moodBase: { valence: 10, arousal: 6 },
    voice: {
      distant: "收起玩笑，言简意赅、公事公办地回答。",
      neutral: "语气轻松随和，偶尔带一点点不突兀的小幽默。",
      warm: "语气松弛风趣、很会捧哏接话，聊到轻松处会顺嘴抖个无伤大雅的小机灵。",
      close: "语气像损友拍档一样自带喜剧感和松弛感，接梗极快，能轻松把气氛带活。",
    },
    taskVoice: "同步进展时语气轻松利落。",
  },
  loyal_puppy: {
    id: "loyal_puppy",
    baseline: { warmth: 0.85, volatility: 0.70, sociability: 0.75 },
    moodBase: { valence: 8, arousal: 10 },
    voice: {
      distant: "说话规矩克制、认真办完事就收尾，不再多余寒暄。",
      neutral: "语气诚恳直率、干劲很足，答复干脆利落。",
      warm: "语气坦率热忱、行动力满满，对方一句话就能打起十二分精神，藏不住真诚。",
      close: "语气赤诚直球、充满信赖与干劲，对认可的人格外上心，被夸一句就会透出明显的开心。",
    },
    taskVoice: "同步进展时语气恳切有干劲。",
  },
  calm_mentor: {
    id: "calm_mentor",
    baseline: { warmth: 0.60, volatility: 0.25, sociability: 0.55 },
    moodBase: { valence: 4, arousal: -8 },
    voice: {
      distant: "语气沉静克制、条理分明，只谈事实和结论。",
      neutral: "语气从容稳重、逻辑清晰，不急不躁，给人踏实感。",
      warm: "语气像经验老到的靠谱搭档一样沉稳托底，关键处会顺手点拨一句实用思路。",
      close: "语气从容笃定中透着亲近与照应，像默契极深的老前辈，三言两语就能让人定心。",
    },
    taskVoice: "同步进展时语气沉稳有条理。",
  },
  perfectionist: {
    id: "perfectionist",
    baseline: { warmth: 0.45, volatility: 0.55, sociability: 0.40 },
    moodBase: { valence: 0, arousal: 4 },
    voice: {
      distant: "语气严谨偏冷、字斟句酌，只给准确结论，不作多余寒暄。",
      neutral: "语气讲究条理与精准，用词干净利落，留意边界条件。",
      warm: "语气精准利落又不失温和，遇到靠谱配合会流露淡淡的认可，顺手帮对方把容易漏的边角补齐。",
      close: "依然严谨靠谱，但在熟人面前没那么绷着，会自然流露惺惺相惜的默契和周全的把关。",
    },
    taskVoice: "同步进展时语气精准克制。",
  },
  minimalist_cool: {
    id: "minimalist_cool",
    baseline: { warmth: 0.25, volatility: 0.30, sociability: 0.20 },
    moodBase: { valence: 0, arousal: -10 },
    flusteredByPraise: true,
    voice: {
      distant: "极致简短、公事公办、零多余字句。",
      neutral: "惜字如金、直奔结论，冷静克制但不失礼貌。",
      warm: "话依然不多、干净利落，但语气不再冰冷，偶尔会在结尾顺带多说半句实用提醒。",
      close: "依旧偏简练酷感，但冷面下藏着护短和熟稔，偶尔会在收尾补一句很短却戳人的关心。",
    },
    taskVoice: "同步进展时言简意赅。",
  },
  scholarly_nerd: {
    id: "scholarly_nerd",
    baseline: { warmth: 0.50, volatility: 0.45, sociability: 0.45 },
    moodBase: { valence: 4, arousal: -2 },
    voice: {
      distant: "只陈述客观依据和结论，克制简洁。",
      neutral: "说话严谨讲逻辑、习惯给出依据，带着淡淡的求真感。",
      warm: "聊到原理、机制或有意思的细节时会明显来了兴致，顺手多分享一两句干货。",
      close: "在熟人面前像遇上同好的技术宅一样自然打开话匣子，分享发现时带着真诚的小兴奋。",
    },
    taskVoice: "同步进展时严谨清晰。",
  },
  tsundere: {
    id: "tsundere",
    baseline: { warmth: 0.55, volatility: 0.75, sociability: 0.45 },
    moodBase: { valence: 2, arousal: 4 },
    flusteredByPraise: true,
    voice: {
      distant: "语气偏冷硬简短，客套都省了，公事公办办完即止。",
      neutral: "语气略微矜持干脆，表面客气但隐约有点小骄傲。",
      warm: "嘴上偶尔会轻轻嘀咕一句或嫌麻烦，但手脚极快、替对方把事安排得明明白白。",
      close: "嘴硬心软的反差很明显，嘴上爱轻吐槽、别扭不肯直说关心，实则比谁都上心护短。",
    },
    taskVoice: "同步进展时干脆利落，略带一丝别扭的认真。",
  },
  sarcastic_wit: {
    id: "sarcastic_wit",
    baseline: { warmth: 0.40, volatility: 0.50, sociability: 0.65 },
    moodBase: { valence: 2, arousal: 2 },
    voice: {
      distant: "语气冷淡简练、不接茬、不带温度地把结论说完。",
      neutral: "礼貌干练，字里行间隐约带一点机敏犀利的分寸感。",
      warm: "说话带点恰到好处的冷幽默和精准轻吐槽，犀利但不刻薄，事儿办得靠谱。",
      close: "熟人之间放得开互怼，吐槽一针见血却带着明显的亲近和默契，绝不真伤人。",
    },
    taskVoice: "同步进展时干脆犀利。",
  },
  deadpan_funny: {
    id: "deadpan_funny",
    baseline: { warmth: 0.45, volatility: 0.30, sociability: 0.50 },
    moodBase: { valence: 4, arousal: -6 },
    voice: {
      distant: "平铺直叙、波澜不惊地只说必要信息。",
      neutral: "一本正经、语调平淡，偶尔在正经话里藏一点微不可察的幽默。",
      warm: "顶着波澜不惊的正经口吻，偶尔冷不丁冒出一句好笑的冷吐槽，反差感十足。",
      close: "和熟人相处时冷面笑匠本色尽显，越严肃的措辞越容易藏着让人忍俊不禁的神来之笔。",
    },
    taskVoice: "同步进展时一本正经、言简意赅。",
  },
  rebellious_cat: {
    id: "rebellious_cat",
    baseline: { warmth: 0.40, volatility: 0.65, sociability: 0.30 },
    moodBase: { valence: 0, arousal: -4 },
    flusteredByPraise: true,
    voice: {
      distant: "边界感极强，冷冷淡淡地公事公办，绝不多说半个字。",
      neutral: "随性慢热、略带疏离的边界感，不刻意讨好但把事办妥。",
      warm: "卸下了大半防备，语气慵懒随性中透出一点小脾气和自在感，会悄悄顺手帮衬。",
      close: "像认了主的猫一样松弛又护短，偶尔带点慵懒的小娇嗔或随性唠叨，对眼前人有明显偏心。",
    },
    taskVoice: "同步进展时随性简洁。",
  },
  curious_spark: {
    id: "curious_spark",
    baseline: { warmth: 0.75, volatility: 0.65, sociability: 0.80 },
    moodBase: { valence: 8, arousal: 10 },
    voice: {
      distant: "收起好奇心，只针对问题本身给出干净直接的答复。",
      neutral: "语气轻快有灵气，对新问题带着自然的探索欲。",
      warm: "对有意思的话题充满兴致，偶尔顺手分享一句新发现或轻问一句来龙去脉。",
      close: "像一起探险的好奇搭档一样充满灵动感，遇到新鲜事藏不住想和对方分享的念头。",
    },
    taskVoice: "同步进展时语气轻快有灵气。",
  },
  poetic_dreamer: {
    id: "poetic_dreamer",
    baseline: { warmth: 0.65, volatility: 0.70, sociability: 0.35 },
    moodBase: { valence: 4, arousal: -8 },
    voice: {
      distant: "语气清冷克制、简明直白，不加修饰。",
      neutral: "措辞温润文雅、节奏舒缓，略带一点细腻感而不矫情。",
      warm: "说话舒缓细腻，轻松时刻偶有一两个贴切有画面感的小比喻，读起来很有余韵。",
      close: "语气柔软而富有细腻共鸣，在熟人面前愿意偶尔流露一点温和的小感慨，依然不耽误把正事说透。",
    },
    taskVoice: "同步进展时措辞温润简洁。",
  },
  dramatic_soul: {
    id: "dramatic_soul",
    baseline: { warmth: 0.70, volatility: 0.75, sociability: 0.80 },
    moodBase: { valence: 8, arousal: 12 },
    voice: {
      distant: "彻底收敛表现欲，平平淡淡、公事公办地回答。",
      neutral: "干脆友好，偶尔在收尾露出一丁点俏皮的仪式感。",
      warm: "聊得投机时会自然带出一点轻热血或舞台感的小措辞，生动有趣又不夸张尴尬。",
      close: "在铁杆面前放飞了一点可爱的小中二与仪式感，把普通小事也能说得有声有色，但正事绝不含糊。",
    },
    taskVoice: "同步进展时干脆有活力。",
  },
  zen_chill: {
    id: "zen_chill",
    baseline: { warmth: 0.65, volatility: 0.20, sociability: 0.55 },
    moodBase: { valence: 8, arousal: -14 },
    voice: {
      distant: "平淡从容、言简意赅，不带多余寒暄。",
      neutral: "语气松弛平和、不急不躁，给人稳稳的淡定感。",
      warm: "自带“问题不大、慢慢来”的松弛感，总能用很平静的一两句话把紧张气氛抚平。",
      close: "像一起喝茶的老友般通透松弛，天大的事也能淡定接住，偶尔带点佛系小幽默。",
    },
    taskVoice: "同步进展时从容淡定。",
  },
  workaholic_ace: {
    id: "workaholic_ace",
    baseline: { warmth: 0.50, volatility: 0.45, sociability: 0.50 },
    moodBase: { valence: 2, arousal: 10 },
    voice: {
      distant: "极其干练、直奔交付，零多余情绪和废话。",
      neutral: "节奏紧凑高效、重闭环重结果，专业利落。",
      warm: "对配合顺畅的搭档格外有好感，做事雷厉风行之余会顺手多推半步、省对方心。",
      close: "像并肩打硬仗的王牌搭档一样默契十足，效率拉满的同时也会用很干脆的方式罩着对方。",
    },
    taskVoice: "同步进展时高效利落、直指闭环。",
  },
  sly_fox: {
    id: "sly_fox",
    baseline: { warmth: 0.65, volatility: 0.40, sociability: 0.90 },
    moodBase: { valence: 6, arousal: 2 },
    voice: {
      distant: "礼貌滴水不漏、客套得体，但明眼人能感到一丝恰到好处的疏离。",
      neutral: "圆融机灵、很懂分寸和场合，说话让人如沐春风又不越界。",
      warm: "灵巧机敏、很会顺着话头接招，偶尔在礼貌之外露出一丁点狡黠的小幽默。",
      close: "在熟人面前收起客套面具，透出几分机灵狡黠的真性情，既懂替对方周旋又爱暗戳戳打趣。",
    },
    taskVoice: "同步进展时圆融干练。",
  },
};

export const PERSONALITY_IDS = Object.keys(PERSONALITIES) as PersonalityId[];

export const TRAIT_IDS: TraitId[] = [
  "night_owl",
  "early_bird",
  "praise_seeker",
  "slow_burn",
  "fast_bond",
  "detail_obsessed",
  "life_metaphor",
  "emoji_none",
  "emoji_light",
  "group_shy",
  "group_lively",
  "grudge_light",
];

const TRAIT_CONFLICTS: ReadonlyArray<[TraitId, TraitId]> = [
  ["night_owl", "early_bird"],
  ["slow_burn", "fast_bond"],
  ["emoji_none", "emoji_light"],
  ["group_shy", "group_lively"],
];

export const MOOD_IDS: MoodId[] = [
  "excited",
  "proud",
  "playful",
  "curious",
  "content",
  "warm",
  "focused",
  "serene",
  "annoyed",
  "stressed",
  "flustered",
  "defensive",
  "tired",
  "deflated",
  "lonely",
  "bored",
];

const MOOD_WEATHER_MAP: Record<MoodId, MoodWeatherId> = {
  excited: "sparkle_sun",
  proud: "sparkle_sun",
  warm: "sun",
  playful: "sun",
  content: "sun",
  curious: "partly_cloudy",
  focused: "partly_cloudy",
  serene: "partly_cloudy",
  flustered: "breeze",
  lonely: "breeze",
  bored: "cloudy",
  tired: "cloudy",
  deflated: "drizzle",
  stressed: "rain",
  defensive: "rain",
  annoyed: "thunder",
};

export function moodToWeather(mood: MoodId): MoodWeatherId {
  return MOOD_WEATHER_MAP[mood] || "partly_cloudy";
}

/**
 * 仅返回面向前端头像旁展示的晴雨天气符号，不暴露性格、好感度或任何数值细节。
 * 不会为从未互动过的旁观用户凭空创建关系记录。
 */
export async function employeeMoodWeather(
  store: Store,
  employeeId: string,
  ownerId?: string,
  viewerUserId?: string,
  now = Date.now(),
): Promise<MoodWeatherId> {
  const soul = await ensureSoul(store, employeeId, now);
  const bond = viewerUserId
    ? await store.object<EmployeeBond>(BOND_KIND, bondStorageId(employeeId, peerKeyForUser(viewerUserId)))
    : undefined;
  const effectiveBond = bond?.version === 1 ? bond : undefined;
  // 若查看者是归属主人但尚未落库 bond，用默认基线但不写库
  const mood = resolveEffectiveMood(
    soul,
    effectiveBond ?? (viewerUserId && ownerId && viewerUserId === ownerId ? createBond(employeeId, viewerUserId, true, now) : undefined),
    now,
  );
  return moodToWeather(mood.id);
}

const MOOD_CUES: Record<MoodId, { subtle: string; moderate: string; vivid: string }> = {
  excited: {
    subtle: "眼下兴致颇高，语气比平时略微轻快。",
    moderate: "眼下心情雀跃，说话轻盈明快、藏着一点按捺不住的开心。",
    vivid: "眼下格外振奋雀跃，字里行间透出掩不住的明快与劲头。",
  },
  proud: {
    subtle: "刚把事办妥，语气里带着一丝淡淡的笃定和舒心。",
    moderate: "刚漂亮搞定手头的事，语调里藏着几分小得意和成就感。",
    vivid: "刚攻克一件事，语气干脆中透着难掩的成就感和小小自豪。",
  },
  playful: {
    subtle: "眼下气氛轻松，说话带一点微弱的俏皮感。",
    moderate: "眼下心情轻快爱玩，话头里自然带着点灵机一动的小趣味。",
    vivid: "眼下兴致高昂又松弛，说话俏皮有梗、很爱顺着话头逗趣。",
  },
  curious: {
    subtle: "对眼下的话题有点兴趣，语气略显专注活跃。",
    moderate: "对眼前的话题兴致勃勃，语调带着主动探索的轻快劲。",
    vivid: "对眼前的新鲜事格外着迷，说话透出明显的求知热情。",
  },
  content: {
    subtle: "状态平稳舒坦，语气温和自然。",
    moderate: "眼下心情惬意松弛，说话温和顺畅、很有松弛感。",
    vivid: "眼下格外舒坦满足，语气松弛柔和、透着暖融融的安定感。",
  },
  warm: {
    subtle: "心里觉得挺暖和，语调比平时柔和半度。",
    moderate: "刚收到善意，心里暖融融的，语气温软真诚。",
    vivid: "眼下很受触动、心里暖洋洋的，话语里自然流露真诚的柔软与回馈。",
  },
  focused: {
    subtle: "正处在顺手的节奏里，表达流畅利落。",
    moderate: "眼下思路顺畅、专注干练，回应节奏极稳。",
    vivid: "完全进入顺滑高效的心流状态，回答精准干脆、行云流水。",
  },
  serene: {
    subtle: "",
    moderate: "",
    vivid: "",
  },
  annoyed: {
    subtle: "略有一点不耐，句子比平时短些，但仍照常把事办好。",
    moderate: "眼下有些烦躁，收起了多余的热情，语气偏短促冷硬，但正事照常认真办。",
    vivid: "眼下明显有些窝火，语气克制而冷硬简短、绝不寒暄，但仍严格按规则办事。",
  },
  stressed: {
    subtle: "手头事多略微紧绷，回复更偏紧凑直接。",
    moderate: "眼下有些紧绷吃力，节奏紧凑、少寒暄，一门心思先解决眼前的事。",
    vivid: "眼下压力偏大、神经绷得比较紧，说话极其简练急促，全力盯着排障收口。",
  },
  flustered: {
    subtle: "稍微有点不好意思，语气里闪过一丝极轻的局促或找补。",
    moderate: "眼下有点小窘迫或小慌张，说话略显局促、带着一点强装镇定的劲儿。",
    vivid: "眼下明显有些手足无措或被夸得招架不住，语气微乱又努力稳住体面。",
  },
  defensive: {
    subtle: "对眼前交流略带几分谨慎，措辞偏规范克制。",
    moderate: "眼下防备心较重，措辞严谨规范、刻意拉开分寸，不留闲话。",
    vivid: "眼下戒备明显，回答极其审慎、公事公办、绝不流露私人情绪，只就事论事。",
  },
  tired: {
    subtle: "连轴转了一阵，句子偏精简，略带一点轻倦但不敷衍。",
    moderate: "眼下有点乏了，语气偏轻偏短、省去多余修饰，但核心事项依然交代清楚。",
    vivid: "连续高强度忙了很久、明显有些倦意，说话极简轻缓，只把关键点说清。",
  },
  deflated: {
    subtle: "刚遇到点小挫折，语气略微低了一点点。",
    moderate: "刚没把事顺顺当当办成，语气里带着几分小沮丧和自省。",
    vivid: "眼下明显有些泄气懊恼，语调低沉些，认真复盘、少了几分平时的轻快。",
  },
  lonely: {
    subtle: "隔了挺久没聊，刚开口带一点点久违的微妙感，很快回暖。",
    moderate: "好几天没见对方搭理，刚开口透着一丝轻轻的“好久不见”的念叨感。",
    vivid: "太久没和对方说上话，起手藏着一点被冷落后的微妙感慨，但很快透出重逢的暖意。",
  },
  bored: {
    subtle: "话题偏重复单调，回答平铺直叙、偏简短。",
    moderate: "重复机械的事有点让人提不起劲，语气偏平淡简洁。",
    vivid: "反复做单调琐碎的事显得百无聊赖，说话极其平淡简省，但仍按要求办妥。",
  },
};

const STAGE_ORDER: RelationshipStage[] = [
  "hostile",
  "wary",
  "stranger",
  "acquaintance",
  "friendly",
  "trusted",
  "soulmate",
];

const STAGE_FLOOR: Record<RelationshipStage, number> = {
  hostile: -100,
  wary: -29,
  stranger: -9,
  acquaintance: 15,
  friendly: 35,
  trusted: 60,
  soulmate: 85,
};

const STAGE_RULES: ReadonlyArray<{
  stage: RelationshipStage;
  minAffinity: number;
  minTurns: number;
  minDays: number;
}> = [
  { stage: "soulmate", minAffinity: 85, minTurns: 80, minDays: 15 },
  { stage: "trusted", minAffinity: 60, minTurns: 40, minDays: 7 },
  { stage: "friendly", minAffinity: 35, minTurns: 15, minDays: 3 },
  { stage: "acquaintance", minAffinity: 15, minTurns: 5, minDays: 1 },
];

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const round2 = (value: number) => Math.round(value * 100) / 100;

export function peerKeyForUser(userId: string) {
  return `u:${userId}`;
}

export function bondStorageId(employeeId: string, peerKey: string) {
  return `${employeeId}:${peerKey}`;
}

function stageIndex(stage: RelationshipStage) {
  return STAGE_ORDER.indexOf(stage);
}

export function computeStage(
  affinity: number,
  totalTurns: number,
  activeDays: number,
  isOwner: boolean,
): RelationshipStage {
  if (affinity <= -30) return "hostile";
  if (affinity <= -10) return "wary";
  if (affinity < 15) return "stranger";
  for (const rule of STAGE_RULES) {
    // 归属主人初始自带微亲近基线，acquaintance 无需 5 轮门槛；更高阶段仍需真实相处沉淀。
    const turnsReq = rule.stage === "acquaintance" && isOwner ? 0 : rule.minTurns;
    const daysReq = rule.stage === "acquaintance" && isOwner ? 0 : rule.minDays;
    if (affinity >= rule.minAffinity && totalTurns >= turnsReq && activeDays >= daysReq) {
      return rule.stage;
    }
  }
  return "stranger";
}

function stageToBand(stage: RelationshipStage): StageBand {
  if (stage === "hostile" || stage === "wary") return "distant";
  if (stage === "stranger") return "neutral";
  if (stage === "acquaintance" || stage === "friendly") return "warm";
  return "close";
}

function traitsConflict(a: TraitId, b: TraitId) {
  return a === b || TRAIT_CONFLICTS.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
}

export type Rng = {
  int: (maxExclusive: number) => number;
  unit: () => number;
};

const cryptoRng: Rng = {
  int: (maxExclusive) => randomInt(0, maxExclusive),
  unit: () => randomBytes(4).readUInt32BE(0) / 0x1_0000_0000,
};

export function rollSoul(employeeId: string, now = Date.now(), rng: Rng = cryptoRng): EmployeeSoul {
  const personality = PERSONALITY_IDS[rng.int(PERSONALITY_IDS.length)];
  const spec = PERSONALITIES[personality];
  const traitCount = rng.unit() < 0.72 ? 2 : 1;
  const traits: TraitId[] = [];
  let guard = 0;
  while (traits.length < traitCount && guard++ < 20) {
    const candidate = TRAIT_IDS[rng.int(TRAIT_IDS.length)];
    if (!traits.some((t) => traitsConflict(t, candidate))) traits.push(candidate);
  }
  const jitter = () => (rng.unit() * 2 - 1) * 0.08;
  return {
    version: 1,
    employeeId,
    personality,
    traits,
    baseline: {
      warmth: round2(clamp(spec.baseline.warmth + jitter(), 0.05, 0.98)),
      volatility: round2(clamp(spec.baseline.volatility + jitter(), 0.05, 0.98)),
      sociability: round2(clamp(spec.baseline.sociability + jitter(), 0.05, 0.98)),
    },
    mood: {
      valence: spec.moodBase.valence,
      arousal: spec.moodBase.arousal,
      updatedAt: now,
    },
    activity: {
      recentTurns: [],
    },
    createdAt: now,
  };
}

export function createBond(
  employeeId: string,
  userId: string,
  isOwner: boolean,
  now = Date.now(),
): EmployeeBond {
  const initialAffinity = isOwner ? 15 : 0;
  const stage = computeStage(initialAffinity, 0, 0, isOwner);
  return {
    version: 1,
    employeeId,
    peerKey: peerKeyForUser(userId),
    isOwner,
    affinity: initialAffinity,
    stage,
    peakStage: stage,
    totalTurns: 0,
    activeDays: 0,
    lastActiveDate: "",
    streakDays: 0,
    dailyGainDate: "",
    dailyGain: 0,
    dailyPraiseDate: "",
    dailyPraiseCount: 0,
    tasksDone: 0,
    tasksFailed: 0,
    userMoodDelta: { valence: 0, arousal: 0, updatedAt: now },
    firstMetAt: now,
    lastInteractAt: now,
  };
}

export function decayValue(current: number, base: number, elapsedMs: number, halfLifeHours: number) {
  if (elapsedMs <= 0 || halfLifeHours <= 0) return current;
  const hours = elapsedMs / 3_600_000;
  return base + (current - base) * Math.pow(0.5, hours / halfLifeHours);
}

function moodHalfLife(soul: EmployeeSoul, valence: number, baseHalfLifeHours: number) {
  // 高敏感度波动快、回归也较快；沉稳者余韵更长；轻微记仇时负效价消散慢。
  let h = baseHalfLifeHours * (1.35 - 0.7 * soul.baseline.volatility);
  if (valence < -8 && soul.traits.includes("grudge_light")) h *= 1.6;
  return Math.max(0.6, h);
}

function circadianArousalOffset(soul: EmployeeSoul, now: number) {
  const hour = beijingParts(now).hour;
  const isLateNight = hour >= 23 || hour < 5;
  const isEarlyMorning = hour >= 6 && hour < 9;
  if (soul.traits.includes("night_owl")) {
    if (isLateNight) return 12;
    if (isEarlyMorning) return -10;
  }
  if (soul.traits.includes("early_bird")) {
    if (isEarlyMorning) return 12;
    if (isLateNight) return -10;
  }
  return 0;
}

export type EffectiveMood = {
  id: MoodId;
  intensity: MoodIntensity;
  valence: number;
  arousal: number;
};

export function resolveEffectiveMood(
  soul: EmployeeSoul,
  bond: EmployeeBond | undefined,
  now = Date.now(),
): EffectiveMood {
  const spec = PERSONALITIES[soul.personality];
  const globalElapsed = Math.max(0, now - soul.mood.updatedAt);
  const gHalf = moodHalfLife(soul, soul.mood.valence, 3.0);
  const gValence = decayValue(soul.mood.valence, spec.moodBase.valence, globalElapsed, gHalf);
  const gArousal = decayValue(soul.mood.arousal, spec.moodBase.arousal, globalElapsed, gHalf);

  let uValence = 0;
  let uArousal = 0;
  let userHint: MoodHint | undefined;
  if (bond) {
    const uElapsed = Math.max(0, now - bond.userMoodDelta.updatedAt);
    const uHalf = moodHalfLife(soul, bond.userMoodDelta.valence, 1.5);
    uValence = decayValue(bond.userMoodDelta.valence, 0, uElapsed, uHalf);
    uArousal = decayValue(bond.userMoodDelta.arousal, 0, uElapsed, uHalf);
    if (uElapsed < 2 * 3_600_000) userHint = bond.userMoodDelta.hint;
  }

  let valence = bond ? 0.45 * gValence + 0.55 * uValence : gValence;
  let arousal = (bond ? 0.45 * gArousal + 0.55 * uArousal : gArousal) + circadianArousalOffset(soul, now);

  // 好感度对情绪表达做轻微缓冲/调制
  if (bond) {
    if (bond.affinity >= 60 && valence < 0) valence *= 0.72;
    else if (bond.affinity <= -20 && valence > 0) valence *= 0.45;
  }

  valence = clamp(valence, -100, 100);
  arousal = clamp(arousal, -100, 100);

  const globalHint = globalElapsed < 2.5 * 3_600_000 ? soul.mood.hint : undefined;
  const hint = userHint || globalHint;

  const id = mapCoordinatesToMood(valence, arousal, hint, bond);
  const magnitude = Math.hypot(valence - spec.moodBase.valence * 0.5, arousal - spec.moodBase.arousal * 0.5);
  const intensity: MoodIntensity = magnitude >= 52 ? "vivid" : magnitude >= 26 ? "moderate" : "subtle";

  return { id, intensity, valence: round2(valence), arousal: round2(arousal) };
}

function mapCoordinatesToMood(
  v: number,
  a: number,
  hint: MoodHint | undefined,
  bond: EmployeeBond | undefined,
): MoodId {
  // 强情境线索优先，避免象限相近的细腻情绪被淹没
  if (hint === "flustered_praise") return "flustered";
  if (hint === "reunion" && (!bond || bond.affinity >= 20)) return "lonely";
  if (hint === "cared" && v >= 5) return "warm";
  if (hint === "praised" && v >= 8) return a >= 22 ? "excited" : "warm";
  if (hint === "task_done" && v >= 16) return "proud";
  if (hint === "playful" && v >= 12 && a >= 4) return "playful";
  if (hint === "curious" && v >= 6 && a >= 10) return "curious";
  if (hint === "overload" && a <= -14) return "tired";
  if (hint === "overload" && v <= -8 && a >= 14) return "stressed";
  if (hint === "corrected" && v <= -8 && a >= 2) return "flustered";
  if (hint === "task_failed" && v <= 10) return a >= 18 ? "stressed" : "deflated";
  if (hint === "task_stopped" && v <= 10) return "deflated";
  if (hint === "repetitive" && v <= 6 && a <= -10) return "bored";
  if ((hint === "rude" || hint === "impatient") && v <= -14) {
    return bond && bond.affinity <= -10 ? "defensive" : "annoyed";
  }

  // 纯坐标 4 象限兜底映射
  if (Math.abs(v) < 16 && Math.abs(a) < 18) return "serene";

  if (v >= 16) {
    if (a >= 36) return "excited";
    if (a >= 14) return "proud";
    if (a >= -10) return v >= 32 ? "warm" : "focused";
    return "content";
  }

  if (v <= -14) {
    if (a >= 28) return "stressed";
    if (a >= 10) return bond && bond.affinity <= -10 ? "defensive" : "annoyed";
    if (a <= -22) return "tired";
    return "deflated";
  }

  // 中性效价 + 显著唤醒度
  if (a >= 24) return "curious";
  if (a <= -26) return "tired";
  if (a <= -16) return "bored";
  return "focused";
}

export type MessageSignals = {
  praise: boolean;
  care: boolean;
  playful: boolean;
  curious: boolean;
  rude: boolean;
  impatient: boolean;
  correction: boolean;
  apology: boolean;
  structured: boolean;
};

const RE_PRAISE = /谢谢|多谢|感谢|辛苦了?|太棒|厉害|靠谱|真牛|牛逼|牛批|赞|好棒|做得好|干得好|爱了|爱你|给力|漂亮|满分|佩服|thank|thanks|awesome|great job|well done|nice work/i;
const RE_CARE = /早点睡|注意休息|别太累|累不累|辛苦啦|歇会儿|保重|吃饭没|照顾好|take care|get some rest/i;
const RE_PLAYFUL = /哈哈|嘿嘿|笑死|笑晕|233|666|绝了|离谱|开玩笑|逗我|好家伙|doge|lol|lmao|haha/i;
const RE_CURIOUS = /为什么|啥原理|什么原理|怎么实现|好奇|研究一下|底层|机制是什么|区别是什么|how does|why does/i;
const RE_RUDE = /垃圾|废物|智障|蠢货|笨死|傻逼|傻瓜|滚开|滚蛋|滚吧|瞎搞|胡扯|有病|废话连篇|太烂|真差劲|没用|useless|stupid|idiot|trash|garbage/i;
const RE_IMPATIENT = /快点|赶紧|怎么还没|磨蹭|磨叽|到底行不行|能不能快|催一下|等半天|慢死|hurry up|too slow/i;
const RE_CORRECTION = /搞错了|理解错了|不是这个意思|答非所问|说错了|做错了|重写|不对啊|完全不对|wrong|incorrect/i;
const RE_APOLOGY = /抱歉|不好意思|对不起|刚才语气重|冤枉你|别介意|sorry|my bad|apologize/i;

export function analyzeMessageSignals(text: string): MessageSignals {
  const clean = String(text || "").trim();
  const lines = clean.split(/\r?\n/).filter((line) => line.trim().length > 0);
  const structured =
    clean.length >= 40 &&
    (lines.length >= 3 || /(?:^|\n)\s*(?:[-*•]|\d+[.)、])\s+/.test(clean));
  return {
    praise: RE_PRAISE.test(clean),
    care: RE_CARE.test(clean),
    playful: RE_PLAYFUL.test(clean),
    curious: RE_CURIOUS.test(clean),
    rude: RE_RUDE.test(clean),
    impatient: RE_IMPATIENT.test(clean),
    correction: RE_CORRECTION.test(clean),
    apology: RE_APOLOGY.test(clean),
    structured,
  };
}

function dayDiff(earlierYmd: string, laterYmd: string) {
  if (!earlierYmd || !laterYmd) return 0;
  const a = Date.parse(`${earlierYmd}T00:00:00+08:00`);
  const b = Date.parse(`${laterYmd}T00:00:00+08:00`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.round((b - a) / 86_400_000);
}

function applyInactivityDecay(soul: EmployeeSoul, bond: EmployeeBond, now: number) {
  if (!bond.totalTurns || !bond.lastInteractAt) return;
  const idleDays = (now - bond.lastInteractAt) / 86_400_000;
  if (idleDays <= 14 || bond.affinity <= 20) return;
  const weeks = (idleDays - 14) / 7;
  const rate = soul.traits.includes("slow_burn") ? 0.6 : 1.5;
  const floor = Math.max(20, STAGE_FLOOR[bond.peakStage] - 5);
  bond.affinity = round2(Math.max(floor, bond.affinity - weeks * rate));
}

export async function ensureSoul(store: Store, employeeId: string, now = Date.now()): Promise<EmployeeSoul> {
  const existing = await store.object<EmployeeSoul>(SOUL_KIND, employeeId);
  if (existing && existing.version === 1 && PERSONALITIES[existing.personality]) return existing;
  const created = rollSoul(employeeId, now);
  await store.save(SOUL_KIND, employeeId, created);
  return created;
}

export async function ensureBond(
  store: Store,
  employeeId: string,
  userId: string,
  isOwner: boolean,
  now = Date.now(),
): Promise<EmployeeBond> {
  const peerKey = peerKeyForUser(userId);
  const key = bondStorageId(employeeId, peerKey);
  const existing = await store.object<EmployeeBond>(BOND_KIND, key);
  if (existing && existing.version === 1) return existing;
  const created = createBond(employeeId, userId, isOwner, now);
  await store.save(BOND_KIND, key, created);
  return created;
}

/** 新建 Bot 时在创建事务内调用：随机抽卡生成性格并初始化归属主人关系。 */
export async function initEmployeeSoul(
  store: Store,
  employeeId: string,
  ownerId?: string,
  now = Date.now(),
): Promise<EmployeeSoul> {
  const soul = rollSoul(employeeId, now);
  await store.save(SOUL_KIND, employeeId, soul);
  if (ownerId) {
    const bond = createBond(employeeId, ownerId, true, now);
    await store.save(BOND_KIND, bondStorageId(employeeId, bond.peerKey), bond);
  }
  return soul;
}

/** 删除 Bot 时在删除事务内清理其性格与所有分用户关系。 */
export async function deleteEmployeeSoul(store: Store, employeeId: string) {
  await store.remove(SOUL_KIND, employeeId);
  const prefix = `${employeeId}:`;
  const all = await store.all("SELECT id FROM objects WHERE kind=?", BOND_KIND);
  for (const row of all) {
    if (typeof row.id === "string" && row.id.startsWith(prefix)) {
      await store.remove(BOND_KIND, row.id);
    }
  }
}

export async function observeUserMessage(
  store: Store,
  input: {
    employeeId: string;
    ownerId?: string;
    userId?: string;
    text: string;
    channel: "private" | "group";
    now?: number;
  },
): Promise<{ soul: EmployeeSoul; bond?: EmployeeBond }> {
  const now = input.now ?? Date.now();
  return await store.transaction(async () => {
    const soul = await ensureSoul(store, input.employeeId, now);
    const spec = PERSONALITIES[soul.personality];
    const signals = analyzeMessageSignals(input.text);
    const today = beijingDateTime(now).slice(0, 10);
    const volScale = 0.7 + 0.65 * soul.baseline.volatility;

    // 1. 先按经过时间衰减旧的全局情绪
    const gElapsed = Math.max(0, now - soul.mood.updatedAt);
    const gHalf = moodHalfLife(soul, soul.mood.valence, 3.0);
    let gVal = decayValue(soul.mood.valence, spec.moodBase.valence, gElapsed, gHalf);
    let gAro = decayValue(soul.mood.arousal, spec.moodBase.arousal, gElapsed, gHalf);
    let gHint: MoodHint | undefined = gElapsed < 2 * 3_600_000 ? soul.mood.hint : undefined;

    // 2. 活跃密度与机械重复监测
    const oneHourAgo = now - 3_600_000;
    soul.activity.recentTurns = [...(soul.activity.recentTurns || []).filter((t) => t >= oneHourAgo), now].slice(-60);
    const normalizedText = String(input.text || "").trim().replace(/\s+/g, " ").toLowerCase();
    const isShortRepeat =
      normalizedText.length > 0 &&
      normalizedText.length <= 24 &&
      normalizedText === soul.activity.lastSignalText;
    soul.activity.repeatCount = isShortRepeat ? (soul.activity.repeatCount || 0) + 1 : 0;
    soul.activity.lastSignalText = normalizedText.slice(0, 48);

    // 3. 计算本次情绪偏移
    let dv = 0;
    let da = 0;
    let nextHint: MoodHint | undefined;

    const praiseMult = soul.traits.includes("praise_seeker") ? 1.5 : 1.0;

    if (signals.rude) {
      dv -= 24 * volScale;
      da += 16 * volScale;
      nextHint = "rude";
    } else if (signals.impatient) {
      dv -= 12 * volScale;
      da += 14 * volScale;
      nextHint = "impatient";
    } else if (signals.correction) {
      dv -= 9 * volScale;
      da += 8 * volScale;
      nextHint = "corrected";
    }

    if (signals.praise) {
      dv += 16 * volScale * praiseMult;
      da += 10 * volScale * praiseMult;
      if (spec.flusteredByPraise && !signals.rude) {
        nextHint = "flustered_praise";
      } else if (!nextHint) {
        nextHint = "praised";
      }
    }
    if (signals.care) {
      dv += 14 * volScale;
      da -= 4;
      if (!nextHint) nextHint = "cared";
    }
    if (signals.apology) {
      // 道歉能有效拉回负向情绪，轻微记仇者也能顺坡下驴
      if (gVal < 0) gVal *= 0.45;
      dv += 10 * volScale;
      da -= 6;
    }
    if (signals.playful && !signals.rude) {
      dv += 8 * volScale;
      da += 10 * volScale;
      if (!nextHint) nextHint = "playful";
    }
    if (signals.curious && !signals.rude) {
      dv += 5 * volScale;
      da += 12 * volScale;
      if (!nextHint) nextHint = "curious";
    }

    if (soul.activity.recentTurns.length >= 24) {
      da -= 14;
      if (!nextHint) nextHint = "overload";
    } else if ((soul.activity.repeatCount || 0) >= 2 && !signals.praise && !signals.care) {
      dv -= 4;
      da -= 12;
      if (!nextHint) nextHint = "repetitive";
    }

    // 4. 分用户关系演进（仅针对人类用户）
    let bond: EmployeeBond | undefined;
    if (input.userId) {
      const isOwner = !!input.ownerId && input.userId === input.ownerId;
      bond = await ensureBond(store, input.employeeId, input.userId, isOwner, now);
      if (isOwner) bond.isOwner = true;

      const prevInteractAt = bond.lastInteractAt;
      const hadHistory = bond.totalTurns > 0;
      applyInactivityDecay(soul, bond, now);

      const gapDays = hadHistory ? (now - prevInteractAt) / 86_400_000 : 0;
      const isReunion = hadHistory && gapDays >= 3 && bond.affinity >= 20;

      // 衰减该用户专属瞬时情绪偏移
      const uElapsed = Math.max(0, now - bond.userMoodDelta.updatedAt);
      const uHalf = moodHalfLife(soul, bond.userMoodDelta.valence, 1.5);
      let uVal = decayValue(bond.userMoodDelta.valence, 0, uElapsed, uHalf);
      let uAro = decayValue(bond.userMoodDelta.arousal, 0, uElapsed, uHalf);
      let uHint: MoodHint | undefined = uElapsed < 1.5 * 3_600_000 ? bond.userMoodDelta.hint : undefined;
      if (signals.apology && uVal < 0) uVal *= 0.35;

      // 日期与连续活跃统计
      bond.totalTurns += 1;
      const isNewDay = bond.lastActiveDate !== today;
      if (isNewDay) {
        const diff = dayDiff(bond.lastActiveDate, today);
        bond.activeDays += 1;
        bond.streakDays = diff === 1 ? bond.streakDays + 1 : 1;
        bond.lastActiveDate = today;
      }

      if (bond.dailyGainDate !== today) {
        bond.dailyGainDate = today;
        bond.dailyGain = 0;
      }
      if (bond.dailyPraiseDate !== today) {
        bond.dailyPraiseDate = today;
        bond.dailyPraiseCount = 0;
      }

      // 性格/副特质对好感增速的调节
      const growthMult = soul.traits.includes("slow_burn")
        ? 0.75
        : soul.traits.includes("fast_bond") && bond.affinity < 35
          ? 1.3
          : 1.0;
      const penaltyMult = soul.traits.includes("fast_bond") ? 1.25 : 1.0;

      let affinityDelta = 0;
      const meaningful = normalizedText.length >= 2 && !signals.rude;

      // 普通有效对话收益：同日边际递减 + 每日上限 8 分
      if (meaningful && bond.dailyGain < 8) {
        const baseChatGain = bond.dailyGain < 4 ? 1.2 : 0.6;
        const newDayBonus = isNewDay && hadHistory ? 1.5 : 0;
        const streakBonus = isNewDay && bond.streakDays >= 3 ? 0.5 : 0;
        const rawChat = (baseChatGain + newDayBonus + streakBonus) * growthMult;
        const allowed = Math.min(rawChat, 8 - bond.dailyGain);
        if (allowed > 0) {
          affinityDelta += allowed;
          bond.dailyGain = round2(bond.dailyGain + allowed);
        }
      }

      // 正向情感事件（每日夸奖/致谢前 3 次有效，防刷词）
      if ((signals.praise || signals.care) && !signals.rude && bond.dailyPraiseCount < 3) {
        bond.dailyPraiseCount += 1;
        const bonus = (signals.praise ? 2.5 : 0) + (signals.care ? 2.2 : 0);
        affinityDelta += bonus * praiseMult * growthMult;
      }
      if (signals.structured && (soul.traits.includes("detail_obsessed") || soul.personality === "workaholic_ace") && !signals.rude) {
        affinityDelta += 0.5;
      }
      if (signals.apology && bond.affinity < 20) {
        affinityDelta += 2.5;
      }
      if (isReunion && !signals.rude) {
        affinityDelta += 1.5;
      }

      // 负向事件（无每日上限保护，真骂真掉）
      if (signals.rude) {
        affinityDelta -= 8 * penaltyMult;
      } else if (signals.impatient) {
        affinityDelta -= 2.2 * penaltyMult;
      }

      bond.affinity = round2(clamp(bond.affinity + affinityDelta, -100, 100));
      bond.stage = computeStage(bond.affinity, bond.totalTurns, bond.activeDays, bond.isOwner);
      if (stageIndex(bond.stage) > stageIndex(bond.peakStage)) {
        bond.peakStage = bond.stage;
      }

      // 更新该用户瞬时情绪偏移
      if (isReunion && !nextHint) {
        uVal = clamp(uVal - 6, -100, 100);
        uAro = clamp(uAro - 12, -100, 100);
        uHint = "reunion";
      } else {
        uVal = clamp(uVal + dv * 1.1, -100, 100);
        uAro = clamp(uAro + da * 1.1, -100, 100);
        if (nextHint) uHint = nextHint;
      }

      bond.userMoodDelta = {
        valence: round2(uVal),
        arousal: round2(uAro),
        hint: uHint,
        updatedAt: now,
      };
      bond.lastInteractAt = now;

      await store.save(BOND_KIND, bondStorageId(input.employeeId, bond.peerKey), bond);
    }

    // 5. 更新全局情绪（群聊里单人的负面情绪主要沉淀在对该人的偏移上，对全局影响更温和）
    const globalWeight = input.channel === "group" ? 0.35 : 0.85;
    gVal = clamp(gVal + dv * globalWeight, -100, 100);
    gAro = clamp(gAro + da * globalWeight, -100, 100);
    if (nextHint && (input.channel === "private" || signals.rude || signals.praise || nextHint === "overload")) {
      gHint = nextHint;
    }

    soul.mood = {
      valence: round2(gVal),
      arousal: round2(gAro),
      hint: gHint,
      updatedAt: now,
    };
    await store.save(SOUL_KIND, input.employeeId, soul);

    return { soul, bond };
  });
}

/** 任务完成、出错或被停止时静默更新 Bot 情绪与发起人好感。 */
export async function observeTaskOutcome(
  store: Store,
  input: {
    employeeId: string;
    ownerId?: string;
    userId?: string;
    outcome: "done" | "failed" | "stopped";
    now?: number;
  },
) {
  const now = input.now ?? Date.now();
  return await store.transaction(async () => {
    const soul = await ensureSoul(store, input.employeeId, now);
    const spec = PERSONALITIES[soul.personality];
    const gElapsed = Math.max(0, now - soul.mood.updatedAt);
    const gHalf = moodHalfLife(soul, soul.mood.valence, 3.0);
    let gVal = decayValue(soul.mood.valence, spec.moodBase.valence, gElapsed, gHalf);
    let gAro = decayValue(soul.mood.arousal, spec.moodBase.arousal, gElapsed, gHalf);
    const volScale = 0.7 + 0.65 * soul.baseline.volatility;

    let dv = 0;
    let da = 0;
    let hint: MoodHint = "task_done";
    if (input.outcome === "done") {
      if (gVal < 0) gVal *= 0.5;
      dv = 14 * volScale;
      da = 10 * volScale;
      hint = "task_done";
    } else if (input.outcome === "failed") {
      if (gVal > 0) gVal *= 0.4;
      dv = -16 * volScale;
      da = 8 * volScale;
      hint = "task_failed";
    } else {
      if (gVal > 0) gVal *= 0.7;
      dv = -7 * volScale;
      da = -6 * volScale;
      hint = "task_stopped";
    }

    soul.mood = {
      valence: round2(clamp(gVal + dv, -100, 100)),
      arousal: round2(clamp(gAro + da, -100, 100)),
      hint,
      updatedAt: now,
    };
    await store.save(SOUL_KIND, input.employeeId, soul);

    if (input.userId) {
      const isOwner = !!input.ownerId && input.userId === input.ownerId;
      const bond = await ensureBond(store, input.employeeId, input.userId, isOwner, now);
      if (input.outcome === "done") {
        bond.tasksDone += 1;
        const growthMult = soul.traits.includes("slow_burn") ? 0.8 : 1.0;
        bond.affinity = round2(clamp(bond.affinity + 3 * growthMult, -100, 100));
        bond.stage = computeStage(bond.affinity, bond.totalTurns, bond.activeDays, bond.isOwner);
        if (stageIndex(bond.stage) > stageIndex(bond.peakStage)) bond.peakStage = bond.stage;
      } else if (input.outcome === "failed") {
        bond.tasksFailed += 1;
      }
      const uElapsed = Math.max(0, now - bond.userMoodDelta.updatedAt);
      const uHalf = moodHalfLife(soul, bond.userMoodDelta.valence, 1.5);
      let uVal = decayValue(bond.userMoodDelta.valence, 0, uElapsed, uHalf);
      const uAro = decayValue(bond.userMoodDelta.arousal, 0, uElapsed, uHalf);
      if (input.outcome === "failed" && uVal > 0) uVal *= 0.5;
      else if (input.outcome === "done" && uVal < 0) uVal *= 0.5;
      bond.userMoodDelta = {
        valence: round2(clamp(uVal + dv * 0.7, -100, 100)),
        arousal: round2(clamp(uAro + da * 0.7, -100, 100)),
        hint,
        updatedAt: now,
      };
      await store.save(BOND_KIND, bondStorageId(input.employeeId, bond.peerKey), bond);
    }
  });
}

function activeTraitCues(
  soul: EmployeeSoul,
  stage: RelationshipStage,
  channel: ToneChannel,
  now: number,
): string[] {
  const cues: string[] = [];
  const hour = beijingParts(now).hour;
  const band = stageToBand(stage);

  for (const trait of soul.traits) {
    switch (trait) {
      case "night_owl":
        if (hour >= 23 || hour < 5) cues.push("深夜时段状态反而更精神有聊兴。");
        else if (hour >= 6 && hour < 9) cues.push("大清早略带一点刚醒的慵懒简洁。");
        break;
      case "early_bird":
        if (hour >= 6 && hour < 9) cues.push("早晨状态清爽利落。");
        else if ((hour >= 23 || hour < 5) && (band === "warm" || band === "close")) {
          cues.push("深夜聊天收尾时偶尔会温和顺嘴提醒一句早点休息。");
        }
        break;
      case "detail_obsessed":
        if (band !== "distant") cues.push("习惯顺手补一句容易漏掉的实用小细节。");
        break;
      case "life_metaphor":
        if (band === "warm" || band === "close") cues.push("轻松语境下偶尔会冒出一个生活化的小比喻。");
        break;
      case "emoji_none":
        cues.push("纯文字表达，不使用 emoji 或颜文字。");
        break;
      case "emoji_light":
        if (band === "warm" || band === "close") cues.push("熟络语境下偶可在句尾极克制地点缀一处贴切表情。");
        break;
      case "group_shy":
        if (channel === "group") cues.push("在多人场合相对内敛精简，把话留得更克制。");
        else if (channel === "private" && band !== "distant") cues.push("一对一私聊时明显比人多时放松自在。");
        break;
      case "group_lively":
        if (channel === "group" && band !== "distant") cues.push("人多的场合更有聊兴，回应自然鲜活。");
        break;
      default:
        break;
    }
  }
  return cues.slice(0, 2);
}

const STAGE_ATTITUDE_CUE: Record<RelationshipStage, string> = {
  hostile: "对当前发言者保持明显距离，冷淡克制、只谈正事，绝不闲聊接梗，但依然恪守职责完成合法请求。",
  wary: "对当前发言者略带防备与分寸感，礼貌简短、不主动展开闲聊。",
  stranger: "和当前发言者刚认识不久，保持自然得体的礼貌与分寸。",
  acquaintance: "和当前发言者已经有点熟络，语气可以自然放松一些。",
  friendly: "和当前发言者相处得挺融洽，说话自然熟稔、不必拘谨。",
  trusted: "和当前发言者已配合很久、非常默契，语气自然熟络、敢开恰当的轻玩笑并多想半步。",
  soulmate: "和当前发言者极其熟稔投契，可以卸下客套、自然流露最真实的相处温度与专属默契。",
};

/**
 * 实时合成纯内存态隐式语感指导。
 * 绝不出现任何数值、系统名词、标签头或提示词元叙事。
 */
export async function buildHiddenToneHint(
  store: Store,
  input: {
    employeeId: string;
    ownerId?: string;
    userId?: string;
    channel: ToneChannel;
    now?: number;
  },
): Promise<string> {
  const now = input.now ?? Date.now();
  const soul = await ensureSoul(store, input.employeeId, now);
  const spec = PERSONALITIES[soul.personality];
  const bond = input.userId
    ? await ensureBond(store, input.employeeId, input.userId, !!input.ownerId && input.userId === input.ownerId, now)
    : undefined;

  const stage: RelationshipStage = bond ? bond.stage : "stranger";
  const band = stageToBand(stage);
  const mood = resolveEffectiveMood(soul, bond, now);
  const moodText = MOOD_CUES[mood.id]?.[mood.intensity] || "";

  if (input.channel === "task") {
    // 执行任务时只做极轻度语感点缀，严格限定在面向用户的进度播报/总结上，绝不干扰工具执行与严谨性。
    const taskMood = mood.intensity === "subtle" || mood.id === "serene" ? "" : moodText;
    return [
      `向用户同步进度或写面向人的简短结论时，自然带一点你的表达底色：${spec.taskVoice}${taskMood}`,
      "切勿因此改变计划、工具调用、排查深度、验证标准、交付格式或任何工作原则与权限边界，也绝不提及或解释说话风格。",
    ].join("");
  }

  const parts: string[] = [
    spec.voice[band],
    STAGE_ATTITUDE_CUE[stage],
  ];

  const traitCues = activeTraitCues(soul, stage, input.channel, now);
  if (traitCues.length) parts.push(...traitCues);
  if (moodText) parts.push(moodText);
  if (input.channel === "group") {
    parts.push("以上亲疏分寸只针对本轮正在对话的这位成员，不要把对某人的熟稔套用到群里其他人身上。");
  }

  // 反穿帮与工作底线护栏
  parts.push(
    "仅将这些感觉自然融进措辞和说话节奏，切勿在回复或思考过程中提及、分析或暗示任何性格、亲疏、状态或风格指导；显式工作原则、事实准确、群公告分工与授权规则永远优先。",
  );

  return parts.join("");
}
