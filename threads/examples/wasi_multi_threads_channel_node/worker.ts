import { set_fake_worker } from "./common.ts";
import { readFileSync } from "node:fs";
import { Worker, isMainThread, parentPort } from "node:worker_threads";
import { WASIFarmAnimal } from "../../src/index.ts";
import { exit } from "node:process";

set_fake_worker();

parentPort.on("message", async (e) => {
  const { wasi_ref } = e;

  const wasm = await WebAssembly.compile(
    readFileSync("./channel.wasm") as BufferSource,
  );

  const wasi = new WASIFarmAnimal(
    wasi_ref,
    [], // args
    [], // env
    {
      can_thread_spawn: true,
      thread_spawn_worker_url: "./thread_spawn.ts",
      thread_spawn_wasm: wasm,
      worker_background_worker_url: "./worker_background_worker.ts",
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

  exit(0);
});
