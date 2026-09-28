import type { GamePhase } from "@/pages/Home/useHome";
import { UPGRADES } from "./game/upgrades";

interface StatsPanelProps {
  phase: GamePhase;
  score: number;
  bestScore: number;
  wave: number;
}

const PHASE_LABEL: Record<GamePhase, string> = {
  start: "待出击",
  levelselect: "选关中",
  playing: "战斗中",
  paused: "已暂停",
  upgrading: "强化选择中",
  stageclear: "过关结算",
  gameover: "已击落",
};

export function StatsPanel({ phase, score, bestScore, wave }: StatsPanelProps) {
  return (
    <div className="flex h-full flex-col gap-4">
      <div className="rounded-lg border border-border bg-card p-4 shadow-md">
        <div className="flex min-h-14 items-center justify-between">
          <h3 className="text-sm font-bold text-card-foreground">本局战况</h3>
          <span
            className={
              phase === "playing"
                ? "rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary"
                : "rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground"
            }
          >
            {PHASE_LABEL[phase]}
          </span>
        </div>
        <div className="mt-2 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-md bg-muted p-2.5">
            <p className="text-xs text-muted-foreground">得分</p>
            <p className="font-mono text-lg font-bold text-primary tabular-nums">
              {score}
            </p>
          </div>
          <div className="rounded-md bg-muted p-2.5">
            <p className="text-xs text-muted-foreground">最高</p>
            <p className="font-mono text-lg font-bold text-card-foreground tabular-nums">
              {bestScore}
            </p>
          </div>
          <div className="rounded-md bg-muted p-2.5">
            <p className="text-xs text-muted-foreground">波次</p>
            <p className="font-mono text-lg font-bold text-card-foreground tabular-nums">
              {wave}
            </p>
          </div>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          最高分会保存在本机浏览器，随时回来挑战自己的纪录。
        </p>
      </div>

      <div className="rounded-lg border border-border bg-card p-4 shadow-md">
        <h3 className="flex min-h-14 items-center text-sm font-bold text-card-foreground">
          操作方式
        </h3>
        <ul className="mt-auto space-y-2 text-xs text-muted-foreground">
          <li className="flex items-center gap-2">
            <span className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-card-foreground">
              ← ↑ ↓ →
            </span>
            <span className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-card-foreground">
              WASD
            </span>
            移动战机，自动开火
          </li>
          <li className="flex items-center gap-2">
            <span className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-card-foreground">
              P
            </span>
            暂停 / 继续
          </li>
          <li className="flex items-center gap-2">
            <span className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-card-foreground">
              B
            </span>
            引爆清屏炸弹（也可点 HUD「爆弹」按钮）
          </li>
          <li className="flex items-center gap-2">
            <span className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-card-foreground">
              触屏
            </span>
            手指按住拖动战机（手机可玩）
          </li>
        </ul>
      </div>

      <div className="rounded-lg border border-border bg-card p-4 shadow-md">
        <h3 className="text-sm font-bold text-card-foreground">强化图鉴</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          得分满档攒 1 点强化点（可储存），点 HUD「强化点」按钮开三选一；有上限的强化满级后不再刷出
        </p>
        <ul className="mt-3 grid grid-cols-2 gap-2">
          {UPGRADES.map((u) => (
            <li
              key={u.id}
              className="flex items-start gap-2 rounded-md border border-dashed border-border p-2"
            >
              <span className="shrink-0 font-mono text-base text-primary">
                {u.icon}
              </span>
              <span className="min-w-0">
                <span className="block text-xs font-bold text-card-foreground">
                  {u.title}
                </span>
                <span className="mt-0.5 block text-xs leading-tight text-muted-foreground">
                  {u.desc}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-lg border border-border bg-gradient-to-br from-background via-secondary to-card p-4 shadow-md">
        <h3 className="text-sm font-bold text-card-foreground">生存要诀</h3>
        <ul className="mt-2 space-y-1.5 text-xs text-muted-foreground">
          <li>· 每 5 波随机出现四种 Boss 之一：深渊之眼 / 重狱 / 蜂巢核心 / 幻影，弹幕分三阶段，蓄力光圈亮起时赶紧拉开</li>
          <li>· 重狱的弹幕墙留缺口，找准缺口穿过去；它的大追踪弹可以被打爆</li>
          <li>· 幻影会闪烁瞬移，盯住预警圈和红色狙击线提前走位</li>
          <li>· 红色瞄准线是狙击机蓄力，1.2 秒内走出直线</li>
          <li>· 补给母机会治疗周围敌机，优先点掉</li>
          <li>· 护盾机正面减伤先削盾，绕后或集火破盾</li>
          <li>· 自爆蜂群成群冲脸，边退边扫；分裂机死后还会裂成小机</li>
          <li>· 击落敌机会掉道具：十字回血、闪电 8 秒火力全开、沙漏全屏减速；Boss 另掉粉色星核立即加分</li>
          <li>· 不被命中连续击落攒连击，得分倍率封顶 ×1.5，被命中清零</li>
          <li>· 能量护盾到点自动生成一面，可硬吃一次命中；强化不再回血，回血靠修复核心掉落和装甲板</li>
          <li>· 强化点可攒着用：首档 150 分，之后基础 250 分，每攒 3 点门槛提高 30%，点 HUD「强化点」按钮随时开三选一</li>
          <li>· 清屏炸弹（B 键）：清空全屏敌弹并重创所有敌机，引爆后短暂无敌；开局带 1 枚，本局每累计 1500 分补 1 枚，最多存 3 枚，被弹幕围住时再放最划算</li>
          <li>· 战役 8 关全部三星可解锁隐藏机型「奇点」</li>
        </ul>
      </div>
    </div>
  );
}
