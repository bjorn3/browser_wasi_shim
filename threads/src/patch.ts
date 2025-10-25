// I don't know what happened, but this file must be here for some reason.
// Maybe it's a bug in the somewhere?

import { wasi } from "@bjorn3/browser_wasi_shim";

export function gen_wasi_filestat(
  dev: bigint,
  ino: bigint,
  filetype: number,
  nlink: bigint,
  size: bigint,
  atim: bigint,
  mtim: bigint,
  ctim: bigint,
): wasi.Filestat {
  const file_stat = new wasi.Filestat(ino, filetype, size);
  file_stat.dev = dev;
  file_stat.ino = ino;
  file_stat.filetype = filetype;
  file_stat.nlink = nlink;
  file_stat.size = size;
  file_stat.atim = atim;
  file_stat.mtim = mtim;
  file_stat.ctim = ctim;
  return file_stat;
}
