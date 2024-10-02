import { WASIFarmAnimal } from "../../dist/index.js";

const { promise, resolve } = Promise.withResolvers();
import("../node_modules/@oligami/shared-object/dist/index.js").then(resolve);

let wasi;
let wasm;
let shared;

onmessage = async function (e) {
	const { wasi_refs } = e.data;

	if (wasi_refs) {
		wasm = await WebAssembly.compileStreaming(
			fetch("./rust_wasm/rustc_llvm_with_lld/cargo_opt.wasm"),
		);

		wasi = new WASIFarmAnimal(
			wasi_refs,
			[], // args
			[
				"RUST_MIN_STACK=16777216",
				"HOME=/home/wasi",
				"RUST_LOG=debug",
				"RUST_BACKTRACE=full",
				// This is made up of forced patches. Usually not available.
				"RUSTC_SYSROOT=/sysroot-with-lld",
				"RUSTFLAGS=",
			], // env
			{
				// debug: true,
				can_thread_spawn: true,
				thread_spawn_worker_url: new URL("./thread_spawn.js", import.meta.url)
					.href,
				// thread_spawn_worker_url: "./thread_spawn.js",
				thread_spawn_wasm: wasm,
				extend_imports: true,
			},
		);

		await wasi.wait_worker_background_worker();

		wasi.get_share_memory().grow(200);

		console.log("Waiting for worker background worker...");

		await promise;

		shared = new SharedObject.SharedObject((...args) => {
			console.log("wasi.start");
			wasi.args = ["cargo", ...args];
			wasi.block_start_on_thread();
			console.log("wasi.start done");
		}, "cargo");

		postMessage({ ready: true });
	}
};