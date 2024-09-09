import { strace, WASIFarmAnimal } from "../../dist/index.js";

console.log("worker.js");

onmessage = async function (e) {
  let wasm = await WebAssembly.compileStreaming(fetch("../wasm-rustc/bin/rustc.wasm"));

  console.log("worker.js onmessage", e.data);

  const { wasi_ref } = e.data;

  let args = ["rustc", "/hello.rs", "--sysroot", "/sysroot", "--target", "x86_64-unknown-linux-gnu", "-Cpanic=abort", "-Ccodegen-units=1"];
  let env = ["RUSTC_LOG=info"];

  console.log("wasi_ref", wasi_ref);

  const w = new WASIFarmAnimal(
    wasi_ref,
    args,
    env,
    {
      debug: true
    }
  );

  let next_thread_id = 1;

  let inst = await WebAssembly.instantiate(wasm, {
      "env": { memory: new WebAssembly.Memory({ initial: 256, maximum: 16384, shared: true }) },
      "wasi": {
          "thread-spawn": function(start_arg) {
              console.log("thread-spawn", start_arg);

              let thread_id = next_thread_id++;
              inst.exports.wasi_thread_start(thread_id, start_arg);
              return thread_id;
          }
      },
      "wasi_snapshot_preview1": strace(w.wasiImport, ["fd_prestat_get"]),
  });

  postMessage({
    "term": "\x1B[93mExecuting\x1B[0m",
  });
  console.log(inst.exports);
  try { w.start(inst); } catch(e) {
    postMessage({
      term: "Exception: " + e.message,
    });
    // /*term.writeln("backtrace:"); term.writeln(e.stack);*/
  }
  postMessage({
    "term": "\x1B[92mDone\x1B[0m",
  });

  console.log(fds);
  console.log(fds[5].dir);
  console.log(fds[5].dir.contents.get("hello.hello.65c991d23c885d45-cgu.0.rcgu.o").data);
}
