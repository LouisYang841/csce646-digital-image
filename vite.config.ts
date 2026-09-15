/** @type {import('vite').UserConfig} */
import { resolve } from "path";
import { defineConfig } from "vite";

// GitHub Pages 项目页部署在 https://<user>.github.io/<repo>/ 子路径下，
// 因此构建时需要把资源前缀改成 /<repo>/；本地开发不受影响（默认 /）。
// 仓库改名或部署到自定义域名时，只需改 CI 里的 BASE_PATH 环境变量。
const base = process.env.BASE_PATH ?? "/";

export default defineConfig({
  base,
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        pr01: resolve(__dirname, "pr01/index.html"),
        pr02: resolve(__dirname, "pr02/index.html"),
        pr03: resolve(__dirname, "pr03/index.html"),
      },
    },
  },
});
