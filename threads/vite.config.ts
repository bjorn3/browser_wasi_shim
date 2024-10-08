// https://zenn.dev/seapolis/articles/3605c4befc8465

import { resolve } from "node:path";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";
import swc from "unplugin-swc";

export default defineConfig({
  server: {
    headers: {
      "Cross-Origin-Embedder-Policy": "require-corp",
      "Cross-Origin-Opener-Policy": "same-origin",
    },
  },
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      name: "wasi-shim-threads",
      formats: ["es", "umd", "cjs"],
      fileName: (format) => `browser-wasi-shim-threads.${format}.js`,
    },
    sourcemap: true,
    minify: true,
    copyPublicDir: false,
  },
  //   plugins: [dts({ rollupTypes: true })],
  plugins: [swc.vite(), swc.rollup(), dts({ rollupTypes: true })],
});
