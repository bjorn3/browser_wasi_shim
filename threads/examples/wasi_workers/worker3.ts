import { WASIFarmAnimal } from "../../src";

self.onmessage = async (e) => {
  const { wasi_ref, wasi_ref2 } = e.data;

  const wasi = new WASIFarmAnimal(
    [wasi_ref, wasi_ref2],
    ["echo_and_rewrite", "hello.txt", "world", "new_world", "200", "300"], // args
    [""], // env
    // options
  );
  const wasm = await fetch("./echo_and_rewrite.wasm");
  const buff = await wasm.arrayBuffer();
  const { instance } = await WebAssembly.instantiate(buff, {
    wasi_snapshot_preview1: wasi.wasiImport,
  });
  wasi.start(
    instance as unknown as {
      exports: { memory: WebAssembly.Memory; _start: () => unknown };
    },
  );
};
