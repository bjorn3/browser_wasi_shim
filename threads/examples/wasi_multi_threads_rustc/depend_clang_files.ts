import { WASIFarm } from "../../src";
import {
  Directory,
  File,
  type Inode,
  PreopenDirectory,
} from "@bjorn3/browser_wasi_shim";

async function load_external_file(path) {
  return new File(await (await (await fetch(path)).blob()).arrayBuffer());
}

const wasi_libs = new Map<string, Inode>();
for (const file of [
  "crt1-command.o",
  "crt1-reactor.o",
  "crt1.o",
  "libc-printscan-long-double.a",
  "libc-printscan-no-floating-point.a",
  "libc.a",
  "libc.imports",
  "libc++.a",
  "libc++.modules.json",
  "libc++abi.a",
  "libc++experimental.a",
  "libcrypt.a",
  "libdl.a",
  "libm.a",
  "libpthread.a",
  "libresolv.a",
  "librt.a",
  "libsetjmp.a",
  "libutil.a",
  "libwasi-emulated-getpid.a",
  "libwasi-emulated-mman.a",
  "libwasi-emulated-process-clocks.a",
  "libwasi-emulated-signal.a",
  "libxnet.a",
]) {
  wasi_libs.set(
    file,
    await load_external_file(
      `./rust_wasm/llvm-tools/dist/lib/wasm32-wasip1/${file}`,
    ),
  );
}

const toMap = (arr: Array<[string, Inode]>) => new Map<string, Inode>(arr);

const farm = new WASIFarm(
  undefined,
  undefined,
  undefined,
  [
    new PreopenDirectory(
      "/sysroot-clang",
      toMap([
        [
          "lib",
          new Directory([
            [
              "wasm32-unknown-wasip1",
              new Directory([
                [
                  "libclang_rt.builtins.a",
                  await load_external_file(
                    "./rust_wasm/llvm-tools/dist/lib/wasm32-unknown-wasip1/libclang_rt.builtins.a",
                  ),
                ],
              ]),
            ],
            ["wasm32-wasip1", new Directory(wasi_libs)],
          ]),
        ],
      ]),
    ),
  ],
  {
    // allocator_size: 1024 * 1024 * 1024,
    // debug: true,
  },
);

const ret = await farm.get_ref();

postMessage({ wasi_ref: ret });
