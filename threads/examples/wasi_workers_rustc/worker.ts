import { strace } from "@bjorn3/browser_wasi_shim";
import { WASIFarmAnimal } from "../../src";

console.log("worker.js");

globalThis.onmessage = async (e) => {
  const wasm = await WebAssembly.compileStreaming(
    fetch(
      "../wasi_multi_threads_rustc/rust_wasm/rustc_cranelift/rustc_opt.wasm",
    ),
  );

  console.log("worker.js onmessage", e.data);

  const { wasi_ref } = e.data;

  const args = [
    "rustc",
    "/hello.rs",
    "--sysroot",
    "/sysroot",
    "--target",
    "x86_64-unknown-linux-gnu",
    "-Cpanic=abort",
    "-Ccodegen-units=1",
  ];
  const env = ["RUSTC_LOG=info"];

  console.log("wasi_ref", wasi_ref);

  const w = new WASIFarmAnimal(wasi_ref, args, env, {});

  let next_thread_id = 1;

  const inst = (await WebAssembly.instantiate(wasm, {
    env: {
      memory: new WebAssembly.Memory({
        initial: 256,
        maximum: 16384,
        shared: true,
      }),
    },
    wasi: {
      "thread-spawn": (start_arg) => {
        console.log("thread-spawn", start_arg);

        const thread_id = next_thread_id++;
        inst.exports.wasi_thread_start(thread_id, start_arg);
        return thread_id;
      },
    },
    wasi_snapshot_preview1: strace(w.wasiImport, ["fd_prestat_get"]),
  })) as unknown as {
    exports: {
      wasi_thread_start: (thread_id: number, start_arg: number) => void;
      memory: WebAssembly.Memory;
      _start: () => unknown;
    };
  };

  postMessage({
    term: "\x1B[93mExecuting\x1B[0m",
  });
  console.log(inst.exports);
  try {
    w.start(inst);
  } catch (e) {
    postMessage({
      term: `Exception: ${e.message}`,
    });
    // /*term.writeln("backtrace:"); term.writeln(e.stack);*/
  }
  postMessage({
    term: "\x1B[92mDone\x1B[0m",
  });
};
