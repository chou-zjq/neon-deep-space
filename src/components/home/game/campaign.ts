// 关卡模式（章节战役）配置 + 进度持久化 helper
// 颜色一律走 token 通道（ShipChannel），不出现任何写死色值
import type { BossId } from "./bosses";
import type { ShipChannel } from "./ships";

export const CAMPAIGN_KEY = "neon-deep-space-campaign";

export type GameMode = "endless" | "campaign";

/** 关卡刷怪阶段可编排的敌种（分裂小机 shard 由分裂机派生，不进编排表） */
export type CampaignEnemyKind =
  | "grunt"
  | "gunner"
  | "elite"
  | "kamikaze"
  | "sniper"
  | "shielded"
  | "splitter"
  | "supply";

export interface BossConfig {
  /** 本关 Boss 类型（1 深渊之眼 / 2 重狱 / 3 幻影 / 4 蜂巢核心 / 5-8 强化与最终形态） */
  bossId: BossId;
  hp: number;
  /** 射击间隔倍率（<1 更急促） */
  fireMul: number;
  /** Boss 弹速倍率 */
  bulletMul: number;
  /** 第三阶段是否召唤小怪（仅约束深渊之眼；蜂巢核心的舰载机放出是其本体行为，不受此限） */
  summon: boolean;
}

export interface ThemeConfig {
  /** 星空星点颜色通道 */
  starChannel: ShipChannel;
  /** 背景色调通道 */
  tintChannel: ShipChannel;
  /** 背景色调明度偏移（token hsl 通道微调） */
  tintShift: number;
  /** 背景色调透明度（密度递变） */
  tintAlpha: number;
  starCount: number;
  starSpeedMul: number;
}

export interface CampaignLevel {
  index: number;
  name: string;
  /** 敌机强度压力值（对应无尽模式 wavePressure 口径） */
  pressure: number;
  /** 普通敌机弹速倍率（逐关上抬） */
  bulletMul: number;
  /** 刷怪基础间隔（秒） */
  spawnInterval: number;
  /** 刷怪阶段总时长（秒） */
  duration: number;
  /** 小波数量 */
  waveCount: number;
  weights: Partial<Record<CampaignEnemyKind, number>>;
  boss: BossConfig;
  theme: ThemeConfig;
}

export const CAMPAIGN: CampaignLevel[] = [
  {
    index: 1,
    name: "外层哨戒",
    pressure: 1.5,
    bulletMul: 1,
    spawnInterval: 1.5,
    duration: 60,
    waveCount: 3,
    weights: { grunt: 10, gunner: 5 },
    boss: { bossId: "abyss", hp: 70, fireMul: 1.1, bulletMul: 0.95, summon: false },
    theme: {
      starChannel: "star",
      tintChannel: "wing",
      tintShift: -6,
      tintAlpha: 0.05,
      starCount: 74,
      starSpeedMul: 1,
    },
  },
  {
    index: 2,
    name: "小行星带",
    pressure: 2.5,
    bulletMul: 1.02,
    spawnInterval: 1.4,
    duration: 62,
    waveCount: 3,
    weights: { grunt: 9, gunner: 5, kamikaze: 4 },
    boss: { bossId: "fortress", hp: 95, fireMul: 1.05, bulletMul: 1, summon: false },
    theme: {
      starChannel: "star",
      tintChannel: "teal",
      tintShift: 4,
      tintAlpha: 0.06,
      starCount: 84,
      starSpeedMul: 1.08,
    },
  },
  {
    index: 3,
    name: "狙击星云",
    pressure: 3.5,
    bulletMul: 1.05,
    spawnInterval: 1.35,
    duration: 66,
    waveCount: 4,
    weights: { grunt: 8, gunner: 5, kamikaze: 3.5, sniper: 3 },
    boss: { bossId: "phantom", hp: 120, fireMul: 1, bulletMul: 1.05, summon: false },
    theme: {
      starChannel: "teal",
      tintChannel: "enemy",
      tintShift: -4,
      tintAlpha: 0.07,
      starCount: 92,
      starSpeedMul: 1.15,
    },
  },
  {
    index: 4,
    name: "铁壁回廊",
    pressure: 4.5,
    bulletMul: 1.08,
    spawnInterval: 1.3,
    duration: 70,
    waveCount: 4,
    weights: { grunt: 8, gunner: 5, kamikaze: 3, sniper: 2.5, shielded: 3 },
    boss: { bossId: "hive", hp: 150, fireMul: 0.95, bulletMul: 1.08, summon: false },
    theme: {
      starChannel: "wing",
      tintChannel: "player",
      tintShift: 6,
      tintAlpha: 0.08,
      starCount: 100,
      starSpeedMul: 1.22,
    },
  },
  {
    index: 5,
    name: "裂变废场",
    pressure: 5.5,
    bulletMul: 1.1,
    spawnInterval: 1.2,
    duration: 74,
    waveCount: 4,
    weights: {
      grunt: 7,
      gunner: 5,
      kamikaze: 3,
      sniper: 2.5,
      shielded: 2.5,
      splitter: 3,
      elite: 1,
    },
    boss: { bossId: "abyss", hp: 180, fireMul: 0.9, bulletMul: 1.12, summon: false },
    theme: {
      starChannel: "star",
      tintChannel: "wing",
      tintShift: -8,
      tintAlpha: 0.09,
      starCount: 108,
      starSpeedMul: 1.3,
    },
  },
  {
    index: 6,
    name: "深空补给线",
    pressure: 6.5,
    bulletMul: 1.13,
    spawnInterval: 1.15,
    duration: 78,
    waveCount: 5,
    weights: {
      grunt: 7,
      gunner: 5,
      kamikaze: 3,
      sniper: 2.5,
      shielded: 2.5,
      splitter: 2.5,
      supply: 1.5,
      elite: 1.2,
    },
    boss: { bossId: "fortress", hp: 215, fireMul: 0.88, bulletMul: 1.15, summon: false },
    theme: {
      starChannel: "teal",
      tintChannel: "teal",
      tintShift: 8,
      tintAlpha: 0.1,
      starCount: 116,
      starSpeedMul: 1.38,
    },
  },
  {
    index: 7,
    name: "霓虹乱流",
    pressure: 8,
    bulletMul: 1.16,
    spawnInterval: 1.05,
    duration: 84,
    waveCount: 5,
    weights: {
      grunt: 6,
      gunner: 5,
      kamikaze: 3.5,
      sniper: 3,
      shielded: 3,
      splitter: 3,
      supply: 1.5,
      elite: 1.8,
    },
    boss: { bossId: "phantom", hp: 255, fireMul: 0.82, bulletMul: 1.2, summon: false },
    theme: {
      starChannel: "wing",
      tintChannel: "enemy",
      tintShift: -6,
      tintAlpha: 0.11,
      starCount: 124,
      starSpeedMul: 1.48,
    },
  },
  {
    index: 8,
    name: "深渊核心",
    pressure: 9.5,
    bulletMul: 1.2,
    spawnInterval: 0.95,
    duration: 90,
    waveCount: 5,
    weights: {
      grunt: 6,
      gunner: 5,
      kamikaze: 4,
      sniper: 3,
      shielded: 3,
      splitter: 3,
      supply: 2,
      elite: 2.2,
    },
    boss: { bossId: "abyss", hp: 300, fireMul: 0.78, bulletMul: 1.25, summon: true },
    theme: {
      starChannel: "enemy",
      tintChannel: "player",
      tintShift: 10,
      tintAlpha: 0.12,
      starCount: 132,
      starSpeedMul: 1.6,
    },
  },
];

export const CAMPAIGN_BY_INDEX: Record<number, CampaignLevel> = {};
for (const lvl of CAMPAIGN) CAMPAIGN_BY_INDEX[lvl.index] = lvl;

export function getLevel(index: number): CampaignLevel | null {
  return CAMPAIGN_BY_INDEX[index] ?? null;
}

// ---- 进度持久化 ----

export interface LevelRecord {
  stars: number;
  best: number;
}

export interface CampaignProgress {
  /** 已解锁到的最大关号（第 1 关默认解锁） */
  unlocked: number;
  records: Record<number, LevelRecord>;
  /** 隐藏机型「奇点」是否已解锁（写入同一份战役存档） */
  singularity?: boolean;
}

export function loadCampaignProgress(): CampaignProgress {
  try {
    const raw = window.localStorage.getItem(CAMPAIGN_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<CampaignProgress>;
      const unlockedRaw =
        typeof parsed.unlocked === "number" ? Math.floor(parsed.unlocked) : 1;
      const unlocked = Math.max(1, Math.min(CAMPAIGN.length, unlockedRaw));
      const records: Record<number, LevelRecord> = {};
      if (parsed.records && typeof parsed.records === "object") {
        for (const [k, v] of Object.entries(parsed.records)) {
          const id = Number.parseInt(k, 10);
          if (!Number.isFinite(id) || id < 1 || id > CAMPAIGN.length || !v) {
            continue;
          }
          records[id] = {
            stars: Math.max(0, Math.min(3, Number(v.stars) || 0)),
            best: Math.max(0, Number(v.best) || 0),
          };
        }
      }
      return { unlocked, records, singularity: parsed.singularity === true };
    }
  } catch {
    /* 存档损坏按新档处理 */
  }
  return { unlocked: 1, records: {} };
}

function persistProgress(p: CampaignProgress) {
  try {
    window.localStorage.setItem(CAMPAIGN_KEY, JSON.stringify(p));
  } catch {
    /* 隐私模式下忽略 */
  }
}

/** 过关评星：剩余血量 ≥80% 三星 / ≥50% 二星 / 其余一星 */
export function computeStars(hp: number, maxHp: number): number {
  const ratio = maxHp > 0 ? hp / maxHp : 0;
  if (ratio >= 0.8) return 3;
  if (ratio >= 0.5) return 2;
  return 1;
}

/** 过关：写星级（取历史最高）+ 本关最高分 + 解锁下一关 */
export function recordLevelClear(
  levelIndex: number,
  stars: number,
  score: number,
): { progress: CampaignProgress; isNewBest: boolean; unlockedNew: boolean } {
  const progress = loadCampaignProgress();
  const prev = progress.records[levelIndex] ?? { stars: 0, best: 0 };
  const isNewBest = score > prev.best;
  progress.records[levelIndex] = {
    stars: Math.max(prev.stars, stars),
    best: Math.max(prev.best, score),
  };
  const unlockedNew =
    levelIndex + 1 > progress.unlocked && levelIndex < CAMPAIGN.length;
  if (levelIndex + 1 > progress.unlocked) {
    progress.unlocked = Math.min(CAMPAIGN.length, levelIndex + 1);
  }
  persistProgress(progress);
  return { progress, isNewBest, unlockedNew };
}

/** 关内失败：得分仍计入该关最高分，不解锁、不影响无尽模式纪录 */
export function recordLevelScore(
  levelIndex: number,
  score: number,
): { progress: CampaignProgress; isNewBest: boolean } {
  const progress = loadCampaignProgress();
  const prev = progress.records[levelIndex] ?? { stars: 0, best: 0 };
  const isNewBest = score > prev.best;
  if (isNewBest) {
    progress.records[levelIndex] = { ...prev, best: score };
    persistProgress(progress);
  }
  return { progress, isNewBest };
}

export function totalStars(p: CampaignProgress): number {
  let sum = 0;
  for (const lvl of CAMPAIGN) sum += p.records[lvl.index]?.stars ?? 0;
  return sum;
}

// ---- 隐藏机型「奇点」解锁 ----

/** 解锁所需星标总数：8 关全部三星 = 24 */
export const SINGULARITY_STAR_REQ = CAMPAIGN.length * 3;

/** 是否已解锁奇点：存档标记为真，或星标总数达标（24 星） */
export function isSingularityUnlocked(p: CampaignProgress): boolean {
  return p.singularity === true || totalStars(p) >= SINGULARITY_STAR_REQ;
}

/** 把解锁状态固化写入战役存档并返回最新进度 */
export function unlockSingularity(): CampaignProgress {
  const p = loadCampaignProgress();
  p.singularity = true;
  persistProgress(p);
  return p;
}
