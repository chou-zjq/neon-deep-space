import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { CAMPAIGN, getLevel } from "./game/campaign";

interface StageClearScreenProps {
  levelIndex: number;
  levelName: string;
  stars: number;
  score: number;
  isNewBest: boolean;
  unlockedNew: boolean;
  allCleared: boolean;
  singularityUnlocked: boolean;
  onNext: () => void;
  onRetry: () => void;
  onLevels: () => void;
}

export function StageClearScreen({
  levelIndex,
  levelName,
  stars,
  score,
  isNewBest,
  unlockedNew,
  allCleared,
  singularityUnlocked,
  onNext,
  onRetry,
  onLevels,
}: StageClearScreenProps) {
  const hasNext = levelIndex < CAMPAIGN.length;
  const nextLevel = getLevel(levelIndex + 1);
  return (
    <div className="absolute inset-0 z-20 flex animate-in fade-in flex-col items-center justify-center gap-4 overflow-y-auto rounded-2xl bg-background/90 p-5 backdrop-blur-sm duration-500">
      <div className="text-center">
        <p className="font-mono text-xs uppercase tracking-widest text-primary">
          {allCleared ? "All Clear" : "Stage Clear"}
        </p>
        <h3
          className={cn(
            "mt-1 font-bold text-card-foreground",
            allCleared ? "text-3xl text-primary drop-shadow-lg" : "text-2xl",
          )}
        >
          {allCleared ? "全部通关！" : "关卡通关"}
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          第 {levelIndex} 关 · {levelName}
          {allCleared && " · 霓虹深空的八道防线全部被你撕开"}
        </p>
      </div>

      <div className="flex items-center justify-center gap-2">
        {[1, 2, 3].map((i) => (
          <Star
            key={i}
            size={38}
            className={cn(
              "animate-in fade-in zoom-in-50 duration-500",
              i === 2 && "delay-150",
              i === 3 && "delay-300",
              i <= stars
                ? "fill-primary text-primary drop-shadow-lg"
                : "text-muted-foreground opacity-40",
            )}
          />
        ))}
      </div>
      <p className="-mt-1 text-xs text-muted-foreground">
        {stars === 3
          ? "近乎无损的完美通关"
          : stars === 2
            ? "稳住阵脚的出色表现"
            : "险胜也是胜利，下次冲三星"}
      </p>

      <div className="grid w-full max-w-xs grid-cols-2 gap-2 text-center">
        <div className="rounded-md border border-border bg-card p-3 shadow-md">
          <p className="text-xs text-muted-foreground">本关得分</p>
          <p className="font-mono text-xl font-bold text-primary tabular-nums">
            {score}
          </p>
        </div>
        <div className="rounded-md border border-border bg-card p-3 shadow-md">
          <p className="text-xs text-muted-foreground">评价</p>
          <p className="font-mono text-xl font-bold text-card-foreground">
            {stars} 星
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        {isNewBest && (
          <span className="animate-in fade-in zoom-in-75 rounded-full border border-primary bg-primary/10 px-4 py-1 text-sm font-bold text-primary shadow-md duration-500">
            刷新本关最高分！
          </span>
        )}
        {unlockedNew && nextLevel && (
          <span className="animate-in fade-in slide-in-from-bottom-2 rounded-full bg-muted px-4 py-1 text-xs font-bold text-card-foreground shadow-sm duration-500">
            已解锁 第 {nextLevel.index} 关 · {nextLevel.name}
          </span>
        )}
        {singularityUnlocked && (
          <span className="animate-in fade-in zoom-in-75 rounded-full border border-primary bg-primary/10 px-4 py-1 text-sm font-bold text-primary shadow-md duration-500">
            24 星达成 · 隐藏机型「奇点」已解锁！
          </span>
        )}
      </div>

      <div className="flex w-full max-w-xs flex-col gap-2">
        {!allCleared && hasNext && (
          <button
            onClick={onNext}
            className="rounded-full bg-primary px-8 py-2.5 text-base font-bold text-primary-foreground shadow-lg transition duration-300 hover:scale-105 hover:shadow-xl focus-visible:shadow-[var(--focus-ring)]"
          >
            下一关{nextLevel ? ` · ${nextLevel.name}` : ""}
          </button>
        )}
        <button
          onClick={onRetry}
          className="rounded-full border border-primary bg-card px-8 py-2 text-sm font-bold text-primary shadow-sm transition duration-300 hover:bg-primary/10 focus-visible:shadow-[var(--focus-ring)]"
        >
          重玩本关
        </button>
        <button
          onClick={onLevels}
          className="rounded-full bg-muted px-8 py-2 text-sm font-bold text-muted-foreground shadow-sm transition duration-300 hover:text-card-foreground focus-visible:shadow-[var(--focus-ring)]"
        >
          关卡列表
        </button>
      </div>
    </div>
  );
}
