import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { SHIPS, type ShipId } from "./game/ships";
import { CAMPAIGN, SINGULARITY_STAR_REQ, type GameMode } from "./game/campaign";
import { ShipPreview } from "./ShipPreview";

interface StartScreenProps {
  bestScore: number;
  shipId: ShipId;
  onPickShip: (id: ShipId) => void;
  onStart: () => void;
  mode: GameMode;
  onModeChange: (m: GameMode) => void;
  onOpenLevels: () => void;
  starTotal: number;
  singularityUnlocked: boolean;
}

const MODE_TABS: { id: GameMode; label: string }[] = [
  { id: "endless", label: "无尽模式" },
  { id: "campaign", label: "关卡模式" },
];

export function StartScreen({
  bestScore,
  shipId,
  onPickShip,
  onStart,
  mode,
  onModeChange,
  onOpenLevels,
  starTotal,
  singularityUnlocked,
}: StartScreenProps) {
  const campaign = mode === "campaign";
  return (
    <div className="absolute inset-0 z-20 flex animate-in fade-in flex-col gap-3 overflow-y-auto rounded-2xl bg-background/90 p-4 backdrop-blur-sm duration-500">
      <header className="shrink-0 pt-1 text-center">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          Pixel Shooter · Endless &amp; Campaign
        </p>
        <h2 className="mt-1 whitespace-nowrap text-2xl font-bold text-primary drop-shadow-lg">
          霓虹深空
        </h2>
        <div
          className="mx-auto mt-2 flex w-fit gap-1 rounded-full border border-border bg-muted p-1 shadow-sm"
          role="tablist"
          aria-label="游戏模式"
        >
          {MODE_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={mode === tab.id}
              onClick={() => onModeChange(tab.id)}
              className={cn(
                "rounded-full px-4 py-1 text-xs font-bold transition duration-300 focus-visible:shadow-[var(--focus-ring)]",
                mode === tab.id
                  ? "bg-primary text-primary-foreground shadow"
                  : "text-muted-foreground hover:text-card-foreground",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">
          {campaign
            ? `8 个章节关 · 撑过突袭并击败关底 Boss · 按剩余血量评星`
            : "选一架战机 · 无尽生存 · 三选一强化 · Boss 波次"}
        </p>
      </header>

      <section className="shrink-0">
        <p className="mb-1.5 text-center font-mono text-xs uppercase tracking-widest text-card-foreground">
          选择机型 · {campaign ? "整个关卡流程不可更换" : "本局不可更换"}
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {SHIPS.map((s) => {
            const locked = s.id === "singularity" && !singularityUnlocked;
            if (locked) {
              return (
                <div
                  key={s.id}
                  aria-disabled="true"
                  className="flex w-[31%] min-w-[104px] flex-col items-center gap-1 rounded-lg border border-dashed border-border bg-muted/50 p-2 text-center shadow-sm"
                >
                  <span className="flex h-14 w-14 items-center justify-center rounded-md border border-border bg-background text-muted-foreground">
                    <Lock size={24} aria-hidden />
                  </span>
                  <span className="font-mono text-sm font-bold tracking-widest text-muted-foreground">
                    ???
                  </span>
                  <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    隐藏机型
                  </span>
                  <span className="line-clamp-2 text-xs leading-tight text-muted-foreground">
                    战役 8 关全部三星（{SINGULARITY_STAR_REQ} 星）后解锁
                  </span>
                  <span className="text-xs leading-tight text-muted-foreground">
                    当前星标 {starTotal}/{SINGULARITY_STAR_REQ}
                  </span>
                </div>
              );
            }
            const selected = s.id === shipId;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => onPickShip(s.id)}
                aria-pressed={selected}
                className={cn(
                  "flex w-[31%] min-w-[104px] flex-col items-center gap-1 rounded-lg border bg-card p-2 text-center shadow-md transition duration-300 hover:scale-105 hover:shadow-lg focus-visible:shadow-[var(--focus-ring)]",
                  selected
                    ? "border-primary bg-primary/10 ring-1 ring-primary"
                    : "border-border",
                )}
              >
                <ShipPreview ship={s} size={56} />
                <span
                  className={cn(
                    "flex items-center gap-1 text-sm font-bold",
                    selected ? "text-primary" : "text-card-foreground",
                  )}
                >
                  {s.name}
                  {s.id === "singularity" && (
                    <span className="rounded-full bg-primary px-1.5 py-0.5 text-xs font-bold text-primary-foreground shadow-sm">
                      隐藏
                    </span>
                  )}
                </span>
                <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  {s.attack}
                </span>
                <span className="line-clamp-2 text-xs leading-tight text-muted-foreground">
                  {s.trait}
                </span>
                {s.banNote ? (
                  <span className="text-xs leading-tight text-destructive">
                    {s.banNote}
                  </span>
                ) : (
                  <span className="text-xs leading-tight text-primary">
                    全强化兼容
                  </span>
                )}
                {selected && (
                  <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground shadow-sm">
                    已选中
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </section>

      <div className="mt-auto shrink-0 space-y-2 pb-1 text-center">
        {campaign ? (
          <p className="font-mono text-xs text-card-foreground">
            战役星标{" "}
            <span className="text-primary">
              {starTotal}/{CAMPAIGN.length * 3}
            </span>
          </p>
        ) : (
          bestScore > 0 && (
            <p className="font-mono text-xs text-card-foreground">
              历史最高 <span className="text-primary">{bestScore}</span>
            </p>
          )
        )}
        <button
          onClick={campaign ? onOpenLevels : onStart}
          className="animate-in fade-in slide-in-from-bottom-4 rounded-full bg-primary px-10 py-2.5 text-lg font-bold text-primary-foreground shadow-lg transition duration-300 hover:scale-105 hover:shadow-xl focus-visible:shadow-[var(--focus-ring)]"
        >
          {campaign ? "选择关卡" : "开始游戏"}
        </button>
        <ul className="space-y-0.5 text-xs text-muted-foreground">
          <li>方向键 / WASD 移动 · 自动开火 · P 暂停 · 手机拖动战机</li>
          <li>
            {campaign
              ? "得分攒满一档弹三选一强化，每关开局强化清零、从零成长"
              : "得分攒满一档弹出三选一强化，强化池按机型兼容性过滤"}
          </li>
        </ul>
      </div>
    </div>
  );
}
