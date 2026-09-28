import { SHIP_INCOMPATIBLE, type ShipId } from "./ships";

export interface UpgradeDef {
  id: string;
  title: string;
  desc: string;
  icon: string;
  /** 无上限强化：可无限叠加，永远不会从三选一池中消失 */
  uncapped?: boolean;
}

/**
 * 有上限强化的等级上限：达到上限后不再出现在三选一池里。
 * 不在表中的强化 = 无上限强化（弹头改装 / 得分加成），可无限叠加。
 */
export const UPGRADE_CAPS: Record<string, number> = {
  firepower: 5,
  firerate: 5,
  speed: 5,
  missile: 4,
  pierce: 3,
  wingman: 3,
  critslow: 4,
  overload: 3,
  emp: 3,
  frenzy: 3,
  shield: 3,
  armor: 3,
  catclaw: 3,
  prismbeam: 3,
  spreadvolley: 3,
  catswipe: 3,
  annihilate: 3,
};

export const UPGRADES: UpgradeDef[] = [
  {
    id: "firepower",
    title: "火力强化",
    desc: "弹道 +1，弹幕更密（最多 5 路）",
    icon: "▲",
  },
  {
    id: "firerate",
    title: "射速提升",
    desc: "射击间隔缩短 20%",
    icon: "≡",
  },
  {
    id: "damage",
    title: "弹头改装",
    desc: "全部武器伤害 +15%，无上限叠加——越攒越痛",
    icon: "◆",
    uncapped: true,
  },
  {
    id: "speed",
    title: "引擎改装",
    desc: "战机移动速度 +15%",
    icon: "»",
  },
  {
    id: "bonus",
    title: "得分加成",
    desc: "击落得分 +25%，无上限叠加，冲榜更快",
    icon: "★",
    uncapped: true,
  },
  {
    id: "missile",
    title: "追踪导弹",
    desc: "定期自动发射追踪最近敌机的导弹，等级提升数量与频率",
    icon: "➤",
  },
  {
    id: "pierce",
    title: "穿透弹",
    desc: "主炮子弹可穿透敌机继续飞行，等级提升穿透个数",
    icon: "⇈",
  },
  {
    id: "wingman",
    title: "僚机伴飞",
    desc: "两侧小僚机跟随并一起射击，等级提升僚机弹道数",
    icon: "❖",
  },
  {
    id: "critslow",
    title: "暴击与减速",
    desc: "子弹概率暴击双倍伤害，并概率使敌机减速",
    icon: "✦",
  },
  {
    id: "overload",
    title: "超载核心",
    desc: "全场每 1 级强化主炮伤害 +3%，等级把每级加成提到 +7%——强化越多伤害越高",
    icon: "⊛",
  },
  {
    id: "emp",
    title: "电磁弹头",
    desc: "命中使敌机减速，减速中的敌机受到全部伤害 +25%（等级提到 40%）——先减速再集火",
    icon: "⚡",
  },
  {
    id: "frenzy",
    title: "连杀狂热",
    desc: "每连击落 8 架叠 1 层（上限 3/5），每层伤害 +8% 得分 +10%，被命中清空——激进走位换输出",
    icon: "✸",
  },
  {
    id: "shield",
    title: "能量护盾",
    desc: "每 10 秒自动生成一面一次性护盾抵挡一次命中（不叠加），等级把间隔缩至 7.5/5 秒",
    icon: "◍",
  },
  {
    id: "armor",
    title: "装甲板",
    desc: "血量上限 +1，并立即补上这格血",
    icon: "▣",
  },
  {
    id: "catclaw",
    title: "磨利猫爪",
    desc: "三月专属：喵爪三连击每级 +1 道爪痕光刃（3 道提到 6 道），扫列覆盖更宽",
    icon: "爪",
  },
  {
    id: "prismbeam",
    title: "棱镜僚机",
    desc: "融合强化：左右双棱镜僚机悬浮伴飞，周期释放两道持续贯穿激光；升级缩短火力间隔",
    icon: "‖",
  },
  {
    id: "spreadvolley",
    title: "散射齐射",
    desc: "融合强化：周期性自动打出一轮 5 丸扇形霰弹（短射程覆盖面前）；等级提单丸伤害并缩短周期",
    icon: "※",
  },
  {
    id: "catswipe",
    title: "喵爪斩",
    desc: "融合强化：周期性放出爪痕光刃自下而上扫过整列（三月的看家本领）；等级把爪痕提到 4/5 道",
    icon: "∴",
  },
  {
    id: "annihilate",
    title: "湮灭冲击环",
    desc: "融合强化：周期性以机体为中心释放扩张湮灭冲击环（奇点的看家本领）；等级提伤害并缩短周期",
    icon: "◎",
  },
];

/** 激光机的「火力强化」语义不同：提升光束宽度 */
const LASER_FIREPOWER_DESC = "光束宽度 +1 档，贯穿伤害更高";
/** 激光机的「电磁弹头」语义不同：光束命中即挂减速 */
const LASER_EMP_DESC =
  "光束命中减速敌机，减速中的敌机受到全部伤害 +25%（等级提到 40%）——先减速再集火";

function capOf(id: string): number | undefined {
  return UPGRADE_CAPS[id];
}

/**
 * 按当前机型过滤不兼容项后的随机三选一；
 * 有上限的强化满级后不再刷出；不足 3 项时用无上限强化补满（它们永远不会满级）。
 */
export function pickThreeUpgrades(
  levels: Record<string, number>,
  shipId: ShipId,
): UpgradeDef[] {
  const blocked = new Set(SHIP_INCOMPATIBLE[shipId] ?? []);
  const compatible = UPGRADES.filter((u) => !blocked.has(u.id));
  const isMaxed = (u: UpgradeDef) => {
    const cap = capOf(u.id);
    return cap !== undefined && (levels[u.id] ?? 0) >= cap;
  };
  const pool = compatible.filter((u) => !isMaxed(u));
  const out: UpgradeDef[] = [];
  const decor = (u: UpgradeDef): UpgradeDef => {
    if (shipId !== "laser") return u;
    if (u.id === "firepower") return { ...u, desc: LASER_FIREPOWER_DESC };
    if (u.id === "emp") return { ...u, desc: LASER_EMP_DESC };
    return u;
  };
  while (out.length < 3 && pool.length > 0) {
    out.push(decor(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]));
  }
  // 不足 3 项：只用无上限强化补满，满级的有上限强化不再出现
  const rest = compatible.filter(
    (u) => capOf(u.id) === undefined && !out.some((o) => o.id === u.id),
  );
  while (out.length < 3 && rest.length > 0) {
    out.push(decor(rest.splice(Math.floor(Math.random() * rest.length), 1)[0]));
  }
  return out;
}
