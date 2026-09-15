import { renderShaderToy, setISpeed_ } from "../shared/shadertoy";
import mainImageSource from "../pr01/main-image-source";

// 云海 shader 用 iChannel0 的蓝噪声贴图生成云层，
// 这里直接复用 pr01 那份，不再往仓库里塞一份 4MB 的图。
// 相对路径按文档地址解析：/cloud/ → /pr01/blue_noise.png
const BLUE_NOISE_URL = "../pr01/blue_noise.png";

// pr03 的引擎带一个速度倍率（默认 5 倍），
// pr01 原来是用原始 iTime 跑的，这里设回 1 倍保持同样的观感。
setISpeed_(1.0);

const canvas = document.getElementById("my-canvas") as HTMLCanvasElement;

const blueNoise = new Image();
blueNoise.src = BLUE_NOISE_URL;
blueNoise.onload = () => {
  renderShaderToy(canvas, mainImageSource, [blueNoise]);
};
