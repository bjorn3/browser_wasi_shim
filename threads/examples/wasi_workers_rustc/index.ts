import { WASIFarm } from "../../src";
import {
  Directory,
  Fd,
  File,
  type Inode,
  PreopenDirectory,
} from "@bjorn3/browser_wasi_shim";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "xterm-addon-fit";
import "@xterm/xterm/css/xterm.css";

const term = new Terminal({
  convertEol: true,
});
const terminalElement = document.getElementById("terminal");
if (!terminalElement) {
  throw new Error("Terminal element not found");
}
term.open(terminalElement);

const fitAddon = new FitAddon();
term.loadAddon(fitAddon);
fitAddon.fit();

class XtermStdio extends Fd {
  /*:: term: Terminal*/
  term: Terminal;

  constructor(term: Terminal) {
    super();
    this.term = term;
  }
  fd_write(data /*: Uint8Array*/) /*: {ret: number, nwritten: number}*/ {
    console.log(data);
    this.term.write(new TextDecoder().decode(data));
    return { ret: 0, nwritten: data.byteLength };
  }
}

term.writeln("\x1B[93mDownloading\x1B[0m");
//let wasm = await WebAssembly.compileStreaming(fetch("/rust_out.wasm"));
term.writeln("\x1B[93mInstantiating\x1B[0m");

async function load_external_file(path) {
  return new File(await (await (await fetch(path)).blob()).arrayBuffer());
}

const toMap = (arr: Array<[string, Inode]>) => {
  const map = new Map<string, Inode>();
  for (const [key, value] of arr) {
    map.set(key, value);
  }
  return map;
};

const fds = [
  new PreopenDirectory("/tmp", toMap([])),
  new PreopenDirectory(
    "/sysroot",
    toMap([
      [
        "lib",
        new Directory([
          [
            "rustlib",
            new Directory([
              ["wasm32-wasi", new Directory([["lib", new Directory([])]])],
              [
                "x86_64-unknown-linux-gnu",
                new Directory([
                  [
                    "lib",
                    new Directory(
                      await (async () => {
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
                              `../wasi_multi_threads_rustc/rust_wasm/rustc_cranelift/dist/lib/rustlib/x86_64-unknown-linux-gnu/lib/${file}`,
                            ),
                          );
                        }
                        return dir;
                      })(),
                    ),
                  ],
                ]),
              ],
            ]),
          ],
        ]),
      ],
    ]),
  ),
  new PreopenDirectory(
    "/",
    toMap([
      [
        "hello.rs",
        new File(
          new TextEncoder().encode(`fn main() { println!("Hello World!"); }`),
        ),
      ],
    ]),
  ),
];

const wasi_farm = new WASIFarm(
  new XtermStdio(term),
  new XtermStdio(term),
  new XtermStdio(term),
  fds,
  {
    allocator_size: 1024 * 1024 * 1024,
  },
);

const wasi_ref = await wasi_farm.get_ref();

const worker = new Worker("./worker.ts", { type: "module" });
worker.postMessage({ wasi_ref });

console.log("worker created", worker);

worker.onmessage = (event) => {
  const data = event.data;
  const { term: write } = data;

  term.writeln(write);
};

const downloadsElement = document.getElementById("downloads");

if (!downloadsElement) {
  throw new Error("Downloads element not found");
}

let content: Inode | undefined;
while (true) {
  content = fds[2].dir.contents.get(
    "hello.hello.65c991d23c885d45-cgu.0.rcgu.o",
  );
  if (content) {
    break;
  }
  await new Promise((resolve) => setTimeout(resolve, 1000));
}
await new Promise((resolve) => setTimeout(resolve, 1000));
downloadsElement.innerHTML += `<br><a href='${URL.createObjectURL(
  new Blob([(content as File).data], { type: "application/elf" }),
)}'>Download object</a>`;
let content2: Inode | undefined;
while (true) {
  content2 = fds[2].dir.contents.get("hello.allocator_shim.rcgu.o");
  if (content2) {
    break;
  }
  await new Promise((resolve) => setTimeout(resolve, 1000));
}
await new Promise((resolve) => setTimeout(resolve, 1000));
downloadsElement.innerHTML += `<br><a href='${URL.createObjectURL(
  new Blob([(content2 as File).data], {
    type: "application/elf",
  }),
)}'>Download allocator shim</a>`;
