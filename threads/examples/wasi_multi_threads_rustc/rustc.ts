import { SharedObject } from "@oligami/shared-object";
import { WASIFarmAnimal } from "../../src";

const { promise, resolve } = Promise.withResolvers();
import("@oligami/shared-object").then(resolve);

let wasi: WASIFarmAnimal;
let wasm: WebAssembly.Module;
let shared: SharedObject;

globalThis.onmessage = async (e) => {
  const { wasi_refs } = e.data;

  if (wasi_refs) {
    wasm = await WebAssembly.compileStreaming(
      fetch("./rust_wasm/rustc_llvm/rustc_opt.wasm"),
    );

    wasi = new WASIFarmAnimal(
      wasi_refs,
      [], // args
      ["RUST_MIN_STACK=16777216"], // env
      {
        // debug: true,
        can_thread_spawn: true,
        thread_spawn_worker_url: new URL("./thread_spawn.ts", import.meta.url)
          .href,
        // thread_spawn_worker_url: "./thread_spawn.ts",
        thread_spawn_wasm: wasm,
      },
    );

    await wasi.wait_worker_background_worker();

    wasi.get_share_memory().grow(200);

    console.log("Waiting for worker background worker...");

    await promise;

    shared = new SharedObject((...args) => {
      wasi.args = ["rustc", ...args];
      wasi.block_start_on_thread();
      console.log("wasi.start done");
    }, "rustc");

    postMessage({ ready: true });
  }
};
