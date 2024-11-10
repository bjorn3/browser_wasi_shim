import {
  ConsoleStdout,
  type Inode,
  PreopenDirectory,
  File,
} from "@bjorn3/browser_wasi_shim";
import { WASIFarm } from "../../src";

const dir = new Map<string, Inode>();
dir.set("hello2.txt", new File(new TextEncoder().encode("Hello, world!!!!!")));

const wasi_farm = new WASIFarm(
  undefined,
  ConsoleStdout.lineBuffered((msg) =>
    console.log(`[WASI stdout on worker] ${msg}`),
  ),
  undefined,
  [new PreopenDirectory("hello2", dir)],
);

console.log("WASI farm created");
const wasi_ref = await wasi_farm.get_ref();
self.postMessage({ wasi_ref });
