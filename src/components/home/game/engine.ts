import { sfx } from "./audio";
import {
  ABYSS_SPRITE,
  BOSSES,
  BOSS_BY_ID,
  pickEndlessBoss,
  type BossId,
} from "./bosses";
import { pickThreeUpgrades, UPGRADES, type UpgradeDef } from "./upgrades";
import {
  CAMPAIGN_BY_INDEX,
  computeStars,
  type CampaignEnemyKind,
  type CampaignLevel,
  type GameMode,
  type ThemeConfig,
} from "./campaign";
import {
  brightenCss,
  readTokenCss,
  rotateCss,
  shiftCss,
  SHIP_BY_ID,
  type ShipChannel,
  type ShipDef,
  type ShipId,
} from "./ships";

export interface HudStats {
  score: number;
  wave: number;
  hp: number;
  maxHp: number;
  progress: number;
  /** 储存的强化点数量（得分满档攒 1 点，HUD 手动消费） */
  upgradePoints: number;
  /** 当前模式（关卡模式 HUD 不显示波次） */
  mode: GameMode;
  levelIndex: number;
  levelName: string;
  /** 关卡刷怪阶段进度 0-1 */
  stageProgress: number;
  bossActive: boolean;
  /** 当前 Boss 类型名（HUD「BOSS · xx」徽标；无 Boss 时为空串） */
  bossName: string;
  /** 连击数（与连杀狂热共用 killStreak 计数，0 时 HUD 隐藏标识） */
  combo: number;
  /** 连击得分倍率（≥10 ×1.2 / ≥25 ×1.35 / ≥50 ×1.5，封顶 ×1.5） */
  comboMul: number;
  /** 清屏炸弹存量（B 键 / HUD 按钮引爆） */
  bombCount: number;
}

export interface GameOverResult {
  score: number;
  wave: number;
  mode: GameMode;
  levelIndex: number;
  levelName: string;
  bossActive: boolean;
}

export interface StageClearResult {
  levelIndex: number;
  score: number;
  stars: number;
}

export interface StartOptions {
  /** 传关卡号则进入关卡模式；缺省为无尽模式 */
  campaignLevel?: number;
}

export interface GameCallbacks {
  onStats: (s: HudStats) => void;
  onUpgrade: (choices: UpgradeDef[]) => void;
  /** 玩家手动关闭三选一面板（不消耗强化点） */
  onUpgradeClose: () => void;
  onGameOver: (r: GameOverResult) => void;
  onStageClear: (r: StageClearResult) => void;
  onPauseChange: (paused: boolean) => void;
}

export interface GameEngine {
  start: (shipId?: ShipId, opts?: StartOptions) => void;
  pause: () => void;
  resume: () => void;
  /** HUD 点击「强化点」：有存点时暂停并弹出三选一 */
  openUpgrade: () => void;
  /** 关闭三选一面板（不消耗强化点），恢复游戏 */
  closeUpgrade: () => void;
  /** 引爆清屏炸弹（HUD 按钮 / B 键） */
  useBomb: () => void;
  applyUpgrade: (id: string) => void;
  setMuted: (m: boolean) => void;
  destroy: () => void;
}

type SpriteMap = string[];
type EnemyKind =
  | "grunt"
  | "gunner"
  | "elite"
  | "boss"
  | "kamikaze"
  | "sniper"
  | "shielded"
  | "splitter"
  | "shard"
  | "supply";

interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  dmg: number;
  pierce: number;
  hits: Enemy[];
  /** 散射弹：飞行固定射程后消散（fadeAt 为消散线 y，随发射位置走） */
  fade: boolean;
  fadeAt: number;
}

interface EBullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** 蜂巢核心大型缓慢追踪弹：可被击落、超时自然消失（敌弹同口径受时间裂隙减速） */
  big?: boolean;
  hp?: number;
  /** 追踪弹转向角速度（弧度/秒） */
  turn?: number;
  /** 追踪弹剩余寿命（秒） */
  life?: number;
  /** 追踪弹恒定速度 */
  speed?: number;
  /** 幻影高速狙击弹（渲染更粗，判定沿用按弹速扩半径的隧穿防护） */
  snipe?: boolean;
}

interface Missile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  target: Enemy | null;
  life: number;
}

interface Enemy {
  kind: EnemyKind;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  w: number;
  h: number;
  t: number;
  sp: number;
  amp: number;
  fireT: number;
  burstT: number;
  score: number;
  slowT: number;
  /** 减速幅度 0-1（多来源取最大值，随 slowT 到期清零） */
  slowAmt: number;
  /** 护盾机：正面能量护盾独立耐久 */
  shieldHp: number;
  maxShield: number;
  /** 狙击机/补给母机悬停高度 */
  hoverY: number;
  /** 狙击机：蓄力剩余 / 下次蓄力冷却 */
  aimT: number;
  aimCd: number;
  /** 横向速度（分裂小机 / 补给母机漂移） */
  vx: number;
  /** 补给母机治疗周期 */
  healT: number;
  /** Boss 阶段机 */
  phase: number;
  tele: number;
  teleMax: number;
  teleAction: string;
  sweepT: number;
  sweepA: number;
  sweepFire: number;
  sweepCd: number;
  summonT: number;
  /** Boss 调参（关卡模式按关覆盖；无尽默认 1/1/true 保持既有行为） */
  fireMul: number;
  bulletMul: number;
  summonOn: boolean;
  /** Boss 类型（4 种行为按 bossId 分发；非 Boss 恒为 abyss 占位） */
  bossId: BossId;
  /** 重狱：弹幕墙 / 两侧夹击计时 */
  wallT: number;
  pincerT: number;
  /** 蜂巢核心：大型追踪弹计时 */
  homingT: number;
  /** 幻影：瞬移冷却 / 预警倒计时 / 目标 x / 近身散射冷却 */
  blinkT: number;
  blinkWarnT: number;
  blinkX: number;
  nearT: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  /** 三月机型尾焰：爪印造型粒子（掌垫 + 三趾豆） */
  paw?: boolean;
}

interface FloatText {
  x: number;
  y: number;
  text: string;
  life: number;
  maxLife: number;
  color: string;
  big: boolean;
}

interface Star {
  x: number;
  y: number;
  speed: number;
  size: number;
  alpha: number;
}

const WINGMAN_SPRITE: SpriteMap = [
  "..1..",
  ".111.",
  "11211",
  "1.1.1",
];

const GRUNT_SPRITE: SpriteMap = [
  "1.....1",
  "11...11",
  "111.111",
  "1112111",
  ".11111.",
  "..1.1..",
];

const GUNNER_SPRITE: SpriteMap = [
  "..222..",
  ".22122.",
  "2221222",
  "2.212.2",
  "..222..",
  ".2...2.",
];

const ELITE_SPRITE: SpriteMap = [
  ".2.....2.",
  ".22...22.",
  ".2222222.",
  "222211222",
  "222222222",
  ".2222222.",
  "..2...2..",
  ".22...22.",
];

// Boss 造型已扩展为 4 种类型，统一定义在 bosses.ts（ABYSS_SPRITE 为深渊之眼标准型）

// 自爆蜂群机：小型红色飞镖
const KAMIKAZE_SPRITE: SpriteMap = [
  "..1..",
  ".121.",
  "11211",
  ".111.",
  "..2..",
];

// 狙击机：灰色机体 + 红色镜组
const SNIPER_SPRITE: SpriteMap = [
  "..111..",
  ".11211.",
  "11.2.11",
  "1..2..1",
  ".11211.",
  "..111..",
  ".1...1.",
];

// 护盾机：重装方块机
const SHIELDED_SPRITE: SpriteMap = [
  ".11111.",
  "1122211",
  "1211121",
  "1211121",
  "1122211",
  ".11111.",
  "..1.1..",
];

// 分裂机：宽体双舱机
const SPLITTER_SPRITE: SpriteMap = [
  ".11...11.",
  "1111.1111",
  "112222211",
  "112222211",
  "111111111",
  ".1.....1.",
];

// 分裂出的快速小机
const SHARD_SPRITE: SpriteMap = [
  ".1.",
  "121",
  ".1.",
];

// 补给母机：白色医疗母舰
const SUPPLY_SPRITE: SpriteMap = [
  ".1111111.",
  "112222211",
  "121111121",
  "121111121",
  "112222211",
  ".1111111.",
];

const SPRITE_OF: Record<EnemyKind, SpriteMap> = {
  grunt: GRUNT_SPRITE,
  gunner: GUNNER_SPRITE,
  elite: ELITE_SPRITE,
  boss: ABYSS_SPRITE,
  kamikaze: KAMIKAZE_SPRITE,
  sniper: SNIPER_SPRITE,
  shielded: SHIELDED_SPRITE,
  splitter: SPLITTER_SPRITE,
  shard: SHARD_SPRITE,
  supply: SUPPLY_SPRITE,
};

const PX_OF: Record<EnemyKind, number> = {
  grunt: 4,
  gunner: 4,
  elite: 5,
  boss: 6,
  kamikaze: 3,
  sniper: 4,
  shielded: 4,
  splitter: 4,
  shard: 3,
  supply: 4,
};

const WAVE_LEN = 16;
const BASE_TIER_SCORE = 150;
/** 强化点门槛基础值：首档 150，之后基础 250；每攒满 3 点升一档，门槛每档 +30% */
const TIER_STEP = 250;
const UPGRADES_PER_TIER = 3;
const TIER_GROWTH = 1.3;
/** 能量护盾：等级 1/2/3 的生成间隔（秒）；持盾期间计时暂停、盾不叠加 */
const SHIELD_EVERY = [10, 7.5, 5];
const MISSILE_SPEED = 340;
const LASER_TICK = 0.1;
/** 暴击与减速的减速幅度（保持既有 0.45 速度倍率 = 55% 减速） */
const CRIT_SLOW_AMT = 0.55;
/** 电磁弹头：基础减速 15%，每级 +5pp */
const EMP_SLOW_BASE = 0.15;
const EMP_SLOW_STEP = 0.05;
/** 电磁增伤（目标处于减速时）：等级 1/2/3 */
const EMP_DMG_BONUS = [0.25, 0.32, 0.4];
/** 连杀狂热：每层所需连杀 / 每层伤害 / 每层得分 */
const FRENZY_KILLS_PER_STACK = 8;
const FRENZY_DMG_PER_STACK = 0.08;
const FRENZY_SCORE_PER_STACK = 0.1;
/** 超载核心：等级 1/2/3 时每 1 级全场强化的伤害加成 */
const OVERLOAD_PER_LEVEL = [0.03, 0.05, 0.07];
/** 参与「同屏种类 ≤4」限制的特殊敌机（普通机/炮机始终保留） */
const SPECIAL_KINDS = new Set<EnemyKind>([
  "elite",
  "kamikaze",
  "sniper",
  "shielded",
  "splitter",
  "supply",
]);

/** 已攒 taken 点强化点后、下一点所需得分：首档 150；之后基础 250，每攒满 3 点升一档、门槛 +30% */
function tierScore(taken: number): number {
  if (taken <= 0) return BASE_TIER_SCORE;
  const tier = Math.floor(taken / UPGRADES_PER_TIER);
  return Math.round(TIER_STEP * Math.pow(TIER_GROWTH, tier));
}

/** 连击得分倍率：≥10 ×1.2 / ≥25 ×1.35 / ≥50 ×1.5，封顶 ×1.5（被命中清零） */
function comboScoreMulOf(streak: number): number {
  if (streak >= 50) return 1.5;
  if (streak >= 25) return 1.35;
  if (streak >= 10) return 1.2;
  return 1;
}

/** 连击里程碑飘字（10/25/50） */
const COMBO_MILESTONES: [number, string][] = [
  [10, "×1.2 倍率!"],
  [25, "×1.35 倍率!"],
  [50, "×1.5 倍率!"],
];

// ---- 掉落道具 ----
type PickupKind = "repair" | "overdrive" | "timeshift" | "star";

interface Pickup {
  x: number;
  y: number;
  kind: PickupKind;
  t: number;
}

/** 修复核心：十字 */
const REPAIR_SPRITE: SpriteMap = [
  ".111.",
  ".111.",
  "11211",
  ".111.",
  ".111.",
];

/** 火力全开：闪电 */
const OVERDRIVE_SPRITE: SpriteMap = [
  "...11",
  "..12.",
  ".111.",
  "121..",
  ".11..",
  "11...",
];

/** 时间裂隙：沙漏 */
const TIMESHIFT_SPRITE: SpriteMap = [
  "11111",
  ".121.",
  "..2..",
  ".212.",
  "11111",
];

/** 星核：五角星（Boss 专属掉落，立即加分） */
const STAR_SPRITE: SpriteMap = [
  "..1..",
  ".111.",
  "11211",
  ".111.",
  ".1.1.",
];

const PICKUP_SPRITE: Record<PickupKind, SpriteMap> = {
  repair: REPAIR_SPRITE,
  overdrive: OVERDRIVE_SPRITE,
  timeshift: TIMESHIFT_SPRITE,
  star: STAR_SPRITE,
};

const PICKUP_NAME: Record<PickupKind, string> = {
  repair: "修复核心",
  overdrive: "火力全开",
  timeshift: "时间裂隙",
  star: "星核",
};

const PICKUP_PX = 3;
/** 道具下落速度（缓慢下落，出屏消失） */
const PICKUP_SPEED = 58;
/** 掉落概率：普通机 8% / 精英与特殊机 15%（Boss 必掉 2-3 个，另行处理） */
const DROP_CHANCE_NORMAL = 0.08;
const DROP_CHANCE_SPECIAL = 0.15;
/** 火力全开：8 秒过载（射击间隔减半 + 主炮弹道 +1；激光机光束宽度 +50%） */
const OVERDRIVE_DUR = 8;
/** 时间裂隙：4 秒全屏敌机与敌弹减速到 55%（减速 45%） */
const TIMESHIFT_DUR = 4;
const TIMESHIFT_MUL = 0.55;

// ---- 奇点：湮灭冲击环 ----
interface ShockRing {
  x: number;
  y: number;
  r: number;
  maxR: number;
  dmg: number;
  hits: Enemy[];
}

/** 冲击环释放周期 / 最大半径 / 扩张速度 / 单环伤害（走 damageEnemy 统一乘区） */
const SING_RING_CD = 3.5;
const SING_RING_MAX = 180;
const SING_RING_SPEED = 300;
const SING_RING_DMG = 2;

// ---- 猫咪机型：喵爪三连击 ----
interface CatSwipe {
  /** 爪痕固定列 x（释放时锁定，不随战机移动） */
  x: number;
  /** 爪痕前沿 y（自下而上扫过整列） */
  y: number;
  life: number;
  hits: Enemy[];
}

/** 喵爪释放周期 / 扫列时长（0.35s 扫完整列）/ 单痕伤害（走 damageEnemy 统一乘区） */
const CAT_SWIPE_CD = 4;
const CAT_SWIPE_DUR = 0.35;
const CAT_SWIPE_DMG = 2;

// ---- 融合强化：其他战机获得别的机型的特色攻击（均为周期性释放，走 damageEnemy 统一乘区） ----
/** 棱镜僚机：左右双僚机持续激光的释放周期（等级只缩短间隔）/ 激光持续时长 / 每秒伤害（走 damageEnemy 统一乘区） */
const BEAM_EVERY = [6, 5, 4];
const BEAM_DUR = 1.2;
const BEAM_DPS = 2.6;
/** 散射齐射：扇形霰弹齐射周期 / 单丸伤害 / 弹丸数（按等级） */
const VOLLEY_EVERY = [5, 4.2, 3.4];
const VOLLEY_DMG = [0.8, 1.1, 1.4];
const VOLLEY_PELLETS = 5;
/** 喵爪斩（非三月机型）：爪痕周期 / 爪痕道数（按等级；单痕伤害共用 CAT_SWIPE_DMG） */
const FSWIPE_EVERY = [5.5, 4.8, 4.2];
const FSWIPE_COUNT = [3, 4, 5];
/** 湮灭冲击环（非奇点机型）：冲击环周期 / 单次伤害（按等级） */
const FRING_EVERY = [5.5, 4.5, 3.8];
const FRING_DMG = [2, 3, 4];

// ---- 清屏炸弹：主动大招（B 键 / HUD 按钮引爆） ----
/** 初始持有 / 存量上限 / 全屏敌机伤害（走 damageEnemy 统一乘区，Boss 同吃）/ 本局每累计得分补 1 枚 */
const BOMB_START = 1;
const BOMB_MAX = 3;
const BOMB_DMG = 12;
const BOMB_EVERY = 1500;
/** 引爆后的短暂无敌 / 全屏白闪时长 */
const BOMB_INVULN = 1.6;
const BOMB_FLASH_DUR = 0.45;

/** 拿到强化瞬间：上升光柱 + 环形冲击波时长 / 机身白闪时长 */
const UP_BURST_DUR = 0.6;
const UP_FLASH_DUR = 0.35;

/** 三月出场：滑入时长 / 落地爪印印章渐隐时长 */
const CAT_ENTER_DUR = 0.7;
const CAT_STAMP_DUR = 0.55;

export function createGame(
  canvas: HTMLCanvasElement,
  cb: GameCallbacks,
): GameEngine {
  const ctx = canvas.getContext("2d");
  const W = canvas.width;
  const H = canvas.height;

  const C = {
    bg: readTokenCss("--background", "#030712"),
    player: readTokenCss("--primary", "#36F4A4"),
    core: readTokenCss("--foreground", "#FFFFFF"),
    enemy: readTokenCss("--destructive", "#FF6B6B"),
    wing: readTokenCss("--chart-2", "") || readTokenCss("--accent", "#7C8AFF"),
    star: readTokenCss("--muted-foreground", "#8A93A6"),
    // 亮青色：由 accent token 通道提亮派生，用于护盾/补给等新敌机
    teal: brightenCss(readTokenCss("--accent", "#2DD4BF"), 44),
    // 亮蓝：accent 色相旋转 + 提亮派生（火力全开掉落 / 电磁电弧等「电」系视觉）
    bolt: brightenCss(rotateCss(readTokenCss("--accent", "#7C8AFF"), 35), 62),
    // 金色：destructive 色相旋转 + 提亮派生（暴击星爆 / 得分加成粒子）
    gold: brightenCss(rotateCss(readTokenCss("--destructive", "#FF6B6B"), 42), 60),
  };

  // 喵爪光刃粉色：destructive 通道提亮派生（对应猫耳内/鼻的粉色），绿色爪 spark 用 primary
  const catPink = brightenCss(readTokenCss("--destructive", "#FF9EC2"), 18);

  const CH_COLOR: Record<ShipChannel, string> = {
    player: C.player,
    core: C.core,
    enemy: C.enemy,
    wing: C.wing,
    star: C.star,
    teal: C.teal,
    pink: catPink,
    stripe: shiftCss(C.star, -14),
  };

  function paletteFromChannels(
    channels: Record<string, ShipChannel>,
  ): Record<string, string> {
    const m: Record<string, string> = {};
    for (const key of Object.keys(channels)) {
      m[key] = CH_COLOR[channels[key]];
    }
    return m;
  }

  function paletteOf(def: ShipDef): Record<string, string> {
    return paletteFromChannels(def.channels);
  }

  const PALETTES: Record<EnemyKind, Record<string, string>> = {
    grunt: { "1": C.enemy, "2": C.core },
    gunner: { "1": C.core, "2": C.wing },
    elite: { "1": C.core, "2": C.enemy },
    boss: { "1": C.core, "2": C.enemy, "3": C.wing },
    kamikaze: { "1": C.enemy, "2": C.core },
    sniper: { "1": C.star, "2": C.enemy },
    shielded: { "1": C.star, "2": C.core },
    splitter: { "1": C.enemy, "2": C.star },
    shard: { "1": C.star, "2": C.enemy },
    supply: { "1": C.core, "2": C.teal },
  };

  /** 4 种 Boss 各自的调色板（通道经 token 解析） */
  const BOSS_PALETTES = {} as Record<BossId, Record<string, string>>;
  for (const bDef of BOSSES) {
    BOSS_PALETTES[bDef.id] = paletteFromChannels(bDef.channels);
  }

  // ---- 运行状态 ----
  let destroyed = false;
  let running = false;
  let paused = false;
  let upgradeOpen = false;
  let raf = 0;
  let lastT = 0;

  let score = 0;
  let wave = 1;
  let waveT = 0;
  let spawnT = 1.2;
  let scoreAtLast = 0;
  let needed = BASE_TIER_SCORE;
  let upgradesTaken = 0;
  let invuln = 0;
  /** 能量护盾：当前是否持盾 + 生成计时（持盾期间暂停） */
  let shieldReady = false;
  let shieldT = SHIELD_EVERY[0];
  let statsT = 0;
  let missileCool = 0;
  let elapsed = 0;
  let laserAcc = 0;
  let laserSndOn = false;
  let bgmSndOn = false;
  const levels: Record<string, number> = {};
  /** 连杀狂热：未被命中的连续击落数（跨波次持续，命中/死亡/重开清零） */
  let killStreak = 0;
  /** 强化点：得分满档储存，玩家在 HUD 手动开三选一消费（可储存不强制用） */
  let upgradePoints = 0;
  /** 累计已获得的强化点数（门槛档次按它计算，每 3 点升一档） */
  let pointsEarned = 0;

  let shipDef: ShipDef = SHIP_BY_ID.balanced;
  let shipPal: Record<string, string> = paletteOf(shipDef);
  /** 全白调色板（机身白闪用）：把当前机体所有通道映射到 C.core */
  let shipPalWhite: Record<string, string> = {};
  function rebuildWhitePal() {
    const wp: Record<string, string> = {};
    for (const k of Object.keys(shipPal)) wp[k] = C.core;
    shipPalWhite = wp;
  }
  rebuildWhitePal();

  const player = {
    x: W / 2,
    y: H - 70,
    hp: 5,
    maxHp: 5,
    fireLevel: 1,
    fireInterval: 0.24,
    speed: 240,
    scoreMul: 1,
    cool: 0,
    missileLevel: 0,
    pierceLevel: 0,
    wingmanLevel: 0,
    critLevel: 0,
    overloadLevel: 0,
    empLevel: 0,
    frenzyLevel: 0,
    catclawLevel: 0,
    shieldLevel: 0,
    dmgLevel: 0,
    armorLevel: 0,
    prismLevel: 0,
    volleyLevel: 0,
    swipeLevel: 0,
    ringLevel: 0,
  };

  const bullets: Bullet[] = [];
  const enemyBullets: EBullet[] = [];
  const missiles: Missile[] = [];
  const enemies: Enemy[] = [];
  const particles: Particle[] = [];
  const floatTexts: FloatText[] = [];
  const stars: Star[] = [];
  /** 掉落道具（局内实体：暂停/弹窗期间随主循环冻结，不跨局不跨关） */
  const pickups: Pickup[] = [];
  /** 奇点湮灭冲击环 */
  const shockRings: ShockRing[] = [];
  /** 喵爪光刃（每次释放三道，自下而上扫列） */
  const catSwipes: CatSwipe[] = [];
  /** 喵爪技能冷却 */
  let catSkillCd = CAT_SWIPE_CD;
  /** 三月出场滑入剩余时间（>0 期间不接受移动输入） */
  let catEnterT = 0;
  /** 三月落地爪印印章渐隐剩余时间 */
  let catStampT = 0;
  /** 火力全开剩余时间（秒） */
  let overdriveT = 0;
  /** 时间裂隙剩余时间（秒） */
  let timeShiftT = 0;
  /** 奇点冲击环冷却 */
  let singRingCd = SING_RING_CD;
  /** 融合强化周期计时：棱镜光束 / 散射齐射 / 喵爪斩 / 湮灭冲击环 */
  let prismBeamCd = BEAM_EVERY[0];
  let volleyCd = VOLLEY_EVERY[0];
  let fusionSwipeCd = FSWIPE_EVERY[0];
  let fusionRingCd = FRING_EVERY[0];
  /** 棱镜僚机持续激光：剩余释放时间 / tick 结算累加器 */
  let beamActiveT = 0;
  let beamTickAcc = 0;
  /** 清屏炸弹：当前存量 / 补充计分锚点 / 白闪剩余时间 */
  let bombCount = BOMB_START;
  let bombScoreAt = 0;
  let bombFlashT = 0;
  /** 拿到强化瞬间爆发：上升光柱 + 环形冲击波剩余时间 / 机身白闪剩余时间 */
  let upBurstT = 0;
  let upFlashT = 0;

  // ---- 关卡模式状态 ----
  let campaign: CampaignLevel | null = null;
  let campT = 0;
  let campWaveIdx = 0;
  let bossActive = false;
  /** Boss 登场警告横幅剩余时间（期间 WARNING 闪烁 + 加速下滑入位） */
  let bossEnterT = 0;
  let starColor = C.star;
  let themeTint = "";
  let themeTintAlpha = 0;

  /** 按关卡主题重建星空（数量/速度/颜色通道递变），无尽模式回默认星空 */
  function rebuildStars(theme: ThemeConfig | null) {
    stars.length = 0;
    const count = theme ? theme.starCount : 80;
    const speedMul = theme ? theme.starSpeedMul : 1;
    for (let i = 0; i < count; i++) {
      const layer = Math.random();
      stars.push({
        x: Math.random() * W,
        y: Math.random() * H,
        speed: (18 + layer * 80) * speedMul,
        size: layer > 0.85 ? 2 : 1,
        alpha: 0.25 + layer * 0.6,
      });
    }
    if (theme) {
      starColor = CH_COLOR[theme.starChannel] || C.star;
      themeTint = shiftCss(
        CH_COLOR[theme.tintChannel] || C.wing,
        theme.tintShift,
      );
      themeTintAlpha = theme.tintAlpha;
    } else {
      starColor = C.star;
      themeTint = "";
      themeTintAlpha = 0;
    }
  }
  rebuildStars(null);

  const keys: Record<string, boolean> = {};
  let pointerActive = false;
  let pointerTarget: { x: number; y: number } | null = null;

  // ---- 工具 ----
  function pushStats() {
    let bossName = "";
    for (const en of enemies) {
      if (en.kind === "boss") {
        bossName = BOSS_BY_ID[en.bossId].name;
        break;
      }
    }
    cb.onStats({
      score,
      wave,
      hp: Math.max(0, player.hp),
      maxHp: player.maxHp,
      progress: Math.min(1, (score - scoreAtLast) / needed),
      upgradePoints,
      mode: campaign ? "campaign" : "endless",
      levelIndex: campaign?.index ?? 0,
      levelName: campaign?.name ?? "",
      stageProgress: campaign
        ? bossActive
          ? 1
          : Math.min(1, campT / campaign.duration)
        : 0,
      bossActive: campaign ? bossActive : false,
      bossName,
      combo: killStreak,
      comboMul: comboScoreMulOf(killStreak),
      bombCount,
    });
  }

  function explode(x: number, y: number, count: number, big: boolean) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = 60 + Math.random() * (big ? 320 : 220);
      particles.push({
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        life: 0.3 + Math.random() * 0.5,
        maxLife: 0.8,
        size: big ? 3 + Math.floor(Math.random() * 3) : 2 + Math.floor(Math.random() * 2),
        color: Math.random() < 0.5 ? C.enemy : Math.random() < 0.6 ? C.core : C.player,
      });
    }
  }

  /** 暴击星爆：金白色放射状碎光（比普通命中粒子更亮更扩散） */
  function critBurst(x: number, y: number) {
    for (let i = 0; i < 10; i++) {
      const a = (Math.PI * 2 * i) / 10 + Math.random() * 0.3;
      const v = 140 + Math.random() * 160;
      particles.push({
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        life: 0.32,
        maxLife: 0.32,
        size: 2 + Math.floor(Math.random() * 2),
        color: Math.random() < 0.6 ? C.gold : C.core,
      });
    }
  }

  /** 得分加成：击落时溅出的金色上扬粒子（等级越高越多） */
  function scoreSpark(x: number, y: number) {
    const lv = Math.max(0, Math.round((player.scoreMul - 1) / 0.25));
    if (lv <= 0) return;
    const n = Math.min(5, lv + 1);
    for (let i = 0; i < n; i++) {
      particles.push({
        x: x + (Math.random() * 12 - 6),
        y,
        vx: (Math.random() - 0.5) * 60,
        vy: -60 - Math.random() * 80,
        life: 0.5,
        maxLife: 0.5,
        size: 2,
        color: Math.random() < 0.7 ? C.gold : C.core,
      });
    }
  }

  function addScore(v: number, x: number, y: number) {
    // 得分乘区：基础分 × 得分加成(scoreMul) × 连杀狂热得分增幅 × 连击倍率
    const gain = Math.round(
      v * player.scoreMul * frenzyScoreMul() * comboScoreMulOf(killStreak),
    );
    score += gain;
    floatTexts.push({
      x,
      y,
      text: `+${gain}`,
      life: 0.8,
      maxLife: 0.8,
      color: C.core,
      big: false,
    });
    // 得分满档 → 储存强化点（可攒多点；不再自动弹窗，玩家在 HUD 手动消费）
    let gained = 0;
    while (running && score - scoreAtLast >= needed) {
      pointsEarned += 1;
      gained += 1;
      scoreAtLast += needed;
      needed = tierScore(pointsEarned);
    }
    if (gained > 0) {
      upgradePoints += gained;
      floatTexts.push({
        x: player.x,
        y: player.y - 56,
        text: `强化点 +${gained}`,
        life: 1,
        maxLife: 1,
        color: C.core,
        big: false,
      });
      sfx.upgrade();
      pushStats();
    }
    // 清屏炸弹补充：本局每累计 BOMB_EVERY 分补 1 枚（满仓不涨；锚点无条件推进，防满仓即用即补）
    let bombGained = false;
    while (score - bombScoreAt >= BOMB_EVERY) {
      bombScoreAt += BOMB_EVERY;
      if (bombCount < BOMB_MAX) {
        bombCount += 1;
        bombGained = true;
      }
    }
    if (bombGained) {
      floatTexts.push({
        x: player.x,
        y: player.y - 72,
        text: "爆弹 +1",
        life: 1,
        maxLife: 1,
        color: C.core,
        big: false,
      });
      sfx.pickup();
      pushStats();
    }
  }

  /** 清屏炸弹：清空全屏敌弹 + 全屏敌机重创（Boss 同吃），引爆后短暂无敌 + 白闪 */
  function useBomb() {
    if (!running || paused || upgradeOpen || bombCount <= 0) return;
    bombCount -= 1;
    for (const b of enemyBullets) {
      particles.push({
        x: b.x,
        y: b.y,
        vx: (Math.random() - 0.5) * 160,
        vy: (Math.random() - 0.5) * 160,
        life: 0.3,
        maxLife: 0.3,
        size: 2,
        color: C.core,
      });
    }
    enemyBullets.length = 0;
    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];
      explode(e.x, e.y, 8, false);
      if (damageEnemy(e, BOMB_DMG)) {
        enemies.splice(i, 1);
        onEnemyDeath(e);
      }
    }
    invuln = Math.max(invuln, BOMB_INVULN);
    bombFlashT = BOMB_FLASH_DUR;
    sfx.explosion();
    sfx.ringPulse();
    floatTexts.push({
      x: Math.max(60, Math.min(W - 60, player.x)),
      y: player.y - 60,
      text: "湮灭爆弹!",
      life: 1.1,
      maxLife: 1.1,
      color: C.core,
      big: false,
    });
    pushStats();
  }

  function fireEnemyBullet(x: number, y: number, vx: number, vy: number) {
    enemyBullets.push({ x, y, vx, vy });
  }

  function aimedShot(x: number, y: number, speed: number) {
    const dx = player.x - x;
    const dy = player.y - y;
    const len = Math.max(1, Math.hypot(dx, dy));
    fireEnemyBullet(x, y, (dx / len) * speed, (dy / len) * speed);
  }

  // ---- 联动强化乘区 ----
  /** 超载核心：全场强化总等级（含自身）逐级增伤，自身等级越高每级加成越大 */
  function overloadMul(): number {
    const l = player.overloadLevel;
    if (l <= 0) return 1;
    return 1 + upgradesTaken * OVERLOAD_PER_LEVEL[l - 1];
  }

  /** 弹头改装：全部伤害每级 +15%（无上限叠加） */
  function weaponDmgMul(): number {
    return 1 + player.dmgLevel * 0.15;
  }

  /** 连杀狂热当前层数（上限 = 2 + 等级：1 级 3 层，满级 5 层） */
  function frenzyStacksNow(): number {
    if (player.frenzyLevel <= 0) return 0;
    return Math.min(
      2 + player.frenzyLevel,
      Math.floor(killStreak / FRENZY_KILLS_PER_STACK),
    );
  }

  function frenzyDmgMul(): number {
    return 1 + frenzyStacksNow() * FRENZY_DMG_PER_STACK;
  }

  function frenzyScoreMul(): number {
    return 1 + frenzyStacksNow() * FRENZY_SCORE_PER_STACK;
  }

  /** 电磁增伤：仅当目标处于减速且持有电磁弹头时生效（伤害来自所有来源） */
  function empDmgMul(e: Enemy): number {
    if (player.empLevel <= 0 || e.slowT <= 0) return 1;
    return 1 + EMP_DMG_BONUS[player.empLevel - 1];
  }

  /** 电磁弹头减速幅度：基础 15%，每级 +5pp */
  function empSlowAmt(): number {
    return EMP_SLOW_BASE + (player.empLevel - 1) * EMP_SLOW_STEP;
  }

  /** 挂/刷新减速 debuff（暴击减速与电磁弹头共用状态，减速幅度取最大） */
  function applySlow(e: Enemy, amt: number) {
    e.slowT = Math.max(e.slowT, 2.2);
    e.slowAmt = Math.max(e.slowAmt, amt);
  }

  /** 玩家回血（满血不溢出、不转化）：浮动「+N」反馈 + 音效；返回是否实际回到血 */
  function healPlayer(n: number): boolean {
    if (player.hp <= 0 || player.hp >= player.maxHp) return false;
    player.hp = Math.min(player.maxHp, player.hp + n);
    floatTexts.push({
      x: player.x,
      y: player.y - 26,
      text: `+${n}`,
      life: 0.8,
      maxLife: 0.8,
      color: C.player,
      big: false,
    });
    sfx.heal();
    pushStats();
    return true;
  }

  // ---- 掉落道具 ----
  function pickupColor(kind: PickupKind): string {
    if (kind === "repair") return C.player;
    if (kind === "overdrive") return C.bolt;
    if (kind === "star") return catPink;
    return C.teal;
  }

  function spawnPickup(x: number, y: number, kind?: PickupKind) {
    const k: PickupKind =
      kind ??
      (["repair", "overdrive", "timeshift"] as const)[
        Math.floor(Math.random() * 3)
      ];
    pickups.push({
      x: Math.max(14, Math.min(W - 14, x)),
      y,
      kind: k,
      t: 0,
    });
  }

  /** 敌机死亡掉落：普通机 8% / 精英与特殊机 15% / Boss 必掉 2-3 个（类型主题 1 个 + 星核必含） */
  function maybeDropLoot(e: Enemy) {
    if (e.kind === "boss") {
      // Boss 专属掉落：深渊之眼→修复核心 / 重狱→火力全开 / 蜂巢核心→时间裂隙 / 幻影→星核，另必含 1 枚星核
      const themed: Record<BossId, PickupKind> = {
        abyss: "repair",
        fortress: "overdrive",
        hive: "timeshift",
        phantom: "star",
      };
      const n = 2 + (Math.random() < 0.5 ? 1 : 0);
      const drops: PickupKind[] = [themed[e.bossId]];
      if (!drops.includes("star")) drops.push("star");
      const pool: PickupKind[] = ["repair", "overdrive", "timeshift"];
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      for (const k of pool) {
        if (drops.length >= n) break;
        if (!drops.includes(k)) drops.push(k);
      }
      for (let i = 0; i < drops.length; i++) {
        spawnPickup(
          e.x + (i - (drops.length - 1) / 2) * 30,
          e.y + 8,
          drops[i],
        );
      }
      return;
    }
    const chance = SPECIAL_KINDS.has(e.kind)
      ? DROP_CHANCE_SPECIAL
      : DROP_CHANCE_NORMAL;
    if (Math.random() < chance) spawnPickup(e.x, e.y);
  }

  /** 拾取生效：浮动道具名 + 合成音效；修复核心复用回血反馈（浮动「+1」+ 治疗音） */
  function applyPickup(kind: PickupKind) {
    sfx.pickup();
    floatTexts.push({
      x: player.x,
      y: player.y - 48,
      text: PICKUP_NAME[kind],
      life: 1,
      maxLife: 1,
      color: pickupColor(kind),
      big: false,
    });
    if (kind === "repair") {
      healPlayer(1);
    } else if (kind === "overdrive") {
      overdriveT = OVERDRIVE_DUR;
      sfx.overdrive();
    } else if (kind === "star") {
      // 星核：立即 +120 分（走得分乘区，可推进强化门槛）
      addScore(120, player.x, player.y - 30);
      sfx.unlock();
    } else {
      timeShiftT = TIMESHIFT_DUR;
      sfx.timeShift();
    }
    pushStats();
  }

  /**
   * 集中伤害结算（全部玩家侧伤害唯一出口）：
   * 最终伤害 = 基础伤害 × 弹头改装 × 超载核心 × 连杀狂热 × 电磁增伤(仅目标减速时) × 暴击(2x)；
   * 护盾机正面减伤 + 先削盾在乘区之后叠加。返回是否死亡
   */
  function damageEnemy(e: Enemy, baseDmg: number, isCrit = false): boolean {
    const dmg =
      baseDmg *
      weaponDmgMul() *
      overloadMul() *
      frenzyDmgMul() *
      empDmgMul(e) *
      (isCrit ? 2 : 1);
    if (e.kind === "shielded" && e.shieldHp > 0) {
      const d = dmg * 0.5;
      e.shieldHp -= d;
      if (e.shieldHp <= 0) {
        const over = -e.shieldHp;
        e.shieldHp = 0;
        e.hp -= over;
        sfx.shieldBlock();
        explode(e.x, e.y + e.h / 2, 10, false);
      } else {
        for (let i = 0; i < 3; i++) {
          particles.push({
            x: e.x + (Math.random() - 0.5) * e.w,
            y: e.y + e.h / 2 + 3,
            vx: (Math.random() - 0.5) * 90,
            vy: 40 + Math.random() * 60,
            life: 0.22,
            maxLife: 0.22,
            size: 2,
            color: C.teal,
          });
        }
      }
    } else {
      e.hp -= dmg;
    }
    return e.hp <= 0;
  }

  /** 集中死亡结算：爆炸 / 音效 / 得分 / 分裂机裂变 */
  function onEnemyDeath(e: Enemy) {
    // 连杀狂热：连杀计数跨波次/跨小波累计，每满 8 击落叠 1 层
    const prevStacks = frenzyStacksNow();
    killStreak += 1;
    // 连击里程碑（10/25/50）：得分倍率提升飘字
    for (const [n, label] of COMBO_MILESTONES) {
      if (killStreak === n) {
        floatTexts.push({
          x: Math.max(60, Math.min(W - 60, player.x)),
          y: player.y - 60,
          text: label,
          life: 1.1,
          maxLife: 1.1,
          color: C.player,
          big: false,
        });
        sfx.comboMilestone();
        break;
      }
    }
    const newStacks = frenzyStacksNow();
    if (newStacks > prevStacks) {
      floatTexts.push({
        x: player.x,
        y: player.y - 42,
        text: `狂热 ×${newStacks}`,
        life: 0.9,
        maxLife: 0.9,
        color: C.player,
        big: false,
      });
      sfx.unlock();
    }
    // 战场回收已移除：回血来源只剩修复核心掉落与装甲板
    const small = e.kind === "grunt" || e.kind === "shard";
    explode(e.x, e.y, e.kind === "boss" ? 46 : small ? 12 : 18, !small);
    if (e.kind === "kamikaze") sfx.kamikazeBoom();
    else sfx.explosion();
    addScore(e.score, e.x, e.y);
    if (e.kind !== "boss") maybeDropLoot(e);
    if (e.kind === "splitter") {
      // 死亡分裂成 2 架快速小机（小机不再分裂）
      for (const side of [-1, 1]) {
        const m = makeEnemy("shard");
        m.x = Math.max(16, Math.min(W - 16, e.x + side * 12));
        m.y = e.y;
        m.vx = side * 78;
        enemies.push(m);
      }
    }
    if (e.kind === "boss") {
      floatTexts.push({
        x: W / 2,
        y: H / 2 - 30,
        text: "BOSS 击破!",
        life: 1.4,
        maxLife: 1.4,
        color: C.player,
        big: true,
      });
      sfx.waveAlert();
      if (campaign) {
        finishStageClear();
        return;
      }
      // 无尽模式 Boss 必掉 2-3 个道具（类型主题 1 个 + 星核必含）
      maybeDropLoot(e);
    }
    pushStats();
  }

  function damagePlayer() {
    if (invuln > 0 || !running) return;
    // 能量护盾：持盾时抵挡本次命中（不掉血、不清连击），破盾后按当前等级间隔重新计时
    if (shieldReady && player.shieldLevel > 0) {
      shieldReady = false;
      shieldT = SHIELD_EVERY[player.shieldLevel - 1];
      sfx.shieldBlock();
      floatTexts.push({
        x: player.x,
        y: player.y - 40,
        text: "护盾抵挡!",
        life: 0.9,
        maxLife: 0.9,
        color: C.teal,
        big: false,
      });
      for (let i = 0; i < 8; i++) {
        const a = Math.random() * Math.PI * 2;
        particles.push({
          x: player.x + Math.cos(a) * 22,
          y: player.y + Math.sin(a) * 22,
          vx: Math.cos(a) * 120,
          vy: Math.sin(a) * 120,
          life: 0.3,
          maxLife: 0.3,
          size: 2,
          color: C.teal,
        });
      }
      invuln = 1;
      pushStats();
      return;
    }
    // 无盾受击直接扣血，并清空连杀狂热层数
    player.hp -= 1;
    killStreak = 0;
    sfx.hit();
    explode(player.x, player.y, 10, false);
    invuln = 1.3;
    pushStats();
    if (player.hp <= 0) gameOver();
  }

  function gameOver() {
    running = false;
    explode(player.x, player.y, 44, true);
    sfx.gameOver();
    pushStats();
    cb.onGameOver({
      score,
      wave,
      mode: campaign ? "campaign" : "endless",
      levelIndex: campaign?.index ?? 0,
      levelName: campaign?.name ?? "",
      bossActive: campaign ? bossActive : false,
    });
  }

  /** 关卡模式：击败关底 Boss 即过关，按剩余血量评星后交给结算界面 */
  function finishStageClear() {
    if (!campaign) return;
    running = false;
    enemies.length = 0;
    enemyBullets.length = 0;
    missiles.length = 0;
    pickups.length = 0;
    shockRings.length = 0;
    catSwipes.length = 0;
    beamActiveT = 0;
    beamTickAcc = 0;
    bombFlashT = 0;
    upBurstT = 0;
    upFlashT = 0;
    const stars = computeStars(Math.max(0, player.hp), player.maxHp);
    sfx.stageClear();
    pushStats();
    cb.onStageClear({ levelIndex: campaign.index, score, stars });
  }

  // ---- 生成 ----
  /**
   * 波次压力值：前 10 波按 0.6/波 平缓增长；10 波以后按 1.15/波 拉开
   * （玩家强化成型快，敌强曲线后期小幅上抬保持张力）
   */
  function wavePressure(): number {
    return Math.min(wave - 1, 9) * 0.6 + Math.max(0, wave - 10) * 1.15;
  }

  /** 当前压力值：关卡模式取每关预设，无尽模式取波次函数 */
  function pressureNow(): number {
    return campaign ? campaign.pressure : wavePressure();
  }

  /**
   * 无尽模式血量增长（线性叠加，非指数复利）：
   * 小怪：第 1 波起每波 +10%（第 1 波 100% → 第 10 波 190%），第 11 波起每波再 +30%（220%、250%…）
   * Boss：每次出场 +200%（第 1 次 100%、第 2 次 300%、第 3 次 500%；无尽每 5 波出场一次）
   * 碎片弹保持 1 血不缩放；关卡模式恒 1（走每关预设压力值）
   */
  function endlessHpScale(boss = false): number {
    if (campaign) return 1;
    if (boss) {
      const n = Math.max(1, Math.floor(wave / 5));
      return 1 + 2 * (n - 1);
    }
    if (wave <= 10) return 1 + 0.1 * (wave - 1);
    return 1.9 + 0.3 * (wave - 10);
  }

  /** 普通敌机弹速倍率（关卡模式逐关上抬） */
  function bulletScale(): number {
    return campaign ? campaign.bulletMul : 1;
  }

  function makeEnemy(kind: EnemyKind, bossId?: BossId): Enemy {
    const bDef = kind === "boss" ? BOSS_BY_ID[bossId ?? "abyss"] : null;
    const sprite = bDef ? bDef.sprite : SPRITE_OF[kind];
    const px = bDef ? bDef.px : PX_OF[kind];
    const w = sprite[0].length * px;
    const h = sprite.length * px;
    const p = pressureNow();
    let hp = 1;
    let sp = 1;
    let sv = 10;
    let amp = 0;
    let shieldHp = 0;
    let hoverY = 0;
    let vx = 0;
    switch (kind) {
      case "grunt":
        hp = 1 + Math.floor(p * 0.35);
        sp = Math.min(210, 65 + p * 7);
        sv = 10;
        amp = Math.random() < 0.5 ? 0 : 34;
        break;
      case "gunner":
        hp = 2 + Math.floor(p * 0.55);
        sp = Math.min(165, 52 + p * 5);
        sv = 25;
        break;
      case "elite":
        hp = 6 + Math.floor(p * 1.1);
        sp = Math.min(135, 42 + p * 4);
        sv = 60;
        amp = 46;
        break;
      case "kamikaze":
        hp = 1 + Math.floor(p * 0.15);
        sp = Math.min(330, 170 + p * 9);
        sv = 8;
        break;
      case "sniper":
        hp = 3 + Math.floor(p * 0.6);
        sp = Math.min(120, 60 + p * 4);
        sv = 30;
        hoverY = 70 + Math.random() * 90;
        break;
      case "shielded":
        hp = 5 + Math.floor(p * 0.9);
        sp = Math.min(95, 45 + p * 3);
        sv = 40;
        shieldHp = 4 + Math.floor(p * 0.7);
        break;
      case "splitter":
        hp = 4 + Math.floor(p * 0.7);
        sp = Math.min(125, 60 + p * 4);
        sv = 35;
        amp = 20;
        break;
      case "shard":
        hp = 1;
        sp = Math.min(270, 170 + p * 8);
        sv = 5;
        break;
      case "supply":
        hp = 12 + Math.floor(p * 1.6);
        sp = 48;
        sv = 80;
        hoverY = 100 + Math.random() * 50;
        vx = (Math.random() < 0.5 ? -1 : 1) * (14 + Math.random() * 10);
        break;
      default: {
        // boss：基准血量（无尽波次公式 / 关卡预设）× 类型血量倍率 × 无尽血量系数（放缓曲线）
        const baseHp = campaign ? campaign.boss.hp : 36 + wave * 10;
        hp = Math.round(baseHp * (bDef?.hpMul ?? 1) * endlessHpScale(true));
        sp = 30;
        sv = 300;
        // 重狱：横向缓慢漂移
        if ((bossId ?? "abyss") === "fortress") {
          vx = (Math.random() < 0.5 ? -1 : 1) * 22;
        }
        break;
      }
    }
    // 无尽模式：非 Boss 敌机血量（含护盾机盾值）× 波次复利系数；碎片保持 1 血
    if (kind !== "boss" && kind !== "shard") {
      const hpScale = endlessHpScale();
      hp = Math.max(1, Math.round(hp * hpScale));
      if (shieldHp > 0) shieldHp = Math.max(1, Math.round(shieldHp * hpScale));
    }
    return {
      kind,
      x: kind === "boss" ? W / 2 : 30 + Math.random() * (W - 60),
      y: -h - 10,
      hp,
      maxHp: hp,
      w,
      h,
      t: Math.random() * Math.PI * 2,
      sp,
      amp,
      fireT: 1 + Math.random(),
      burstT: 3.5,
      score: sv,
      slowT: 0,
      slowAmt: 0,
      shieldHp,
      maxShield: shieldHp,
      hoverY,
      aimT: 0,
      aimCd: 0.8 + Math.random(),
      vx,
      healT: 2.2,
      phase: 1,
      tele: 0,
      teleMax: 1,
      teleAction: "",
      sweepT: 0,
      sweepA: 0,
      sweepFire: 0,
      sweepCd: 4.5,
      summonT: 6,
      fireMul: campaign ? campaign.boss.fireMul : 1,
      bulletMul: campaign ? campaign.boss.bulletMul : 1,
      // summonOn 仅约束深渊之眼三阶段召唤；蜂巢核心的舰载机放出是其本体行为，不受此限
      summonOn: campaign ? campaign.boss.summon : true,
      bossId: kind === "boss" ? (bossId ?? "abyss") : "abyss",
      wallT: 2.4,
      pincerT: 3.2,
      homingT: 2.8,
      blinkT: 2.4,
      blinkWarnT: 0,
      blinkX: W / 2,
      nearT: 1.4,
    };
  }

  /** 波次生成器：按解锁表混入新机型，越靠后新机型占比越高；同屏特殊种类 ≤4 */
  function spawnWaveEnemy() {
    const entries: { k: EnemyKind; w: number }[] = [{ k: "grunt", w: 10 }];
    if (wave >= 2) {
      entries.push({ k: "gunner", w: 5 });
      entries.push({ k: "kamikaze", w: 1.5 + wave * 0.45 });
    }
    if (wave >= 3) entries.push({ k: "elite", w: 0.6 + wave * 0.1 });
    if (wave >= 4) entries.push({ k: "sniper", w: 0.8 + wave * 0.28 });
    if (wave >= 5) entries.push({ k: "shielded", w: 0.8 + wave * 0.26 });
    if (wave >= 6) entries.push({ k: "splitter", w: 0.8 + wave * 0.26 });
    if (wave >= 8) entries.push({ k: "supply", w: 0.4 + wave * 0.12 });
    let total = 0;
    for (const en of entries) total += en.w;
    let roll = Math.random() * total;
    let kind: EnemyKind = "grunt";
    for (const en of entries) {
      roll -= en.w;
      if (roll <= 0) {
        kind = en.k;
        break;
      }
    }
    // 补给母机同屏限 1 架
    if (kind === "supply" && enemies.some((e) => e.kind === "supply")) {
      kind = "grunt";
    }
    // 同屏特殊种类不超过 4 种（普通机/炮机始终保留）
    if (SPECIAL_KINDS.has(kind)) {
      const present = new Set<EnemyKind>();
      for (const e of enemies) {
        if (SPECIAL_KINDS.has(e.kind)) present.add(e.kind);
      }
      if (!present.has(kind) && present.size >= 4) {
        kind = Math.random() < 0.55 ? "grunt" : "gunner";
      }
    }
    if (kind === "kamikaze") {
      // 自爆蜂群：成群刷
      const n = wave >= 6 ? 4 : 3;
      const cx = 50 + Math.random() * (W - 100);
      for (let i = 0; i < n; i++) {
        const m = makeEnemy("kamikaze");
        m.x = Math.max(20, Math.min(W - 20, cx + (i - (n - 1) / 2) * 26));
        m.y = -m.h - 10 - i * 20;
        enemies.push(m);
      }
      return;
    }
    enemies.push(makeEnemy(kind));
  }

  function spawnBoss() {
    // 无尽模式：每 5 的倍数波从 4 种 Boss 随机一种（波次越高非标准型权重越大）
    const id = pickEndlessBoss(wave);
    enemies.push(makeEnemy("boss", id));
    floatTexts.push({
      x: W / 2,
      y: H / 2 - 80,
      text: `WAVE ${wave} · ${BOSS_BY_ID[id].name}`,
      life: 2,
      maxLife: 2,
      color: C.enemy,
      big: true,
    });
    bossEnterT = 2.2;
    sfx.bossCharge();
  }

  /** 关卡模式刷怪：按每关预设敌种编排（同屏限制规则与无尽一致） */
  function spawnCampaignEnemy() {
    if (!campaign) return;
    const entries = Object.entries(campaign.weights) as [
      CampaignEnemyKind,
      number,
    ][];
    let total = 0;
    for (const [, w] of entries) total += w;
    let roll = Math.random() * total;
    let kind: CampaignEnemyKind = "grunt";
    for (const [k, w] of entries) {
      roll -= w;
      if (roll <= 0) {
        kind = k;
        break;
      }
    }
    // 补给母机同屏限 1 架
    if (kind === "supply" && enemies.some((e) => e.kind === "supply")) {
      kind = "grunt";
    }
    // 同屏特殊种类不超过 4 种（普通机/炮机始终保留）
    if (SPECIAL_KINDS.has(kind)) {
      const present = new Set<EnemyKind>();
      for (const e of enemies) {
        if (SPECIAL_KINDS.has(e.kind)) present.add(e.kind);
      }
      if (!present.has(kind) && present.size >= 4) {
        kind = Math.random() < 0.55 ? "grunt" : "gunner";
      }
    }
    if (kind === "kamikaze") {
      // 自爆蜂群：成群刷
      const n = campaign.index >= 6 ? 4 : 3;
      const cx = 50 + Math.random() * (W - 100);
      for (let i = 0; i < n; i++) {
        const m = makeEnemy("kamikaze");
        m.x = Math.max(20, Math.min(W - 20, cx + (i - (n - 1) / 2) * 26));
        m.y = -m.h - 10 - i * 20;
        enemies.push(m);
      }
      return;
    }
    enemies.push(makeEnemy(kind));
  }

  /** 关卡模式：刷怪阶段结束，关底 Boss 入场（复用预警/多阶段机制） */
  function spawnCampaignBoss() {
    if (!campaign || bossActive) return;
    bossActive = true;
    const bossIdNow = campaign.boss.bossId;
    enemies.push(makeEnemy("boss", bossIdNow));
    floatTexts.push({
      x: W / 2,
      y: H / 2 - 80,
      text: `${campaign.name} · ${BOSS_BY_ID[bossIdNow].name}来袭`,
      life: 2,
      maxLife: 2,
      color: C.enemy,
      big: true,
    });
    bossEnterT = 2.2;
    sfx.bossCharge();
    pushStats();
  }

  // ---- Boss 弹幕 ----
  function ringBurst(e: Enemy, n: number, speed: number, offset = 0) {
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + e.t + offset;
      fireEnemyBullet(e.x, e.y, Math.cos(a) * speed, Math.sin(a) * speed);
    }
  }

  function bossAimedFan(e: Enemy) {
    const base = Math.atan2(player.y - (e.y + e.h / 2), player.x - e.x);
    const offs =
      e.phase === 1
        ? [-0.12, 0, 0.12]
        : e.phase === 2
          ? [-0.3, -0.15, 0, 0.15, 0.3]
          : [-0.42, -0.21, 0, 0.21, 0.42];
    const speed =
      (e.phase === 3 ? 265 : e.phase === 2 ? 250 : 235) * e.bulletMul;
    for (const o of offs) {
      const a = base + o;
      fireEnemyBullet(
        e.x,
        e.y + e.h / 2,
        Math.cos(a) * speed,
        Math.sin(a) * speed,
      );
    }
  }

  // ---- Boss 行为表（4 种类型按 bossId 分发；三阶段机 / 预警 / 血条共用） ----

  /** 幻影狙击蓄力时长（秒） */
  const PHANTOM_AIM_TIME = 1;

  /** 幻影高速狙击弹（沿用狙击机弹道口径，更粗更快；判定按弹速扩半径防隧穿） */
  function aimedSnipe(x: number, y: number, speed: number) {
    const dx = player.x - x;
    const dy = player.y - y;
    const len = Math.max(1, Math.hypot(dx, dy));
    enemyBullets.push({
      x,
      y,
      vx: (dx / len) * speed,
      vy: (dy / len) * speed,
      snipe: true,
    });
  }

  /** Boss 通用入口：下压到悬停高度 -> 按类型移动 -> 三阶段机 + 预警分发 */
  function updateBoss(e: Enemy, dt: number, tsMul: number) {
    const def = BOSS_BY_ID[e.bossId];
    const targetY = e.bossId === "hive" ? 84 : 100;
    if (e.y < targetY) e.y += (bossEnterT > 0 ? 130 : 50) * dt * tsMul;
    moveBoss(e, dt, tsMul);
    const inPos = e.y >= targetY - 5;
    // 三阶段：100%-60% / 60%-30% / <30%（四种 Boss 通用）
    const ratio = e.hp / e.maxHp;
    const ph = ratio > 0.6 ? 1 : ratio > 0.3 ? 2 : 3;
    if (ph < e.phase && e.tele <= 0) {
      // 进入更低阶段：预警（机体闪烁 + 蓄力光圈 + 弹幕停顿）
      e.phase = ph;
      e.tele = 1.1;
      e.teleMax = 1.1;
      e.teleAction = "phase";
      sfx.bossCharge();
    }
    if (e.tele > 0) {
      e.tele -= dt;
      if (e.tele <= 0) {
        if (e.teleAction === "phase") {
          sfx.bossPhase();
          floatTexts.push({
            x: W / 2,
            y: H / 2 - 40,
            text: `${def.name} 第${e.phase}阶段 · 狂暴`,
            life: 1.4,
            maxLife: 1.4,
            color: C.enemy,
            big: true,
          });
          if (e.bossId === "abyss" && e.phase === 3) {
            ringBurst(e, 16, 150 * e.bulletMul);
          }
        } else if (e.teleAction === "burst") {
          ringBurst(e, e.phase >= 2 ? 16 : 12, 150 * e.bulletMul);
          if (e.phase >= 2) {
            ringBurst(
              e,
              e.phase >= 3 ? 16 : 12,
              195 * e.bulletMul,
              Math.PI / (e.phase >= 3 ? 16 : 12),
            );
          }
        } else if (e.teleAction === "sweep") {
          e.sweepT = 1.6;
          e.sweepA = 0;
          e.sweepFire = 0;
        } else if (e.teleAction === "wall") {
          fortressWall(e);
        } else if (e.teleAction === "homing") {
          hiveHoming(e);
        }
        e.teleAction = "";
      }
    } else if (inPos) {
      fireBoss(e, dt);
    }
  }

  /** Boss 移动（按类型） */
  function moveBoss(e: Enemy, dt: number, tsMul: number) {
    if (e.bossId === "abyss") {
      e.x = W / 2 + Math.sin(e.t * 0.8) * (W / 2 - 90);
    } else if (e.bossId === "fortress") {
      // 重狱：横向缓慢漂移，边缘折返
      e.x += e.vx * dt * tsMul;
      if (e.x < e.w / 2 + 6) {
        e.x = e.w / 2 + 6;
        e.vx = Math.abs(e.vx);
      }
      if (e.x > W - e.w / 2 - 6) {
        e.x = W - e.w / 2 - 6;
        e.vx = -Math.abs(e.vx);
      }
    } else if (e.bossId === "hive") {
      // 蜂巢核心：悬停屏幕上部缓慢横移
      e.x = W / 2 + Math.sin(e.t * 0.35) * (W / 2 - 100);
    } else if (e.blinkWarnT <= 0) {
      // 幻影：高机动小幅横移（瞬移预警期间定身，保证预警圈可读）
      e.x += Math.sin(e.t * 1.6) * 30 * dt * tsMul;
      e.x = Math.max(e.w / 2 + 8, Math.min(W - e.w / 2 - 8, e.x));
    }
  }

  /** Boss 开火行为分发 */
  function fireBoss(e: Enemy, dt: number) {
    if (e.bossId === "abyss") fireAbyss(e, dt);
    else if (e.bossId === "fortress") fireFortress(e, dt);
    else if (e.bossId === "hive") fireHive(e, dt);
    else firePhantom(e, dt);
  }

  /** 深渊之眼（标准型）：扇形 + 环形 + 扫射 + 三阶段召唤（既有 Boss 行为原样保留） */
  function fireAbyss(e: Enemy, dt: number) {
    e.fireT -= dt;
    if (e.fireT <= 0) {
      e.fireT =
        Math.max(0.6, 1.6 - pressureNow() * 0.05) *
        (e.phase === 1 ? 1 : e.phase === 2 ? 0.8 : 0.62) *
        e.fireMul;
      bossAimedFan(e);
    }
    e.burstT -= dt;
    if (e.burstT <= 0) {
      e.burstT =
        Math.max(2.6, 5.2 - pressureNow() * 0.12) *
        (e.phase >= 2 ? 0.7 : 1) *
        e.fireMul;
      // 大招发射前预警
      e.tele = 0.55;
      e.teleMax = 0.55;
      e.teleAction = "burst";
      sfx.bossCharge();
    }
    if (e.phase === 3) {
      // 三阶段：扇形扫射 + 周期性召唤小怪
      e.sweepCd -= dt;
      if (e.sweepCd <= 0 && e.tele <= 0) {
        e.sweepCd = 4.6;
        e.tele = 0.6;
        e.teleMax = 0.6;
        e.teleAction = "sweep";
        sfx.bossCharge();
      }
      e.summonT -= dt;
      if (e.summonOn && e.summonT <= 0) {
        e.summonT = 5.5;
        for (const side of [-1, 1]) {
          const mk: EnemyKind = Math.random() < 0.5 ? "kamikaze" : "grunt";
          const m = makeEnemy(mk);
          m.x = Math.max(30, Math.min(W - 30, e.x + side * 46));
          m.y = e.y + 26;
          enemies.push(m);
        }
        floatTexts.push({
          x: e.x,
          y: e.y + e.h / 2 + 18,
          text: "召唤!",
          life: 0.8,
          maxLife: 0.8,
          color: C.enemy,
          big: false,
        });
      }
      if (e.sweepT > 0) {
        e.sweepT -= dt;
        e.sweepFire -= dt;
        if (e.sweepFire <= 0) {
          e.sweepFire = 0.09;
          e.sweepA += 0.24;
          const a = Math.PI / 2 + Math.sin(e.sweepA) * 1.0;
          fireEnemyBullet(
            e.x,
            e.y + e.h / 2,
            Math.cos(a) * 200 * e.bulletMul,
            Math.sin(a) * 200 * e.bulletMul,
          );
        }
      }
    }
  }

  /** 重狱（弹幕堡垒型）：带缺口墙状弹幕 + 两侧夹击扇形齐射，不召唤 */
  function fireFortress(e: Enemy, dt: number) {
    e.wallT -= dt;
    if (e.wallT <= 0 && e.tele <= 0) {
      e.wallT =
        (e.phase === 1 ? 2.7 : e.phase === 2 ? 2.3 : 1.95) * e.fireMul;
      // 弹幕墙推出前预警
      e.tele = 0.5;
      e.teleMax = 0.5;
      e.teleAction = "wall";
      sfx.bossCharge();
    }
    e.pincerT -= dt;
    if (e.pincerT <= 0 && e.tele <= 0) {
      e.pincerT =
        (e.phase === 1 ? 3.4 : e.phase === 2 ? 2.8 : 2.2) * e.fireMul;
      fortressPincer(e);
    }
  }

  /** 墙状横向弹幕：整排弹留 1-2 个可穿缺口（位置随机），三阶段一次推 2 层 */
  function fortressWall(e: Enemy) {
    sfx.wallLaunch();
    const cols = 17;
    const step = W / cols;
    // 阶段递进：缺口变窄（2 → 1）、弹速提升、三阶段双层墙
    const gapCols = e.phase === 3 ? 1 : 2;
    const speed =
      (e.phase === 1 ? 105 : e.phase === 2 ? 125 : 150) * e.bulletMul;
    const layers = e.phase === 3 ? 2 : 1;
    const y0 = e.y + e.h / 2 + 8;
    const gapStart = Math.floor(Math.random() * (cols - gapCols));
    for (let l = 0; l < layers; l++) {
      // 第二层缺口错位，两道墙错开下压
      const gs =
        l === 0
          ? gapStart
          : Math.max(
              0,
              Math.min(cols - gapCols, gapStart + (Math.random() < 0.5 ? -4 : 4)),
            );
      for (let c = 0; c < cols; c++) {
        if (c >= gs && c < gs + gapCols) continue;
        fireEnemyBullet(step * (c + 0.5), y0 - l * 48, 0, speed);
      }
    }
  }

  /** 两侧夹击：机体两侧向玩家方向扇形齐射（数量随阶段提升） */
  function fortressPincer(e: Enemy) {
    const n = e.phase === 1 ? 3 : e.phase === 2 ? 4 : 5;
    const speed = (170 + (e.phase - 1) * 25) * e.bulletMul;
    for (const side of [-1, 1]) {
      const ox = e.x + side * (e.w / 2 - 6);
      const oy = e.y + e.h / 2 - 4;
      const base = Math.atan2(player.y - oy, player.x - ox);
      for (let i = 0; i < n; i++) {
        const a = base - 0.25 + (i / Math.max(1, n - 1)) * 0.5;
        fireEnemyBullet(ox, oy, Math.cos(a) * speed, Math.sin(a) * speed);
      }
    }
  }

  /** 蜂巢核心（突袭母舰型）：周期放出舰载小怪 + 大型缓慢追踪弹 */
  function fireHive(e: Enemy, dt: number) {
    e.summonT -= dt;
    if (e.summonT <= 0) {
      // 阶段递进：召唤间隔缩短、每次数量增加
      e.summonT =
        (e.phase === 1 ? 4.6 : e.phase === 2 ? 3.8 : 3.0) * e.fireMul;
      hiveSpawn(e);
    }
    e.homingT -= dt;
    if (e.homingT <= 0 && e.tele <= 0) {
      e.homingT =
        (e.phase === 1 ? 3.6 : e.phase === 2 ? 3.0 : 2.5) * e.fireMul;
      // 追踪弹发射前预警
      e.tele = 0.45;
      e.teleMax = 0.45;
      e.teleAction = "homing";
      sfx.bossCharge();
    }
  }

  /** 舱口放出舰载机：一阶段全自爆小机，二阶段起混入持盾小机（复用现有敌机） */
  function hiveSpawn(e: Enemy) {
    const kamis = e.phase === 3 ? 3 : 2;
    const shields = e.phase >= 2 ? 1 : 0;
    const kinds: EnemyKind[] = [];
    for (let i = 0; i < kamis; i++) kinds.push("kamikaze");
    for (let i = 0; i < shields; i++) kinds.push("shielded");
    kinds.forEach((k, i) => {
      const m = makeEnemy(k);
      const side = i % 2 === 0 ? -1 : 1;
      m.x = Math.max(24, Math.min(W - 24, e.x + side * (18 + i * 12)));
      m.y = e.y + e.h / 2 + 12;
      enemies.push(m);
      // 舱口弹出粒子（发光舱口位置）
      for (let j = 0; j < 4; j++) {
        particles.push({
          x: m.x,
          y: m.y,
          vx: (Math.random() - 0.5) * 60,
          vy: 30 + Math.random() * 50,
          life: 0.25,
          maxLife: 0.25,
          size: 2,
          color: C.teal,
        });
      }
    });
    floatTexts.push({
      x: e.x,
      y: e.y + e.h / 2 + 20,
      text: "放出!",
      life: 0.8,
      maxLife: 0.8,
      color: C.enemy,
      big: false,
    });
  }

  /** 大型缓慢追踪弹：大半径、慢速、朝玩家缓转向，可被击落或超时消失，三阶段双发 */
  function hiveHoming(e: Enemy) {
    sfx.homingLaunch();
    const shots = e.phase === 3 ? 2 : 1;
    for (let i = 0; i < shots; i++) {
      const ox = shots === 1 ? 0 : i === 0 ? -18 : 18;
      const speed = 95 * e.bulletMul;
      const a = Math.atan2(player.y - e.y, player.x - (e.x + ox));
      enemyBullets.push({
        x: e.x + ox,
        y: e.y + e.h / 2 + 10,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        big: true,
        hp: 4,
        turn: 1.7,
        life: 7,
        speed,
      });
    }
  }

  /** 幻影（幽影狙击型）：闪烁瞬移 + 蓄力狙击 + 近身散射自保 */
  function firePhantom(e: Enemy, dt: number) {
    // 横向闪烁瞬移：目标位置先出预警圈，瞬移时原地残影渐隐（三阶段追加纯视觉爆散）
    if (e.blinkWarnT > 0) {
      e.blinkWarnT -= dt;
      if (e.blinkWarnT <= 0) {
        for (let i = 0; i < 12; i++) {
          particles.push({
            x: e.x + (Math.random() - 0.5) * e.w,
            y: e.y + (Math.random() - 0.5) * e.h,
            vx: (Math.random() - 0.5) * 50,
            vy: (Math.random() - 0.5) * 50,
            life: 0.4,
            maxLife: 0.4,
            size: 2,
            color: C.wing,
          });
        }
        if (e.phase === 3) explode(e.x, e.y, 16, false);
        e.x = e.blinkX;
        sfx.blink();
      }
    } else {
      e.blinkT -= dt;
      if (e.blinkT <= 0) {
        // 阶段递进：瞬移冷却缩短
        e.blinkT =
          (e.phase === 1 ? 3.2 : e.phase === 2 ? 2.4 : 1.8) *
          Math.max(0.6, e.fireMul);
        let tx = 60 + Math.random() * (W - 120);
        if (Math.abs(tx - e.x) < 90) tx += e.x < W / 2 ? 150 : -150;
        e.blinkX = Math.max(50, Math.min(W - 50, tx));
        e.blinkWarnT = 0.45;
        sfx.bossCharge();
      }
    }
    // 狙击蓄力：红色预警线约 1 秒后发射高速狙击弹（二阶段起双发双线）
    if (e.aimT > 0) {
      e.aimT -= dt;
      if (e.aimT <= 0) {
        const speed = 620 * e.bulletMul;
        const offs = e.phase >= 2 ? [-12, 12] : [0];
        for (const o of offs) aimedSnipe(e.x + o, e.y + e.h / 2, speed);
        e.aimCd =
          (e.phase === 1 ? 2.4 : e.phase === 2 ? 2.0 : 1.6) * e.fireMul;
      }
    } else {
      e.aimCd -= dt;
      if (e.aimCd <= 0) {
        e.aimT = PHANTOM_AIM_TIME;
        sfx.sniperCharge();
      }
    }
    // 近身自保：玩家贴近时散射弹环
    if (Math.hypot(player.x - e.x, player.y - e.y) < 140) {
      e.nearT -= dt;
      if (e.nearT <= 0) {
        e.nearT = 1.6;
        ringBurst(e, 12, 165 * e.bulletMul);
      }
    }
  }

  // ---- 我方武器 ----
  function fireMain() {
    const od = overdriveT > 0;
    if (shipDef.weapon === "spread") {
      // 5 路扇形霰弹（火力强化增加弹丸数，过载再 +1），低单发伤害，固定短射程后消散（与发射位置无关）
      const SPREAD_RANGE = 280;
      const pellets = 3 + player.fireLevel * 2 + (od ? 1 : 0);
      const span = 0.84;
      for (let i = 0; i < pellets; i++) {
        const a =
          pellets === 1 ? 0 : -span / 2 + (i / (pellets - 1)) * span;
        bullets.push({
          x: player.x,
          y: player.y - 16,
          vx: Math.sin(a) * 470,
          vy: -Math.cos(a) * 470,
          dmg: 0.6 * shipDef.dmgMul,
          pierce: 0,
          hits: [],
          fade: true,
          fadeAt: player.y - 16 - SPREAD_RANGE,
        });
      }
      return;
    }
    // 直线弹道（平衡型 / 奇点）：过载期间弹道 +1，伤害走机型 dmgMul
    const n = player.fireLevel + (od ? 1 : 0);
    for (let i = 0; i < n; i++) {
      const off = (i - (n - 1) / 2) * 10;
      bullets.push({
        x: player.x + off,
        y: player.y - 18,
        vx: n > 2 ? off * 2.4 : 0,
        vy: -540,
        dmg: shipDef.dmgMul,
        pierce: player.pierceLevel,
        hits: [],
        fade: false,
        fadeAt: 0,
      });
    }
  }

  function fireWingman() {
    if (player.wingmanLevel <= 0) return;
    const wl = player.wingmanLevel;
    for (const side of [-1, 1]) {
      const wx = Math.max(12, Math.min(W - 12, player.x + side * 28));
      for (let i = 0; i < wl; i++) {
        bullets.push({
          x: wx,
          y: player.y - 4,
          vx: (i - (wl - 1) / 2) * 55,
          vy: -480,
          dmg: 1,
          pierce: player.pierceLevel,
          hits: [],
          fade: false,
          fadeAt: 0,
        });
      }
    }
  }

  function beamWidth(): number {
    // 火力全开：激光机改为光束宽度 +50%
    return (7 + (player.fireLevel - 1) * 4) * (overdriveT > 0 ? 1.5 : 1);
  }

  function laserDps(): number {
    return 4.6 + (player.fireLevel - 1) * 1.6;
  }

  /** 左右棱镜僚机光束的 x 坐标（跟随机体横移，夹在屏内） */
  function wingmanBeamX(side: number): number {
    return Math.max(12, Math.min(W - 12, player.x + side * 34));
  }

  /** 激光束持续伤害结算（每 LASER_TICK 一次，贯穿一列敌机） */
  function laserTickDamage() {
    const bw = beamWidth();
    const dmg0 = laserDps() * LASER_TICK;
    const critChance = player.critLevel * 0.08;
    for (let j = enemies.length - 1; j >= 0; j--) {
      const e = enemies[j];
      if (e.y + e.h / 2 < 0) continue;
      if (e.y - e.h / 2 > player.y - 14) continue;
      if (Math.abs(e.x - player.x) > bw / 2 + e.w / 2 - 2) continue;
      const isCrit = critChance > 0 && Math.random() < critChance;
      // 电磁弹头：光束命中即挂减速（与暴击减速共用状态）
      if (player.empLevel > 0) applySlow(e, empSlowAmt());
      if (critChance > 0 && Math.random() < player.critLevel * 0.06) {
        applySlow(e, CRIT_SLOW_AMT);
      }
      if (isCrit) {
        sfx.crit();
        critBurst(e.x, e.y);
        floatTexts.push({
          x: e.x,
          y: e.y - e.h / 2 - 8,
          text: "暴击!",
          life: 0.7,
          maxLife: 0.7,
          color: C.gold,
          big: true,
        });
      }
      if (!isCrit) {
        particles.push({
          x: e.x + (Math.random() - 0.5) * e.w * 0.6,
          y: Math.max(6, e.y - e.h / 2),
          vx: (Math.random() - 0.5) * 90,
          vy: -40 - Math.random() * 50,
          life: 0.18,
          maxLife: 0.18,
          size: 2,
          color: C.core,
        });
      }
      if (damageEnemy(e, dmg0, isCrit)) {
        enemies.splice(j, 1);
        scoreSpark(e.x, e.y);
        onEnemyDeath(e);
      }
    }
  }

  /** 补给母机：治疗周围敌机（可见光束粒子 + 浮字） */
  function healNearby(s: Enemy) {
    let any = false;
    for (const e2 of enemies) {
      if (e2 === s || e2.kind === "boss") continue;
      const d = Math.hypot(e2.x - s.x, e2.y - s.y);
      if (d > 130) continue;
      const healed = e2.hp < e2.maxHp;
      if (healed) e2.hp = Math.min(e2.maxHp, e2.hp + 2);
      const steps = Math.max(3, Math.floor(d / 14));
      for (let i = 1; i <= steps; i++) {
        particles.push({
          x: s.x + (e2.x - s.x) * (i / steps),
          y: s.y + (e2.y - s.y) * (i / steps),
          vx: (Math.random() - 0.5) * 16,
          vy: (Math.random() - 0.5) * 16,
          life: 0.3,
          maxLife: 0.3,
          size: 2,
          color: C.player,
        });
      }
      if (healed) {
        floatTexts.push({
          x: e2.x,
          y: e2.y - e2.h / 2 - 4,
          text: "+2",
          life: 0.6,
          maxLife: 0.6,
          color: C.player,
          big: false,
        });
        any = true;
      }
    }
    if (any) sfx.heal();
  }

  // ---- 更新 ----
  function update(dt: number) {
    elapsed += dt;
    if (overdriveT > 0) overdriveT = Math.max(0, overdriveT - dt);
    if (timeShiftT > 0) timeShiftT = Math.max(0, timeShiftT - dt);
    // 时间裂隙：全屏敌机与敌弹减速因子（约 45%）
    const tsMul = timeShiftT > 0 ? TIMESHIFT_MUL : 1;
    if (campaign) {
      // 关卡模式：刷怪阶段小波推进 -> 关底 Boss 战
      if (!bossActive) {
        campT += dt;
        const waveLen = campaign.duration / campaign.waveCount;
        const idx = Math.min(
          campaign.waveCount - 1,
          Math.floor(campT / waveLen),
        );
        if (idx !== campWaveIdx) {
          campWaveIdx = idx;
          sfx.waveAlert();
          floatTexts.push({
            x: W / 2,
            y: H / 2 - 80,
            text: `突击 ${idx + 1}/${campaign.waveCount}`,
            life: 1.4,
            maxLife: 1.4,
            color: C.core,
            big: true,
          });
        }
        spawnT -= dt;
        if (spawnT <= 0) {
          const ramp =
            1 - 0.18 * (campWaveIdx / Math.max(1, campaign.waveCount - 1));
          spawnT = campaign.spawnInterval * ramp * (0.75 + Math.random() * 0.5);
          spawnCampaignEnemy();
        }
        if (campT >= campaign.duration) spawnCampaignBoss();
      }
    } else {
      // 波次推进
      waveT += dt;
      if (waveT >= WAVE_LEN) {
        waveT = 0;
        wave += 1;
        floatTexts.push({
          x: W / 2,
          y: H / 2 - 80,
          text: `WAVE ${wave}`,
          life: 1.6,
          maxLife: 1.6,
          color: C.core,
          big: true,
        });
        if (wave % 5 === 0) spawnBoss();
        else sfx.waveAlert();
        pushStats();
      }

      // 敌机生成
      spawnT -= dt;
      if (spawnT <= 0) {
        spawnT =
          Math.max(0.45, 1.7 - wavePressure() * 0.09) *
          (0.75 + Math.random() * 0.5);
        spawnWaveEnemy();
      }
    }

    if (bossEnterT > 0) bossEnterT -= dt;

    // 玩家移动（三月出场滑入期间由动画接管，不接受输入）
    if (catEnterT > 0) {
      catEnterT -= dt;
      const p = 1 - Math.max(0, catEnterT) / CAT_ENTER_DUR;
      const ease = 1 - Math.pow(1 - p, 3);
      player.y = H + 40 - 110 * ease;
      if (catEnterT <= 0) {
        catEnterT = 0;
        player.y = H - 70;
        catStampT = CAT_STAMP_DUR;
        sfx.meow();
      }
    } else {
      let dx = 0;
      let dy = 0;
      if (keys["arrowleft"] || keys["a"]) dx -= 1;
      if (keys["arrowright"] || keys["d"]) dx += 1;
      if (keys["arrowup"] || keys["w"]) dy -= 1;
      if (keys["arrowdown"] || keys["s"]) dy += 1;
      if (dx !== 0 || dy !== 0) {
        const len = Math.hypot(dx, dy);
        player.x += (dx / len) * player.speed * dt;
        player.y += (dy / len) * player.speed * dt;
      } else if (pointerActive && pointerTarget) {
        const k = Math.min(1, dt * 12);
        player.x += (pointerTarget.x - player.x) * k;
        player.y += (pointerTarget.y - player.y) * k;
      }
      player.x = Math.max(20, Math.min(W - 20, player.x));
      player.y = Math.max(H * 0.3, Math.min(H - 24, player.y));
    }
    if (catStampT > 0) catStampT -= dt;

    // 尾焰粒子（三月机型混入小爪印）
    if (Math.random() < 0.7) {
      const paw = shipDef.id === "cat" && Math.random() < 0.35;
      particles.push({
        x: player.x + (Math.random() * 8 - 4),
        y: player.y + 16,
        vx: (Math.random() - 0.5) * 30,
        vy: 120 + Math.random() * 80,
        life: paw ? 0.45 : 0.25,
        maxLife: paw ? 0.45 : 0.25,
        size: 2,
        color: paw ? catPink : Math.random() < 0.5 ? C.player : C.enemy,
        paw,
      });
    }
    // 引擎改装：双股青色拖尾，等级越高尾焰越长越亮（与主尾焰叠加）
    const speedLv = levels["speed"] ?? 0;
    if (speedLv > 0 && Math.random() < 0.9) {
      for (const side of [-1, 1]) {
        particles.push({
          x: player.x + side * 6 + (Math.random() * 4 - 2),
          y: player.y + 18,
          vx: side * (10 + Math.random() * 20),
          vy: 150 + Math.random() * (60 + speedLv * 40),
          life: 0.28 + speedLv * 0.06,
          maxLife: 0.28 + speedLv * 0.06,
          size: 2,
          color: Math.random() < 0.6 ? C.teal : C.core,
        });
      }
    }
    // 连杀狂热：周身红色小火焰，层数越多越旺（满层最密集）
    const fStacksFx = frenzyStacksNow();
    if (fStacksFx > 0 && Math.random() < 0.25 + fStacksFx * 0.18) {
      const side = Math.random() < 0.5 ? -1 : 1;
      particles.push({
        x: player.x + side * (8 + Math.random() * 8),
        y: player.y + 6 + Math.random() * 8,
        vx: side * (20 + Math.random() * 30),
        vy: -40 - Math.random() * 60,
        life: 0.3,
        maxLife: 0.3,
        size: 2,
        color: fStacksFx >= 2 + player.frenzyLevel ? C.enemy : C.gold,
      });
    }

    // 自动射击（空格同样保持开火）；激光机为持续光束，无主炮冷却
    // 火力全开：射击间隔减半
    const odInterval = overdriveT > 0 ? 0.5 : 1;
    if (shipDef.weapon !== "laser") {
      player.cool -= dt;
      if (player.cool <= 0) {
        player.cool = player.fireInterval * odInterval;
        fireMain();
        fireWingman();
        sfx.shoot();
      }
    } else {
      player.cool -= dt;
      if (player.cool <= 0) {
        player.cool = 0.24 * odInterval;
        fireWingman();
      }
      laserAcc += dt;
      if (laserAcc >= LASER_TICK) {
        laserAcc = 0;
        laserTickDamage();
      }
    }

    // 奇点：每约 3.5 秒自动向四周释放一圈扩张湮灭冲击环
    if (shipDef.id === "singularity") {
      singRingCd -= dt;
      if (singRingCd <= 0) {
        singRingCd = SING_RING_CD;
        shockRings.push({
          x: player.x,
          y: player.y,
          r: 16,
          maxR: SING_RING_MAX,
          dmg: SING_RING_DMG,
          hits: [],
        });
        sfx.ringPulse();
      }
    }

    // 融合强化「湮灭冲击环」：非奇点战机周期性释放扩张冲击环（与奇点技能同口径）
    if (shipDef.id !== "singularity" && player.ringLevel > 0) {
      const lv = player.ringLevel - 1;
      fusionRingCd -= dt;
      if (fusionRingCd <= 0) {
        fusionRingCd = FRING_EVERY[lv];
        shockRings.push({
          x: player.x,
          y: player.y,
          r: 16,
          maxR: SING_RING_MAX,
          dmg: FRING_DMG[lv],
          hits: [],
        });
        sfx.ringPulse();
      }
    }

    // 三月：每约 4 秒自动释放「喵爪三连击」——三道霓虹爪痕自下而上扫过整列 + 喵叫 + 「喵~」气泡
    if (shipDef.id === "cat") {
      catSkillCd -= dt;
      if (catSkillCd <= 0) {
        catSkillCd = CAT_SWIPE_CD;
        // 磨利猫爪：爪痕 3 道起，每级 +1 道（间距 14px 居中展开）
        const n = 3 + player.catclawLevel;
        for (let i = 0; i < n; i++) {
          const off = (i - (n - 1) / 2) * 14;
          catSwipes.push({
            x: Math.max(10, Math.min(W - 10, player.x + off)),
            y: H + 16,
            life: CAT_SWIPE_DUR,
            hits: [],
          });
        }
        sfx.meow();
        floatTexts.push({
          x: Math.max(24, Math.min(W - 24, player.x + 26)),
          y: player.y - 22,
          text: "喵~",
          life: 0.9,
          maxLife: 0.9,
          color: catPink,
          big: false,
        });
      }
    }

    // 融合强化「喵爪斩」：非三月战机周期性释放爪痕光刃（与三月技能同口径）
    if (shipDef.id !== "cat" && player.swipeLevel > 0) {
      const lv = player.swipeLevel - 1;
      fusionSwipeCd -= dt;
      if (fusionSwipeCd <= 0) {
        fusionSwipeCd = FSWIPE_EVERY[lv];
        const fn = FSWIPE_COUNT[lv];
        for (let i = 0; i < fn; i++) {
          const off = (i - (fn - 1) / 2) * 14;
          catSwipes.push({
            x: Math.max(10, Math.min(W - 10, player.x + off)),
            y: H + 16,
            life: CAT_SWIPE_DUR,
            hits: [],
          });
        }
        sfx.meow();
      }
    }

    // 融合强化「棱镜僚机」：左右双僚机周期释放持续激光（各一道，按 tick 结算僚机上方敌机）
    if (player.prismLevel > 0) {
      if (beamActiveT > 0) {
        beamActiveT -= dt;
        beamTickAcc += dt;
        const dmg0 = BEAM_DPS * LASER_TICK;
        const beamXs = [wingmanBeamX(-1), wingmanBeamX(1)];
        while (beamTickAcc >= LASER_TICK) {
          beamTickAcc -= LASER_TICK;
          for (const bx of beamXs) {
            for (let j = enemies.length - 1; j >= 0; j--) {
              const e = enemies[j];
              if (e.y + e.h / 2 < 0) continue;
              if (e.y - e.h / 2 > player.y - 12) continue;
              if (Math.abs(e.x - bx) > 5 + e.w / 2) continue;
              if (player.empLevel > 0) applySlow(e, empSlowAmt());
              particles.push({
                x: e.x + (Math.random() - 0.5) * e.w * 0.6,
                y: Math.max(6, e.y - e.h / 2),
                vx: (Math.random() - 0.5) * 90,
                vy: -40 - Math.random() * 50,
                life: 0.14,
                maxLife: 0.14,
                size: 2,
                color: C.teal,
              });
              if (damageEnemy(e, dmg0)) {
                enemies.splice(j, 1);
                onEnemyDeath(e);
              }
            }
          }
        }
      } else {
        prismBeamCd -= dt;
        if (prismBeamCd <= 0) {
          prismBeamCd = BEAM_EVERY[player.prismLevel - 1];
          beamActiveT = BEAM_DUR;
          beamTickAcc = LASER_TICK; // 起手立即结算一次
          sfx.ringPulse();
        }
      }
    }

    // 融合强化「散射齐射」：周期性自动打出一轮扇形霰弹（短射程消散，与火种主炮同口径）
    if (player.volleyLevel > 0) {
      const lv = player.volleyLevel - 1;
      volleyCd -= dt;
      if (volleyCd <= 0) {
        volleyCd = VOLLEY_EVERY[lv];
        const span = 0.84;
        for (let i = 0; i < VOLLEY_PELLETS; i++) {
          const a = -span / 2 + (i / (VOLLEY_PELLETS - 1)) * span;
          bullets.push({
            x: player.x,
            y: player.y - 16,
            vx: Math.sin(a) * 470,
            vy: -Math.cos(a) * 470,
            dmg: VOLLEY_DMG[lv],
            pierce: 0,
            hits: [],
            fade: true,
            fadeAt: player.y - 16 - 280,
          });
        }
        sfx.shoot();
      }
    }

    const swipeSpeed = (H + 40) / CAT_SWIPE_DUR;
    for (let i = catSwipes.length - 1; i >= 0; i--) {
      const sw = catSwipes[i];
      sw.life -= dt;
      sw.y -= swipeSpeed * dt;
      if (sw.life <= 0 || sw.y < -20) {
        catSwipes.splice(i, 1);
        continue;
      }
      // 爪痕扫过敌机即结算（同一痕对同一敌只结算一次），伤害走 damageEnemy 统一乘区
      for (let j = enemies.length - 1; j >= 0; j--) {
        const e = enemies[j];
        if (sw.hits.includes(e)) continue;
        if (Math.abs(e.x - sw.x) > e.w / 2 + 5) continue;
        if (Math.abs(e.y - sw.y) > e.h / 2 + 8) continue;
        sw.hits.push(e);
        if (player.empLevel > 0) applySlow(e, empSlowAmt());
        particles.push({
          x: e.x,
          y: e.y,
          vx: (Math.random() - 0.5) * 120,
          vy: -60 - Math.random() * 60,
          life: 0.22,
          maxLife: 0.22,
          size: 3,
          color: catPink,
        });
        if (damageEnemy(e, CAT_SWIPE_DMG)) {
          enemies.splice(j, 1);
          onEnemyDeath(e);
        }
      }
    }

    for (let i = shockRings.length - 1; i >= 0; i--) {
      const ring = shockRings[i];
      ring.r += SING_RING_SPEED * dt;
      if (ring.r >= ring.maxR) {
        shockRings.splice(i, 1);
        continue;
      }
      // 环前沿扫过敌机即结算（同一环对同一敌只结算一次），伤害走 damageEnemy 统一乘区
      for (let j = enemies.length - 1; j >= 0; j--) {
        const e = enemies[j];
        if (ring.hits.includes(e)) continue;
        const d = Math.hypot(e.x - ring.x, e.y - ring.y);
        if (d > ring.r + e.w / 2) continue;
        ring.hits.push(e);
        if (player.empLevel > 0) applySlow(e, empSlowAmt());
        particles.push({
          x: e.x,
          y: e.y,
          vx: (Math.random() - 0.5) * 120,
          vy: (Math.random() - 0.5) * 120,
          life: 0.25,
          maxLife: 0.25,
          size: 3,
          color: C.wing,
        });
        if (damageEnemy(e, ring.dmg)) {
          enemies.splice(j, 1);
          onEnemyDeath(e);
        }
      }
    }

    // 掉落道具：缓慢下落、出屏消失、玩家接触拾取（暂停/弹窗期间随主循环冻结）
    for (let i = pickups.length - 1; i >= 0; i--) {
      const pk = pickups[i];
      pk.t += dt;
      pk.y += PICKUP_SPEED * dt;
      if (pk.y > H + 18) {
        pickups.splice(i, 1);
        continue;
      }
      if (
        running &&
        Math.abs(pk.x - player.x) < 18 &&
        Math.abs(pk.y - player.y) < 18
      ) {
        pickups.splice(i, 1);
        applyPickup(pk.kind);
      }
    }

    // 追踪导弹：定期自动发射，数量与频率随等级提升
    if (player.missileLevel > 0) {
      missileCool -= dt;
      if (missileCool <= 0) {
        missileCool = Math.max(0.7, 1.9 - player.missileLevel * 0.25);
        const mn = player.missileLevel;
        for (let i = 0; i < mn; i++) {
          const side = i % 2 === 0 ? -1 : 1;
          missiles.push({
            x: player.x + side * 14,
            y: player.y + 2,
            vx: side * 70,
            vy: -160,
            target: null,
            life: 3.5,
          });
        }
        sfx.missile();
      }
    }

    // 我方子弹（穿透 / 暴击 / 减速 / 散射消散）
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.y < -20 || b.x < -20 || b.x > W + 20) {
        bullets.splice(i, 1);
        continue;
      }
      if (b.fade && b.y < b.fadeAt) {
        // 散射弹射程尽头：消散小烟
        bullets.splice(i, 1);
        particles.push({
          x: b.x,
          y: b.y,
          vx: 0,
          vy: -30,
          life: 0.2,
          maxLife: 0.2,
          size: 2,
          color: C.star,
        });
        continue;
      }
      for (let j = enemies.length - 1; j >= 0; j--) {
        const e = enemies[j];
        if (b.hits.includes(e)) continue;
        if (
          Math.abs(b.x - e.x) < e.w / 2 + 3 &&
          Math.abs(b.y - e.y) < e.h / 2 + 5
        ) {
          b.hits.push(e);
          const critChance = player.critLevel * 0.08;
          const isCrit = critChance > 0 && Math.random() < critChance;
          // 电磁弹头：子弹命中即挂减速（与暴击减速共用状态），命中溅出蓝紫电弧
          if (player.empLevel > 0) {
            applySlow(e, empSlowAmt());
            for (let q = 0; q < 3; q++) {
              particles.push({
                x: b.x,
                y: b.y,
                vx: (Math.random() - 0.5) * 120,
                vy: (Math.random() - 0.5) * 120,
                life: 0.22,
                maxLife: 0.22,
                size: 2,
                color: C.bolt,
              });
            }
          }
          const died = damageEnemy(e, b.dmg, isCrit);
          if (isCrit) {
            sfx.crit();
            critBurst(e.x, e.y);
            floatTexts.push({
              x: e.x,
              y: e.y - e.h / 2 - 8,
              text: "暴击!",
              life: 0.7,
              maxLife: 0.7,
              color: C.gold,
              big: true,
            });
          }
          if (critChance > 0 && Math.random() < player.critLevel * 0.06) {
            applySlow(e, CRIT_SLOW_AMT);
          }
          if (!isCrit) {
            particles.push({
              x: b.x,
              y: b.y,
              vx: (Math.random() - 0.5) * 80,
              vy: -60 - Math.random() * 60,
              life: 0.2,
              maxLife: 0.2,
              size: 2,
              color: C.core,
            });
          }
          if (died) {
            enemies.splice(j, 1);
            scoreSpark(e.x, e.y);
            onEnemyDeath(e);
          }
        }
      }
      // 蜂巢核心的大型追踪弹可被击落（玩家子弹命中扣耐久）
      let spent = false;
      for (let k = enemyBullets.length - 1; k >= 0; k--) {
        const eb = enemyBullets[k];
        if (!eb.big) continue;
        if (Math.abs(b.x - eb.x) < 13 && Math.abs(b.y - eb.y) < 13) {
          eb.hp = (eb.hp ?? 1) - b.dmg;
          particles.push({
            x: b.x,
            y: b.y,
            vx: (Math.random() - 0.5) * 70,
            vy: -40 - Math.random() * 40,
            life: 0.18,
            maxLife: 0.18,
            size: 2,
            color: C.core,
          });
          if (eb.hp <= 0) {
            enemyBullets.splice(k, 1);
            explode(eb.x, eb.y, 10, false);
            sfx.hit();
          }
          spent = true;
          break;
        }
      }
      // 穿透个数耗尽或命中追踪弹，子弹消失（pierce 只对弹道类武器生效）
      if (spent || b.hits.length > b.pierce) bullets.splice(i, 1);
    }

    // 追踪导弹更新
    for (let i = missiles.length - 1; i >= 0; i--) {
      const m = missiles[i];
      m.life -= dt;
      if (m.life <= 0) {
        missiles.splice(i, 1);
        continue;
      }
      if (!m.target || enemies.indexOf(m.target) === -1) {
        m.target = null;
        let best = Infinity;
        for (const e of enemies) {
          const d = Math.hypot(e.x - m.x, e.y - m.y);
          if (d < best) {
            best = d;
            m.target = e;
          }
        }
      }
      if (m.target) {
        const desired = Math.atan2(m.target.y - m.y, m.target.x - m.x);
        const cur = Math.atan2(m.vy, m.vx);
        let diff = desired - cur;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        const na = cur + Math.max(-7 * dt, Math.min(7 * dt, diff));
        m.vx = Math.cos(na) * MISSILE_SPEED;
        m.vy = Math.sin(na) * MISSILE_SPEED;
      }
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      if (Math.random() < 0.6) {
        particles.push({
          x: m.x,
          y: m.y,
          vx: (Math.random() - 0.5) * 20,
          vy: 40 + Math.random() * 40,
          life: 0.2,
          maxLife: 0.2,
          size: 2,
          color: C.wing,
        });
      }
      if (m.x < -20 || m.x > W + 20 || m.y < -30 || m.y > H + 20) {
        missiles.splice(i, 1);
        continue;
      }
      for (let j = enemies.length - 1; j >= 0; j--) {
        const e = enemies[j];
        if (
          Math.abs(m.x - e.x) < e.w / 2 + 4 &&
          Math.abs(m.y - e.y) < e.h / 2 + 6
        ) {
          missiles.splice(i, 1);
          explode(m.x, m.y, 6, false);
          const died = damageEnemy(e, 2);
          if (died) {
            enemies.splice(j, 1);
            onEnemyDeath(e);
          }
          break;
        }
      }
    }

    // 敌机更新
    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];
      if (e.slowT > 0) {
        e.slowT -= dt;
        if (e.slowT <= 0) e.slowAmt = 0;
      }
      const spMul = (e.slowT > 0 ? 1 - e.slowAmt : 1) * tsMul;
      e.t += dt * spMul;
      if (e.kind === "boss") {
        // 四种 Boss 类型：共用三阶段机 / 预警 / 分段血条，行为按 bossId 分发
        updateBoss(e, dt, tsMul);
      } else if (e.kind === "kamikaze") {
        // 自爆蜂群：直线冲向玩家实时位置
        const kdx = player.x - e.x;
        const kdy = player.y - e.y;
        const klen = Math.max(1, Math.hypot(kdx, kdy));
        e.x += (kdx / klen) * e.sp * spMul * dt;
        e.y += (kdy / klen) * e.sp * spMul * dt;
        if (Math.random() < 0.55) {
          particles.push({
            x: e.x,
            y: e.y - 5,
            vx: (Math.random() - 0.5) * 40,
            vy: -60 - Math.random() * 40,
            life: 0.22,
            maxLife: 0.22,
            size: 2,
            color: C.enemy,
          });
        }
      } else if (e.kind === "sniper") {
        // 狙击机：移动到屏幕上部悬停 -> 红色瞄准线蓄力 -> 高速直线弹
        if (e.y < e.hoverY) {
          e.y += e.sp * spMul * dt;
        } else {
          e.x += Math.sin(e.t * 1.3) * 16 * spMul * dt;
          e.x = Math.max(e.w / 2, Math.min(W - e.w / 2, e.x));
          if (e.aimT > 0) {
            e.aimT -= dt;
            if (e.aimT <= 0) {
              aimedShot(e.x, e.y + e.h / 2, 540 * bulletScale());
              e.aimCd = 1.3 + Math.random() * 1.1;
            }
          } else {
            e.aimCd -= dt;
            if (e.aimCd <= 0) {
              e.aimT = 1.2;
              sfx.sniperCharge();
            }
          }
        }
      } else if (e.kind === "supply") {
        // 补给母机：不攻击，横向缓慢漂移，周期性治疗周围敌机
        if (e.y < e.hoverY) {
          e.y += e.sp * spMul * dt;
        } else {
          e.x += e.vx * spMul * dt;
          if (e.x < e.w / 2 + 6) {
            e.x = e.w / 2 + 6;
            e.vx = Math.abs(e.vx);
          }
          if (e.x > W - e.w / 2 - 6) {
            e.x = W - e.w / 2 - 6;
            e.vx = -Math.abs(e.vx);
          }
          e.y += 5 * spMul * dt;
          e.healT -= dt;
          if (e.healT <= 0) {
            e.healT = 3.2;
            healNearby(e);
          }
        }
      } else if (e.kind === "shard") {
        // 分裂小机：快速下压 + 横向弹开
        e.y += e.sp * spMul * dt;
        e.x += e.vx * spMul * dt;
        if (e.x < e.w / 2) {
          e.x = e.w / 2;
          e.vx = Math.abs(e.vx);
        }
        if (e.x > W - e.w / 2) {
          e.x = W - e.w / 2;
          e.vx = -Math.abs(e.vx);
        }
      } else {
        // grunt / gunner / elite / shielded / splitter：下压 + 摆动
        e.y += e.sp * spMul * dt;
        if (e.amp > 0) e.x += Math.cos(e.t * 2.2) * e.amp * spMul * dt;
        e.x = Math.max(e.w / 2, Math.min(W - e.w / 2, e.x));
        if (
          (e.kind === "gunner" || e.kind === "elite") &&
          e.y > 20 &&
          e.y < H * 0.68
        ) {
          e.fireT -= dt;
          if (e.fireT <= 0) {
            e.fireT =
              Math.max(0.9, 2.3 - pressureNow() * 0.08) *
              (0.8 + Math.random() * 0.5);
            if (e.kind === "gunner") {
              aimedShot(e.x, e.y + e.h / 2, 230 * bulletScale());
            } else {
              for (const ang of [-0.35, 0, 0.35]) {
                fireEnemyBullet(
                  e.x,
                  e.y + e.h / 2,
                  Math.sin(ang) * 200 * bulletScale(),
                  Math.cos(ang) * 200 * bulletScale(),
                );
              }
            }
          }
        }
      }
      if (e.y > H + 50) {
        enemies.splice(i, 1);
        continue;
      }
      // 撞击玩家（自爆蜂群接触即爆）
      if (
        running &&
        Math.abs(e.x - player.x) < e.w / 2 + 10 &&
        Math.abs(e.y - player.y) < e.h / 2 + 10
      ) {
        damagePlayer();
        if (e.kind !== "boss") {
          enemies.splice(i, 1);
          onEnemyDeath(e);
        }
      }
    }

    // 敌弹（高速弹扩大判定，避免隧穿漏判；时间裂隙期间同步减速）
    for (let i = enemyBullets.length - 1; i >= 0; i--) {
      const b = enemyBullets[i];
      if (b.big) {
        // 大型缓慢追踪弹：寿命递减、朝玩家缓转向（敌弹同口径受时间裂隙减速）
        b.life = (b.life ?? 0) - dt;
        if (b.life <= 0) {
          enemyBullets.splice(i, 1);
          particles.push({
            x: b.x,
            y: b.y,
            vx: 0,
            vy: -20,
            life: 0.25,
            maxLife: 0.25,
            size: 2,
            color: C.star,
          });
          continue;
        }
        const desired = Math.atan2(player.y - b.y, player.x - b.x);
        const cur = Math.atan2(b.vy, b.vx);
        let diff = desired - cur;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        const tr = (b.turn ?? 1.7) * dt;
        const na = cur + Math.max(-tr, Math.min(tr, diff));
        const sp = b.speed ?? 95;
        b.vx = Math.cos(na) * sp;
        b.vy = Math.sin(na) * sp;
        if (Math.random() < 0.5) {
          particles.push({
            x: b.x,
            y: b.y,
            vx: (Math.random() - 0.5) * 18,
            vy: (Math.random() - 0.5) * 18,
            life: 0.22,
            maxLife: 0.22,
            size: 2,
            color: C.enemy,
          });
        }
      }
      b.x += b.vx * dt * tsMul;
      b.y += b.vy * dt * tsMul;
      if (b.y > H + 20 || b.y < -20 || b.x < -20 || b.x > W + 20) {
        enemyBullets.splice(i, 1);
        continue;
      }
      const spd = Math.hypot(b.vx, b.vy);
      const hitR = b.big ? 14 : 12 + spd * dt * 0.5;
      if (running && Math.hypot(b.x - player.x, b.y - player.y) < hitR) {
        enemyBullets.splice(i, 1);
        damagePlayer();
      }
    }

    // 粒子 / 浮字
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        particles.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    for (let i = floatTexts.length - 1; i >= 0; i--) {
      const f = floatTexts[i];
      f.life -= dt;
      f.y -= 24 * dt;
      if (f.life <= 0) floatTexts.splice(i, 1);
    }

    if (invuln > 0) invuln -= dt;
    if (bombFlashT > 0) bombFlashT -= dt;
    if (upBurstT > 0) upBurstT -= dt;
    if (upFlashT > 0) upFlashT -= dt;

    // 能量护盾计时：未持盾时累计，到点生成一面（不叠加，持盾期间暂停）
    if (player.shieldLevel > 0 && !shieldReady) {
      shieldT -= dt;
      if (shieldT <= 0) {
        shieldReady = true;
        floatTexts.push({
          x: player.x,
          y: player.y - 40,
          text: "护盾生成",
          life: 0.9,
          maxLife: 0.9,
          color: C.teal,
          big: false,
        });
        sfx.shieldBlock();
      }
    }

    statsT += dt;
    if (statsT >= 0.15) {
      statsT = 0;
      pushStats();
    }
  }

  // ---- 渲染 ----
  function drawSprite(
    sprite: SpriteMap,
    palette: Record<string, string>,
    cx: number,
    cy: number,
    px: number,
    glow: number,
  ) {
    if (!ctx) return;
    const w = sprite[0].length * px;
    const h = sprite.length * px;
    const x0 = Math.round(cx - w / 2);
    const y0 = Math.round(cy - h / 2);
    ctx.save();
    ctx.shadowBlur = glow;
    for (let r = 0; r < sprite.length; r++) {
      const row = sprite[r];
      for (let c = 0; c < row.length; c++) {
        const ch = row[c];
        if (ch === ".") continue;
        const col = palette[ch];
        if (!col) continue;
        ctx.shadowColor = col;
        ctx.fillStyle = col;
        ctx.fillRect(x0 + c * px, y0 + r * px, px, px);
      }
    }
    ctx.restore();
  }

  function render() {
    if (!ctx) return;
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, W, H);

    // 关卡主题色调：token 通道色低透明度铺染（上密下疏，逐关递变）
    if (themeTint && themeTintAlpha > 0) {
      ctx.save();
      ctx.fillStyle = themeTint;
      ctx.globalAlpha = themeTintAlpha;
      ctx.fillRect(0, 0, W, H * 0.55);
      ctx.globalAlpha = themeTintAlpha * 0.4;
      ctx.fillRect(0, H * 0.55, W, H * 0.45);
      ctx.restore();
    }

    // 星空
    for (const s of stars) {
      ctx.globalAlpha = s.alpha;
      ctx.fillStyle = starColor;
      ctx.fillRect(Math.round(s.x), Math.round(s.y), s.size, s.size);
    }
    ctx.globalAlpha = 1;

    // 粒子
    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      if (p.paw) {
        // 爪印：掌垫 + 三趾豆
        const px0 = Math.round(p.x);
        const py0 = Math.round(p.y);
        ctx.fillRect(px0 - 1, py0, 3, 2);
        ctx.fillRect(px0 - 2, py0 - 2, 1, 1);
        ctx.fillRect(px0, py0 - 3, 1, 1);
        ctx.fillRect(px0 + 2, py0 - 2, 1, 1);
      } else {
        ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
      }
    }
    ctx.globalAlpha = 1;

    // 激光束（棱镜机持续光束，贯穿一列）
    if (running && shipDef.weapon === "laser") {
      const bw = beamWidth();
      ctx.save();
      ctx.shadowBlur = 16;
      ctx.shadowColor = C.player;
      ctx.globalAlpha = 0.4 + 0.12 * Math.sin(elapsed * 30);
      ctx.fillStyle = C.player;
      ctx.fillRect(Math.round(player.x - bw / 2), 0, bw, player.y - 14);
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = C.core;
      ctx.fillRect(Math.round(player.x) - 1, 0, 2, player.y - 14);
      ctx.restore();
    }

    // 我方子弹（霓虹像素条；随火力/穿透/弹头改装/电磁升级进化外观）
    // 弹头改装：弹体色由主色向白热渐变（每级提亮，封顶近白）
    const hotColor =
      player.dmgLevel > 0
        ? shiftCss(C.player, Math.min(46, player.dmgLevel * 12))
        : C.player;
    const tallBullet = player.fireLevel >= 3; // 火力≥3路：弹体更亮更长 + 微光尾迹
    for (const b of bullets) {
      const bx = Math.round(b.x);
      const by = Math.round(b.y);
      ctx.save();
      // 电磁弹头：蓝紫电弧缠绕弹体（每帧抖动，呈现电流滋滋感）
      if (player.empLevel > 0) {
        ctx.strokeStyle = C.bolt;
        ctx.shadowColor = C.bolt;
        ctx.shadowBlur = 8;
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.9;
        ctx.beginPath();
        ctx.moveTo(bx, by + 7);
        for (let i = 1; i <= 4; i++) {
          const yy = by + 7 - i * 4;
          const xx = bx + (i % 2 === 0 ? -2.5 : 2.5) * (0.6 + Math.random() * 0.8);
          ctx.lineTo(xx, yy);
        }
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      // 弹体
      ctx.shadowColor = hotColor;
      ctx.shadowBlur = tallBullet ? 14 : 10;
      ctx.fillStyle = hotColor;
      if (player.pierceLevel > 0) {
        // 穿透弹：细长锐矢（尖头 + 修长弹身），已穿透过敌机则拖更长残影
        const tipY = by - (tallBullet ? 11 : 8);
        ctx.fillRect(bx - 1, by - 2, 2, tallBullet ? 12 : 9);
        ctx.beginPath();
        ctx.moveTo(bx, tipY);
        ctx.lineTo(bx - 2, by - 2);
        ctx.lineTo(bx + 2, by - 2);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = b.hits.length > 0 ? 0.4 : 0.22;
        ctx.fillRect(bx - 1, by + (tallBullet ? 10 : 7), 2, b.hits.length > 0 ? 16 : 9);
        ctx.globalAlpha = 1;
      } else {
        const h = tallBullet ? 14 : 9;
        ctx.fillRect(bx - 1, by - 6, 3, h);
        if (tallBullet) {
          // 火力≥3：尾迹微光
          ctx.globalAlpha = 0.3;
          ctx.fillRect(bx - 1, by - 6 + h, 3, 6);
          ctx.globalAlpha = 1;
        }
      }
      // 弹头改装：弹尖一点白热高光
      if (player.dmgLevel > 0) {
        ctx.fillStyle = C.core;
        ctx.fillRect(bx - 1, by - (player.pierceLevel > 0 ? 4 : 6), 2, 2);
      }
      ctx.restore();
    }

    // 敌弹（大型追踪弹 / 狙击弹有专属造型）
    ctx.save();
    ctx.shadowBlur = 8;
    ctx.shadowColor = C.enemy;
    ctx.fillStyle = C.enemy;
    for (const b of enemyBullets) {
      if (b.big) {
        const bx = Math.round(b.x);
        const by = Math.round(b.y);
        ctx.shadowBlur = 12;
        ctx.fillRect(bx - 5, by - 2, 10, 5);
        ctx.fillRect(bx - 2, by - 5, 5, 10);
        ctx.fillStyle = C.core;
        ctx.fillRect(bx - 1, by - 1, 3, 3);
        ctx.fillStyle = C.enemy;
        ctx.shadowBlur = 8;
      } else if (b.snipe) {
        ctx.fillRect(Math.round(b.x) - 2, Math.round(b.y) - 5, 4, 11);
      } else {
        ctx.fillRect(Math.round(b.x) - 2, Math.round(b.y) - 2, 4, 4);
      }
    }
    ctx.restore();

    // 追踪导弹（霓虹像素镖）
    ctx.save();
    ctx.shadowBlur = 10;
    ctx.shadowColor = C.wing;
    for (const m of missiles) {
      const mx = Math.round(m.x);
      const my = Math.round(m.y);
      ctx.fillStyle = C.wing;
      ctx.fillRect(mx - 1, my - 3, 3, 6);
      ctx.fillStyle = C.core;
      ctx.fillRect(mx - 1, my - 1, 2, 2);
    }
    ctx.restore();

    // 掉落道具（十字 / 闪电 / 沙漏，脉冲发光）
    for (const pk of pickups) {
      ctx.save();
      ctx.globalAlpha = 0.75 + 0.25 * Math.sin(pk.t * 6);
      drawSprite(
        PICKUP_SPRITE[pk.kind],
        { "1": pickupColor(pk.kind), "2": C.core },
        pk.x,
        pk.y,
        PICKUP_PX,
        10,
      );
      ctx.restore();
    }

    // 奇点湮灭冲击环（双层扩张光环，到半径上限消散）
    for (const ring of shockRings) {
      const a = Math.max(0, 1 - ring.r / ring.maxR);
      ctx.save();
      ctx.globalAlpha = a * 0.9;
      ctx.strokeStyle = C.wing;
      ctx.shadowColor = C.wing;
      ctx.shadowBlur = 12;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(ring.x, ring.y, ring.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = a * 0.4;
      ctx.strokeStyle = C.player;
      ctx.shadowColor = C.player;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(ring.x, ring.y, Math.max(1, ring.r - 5), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // 喵爪光刃（斜向爪痕，随扫列进度渐隐）
    for (const sw of catSwipes) {
      const a = Math.max(0, sw.life / CAT_SWIPE_DUR);
      ctx.save();
      ctx.globalAlpha = a * 0.9;
      ctx.strokeStyle = catPink;
      ctx.shadowColor = catPink;
      ctx.shadowBlur = 10;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(sw.x - 7, sw.y + 12);
      ctx.lineTo(sw.x + 7, sw.y - 12);
      ctx.stroke();
      ctx.globalAlpha = a * 0.5;
      ctx.strokeStyle = C.core;
      ctx.shadowBlur = 0;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(sw.x - 7, sw.y + 12);
      ctx.lineTo(sw.x + 7, sw.y - 12);
      ctx.stroke();
      ctx.restore();
    }

    // 棱镜僚机持续激光（左右两道青色光束，起手段淡入、结束段淡出）
    if (beamActiveT > 0) {
      const bpy = player.y - 6;
      const sinceFire = BEAM_DUR - beamActiveT;
      const a = Math.min(1, sinceFire / 0.08) * Math.min(1, beamActiveT / 0.15);
      for (const side of [-1, 1]) {
        const bx = Math.round(wingmanBeamX(side));
        ctx.save();
        ctx.shadowColor = C.teal;
        ctx.shadowBlur = 14;
        ctx.globalAlpha = a * (0.5 + 0.12 * Math.sin(elapsed * 40));
        ctx.fillStyle = C.teal;
        ctx.fillRect(bx - 3, 0, 6, Math.max(0, bpy - 7));
        ctx.globalAlpha = a * 0.9;
        ctx.shadowBlur = 0;
        ctx.fillStyle = C.core;
        ctx.fillRect(bx - 1, 0, 2, Math.max(0, bpy - 7));
        ctx.restore();
      }
    }

    // 敌机
    for (const e of enemies) {
      const bDef = e.kind === "boss" ? BOSS_BY_ID[e.bossId] : null;
      const bossTele = bDef !== null && e.tele > 0;
      const blinkSkip =
        bossTele && Math.floor(elapsed * 14) % 2 === 0;
      if (!blinkSkip) {
        // 幻影：token 色低透明度的半透明幽影
        if (bDef && bDef.alpha !== undefined) ctx.globalAlpha = bDef.alpha;
        drawSprite(
          bDef ? bDef.sprite : SPRITE_OF[e.kind],
          bDef ? BOSS_PALETTES[bDef.id] : PALETTES[e.kind],
          e.x,
          e.y,
          bDef ? bDef.px : PX_OF[e.kind],
          bDef ? 16 : 8,
        );
        if (bDef && bDef.alpha !== undefined) ctx.globalAlpha = 1;
      }
      if (e.slowT > 0) {
        // 减速 debuff：冷色压暗 + 亮青描边 + 周身电弧细节（电磁/暴击减速共用）
        ctx.save();
        ctx.globalAlpha = 0.22;
        ctx.fillStyle = C.teal;
        ctx.fillRect(e.x - e.w / 2, e.y - e.h / 2, e.w, e.h);
        ctx.globalAlpha = 0.9;
        ctx.strokeStyle = C.teal;
        ctx.shadowColor = C.teal;
        ctx.shadowBlur = 6;
        ctx.lineWidth = 1;
        ctx.strokeRect(
          e.x - e.w / 2 - 1,
          e.y - e.h / 2 - 1,
          e.w + 2,
          e.h + 2,
        );
        // 电弧细节：机身上跳动的蓝紫折线（每帧抖动）
        ctx.strokeStyle = C.bolt;
        ctx.shadowColor = C.bolt;
        ctx.shadowBlur = 8;
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        const ex0 = e.x - e.w / 2;
        const ey0 = e.y - e.h / 2;
        ctx.moveTo(ex0, ey0);
        for (let s = 1; s <= 3; s++) {
          ctx.lineTo(
            ex0 + (e.w / 3) * s + (Math.random() - 0.5) * 4,
            ey0 + (Math.random() - 0.5) * e.h,
          );
        }
        ctx.stroke();
        ctx.restore();
      }
      if (e.kind === "sniper" && e.aimT > 0 && e.y >= e.hoverY - 2) {
        // 狙击蓄力：红色虚线瞄准线 + 进度光圈（明显预警）
        ctx.save();
        ctx.strokeStyle = C.enemy;
        ctx.shadowColor = C.enemy;
        ctx.shadowBlur = 6;
        ctx.globalAlpha = 0.35 + 0.45 * Math.abs(Math.sin(elapsed * 14));
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(e.x, e.y + e.h / 2);
        ctx.lineTo(player.x, player.y);
        ctx.stroke();
        ctx.setLineDash([]);
        const prog = Math.min(1, Math.max(0, 1 - e.aimT / 1.2));
        ctx.globalAlpha = 0.9;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(e.x, e.y, 11 + prog * 7, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * prog);
        ctx.stroke();
        ctx.restore();
      }
      if (e.kind === "shielded" && e.shieldHp > 0) {
        // 正面能量护盾：像素描边 + 刻度
        const frac = e.shieldHp / Math.max(1, e.maxShield);
        const x0 = e.x - e.w / 2 - 3;
        const x1 = e.x + e.w / 2 + 3;
        const yb = e.y + e.h / 2 + 4;
        ctx.save();
        ctx.shadowBlur = 8;
        ctx.shadowColor = C.teal;
        ctx.strokeStyle = C.teal;
        ctx.fillStyle = C.teal;
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.55 + 0.35 * frac;
        ctx.beginPath();
        ctx.moveTo(x0, e.y);
        ctx.lineTo(x0, yb);
        ctx.lineTo(x1, yb);
        ctx.lineTo(x1, e.y);
        ctx.stroke();
        ctx.globalAlpha = 0.12 + 0.14 * frac;
        ctx.fillRect(x0, e.y, x1 - x0, yb - e.y + 2);
        ctx.globalAlpha = 0.9;
        const ticks = 7;
        const on = Math.ceil(ticks * frac);
        const tw = (x1 - x0 - 4) / ticks;
        for (let k = 0; k < on; k++) {
          ctx.fillRect(x0 + 2 + k * tw, yb - 2, Math.max(1, tw - 1.5), 3);
        }
        ctx.restore();
      }
      if (e.kind === "supply" && e.y >= e.hoverY - 2 && e.healT < 0.7) {
        // 治疗前摇：脉冲光圈提示
        ctx.save();
        ctx.strokeStyle = C.player;
        ctx.globalAlpha = 0.16 + 0.1 * Math.sin(elapsed * 10);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(e.x, e.y, 130, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      if (bDef && e.bossId === "phantom") {
        // 幻影瞬移预警圈：目标位置像素虚线环闪现
        if (e.blinkWarnT > 0) {
          ctx.save();
          ctx.strokeStyle = C.wing;
          ctx.shadowColor = C.wing;
          ctx.shadowBlur = 8;
          ctx.globalAlpha = 0.35 + 0.45 * Math.abs(Math.sin(elapsed * 18));
          ctx.lineWidth = 1.5;
          ctx.setLineDash([5, 4]);
          ctx.beginPath();
          ctx.arc(e.blinkX, e.y, 24, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.restore();
        }
        // 幻影狙击蓄力：红色预警线（二阶段起双线）+ 进度光圈
        if (e.aimT > 0 && e.y >= 88) {
          ctx.save();
          ctx.strokeStyle = C.enemy;
          ctx.shadowColor = C.enemy;
          ctx.shadowBlur = 6;
          ctx.globalAlpha = 0.35 + 0.45 * Math.abs(Math.sin(elapsed * 16));
          ctx.lineWidth = 2;
          ctx.setLineDash([7, 4]);
          const sOffs = e.phase >= 2 ? [-12, 12] : [0];
          for (const o of sOffs) {
            ctx.beginPath();
            ctx.moveTo(e.x + o, e.y + e.h / 2);
            ctx.lineTo(player.x, player.y);
            ctx.stroke();
          }
          ctx.setLineDash([]);
          const prog = Math.min(
            1,
            Math.max(0, 1 - e.aimT / PHANTOM_AIM_TIME),
          );
          ctx.globalAlpha = 0.9;
          ctx.beginPath();
          ctx.arc(
            e.x,
            e.y,
            12 + prog * 8,
            -Math.PI / 2,
            -Math.PI / 2 + Math.PI * 2 * prog,
          );
          ctx.stroke();
          ctx.restore();
        }
      }
      if (e.kind === "boss") {
        // Boss 蓄力光圈（阶段切换 / 大招预警）
        if (e.tele > 0) {
          const prog = Math.min(1, Math.max(0, 1 - e.tele / Math.max(0.001, e.teleMax)));
          ctx.save();
          ctx.strokeStyle = C.enemy;
          ctx.shadowColor = C.enemy;
          ctx.shadowBlur = 14;
          ctx.lineWidth = 2;
          ctx.globalAlpha = 0.85;
          ctx.beginPath();
          ctx.arc(e.x, e.y, 16 + prog * 26, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * prog);
          ctx.stroke();
          ctx.globalAlpha = 0.35 * (1 - prog);
          ctx.beginPath();
          ctx.arc(e.x, e.y, 44 + prog * 20, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
        // Boss 血条：按三阶段分段 + 变色
        const bw = 160;
        const bx = W / 2 - bw / 2;
        const by = 14;
        ctx.fillStyle = C.star;
        ctx.globalAlpha = 0.35;
        ctx.fillRect(bx, by, bw, 7);
        ctx.globalAlpha = 1;
        const ratio = Math.max(0, e.hp / e.maxHp);
        const flash = Math.floor(elapsed * 8) % 2 === 0;
        const col =
          e.phase === 3
            ? flash
              ? C.enemy
              : C.core
            : e.phase === 2
              ? C.core
              : C.enemy;
        ctx.fillStyle = col;
        ctx.shadowColor = col;
        ctx.shadowBlur = 6;
        ctx.fillRect(bx, by, bw * ratio, 7);
        ctx.shadowBlur = 0;
        // 阶段分隔刻度（60% / 30%）
        ctx.fillStyle = C.bg;
        ctx.fillRect(bx + bw * 0.6 - 1, by - 1, 2, 9);
        ctx.fillRect(bx + bw * 0.3 - 1, by - 1, 2, 9);
      } else if (e.maxHp > 3 && e.hp < e.maxHp) {
        const bw = e.w;
        ctx.fillStyle = C.enemy;
        ctx.fillRect(e.x - bw / 2, e.y - e.h / 2 - 6, (bw * e.hp) / e.maxHp, 3);
      }
    }

    // 时间裂隙：token 通道色低透明度铺染的冷色滤镜
    if (timeShiftT > 0) {
      ctx.save();
      ctx.globalAlpha = 0.1;
      ctx.fillStyle = C.wing;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }

    // 清屏炸弹白闪：全屏高亮快速衰减
    if (bombFlashT > 0) {
      ctx.save();
      ctx.globalAlpha = 0.55 * (bombFlashT / BOMB_FLASH_DUR);
      ctx.fillStyle = C.core;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }

    // 拿到强化瞬间爆发：上升光柱 + 环形冲击波（画在机体之后，作为背景光效）
    if (upBurstT > 0) {
      const p = 1 - upBurstT / UP_BURST_DUR; // 0→1
      const fade = upBurstT / UP_BURST_DUR; // 1→0
      ctx.save();
      // 上升光柱：自机体向屏幕顶的分段亮柱，越靠上越淡（用 globalAlpha 渐隐，不用透明色字面量）
      const segs = 10;
      const topY = 0;
      const segH = (player.y - topY) / segs;
      ctx.shadowColor = C.player;
      ctx.shadowBlur = 12;
      for (let i = 0; i < segs; i++) {
        const t = i / segs; // 0 底部 → 1 顶部
        const colW = 26 * (1 - p * 0.5) * (1 - t * 0.6);
        ctx.globalAlpha = 0.5 * fade * (1 - t);
        ctx.fillStyle = i < 2 ? C.core : C.player;
        ctx.fillRect(player.x - colW / 2, player.y - (i + 1) * segH, colW, segH + 1);
      }
      // 环形冲击波：从机体扩张的一圈光环
      ctx.globalAlpha = 0.7 * fade;
      ctx.strokeStyle = C.core;
      ctx.shadowColor = C.player;
      ctx.shadowBlur = 14;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(player.x, player.y, 12 + p * 90, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // 玩家
    if (running || (!running && score > 0 && player.hp > 0)) {
      const blink = invuln > 0 && Math.floor(invuln * 12) % 2 === 0;
      if (!blink) {
        drawSprite(
          shipDef.sprite,
          shipPal,
          player.x,
          player.y,
          shipDef.px,
          overdriveT > 0 ? 26 : 12,
        );
        // 拿到强化瞬间：机身白闪（全白调色板叠一层，随时间淡出）
        if (upFlashT > 0) {
          ctx.save();
          ctx.globalAlpha = Math.min(1, upFlashT / UP_FLASH_DUR);
          drawSprite(
            shipDef.sprite,
            shipPalWhite,
            player.x,
            player.y,
            shipDef.px,
            22,
          );
          ctx.restore();
        }
        if (player.wingmanLevel > 0) {
          // 僚机伴飞：两侧小僚机随主机浮动
          const bob = Math.sin(elapsed * 6) * 2;
          const wpal = { "1": C.wing, "2": C.core };
          for (const side of [-1, 1]) {
            const wx = Math.max(12, Math.min(W - 12, player.x + side * 28));
            drawSprite(WINGMAN_SPRITE, wpal, wx, player.y + 10 + bob, 3, 8);
          }
        }
        // 超载核心：机体环绕低亮度脉冲光晕，强度随全场强化总等级提升（越攒越亮）
        if (player.overloadLevel > 0) {
          const pulse = 0.5 + 0.5 * Math.sin(elapsed * 4);
          const intensity = Math.min(
            1,
            0.3 + upgradesTaken * 0.03 + player.overloadLevel * 0.12,
          );
          const rad = 20 + player.overloadLevel * 3 + pulse * 3;
          ctx.save();
          ctx.globalAlpha = (0.16 + pulse * 0.12) * intensity;
          ctx.strokeStyle = C.player;
          ctx.shadowColor = C.player;
          ctx.shadowBlur = 16;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(player.x, player.y, rad, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
        // 装甲板：机体外圈棱角装甲描边，等级越高越厚重
        if (player.armorLevel > 0) {
          ctx.save();
          ctx.strokeStyle = C.star;
          ctx.shadowColor = C.star;
          ctx.shadowBlur = 6;
          ctx.lineWidth = 1 + player.armorLevel * 0.6;
          ctx.globalAlpha = 0.82;
          const r = 16 + player.armorLevel * 1.5;
          ctx.beginPath();
          for (let i = 0; i < 6; i++) {
            const a = (Math.PI / 3) * i - Math.PI / 2;
            const ax = player.x + Math.cos(a) * r * 0.85;
            const ay = player.y + Math.sin(a) * r;
            if (i === 0) ctx.moveTo(ax, ay);
            else ctx.lineTo(ax, ay);
          }
          ctx.closePath();
          ctx.stroke();
          ctx.restore();
        }
        // 总强化等级里程碑：翼尖光点（每 3 级点亮一对，最多 3 对，逐步「武装」起来）
        const tipPairs = Math.min(3, Math.floor(upgradesTaken / 3));
        if (tipPairs > 0) {
          ctx.save();
          ctx.fillStyle = C.core;
          ctx.shadowColor = C.player;
          ctx.shadowBlur = 10;
          ctx.globalAlpha = 0.7 + 0.3 * Math.sin(elapsed * 6);
          for (let i = 0; i < tipPairs; i++) {
            const off = 12 + i * 5;
            for (const side of [-1, 1]) {
              ctx.fillRect(
                Math.round(player.x + side * off) - 1,
                Math.round(player.y + 4),
                3,
                3,
              );
            }
          }
          ctx.restore();
        }
        // 能量护盾：持盾时机体环绕青色脉冲光环
        if (shieldReady) {
          ctx.save();
          ctx.strokeStyle = C.teal;
          ctx.shadowColor = C.teal;
          ctx.shadowBlur = 8;
          ctx.lineWidth = 2;
          ctx.globalAlpha = 0.65 + Math.sin(elapsed * 5) * 0.25;
          ctx.beginPath();
          ctx.arc(player.x, player.y, 22, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
        // 棱镜僚机：机体左右两侧各悬浮一枚青色小菱形棱镜（持续激光发射位，反相浮动）
        if (player.prismLevel > 0) {
          for (const side of [-1, 1]) {
            const bpx = wingmanBeamX(side);
            const bpy =
              player.y - 6 + Math.sin(elapsed * 3 + (side > 0 ? 0 : Math.PI)) * 4;
            ctx.save();
            ctx.globalAlpha = beamActiveT > 0 ? 1 : 0.9;
            ctx.strokeStyle = C.teal;
            ctx.shadowColor = C.teal;
            ctx.shadowBlur = beamActiveT > 0 ? 14 : 8;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(bpx, bpy - 7);
            ctx.lineTo(bpx + 6, bpy);
            ctx.lineTo(bpx, bpy + 7);
            ctx.lineTo(bpx - 6, bpy);
            ctx.closePath();
            ctx.stroke();
            ctx.restore();
          }
        }
      }
      // 连杀狂热层数：机头上方的像素方块标识（每层 1 块，层数越多越偏红热）
      const fStacks = frenzyStacksNow();
      if (fStacks > 0) {
        const fMax = 2 + player.frenzyLevel;
        const full = fStacks >= fMax;
        const fColor = full ? C.enemy : fStacks >= fMax - 1 ? C.gold : C.player;
        // 满层：整机泛红光辉光（叠加在机体外围的一圈脉冲红光）
        if (full) {
          ctx.save();
          ctx.globalAlpha = 0.3 + 0.18 * Math.sin(elapsed * 10);
          ctx.strokeStyle = C.enemy;
          ctx.shadowColor = C.enemy;
          ctx.shadowBlur = 18;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(player.x, player.y, 24, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
        ctx.save();
        ctx.fillStyle = fColor;
        ctx.shadowColor = fColor;
        ctx.shadowBlur = full ? 10 : 6;
        const rowW = fStacks * 6 - 2;
        for (let i = 0; i < fStacks; i++) {
          ctx.fillRect(
            Math.round(player.x - rowW / 2 + i * 6),
            Math.round(player.y - 32),
            4,
            4,
          );
        }
        ctx.restore();
      }
      // 火力全开：机体上方剩余时间细进度条
      if (overdriveT > 0) {
        const frac = Math.max(0, Math.min(1, overdriveT / OVERDRIVE_DUR));
        ctx.save();
        ctx.globalAlpha = 0.4;
        ctx.fillStyle = C.star;
        ctx.fillRect(Math.round(player.x - 15), Math.round(player.y - 42), 30, 3);
        ctx.globalAlpha = 1;
        ctx.fillStyle = C.bolt;
        ctx.shadowColor = C.bolt;
        ctx.shadowBlur = 6;
        ctx.fillRect(
          Math.round(player.x - 15),
          Math.round(player.y - 42),
          Math.max(1, Math.round(30 * frac)),
          3,
        );
        ctx.restore();
      }
    }

    // 三月落地爪印印章（扩张后渐隐：掌垫 + 三趾豆描边）
    if (catStampT > 0) {
      const a = Math.max(0, catStampT / CAT_STAMP_DUR);
      const s = 1 + (1 - a) * 0.8;
      ctx.save();
      ctx.globalAlpha = a * 0.85;
      ctx.strokeStyle = catPink;
      ctx.shadowColor = catPink;
      ctx.shadowBlur = 12;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(player.x, player.y + 26, 10 * s, 7 * s, 0, 0, Math.PI * 2);
      ctx.stroke();
      for (const [tx, ty] of [
        [-8, -8],
        [0, -11],
        [8, -8],
      ]) {
        ctx.beginPath();
        ctx.ellipse(player.x + tx * s, player.y + 26 + ty * s, 3 * s, 3 * s, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Boss 登场：闪烁 WARNING 警告横幅（红带 + 大字，间歇闪现）
    if (bossEnterT > 0 && Math.floor(elapsed * 8) % 2 === 0) {
      ctx.save();
      ctx.globalAlpha = 0.22;
      ctx.fillStyle = C.enemy;
      ctx.fillRect(0, H * 0.32, W, 46);
      ctx.globalAlpha = 0.95;
      ctx.fillStyle = C.enemy;
      ctx.shadowColor = C.enemy;
      ctx.shadowBlur = 14;
      ctx.font = "bold 26px monospace";
      ctx.textAlign = "center";
      ctx.fillText("!! WARNING !!", W / 2, H * 0.32 + 31);
      ctx.restore();
    }

    // 浮动文字
    for (const f of floatTexts) {
      ctx.globalAlpha = Math.max(0, Math.min(1, f.life / f.maxLife));
      ctx.fillStyle = f.color;
      ctx.font = f.big ? "bold 22px monospace" : "bold 12px monospace";
      ctx.textAlign = "center";
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
  }

  function scrollStars(dt: number) {
    for (const s of stars) {
      s.y += s.speed * dt;
      if (s.y > H) {
        s.y = -2;
        s.x = Math.random() * W;
      }
    }
  }

  function frame(t: number) {
    if (destroyed) return;
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.033, lastT ? (t - lastT) / 1000 : 0.016);
    lastT = t;
    if (!paused && !upgradeOpen) scrollStars(dt);
    if (running && !paused && !upgradeOpen) update(dt);
    // 激光持续音随运行状态开关（棱镜机主炮 / 融合棱镜僚机持续激光期间）
    const wantLaser =
      running &&
      !paused &&
      !upgradeOpen &&
      (shipDef.weapon === "laser" || beamActiveT > 0);
    if (wantLaser !== laserSndOn) {
      laserSndOn = wantLaser;
      sfx.setLaser(wantLaser);
    }
    // 芯片风 BGM 随运行状态开关（暂停/强化弹窗/结算即停）
    const wantBgm = running && !paused && !upgradeOpen;
    if (wantBgm !== bgmSndOn) {
      bgmSndOn = wantBgm;
      sfx.setBgm(wantBgm);
    }
    render();
  }

  // ---- 输入 ----
  const INTEREST = new Set([
    "arrowleft",
    "arrowright",
    "arrowup",
    "arrowdown",
    " ",
    "b",
  ]);

  function onKeyDown(e: KeyboardEvent) {
    const k = e.key.toLowerCase();
    if (INTEREST.has(k)) e.preventDefault();
    keys[k] = true;
    if (k === "p" && running && !upgradeOpen) {
      paused = !paused;
      cb.onPauseChange(paused);
    }
    if (k === "b") useBomb();
  }
  function onKeyUp(e: KeyboardEvent) {
    keys[e.key.toLowerCase()] = false;
  }

  function toCanvasPos(e: PointerEvent) {
    const rect = canvas.getBoundingClientRect();
    const sx = rect.width > 0 ? canvas.width / rect.width : 1;
    const sy = rect.height > 0 ? canvas.height / rect.height : 1;
    return {
      x: (e.clientX - rect.left) * sx,
      y: (e.clientY - rect.top) * sy - 48,
    };
  }
  function onPointerDown(e: PointerEvent) {
    e.preventDefault();
    pointerActive = true;
    pointerTarget = toCanvasPos(e);
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      /* noop */
    }
  }
  function onPointerMove(e: PointerEvent) {
    if (!pointerActive) return;
    e.preventDefault();
    pointerTarget = toCanvasPos(e);
  }
  function onPointerUp() {
    pointerActive = false;
    pointerTarget = null;
  }

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerUp);

  raf = requestAnimationFrame(frame);

  // ---- 对外 API ----
  return {
    start(shipId?: ShipId, opts?: StartOptions) {
      shipDef = SHIP_BY_ID[shipId ?? "balanced"] ?? SHIP_BY_ID.balanced;
      shipPal = paletteOf(shipDef);
      rebuildWhitePal();
      bullets.length = 0;
      enemyBullets.length = 0;
      missiles.length = 0;
      enemies.length = 0;
      particles.length = 0;
      floatTexts.length = 0;
      pickups.length = 0;
      shockRings.length = 0;
      catSwipes.length = 0;
      for (const k of Object.keys(levels)) delete levels[k];
      const lvl = opts?.campaignLevel
        ? (CAMPAIGN_BY_INDEX[opts.campaignLevel] ?? null)
        : null;
      campaign = lvl;
      campT = 0;
      campWaveIdx = 0;
      bossActive = false;
      bossEnterT = 0;
      rebuildStars(lvl ? lvl.theme : null);
      score = 0;
      wave = 1;
      waveT = 0;
      spawnT = 1.2;
      scoreAtLast = 0;
      needed = BASE_TIER_SCORE;
      upgradesTaken = 0;
      invuln = 1.2;
      player.x = W / 2;
      player.y = H - 70;
      player.maxHp = 5 + shipDef.hpDelta;
      player.hp = player.maxHp;
      player.fireLevel = 1;
      player.fireInterval = shipDef.fireInterval || 0.24;
      player.speed = 240 * shipDef.speedMul;
      player.scoreMul = 1;
      player.cool = 0;
      player.missileLevel = 0;
      player.pierceLevel = 0;
      player.wingmanLevel = 0;
      player.critLevel = 0;
      player.overloadLevel = 0;
      player.empLevel = 0;
      player.frenzyLevel = 0;
      player.catclawLevel = 0;
      player.shieldLevel = 0;
      player.dmgLevel = 0;
      player.armorLevel = 0;
      player.prismLevel = 0;
      player.volleyLevel = 0;
      player.swipeLevel = 0;
      player.ringLevel = 0;
      beamActiveT = 0;
      beamTickAcc = 0;
      bombCount = BOMB_START;
      bombScoreAt = 0;
      bombFlashT = 0;
      upBurstT = 0;
      upFlashT = 0;
      prismBeamCd = BEAM_EVERY[0];
      volleyCd = VOLLEY_EVERY[0];
      fusionSwipeCd = FSWIPE_EVERY[0];
      fusionRingCd = FRING_EVERY[0];
      shieldReady = false;
      shieldT = SHIELD_EVERY[0];
      killStreak = 0;
      upgradePoints = 0;
      pointsEarned = 0;
      // 局内临时 buff 不跨局不跨关
      overdriveT = 0;
      timeShiftT = 0;
      singRingCd = shipDef.id === "singularity" ? 1.6 : SING_RING_CD;
      catSkillCd = shipDef.id === "cat" ? 2 : CAT_SWIPE_CD;
      catEnterT = shipDef.id === "cat" ? CAT_ENTER_DUR : 0;
      catStampT = 0;
      missileCool = 0;
      laserAcc = 0;
      elapsed = 0;
      running = true;
      paused = false;
      upgradeOpen = false;
      sfx.setLaser(false);
      laserSndOn = false;
      sfx.start();
      pushStats();
    },
    pause() {
      if (running && !upgradeOpen && !paused) {
        paused = true;
        cb.onPauseChange(true);
      }
    },
    resume() {
      if (running && !upgradeOpen && paused) {
        paused = false;
        cb.onPauseChange(false);
      }
    },
    openUpgrade() {
      if (!running || paused || upgradeOpen || upgradePoints <= 0) return;
      const choices = pickThreeUpgrades(levels, shipDef.id);
      if (choices.length === 0) return;
      upgradeOpen = true;
      sfx.upgrade();
      pushStats();
      cb.onUpgrade(choices);
    },
    closeUpgrade() {
      if (!upgradeOpen) return;
      upgradeOpen = false;
      pushStats();
      cb.onUpgradeClose();
    },
    useBomb,
    applyUpgrade(id: string) {
      levels[id] = (levels[id] ?? 0) + 1;
      if (id === "firepower") player.fireLevel = Math.min(5, player.fireLevel + 1);
      else if (id === "firerate")
        player.fireInterval = Math.max(0.08, player.fireInterval * 0.8);
      else if (id === "speed") player.speed = Math.min(460, player.speed * 1.15);
      else if (id === "bonus") player.scoreMul += 0.25;
      else if (id === "damage") player.dmgLevel += 1;
      else if (id === "missile")
        player.missileLevel = Math.min(4, player.missileLevel + 1);
      else if (id === "pierce")
        player.pierceLevel = Math.min(3, player.pierceLevel + 1);
      else if (id === "wingman")
        player.wingmanLevel = Math.min(3, player.wingmanLevel + 1);
      else if (id === "critslow")
        player.critLevel = Math.min(4, player.critLevel + 1);
      else if (id === "overload")
        player.overloadLevel = Math.min(3, player.overloadLevel + 1);
      else if (id === "emp")
        player.empLevel = Math.min(3, player.empLevel + 1);
      else if (id === "frenzy")
        player.frenzyLevel = Math.min(3, player.frenzyLevel + 1);
      else if (id === "catclaw")
        player.catclawLevel = Math.min(3, player.catclawLevel + 1);
      else if (id === "prismbeam") {
        player.prismLevel = Math.min(3, player.prismLevel + 1);
        // 首取快速见到效果；升级按新等级周期重新计时
        prismBeamCd =
          player.prismLevel === 1 ? 1 : BEAM_EVERY[player.prismLevel - 1];
      } else if (id === "spreadvolley") {
        player.volleyLevel = Math.min(3, player.volleyLevel + 1);
        volleyCd =
          player.volleyLevel === 1 ? 1 : VOLLEY_EVERY[player.volleyLevel - 1];
      } else if (id === "catswipe") {
        player.swipeLevel = Math.min(3, player.swipeLevel + 1);
        fusionSwipeCd =
          player.swipeLevel === 1 ? 1.5 : FSWIPE_EVERY[player.swipeLevel - 1];
      } else if (id === "annihilate") {
        player.ringLevel = Math.min(3, player.ringLevel + 1);
        fusionRingCd =
          player.ringLevel === 1 ? 1 : FRING_EVERY[player.ringLevel - 1];
      }
      else if (id === "shield") {
        player.shieldLevel = Math.min(3, player.shieldLevel + 1);
        // 首次拿到立即获得一面盾；升级则按新间隔重新计时（已持盾不叠加）
        if (player.shieldLevel === 1) shieldReady = true;
        else shieldT = SHIELD_EVERY[player.shieldLevel - 1];
      } else if (id === "armor") {
        player.armorLevel = Math.min(3, player.armorLevel + 1);
        player.maxHp += 1;
        healPlayer(1);
      }
      upgradesTaken += 1;
      // 消费 1 点强化点；门槛在攒点时已推进，强化不再附带回血
      upgradePoints = Math.max(0, upgradePoints - 1);
      upgradeOpen = false;
      paused = false;
      invuln = Math.max(invuln, 0.6);
      // 拿到强化瞬间爆发：上升光柱 + 环形冲击波 + 机身白闪 + 强化名大字飘字
      upBurstT = UP_BURST_DUR;
      upFlashT = UP_FLASH_DUR;
      const udef = UPGRADES.find((u) => u.id === id);
      if (udef) {
        floatTexts.push({
          x: Math.max(70, Math.min(W - 70, player.x)),
          y: player.y - 50,
          text: `${udef.icon} ${udef.title}!`,
          life: 1,
          maxLife: 1,
          color: C.core,
          big: true,
        });
      }
      pushStats();
    },
    setMuted(m: boolean) {
      sfx.setMuted(m);
    },
    destroy() {
      destroyed = true;
      sfx.setLaser(false);
      sfx.setBgm(false);
      bgmSndOn = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
    },
  };
}
