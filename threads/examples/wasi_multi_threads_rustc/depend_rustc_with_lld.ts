import { WASIFarm } from "../../src";

import {
  File,
  Directory,
  PreopenDirectory,
  type Inode,
} from "@bjorn3/browser_wasi_shim";

async function load_external_file(path) {
  return new File(await (await (await fetch(path)).blob()).arrayBuffer());
}

const linux_libs_promise = (async () => {
  const dir = new Map<string, Inode>();
  for (const file of [
    "libaddr2line-d2445d88f0df8258.rlib",
    "libadler-6095b59b8443d84e.rlib",
    "liballoc-19b196c8c1c1b105.rlib",
    "libcfg_if-d04d665f43a7a5c9.rlib",
    "libcompiler_builtins-f3e5bc67a3085e50.rlib",
    "libcore-24518d8502db248c.rlib",
    "libgetopts-4bb89b05e2b4cc6e.rlib",
    "libgimli-85e2d283537da979.rlib",
    "libhashbrown-1436b1713a4e6650.rlib",
    "liblibc-a012fa771333437a.rlib",
    "libmemchr-b50e0c33c9e9768d.rlib",
    "libminiz_oxide-937a56bed56199f4.rlib",
    "libobject-4e591f1863579f49.rlib",
    "libpanic_abort-90cfe20cb97a5e4c.rlib",
    "libpanic_unwind-9ad8c03a583f4dc7.rlib",
    "libproc_macro-32b9efef039a24fe.rlib",
    "librustc_demangle-ca292a161705fdb4.rlib",
    "librustc_std_workspace_alloc-bba69521e853a996.rlib",
    "librustc_std_workspace_core-3da34b7f5e59869a.rlib",
    "librustc_std_workspace_std-c35ef78edc033606.rlib",
    "libstd_detect-776a1ebea822ca12.rlib",
    "libstd-6924b036e1bec7ce.rlib",
    "libstd-6924b036e1bec7ce.so",
    "libsysroot-0b7644c6027c414e.rlib",
    "libtest-3d5766d8038a0e74.rlib",
    "libunicode_width-dff2b02e7e936b79.rlib",
    "libunwind-c99628283276f21f.rlib",
  ]) {
    dir.set(
      file,
      await load_external_file(
        `./rust_wasm/rustc_llvm_with_lld/dist/lib/rustlib/x86_64-unknown-linux-gnu/lib/${file}`,
      ),
    );
  }
  return dir;
})();

const threads_libs_promise = (async () => {
  const dir = new Map<string, Inode>();
  for (const file of [
    "libaddr2line-02cc3b87379ea949.rlib",
    "libgimli-a80bd3f5fe54def6.rlib",
    "libpanic_unwind-05c50d12758b6d01.rlib",
    "libstd_detect-a196185ed7f17cfc.rlib",
    "libadler-a6b90b86640ec179.rlib",
    "libhashbrown-35a68b834152af94.rlib",
    "libproc_macro-2aa22b2ed111e644.rlib",
    "libsysroot-856cc79af2fd1ee2.rlib",
    "liballoc-be9b2b68a2d6adbd.rlib",
    "liblibc-374b1b6cc5790f18.rlib",
    "librustc_demangle-710d955f336192eb.rlib",
    "libtest-4fcaddbdfa4f37f9.rlib",
    "libcfg_if-75a956684c8aceef.rlib",
    "libmemchr-b8580e949eadd97a.rlib",
    "librustc_std_workspace_alloc-9c960f87e9d5a453.rlib",
    "libunicode_width-be3becba43cd1b78.rlib",
    "libcompiler_builtins-3a0795e4489d8e8b.rlib",
    "libminiz_oxide-0bc4b046969a6755.rlib",
    "librustc_std_workspace_core-4e237761d66d6cde.rlib",
    "libunwind-2e570680d1c4cd0a.rlib",
    "libcore-3e70038323b3a06e.rlib",
    "libobject-3d83ea5d7ed5636f.rlib",
    "librustc_std_workspace_std-5aa56e0a1970dc72.rlib",
    "libwasi-f7d0229d2fe97cfd.rlib",
    "libgetopts-b3d0219ad62c74a7.rlib",
    "libpanic_abort-431cc2501a123c59.rlib",
    "libstd-c7f97b33ddfcbfbf.rlib",
  ]) {
    dir.set(
      file,
      await load_external_file(
        `./rust_wasm/rustc_llvm_with_lld/dist/lib/rustlib/wasm32-wasip1/lib/${file}`,
      ),
    );
  }
  return dir;
})();

const threads_self_contained_promise = (async () => {
  const dir = new Map<string, Inode>();
  for (const file of ["crt1-command.o", "crt1-reactor.o", "libc.a"]) {
    dir.set(
      file,
      await load_external_file(
        `./rust_wasm/rustc_llvm_with_lld/dist/lib/rustlib/wasm32-wasip1/lib/self-contained/${file}`,
      ),
    );
  }
  return dir;
})();

const [linux_libs, threads_libs, threads_self_contained, components] =
  await Promise.all([
    linux_libs_promise,
    threads_libs_promise,
    threads_self_contained_promise,
    await load_external_file(
      "./rust_wasm/rustc_llvm_with_lld/dist/lib/rustlib/components",
    ),
  ]);

threads_libs.set("self-contained", new Directory(threads_self_contained));

const toMap = (arr: Array<[string, Inode]>) => new Map<string, Inode>(arr);

const farm = new WASIFarm(
  undefined,
  undefined,
  undefined,
  [
    new PreopenDirectory(
      "/sysroot-with-lld",
      toMap([
        [
          "lib",
          new Directory([
            [
              "rustlib",
              new Directory([
                ["components", components],
                [
                  "wasm32-wasip1",
                  new Directory([["lib", new Directory(threads_libs)]]),
                ],
                [
                  "x86_64-unknown-linux-gnu",
                  new Directory([["lib", new Directory(linux_libs)]]),
                ],
              ]),
            ],
          ]),
        ],
      ]),
    ),
  ],
  {
    allocator_size: 1024 * 1024 * 1024,
    // debug: true,
  },
);

const ret = await farm.get_ref();

postMessage({ wasi_ref: ret });
