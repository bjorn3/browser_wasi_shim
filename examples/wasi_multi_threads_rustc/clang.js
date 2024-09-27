import { strace, WASIFarmAnimal } from "../../dist/index.js";

const { promise, resolve } = Promise.withResolvers();
import("../node_modules/@oligami/shared-object/dist/index.js").then(resolve);

let wasi;
let inst;
let wasm;

let shared_clang;
let shared_tools;
let shared_wasm_ld;

onmessage = async function (e) {
	const { wasi_refs } = e.data;

	if (wasi_refs) {
		wasm = await WebAssembly.compileStreaming(
			fetch("./rust_wasm/llvm-tools/llvm-opt.wasm"),
		);

		wasi = new WASIFarmAnimal(
			wasi_refs,
			["llvm"], // args
			[], // env
			{
				debug: false,
			},
		);

		// Memory is rewritten at this time.
		// inst = await WebAssembly.instantiate(wasm, {
		// 	wasi_snapshot_preview1: wasi.wasiImport,
		// });
		inst = await WebAssembly.instantiate(wasm, {
			wasi_snapshot_preview1: strace(wasi.wasiImport, []),
		});

		console.log("wasi.start, inst", inst);

		await promise;

		const memory_reset = inst.exports.memory.buffer;
		const memory_reset_view = new Uint8Array(memory_reset).slice();

		shared_clang = new SharedObject.SharedObject((...args) => {
			console.log("clang args", args);
			// If I don't reset memory, I get some kind of error.
			wasi.args = ["llvm", "clang", ...args];
			const memory_view = new Uint8Array(inst.exports.memory.buffer);
			memory_view.set(memory_reset_view);
			wasi.start(inst);
			console.log("clang wasi.start done");
		}, "clang");

		shared_tools = new SharedObject.SharedObject((...args) => {
			console.log("tools args", args);
			// If I don't reset memory, I get some kind of error.
			wasi.args = ["llvm-tools", ...args];
			const memory_view = new Uint8Array(inst.exports.memory.buffer);
			memory_view.set(memory_reset_view);
			wasi.start(inst);
			console.log("tools wasi.start done");
		}, "llvm-tools");

		shared_wasm_ld = new SharedObject.SharedObject((...args) => {
			console.log("wasm-ld args", args);
			// If I don't reset memory, I get some kind of error.
			wasi.args = ["llvm-tools", "wasm-ld", ...args];
			const memory_view = new Uint8Array(inst.exports.memory.buffer);
			memory_view.set(memory_reset_view);
			wasi.start(inst);
			console.log("wasm-ld wasi.start done");
		}, "wasm-ld");

		postMessage({ ready: true });
	}
};
