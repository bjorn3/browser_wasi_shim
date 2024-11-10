import { strace } from "@bjorn3/browser_wasi_shim";
import { WASIFarmAnimal } from "../../src";
import { SharedObject } from "@oligami/shared-object";

let wasi: WASIFarmAnimal;
let inst: {
  exports: { memory: WebAssembly.Memory; _start: () => unknown };
};
let wasm: WebAssembly.Module;

let shared_clang: SharedObject;
let shared_tools: SharedObject;
let shared_wasm_ld: SharedObject;

globalThis.onmessage = async (e) => {
  const { wasi_refs } = e.data;

  if (wasi_refs) {
    wasm = await WebAssembly.compileStreaming(
      fetch("./rust_wasm/llvm-tools/llvm-opt.wasm"),
    );

    wasi = new WASIFarmAnimal(
      wasi_refs,
      ["llvm"], // args
      [], // env
    );

    // Memory is rewritten at this time.
    // inst = await WebAssembly.instantiate(wasm, {
    // 	wasi_snapshot_preview1: wasi.wasiImport,
    // });
    inst = (await WebAssembly.instantiate(wasm, {
      wasi_snapshot_preview1: strace(wasi.wasiImport, []),
    })) as unknown as {
      exports: { memory: WebAssembly.Memory; _start: () => unknown };
    };

    console.log("wasi.start, inst", inst);

    const memory_reset = inst.exports.memory.buffer;
    const memory_reset_view = new Uint8Array(memory_reset).slice();

    shared_clang = new SharedObject((...args) => {
      console.log("clang args", args);
      // If I don't reset memory, I get some kind of error.
      wasi.args = ["llvm", "clang", ...args];
      const memory_view = new Uint8Array(inst.exports.memory.buffer);
      memory_view.set(memory_reset_view);
      wasi.start(inst);
      console.log("clang wasi.start done");
    }, "clang");

    shared_tools = new SharedObject((...args) => {
      console.log("tools args", args);
      // If I don't reset memory, I get some kind of error.
      wasi.args = ["llvm-tools", ...args];
      const memory_view = new Uint8Array(inst.exports.memory.buffer);
      memory_view.set(memory_reset_view);
      wasi.start(inst);
      console.log("tools wasi.start done");
    }, "llvm-tools");

    shared_wasm_ld = new SharedObject((...args) => {
      console.log("wasm-ld args", args);
      // If I don't reset memory, I get some kind of error.
      wasi.args = ["llvm-tools", "wasm-ld", ...args];
      const memory_view = new Uint8Array(inst.exports.memory.buffer);
      memory_view.set(memory_reset_view);
      wasi.start(inst);
      console.log("wasm-ld wasi.start done");
    }, "wasm-ld");

    postMessage({ ready: true });
  }
};
