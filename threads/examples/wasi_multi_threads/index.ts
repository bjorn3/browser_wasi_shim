import { WASIFarm, WASIFarmAnimal } from "../../src";
import {
  File,
  OpenFile,
  ConsoleStdout,
  PreopenDirectory,
} from "@bjorn3/browser_wasi_shim";

const farm = new WASIFarm(
  new OpenFile(new File([])), // stdin
  ConsoleStdout.lineBuffered((msg) => console.log(`[WASI stdout] ${msg}`)),
  ConsoleStdout.lineBuffered((msg) => console.warn(`[WASI stderr] ${msg}`)),
  [],
);

console.log(farm);

const worker = new Worker("worker.ts", { type: "module" });
// const worker = new Worker(new URL("./worker.js", import.meta.url).href, { type: "module" });

console.log(worker);

worker.postMessage({
  wasi_ref: farm.get_ref(),
});

console.log("Sent WASI ref to worker");
