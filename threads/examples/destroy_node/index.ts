// node --import @swc-node/register/esm-register --enable-source-maps index.ts

import { Worker } from "node:worker_threads";
import { ConsoleStdout, File, OpenFile } from "@bjorn3/browser_wasi_shim";
import { WASIFarm } from "../../src/index.ts";

console.log(
  "=== Testing WASIFarmAnimal.destroy() with BroadcastChannel ping/pong ===\n",
);
console.log("Test protocol:");
console.log("1. Send pings to thread workers and count unique responders");
console.log("2. Assert that thread workers exist (count > 0)");
console.log("3. Call destroy()");
console.log("4. Send pings again and count responders");
console.log("5. Assert that no thread workers respond (count = 0)\n");

const farm = new WASIFarm(
  // @ts-ignore
  new OpenFile(new File([])),
  ConsoleStdout.lineBuffered((msg) => console.log(`[WASI stdout] ${msg}`)),
  ConsoleStdout.lineBuffered((msg) => console.warn(`[WASI stderr] ${msg}`)),
  [],
);

const worker = new Worker("./destroy_node/worker.ts");

worker.postMessage({
  wasi_ref: farm.get_ref(),
});

worker.on("message", async (msg) => {
  if (msg.started) {
    console.log("✓ Eternal loop with threads started\n");

    // Wait a bit for threads to spawn
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Phase 1: Test pings BEFORE destroy
    console.log("=== Phase 1: Testing thread workers BEFORE destroy() ===");
    worker.postMessage({ command: "ping_before_destroy" });
  }

  if (msg.pongs_before_destroy !== undefined) {
    const liveThreads = msg.pongs_before_destroy;
    console.log(`✓ Counted ${liveThreads} unique thread workers responding`);

    if (liveThreads === 0) {
      console.error(
        "✗ ASSERTION FAILED: Expected thread workers to exist before destroy(), but found 0",
      );
      process.exit(1);
    }

    console.log(
      `✓ ASSERTION PASSED: ${liveThreads} thread workers are alive\n`,
    );

    // Phase 2: Call destroy()
    console.log("=== Phase 2: Calling destroy() ===");
    worker.postMessage({ command: "destroy" });
  }

  if (msg.destroyed) {
    console.log("✓ destroy() completed\n");

    // Wait a bit after destroy
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Phase 3: Test pings AFTER destroy
    console.log("=== Phase 3: Testing thread workers AFTER destroy() ===");
    worker.postMessage({ command: "ping_after_destroy" });
  }

  if (msg.pongs_after_destroy !== undefined) {
    const remainingThreads = msg.pongs_after_destroy;
    console.log(
      `✓ Counted ${remainingThreads} unique thread workers responding`,
    );

    if (remainingThreads > 0) {
      console.error(
        `✗ ASSERTION FAILED: Expected 0 thread workers after destroy(), but found ${remainingThreads}`,
      );
      process.exit(1);
    }

    console.log(
      `✓ ASSERTION PASSED: 0 thread workers remain after destroy()\n`,
    );

    console.log("=== TEST SUMMARY ===");
    console.log(
      `✓ Thread workers before destroy(): ${msg.pongs_before_destroy || 0}`,
    );
    console.log(`✓ Thread workers after destroy(): ${remainingThreads}`);
    console.log(
      `✓ TEST PASSED: destroy() successfully terminated all thread workers`,
    );

    worker.terminate();
    process.exit(0);
  }
});

worker.on("error", (error) => {
  console.error("Worker error:", error);
  process.exit(1);
});
