#!/usr/bin/env node

import fs from 'fs/promises';
import { WASI, wasi, strace, OpenFile, File, Directory, PreopenDirectory, Fd } from "../../../dist/index.js"
import { parseArgs } from "../shared/parseArgs.mjs"
import { walkFs } from "../shared/walkFs.mjs"

class NodeStdout extends Fd {
  constructor(out) {
    super();
    this.out = out;
  }

  fd_filestat_get() {
    const filestat = new wasi.Filestat(
      wasi.FILETYPE_CHARACTER_DEVICE,
      BigInt(0),
    );
    return { ret: 0, filestat };
  }

  fd_fdstat_get() {
    const fdstat = new wasi.Fdstat(wasi.FILETYPE_CHARACTER_DEVICE, 0);
    fdstat.fs_rights_base = BigInt(wasi.RIGHTS_FD_WRITE);
    return { ret: 0, fdstat };
  }

  fd_write(data) {
    this.out.write(data);
    return { ret: 0, nwritten: data.byteLength };
  }
}

async function derivePreopens(dirs) {
  const preopens = [];
  for (let dir of dirs) {
    const contents = await walkFs(dir, (name, entry, out) => {
      switch (entry.kind) {
        case "dir":
          entry = new Directory(entry.contents);
          break;
        case "file":
          entry = new File(entry.buffer);
          break;
        default:
          throw new Error(`Unexpected entry kind: ${entry.kind}`);
      }
      out.set(name, entry);
      return out;
    }, () => new Map())
    const preopen = new PreopenDirectory(dir, contents);
    preopens.push(preopen);
  }
  return preopens;
}

async function runWASI(options) {
  const testFile = options["test-file"]
  if (!testFile) {
    throw new Error("Missing --test-file");
  }

  // arg0 is the given test file
  const args = [testFile].concat(options.arg)
  const fds = [
    new OpenFile(new File([])),
    new NodeStdout(process.stdout),
    new NodeStdout(process.stderr),
  ];
  const preopens = await derivePreopens(options.dir);
  fds.push(...preopens);
  const wasi = new WASI(args, options.env, fds, { debug: false })

  let wasiImport = wasi.wasiImport;
  if (process.env["STRACE"]) {
    wasiImport = strace(wasiImport, []);
  }
  const importObject = { wasi_snapshot_preview1: wasiImport }

  const wasm = await WebAssembly.compile(await fs.readFile(testFile));
  const instance = await WebAssembly.instantiate(wasm, importObject);
  const status = wasi.start(instance);
  process.exit(status);
}

async function main() {
  const options = parseArgs();
  if (options.version) {
    const pkg = JSON.parse(await fs.readFile(new URL("../../../package.json", import.meta.url)));
    console.log(`${pkg.name} v${pkg.version}`);
    return;
  }
  runWASI(options);
}

await main();
