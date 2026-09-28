// Boss 类型定义：4 种 Boss 的像素造型、血量倍率与无尽模式出场权重
// 颜色一律走 ShipChannel token 通道（运行时经 CSS token 解析），不出现任何写死色值
import type { ShipChannel } from "./ships";

export type BossId = "abyss" | "fortress" | "hive" | "phantom";

export interface BossDef {
  id: BossId;
  name: string;
  /** 血量倍率（乘在基准血量上：无尽波次公式 / 关卡预设） */
  hpMul: number;
  sprite: string[];
  px: number;
  /** 精灵字符 -> 颜色通道 */
  channels: Record<string, ShipChannel>;
  /** 半透明渲染（幻影幽影感），缺省为不透明 */
  alpha?: number;
}

/** 深渊之眼（标准型）：原 Boss 造型，13 宽 × 10 高 */
export const ABYSS_SPRITE: string[] = [
  "3.....2.....3",
  "33...222...33",
  "333.22222.333",
  "3332222222333",
  "3322211122233",
  "3222222222223",
  "3322222222233",
  ".33222222233.",
  "..33.....33..",
  "..3.......3..",
];

/** 重狱（弹幕堡垒型）：宽体重装甲堡垒，17 宽（比深渊之眼更宽） */
const FORTRESS_SPRITE: string[] = [
  "11.............11",
  "111.....2.....111",
  "1111...222...1111",
  "11111.22222.11111",
  "11111122222111111",
  "11331112121113311",
  "11111122222111111",
  "11111111111111111",
  ".11..111.111..11.",
  ".2....2.....2..2.",
];

/** 蜂巢核心（突袭母舰型）：母舰/蜂巢意象，4 = 发光舱口（teal 通道） */
const HIVE_SPRITE: string[] = [
  "...111111111...",
  "..11111111111..",
  ".1141111111141.",
  "111141111114111",
  "112111444111211",
  "111114444411111",
  "112111444111211",
  ".1111111111111.",
  "..14111111141..",
  "...111111111...",
  "...2.2...2.2...",
];

/** 幻影（幽影狙击型）：细长幽灵战机，半透明渲染 */
const PHANTOM_SPRITE: string[] = [
  "....1....",
  "...111...",
  "..11211..",
  "..11111..",
  ".1111111.",
  ".11.1.11.",
  "11..1..11",
  "1...1...1",
  ".1.....1.",
  "..1...1..",
  "...1.1...",
];

export const BOSSES: BossDef[] = [
  {
    id: "abyss",
    name: "深渊之眼",
    hpMul: 1,
    sprite: ABYSS_SPRITE,
    px: 6,
    channels: { "1": "core", "2": "enemy", "3": "wing" },
  },
  {
    id: "fortress",
    name: "重狱",
    hpMul: 1.4,
    sprite: FORTRESS_SPRITE,
    px: 5,
    channels: { "1": "core", "2": "enemy", "3": "wing" },
  },
  {
    id: "hive",
    name: "蜂巢核心",
    hpMul: 1.2,
    sprite: HIVE_SPRITE,
    px: 5,
    channels: { "1": "core", "2": "enemy", "4": "teal" },
  },
  {
    id: "phantom",
    name: "幻影",
    hpMul: 0.8,
    sprite: PHANTOM_SPRITE,
    px: 5,
    channels: { "1": "wing", "2": "enemy" },
    alpha: 0.72,
  },
];

export const BOSS_BY_ID: Record<BossId, BossDef> = {
  abyss: BOSSES[0],
  fortress: BOSSES[1],
  hive: BOSSES[2],
  phantom: BOSSES[3],
};

/**
 * 无尽模式 Boss 出场权重：波次越高非标准型越重
 * wave < 10：深渊之眼 60% / 其余各约 13.3%
 * 10 ≤ wave < 20：深渊之眼 40% / 其余各 20%
 * wave ≥ 20：四种均分且略偏重狱 / 蜂巢 / 幻影
 */
export function pickEndlessBoss(wave: number): BossId {
  const weights: Record<BossId, number> =
    wave < 10
      ? { abyss: 60, fortress: 14, hive: 13, phantom: 13 }
      : wave < 20
        ? { abyss: 40, fortress: 20, hive: 20, phantom: 20 }
        : { abyss: 22, fortress: 26, hive: 26, phantom: 26 };
  const ids = Object.keys(weights) as BossId[];
  let total = 0;
  for (const id of ids) total += weights[id];
  let roll = Math.random() * total;
  for (const id of ids) {
    roll -= weights[id];
    if (roll <= 0) return id;
  }
  return "abyss";
}
