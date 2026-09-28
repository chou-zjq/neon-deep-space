import { ChevronRight, Lock, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { CAMPAIGN, type CampaignProgress } from "./game/campaign";

interface LevelSelectScreenProps {
  progress: CampaignProgress;
  shipLabel: string;
  starTotal: number;
  onPick: (levelIndex: number) => void;
  onBack: () => void;
}

export function LevelSelectScreen({
  progress,
  shipLabel,
  starTotal,
  onPick,
  onBack,
}: LevelSelectScreenProps) {
  return (
    <div className="absolute inset-0 z-20 flex animate-in fade-in flex-col rounded-2xl bg-background/90 p-3 backdrop-blur-sm duration-300">
      <header className="flex shrink-0 items-center justify-between gap-2 px-1 pt-1">
        <button
          onClick={onBack}
          className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-bold text-muted-foreground shadow-sm transition duration-300 hover:border-primary hover:text-primary focus-visible:shadow-[var(--focus-ring)]"
        >
          ← 返回
        </button>
        <div className="text-center">
          <p className="font-mono text-xs uppercase tracking-widest text-primary">
            Campaign
          </p>
          <h3 className="text-lg font-bold text-card-foreground">选择关卡</h3>
        </div>
        <span className="flex items-center gap-1 rounded-full border border-primary bg-primary/10 px-3 py-1.5 font-mono text-xs font-bold text-primary shadow-sm">
          <Star size={12} className="fill-primary" />
          {starTotal}/{CAMPAIGN.length * 3}
        </span>
      </header>

      <p className="shrink-0 pt-1 text-center text-xs text-muted-foreground">
        出击机型 ·{" "}
        <span className="font-bold text-card-foreground">{shipLabel}</span>
        （返回开始界面可更换）
      </p>

      <div className="mt-2 min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-0.5">
        {CAMPAIGN.map((lvl) => {
          const unlocked = lvl.index <= progress.unlocked;
          const rec = progress.records[lvl.index];
          return (
            <button
              key={lvl.index}
              type="button"
              disabled={!unlocked}
              onClick={() => onPick(lvl.index)}
              aria-label={
                unlocked
                  ? `进入第 ${lvl.index} 关 ${lvl.name}`
                  : `第 ${lvl.index} 关未解锁`
              }
              className={cn(
                "flex w-full items-center gap-2.5 rounded-lg border bg-card p-2 text-left shadow-md transition duration-300 focus-visible:shadow-[var(--focus-ring)]",
                unlocked
                  ? "border-border hover:border-primary hover:shadow-lg"
                  : "border-dashed border-border bg-muted/40 opacity-70",
              )}
            >
              <span
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-md border font-mono text-sm font-bold shadow-sm",
                  unlocked
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-muted text-muted-foreground",
                )}
              >
                {String(lvl.index).padStart(2, "0")}
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className={cn(
                    "block truncate text-sm font-bold",
                    unlocked ? "text-card-foreground" : "text-muted-foreground",
                  )}
                >
                  {lvl.name}
                </span>
                {unlocked ? (
                  <span className="mt-0.5 flex items-center gap-2">
                    <span className="flex gap-0.5">
                      {[1, 2, 3].map((i) => (
                        <Star
                          key={i}
                          size={11}
                          className={cn(
                            i <= (rec?.stars ?? 0)
                              ? "fill-primary text-primary"
                              : "text-muted-foreground opacity-40",
                          )}
                        />
                      ))}
                    </span>
                    <span className="font-mono text-xs text-muted-foreground tabular-nums">
                      最高 {rec?.best ?? 0}
                    </span>
                  </span>
                ) : (
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    未解锁 · 通过上一关开启
                  </span>
                )}
              </span>
              {unlocked ? (
                <ChevronRight size={16} className="shrink-0 text-primary" />
              ) : (
                <Lock size={15} className="shrink-0 text-muted-foreground" />
              )}
            </button>
          );
        })}
      </div>

      <footer className="shrink-0 pt-2 text-center">
        <p className="text-xs text-muted-foreground">
          每关从零成长 · 撑过突袭阶段并击败关底 Boss 即过关 · 剩余血量越足星越多
        </p>
      </footer>
    </div>
  );
}
