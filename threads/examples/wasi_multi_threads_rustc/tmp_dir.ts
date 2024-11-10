import {
  type Inode,
  PreopenDirectory,
  File,
  Directory,
} from "@bjorn3/browser_wasi_shim";
import { WASIFarm } from "../../src";
import { SharedObject } from "@oligami/shared-object";

const toMap = (arr: Array<[string, Inode]>) => new Map<string, Inode>(arr);

const root_dir = new PreopenDirectory(
  "/",
  toMap([
    [
      "hello.rs",
      new File(
        new TextEncoder().encode(`fn main() { println!("Hello World!"); }`),
      ),
    ],
    ["sysroot", new Directory([])],
    ["sysroot-with-lld", new Directory([])],
    ["tmp", new Directory([])],
  ]),
);

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
    new PreopenDirectory("/tmp", toMap([])),
    root_dir,
    new PreopenDirectory(
      "~",
      toMap([
        [
          "####.rs",
          new File(
            new TextEncoder().encode(`fn main() { println!("Hello World!"); }`),
          ),
        ],
        ["sysroot", new Directory([])],
      ]),
    ),
  ],
  // { debug: true },
);

const ret = await farm.get_ref();

const shared = new SharedObject(
  {
    get_file(path_str) {
      console.log(root_dir);
      const path = {
        parts: [path_str],
        is_dir: false,
      };
      // biome-ignore lint/suspicious/noExplicitAny: <explanation>
      const { ret, entry } = root_dir.dir.get_entry_for_path(path as any);
      if (ret !== 0 || entry === null) {
        throw new Error(`get_file: ${path_str} failed`);
      }
      return (entry as File).data;
    },
  },
  "root_dir",
);

postMessage({ wasi_ref: ret });
