import { OpenFile, File, ConsoleStdout } from "@bjorn3/browser_wasi_shim";
import { WASIFarm } from "../../src";

const farm = new WASIFarm(
  new OpenFile(new File([])), // stdin
  ConsoleStdout.lineBuffered((msg) => console.log(`[WASI stdout] ${msg}`)),
  ConsoleStdout.lineBuffered((msg) => console.warn(`[WASI stderr] ${msg}`)),
  [],
);

const worker = new Worker("./worker.ts", { type: "module" });

worker.postMessage({
  wasi_ref: farm.get_ref(),
});
