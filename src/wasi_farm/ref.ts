import type * as wasi from "../wasi_defs.js";
import type { FdCloseSender } from "./sender.js";

export type WASIFarmRefObject = {
  stdin: number | undefined;
  stdout: number | undefined;
  stderr: number | undefined;
  fd_close_receiver: FdCloseSender;
  default_fds: Array<number>;
};

export abstract class WASIFarmRef {
  abstract get_fds_len(): number;
  // please implement this method
  // abstract init_self(sl: WASIFarmRef): WASIFarmRef;

  protected stdin: number | undefined;
  protected stdout: number | undefined;
  protected stderr: number | undefined;

  protected id: number;

  fd_close_receiver: FdCloseSender;

  default_fds: Array<number> = [];

  async send(targets: Array<number>, fd: number): Promise<void> {
    await this.fd_close_receiver.send(targets, fd);
  }

  get(id: number): Array<number> | undefined {
    return this.fd_close_receiver.get(id);
  }

  abstract set_park_fds_map(fds: Array<number>);

  abstract set_id(): number;

  constructor(
    stdin: number | undefined,
    stdout: number | undefined,
    stderr: number | undefined,
    fd_close_receiver: FdCloseSender,
    default_fds?: Array<number>,
  ) {
    this.stdin = stdin;
    this.stdout = stdout;
    this.stderr = stderr;
    this.fd_close_receiver = fd_close_receiver;
    if (default_fds !== undefined) {
      this.default_fds = default_fds;
    }
  }

  get_stdin(): number | undefined {
    return this.stdin;
  }

  get_stdout(): number | undefined {
    return this.stdout;
  }

  get_stderr(): number | undefined {
    return this.stderr;
  }

  abstract fd_advise(fd: number | undefined): number;
  abstract fd_allocate(
    fd: number | undefined,
    offset: bigint,
    len: bigint,
  ): number;
  abstract fd_close(fd: number | undefined): number;
  abstract fd_datasync(fd: number | undefined): number;
  abstract fd_fdstat_get(
    fd: number | undefined,
  ): [wasi.Fdstat | undefined, number];
  abstract fd_fdstat_set_flags(fd: number | undefined, flags: number): number;
  abstract fd_fdstat_set_rights(
    fd: number | undefined,
    fs_rights_base: bigint,
    fs_rights_inheriting: bigint,
  ): number;
  abstract fd_filestat_get(
    fd: number | undefined,
  ): [wasi.Filestat | undefined, number];
  abstract fd_filestat_set_size(fd: number | undefined, size: bigint): number;
  abstract fd_filestat_set_times(
    fd: number | undefined,
    atim: bigint,
    mtim: bigint,
    fst_flags: number,
  ): number;
  abstract fd_pread(
    fd: number | undefined,
    iovs: Uint32Array,
    offset: bigint,
  ): [[number, Uint8Array] | undefined, number];
  abstract fd_prestat_get(
    fd: number | undefined,
  ): [[number, number] | undefined, number];
  abstract fd_prestat_dir_name(
    fd: number | undefined,
    path_len: number,
  ): [Uint8Array | undefined, number];
  abstract fd_pwrite(
    fd: number | undefined,
    iovs: Uint8Array,
    offset: bigint,
  ): [number | undefined, number];
  abstract fd_read(
    fd: number | undefined,
    iovs: Uint32Array,
  ): [[number, Uint8Array] | undefined, number];
  abstract fd_readdir(
    fd: number | undefined,
    limit_buf_len: number,
    cookie: bigint,
  ): [[Uint8Array, number] | undefined, number];
  // abstract fd_renumber(fd: number | undefined, to: number): number;
  abstract fd_seek(
    fd: number | undefined,
    offset: bigint,
    whence: number,
  ): [bigint | undefined, number];
  abstract fd_sync(fd: number | undefined): number;
  abstract fd_tell(fd: number | undefined): [bigint, number];
  abstract fd_write(
    fd: number | undefined,
    iovs: Uint8Array,
  ): [number | undefined, number];
  abstract path_create_directory(
    fd: number | undefined,
    path: Uint8Array,
  ): number;
  abstract path_filestat_get(
    fd: number | undefined,
    flags: number,
    path: Uint8Array,
  ): [wasi.Filestat | undefined, number];
  abstract path_filestat_set_times(
    fd: number | undefined,
    flags: number,
    path: Uint8Array,
    st_atim: bigint,
    st_mtim: bigint,
    fst_flags: number,
  ): number;
  abstract path_link(
    old_fd: number | undefined,
    old_flags: number,
    old_path: Uint8Array,
    new_fd: number | undefined,
    new_path: Uint8Array,
  ): number;
  abstract path_open(
    fd: number | undefined,
    dirflags: number,
    path: Uint8Array,
    oflags: number,
    fs_rights_base: bigint,
    fs_rights_inheriting: bigint,
    fs_flags: number,
  ): [number, number];
  abstract path_readlink(
    fd: number | undefined,
    path: Uint8Array,
    buf_len: number,
  ): [Uint8Array | undefined, number];
  abstract path_remove_directory(
    fd: number | undefined,
    path: Uint8Array,
  ): number;
  abstract path_rename(
    old_fd: number | undefined,
    old_path: Uint8Array,
    new_fd: number | undefined,
    new_path: Uint8Array,
  ): number;
  abstract path_symlink(
    old_path: Uint8Array,
    fd: number | undefined,
    new_path: Uint8Array,
  ): number;
  abstract path_unlink_file(fd: number | undefined, path: Uint8Array): number;
  abstract open_fd_with_buff(
    fd: number | undefined,
    buf: Uint8Array,
  ): [number, number];
}
