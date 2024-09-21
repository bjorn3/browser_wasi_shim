import { WASIFarmAnimal } from "../../dist/index.js";

self.onmessage = async (e) => {
  const { wasi_ref } = e.data;

  const wasm = await WebAssembly.compileStreaming(fetch("./channel.wasm"));

  const wasi = new WASIFarmAnimal(
    wasi_ref,
    [], // args
    [], // env
    {
      debug: true,
      can_thread_spawn: true,
      thread_spawn_worker_url: (new URL("./thread_spawn.js", import.meta.url)).href,
      // thread_spawn_worker_url: "./thread_spawn.js",
      thread_spawn_wasm: wasm,
    }
  );

  await wasi.wait_worker_background_worker();

  let inst = await WebAssembly.instantiate(wasm, {
      "env": {
        memory: wasi.get_share_memory(),
      },
      "wasi": wasi.wasiThreadImport,
      "wasi_snapshot_preview1": wasi.wasiImport,
  });

  wasi.start(inst);
}
