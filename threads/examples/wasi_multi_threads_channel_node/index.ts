// node --import @swc-node/register/esm-register --enable-source-maps index.ts
// npx ts-node index.ts

import { Worker } from "node:worker_threads";
import { ConsoleStdout, File, OpenFile } from "@bjorn3/browser_wasi_shim";
import { WASIFarm } from "../../src/index.ts";

const farm = new WASIFarm(
  // @ts-ignore
  new OpenFile(new File([])), // stdin
  ConsoleStdout.lineBuffered((msg) => console.log(`[WASI stdout] ${msg}`)),
  ConsoleStdout.lineBuffered((msg) => console.warn(`[WASI stderr] ${msg}`)),
  [],
);

const worker = new Worker("./worker.ts");

worker.postMessage({
  wasi_ref: farm.get_ref(),
});
