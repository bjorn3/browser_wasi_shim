#!/usr/bin/env node

import fs from 'fs/promises';
import { WASI, wasi, strace, OpenFile, File, Directory, PreopenDirectory, Fd, Inode } from "../../../dist/index.js"
import { parseArgs } from "../shared/parseArgs.mjs"
import { walkFs } from "../shared/walkFs.mjs"

class NodeStdout extends Fd {
  constructor(out) {
    super();
    this.out = out;
    this.ino = Inode.issue_ino();
  }

  fd_filestat_get() {
    const filestat = new wasi.Filestat(
      this.ino,
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

function parseDirSpec(dirSpec) {
  const separator = dirSpec.indexOf("::");
  if (separator === -1) {
    return { host: dirSpec, guest: dirSpec };
  }
  const host = dirSpec.slice(0, separator);
  const guest = dirSpec.slice(separator + 2) || ".";
  return { host, guest };
}

async function derivePreopens(dirs) {
  const preopens = [];
  for (const dirSpec of dirs) {
    const { host, guest } = parseDirSpec(dirSpec);
    const contents = await walkFs(host, (name, entry, out) => {
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
    const preopen = new PreopenDirectory(guest, contents);
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
