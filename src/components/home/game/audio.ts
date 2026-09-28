// Web Audio 合成音效（无外部音频文件）；猫叫优先用用户提供的猫咪录音（打包资源），加载失败回退合成喵声
import catMeowUrl from "@/assets/cat-meow.mp3";

let audioCtx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let isMuted = false;
let noiseBuf: AudioBuffer | null = null;
let laserOsc: OscillatorNode | null = null;
let laserLfo: OscillatorNode | null = null;
let laserGain: GainNode | null = null;
/** 猫咪录音解码后的 buffer；null = 尚未加载或加载失败（回退合成喵声） */
let meowBuf: AudioBuffer | null = null;
let meowLoading = false;

// ---- 芯片风 BGM：16 步循环 sequencer（方波贝斯 + 双小节交替琶音 + 噪声鼓），前瞻调度 ----
const BGM_BPM = 140;
const BGM_STEP = 60 / BGM_BPM / 4;
/** 半音相对 A2(110Hz) 转频率 */
function nf(semi: number): number {
  return 110 * Math.pow(2, semi / 12);
}
/** 贝斯线（A 小调驱动型，偶数步落音） */
const BASS_SEQ: (number | null)[] = [
  0, null, 0, null, 3, null, 3, null, 0, null, 0, null, -2, null, 5, null,
];
/** 主音琶音：第 1 小节 Am / 第 2 小节 G 交替 */
const LEAD_A: (number | null)[] = [
  24, null, 27, null, 31, null, 36, null, 31, null, 27, null, 24, null, 27,
  null,
];
const LEAD_B: (number | null)[] = [
  22, null, 26, null, 29, null, 34, null, 29, null, 26, null, 22, null, 26,
  null,
];
let bgmGain: GainNode | null = null;
let bgmTimer: ReturnType<typeof setInterval> | null = null;
let bgmStep = 0;
let bgmNext = 0;

function bgmNote(
  freq: number,
  t0: number,
  dur: number,
  vol: number,
  type: OscillatorType,
) {
  const ac = audioCtx;
  if (!ac || !bgmGain) return;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g);
  g.connect(bgmGain);
  osc.start(t0);
  osc.stop(t0 + dur + 0.03);
}

function bgmTick() {
  const ac = audioCtx;
  if (!ac || !bgmGain) return;
  // 前瞻 0.15s 排程，避免定时器抖动产生空隙
  while (bgmNext < ac.currentTime + 0.15) {
    const s = bgmStep % 16;
    const bar = Math.floor(bgmStep / 16) % 2;
    const t = bgmNext;
    const b = BASS_SEQ[s];
    if (b !== null) bgmNote(nf(b), t, BGM_STEP * 1.8, 0.055, "square");
    const l = (bar === 0 ? LEAD_A : LEAD_B)[s];
    if (l !== null) bgmNote(nf(l), t, BGM_STEP * 0.9, 0.028, "square");
    if (s % 8 === 0) tone(130, 0.12, "sine", 0.09, 45, t - ac.currentTime);
    if (s === 4 || s === 12) noiseBurst(0.08, 0.045, t - ac.currentTime);
    if (s % 2 === 1) noiseBurst(0.03, 0.014, t - ac.currentTime);
    bgmNext += BGM_STEP;
    bgmStep += 1;
  }
}

function ensureCatMeow() {
  if (meowBuf || meowLoading) return;
  meowLoading = true;
  fetch(catMeowUrl)
    .then((r) =>
      r.ok ? r.arrayBuffer() : Promise.reject(new Error("meow fetch failed")),
    )
    .then((ab) => {
      const ac = ctxNow();
      if (!ac) return Promise.reject(new Error("no audio ctx"));
      return ac.decodeAudioData(ab);
    })
    .then((buf) => {
      meowBuf = buf;
    })
    .catch(() => {
      /* 加载失败保持合成喵声 */
    });
}

function ctxNow(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (!audioCtx) {
      const AC =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AC) return null;
      audioCtx = new AC();
      masterGain = audioCtx.createGain();
      masterGain.gain.value = isMuted ? 0 : 0.5;
      masterGain.connect(audioCtx.destination);
    }
    if (audioCtx.state === "suspended") void audioCtx.resume();
    return audioCtx;
  } catch {
    return null;
  }
}

function tone(
  freq: number,
  dur: number,
  type: OscillatorType,
  vol: number,
  slideTo?: number,
  delay = 0,
) {
  const ac = ctxNow();
  if (!ac || !masterGain) return;
  const t0 = ac.currentTime + delay;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + dur);
  }
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g);
  g.connect(masterGain);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

function noiseBurst(dur: number, vol: number, delay = 0) {
  const ac = ctxNow();
  if (!ac || !masterGain) return;
  const t0 = ac.currentTime + delay;
  if (!noiseBuf) {
    noiseBuf = ac.createBuffer(1, Math.floor(ac.sampleRate * 0.5), ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const src = ac.createBufferSource();
  src.buffer = noiseBuf;
  const filt = ac.createBiquadFilter();
  filt.type = "lowpass";
  filt.frequency.value = 1400;
  const g = ac.createGain();
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filt);
  filt.connect(g);
  g.connect(masterGain);
  src.start(t0);
  src.stop(t0 + dur + 0.05);
}

export const sfx = {
  setMuted(m: boolean) {
    isMuted = m;
    if (masterGain) masterGain.gain.value = m ? 0 : 0.5;
  },
  /** 芯片风 BGM 开关：战斗中开、暂停/结算/主页关，随静音总开关静音 */
  setBgm(on: boolean) {
    const ac = ctxNow();
    if (!ac || !masterGain) return;
    if (on) {
      if (bgmTimer) return;
      if (!bgmGain) {
        bgmGain = ac.createGain();
        bgmGain.gain.value = 0.5;
        bgmGain.connect(masterGain);
      }
      bgmStep = 0;
      bgmNext = ac.currentTime + 0.06;
      bgmTimer = setInterval(bgmTick, 40);
    } else if (bgmTimer) {
      clearInterval(bgmTimer);
      bgmTimer = null;
    }
  },
  shoot() {
    tone(760, 0.07, "square", 0.045, 380);
  },
  explosion() {
    noiseBurst(0.3, 0.22);
    tone(150, 0.25, "sawtooth", 0.1, 50);
  },
  hit() {
    tone(200, 0.18, "square", 0.14, 90);
  },
  shieldBlock() {
    tone(620, 0.12, "triangle", 0.14, 980);
  },
  upgrade() {
    tone(523, 0.1, "square", 0.09, undefined, 0);
    tone(659, 0.1, "square", 0.09, undefined, 0.09);
    tone(880, 0.16, "square", 0.09, undefined, 0.18);
  },
  gameOver() {
    tone(392, 0.2, "square", 0.1, undefined, 0);
    tone(294, 0.2, "square", 0.1, undefined, 0.18);
    tone(196, 0.45, "square", 0.1, undefined, 0.36);
  },
  start() {
    ensureCatMeow();
    tone(330, 0.14, "square", 0.09, 990);
  },
  waveAlert() {
    tone(440, 0.12, "square", 0.08, undefined, 0);
    tone(660, 0.14, "square", 0.08, undefined, 0.12);
  },
  missile() {
    tone(280, 0.2, "sawtooth", 0.05, 880);
  },
  crit() {
    tone(1150, 0.06, "square", 0.06, 1750);
    tone(1750, 0.08, "square", 0.045, undefined, 0.045);
  },
  /** 狙击机蓄力：1.2s 上升音，配合红色瞄准线 */
  sniperCharge() {
    tone(320, 1.15, "sine", 0.055, 1250);
  },
  /** 自爆蜂群机爆炸：低频轰鸣 + 长噪声 */
  kamikazeBoom() {
    noiseBurst(0.4, 0.3);
    tone(110, 0.35, "sawtooth", 0.16, 35);
  },
  /** Boss 大招/阶段切换前的短蓄力 */
  bossCharge() {
    tone(220, 0.5, "sine", 0.07, 760);
  },
  /** Boss 阶段切换：低沉轰鸣 + 上行警示音 */
  bossPhase() {
    noiseBurst(0.3, 0.16);
    tone(160, 0.3, "square", 0.12, 480);
    tone(480, 0.28, "square", 0.1, 920, 0.24);
  },
  /** 补给母机治疗 */
  heal() {
    tone(660, 0.12, "triangle", 0.08, 990);
  },
  /** 关卡通关：上行凯旋琶音 */
  stageClear() {
    tone(523, 0.12, "square", 0.09, undefined, 0);
    tone(659, 0.12, "square", 0.09, undefined, 0.11);
    tone(784, 0.12, "square", 0.09, undefined, 0.22);
    tone(1046, 0.3, "square", 0.1, undefined, 0.33);
  },
  /** 解锁新关卡：短促星光音 */
  unlock() {
    tone(880, 0.1, "triangle", 0.08, 1320);
    tone(1320, 0.16, "triangle", 0.07, 1760, 0.09);
  },
  /** 拾取道具：清脆短哔 */
  pickup() {
    tone(920, 0.07, "square", 0.07, 1380);
  },
  /** 火力全开启动：双段上行力量音 */
  overdrive() {
    tone(392, 0.12, "square", 0.09, 784);
    tone(784, 0.2, "square", 0.08, 1176, 0.1);
  },
  /** 时间裂隙启动：下行扭曲音 */
  timeShift() {
    tone(1250, 0.42, "sine", 0.075, 210);
    tone(620, 0.3, "triangle", 0.05, 160, 0.05);
  },
  /** 奇点湮灭冲击环释放：低频脉冲 */
  ringPulse() {
    tone(170, 0.24, "sine", 0.09, 430);
    noiseBurst(0.12, 0.05);
  },
  /** 幻影闪烁瞬移：快速上行扫频 + 余音回落 */
  blink() {
    tone(420, 0.16, "triangle", 0.08, 1500);
    tone(1500, 0.1, "sine", 0.05, 520, 0.08);
  },
  /** 重狱弹幕墙推出：低频厚重撞击 */
  wallLaunch() {
    noiseBurst(0.18, 0.14);
    tone(140, 0.22, "square", 0.1, 60);
  },
  /** 蜂巢大型追踪弹发射：下行摇摆音 */
  homingLaunch() {
    tone(520, 0.3, "sawtooth", 0.06, 180);
    tone(260, 0.24, "triangle", 0.05, 320, 0.06);
  },
  /** 连击里程碑（10/25/50）：上行提示音 */
  comboMilestone() {
    tone(660, 0.08, "square", 0.07, 990);
    tone(990, 0.13, "square", 0.06, 1320, 0.07);
  },
  /** 猫咪机型「三月」技能：优先播放用户猫咪录音；录音未就绪时回退合成喵叫（滑音 + 共振峰带通） */
  meow() {
    const ac = ctxNow();
    if (!ac || !masterGain) return;
    if (meowBuf) {
      const src = ac.createBufferSource();
      src.buffer = meowBuf;
      const g = ac.createGain();
      g.gain.value = 0.9;
      src.connect(g);
      g.connect(masterGain);
      src.start();
      return;
    }
    ensureCatMeow();
    const t0 = ac.currentTime;
    try {
      const osc = ac.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(520, t0);
      osc.frequency.exponentialRampToValueAtTime(840, t0 + 0.14);
      osc.frequency.exponentialRampToValueAtTime(430, t0 + 0.42);
      const formant = ac.createBiquadFilter();
      formant.type = "bandpass";
      formant.frequency.setValueAtTime(900, t0);
      formant.frequency.exponentialRampToValueAtTime(1500, t0 + 0.14);
      formant.frequency.exponentialRampToValueAtTime(800, t0 + 0.42);
      formant.Q.value = 6;
      const g = ac.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.12, t0 + 0.05);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.45);
      osc.connect(formant);
      formant.connect(g);
      g.connect(masterGain);
      osc.start(t0);
      osc.stop(t0 + 0.5);
    } catch {
      /* 音频不可用时静默 */
    }
  },
  /** 激光持续音：短循环嗡鸣（受静音总开关控制） */
  setLaser(on: boolean) {
    const ac = ctxNow();
    if (!ac || !masterGain) return;
    if (on) {
      if (laserOsc) return;
      try {
        laserOsc = ac.createOscillator();
        laserOsc.type = "sawtooth";
        laserOsc.frequency.value = 96;
        laserLfo = ac.createOscillator();
        laserLfo.type = "sine";
        laserLfo.frequency.value = 7;
        const lfoGain = ac.createGain();
        lfoGain.gain.value = 14;
        laserLfo.connect(lfoGain);
        lfoGain.connect(laserOsc.frequency);
        laserGain = ac.createGain();
        laserGain.gain.value = 0.03;
        laserOsc.connect(laserGain);
        laserGain.connect(masterGain);
        laserOsc.start();
        laserLfo.start();
      } catch {
        laserOsc = null;
        laserLfo = null;
        laserGain = null;
      }
    } else {
      try {
        laserOsc?.stop();
        laserLfo?.stop();
      } catch {
        /* 已停止 */
      }
      try {
        laserOsc?.disconnect();
        laserLfo?.disconnect();
        laserGain?.disconnect();
      } catch {
        /* noop */
      }
      laserOsc = null;
      laserLfo = null;
      laserGain = null;
    }
  },
};
