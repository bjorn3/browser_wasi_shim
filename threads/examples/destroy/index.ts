import {
  OpenFile,
  File,
  ConsoleStdout,
  PreopenDirectory,
  type Inode,
  Directory,
} from "@bjorn3/browser_wasi_shim";
import { WASIFarm } from "../../src";

const outputEl = document.getElementById("output") as HTMLPreElement;
const runBtn = document.getElementById("run-test") as HTMLButtonElement;

function log(msg: string) {
  console.log(msg);
  outputEl.textContent += msg + "\n";
}

runBtn.addEventListener("click", async () => {
  outputEl.textContent = "";

  log("=== Testing WASIFarmAnimal.destroy() ===\n");
  log("This test runs eternal_loop.wasm with threads.");
  log("Watch the console output - it should stop after destroy() is called.\n");

  const worker = new Worker("./worker.ts", { type: "module" });

  worker.onmessage = async (event) => {
    if (event.data.wasi_ref) {
      const wasi_ref2 = event.data.wasi_ref;
      log("✓ Worker initialized");

      const current_directory = new Map<string, Inode>();
      current_directory.set(
        "hello.txt",
        new File(new TextEncoder().encode("Hello, world!")),
      );
      current_directory.set("hello2", new Directory(new Map()));

      const wasi_farm = new WASIFarm(
        new OpenFile(new File([])),
        ConsoleStdout.lineBuffered((msg) => log(`[WASI stdout] ${msg}`)),
        ConsoleStdout.lineBuffered((msg) => log(`[WASI stderr] ${msg}`)),
        [new PreopenDirectory(".", current_directory)],
      );
      log("✓ WASI farm created");

      const wasi_ref = await wasi_farm.get_ref();
      log("✓ WASI ref obtained\n");

      const testWorker = new Worker("./test_worker.ts", { type: "module" });

      testWorker.onmessage = (e) => {
        if (e.data.started) {
          log("✓ Eternal loop with threads started");
          log("✓ Check console - you should see thread output");
          log("✓ Waiting 5 seconds before calling destroy()...\n");
        }

        if (e.data.destroyed) {
          log("\n✓ destroy() called");
          log("✓ All threads should now be terminated");
          log("✓ Check console - thread output should have stopped\n");

          setTimeout(() => {
            log("✓ TEST COMPLETED");
            log(
              "  If thread output stopped in console after destroy(), the test passed!",
            );
          }, 2000);
        }

        if (e.data.error) {
          log(`✗ Error: ${e.data.error}`);
        }
      };

      testWorker.postMessage({ wasi_ref, wasi_ref2 });
      log("✓ Test worker started\n");
    }
  };
});
