/* eslint @typescript-eslint/no-unused-vars:0 */
import * as wasi from "./wasi_defs.js";

export class Fd {
  fd_advise(offset: bigint, len: bigint, advice: number): number {
    return wasi.ERRNO_NOTSUP;
  }
  fd_allocate(offset: bigint, len: bigint): number {
    return wasi.ERRNO_NOTSUP;
  }
  fd_close(): number {
    return 0;
  }
  fd_datasync(): number {
    return wasi.ERRNO_NOTSUP;
  }
  fd_fdstat_get(): { ret: number; fdstat: wasi.Fdstat | null } {
    return { ret: wasi.ERRNO_NOTSUP, fdstat: null };
  }
  fd_fdstat_set_flags(flags: number): number {
    return wasi.ERRNO_NOTSUP;
  }
  fd_fdstat_set_rights(
    fs_rights_base: bigint,
    fs_rights_inheriting: bigint,
  ): number {
    return wasi.ERRNO_NOTSUP;
  }
  fd_filestat_get(): { ret: number; filestat: wasi.Filestat | null } {
    return { ret: wasi.ERRNO_NOTSUP, filestat: null };
  }
  fd_filestat_set_size(size: bigint): number {
    return wasi.ERRNO_NOTSUP;
  }
  fd_filestat_set_times(atim: bigint, mtim: bigint, fst_flags: number): number {
    return wasi.ERRNO_NOTSUP;
  }
  fd_pread(
    view8: Uint8Array,
    iovs: Array<wasi.Iovec>,
    offset: bigint,
  ): { ret: number; nread: number } {
    return { ret: wasi.ERRNO_NOTSUP, nread: 0 };
  }
  fd_prestat_get(): { ret: number; prestat: wasi.Prestat | null } {
    return { ret: wasi.ERRNO_NOTSUP, prestat: null };
  }
  fd_prestat_dir_name(): { ret: number; prestat_dir_name: Uint8Array | null } {
    return { ret: wasi.ERRNO_NOTSUP, prestat_dir_name: null };
  }
  fd_pwrite(
    view8: Uint8Array,
    iovs: Array<wasi.Ciovec>,
    offset: bigint,
  ): { ret: number; nwritten: number } {
    return { ret: wasi.ERRNO_NOTSUP, nwritten: 0 };
  }
  fd_read(
    view8: Uint8Array,
    iovs: Array<wasi.Iovec>,
  ): { ret: number; nread: number } {
    return { ret: wasi.ERRNO_NOTSUP, nread: 0 };
  }
  fd_readdir_single(cookie: bigint): {
    ret: number;
    dirent: wasi.Dirent | null;
  } {
    return { ret: wasi.ERRNO_NOTSUP, dirent: null };
  }
  fd_seek(offset: bigint, whence: number): { ret: number; offset: bigint } {
    return { ret: wasi.ERRNO_NOTSUP, offset: 0n };
  }
  fd_sync(): number {
    return 0;
  }
  fd_tell(): { ret: number; offset: bigint } {
    return { ret: wasi.ERRNO_NOTSUP, offset: 0n };
  }
  fd_write(
    view8: Uint8Array,
    iovs: Array<wasi.Ciovec>,
  ): { ret: number; nwritten: number } {
    return { ret: wasi.ERRNO_NOTSUP, nwritten: 0 };
  }
  path_create_directory(path: string): number {
    return wasi.ERRNO_NOTSUP;
  }
  path_filestat_get(
    flags: number,
    path: string,
  ): { ret: number; filestat: wasi.Filestat | null } {
    return { ret: wasi.ERRNO_NOTSUP, filestat: null };
  }
  path_filestat_set_times(
    flags: number,
    path: string,
    atim: bigint,
    mtim: bigint,
    fst_flags: number,
  ): number {
    return wasi.ERRNO_NOTSUP;
  }
  path_link(
    old_fd: number,
    old_flags: number,
    old_path: string,
    new_path: string,
  ): number {
    return wasi.ERRNO_NOTSUP;
  }
  path_open(
    dirflags: number,
    path: string,
    oflags: number,
    fs_rights_base: bigint,
    fs_rights_inheriting: bigint,
    fd_flags: number,
  ): { ret: number; fd_obj: Fd | null } {
    return { ret: wasi.ERRNO_NOTSUP, fd_obj: null };
  }
  path_readlink(path: string): { ret: number; data: string | null } {
    return { ret: wasi.ERRNO_NOTSUP, data: null };
  }
  path_remove_directory(path: string): number {
    return wasi.ERRNO_NOTSUP;
  }
  path_rename(old_path: string, new_fd: number, new_path: string): number {
    return wasi.ERRNO_NOTSUP;
  }
  path_symlink(old_path: string, new_path: string): number {
    return wasi.ERRNO_NOTSUP;
  }
  path_unlink_file(path: string): number {
    return wasi.ERRNO_NOTSUP;
  }
}
