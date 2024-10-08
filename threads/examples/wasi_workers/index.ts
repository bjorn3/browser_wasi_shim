import {
  OpenFile,
  File,
  ConsoleStdout,
  PreopenDirectory,
  type Inode,
  Directory,
} from "@bjorn3/browser_wasi_shim";
import { WASIFarm } from "../../src";

const worker = new Worker("./worker.ts", { type: "module" });
worker.onmessage = (event) => {
  const { wasi_ref: wasi_ref2 } = event.data;

  (async () => {
    const current_directory = new Map<string, Inode>();
    current_directory.set(
      "hello.txt",
      new File(new TextEncoder().encode("Hello, world!")),
    );
    current_directory.set("hello2", new Directory(new Map()));

    const wasi_farm = new WASIFarm(
      new OpenFile(new File([])), // stdin
      ConsoleStdout.lineBuffered((msg) =>
        console.log(`[WASI stdout on main thread] ${msg}`),
      ),
      ConsoleStdout.lineBuffered((msg) => console.warn(`[WASI stderr] ${msg}`)),
      [new PreopenDirectory(".", current_directory)],
    );
    console.log("WASI farm created");
    const wasi_ref = await wasi_farm.get_ref();

    const myWorker1 = new Worker("./worker1.ts", { type: "module" });
    myWorker1.postMessage({ wasi_ref, wasi_ref2 });
    const myWorker2 = new Worker("./worker2.ts", { type: "module" });
    myWorker2.postMessage({ wasi_ref, wasi_ref2 });
    const myWorker3 = new Worker("./worker3.ts", { type: "module" });
    myWorker3.postMessage({ wasi_ref, wasi_ref2 });
  })();
};
