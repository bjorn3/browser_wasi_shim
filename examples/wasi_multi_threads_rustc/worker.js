const { promise, resolve } = Promise.withResolvers();
import("../node_modules/@oligami/shared-object/dist/index.js").then(resolve);
import { WASIFarmAnimal } from "../../dist/index.js";

let tree;
let term;
let rustc;
let rustc_with_lld;
let clang;
let llvm_tools;
let wasm_ld;
let cargo;
let std_out_keep;
let std_err_keep;
let root_dir;
let cat;

const blueText = "\x1b[34m";
const resetText = "\x1b[0m";

self.onmessage = async (e) => {
	const { wasi_ref } = e.data;

	const {
		promise: depend_rustc_files_promise,
		resolve: depend_rustc_files_resolve,
	} = Promise.withResolvers();
	const {
		promise: depend_rustc_with_lld_promise,
		resolve: depend_rustc_with_lld_resolve,
	} = Promise.withResolvers();
	const {
		promise: depend_clang_files_promise,
		resolve: depend_clang_files_resolve,
	} = Promise.withResolvers();
	const { promise: tmp_dir_promise, resolve: tmp_dir_resolve } =
		Promise.withResolvers();
	const { promise: save_stdout_promise, resolve: save_stdout_resolve } =
		Promise.withResolvers();

	const depend_rustc_files_manage_worker = new Worker("depend_rustc_files.js", {
		type: "module",
	});
	depend_rustc_files_manage_worker.onmessage = (e) => {
		depend_rustc_files_resolve(e.data);
	};

	const depend_rustc_with_lld_manage_worker = new Worker(
		"depend_rustc_with_lld.js",
		{
			type: "module",
		},
	);
	depend_rustc_with_lld_manage_worker.onmessage = (e) => {
		depend_rustc_with_lld_resolve(e.data);
	};

	const depend_clang_files_manage_worker = new Worker("depend_clang_files.js", {
		type: "module",
	});
	depend_clang_files_manage_worker.onmessage = (e) => {
		depend_clang_files_resolve(e.data);
	};

	const tmp_dir_manage_worker = new Worker("tmp_dir.js", {
		type: "module",
	});
	tmp_dir_manage_worker.onmessage = (e) => {
		tmp_dir_resolve(e.data);
	};

	const save_stdout_manage_worker = new Worker("save_stdout.js", {
		type: "module",
	});
	save_stdout_manage_worker.onmessage = (e) => {
		save_stdout_resolve(e.data);
	};

	const [
		depend_rustc_files,
		depend_rustc_with_lld,
		depend_clang_files,
		tmp_dir,
		save_stdout,
	] = await Promise.all([
		depend_rustc_files_promise,
		depend_rustc_with_lld_promise,
		depend_clang_files_promise,
		tmp_dir_promise,
		save_stdout_promise,
	]);
	const { wasi_ref: wasi_ref_depend_rustc_files } = depend_rustc_files;
	const { wasi_ref: wasi_ref_depend_rustc_with_lld_files } =
		depend_rustc_with_lld;
	const { wasi_ref: wasi_ref_depend_clang_files } = depend_clang_files;
	const { wasi_ref: wasi_ref_tmp_dir } = tmp_dir;
	const { wasi_ref: wasi_ref_save_stdout } = save_stdout;

	const wasi_refs = [
		wasi_ref_depend_rustc_files,
		wasi_ref_depend_rustc_with_lld_files,
		wasi_ref_depend_clang_files,
		wasi_ref_tmp_dir,
		wasi_ref,
	];

	const { promise: tree_promise, resolve: tree_resolve } =
		Promise.withResolvers();
	const { promise: rustc_promise, resolve: rustc_resolve } =
		Promise.withResolvers();
	const { promise: rustc_with_lld_promise, resolve: rustc_with_lld_resolve } =
		Promise.withResolvers();
	const { promise: clang_promise, resolve: clang_resolve } =
		Promise.withResolvers();
	const { promise: cargo_promise, resolve: cargo_resolve } =
		Promise.withResolvers();
	const { promise: cat_promise, resolve: cat_resolve } =
		Promise.withResolvers();

	const tree_worker = new Worker("tree.js", {
		type: "module",
	});
	tree_worker.onmessage = (e) => {
		console.log("tree onmessage");
		tree_resolve(e.data);
	};

	const rustc_worker = new Worker("rustc.js", {
		type: "module",
	});
	rustc_worker.onmessage = (e) => {
		console.log("rustc onmessage");
		rustc_resolve(e.data);
	};

	const rustc_with_lld_worker = new Worker("rustc_with_lld.js", {
		type: "module",
	});
	rustc_with_lld_worker.onmessage = (e) => {
		console.log("rustc_with_lld onmessage");
		rustc_with_lld_resolve(e.data);
	};

	const clang_worker = new Worker("clang.js", {
		type: "module",
	});
	clang_worker.onmessage = (e) => {
		console.log("clang onmessage");
		clang_resolve(e.data);
	};

	const cargo_worker = new Worker("cargo.js", {
		type: "module",
	});
	cargo_worker.onmessage = (e) => {
		console.log("cargo onmessage");
		cargo_resolve(e.data);
	};

	const cat_worker = new Worker("cat.js", {
		type: "module",
	});
	cat_worker.onmessage = (e) => {
		console.log("cat onmessage");
		cat_resolve(e.data);
	};

	tree_worker.postMessage({
		wasi_refs,
	});
	rustc_worker.postMessage({
		wasi_refs: [wasi_ref_save_stdout, ...wasi_refs],
	});
	rustc_with_lld_worker.postMessage({
		wasi_refs,
	});
	clang_worker.postMessage({
		wasi_refs,
	});
	cargo_worker.postMessage({
		wasi_refs,
	});
	cat_worker.postMessage({
		wasi_refs,
	});

	console.log("Waiting for tree and rustc to finish...");

	await Promise.all([
		tree_promise,
		rustc_promise,
		rustc_with_lld_promise,
		clang_promise,
		cargo_promise,
		cat_promise,
	]);

	console.log("Sending run message...");

	await promise;

	tree = new SharedObject.SharedObjectRef("tree").proxy();

	term = new SharedObject.SharedObjectRef("term").proxy();

	rustc = new SharedObject.SharedObjectRef("rustc").proxy();

	rustc_with_lld = new SharedObject.SharedObjectRef("rustc_with_lld").proxy();

	clang = new SharedObject.SharedObjectRef("clang").proxy();

	llvm_tools = new SharedObject.SharedObjectRef("llvm-tools").proxy();

	wasm_ld = new SharedObject.SharedObjectRef("wasm-ld").proxy();

	std_out_keep = new SharedObject.SharedObjectRef("std_out_keep").proxy();

	std_err_keep = new SharedObject.SharedObjectRef("std_err_keep").proxy();

	root_dir = new SharedObject.SharedObjectRef("root_dir").proxy();

	cargo = new SharedObject.SharedObjectRef("cargo").proxy();

	cat = new SharedObject.SharedObjectRef("cat").proxy();

	// cargo -h
	await term.writeln(`\n$${blueText} cargo -h${resetText}`);
	await cargo("-h");

	// cargo new -h
	await term.writeln(`\n$${blueText} cargo new -h${resetText}`);
	await cargo("new", "-h");

	// cargo new --bin
	await term.writeln(`\n$${blueText} cargo new --bin helloworld${resetText}`);
	await cargo("new", "--bin", "helloworld");

	// cat /helloworld/src/main.rs
	await term.writeln(`\n$${blueText} cat /helloworld/src/main.rs${resetText}`);
	await cat("/helloworld/src/main.rs");

	// cat /helloworld/Cargo.toml
	await term.writeln(`\n$${blueText} cat /helloworld/Cargo.toml${resetText}`);
	await cat("/helloworld/Cargo.toml");

	// cargo run -h
	await term.writeln(`\n$${blueText} cargo run -h${resetText}`);
	await cargo("run", "-h");

	// cargo run --manifest-path /helloworld/Cargo.toml --jobs 1 -- --sysroot /sysroot-with-lld
	await term.writeln(
		`\n$${blueText} cargo run --manifest-path /helloworld/Cargo.toml --jobs 1`,
	);
	await cargo(
		"run",
		"--manifest-path",
		"/helloworld/Cargo.toml",
		"--jobs",
		"1",
	);

	// llvm-tools
	await term.writeln(`$${blueText} llvm-tools${resetText}`);
	await llvm_tools();

	// clang -h
	await term.writeln(`\n$${blueText} clang --help${resetText}`);
	await clang("--help");

	// clang -v
	await term.writeln(`\n$${blueText} clang -v${resetText}`);
	await clang("-v");

	// wasm-ld --help
	await term.writeln(`\n$${blueText} wasm-ld --help${resetText}`);
	await wasm_ld("--help");

	// wasm-ld -v
	await term.writeln(`\n$${blueText} wasm-ld -v${resetText}`);
	await wasm_ld("-v");

	// tree -h
	await term.writeln(`\n$${blueText} tree -h${resetText}`);
	await tree("-h");

	// tree /
	await term.writeln(`\n$${blueText} tree /${resetText}`);
	await tree("/");

	// rustc -h
	await std_out_keep.reset();
	await std_err_keep.reset();
	await term.writeln(`\n$${blueText} rustc -h${resetText}`);
	await rustc("-h");
	const rustc_help = await std_out_keep.get();
	const rustc_help_err = await std_err_keep.get();
	console.log(rustc_help);
	console.warn(rustc_help_err);

	// rustc /hello.rs --sysroot /sysroot --target wasm32-wasip1-threads -Csave-temps --out-dir /tmp
	await term.writeln(
		`\n$${blueText} rustc /hello.rs --sysroot /sysroot --target wasm32-wasip1-threads -Csave-temps --out-dir /tmp${resetText}`,
	);
	try {
		await std_out_keep.reset();
		await std_err_keep.reset();
		await rustc(
			"/hello.rs",
			"--sysroot",
			"/sysroot",
			"--target",
			"wasm32-wasip1-threads",
			"-Csave-temps",
			"--out-dir",
			"/tmp",
		);
	} catch (e) {
		console.error(e);
	}
	const out = await std_out_keep.get();
	const err = await std_err_keep.get();
	console.log(out);
	console.warn(err);

	// tree /
	await term.writeln(`\n$${blueText} tree /${resetText}`);
	await tree("/");

	// If the glob pattern is used,
	// it seems to be passed directly to path_open,
	// so it is necessary to specify it carefully.
	if (!err.includes("error: could not exec the linker")) {
		throw new Error("cannot get lld arguments");
	}
	// extract lld arguments line
	const lld_args_and_etc = err
		.split("\n")
		.find((line) => line.includes("rust-lld") && line.includes("note: "));
	const lld_args_str = lld_args_and_etc.split('"rust-lld"')[1].trim();
	const lld_args_with_wrap = lld_args_str.split(" ");
	let lld_args = lld_args_with_wrap.map((arg) => arg.slice(1, -1));
	// rm -flavor wasm
	lld_args = lld_args.filter((arg) => arg !== "-flavor" && arg !== "wasm");
	// rm -Wl
	lld_args = lld_args.map((arg) => {
		if (arg.includes("-Wl,")) {
			return arg.slice(4);
		}
		return arg;
	});
	console.log(lld_args);

	await term.writeln(
		`\n$${blueText} wasm-ld ${lld_args.join(" ")}${resetText}`,
	);
	try {
		await wasm_ld(lld_args);
	} catch (error) {
		console.error(error);
		const redText = "\x1b[31m";
		const boldText = "\x1b[1m";

		const message = `${boldText}${redText}Error: ${error.message}${resetText}\n`;
		const stack = `${redText}Stack Trace: ${error.stack}${resetText}`;

		await term.writeln(message + stack);
	}

	// tree /
	await term.writeln(`\n$${blueText} tree /${resetText}`);
	await tree("/");

	// rustc_with_lld /hello.rs --sysroot /sysroot --target wasm32-wasip1
	await term.writeln(
		`\n$${blueText} rustc_with_lld /hello.rs --sysroot /sysroot-with-lld --target wasm32-wasip1${resetText}`,
	);
	try {
		await rustc_with_lld(
			"/hello.rs",
			"--sysroot",
			"/sysroot-with-lld",
			"--target",
			"wasm32-wasip1",
		);
	} catch (e) {
		console.error(e);
	}

	// tree /
	await term.writeln(`\n$${blueText} tree /${resetText}`);
	await tree("/");

	// run /hello.wasm
	await term.writeln(`\n$${blueText} run /hello.wasm${resetText}`);
	const created_wasm_buffer = await root_dir.get_file("hello.wasm");
	const created_wasm = await WebAssembly.compile(created_wasm_buffer);
	const wasi = new WASIFarmAnimal(
		wasi_refs,
		[], // args
		[], // env
		{
			debug: false,
		},
	);

	// Memory is rewritten at this time.
	const inst = await WebAssembly.instantiate(created_wasm, {
		wasi_snapshot_preview1: wasi.wasiImport,
	});

	wasi.start(inst);

	// all done
	await term.writeln(`\n$${blueText} All done!${resetText}`);
};
