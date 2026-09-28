// 我方机型定义：造型精灵、属性修正、武器类型、强化兼容性
export type ShipId = "balanced" | "spread" | "laser" | "singularity" | "cat";
export type ShipChannel =
  | "player"
  | "core"
  | "enemy"
  | "wing"
  | "star"
  | "teal"
  | "pink"
  | "stripe";
export type ShipWeapon = "bullet" | "spread" | "laser";

export interface ShipDef {
  id: ShipId;
  name: string;
  attack: string;
  trait: string;
  banNote: string;
  weapon: ShipWeapon;
  sprite: string[];
  px: number;
  /** 精灵字符 -> 颜色通道（运行时经 CSS token 解析） */
  channels: Record<string, ShipChannel>;
  speedMul: number;
  hpDelta: number;
  dmgMul: number;
  fireInterval: number;
}

const BALANCED_SPRITE = [
  "....1....",
  "...111...",
  "...121...",
  "..11111..",
  ".1111111.",
  "11.111.11",
  "1..1.1..1",
  "..3...3..",
];

const SPREAD_SPRITE = [
  ".....1.....",
  "..1..1..1..",
  ".111.2.111.",
  "11111211111",
  "1.1111111.1",
  "1..1...1..1",
  ".3.......3.",
];

const LASER_SPRITE = [
  "...2...",
  "..222..",
  ".21112.",
  ".21312.",
  ".21112.",
  "2211122",
  "2.111.2",
  "..1.1..",
  "..3.3..",
];

// 隐藏机型「奇点」：环形吸积盘包裹黑洞虚空（中心留空 = 奇点本体），底部双引擎辉光
const SINGULARITY_SPRITE = [
  "...22222...",
  ".221111122.",
  "21144444112",
  "2144...4412",
  "214.....412",
  "214.....412",
  "2144...4412",
  "21144444112",
  ".221111122.",
  "...22222...",
  "....3.3....",
];

// 猫咪机型「三月」：纯圆猫头战机（三角猫耳粉内耳、额头虎斑纹、绿眼座舱、白口鼻粉鼻），不画四肢与外伸胡须
const CAT_SPRITE = [
  ".22.....22.",
  ".232...232.",
  ".2332.2332.",
  ".222222222.",
  "22252525222",
  "22112221122",
  "22444344422",
  ".224444422.",
  "..2222222..",
];

export const SHIPS: ShipDef[] = [
  {
    id: "balanced",
    name: "水鸭",
    attack: "直线火力",
    trait: "各项均衡，兼容全部强化",
    banNote: "",
    weapon: "bullet",
    sprite: BALANCED_SPRITE,
    px: 4,
    channels: { "1": "player", "2": "core", "3": "enemy" },
    speedMul: 1,
    hpDelta: 0,
    dmgMul: 1,
    fireInterval: 0.24,
  },
  {
    id: "spread",
    name: "火种",
    attack: "扇形散射",
    trait: "近战爆发，移速 +15%，血量上限 -1",
    banNote: "与穿透弹不兼容",
    weapon: "spread",
    sprite: SPREAD_SPRITE,
    px: 4,
    channels: { "1": "player", "2": "enemy", "3": "core" },
    speedMul: 1.15,
    hpDelta: -1,
    dmgMul: 0.6,
    fireInterval: 0.3,
  },
  {
    id: "laser",
    name: "棱镜",
    attack: "贯穿光束",
    trait: "光束贯穿一列，火力升宽度，移速 -10%",
    banNote: "与射速、穿透弹不兼容",
    weapon: "laser",
    sprite: LASER_SPRITE,
    px: 4,
    channels: { "1": "core", "2": "player", "3": "teal" },
    speedMul: 0.9,
    hpDelta: 0,
    dmgMul: 1,
    fireInterval: 0.24,
  },
  {
    id: "singularity",
    name: "奇点",
    attack: "湮灭冲击环",
    trait: "直线主炮 + 周期冲击环，伤害/移速略高，血量上限 +1",
    banNote: "",
    weapon: "bullet",
    sprite: SINGULARITY_SPRITE,
    px: 4,
    channels: { "1": "wing", "2": "teal", "3": "player", "4": "core" },
    speedMul: 1.05,
    hpDelta: 1,
    dmgMul: 1.15,
    fireInterval: 0.24,
  },
  {
    id: "cat",
    name: "三月",
    attack: "喵爪三连击",
    trait: "周期喵爪三连击扫列 + 喵叫，移速 +10%，主炮 -5%",
    banNote: "",
    weapon: "bullet",
    sprite: CAT_SPRITE,
    px: 4,
    channels: { "1": "player", "2": "star", "3": "pink", "4": "core", "5": "stripe" },
    speedMul: 1.1,
    hpDelta: 0,
    dmgMul: 0.95,
    fireInterval: 0.24,
  },
];

export const SHIP_BY_ID: Record<ShipId, ShipDef> = {
  balanced: SHIPS[0],
  spread: SHIPS[1],
  laser: SHIPS[2],
  singularity: SHIPS[3],
  cat: SHIPS[4],
};

/** 各机型不兼容的强化 id（三选一弹窗按此过滤；catclaw 为三月专属，其余机型不出现；
 *  融合强化对本源机型隐藏——棱镜不刷棱镜僚机、火种不刷散射齐射、三月不刷喵爪斩、奇点不刷湮灭冲击环） */
export const SHIP_INCOMPATIBLE: Record<ShipId, string[]> = {
  balanced: ["catclaw"],
  spread: ["pierce", "catclaw", "spreadvolley"],
  laser: ["firerate", "pierce", "catclaw", "prismbeam"],
  singularity: ["catclaw", "annihilate"],
  cat: ["catswipe"],
};

export function readTokenCss(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  if (!raw) return fallback;
  // shadcn v3 风格：--token 存的是 "H S% L%" 通道值
  if (/^[-\d.]+[\s,]+[-\d.]+%?[\s,]+[-\d.]+%?$/.test(raw)) {
    return `hsl(${raw.replace(/,/g, " ")})`;
  }
  return raw;
}

/** 把 token 解析出的 hsl 明度按 delta 偏移（提亮/变暗通道，派生自既有 token，不引入新色值） */
export function shiftCss(css: string, dl: number): string {
  const m = /^hsl\(\s*([-\d.]+)\s+([\d.]+)%\s+([\d.]+)%\s*\)$/.exec(css);
  if (!m) return css;
  const l = Math.max(0, Math.min(100, Number.parseFloat(m[3]) + dl));
  return `hsl(${m[1]} ${m[2]}% ${l}%)`;
}

/** 把 token 解析出的 hsl 提亮到至少 minL（派生自既有 token 通道，不引入新色值） */
export function brightenCss(css: string, minL: number): string {
  const m = /^hsl\(\s*([-\d.]+)\s+([\d.]+)%\s+([\d.]+)%\s*\)$/.exec(css);
  if (!m) return css;
  const l = Math.max(Number.parseFloat(m[3]), minL);
  return `hsl(${m[1]} ${m[2]}% ${l}%)`;
}

/** 把 token 解析出的 hsl 色相按 delta 旋转（派生自既有 token，不引入新色值；用于金色/亮蓝等派生色） */
export function rotateCss(css: string, dh: number): string {
  const m = /^hsl\(\s*([-\d.]+)\s+([\d.]+)%\s+([\d.]+)%\s*\)$/.exec(css);
  if (!m) return css;
  const h = (Number.parseFloat(m[1]) + dh) % 360;
  return `hsl(${h < 0 ? h + 360 : h} ${m[2]}% ${m[3]}%)`;
}

const CHANNEL_TOKEN: Record<ShipChannel, string> = {
  player: "--primary",
  core: "--foreground",
  enemy: "--destructive",
  wing: "--accent",
  star: "--muted-foreground",
  teal: "--accent",
  pink: "--destructive",
  stripe: "--muted-foreground",
};

const CHANNEL_FALLBACK: Record<ShipChannel, string> = {
  player: "#36F4A4",
  core: "#FFFFFF",
  enemy: "#FF6B6B",
  wing: "#7C8AFF",
  star: "#8A93A6",
  teal: "#2DD4BF",
  pink: "#FF9EC2",
  stripe: "#5A6472",
};

export function channelColor(ch: ShipChannel): string {
  const raw = readTokenCss(CHANNEL_TOKEN[ch], "");
  if (!raw) return CHANNEL_FALLBACK[ch];
  if (ch === "teal") return brightenCss(raw, 44);
  // 粉色通道：destructive 提亮派生（猫耳内/鼻/爪痕光刃）
  if (ch === "pink") return brightenCss(raw, 18);
  // 深灰通道：muted-foreground 压暗派生（猫额头虎斑纹）
  if (ch === "stripe") return shiftCss(raw, -14);
  return raw;
}
