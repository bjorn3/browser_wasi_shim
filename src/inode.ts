/* eslint @typescript-eslint/no-unused-vars:0 */
import * as wasi from "./wasi_defs.js";
import { Fd } from "./fd.js";

export abstract class Inode {
  abstract readonly: boolean;

  abstract path_open(fd_flags: number): { ret: number; fd_obj: Fd | null };

  abstract stat(): wasi.Filestat;

  truncate(): number {
    return wasi.ERRNO_NOTSUP;
  }
}
