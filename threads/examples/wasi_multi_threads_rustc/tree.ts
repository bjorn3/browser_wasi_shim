import { SharedObject } from "@oligami/shared-object";
import { WASIFarmAnimal } from "../../src";

let inst: { exports: { memory: WebAssembly.Memory; _start: () => unknown } };
let wasi: WASIFarmAnimal;
let wasm: WebAssembly.Module;

let shared: SharedObject;

globalThis.onmessage = async (e) => {
  const { wasi_refs } = e.data;

  if (wasi_refs) {
    wasm = await WebAssembly.compileStreaming(fetch("./tre_opt.wasm"));

    wasi = new WASIFarmAnimal(
      wasi_refs,
      ["tre"], // args
      [], // env
    );

    // Memory is rewritten at this time.
    inst = (await WebAssembly.instantiate(wasm, {
      wasi_snapshot_preview1: wasi.wasiImport,
    })) as unknown as {
      exports: { memory: WebAssembly.Memory; _start: () => unknown };
    };

    const memory_reset = inst.exports.memory.buffer;
    const memory_reset_view = new Uint8Array(memory_reset).slice();

    shared = new SharedObject((...args) => {
      // If I don't reset memory, I get some kind of error.
      wasi.args = ["tre", ...args];
      const memory_view = new Uint8Array(inst.exports.memory.buffer);
      memory_view.set(memory_reset_view);
      wasi.start(inst);
    }, "tree");

    postMessage({ ready: true });
  }
};
