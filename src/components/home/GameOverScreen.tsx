import { cn } from "@/lib/utils";
import type { GameMode } from "./game/campaign";

interface GameOverScreenProps {
  score: number;
  wave: number;
  isNewBest: boolean;
  bestScore: number;
  shipName: string;
  onRestart: () => void;
  mode: GameMode;
  levelIndex: number;
  levelName: string;
  bossActive: boolean;
  levelBest: number;
  onRetryLevel: () => void;
  onLevelSelect: () => void;
}

export function GameOverScreen({
  score,
  wave,
  isNewBest,
  bestScore,
  shipName,
  onRestart,
  mode,
  levelIndex,
  levelName,
  bossActive,
  levelBest,
  onRetryLevel,
  onLevelSelect,
}: GameOverScreenProps) {
  const campaign = mode === "campaign";
  return (
    <div className="absolute inset-0 z-20 flex animate-in fade-in flex-col items-center justify-center gap-5 rounded-2xl bg-background/90 p-6 backdrop-blur-sm duration-500">
      <div className="text-center">
        <p className="font-mono text-xs uppercase tracking-widest text-destructive">
          Game Over
        </p>
        <h3 className="mt-1 text-3xl font-bold text-card-foreground">
          战机被击落了
        </h3>
        {campaign ? (
          <p className="mt-1.5 text-sm text-muted-foreground">
            抵达第 {levelIndex} 关 ·{" "}
            <span className="font-bold text-card-foreground">{levelName}</span>
            <span
              className={cn(
                "ml-2 rounded-full border px-2.5 py-0.5 text-xs font-bold shadow-sm",
                bossActive
                  ? "border-destructive bg-destructive/10 text-destructive"
                  : "border-border bg-muted text-muted-foreground",
              )}
            >
              {bossActive ? "Boss 战" : "刷怪阶段"}
            </span>
          </p>
        ) : null}
        <p className="mt-1.5">
          <span className="rounded-full border border-border bg-card px-3 py-0.5 font-mono text-xs text-primary shadow-sm">
            本局机型 · {shipName}
          </span>
        </p>
        {isNewBest && (
          <span className="mt-3 inline-block rounded-full border border-primary bg-primary/10 px-4 py-1 text-sm font-bold text-primary shadow-md">
            {campaign ? "刷新本关最高分！" : "新纪录！"}
          </span>
        )}
      </div>
      <div className="grid w-full max-w-xs grid-cols-3 gap-2 text-center">
        <div className="rounded-md border border-border bg-card p-3 shadow-md">
          <p className="text-xs text-muted-foreground">
            {campaign ? "本关得分" : "本局得分"}
          </p>
          <p className="font-mono text-xl font-bold text-primary tabular-nums">
            {score}
          </p>
        </div>
        <div className="rounded-md border border-border bg-card p-3 shadow-md">
          <p className="text-xs text-muted-foreground">
            {campaign ? "本关最高" : "抵达波次"}
          </p>
          <p className="font-mono text-xl font-bold text-card-foreground tabular-nums">
            {campaign ? levelBest : wave}
          </p>
        </div>
        <div className="rounded-md border border-border bg-card p-3 shadow-md">
          <p className="text-xs text-muted-foreground">
            {campaign ? "关卡序号" : "历史最高"}
          </p>
          <p className="font-mono text-xl font-bold text-card-foreground tabular-nums">
            {campaign ? levelIndex : bestScore}
          </p>
        </div>
      </div>
      {campaign ? (
        <div className="flex w-full max-w-xs flex-col gap-2">
          <button
            onClick={onRetryLevel}
            className="rounded-full bg-primary px-10 py-3 text-lg font-bold text-primary-foreground shadow-lg transition duration-300 hover:scale-105 hover:shadow-xl focus-visible:shadow-[var(--focus-ring)]"
          >
            重试本关
          </button>
          <button
            onClick={onLevelSelect}
            className="rounded-full bg-muted px-8 py-2 text-sm font-bold text-muted-foreground shadow-sm transition duration-300 hover:text-card-foreground focus-visible:shadow-[var(--focus-ring)]"
          >
            关卡列表
          </button>
        </div>
      ) : (
        <button
          onClick={onRestart}
          className="rounded-full bg-primary px-10 py-3 text-lg font-bold text-primary-foreground shadow-lg transition duration-300 hover:scale-105 hover:shadow-xl focus-visible:shadow-[var(--focus-ring)]"
        >
          再来一局
        </button>
      )}
    </div>
  );
}
