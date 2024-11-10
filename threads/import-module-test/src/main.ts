import "./style.css";
import typescriptLogo from "./typescript.svg";
import viteLogo from "/vite.svg";
import { setupCounter } from "./counter.ts";

// biome-ignore lint/style/noNonNullAssertion: <explanation>
document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
  <div>
    <a href="https://vitejs.dev" target="_blank">
      <img src="${viteLogo}" class="logo" alt="Vite logo" />
    </a>
    <a href="https://www.typescriptlang.org/" target="_blank">
      <img src="${typescriptLogo}" class="logo vanilla" alt="TypeScript logo" />
    </a>
    <h1>Vite + TypeScript</h1>
    <div class="card">
      <button id="counter" type="button"></button>
    </div>
    <p class="read-the-docs">
      Click on the Vite and TypeScript logos to learn more
    </p>
  </div>
`;

// biome-ignore lint/style/noNonNullAssertion: <explanation>
setupCounter(document.querySelector<HTMLButtonElement>("#counter")!);

import { WASIFarm } from "@oligami/browser_wasi_shim-threads";

// Create a new WASI farm
const farm = new WASIFarm();
console.dir(farm, { depth: null });
