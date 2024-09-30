import { strace, WASIFarmAnimal } from "../../dist/index.js";

const { promise, resolve } = Promise.withResolvers();
import("../node_modules/@oligami/shared-object/dist/index.js").then(resolve);

let wasi;
let inst;
let wasm;

let shared;

onmessage = async function (e) {
	const { wasi_refs } = e.data;

	if (wasi_refs) {
		wasm = await WebAssembly.compileStreaming(fetch("./cat.wasm"));

		wasi = new WASIFarmAnimal(
			wasi_refs,
			["cat"], // args
			[], // env
			{
				debug: false,
			},
		);

		// Memory is rewritten at this time.
		inst = await WebAssembly.instantiate(wasm, {
			wasi_snapshot_preview1: wasi.wasiImport,
		});

		await promise;

		const memory_reset = inst.exports.memory.buffer;
		const memory_reset_view = new Uint8Array(memory_reset).slice();

		shared = new SharedObject.SharedObject((...args) => {
			// If I don't reset memory, I get some kind of error.
			wasi.args = ["cat", ...args];
			const memory_view = new Uint8Array(inst.exports.memory.buffer);
			memory_view.set(memory_reset_view);
			wasi.start(inst);
		}, "cat");

		postMessage({ ready: true });
	}
};
