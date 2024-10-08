import {
  Directory,
  PreopenDirectory,
  File,
  type Inode,
} from "@bjorn3/browser_wasi_shim";
import { WASIFarm } from "../../src";

async function load_external_file(path) {
  return new File(await (await (await fetch(path)).blob()).arrayBuffer());
}

const linux_libs_promise = (async () => {
  const dir = new Map<string, Inode>();
  for (const file of [
    "libaddr2line-b8754aeb03c02354.rlib",
    "libadler-05c3545f6cd12159.rlib",
    "liballoc-0dab879bc41cd6bd.rlib",
    "libcfg_if-c7fd2cef50341546.rlib",
    "libcompiler_builtins-a99947d020d809d6.rlib",
    "libcore-4b8e8a815d049db3.rlib",
    "libgetopts-bbb75529e85d129d.rlib",
    "libgimli-598847d27d7a3cbf.rlib",
    "libhashbrown-d2ff91fdf93cacb2.rlib",
    "liblibc-dc63949c664c3fce.rlib",
    "libmemchr-2d3a423be1a6cb96.rlib",
    "libminiz_oxide-b109506a0ccc4c6a.rlib",
    "libobject-7b48def7544c748b.rlib",
    "libpanic_abort-c93441899b93b849.rlib",
    "libpanic_unwind-11d9ba05b60bf694.rlib",
    "libproc_macro-1a7f7840bb9983dc.rlib",
    "librustc_demangle-59342a335246393d.rlib",
    "librustc_std_workspace_alloc-552b185085090ff6.rlib",
    "librustc_std_workspace_core-5d8a121daa7eeaa9.rlib",
    "librustc_std_workspace_std-97f43841ce452f7d.rlib",
    "libstd-bdedb7706a556da2.rlib",
    "libstd-bdedb7706a556da2.so",
    "libstd_detect-cca21eebc4281add.rlib",
    "libsysroot-f654e185be3ffebd.rlib",
    "libtest-f06fa3fbc201c558.rlib",
    "libunicode_width-19a0dcd589fa0877.rlib",
    "libunwind-747b693f90af9445.rlib",
  ]) {
    dir.set(
      file,
      await load_external_file(
        `./rust_wasm/rustc_llvm/dist/lib/rustlib/x86_64-unknown-linux-gnu/lib/${file}`,
      ),
    );
  }
  return dir;
})();

const threads_libs_promise = (async () => {
  const dir = new Map<string, Inode>();
  for (const file of [
    "libaddr2line-a47658bebc67c3a1.rlib",
    "libadler-38ddbcf07afd45fc.rlib",
    "liballoc-1fc4f6ca1d836e4c.rlib",
    "libcfg_if-fd15f5d506df7899.rlib",
    "libcompiler_builtins-3dc6223f56552b05.rlib",
    "libcore-0ec7cb16e8553802.rlib",
    "libgetopts-6248a91c42a854a0.rlib",
    "libgimli-4425159eeeeb18dd.rlib",
    "libhashbrown-243f98c4e4e641ea.rlib",
    "liblibc-9149392e3841960d.rlib",
    "libmemchr-9ac950afd37fa4c7.rlib",
    "libminiz_oxide-91aaa0ee7402d39e.rlib",
    "libobject-361b96ef5df8a7f9.rlib",
    "libpanic_abort-f91052098501e46b.rlib",
    "libpanic_unwind-fc376dcf47815f10.rlib",
    "libproc_macro-9cab37e4d11f0e52.rlib",
    "librustc_demangle-1af142f261139812.rlib",
    "librustc_std_workspace_alloc-f0d62212c413dd0e.rlib",
    "librustc_std_workspace_core-ea396731d16229a8.rlib",
    "librustc_std_workspace_std-7434133be68a4a89.rlib",
    "libstd_detect-083332b3c8180bc9.rlib",
    "libstd-5ddf10249e9580fe.rlib",
    "libsysroot-8b3608099dad3b42.rlib",
    "libtest-8ebd431ae5608538.rlib",
    "libunicode_width-7e2396fcd7049a8b.rlib",
    "libunwind-e7408208cf4a3c79.rlib",
    "libwasi-f0b9e157c50fe586.rlib",
  ]) {
    dir.set(
      file,
      await load_external_file(
        `./rust_wasm/rustc_llvm/dist/lib/rustlib/wasm32-wasip1-threads/lib/${file}`,
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
        `./rust_wasm/rustc_llvm/dist/lib/rustlib/wasm32-wasip1-threads/lib/self-contained/${file}`,
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
      "./rust_wasm/rustc_llvm/dist/lib/rustlib/components",
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
      "/sysroot",
      toMap([
        [
          "lib",
          new Directory([
            [
              "rustlib",
              new Directory([
                ["components", components],
                [
                  "wasm32-wasip1-threads",
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
