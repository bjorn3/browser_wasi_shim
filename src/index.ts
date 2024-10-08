import WASI, { WASIProcExit } from "./wasi.js";
export { WASI, WASIProcExit };

export { Fd, Inode } from "./fd.js";
export {
  File,
  Directory,
  OpenFile,
  OpenDirectory,
  PreopenDirectory,
  ConsoleStdout,
} from "./fs_mem.js";
export { SyncOPFSFile, OpenSyncOPFSFile } from "./fs_opfs.js";
export { strace } from "./strace.js";
export * as wasi from "./wasi_defs.js";
