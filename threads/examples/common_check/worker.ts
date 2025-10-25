import { WASIFarmAnimal } from "../../src";

import { wait_async_polyfill } from "../../src/index.js";

wait_async_polyfill();

self.onmessage = async (e) => {
  const { wasi_ref } = e.data;

  const wasm = await WebAssembly.compileStreaming(fetch("./common.wasm"));

  const run = async (args: string[]) => {
    const wasi = new WASIFarmAnimal(
      wasi_ref,
      args, // args\
      [], // env
      {
        can_thread_spawn: true,
        thread_spawn_worker_url: new URL("./thread_spawn.ts", import.meta.url)
          .href,
        // thread_spawn_worker_url: "./thread_spawn.ts",
        thread_spawn_wasm: wasm,
        worker_background_worker_url: new URL(
          "./worker_background.ts",
          import.meta.url,
        ).href,
      },
    );

    await wasi.wait_worker_background_worker();

    try {
      const code = await wasi.async_start_on_thread();
      console.log(`"${args[0]}" exit code:`, code);
      return code;
    } catch (e) {
      console.error(`"${args[0]}" error:`, e);
      return "error";
    }
  };

  const code = await run(["unreachable"]);
  if (code !== "error") {
    throw new Error("unreachable test failed");
  }
  const code2 = await run(["unreachable_child"]);
  if (code2 !== "error") {
    throw new Error("exit test failed");
  }
  const code3 = await run(["exit", "42"]);
  if (code3 !== 42) {
    throw new Error("exit test failed");
  }
  const code4 = await run(["exit_child", "43"]);
  if (code4 !== 43) {
    throw new Error("exit test failed");
  }
  const code5 = await run(["panic"]);
  if (code5 !== "error") {
    throw new Error("panic test failed");
  }
  const code6 = await run(["panic_child"]);
  if (code6 !== "error") {
    throw new Error("panic test failed");
  }
  const code7 = await run(["ok"]);
  if (code7 !== 0) {
    throw new Error("ok test failed");
  }
  const code8 = await run(["ok_child"]);
  if (code8 !== 0) {
    throw new Error("ok test failed");
  }

  console.log("All tests passed");

  self.postMessage({ done: true });
};
