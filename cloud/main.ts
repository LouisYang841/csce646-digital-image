import { renderShaderToy, setISpeed_, type UniformValue } from "../shared/shadertoy";
import landscapeSource from "./landscape-source";

// 云海 shader 用 iChannel0 的蓝噪声贴图生成云层，复用 pr01 那份。
// 相对路径按文档地址解析：/cloud/ → /pr01/blue_noise.png
const BLUE_NOISE_URL = "../pr01/blue_noise.png";

type ParamKey =
  | "sunPos"
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

// 默认值取自参考面板
const PARAMS: ParamDef[] = [
  { key: "sunPos", uniform: "uSunPos", min: -1, max: 1, step: 0.01, value: 0.17, decimals: 2, zh: "太阳位置", en: "Sun Position" },
  { key: "cloudShape", uniform: "uCloudShape", min: 0, max: 2, step: 0.01, value: 1.0, decimals: 2, zh: "云层形状", en: "Cloud Shape" },
  { key: "noiseDetail", uniform: "uNoiseDetail", min: 1, max: 10, step: 1, value: 7, decimals: 2, zh: "噪声细节", en: "Noise Detail" },
  { key: "exposure", uniform: "uExposure", min: 0, max: 3, step: 0.01, value: 1.0, decimals: 2, zh: "曝光度", en: "Exposure" },
  { key: "saturation", uniform: "uSaturation", min: 0, max: 2, step: 0.01, value: 1.95, decimals: 2, zh: "色调饱和度", en: "Saturation" },
  { key: "warmTemp", uniform: "uWarmTemp", min: -1, max: 1, step: 0.01, value: 0.0, decimals: 2, zh: "整体色温", en: "Color Temperature" },
  { key: "coolTemp", uniform: "uCoolTemp", min: 0, max: 1, step: 0.01, value: 0.51, decimals: 2, zh: "冷色调色温", en: "Cool Tone Temperature" },
  // 流动速度不传给 shader，直接调引擎的时间倍率
  { key: "flowSpeed", min: 0, max: 2, step: 0.01, value: 0.55, decimals: 2, zh: "流动速度", en: "Flow Speed" },
];

const TEXTS = {
  zh: { panel: "场景参数", reset: "重置", pause: "暂停", resume: "继续", toggle: "EN" },
  en: { panel: "SCENE PARAMETERS", reset: "RESET", pause: "PAUSE", resume: "RESUME", toggle: "中" },
};

const state = Object.fromEntries(PARAMS.map((p) => [p.key, p.value])) as Record<ParamKey, number>;
const defaults = { ...state };

let paused = false;
let lang: "zh" | "en" = "zh";

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

/** 每帧被引擎调用，返回当前所有需要下发的 uniform */
function getUniforms(): Record<string, UniformValue> {
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
