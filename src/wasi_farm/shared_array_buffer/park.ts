import { Fd } from "../../fd.js";
import * as wasi from "../../wasi_defs.js";
import { AllocatorUseArrayBuffer } from "./allocator.js";
import { WASIFarmPark } from "../park.js";
import { WASIFarmRefUseArrayBufferObject } from "./ref.js";
import { FdCloseSender } from "../sender.js";
import { FdCloseSenderUseArrayBuffer } from "./fd_close_sender.js";
import { get_func_name_from_number } from "./util.js";

export const fd_func_sig_u32_size: number = 18;
export const fd_func_sig_bytes: number = fd_func_sig_u32_size * 4;

export class WASIFarmParkUseArrayBuffer extends WASIFarmPark {
  private allocator: AllocatorUseArrayBuffer;

  // args and env do not change, so copying them is fine.
  // Functions that do not depend on fds are skipped.
  // Since it is wasm32, the pointer is u32.
  // errno is u8.
  // https://github.com/WebAssembly/WASI/blob/4feaf733e946c375b610cc5d39ea2e1a68046e62/legacy/preview1/docs.md
  // The first item is the function signature, and the second (if it exists) represents data that must be communicated in Park. If they are the same, it is not written.
  // From here, direct access to fd begins.
  // fd_advise: (fd: u32, offset: u64, len: u64, advice: u8) => errno;
  //    (fd: u32) => errno;
  // fd_allocate: (fd: u32, offset: u64, len: u64) => errno;
  // fd_close: (fd: u32) => errno;
  // fd_datasync: (fd: u32) => errno;
  // fd_fdstat_get: (fd: u32, fdstat_ptr: pointer) => errno;
  //    (fd: u32) => [wasi.Fdstat(u32 * 6)], errno];
  // fd_fdstat_set_flags: (fd: u32, flags: u16) => errno;
  // fd_fdstat_set_rights: (fd: u32, fs_rights_base: u64, fs_rights_inheriting: u64) => errno;
  // fd_filestat_get: (fd: u32, filestat_ptr: pointer) => errno;
  //    (fd: u32) => [wasi.Filestat(u32 * 16)], errno];
  // fd_filestat_set_size: (fd: u32, size: u64) => errno;
  // fd_filestat_set_times: (fd: u32, atim: u64, mtim: u64, fst_flags: u16) => errno;
  // fd_pread: (fd: u32, iovs_ptr: pointer, iovs_len: u32, offset: u64) => [u32, errno];
  //    use share_arrays_memory;
  //    (fd: u32, iovs_ptr: pointer, iovs_len: u32, offset: u64) => [u32, data_ptr, errno];
  // fd_prestat_get: (fd: u32, prestat_ptr: pointer) => errno;
  //    (fd: u32) => [wasi.Prestat(u32 * 2)], errno];
  // fd_prestat_dir_name: (fd: u32, path_ptr: pointer, path_len: u32) => errno;
  //    (fd: u32, path_len: u32) => [path_ptr: pointer, path_len: u32, errno];
  // fd_pwrite: (fd: u32, iovs_ptr: pointer, iovs_len: u32, offset: u64) => [u32, errno];
  //    use share_arrays_memory;
  //    (fd: u32, write_data: pointer, write_data_len: u32, offset: u64) => [u32, errno];
  // fd_read: (fd: u32, iovs_ptr: pointer, iovs_len: u32) => [u32, errno];
  //    use share_arrays_memory;
  //    (fd: u32, iovs_ptr: pointer, iovs_len: u32) => [u32, data_ptr, errno];
  // fd_readdir: (fd: u32, buf_ptr: pointer, buf_len: u32, cookie: u64) => [u32, errno];
  //    use share_arrays_memory;
  //    (fd: u32, buf_len: u32, cookie: u64) => [buf_ptr: pointer, buf_len: u32, buf_used: u32, errno];
  // fd_renumber: (fd: u32, to: u32) => errno;
  // fd_seek: (fd: u32, offset: i64, whence: u8) => [u64, errno];
  // fd_sync: (fd: u32) => errno;
  // fd_tell: (fd: u32) => [u64, errno];
  // fd_write: (fd: u32, iovs_ptr: pointer, iovs_len: u32) => [u32, errno];
  //    use share_arrays_memory;
  //    (fd: u32, write_data: pointer, write_data_len: u32) => [u32, errno];
  // path_create_directory: (fd: u32, path_ptr: pointer, path_len: u32) => errno;
  // path_filestat_get: (fd: u32, flags: u32, path_ptr: pointer, path_len: u32) => [wasi.Filestat(u32 * 16), errno];
  // path_filestat_set_times: (fd: u32, flags: u32, path_ptr: pointer, path_len: u32, atim: u64, mtim: u64, fst_flags: u16) => errno;
  // path_link: (old_fd: u32, old_flags: u32, old_path_ptr: pointer, old_path_len: u32, new_fd: u32, new_path_ptr: pointer, new_path_len: u32) => errno;
  // path_open: (fd: u32, dirflags: u32, path_ptr: pointer, path_len: u32, oflags: u32, fs_rights_base: u64, fs_rights_inheriting: u64, fdflags: u16) => [u32, errno];
  // note: fdsにpushするが、既存のfdに影響しないので、競合しない。
  // path_readlink: (fd: u32, path_ptr: pointer, path_len: u32, buf_ptr: pointer, buf_len: u32) => [u32, errno];
  //    use share_arrays_memory;
  //    (fd: u32, path_ptr: pointer, path_len: u32, buf_len: u32) => [buf_len: u32, data_ptr: pointer, data_len: u32, errno];
  // path_remove_directory: (fd: u32, path_ptr: pointer, path_len: u32) => errno;
  // path_rename: (old_fd: u32, old_path_ptr: pointer, old_path_len: u32, new_fd: u32, new_path_ptr: pointer, new_path_len: u32) => errno;
  // path_symlink: (old_path_ptr: pointer, old_path_len: u32, fd: u32, new_path_ptr: pointer, new_path_len: u32) => errno;
  // path_unlink_file: (fd: u32, path_ptr: pointer, path_len: u32) => errno;

  // Lock when you want to use fd
  // Array<[lock, call_func]>
  private lock_fds: SharedArrayBuffer;

  // 1 bytes: fds.length
  // 1 bytes: wasi_farm_ref num(id)
  // Actually, as long as it is working properly, fds.length is not used
  private fds_len_and_num: SharedArrayBuffer;

  // listen promise keep
  private listen_fds: Array<Promise<void>> = [];

  // The largest size is u32 * 18 + 1
  // Alignment is troublesome, so make it u32 * 18 + 4
  // In other words, one size is 76 bytes
  private fd_func_sig: SharedArrayBuffer;

  // listen base handle keep
  private listen_base_handle: Promise<void>;

  // listen base lock and call etc
  private base_func_util: SharedArrayBuffer;

  // tell other processes that the file descriptor has been closed
  private fd_close_receiver: FdCloseSender;

  // this is not send by postMessage,
  // so it is not necessary to keep shared_array_buffer
  // this class is not used by user,
  // to avoid mistakes, all constructors are now required to be passed in.
  constructor(
    fds: Array<Fd>,
    // stdin fd number
    stdin: number | undefined,
    // stdout fd number
    stdout: number | undefined,
    // stderr fd number
    stderr: number | undefined,
    // wasi_farm_ref default allow fds
    default_allow_fds: Array<number>,
    allocator_size?: number,
  ) {
    super(
      fds,
      stdin,
      stdout,
      stderr,
      default_allow_fds,
    );

    if (allocator_size === undefined) {
      this.allocator = new AllocatorUseArrayBuffer();
    } else {
      this.allocator = new AllocatorUseArrayBuffer(new SharedArrayBuffer(allocator_size));
    }
    const max_fds_len = 128;
    this.lock_fds = new SharedArrayBuffer(4 * max_fds_len * 3);
    this.fd_func_sig = new SharedArrayBuffer(fd_func_sig_u32_size * 4 * max_fds_len);
    this.fds_len_and_num = new SharedArrayBuffer(8);

    const view = new Int32Array(this.fds_len_and_num);
    Atomics.store(view, 0, fds.length);
    Atomics.store(view, 1, 0);

    this.fd_close_receiver = new FdCloseSenderUseArrayBuffer();
    this.base_func_util = new SharedArrayBuffer(24);
  }

  /// Send this return by postMessage.
  get_ref(): WASIFarmRefUseArrayBufferObject {
    return {
      allocator: this.allocator,
      lock_fds: this.lock_fds,
      fds_len_and_num: this.fds_len_and_num,
      fd_func_sig: this.fd_func_sig,
      base_func_util: this.base_func_util,
      fd_close_receiver: this.fd_close_receiver,
      stdin: this.stdin,
      stdout: this.stdout,
      stderr: this.stderr,
      default_fds: this.default_allow_fds,
    };
  }

  // abstract methods implementation
  // from fd set ex) path_open
  // received and listen the fd
  // and set fds.length
  async notify_set_fd(fd: number) {
    if (this.fds[fd] == undefined) {
      throw new Error("fd is not defined");
    }
    if (fd >= 128) {
      throw new Error("fd is too big. expand is not supported yet");
    }
    if (this.listen_fds[fd] !== undefined) {
      if (this.listen_fds[fd] instanceof Promise) {
        console.warn("fd is already set yet");
        await this.listen_fds[fd];
      }
    }
    this.listen_fds[fd] = this.listen_fd(fd);

    const view = new Int32Array(this.fds_len_and_num);
    Atomics.store(view, 0, this.fds.length);
    // const len = Atomics.store(view, 0, this.fds.length);
    // console.log("notify_set_fd: len: ", len);
  }

  // abstract methods implementation
  // called by fd close ex) fd_close
  async notify_rm_fd(fd: number) {
    (async () => {
      await this.listen_fds[fd];
      this.listen_fds[fd] = undefined;
    })()

    // console.log("notify_rm_fd", fd);
    // console.log("fds", this.fds);
    // console.log("fds_map", this.fds_map);

    // console.log("notify_rm_fd: fds_map", this.fds_map);
    // console.log("notify_rm_fd: fd", fd);

    // console.log("notify_rm_fd: fds_map[fd]", [...this.fds_map[fd]]);

    await this.fd_close_receiver.send(this.fds_map[fd], fd);

    this.fds_map[fd] = [];
  }

  // abstract methods implementation
  // wait to close old listener
  can_set_new_fd(fd: number): [boolean, Promise<void> | undefined] {
    if (this.listen_fds[fd] instanceof Promise) {
      return [false, this.listen_fds[fd]];
    } else {
      return [true, undefined];
    }
  }

  // listen all fds and base
  // Must be called before was_ref_id is instantiated
  listen() {
    this.listen_fds = [];
    for (let n = 0; n < this.fds.length; n++) {
      this.listen_fds.push(this.listen_fd(n));
    }
    this.listen_base_handle = this.listen_base();
  }

  // listen base
  // ex) set_fds_map
  // if close fd and send to other process,
  // it need targets wasi_farm_ref id
  // so, set fds_map
  async listen_base() {
    const lock_view = new Int32Array(this.base_func_util);
    Atomics.store(lock_view, 0, 0);
    Atomics.store(lock_view, 1, 0);

    // eslint-disable-next-line no-constant-condition
    while(true) {
      try {
        let lock: "not-equal" | "timed-out" | "ok";

        const { value } = Atomics.waitAsync(lock_view, 1, 0);
        if ( value instanceof Promise) {
          lock = await value;
        } else {
          lock = value;
        }
        if (lock === "timed-out") {
          throw new Error("timed-out");
        }

        const func_number = Atomics.load(lock_view, 2);

        switcher: switch (func_number) {
          // set_fds_map: (fds_ptr: u32, fds_len: u32);
          case 0: {
            // console.log("set_fds_map");
            const ptr = Atomics.load(lock_view, 3);
            const len = Atomics.load(lock_view, 4);
            // console.log("set_fds_map", ptr, len);
            const data = new Uint32Array(this.allocator.get_memory(ptr, len));
            this.allocator.free(ptr, len);
            const wasi_farm_ref_id = Atomics.load(lock_view, 5);

            // console.log("listen_base set_fds_map", data, "from", wasi_farm_ref_id);

            // console.log("listen_base fds_map", this.fds_map);

            for (let i = 0; i < len / 4; i++) {
              const fd = data[i];
              if (this.fds_map[fd] === undefined) {
                this.fds_map[fd] = [];
                console.error("listen_base fd is not defined");
              }
              this.fds_map[fd].push(wasi_farm_ref_id);
              // console.log("this.fds_map", this.fds_map);
              // console.log("this.fds_map[fd]", this.fds_map[fd]);
              // console.log("this.fds_map[1]", this.fds_map[1]);
              // console.log("fd", fd, "wasi_farm_ref_id", wasi_farm_ref_id);
            }

            // console.log("listen_base fds_map", this.fds_map);

            break switcher;
          }
        }

        const old_call_lock = Atomics.exchange(lock_view, 1, 0);
        if (old_call_lock !== 1) {
          throw new Error("Lock is already set");
        }
        const num = Atomics.notify(lock_view, 1, 1);
        if (num !== 1) {
          if (num === 0) {
            console.warn("notify failed, waiter is late");
            continue;
          }
          throw new Error("notify failed: " + num);
        }
      } catch (e) {
        console.error("error", e);
        Atomics.store(lock_view, 1, 0);
        Atomics.notify(lock_view, 1, 1);
      }
    }
  }

  // listen fd
  async listen_fd(fd_n: number) {
    const lock_view = new Int32Array(this.lock_fds, fd_n * 12);
    const bytes_offset = fd_n * fd_func_sig_bytes;
    const func_sig_view_u8 = new Uint8Array(this.fd_func_sig, bytes_offset);
    const func_sig_view_u16 = new Uint16Array(this.fd_func_sig, bytes_offset);
    const func_sig_view_i32 = new Int32Array(this.fd_func_sig, bytes_offset);
    const func_sig_view_u32 = new Int32Array(this.fd_func_sig, bytes_offset);
    const func_sig_view_u64 = new BigUint64Array(this.fd_func_sig, bytes_offset);
    const errno_offset = fd_func_sig_u32_size - 1;
    Atomics.store(lock_view, 0, 0);
    Atomics.store(lock_view, 1, 0);
    Atomics.store(func_sig_view_i32, errno_offset, -1);

    // eslint-disable-next-line no-constant-condition
    while (true) {
      try {
        let lock: "not-equal" | "timed-out" | "ok";

        const { value } = Atomics.waitAsync(lock_view, 1, 0);
        if ( value instanceof Promise) {
          // console.log("listen", fd_n, 1);
          lock = await value;
        } else {
          lock = value;
        }
        if (lock === "timed-out") {
          throw new Error("timed-out");
        }

        const func_lock = Atomics.load(lock_view, 1);

        if (func_lock !== 1) {
          throw new Error("func_lock is already set: " + func_lock);
        }

        // console.log("func_lock", func_lock);

        // console.log("called", fd_n, 1);

        const set_error = (errno: number) => {
          // console.log("set_error", errno, "pointer", errno_offset);
          Atomics.store(func_sig_view_i32, errno_offset, errno);
        }

        const func_number = Atomics.load(func_sig_view_u32, 0);

        // console.log("called: func: ", get_func_name_from_number(func_number), "fd: ", fd_n);

        switcher: switch (func_number) {
          // fd_advise: (fd: u32) => errno;
          case 7: {
            const fd = Atomics.load(func_sig_view_u32, 1);

            const error = this.fd_advise(fd);

            set_error(error);
            break switcher;
          }
          // fd_allocate: (fd: u32, offset: u64, len: u64) => errno;
          case 8: {
            const fd = Atomics.load(func_sig_view_u32, 1);
            const offset = Atomics.load(func_sig_view_u64, 1);
            const len = Atomics.load(func_sig_view_u64, 2);

            const error = this.fd_allocate(fd, offset, len);

            set_error(error);
            break switcher;
          }
          // fd_close: (fd: u32) => errno;
          case 9: {
            const fd = Atomics.load(func_sig_view_u32, 1);

            const error = await this.fd_close(fd);

            // console.log("fd_close", fd, error);

            set_error(error);
            break switcher;
          }
          // fd_datasync: (fd: u32) => errno;
          case 10: {
            const fd = Atomics.load(func_sig_view_u32, 1);

            const error = this.fd_datasync(fd);

            set_error(error);
            break switcher;
          }
          // fd_fdstat_get: (fd: u32) => [wasi.Fdstat(u32 * 6)], errno];
          case 11: {
            const fd = Atomics.load(func_sig_view_u32, 1);

            const [ fdstat, ret ] = this.fd_fdstat_get(fd);

            if (fdstat) {
                Atomics.store(func_sig_view_u8, 0, fdstat.fs_filetype);
                Atomics.store(func_sig_view_u16, 2, fdstat.fs_flags);
                Atomics.store(func_sig_view_u64, 1, fdstat.fs_rights_base);
                Atomics.store(func_sig_view_u64, 2, fdstat.fs_rights_inherited);
            }
            set_error(ret);
            break switcher;
          }
          // fd_fdstat_set_flags: (fd: u32, flags: u16) => errno;
          case 12: {
            const fd = Atomics.load(func_sig_view_u32, 1);
            const flags = Atomics.load(func_sig_view_u16, 4);

            const error = this.fd_fdstat_set_flags(fd, flags);

            set_error(error);
            break switcher;
          }
          // fd_fdstat_set_rights: (fd: u32, fs_rights_base: u64, fs_rights_inheriting: u64) => errno;
          case 13: {
            const fd = Atomics.load(func_sig_view_u32, 1);
            const fs_rights_base = Atomics.load(func_sig_view_u64, 1);
            const fs_rights_inheriting = Atomics.load(func_sig_view_u64, 2);

            const error = this.fd_fdstat_set_rights(fd, fs_rights_base, fs_rights_inheriting);

            set_error(error);
            break switcher;
          }
          // fd_filestat_get: (fd: u32) => [wasi.Filestat(u32 * 16)], errno];
          case 14: {
            const fd = Atomics.load(func_sig_view_u32, 1);

            const [ filestat, ret ] = this.fd_filestat_get(fd);

            if (filestat) {
                Atomics.store(func_sig_view_u64, 0, filestat.dev);
                Atomics.store(func_sig_view_u64, 1, filestat.ino);
                Atomics.store(func_sig_view_u8, 16, filestat.filetype);
                Atomics.store(func_sig_view_u64, 3, filestat.nlink);
                Atomics.store(func_sig_view_u64, 4, filestat.size);
                Atomics.store(func_sig_view_u64, 5, filestat.atim);
                Atomics.store(func_sig_view_u64, 6, filestat.mtim);
                Atomics.store(func_sig_view_u64, 7, filestat.ctim);
            }

            set_error(ret);
            break switcher;
          }
          // fd_filestat_set_size: (fd: u32, size: u64) => errno;
          case 15: {
            const fd = Atomics.load(func_sig_view_u32, 1);
            const size = Atomics.load(func_sig_view_u64, 1);

            const error = this.fd_filestat_set_size(fd, size);

            set_error(error);
            break switcher;
          }
          // fd_filestat_set_times: (fd: u32, atim: u64, mtim: u64, fst_flags: u16) => errno;
          case 16: {
            const fd = Atomics.load(func_sig_view_u32, 1);
            const atim = Atomics.load(func_sig_view_u64, 1);
            const mtim = Atomics.load(func_sig_view_u64, 2);
            const fst_flags = Atomics.load(func_sig_view_u16, 12);

            const error = this.fd_filestat_set_times(fd, atim, mtim, fst_flags);

            set_error(error);
            break switcher;
          }
          // fd_pread: (fd: u32, iovs_ptr: pointer, iovs_len: u32, offset: u64) => [u32, data_ptr, errno];
          case 17: {
            const fd = Atomics.load(func_sig_view_u32, 1);
            const iovs_ptr = Atomics.load(func_sig_view_u32, 2);
            const iovs_ptr_len = Atomics.load(func_sig_view_u32, 3);
            const offset = Atomics.load(func_sig_view_u64, 2);
            const data = new Uint32Array(this.allocator.get_memory(iovs_ptr, iovs_ptr_len));
            this.allocator.free(iovs_ptr, iovs_ptr_len);

            const iovecs = new Array<wasi.Iovec>();
            for (let i = 0; i < iovs_ptr_len; i += 8) {
              const iovec = new wasi.Iovec();
              iovec.buf = data[i * 2];
              iovec.buf_len = data[i * 2 + 1];
              iovecs.push(iovec);
            }

            const [[nread, buffer8], error] = this.fd_pread(fd, iovecs, offset);

            if (nread !== undefined) {
              Atomics.store(func_sig_view_u32, 0, nread);
            }
            if (buffer8) {
              await this.allocator.async_write(buffer8, this.fd_func_sig, fd * fd_func_sig_u32_size + 1);
            }
            set_error(error);
            break switcher;
          }
          // fd_prestat_get: (fd: u32) => [wasi.Prestat(u32 * 2)], errno];
          case 18: {
            const fd = Atomics.load(func_sig_view_u32, 1);

            const [ prestat, ret ] = this.fd_prestat_get(fd);

            // console.log("fd_prestat_get", prestat, ret);

            if (prestat) {
              Atomics.store(func_sig_view_u32, 0, prestat.tag);
              Atomics.store(func_sig_view_u32, 1, prestat.inner.pr_name.byteLength);
            }
            set_error(ret);
            break switcher;
          }
          // fd_prestat_dir_name: (fd: u32, path_len: u32) => [path_ptr: pointer, path_len: u32, errno];
          case 19: {
            const fd = Atomics.load(func_sig_view_u32, 1);
            const path_len = Atomics.load(func_sig_view_u32, 2);

            const [ prestat_dir_name, ret ] = this.fd_prestat_dir_name(fd, path_len);

            // console.log("fd_prestat_dir_name: park: ", prestat_dir_name);

            if (prestat_dir_name && (ret === wasi.ERRNO_SUCCESS || ret === wasi.ERRNO_NAMETOOLONG)) {
              await this.allocator.async_write(prestat_dir_name, this.fd_func_sig, fd * fd_func_sig_u32_size);
            }
            set_error(ret);
            break switcher;
          }
          // fd_pwrite: (fd: u32, write_data: pointer, write_data_len: u32, offset: u64) => [u32, errno];
          case 20: {
            const fd = Atomics.load(func_sig_view_u32, 1);
            const write_data_ptr = Atomics.load(func_sig_view_u32, 2);
            const write_data_len = Atomics.load(func_sig_view_u32, 3);
            const offset = Atomics.load(func_sig_view_u64, 2);

            const data = new Uint8Array(this.allocator.get_memory(write_data_ptr, write_data_len));
            this.allocator.free(write_data_ptr, write_data_len);

            const [nwritten, error] = this.fd_pwrite(fd, data, offset);

            if (nwritten !== undefined) {
              Atomics.store(func_sig_view_u32, 0, nwritten);
            }
            set_error(error);
            break switcher;
          }
          // fd_read: (fd: u32, iovs_ptr: pointer, iovs_len: u32) => [u32, data_ptr, errno];
          case 21: {
            const fd = Atomics.load(func_sig_view_u32, 1);
            const iovs_ptr = Atomics.load(func_sig_view_u32, 2);
            const iovs_ptr_len = Atomics.load(func_sig_view_u32, 3);
            // console.log("fd_read: park: iovs: Uint8Array", this.allocator.get_memory(iovs_ptr, iovs_ptr_len));
            // console.log("ptr_len", iovs_ptr_len);
            const iovs = new Uint32Array(this.allocator.get_memory(iovs_ptr, iovs_ptr_len));
            this.allocator.free(iovs_ptr, iovs_ptr_len);

            // console.log("fd_read: park: iovs", iovs);

            const iovecs = new Array<wasi.Iovec>();
            for (let i = 0; i < iovs_ptr_len; i += 8) {
              const iovec = new wasi.Iovec();
              iovec.buf = iovs[i * 2];
              iovec.buf_len = iovs[i * 2 + 1];
              iovecs.push(iovec);
            }

            // console.log("fd_read: park: iovecs", iovecs);

            const [[nread, buffer8], error] = this.fd_read(fd, iovecs);

            // console.log("fd_read: park: buffer8", new TextDecoder().decode(buffer8));

            if (nread !== undefined) {
              Atomics.store(func_sig_view_u32, 0, nread);
            }
            if (buffer8) {
              await this.allocator.async_write(buffer8, this.fd_func_sig, fd * fd_func_sig_u32_size + 1);
            }
            set_error(error);
            break switcher;
          }
          // fd_readdir: (fd: u32, buf_len: u32, cookie: u64) => [buf_ptr: pointer, buf_len: u32, buf_used: u32, errno];
          case 22: {
            const fd = Atomics.load(func_sig_view_u32, 1);
            const buf_len = Atomics.load(func_sig_view_u32, 2);
            const cookie = Atomics.load(func_sig_view_u64, 2);

            const [[array, buf_used], error] = this.fd_readdir(fd, buf_len, cookie);

            if (array) {
              await this.allocator.async_write(array, this.fd_func_sig, fd * fd_func_sig_u32_size);
            }
            if (buf_used !== undefined) {
              Atomics.store(func_sig_view_u32, 2, buf_used);
            }
            set_error(error);
            break switcher;
          }
          // fd_seek: (fd: u32, offset: i64, whence: u8) => [u64, errno];
          case 24: {
            const fd = Atomics.load(func_sig_view_u32, 1);
            const offset = Atomics.load(func_sig_view_u64, 1);
            const whence = Atomics.load(func_sig_view_u8,16);

            const [new_offset, error] = this.fd_seek(fd, offset, whence);

            if (new_offset !== undefined) {
              Atomics.store(func_sig_view_u64, 0, new_offset);
            }
            set_error(error);
            break switcher;
          }
          // fd_sync: (fd: u32) => errno;
          case 25: {
            const fd = Atomics.load(func_sig_view_u32, 1);

            const error = this.fd_sync(fd);

            set_error(error);
            break switcher;
          }
          // fd_tell: (fd: u32) => [u64, errno];
          case 26: {
            const fd = Atomics.load(func_sig_view_u32, 1);

            const [offset, error] = this.fd_tell(fd);

            if (offset !== undefined) {
              Atomics.store(func_sig_view_u64, 0, offset);
            }
            set_error(error);
            break switcher;
          }
          // fd_write: (fd: u32, write_data: pointer, write_data_len: u32) => [u32, errno];
          case 27: {
            const fd = Atomics.load(func_sig_view_u32, 1);
            const write_data_ptr = Atomics.load(func_sig_view_u32, 2);
            const write_data_len = Atomics.load(func_sig_view_u32, 3);

            const data = new Uint8Array(this.allocator.get_memory(write_data_ptr, write_data_len));
            this.allocator.free(write_data_ptr, write_data_len);

            // console.log("allocator", this.allocator);

            // console.log("fd_write: park: write_data", new TextDecoder().decode(data));

            const [nwritten, error] = this.fd_write(fd, data);

            // console.log("fd_write: park: error", error);

            if (nwritten !== undefined) {
              Atomics.store(func_sig_view_u32, 0, nwritten);
            }
            set_error(error);
            break switcher;
          }
          // path_create_directory: (fd: u32, path_ptr: pointer, path_len: u32) => errno;
          case 28: {
            const fd = Atomics.load(func_sig_view_u32, 1);
            const path_ptr = Atomics.load(func_sig_view_u32, 2);
            const path_len = Atomics.load(func_sig_view_u32, 3);

            const path = new Uint8Array(this.allocator.get_memory(path_ptr, path_len));
            const path_str = new TextDecoder().decode(path);
            this.allocator.free(path_ptr, path_len);

            const error = this.path_create_directory(fd, path_str);

            set_error(error);
            break switcher;
          }
          // path_filestat_get: (fd: u32, flags: u32, path_ptr: pointer, path_len: u32) => [wasi.Filestat(u32 * 16), errno];
          case 29: {
            const fd = Atomics.load(func_sig_view_u32, 1);
            const flags = Atomics.load(func_sig_view_u32, 2);
            const path_ptr = Atomics.load(func_sig_view_u32, 3);
            const path_len = Atomics.load(func_sig_view_u32, 4);

            const path = new Uint8Array(this.allocator.get_memory(path_ptr, path_len));
            const path_str = new TextDecoder().decode(path);
            this.allocator.free(path_ptr, path_len);

            const [filestat, ret] = this.path_filestat_get(fd, flags, path_str);

            if (filestat) {
              Atomics.store(func_sig_view_u64, 0, filestat.dev);
              Atomics.store(func_sig_view_u64, 1, filestat.ino);
              Atomics.store(func_sig_view_u8,16, filestat.filetype);
              Atomics.store(func_sig_view_u64, 3, filestat.nlink);
              Atomics.store(func_sig_view_u64, 4, filestat.size);
              Atomics.store(func_sig_view_u64, 5, filestat.atim);
              Atomics.store(func_sig_view_u64, 6, filestat.mtim);
              Atomics.store(func_sig_view_u64, 7, filestat.ctim);
            }
            set_error(ret);
            break switcher;
          }
          // path_filestat_set_times: (fd: u32, flags: u32, path_ptr: pointer, path_len: u32, atim: u64, mtim: u64, fst_flags: u16) => errno;
          case 30: {
            const fd = Atomics.load(func_sig_view_u32, 1);
            const flags = Atomics.load(func_sig_view_u32, 2);
            const path_ptr = Atomics.load(func_sig_view_u32, 3);
            const path_len = Atomics.load(func_sig_view_u32, 4);
            const atim = Atomics.load(func_sig_view_u64, 3);
            const mtim = Atomics.load(func_sig_view_u64, 4);
            const fst_flags = Atomics.load(func_sig_view_u16, 12);

            const path = new Uint8Array(this.allocator.get_memory(path_ptr, path_len));
            const path_str = new TextDecoder().decode(path);
            this.allocator.free(path_ptr, path_len);

            const error = this.path_filestat_set_times(fd, flags, path_str, atim, mtim, fst_flags);

            set_error(error);
            break switcher;
          }
          // path_link: (old_fd: u32, old_flags: u32, old_path_ptr: pointer, old_path_len: u32, new_fd: u32, new_path_ptr: pointer, new_path_len: u32) => errno;
          case 31: {
            const old_fd = Atomics.load(func_sig_view_u32, 1);
            const old_flags = Atomics.load(func_sig_view_u32, 2);
            const old_path_ptr = Atomics.load(func_sig_view_u32, 3);
            const old_path_len = Atomics.load(func_sig_view_u32, 4);
            const new_fd = Atomics.load(func_sig_view_u32, 5);
            const new_path_ptr = Atomics.load(func_sig_view_u32, 6);
            const new_path_len = Atomics.load(func_sig_view_u32, 7);

            const old_path = new Uint8Array(this.allocator.get_memory(old_path_ptr, old_path_len));
            const old_path_str = new TextDecoder().decode(old_path);
            this.allocator.free(old_path_ptr, old_path_len);
            const new_path = new Uint8Array(this.allocator.get_memory(new_path_ptr, new_path_len));
            const new_path_str = new TextDecoder().decode(new_path);
            this.allocator.free(new_path_ptr, new_path_len);

            const error = this.path_link(old_fd, old_flags, old_path_str, new_fd, new_path_str);

            set_error(error);
            break switcher;
          }
          // path_open: (fd: u32, dirflags: u32, path_ptr: pointer, path_len: u32, oflags: u32, fs_rights_base: u64, fs_rights_inheriting: u64, fdflags: u16) => [u32, errno];
          case 32: {
            const fd = Atomics.load(func_sig_view_u32, 1);
            const dirflags = Atomics.load(func_sig_view_u32, 2);
            const path_ptr = Atomics.load(func_sig_view_u32, 3);
            const path_len = Atomics.load(func_sig_view_u32, 4);
            const oflags = Atomics.load(func_sig_view_u32, 5);
            const fs_rights_base = Atomics.load(func_sig_view_u64, 3);
            const fs_rights_inheriting = Atomics.load(func_sig_view_u64, 4);
            const fd_flags = Atomics.load(func_sig_view_u16, 20);

            const path = new Uint8Array(this.allocator.get_memory(path_ptr, path_len));
            const path_str = new TextDecoder().decode(path);
            this.allocator.free(path_ptr, path_len);

            const [opened_fd, error] = await this.path_open(fd, dirflags, path_str, oflags, fs_rights_base, fs_rights_inheriting, fd_flags);

            // console.log("path_open: opend_fd", opened_fd, error);

            if (opened_fd !== undefined) {
              Atomics.store(func_sig_view_u32, 0, opened_fd);
            }
            set_error(error);
            break switcher;
          }
          // path_readlink: (fd: u32, path_ptr: pointer, path_len: u32, buf_len: u32) => [buf_len: u32, data_ptr: pointer, data_len: u32, errno];
          case 33: {
            const fd = Atomics.load(func_sig_view_u32, 1);
            const path_ptr = Atomics.load(func_sig_view_u32, 2);
            const path_len = Atomics.load(func_sig_view_u32, 3);
            const buf_len = Atomics.load(func_sig_view_u32, 4);

            const path = new Uint8Array(this.allocator.get_memory(path_ptr, path_len));
            const path_str = new TextDecoder().decode(path);
            this.allocator.free(path_ptr, path_len);

            const [buf, error] = this.path_readlink(fd, path_str, buf_len);

            if (buf) {
              await this.allocator.async_write(buf, this.fd_func_sig, fd * fd_func_sig_u32_size + 1);
              Atomics.store(func_sig_view_u32, 0, buf.byteLength);
            }
            set_error(error);
            break switcher;
          }
          // path_remove_directory: (fd: u32, path_ptr: pointer, path_len: u32) => errno;
          case 34: {
            const fd = Atomics.load(func_sig_view_u32, 1);
            const path_ptr = Atomics.load(func_sig_view_u32, 2);
            const path_len = Atomics.load(func_sig_view_u32, 3);

            const path = new Uint8Array(this.allocator.get_memory(path_ptr, path_len));
            const path_str = new TextDecoder().decode(path);
            this.allocator.free(path_ptr, path_len);

            const error = this.path_remove_directory(fd, path_str);

            set_error(error);
            break switcher;
          }
          // path_rename: (old_fd: u32, old_path_ptr: pointer, old_path_len: u32, new_fd: u32, new_path_ptr: pointer, new_path_len: u32) => errno;
          case 35: {
            const fd = Atomics.load(func_sig_view_u32, 1);
            const old_path_ptr = Atomics.load(func_sig_view_u32, 2);
            const old_path_len = Atomics.load(func_sig_view_u32, 3);
            const new_fd = Atomics.load(func_sig_view_u32, 4);
            const new_path_ptr = Atomics.load(func_sig_view_u32, 5);
            const new_path_len = Atomics.load(func_sig_view_u32, 6);

            const old_path = new Uint8Array(this.allocator.get_memory(old_path_ptr, old_path_len));
            const old_path_str = new TextDecoder().decode(old_path);
            this.allocator.free(old_path_ptr, old_path_len);
            const new_path = new Uint8Array(this.allocator.get_memory(new_path_ptr, new_path_len));
            const new_path_str = new TextDecoder().decode(new_path);
            this.allocator.free(new_path_ptr, new_path_len);

            const error = this.path_rename(fd, old_path_str, new_fd, new_path_str);

            set_error(error);
            break switcher;
          }
          // path_symlink: (old_path_ptr: pointer, old_path_len: u32, fd: u32, new_path_ptr: pointer, new_path_len: u32) => errno;
          case 36: {
            const old_path_ptr = Atomics.load(func_sig_view_u32, 1);
            const old_path_len = Atomics.load(func_sig_view_u32, 2);
            const fd = Atomics.load(func_sig_view_u32, 3);
            const new_path_ptr = Atomics.load(func_sig_view_u32, 4);
            const new_path_len = Atomics.load(func_sig_view_u32, 5);

            const old_path = new Uint8Array(this.allocator.get_memory(old_path_ptr, old_path_len));
            const old_path_str = new TextDecoder().decode(old_path);
            this.allocator.free(old_path_ptr, old_path_len);
            const new_path = new Uint8Array(this.allocator.get_memory(new_path_ptr, new_path_len));
            const new_path_str = new TextDecoder().decode(new_path);
            this.allocator.free(new_path_ptr, new_path_len);

            set_error(this.path_symlink(old_path_str, fd, new_path_str));
            break switcher;
          }
          // path_unlink_file: (fd: u32, path_ptr: pointer, path_len: u32) => errno;
          case 37: {
            const fd = Atomics.load(func_sig_view_u32, 1);
            const path_ptr = Atomics.load(func_sig_view_u32, 2);
            const path_len = Atomics.load(func_sig_view_u32, 3);

            const path = new Uint8Array(this.allocator.get_memory(path_ptr, path_len));
            const path_str = new TextDecoder().decode(path);
            this.allocator.free(path_ptr, path_len);

            set_error(this.path_unlink_file(fd, path_str));
            break switcher;
          }
          default: {
            throw new Error("Unknown function number: " + func_number);
          }
        }

        const old_call_lock = Atomics.exchange(lock_view, 1, 0);
        if (old_call_lock !== 1) {
          throw new Error("Call is already set: " + old_call_lock + "\nfunc: " + get_func_name_from_number(func_number) + "\nfd: " + fd_n);
        }

        // console.log("called end: func: ", get_func_name_from_number(func_number), "fd: ", fd_n);

        const n = Atomics.notify(lock_view, 1);
        if (n !== 1) {
          if (n === 0) {
            console.warn("notify number is 0. ref is late?");
          } else {
            console.warn("notify number is not 1: " + n);
          }
        }

        if (this.fds[fd_n] === undefined) {
          break;
        }
      } catch (e) {
        console.error(e);

        // sleep 1000ms
        await new Promise((resolve) => setTimeout(resolve, 1000));

        const lock_view = new Int32Array(this.lock_fds);
        Atomics.exchange(lock_view, 1, 0);
        const func_sig_view = new Int32Array(this.fd_func_sig);
        Atomics.exchange(func_sig_view, 16, -1);
      }
    }
  }
}
