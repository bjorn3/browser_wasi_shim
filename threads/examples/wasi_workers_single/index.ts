import {
  OpenFile,
  File,
  WASI,
  ConsoleStdout,
  PreopenDirectory,
} from "@bjorn3/browser_wasi_shim";

// sleep 1000
await new Promise((resolve) => setTimeout(resolve, 1000));

const toMap = (arr: Array<[string, File]>) => new Map<string, File>(arr);

const wasi = new WASI(
  ["echo_and_rewrite", "hello.txt", "world", "new_world"], // args
  ["FOO=bar"], // env
  [
    new OpenFile(new File([])), // stdin
    ConsoleStdout.lineBuffered((msg) => console.log(`[WASI stdout] ${msg}`)),
    ConsoleStdout.lineBuffered((msg) => console.warn(`[WASI stderr] ${msg}`)),
    new PreopenDirectory(
      ".",
      toMap([
        ["hello.txt", new File(new TextEncoder().encode("Hello, world!"))],
      ]),
    ),
  ],
  { debug: true },
);
const wasm = await fetch("./echo_and_rewrite.wasm");
const buff = await wasm.arrayBuffer();
const { instance } = await WebAssembly.instantiate(buff, {
  wasi_snapshot_preview1: wasi.wasiImport,
});

// sleep 1000ms
await new Promise((resolve) => setTimeout(resolve, 1000));

wasi.start(
  instance as unknown as {
    exports: { memory: WebAssembly.Memory; _start: () => unknown };
  },
);
