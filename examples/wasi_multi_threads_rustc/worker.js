const { promise, resolve } = Promise.withResolvers();
import("../node_modules/@oligami/shared-object/dist/index.js").then(resolve);

let tree;
let term;
let rustc;

self.onmessage = async (e) => {
	const { wasi_ref } = e.data;

	const { promise: depend_files_promise, resolve: depend_files_resolve } =
		Promise.withResolvers();
	const { promise: tmp_dir_promise, resolve: tmp_dir_resolve } =
		Promise.withResolvers();

	const depend_files_manage_worker = new Worker("depend_files.js", {
		type: "module",
	});
	depend_files_manage_worker.onmessage = (e) => {
		depend_files_resolve(e.data);
	};

	const tmp_dir_manage_worker = new Worker("tmp_dir.js", {
		type: "module",
	});
	tmp_dir_manage_worker.onmessage = (e) => {
		tmp_dir_resolve(e.data);
	};

	const [depend_files, tmp_dir] = await Promise.all([
		depend_files_promise,
		tmp_dir_promise,
	]);
	const { wasi_ref: wasi_ref_depend_files } = depend_files;
	const { wasi_ref: wasi_ref_tmp_dir } = tmp_dir;

	const wasi_refs = [wasi_ref_depend_files, wasi_ref_tmp_dir, wasi_ref];

	const { promise: tree_promise, resolve: tree_resolve } =
		Promise.withResolvers();
	const { promise: rustc_promise, resolve: rustc_resolve } =
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

	tree_worker.postMessage({
		wasi_refs,
	});
	rustc_worker.postMessage({
		wasi_refs,
	});

	console.log("Waiting for tree and rustc to finish...");

	await Promise.all([tree_promise, rustc_promise]);

	console.log("Sending run message...");

	await promise;

	tree = new SharedObject.SharedObjectRef("tree").proxy();

	term = new SharedObject.SharedObjectRef("term").proxy();

	rustc = new SharedObject.SharedObjectRef("rustc").proxy();

	// tree -h
	await term.writeln("$ tree -h");
	await tree("-h");

	// tree /
	await term.writeln("\n$ tree /");
	await tree("/");

	// rustc -h
	await term.writeln("\n$ rustc -h");
	await rustc("-h");

	// rustc /hello.rs --sysroot /sysroot --target wasm32-wasip1-threads -Csave-temps --out-dir /tmp
	await term.writeln(
		"\n$ rustc /hello.rs --sysroot /sysroot --target wasm32-wasip1-threads -Csave-temps --out-dir /tmp",
	);
	try {
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

	// tree /
	await term.writeln("\n$ tree /");
	await tree("/");
};
