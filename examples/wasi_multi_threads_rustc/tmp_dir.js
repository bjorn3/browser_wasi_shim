import {
	PreopenDirectory,
	WASIFarm,
	File,
	Directory,
} from "../../dist/index.js";

const farm = new WASIFarm(
	undefined,
	undefined,
	undefined,
	[
		// new PreopenDirectory(".", [
		// 	["tmp-tmp", new File(new TextEncoder("utf-8").encode("Hello World!"))],
		// 	["tmp-dir", new Directory([])],
		// ]),
		// new PreopenDirectory("tmp-dir", [
		// 	[
		// 		"tmp-dir_inner",
		// 		new Directory([
		// 			[
		// 				"tmp-dir_inner-file",
		// 				new File(new TextEncoder("utf-8").encode("Hello World!!!!!")),
		// 			],
		// 		]),
		// 	],
		// ]),
		new PreopenDirectory("/tmp", []),
		new PreopenDirectory("/", [
			[
				"hello.rs",
				new File(
					new TextEncoder("utf-8").encode(
						`fn main() { println!("Hello World!"); }`,
					),
				),
			],
			["sysroot", new Directory([])],
			["tmp", new Directory([])],
		]),
		new PreopenDirectory("~", [
			[
				"####.rs",
				new File(
					new TextEncoder("utf-8").encode(
						`fn main() { println!("Hello World!"); }`,
					),
				),
			],
			["sysroot", new Directory([])],
		]),
	],
	// { debug: true },
);

const ret = await farm.get_ref();

postMessage({ wasi_ref: ret });
