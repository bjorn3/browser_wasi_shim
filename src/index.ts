import WASI, { WASIProcExit } from "./wasi.js";
export { WASI, WASIProcExit };

export { Fd } from "./fd.js";
export { Inode } from "./inode.js";
export {
  File,
  SyncOPFSFile,
  Directory,
  OpenFile,
  OpenDirectory,
  OpenSyncOPFSFile,
  PreopenDirectory,
  ConsoleStdout,
} from "./fs_core.js";
export { strace } from "./strace.js";
export * as wasi from "./wasi_defs.js";
