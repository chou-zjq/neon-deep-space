import { useCallback, useEffect, useRef, useState } from "react";
import {
  createGame,
  type GameEngine,
  type GameOverResult,
  type HudStats,
  type StageClearResult,
} from "@/components/home/game/engine";
import type { UpgradeDef } from "@/components/home/game/upgrades";
import { SHIP_BY_ID, type ShipId } from "@/components/home/game/ships";
import {
  CAMPAIGN,
  getLevel,
  isSingularityUnlocked,
  loadCampaignProgress,
  recordLevelClear,
  recordLevelScore,
  unlockSingularity,
  type CampaignProgress,
  type GameMode,
} from "@/components/home/game/campaign";
import { sfx } from "@/components/home/game/audio";

export type GamePhase =
  | "start"
  | "levelselect"
  | "playing"
  | "paused"
  | "upgrading"
  | "stageclear"
  | "gameover";

export interface LastResult {
  score: number;
  wave: number;
  isNewBest: boolean;
  mode: GameMode;
  levelIndex: number;
  levelName: string;
  bossActive: boolean;
  levelBest: number;
}

export interface StageClearInfo {
  levelIndex: number;
  levelName: string;
  stars: number;
  score: number;
  isNewBest: boolean;
  unlockedNew: boolean;
  allCleared: boolean;
  /** 本次结算瞬间解锁了隐藏机型「奇点」 */
  singularityUnlocked: boolean;
}

export interface CampaignHudInfo {
  levelIndex: number;
  levelName: string;
  stageProgress: number;
  bossActive: boolean;
  /** 当前 Boss 类型名（「BOSS · xx」徽标；无 Boss 时为空串） */
  bossName: string;
}

const BEST_KEY = "neon-deep-space-best";

function loadBest(): number {
  try {
    const raw = window.localStorage.getItem(BEST_KEY);
    const v = raw ? Number.parseInt(raw, 10) : 0;
    return Number.isFinite(v) && v > 0 ? v : 0;
  } catch {
    return 0;
  }
}

function sumStars(p: CampaignProgress): number {
  let sum = 0;
  for (const lvl of CAMPAIGN) sum += p.records[lvl.index]?.stars ?? 0;
  return sum;
}

export function useHome() {
  const [phase, setPhase] = useState<GamePhase>("start");
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(0);
  const [wave, setWave] = useState(1);
  const [hp, setHp] = useState(5);
  const [maxHp, setMaxHp] = useState(5);
  const [progress, setProgress] = useState(0);
  const [upgradePoints, setUpgradePoints] = useState(0);
  const [upgradeChoices, setUpgradeChoices] = useState<UpgradeDef[]>([]);
  const [muted, setMuted] = useState(false);
  const [shipId, setShipId] = useState<ShipId>("balanced");
  const [combo, setCombo] = useState(0);
  const [comboMul, setComboMul] = useState(1);
  const [bombCount, setBombCount] = useState(0);
  const [lastResult, setLastResult] = useState<LastResult>({
    score: 0,
    wave: 1,
    isNewBest: false,
    mode: "endless",
    levelIndex: 0,
    levelName: "",
    bossActive: false,
    levelBest: 0,
  });

  // ---- 关卡模式状态 ----
  const [mode, setMode] = useState<GameMode>("endless");
  const [campaignProgress, setCampaignProgress] = useState<CampaignProgress>({
    unlocked: 1,
    records: {},
  });
  const [activeLevel, setActiveLevel] = useState(1);
  const [stageClearInfo, setStageClearInfo] = useState<StageClearInfo | null>(
    null,
  );
  const [hudInfo, setHudInfo] = useState<CampaignHudInfo>({
    levelIndex: 0,
    levelName: "",
    stageProgress: 0,
    bossActive: false,
    bossName: "",
  });

  const engineRef = useRef<GameEngine | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const bestRef = useRef(0);
  const mutedRef = useRef(false);
  /** 奇点解锁状态追踪（用于识别「解锁瞬间」给结算界面提示） */
  const singUnlockedRef = useRef(false);

  useEffect(() => {
    const b = loadBest();
    bestRef.current = b;
    setBestScore(b);
    const prog = loadCampaignProgress();
    setCampaignProgress(prog);
    singUnlockedRef.current = isSingularityUnlocked(prog);
  }, []);

  const handleStats = useCallback((s: HudStats) => {
    setScore(s.score);
    setWave(s.wave);
    setHp(s.hp);
    setMaxHp(s.maxHp);
    setProgress(s.progress);
    setUpgradePoints(s.upgradePoints);
    setCombo(s.combo);
    setComboMul(s.comboMul);
    setBombCount(s.bombCount);
    setHudInfo({
      levelIndex: s.levelIndex,
      levelName: s.levelName,
      stageProgress: s.stageProgress,
      bossActive: s.bossActive,
      bossName: s.bossName,
    });
  }, []);

  const handleUpgrade = useCallback((choices: UpgradeDef[]) => {
    setUpgradeChoices(choices);
    setPhase("upgrading");
  }, []);

  /** 手动关闭三选一：不消耗强化点，回到战斗 */
  const handleUpgradeClose = useCallback(() => {
    setUpgradeChoices([]);
    setPhase((prev) => (prev === "upgrading" ? "playing" : prev));
  }, []);

  const handleGameOver = useCallback((r: GameOverResult) => {
    if (r.mode === "campaign") {
      // 关卡内失败：得分计入该关最高分，不动无尽模式纪录
      const { progress: campProg, isNewBest } = recordLevelScore(
        r.levelIndex,
        r.score,
      );
      setCampaignProgress(campProg);
      setLastResult({
        score: r.score,
        wave: r.wave,
        isNewBest,
        mode: "campaign",
        levelIndex: r.levelIndex,
        levelName: r.levelName,
        bossActive: r.bossActive,
        levelBest: campProg.records[r.levelIndex]?.best ?? 0,
      });
    } else {
      const isNewBest = r.score > bestRef.current;
      if (isNewBest) {
        bestRef.current = r.score;
        setBestScore(r.score);
        try {
          window.localStorage.setItem(BEST_KEY, String(r.score));
        } catch {
          /* 隐私模式下忽略 */
        }
      }
      setLastResult({
        score: r.score,
        wave: r.wave,
        isNewBest,
        mode: "endless",
        levelIndex: 0,
        levelName: "",
        bossActive: false,
        levelBest: 0,
      });
    }
    setPhase("gameover");
  }, []);

  const handleStageClear = useCallback((r: StageClearResult) => {
    const {
      progress: campProg,
      isNewBest,
      unlockedNew,
    } = recordLevelClear(r.levelIndex, r.stars, r.score);
    // 隐藏机型「奇点」：战役 24 星达标 → 解锁瞬间持久化 + 结算提示 + 解锁音效
    let prog = campProg;
    const nowUnlocked = isSingularityUnlocked(campProg);
    const justUnlocked = nowUnlocked && !singUnlockedRef.current;
    if (justUnlocked) {
      prog = unlockSingularity();
      sfx.unlock();
    }
    singUnlockedRef.current = nowUnlocked;
    setCampaignProgress(prog);
    if (unlockedNew) sfx.unlock();
    setStageClearInfo({
      levelIndex: r.levelIndex,
      levelName: getLevel(r.levelIndex)?.name ?? "",
      stars: r.stars,
      score: r.score,
      isNewBest,
      unlockedNew,
      allCleared: r.levelIndex >= CAMPAIGN.length,
      singularityUnlocked: justUnlocked,
    });
    setPhase("stageclear");
  }, []);

  const handlePauseChange = useCallback((pausedNow: boolean) => {
    setPhase((prev) => {
      if (prev !== "playing" && prev !== "paused") return prev;
      return pausedNow ? "paused" : "playing";
    });
  }, []);

  const spawnEngine = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (engineRef.current) {
      engineRef.current.destroy();
      engineRef.current = null;
    }
    const engine = createGame(canvas, {
      onStats: handleStats,
      onUpgrade: handleUpgrade,
      onUpgradeClose: handleUpgradeClose,
      onGameOver: handleGameOver,
      onStageClear: handleStageClear,
      onPauseChange: handlePauseChange,
    });
    engine.setMuted(mutedRef.current);
    engineRef.current = engine;
  }, [
    handleStats,
    handleUpgrade,
    handleUpgradeClose,
    handleGameOver,
    handleStageClear,
    handlePauseChange,
  ]);

  const attachCanvas = useCallback(
    (canvas: HTMLCanvasElement | null) => {
      if (canvasRef.current === canvas) return;
      if (engineRef.current) {
        engineRef.current.destroy();
        engineRef.current = null;
      }
      canvasRef.current = canvas;
      if (!canvas) return;
      spawnEngine();
    },
    [spawnEngine],
  );

  useEffect(() => {
    return () => {
      if (engineRef.current) {
        engineRef.current.destroy();
        engineRef.current = null;
      }
    };
  }, []);

  const startGame = useCallback(() => {
    engineRef.current?.start(shipId);
    setPhase("playing");
  }, [shipId]);

  const startLevel = useCallback(
    (levelIndex: number) => {
      setActiveLevel(levelIndex);
      setStageClearInfo(null);
      engineRef.current?.start(shipId, { campaignLevel: levelIndex });
      setPhase("playing");
    },
    [shipId],
  );

  const togglePause = useCallback(() => {
    setPhase((prev) => {
      if (prev === "playing") {
        engineRef.current?.pause();
        return "paused";
      }
      if (prev === "paused") {
        engineRef.current?.resume();
        return "playing";
      }
      return prev;
    });
  }, []);

  const chooseUpgrade = useCallback((id: string) => {
    engineRef.current?.applyUpgrade(id);
    setUpgradeChoices([]);
    setPhase("playing");
  }, []);

  /** HUD 点击「强化点」：有存点时打开三选一（游戏暂停） */
  const openUpgradeDialog = useCallback(() => {
    engineRef.current?.openUpgrade();
  }, []);

  /** 三选一面板「暂不强化」：关闭并恢复游戏，强化点保留 */
  const closeUpgradeDialog = useCallback(() => {
    engineRef.current?.closeUpgrade();
  }, []);

  /** HUD 点击「爆弹」：引爆清屏炸弹（与 B 键同效） */
  const fireBomb = useCallback(() => {
    engineRef.current?.useBomb();
  }, []);

  const restartGame = useCallback(() => {
    engineRef.current?.start(shipId);
    setPhase("playing");
  }, [shipId]);

  /** 暂停菜单「重新开始」：按当前模式重开本局（关卡模式重开当前关） */
  const restartRun = useCallback(() => {
    if (mode === "campaign") startLevel(activeLevel);
    else restartGame();
  }, [mode, activeLevel, startLevel, restartGame]);

  /** 暂停菜单「返回主页」：停掉当前局并重建引擎，回到开始界面 */
  const quitToStart = useCallback(() => {
    spawnEngine();
    setPhase("start");
  }, [spawnEngine]);

  const openLevelSelect = useCallback(() => setPhase("levelselect"), []);
  const backToStart = useCallback(() => setPhase("start"), []);
  const gotoLevelSelect = useCallback(() => setPhase("levelselect"), []);

  const nextLevel = useCallback(() => {
    const cur = stageClearInfo?.levelIndex ?? activeLevel;
    if (cur < CAMPAIGN.length) startLevel(cur + 1);
    else setPhase("levelselect");
  }, [stageClearInfo, activeLevel, startLevel]);

  const retryLevel = useCallback(() => {
    startLevel(stageClearInfo?.levelIndex ?? activeLevel);
  }, [stageClearInfo, activeLevel, startLevel]);

  const retryFromGameOver = useCallback(() => {
    startLevel(lastResult.levelIndex || activeLevel);
  }, [lastResult.levelIndex, activeLevel, startLevel]);

  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      mutedRef.current = next;
      engineRef.current?.setMuted(next);
      return next;
    });
  }, []);

  const shipDef = SHIP_BY_ID[shipId];
  const shipLabel = `${shipDef.name} · ${shipDef.attack}`;
  const starTotal = sumStars(campaignProgress);
  const singularityUnlocked = isSingularityUnlocked(campaignProgress);
  const levelBest =
    mode === "campaign"
      ? (campaignProgress.records[activeLevel]?.best ?? 0)
      : bestScore;

  return {
    phase,
    score,
    bestScore,
    wave,
    hp,
    maxHp,
    progress,
    upgradePoints,
    combo,
    comboMul,
    bombCount,
    upgradeChoices,
    muted,
    lastResult,
    shipId,
    setShipId,
    shipLabel,
    singularityUnlocked,
    attachCanvas,
    startGame,
    togglePause,
    chooseUpgrade,
    openUpgradeDialog,
    closeUpgradeDialog,
    fireBomb,
    restartGame,
    restartRun,
    quitToStart,
    toggleMute,
    mode,
    setMode,
    campaignProgress,
    activeLevel,
    stageClearInfo,
    hudInfo,
    starTotal,
    levelBest,
    openLevelSelect,
    backToStart,
    gotoLevelSelect,
    startLevel,
    nextLevel,
    retryLevel,
    retryFromGameOver,
  };
}
