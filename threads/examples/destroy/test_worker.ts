import { WASIFarmAnimal } from "../../src";

// Test worker that runs eternal_loop.wasm and monitors its output
self.onmessage = async (e) => {
  const { wasi_ref, wasi_ref2 } = e.data;

  console.log("TestWorker: Loading eternal_loop.wasm");

  try {
    const wasmResponse = await fetch("./eternal_loop.wasm");
    const wasmBuffer = await wasmResponse.arrayBuffer();
    const wasm = await WebAssembly.compile(wasmBuffer);

    console.log("TestWorker: Creating WASIFarmAnimal with thread spawner");

    const wasi = new WASIFarmAnimal([wasi_ref2, wasi_ref], [], [], {
      can_thread_spawn: true,
      thread_spawn_worker_url: new URL("./thread_spawn.ts", import.meta.url)
        .href,
      thread_spawn_wasm: wasm,
      worker_background_worker_url: new URL(
        "./worker_background.ts",
        import.meta.url,
      ).href,
    });

    console.log("TestWorker: Waiting for background worker...");
    await wasi.wait_worker_background_worker();
    console.log("TestWorker: Background worker ready");

    const inst = await WebAssembly.instantiate(wasm, {
      env: {
        ...wasi.get_share_memory(),
      },
      wasi: wasi.wasiThreadImport,
      wasi_snapshot_preview1: wasi.wasiImport,
    });

    console.log("TestWorker: Starting eternal loop with threads");
    self.postMessage({ started: true });

    // Start WASM (runs forever with threads printing)
    setTimeout(() => {
      try {
        wasi.start(
          inst as unknown as {
            exports: { memory: WebAssembly.Memory; _start: () => unknown };
          },
        );
        console.log("TestWorker: WASM completed (unexpected!)");
      } catch (error) {
        console.log("TestWorker: WASM terminated (expected after destroy)");
      }
    }, 100);

    // Wait 5 seconds then destroy
    await new Promise((resolve) => setTimeout(resolve, 5000));

    console.log("TestWorker: Calling destroy() to terminate all threads...");
    wasi.destroy();
    console.log("TestWorker: destroy() completed - all threads terminated");

    self.postMessage({ destroyed: true });
  } catch (error) {
    console.error("TestWorker: Error:", error);
    self.postMessage({ error: String(error) });
  }
};
