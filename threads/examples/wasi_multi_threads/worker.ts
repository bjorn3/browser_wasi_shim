import { WASIFarmAnimal } from "../../src";

self.onmessage = async (e) => {
  const { wasi_ref } = e.data;

  const wasm = await WebAssembly.compileStreaming(
    fetch("./multi_thread_echo.wasm"),
  );

  const wasi = new WASIFarmAnimal(
    wasi_ref,
    [], // args
    [], // env
    {
      can_thread_spawn: true,
      thread_spawn_worker_url: new URL("./thread_spawn.ts", import.meta.url)
        .href,
      thread_spawn_wasm: wasm,
    },
  );

  await wasi.wait_worker_background_worker();

  const inst = await WebAssembly.instantiate(wasm, {
    env: {
      memory: wasi.get_share_memory(),
    },
    wasi: wasi.wasiThreadImport,
    wasi_snapshot_preview1: wasi.wasiImport,
  });

  wasi.start(
    inst as unknown as {
      exports: { memory: WebAssembly.Memory; _start: () => unknown };
    },
  );
};
