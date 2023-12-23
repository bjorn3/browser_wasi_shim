/* eslint @typescript-eslint/no-unused-vars:0 */
import * as wasi from "./wasi_defs.js";
import { Fd } from "./fd.js";

export abstract class Inode {
  abstract path_open(
    oflags: number,
    fs_rights_base: bigint,
    fd_flags: number,
  ): { ret: number; fd_obj: Fd | null };

  abstract stat(): wasi.Filestat;
}
