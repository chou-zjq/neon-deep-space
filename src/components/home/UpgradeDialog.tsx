import { X } from "lucide-react";
import type { UpgradeDef } from "./game/upgrades";

interface UpgradeDialogProps {
  choices: UpgradeDef[];
  onChoose: (id: string) => void;
  /** 暂不强化：关闭面板回到战斗，强化点保留 */
  onClose: () => void;
}

export function UpgradeDialog({ choices, onChoose, onClose }: UpgradeDialogProps) {
  return (
    <div className="absolute inset-0 z-20 flex animate-in fade-in zoom-in-95 flex-col rounded-2xl bg-background/90 p-3 backdrop-blur-sm duration-300">
      <div className="relative shrink-0 text-center">
        <button
          onClick={onClose}
          aria-label="关闭强化面板"
          className="absolute right-0 top-0 rounded-full border border-border bg-card p-1.5 text-muted-foreground shadow-sm transition duration-300 hover:text-primary focus-visible:shadow-[var(--focus-ring)]"
        >
          <X size={14} />
        </button>
        <p className="font-mono text-xs uppercase tracking-widest text-primary">
          Upgrade
        </p>
        <h3 className="mt-0.5 text-lg font-bold text-card-foreground">
          消耗 1 点强化点，三选一
        </h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          游戏已暂停，可点右上角关闭留到以后再用；满级的有上限强化不再出现
        </p>
      </div>
      <div className="mt-2 grid min-h-0 w-full flex-1 grid-cols-3 content-start gap-2 overflow-y-auto">
        {choices.map((u) => (
          <div
            key={u.id}
            className="flex flex-col items-center gap-1.5 rounded-lg border border-border bg-card p-2 text-center shadow-md transition duration-300 hover:border-primary hover:shadow-lg"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 font-mono text-base text-primary">
              {u.icon}
            </span>
            <h4 className="text-xs font-bold text-card-foreground">
              {u.title}
              {u.uncapped && (
                <span className="ml-1 rounded bg-primary/10 px-1 py-0.5 font-mono text-[10px] font-bold text-primary">
                  无上限
                </span>
              )}
            </h4>
            <p className="line-clamp-3 text-xs leading-tight text-muted-foreground">
              {u.desc}
            </p>
            <button
              onClick={() => onChoose(u.id)}
              className="mt-auto w-full rounded-full bg-primary px-2 py-1.5 text-xs font-bold text-primary-foreground shadow-sm transition hover:shadow-lg focus-visible:shadow-[var(--focus-ring)]"
            >
              选它
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
