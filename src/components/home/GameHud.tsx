import { cn } from "@/lib/utils";
import type { GameMode } from "./game/campaign";

interface GameHudProps {
  score: number;
  bestScore: number;
  wave: number;
  hp: number;
  maxHp: number;
  progress: number;
  mode: GameMode;
  levelIndex: number;
  levelName: string;
  stageProgress: number;
  bossActive: boolean;
  /** 当前 Boss 类型名（「BOSS · xx」徽标；空串显示「BOSS 战」） */
  bossName: string;
  combo: number;
  comboMul: number;
  /** 储存的强化点（点击按钮打开三选一） */
  upgradePoints: number;
  /** 清屏炸弹存量（点击按钮引爆，B 键同效） */
  bombCount: number;
  /** 仅战斗中可点开强化面板 */
  canUpgrade: boolean;
  onOpenUpgrade: () => void;
  onUseBomb: () => void;
}

export function GameHud({
  score,
  bestScore,
  wave,
  hp,
  maxHp,
  progress,
  mode,
  levelIndex,
  levelName,
  stageProgress,
  bossActive,
  bossName,
  combo,
  comboMul,
  upgradePoints,
  bombCount,
  canUpgrade,
  onOpenUpgrade,
  onUseBomb,
}: GameHudProps) {
  const segments = Math.min(12, Math.max(1, maxHp));
  const danger = hp > 0 && hp <= 2;
  const campaign = mode === "campaign";
  const mulText = comboMul % 1 === 0 ? comboMul.toFixed(0) : comboMul.toFixed(1);
  return (
    <div className="space-y-1.5 pb-3">
      <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-card px-3 py-1.5 shadow-md">
        <div className="flex items-baseline gap-1.5">
          <span className="text-xs text-muted-foreground">得分</span>
          <span className="font-mono text-lg font-bold text-primary tabular-nums">
            {score}
          </span>
        </div>
        {combo > 0 && (
          <span className="animate-in fade-in zoom-in-75 whitespace-nowrap rounded-full border border-primary bg-primary/10 px-2 py-0.5 font-mono text-xs font-bold text-primary shadow-sm duration-300">
            连击 {combo} ·×{mulText}
          </span>
        )}
        <div className="flex items-baseline gap-1.5">
          <span className="text-xs text-muted-foreground">
            {campaign ? "本关最高" : "最高"}
          </span>
          <span className="font-mono text-sm font-bold text-card-foreground tabular-nums">
            {bestScore}
          </span>
        </div>
        {campaign ? (
          <span className="rounded-full border border-primary bg-primary/10 px-2 py-0.5 font-mono text-xs font-bold text-primary shadow-sm">
            第{levelIndex}关
          </span>
        ) : (
          <div className="flex items-baseline gap-1.5">
            <span className="text-xs text-muted-foreground">波次</span>
            <span className="font-mono text-sm font-bold text-card-foreground tabular-nums">
              {wave}
            </span>
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 px-1">
        <div className={cn("flex gap-1", danger && "animate-pulse")}>
          {Array.from({ length: segments }).map((_, i) => (
            <span
              key={i}
              className={cn(
                "h-2.5 w-4 rounded-sm shadow-sm",
                i < hp
                  ? danger
                    ? "bg-destructive"
                    : "bg-primary"
                  : "border border-border bg-muted",
              )}
            />
          ))}
        </div>
        <div className="h-2 flex-1 overflow-hidden rounded-full border border-border bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
        <button
          onClick={onOpenUpgrade}
          disabled={upgradePoints <= 0 || !canUpgrade}
          title="消耗 1 点强化点，打开三选一强化面板"
          className={cn(
            "whitespace-nowrap rounded-full border px-2 py-0.5 font-mono text-xs font-bold shadow-sm transition duration-300 focus-visible:shadow-[var(--focus-ring)]",
            upgradePoints > 0 && canUpgrade
              ? "animate-pulse border-primary bg-primary/10 text-primary hover:scale-105"
              : "cursor-not-allowed border-border bg-muted text-muted-foreground opacity-60",
          )}
        >
          强化点 ×{upgradePoints}
        </button>
        <button
          onClick={onUseBomb}
          disabled={bombCount <= 0 || !canUpgrade}
          title="引爆清屏炸弹：清空全屏敌方子弹并重创所有敌机（B 键）"
          className={cn(
            "whitespace-nowrap rounded-full border px-2 py-0.5 font-mono text-xs font-bold shadow-sm transition duration-300 focus-visible:shadow-[var(--focus-ring)]",
            bombCount > 0 && canUpgrade
              ? "border-destructive bg-destructive/10 text-destructive hover:scale-105"
              : "cursor-not-allowed border-border bg-muted text-muted-foreground opacity-60",
          )}
        >
          爆弹 ×{bombCount}
        </button>
      </div>
      {campaign && (
        <div className="flex items-center gap-2 px-1">
          {bossActive ? (
            <span className="animate-pulse rounded-full border border-destructive bg-destructive/10 px-3 py-0.5 font-mono text-xs font-bold tracking-widest text-destructive shadow-sm">
              {bossName ? `BOSS · ${bossName}` : "BOSS 战"}
            </span>
          ) : (
            <>
              <span className="max-w-28 truncate font-mono text-xs text-muted-foreground">
                {levelName}
              </span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full border border-border bg-muted">
                <div
                  className="h-full rounded-full bg-primary/70 transition-all duration-300"
                  style={{ width: `${Math.round(stageProgress * 100)}%` }}
                />
              </div>
              <span className="font-mono text-xs text-muted-foreground">
                关卡进度
              </span>
            </>
          )}
        </div>
      )}
    </div>
  );
}
