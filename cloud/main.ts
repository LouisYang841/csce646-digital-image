import { renderShaderToy, setISpeed_, type UniformValue } from "../shared/shadertoy";
import landscapeSource from "./landscape-source";

// 云海 shader 用 iChannel0 的蓝噪声贴图生成云层，复用 pr01 那份。
// 相对路径按文档地址解析：/cloud/ → /pr01/blue_noise.png
const BLUE_NOISE_URL = "../pr01/blue_noise.png";

// 昼夜循环：太阳位置从 SUN_MIN 匀速涨到 SUN_MAX 再回卷。
// 超过 1.0 就已经在画面上沿之外了，shader 那边会据此把画面压暗。
const SUN_MIN = -1.0;
const SUN_MAX = 2.2;
const SUN_CYCLE = SUN_MAX - SUN_MIN; // 3.2
const SUN_CYCLE_SECONDS = 60; // 流动速度 = 1 时走完一个完整昼夜的秒数
const SUN_PER_SEC = SUN_CYCLE / SUN_CYCLE_SECONDS;
const SUN_START = 0.17; // 初值：此时 shader 的昼夜因子正好是 1.30，与原版一致

type ParamKey =
  | "sunPos"
  | "sunIntensity"
  | "cloudShape"
  | "noiseDetail"
  | "exposure"
  | "saturation"
  | "warmTemp"
  | "coolTemp"
  | "flowSpeed";

interface ParamDef {
  key: ParamKey;
  /** 对应的 shader uniform；不给说明这个参数不由 uniform 驱动 */
  uniform?: string;
  min: number;
  max: number;
  step: number;
  value: number;
  decimals: number;
  zh: string;
  en: string;
}

// 默认值全部取「恒等值」，保证一进页面看到的画面和原版（pr01）一致。
// 想调出参考图那种浓烈暖色，把「色调饱和度」拉到 1.9 左右即可。
const PARAMS: ParamDef[] = [
  { key: "sunPos", uniform: "uSunPos", min: SUN_MIN, max: SUN_MAX, step: 0.01, value: SUN_START, decimals: 2, zh: "太阳位置", en: "Sun Position" },
  { key: "sunIntensity", uniform: "uSunIntensity", min: 0, max: 1, step: 0.01, value: 0.0, decimals: 2, zh: "太阳强度", en: "Sun Intensity" },
  { key: "cloudShape", uniform: "uCloudShape", min: 0, max: 2, step: 0.01, value: 1.0, decimals: 2, zh: "云层形状", en: "Cloud Shape" },
  { key: "noiseDetail", uniform: "uNoiseDetail", min: 1, max: 10, step: 1, value: 8, decimals: 2, zh: "噪声细节", en: "Noise Detail" },
  { key: "exposure", uniform: "uExposure", min: 0, max: 3, step: 0.01, value: 1.0, decimals: 2, zh: "曝光度", en: "Exposure" },
  { key: "saturation", uniform: "uSaturation", min: 0, max: 2, step: 0.01, value: 1.0, decimals: 2, zh: "色调饱和度", en: "Saturation" },
  { key: "warmTemp", uniform: "uWarmTemp", min: -1, max: 1, step: 0.01, value: 0.0, decimals: 2, zh: "整体色温", en: "Color Temperature" },
  { key: "coolTemp", uniform: "uCoolTemp", min: 0, max: 1, step: 0.01, value: 0.5, decimals: 2, zh: "冷色调色温", en: "Cool Tone Temperature" },
  // 流动速度不传给 shader，直接调引擎的时间倍率（1 = 原版速度）
  { key: "flowSpeed", min: 0, max: 2, step: 0.01, value: 1.0, decimals: 2, zh: "流动速度", en: "Flow Speed" },
];

const TEXTS = {
  zh: { panel: "场景参数", reset: "重置", pause: "暂停", resume: "继续", toggle: "EN" },
  en: { panel: "SCENE PARAMETERS", reset: "RESET", pause: "PAUSE", resume: "RESUME", toggle: "中" },
};

const state = Object.fromEntries(PARAMS.map((p) => [p.key, p.value])) as Record<ParamKey, number>;
const defaults = { ...state };

let paused = false;
let lang: "zh" | "en" = "zh";
/** 用户正在拖「太阳位置」时不回写滑块，免得和自动递增打架 */
let draggingSun = false;
let lastFrameMs: number | null = null;
let lastUiSyncMs = 0;

interface Row {
  def: ParamDef;
  input: HTMLInputElement;
  label: HTMLElement;
  value: HTMLElement;
}

const rows = new Map<ParamKey, Row>();

const slidersEl = document.getElementById("sliders") as HTMLElement;
const panel = document.getElementById("panel") as HTMLElement;
const panelTitle = document.getElementById("panel-title") as HTMLElement;
const langToggle = document.getElementById("lang-toggle") as HTMLButtonElement;
const resetBtn = document.getElementById("reset") as HTMLButtonElement;
const pauseBtn = document.getElementById("pause") as HTMLButtonElement;
const panelToggle = document.getElementById("panel-toggle") as HTMLButtonElement;

function applySpeed(): void {
  setISpeed_(paused ? 0 : state.flowSpeed);
}

/** 太阳位置自动递增（暂停或流动速度为 0 时不动），走到头回卷 */
function advanceSun(now: number): void {
  if (lastFrameMs !== null && !paused) {
    const dt = (now - lastFrameMs) / 1000;
    state.sunPos += dt * state.flowSpeed * SUN_PER_SEC;
    if (state.sunPos > SUN_MAX) {
      state.sunPos -= SUN_CYCLE;
    }
  }
  lastFrameMs = now;
}

function setSunRow(value: number): void {
  const row = rows.get("sunPos");
  if (!row) return;
  row.input.value = String(value);
  row.value.textContent = value.toFixed(row.def.decimals);
}

/** 每帧被引擎调用，返回当前所有需要下发的 uniform */
function getUniforms(): Record<string, UniformValue> {
  const now = performance.now();
  advanceSun(now);

  // 滑块跟着太阳一起走（拖动过程中不覆盖用户的值）
  if (!draggingSun && now - lastUiSyncMs > 100) {
    lastUiSyncMs = now;
    setSunRow(state.sunPos);
  }

  const uniforms: Record<string, UniformValue> = {};
  for (const def of PARAMS) {
    if (def.uniform) {
      uniforms[def.uniform] = state[def.key];
    }
  }
  return uniforms;
}

function buildRows(): void {
  for (const def of PARAMS) {
    const row = document.createElement("div");
    row.className = "row";

    const top = document.createElement("div");
    top.className = "row-top";

    const label = document.createElement("span");
    label.className = "label";
    label.textContent = def[lang];

    const value = document.createElement("span");
    value.className = "value";
    value.textContent = state[def.key].toFixed(def.decimals);

    const input = document.createElement("input");
    input.type = "range";
    input.min = String(def.min);
    input.max = String(def.max);
    input.step = String(def.step);
    input.value = String(state[def.key]);
    input.setAttribute("aria-label", def.en);
    input.addEventListener("input", () => {
      state[def.key] = Number(input.value);
      value.textContent = Number(input.value).toFixed(def.decimals);
      if (def.key === "flowSpeed") {
        applySpeed();
      }
    });

    // 太阳位置会被自动改写，拖动期间得让用户说了算
    if (def.key === "sunPos") {
      input.addEventListener("pointerdown", () => {
        draggingSun = true;
      });
      input.addEventListener("change", () => {
        draggingSun = false;
      });
    }

    top.append(label, value);
    row.append(top, input);
    slidersEl.append(row);
    rows.set(def.key, { def, input, label, value });
  }
}

function resetParams(): void {
  for (const def of PARAMS) {
    state[def.key] = defaults[def.key];
    const row = rows.get(def.key)!;
    row.input.value = String(defaults[def.key]);
    row.value.textContent = defaults[def.key].toFixed(def.decimals);
  }
  applySpeed();
}

function refreshTexts(): void {
  const t = TEXTS[lang];
  panelTitle.textContent = t.panel;
  resetBtn.textContent = t.reset;
  pauseBtn.textContent = paused ? t.resume : t.pause;
  langToggle.textContent = t.toggle;
  for (const row of rows.values()) {
    row.label.textContent = row.def[lang];
  }
}

function togglePause(): void {
  paused = !paused;
  applySpeed();
  refreshTexts();
}

function togglePanel(): void {
  panel.classList.toggle("hidden");
}

function main(): void {
  buildRows();
  refreshTexts();

  resetBtn.addEventListener("click", resetParams);
  pauseBtn.addEventListener("click", togglePause);
  panelToggle.addEventListener("click", togglePanel);
  langToggle.addEventListener("click", () => {
    lang = lang === "zh" ? "en" : "zh";
    refreshTexts();
  });

  // 松开鼠标（不管在哪松）就交还给自动递增
  window.addEventListener("pointerup", () => {
    draggingSun = false;
  });

  // 空格键也能暂停
  window.addEventListener("keydown", (e) => {
    if (e.code === "Space") {
      e.preventDefault();
      togglePause();
    }
  });

  applySpeed();

  const canvas = document.getElementById("my-canvas") as HTMLCanvasElement;
  const loading = document.getElementById("loading") as HTMLElement;

  const blueNoise = new Image();
  blueNoise.src = BLUE_NOISE_URL;
  blueNoise.onload = () => {
    renderShaderToy(canvas, landscapeSource, [blueNoise], { getUniforms });
    loading.classList.add("done");
  };
  blueNoise.onerror = () => {
    loading.textContent = "贴图加载失败";
  };
}

main();
