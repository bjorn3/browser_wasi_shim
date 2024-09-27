import {
	PreopenDirectory,
	WASIFarm,
	File,
	Directory,
} from "../../dist/index.js";

const { promise, resolve } = Promise.withResolvers();
import("../node_modules/@oligami/shared-object/dist/index.js").then(resolve);

const root_dir = new PreopenDirectory("/", [
	[
		"hello.rs",
		new File(
			new TextEncoder("utf-8").encode(
				`fn main() { println!("Hello World!"); }`,
			),
		),
	],
	["sysroot", new Directory([])],
	["sysroot-with-lld", new Directory([])],
	["tmp", new Directory([])],
]);

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
		root_dir,
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

await promise;

const shared = new SharedObject.SharedObject(
	{
		get_file(path_str) {
			console.log(root_dir);
			const path = {
				parts: [path_str],
				is_dir: false,
			};
			const { ret, entry } = root_dir.dir.get_entry_for_path(path);
			if (ret !== 0) {
				throw new Error(`get_file: ${path_str} failed`);
			}
			return entry.data;
		},
	},
	"root_dir",
);

postMessage({ wasi_ref: ret });
