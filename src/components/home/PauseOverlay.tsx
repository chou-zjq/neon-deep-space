interface PauseOverlayProps {
  onResume: () => void;
  onRestart: () => void;
  onQuit: () => void;
}

export function PauseOverlay({ onResume, onRestart, onQuit }: PauseOverlayProps) {
  return (
    <div className="absolute inset-0 z-20 flex animate-in fade-in flex-col items-center justify-center gap-5 rounded-2xl bg-background/80 backdrop-blur-sm duration-300">
      <div className="text-center">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          Paused
        </p>
        <h3 className="mt-1 text-3xl font-bold text-card-foreground">已暂停</h3>
        <p className="mt-2 text-xs text-muted-foreground">
          按 P 键或点击下方按钮继续战斗
        </p>
      </div>
      <div className="flex flex-col items-center gap-2.5">
        <button
          onClick={onResume}
          className="rounded-full bg-primary px-10 py-2.5 font-bold text-primary-foreground shadow-lg transition duration-300 hover:scale-105 hover:shadow-xl focus-visible:shadow-[var(--focus-ring)]"
        >
          继续游戏
        </button>
        <button
          onClick={onRestart}
          className="w-44 rounded-full border border-primary px-6 py-2 text-sm font-bold text-primary shadow-sm transition duration-300 hover:scale-105 hover:bg-primary/10 focus-visible:shadow-[var(--focus-ring)]"
        >
          重新开始
        </button>
        <button
          onClick={onQuit}
          className="w-44 rounded-full border border-border px-6 py-2 text-sm font-bold text-muted-foreground shadow-sm transition duration-300 hover:scale-105 hover:text-card-foreground focus-visible:shadow-[var(--focus-ring)]"
        >
          返回主页
        </button>
      </div>
    </div>
  );
}
