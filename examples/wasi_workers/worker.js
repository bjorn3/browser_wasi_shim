
import { File, OpenFile, ConsoleStdout, PreopenDirectory, WASIFarm } from "../../dist/index.js";

let wasi_farm;
(async () => {
  wasi_farm = new WASIFarm(
    undefined,
    ConsoleStdout.lineBuffered(msg => console.log(`[WASI stdout on worker] ${msg}`)),
    undefined,
    [
      new PreopenDirectory("hello2", [
        ["hello2.txt", new File(new TextEncoder().encode("Hello, world!!!!!"))],
      ]),
    ],
    { debug: true },
  );
  console.log("WASI farm created");
  let wasi_ref = await wasi_farm.get_ref();
  self.postMessage({ wasi_ref });
})();
