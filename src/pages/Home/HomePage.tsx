import { Pause, Play, Volume2, VolumeX } from "lucide-react";
import type { useHome } from "./useHome";
import { GameCanvas } from "@/components/home/GameCanvas";
import { GameHud } from "@/components/home/GameHud";
import { StartScreen } from "@/components/home/StartScreen";
import { UpgradeDialog } from "@/components/home/UpgradeDialog";
import { GameOverScreen } from "@/components/home/GameOverScreen";
import { PauseOverlay } from "@/components/home/PauseOverlay";
import { StatsPanel } from "@/components/home/StatsPanel";
import { LevelSelectScreen } from "@/components/home/LevelSelectScreen";
import { StageClearScreen } from "@/components/home/StageClearScreen";

export function HomePage(p: ReturnType<typeof useHome>) {
  const inRun =
    p.phase === "playing" || p.phase === "paused" || p.phase === "upgrading";
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary font-mono text-lg font-bold text-primary-foreground shadow-md">
              N
            </span>
            <h1 className="font-mono text-xl font-bold tracking-wide text-primary">
              霓虹深空
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={p.toggleMute}
              aria-label={p.muted ? "开启音效" : "关闭音效"}
              className="rounded-full border border-border bg-card p-2 text-muted-foreground shadow-sm transition duration-300 hover:text-primary focus-visible:shadow-[var(--focus-ring)]"
            >
              {p.muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
            <button
              onClick={p.togglePause}
              disabled={!inRun}
              aria-label={p.phase === "paused" ? "继续游戏" : "暂停游戏"}
              className="rounded-full border border-primary bg-card p-2 text-primary shadow-sm transition duration-300 hover:scale-105 disabled:opacity-40 disabled:hover:scale-100 focus-visible:shadow-[var(--focus-ring)]"
            >
              {p.phase === "paused" ? <Play size={18} /> : <Pause size={18} />}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4">
        <section className="animate-in fade-in slide-in-from-bottom-4 py-8 duration-500">
          <p className="max-w-2xl text-sm text-muted-foreground">
            纵版像素射击游戏
          </p>
        </section>

        <section className="grid items-start gap-6 pb-16 lg:grid-cols-5">
          <div className="relative mx-auto w-full max-w-md lg:col-span-3">
            {inRun && (
              <GameHud
                score={p.score}
                bestScore={p.levelBest}
                wave={p.wave}
                hp={p.hp}
                maxHp={p.maxHp}
                progress={p.progress}
                mode={p.mode}
                levelIndex={p.hudInfo.levelIndex}
                levelName={p.hudInfo.levelName}
                stageProgress={p.hudInfo.stageProgress}
                bossActive={p.hudInfo.bossActive}
                bossName={p.hudInfo.bossName}
                combo={p.combo}
                comboMul={p.comboMul}
                upgradePoints={p.upgradePoints}
                bombCount={p.bombCount}
                canUpgrade={p.phase === "playing"}
                onOpenUpgrade={p.openUpgradeDialog}
                onUseBomb={p.fireBomb}
              />
            )}
            <div className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-2xl ring-1 ring-primary/30">
              <GameCanvas canvasRef={p.attachCanvas} />
              {p.phase === "start" && (
                <StartScreen
                  bestScore={p.bestScore}
                  shipId={p.shipId}
                  onPickShip={p.setShipId}
                  onStart={p.startGame}
                  mode={p.mode}
                  onModeChange={p.setMode}
                  onOpenLevels={p.openLevelSelect}
                  starTotal={p.starTotal}
                  singularityUnlocked={p.singularityUnlocked}
                />
              )}
              {p.phase === "levelselect" && (
                <LevelSelectScreen
                  progress={p.campaignProgress}
                  shipLabel={p.shipLabel}
                  starTotal={p.starTotal}
                  onPick={p.startLevel}
                  onBack={p.backToStart}
                />
              )}
              {p.phase === "upgrading" && (
                <UpgradeDialog
                  choices={p.upgradeChoices}
                  onChoose={p.chooseUpgrade}
                  onClose={p.closeUpgradeDialog}
                />
              )}
              {p.phase === "paused" && (
                <PauseOverlay
                  onResume={p.togglePause}
                  onRestart={p.restartRun}
                  onQuit={p.quitToStart}
                />
              )}
              {p.phase === "stageclear" && p.stageClearInfo && (
                <StageClearScreen
                  levelIndex={p.stageClearInfo.levelIndex}
                  levelName={p.stageClearInfo.levelName}
                  stars={p.stageClearInfo.stars}
                  score={p.stageClearInfo.score}
                  isNewBest={p.stageClearInfo.isNewBest}
                  unlockedNew={p.stageClearInfo.unlockedNew}
                  allCleared={p.stageClearInfo.allCleared}
                  singularityUnlocked={p.stageClearInfo.singularityUnlocked}
                  onNext={p.nextLevel}
                  onRetry={p.retryLevel}
                  onLevels={p.gotoLevelSelect}
                />
              )}
              {p.phase === "gameover" && (
                <GameOverScreen
                  score={p.lastResult.score}
                  wave={p.lastResult.wave}
                  isNewBest={p.lastResult.isNewBest}
                  bestScore={p.bestScore}
                  shipName={p.shipLabel}
                  onRestart={p.restartGame}
                  mode={p.lastResult.mode}
                  levelIndex={p.lastResult.levelIndex}
                  levelName={p.lastResult.levelName}
                  bossActive={p.lastResult.bossActive}
                  levelBest={p.lastResult.levelBest}
                  onRetryLevel={p.retryFromGameOver}
                  onLevelSelect={p.gotoLevelSelect}
                />
              )}
            </div>
          </div>
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 lg:col-span-2">
            <StatsPanel
              phase={p.phase}
              score={p.score}
              bestScore={p.bestScore}
              wave={p.wave}
            />
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-6">
        <p className="mx-auto max-w-6xl px-4 text-center text-xs text-muted-foreground">
          方向键 / WASD 移动 · 自动开火 · B 清屏炸弹 · P 暂停 · 触屏拖动战机，进度仅保存在本机。
        </p>
      </footer>
    </div>
  );
}
