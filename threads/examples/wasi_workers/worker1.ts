import { WASIFarmAnimal } from "../../src";

self.onmessage = async (e) => {
  const { wasi_ref, wasi_ref2 } = e.data;

  console.dir(wasi_ref);
  console.dir(wasi_ref2);

  const wasi = new WASIFarmAnimal(
    [wasi_ref2, wasi_ref],
    [
      "echo_and_rewrite",
      "hello2/hello2.txt",
      "world",
      "new_world",
      "0",
      "100",
      "100",
    ], // args
    [""], // env
    // options
  );

  console.dir(wasi, { depth: null });

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
