import { Fd } from "../fd.js";
import { WASIFarmRefObject } from "./ref.js";
import * as wasi from "../wasi_defs.js";
import { debug } from "../debug.js";

export abstract class WASIFarmPark {
  abstract get_ref(): WASIFarmRefObject;
  abstract listen(): void;
  abstract notify_set_fd(fd: number): void;
  abstract notify_rm_fd(fd: number): void;
  abstract can_set_new_fd(fd: number): [boolean, Promise<void> | undefined];

  protected fds: Array<Fd>;
  protected stdin: number | undefined;
  protected stdout: number | undefined;
  protected stderr: number | undefined;
  protected default_allow_fds: Array<number>;

  constructor(
    fds: Array<Fd>,
    stdin: number | undefined,
    stdout: number | undefined,
    stderr: number | undefined,
    default_allow_fds: Array<number>,
  ) {
    this.fds = fds;
    this.stdin = stdin;
    this.stdout = stdout;
    this.stderr = stderr;
    this.default_allow_fds = default_allow_fds;
    this.fds_map = new Array(fds.length);
    for (let i = 0; i < fds.length; i++) {
      this.fds_map[i] = [];
    }
    // console.log("first fds_map", this.fds_map);
  }

  private get_new_fd_lock = new Array<() => Promise<void>>();

  // fdに対して、現在そのfdにidがアクセス可能かを示す。
  protected fds_map: Array<number[]>;

  // If the reassigned value is accessed after being closed,
  // it will be strange,
  // but the programmer should have written it
  // so that this does not happen in the first place.
  private async get_new_fd(): Promise<[() => Promise<void>, number]> {
    const promise = new Promise<[() => Promise<void>, number]>((resolve) => {
      const len = this.get_new_fd_lock.push(async () => {
        let ret = -1;
        for (let i = 0; i < this.fds.length; i++) {
          if (this.fds[i] == undefined) {
            ret = i;
            break;
          }
        }
        if (ret == -1) {
          ret = this.fds.length;
          // console.log("push_fd", this.fds.length)
          this.fds.push(undefined);
          this.fds_map.push([]);
          // console.log("push_fd", this.fds.length)
        }

        const [can, promise] = this.can_set_new_fd(ret);
        if (!can) {
          await promise;
        }

        // If it's assigned, it's resolved.
        resolve([async () => {
          this.get_new_fd_lock.shift();
          const fn = this.get_new_fd_lock[0];
          if (fn != undefined) {
            fn();
          }
          // assigned and notify
          await this.notify_set_fd(ret);
        }, ret]);
      });
      if (len == 1) {
        this.get_new_fd_lock[0]();
      }
    });
    return promise;
  }

  protected fd_advise(fd: number): number {
    if (this.fds[fd] != undefined) {
      return wasi.ERRNO_SUCCESS;
    } else {
      return wasi.ERRNO_BADF;
    }
  }

  protected fd_allocate(fd: number, offset: bigint, len: bigint): number {
    if (this.fds[fd] != undefined) {
      return this.fds[fd].fd_allocate(offset, len);
    } else {
      return wasi.ERRNO_BADF;
    }
  }

  protected async fd_close(fd: number): Promise<number> {
    if (this.fds[fd] != undefined) {
      const ret = this.fds[fd].fd_close();
      this.fds[fd] = undefined;
      // console.log("fd_close1", fd);
      await this.notify_rm_fd(fd);
      // console.log("fd_close2", fd);
      return ret;
    } else {
      return wasi.ERRNO_BADF;
    }
  }

  protected fd_datasync(fd: number): number {
    if (this.fds[fd] != undefined) {
      return this.fds[fd].fd_sync();
    } else {
      return wasi.ERRNO_BADF;
    }
  }

  protected fd_fdstat_get(fd: number): [wasi.Fdstat | undefined, number] {
    if (this.fds[fd] != undefined) {
      const { ret, fdstat } = this.fds[fd].fd_fdstat_get();
      if (fdstat != null) {
        return [fdstat, ret];
      }
      return [undefined, ret];
    }
    return [undefined, wasi.ERRNO_BADF];
  }

  protected fd_fdstat_set_flags(fd: number, flags: number): number {
    if (this.fds[fd] != undefined) {
      return this.fds[fd].fd_fdstat_set_flags(flags);
    } else {
      return wasi.ERRNO_BADF;
    }
  }

  protected fd_fdstat_set_rights(fd: number, fs_rights_base: bigint, fs_rights_inheriting: bigint): number {
    if (this.fds[fd] != undefined) {
      return this.fds[fd].fd_fdstat_set_rights(fs_rights_base, fs_rights_inheriting);
    } else {
      return wasi.ERRNO_BADF;
    }
  }

  protected fd_filestat_get(fd: number): [wasi.Filestat | undefined, number] {
    if (this.fds[fd] != undefined) {
      const { ret, filestat } = this.fds[fd].fd_filestat_get();
      if (filestat != null) {
        return [filestat, ret];
      }
      return [undefined, ret];
    }
    return [undefined, wasi.ERRNO_BADF];
  }

  protected fd_filestat_set_size(fd: number, size: bigint): number {
    if (this.fds[fd] != undefined) {
      return this.fds[fd].fd_filestat_set_size(size);
    } else {
      return wasi.ERRNO_BADF;
    }
  }

  protected fd_filestat_set_times(fd: number, atim: bigint, mtim: bigint, fst_flags: number): number {
    if (this.fds[fd] != undefined) {
      return this.fds[fd].fd_filestat_set_times(atim, mtim, fst_flags);
    } else {
      return wasi.ERRNO_BADF;
    }
  }

  protected fd_pread(fd: number, iovecs: Array<wasi.Iovec>, offset: bigint): [[number, Uint8Array] | undefined, number] {
    if (this.fds[fd] != undefined) {
      let nread = 0;

      let buffer8 = new Uint8Array(0);
      for (const iovec of iovecs) {
        const { ret, data } = this.fds[fd].fd_pread(iovec.buf_len, offset);
        if (ret != wasi.ERRNO_SUCCESS) {
          return [[nread, buffer8], ret];
        }
        const new_buffer = new Uint8Array(buffer8.byteLength + data.byteLength);
        new_buffer.set(buffer8);
        new_buffer.set(data, buffer8.byteLength);
        buffer8 = new_buffer;
        nread += data.byteLength;
        if (data.byteLength != iovec.buf_len) {
          break;
        }
      }
      return [[nread, buffer8], wasi.ERRNO_SUCCESS];
    } else {
      return [undefined, wasi.ERRNO_BADF];
    }
  }

  protected fd_prestat_get(fd: number): [wasi.Prestat | undefined, number] {
    if (this.fds[fd] != undefined) {
      const { ret, prestat } = this.fds[fd].fd_prestat_get();
      if (prestat != null) {
        return [prestat, ret];
      }
      return [undefined, ret];
    }
    return [undefined, wasi.ERRNO_BADF];
  }

  protected fd_prestat_dir_name(fd: number, path_len: number): [Uint8Array | undefined, number] {
    if (this.fds[fd] != undefined) {
      const { ret, prestat } = this.fds[fd].fd_prestat_get();
      if (prestat) {
        const prestat_dir_name = prestat.inner.pr_name;

        // console.log("fd_prestat_dir_name: park: inner: ", prestat_dir_name);
        // console.log("fd_prestat_dir_name: park: inner: ", new TextDecoder().decode(prestat_dir_name));

        // console.log("fd_prestat_dir_name: park: path_len: ", path_len);

        if (prestat_dir_name.length <= path_len) {
          // console.log("fd_prestat_dir_name: park: A");
          return [prestat_dir_name, ret];
        }

        // console.log("fd_prestat_dir_name: park: B");
        return [prestat_dir_name.slice(0, path_len), wasi.ERRNO_NAMETOOLONG];
      }
      // console.log("fd_prestat_dir_name: park: C");
      return [undefined, ret];
    }
    // console.log("fd_prestat_dir_name: park: D");
    return [undefined, wasi.ERRNO_BADF];
  }

  protected fd_pwrite(fd: number, write_data: Uint8Array, offset: bigint): [number | undefined, number] {
    if (this.fds[fd] != undefined) {
      const { ret, nwritten } = this.fds[fd].fd_pwrite(write_data, offset);
      return [nwritten, ret];
    } else {
      return [undefined, wasi.ERRNO_BADF];
    }
  }

  protected fd_read(fd: number, iovecs: Array<wasi.Iovec>): [[number, Uint8Array] | undefined, number] {
    if (this.fds[fd] != undefined) {
      let nread = 0;

      // console.log("fd_read: park: iovecs: ", iovecs);

      // const sum_len = iovecs.reduce((acc, iovec) => acc + iovec.buf_len, 0);

      // console.warn("fd_read: park: sum_len: ", sum_len);

      let buffer8 = new Uint8Array(0);
      for (const iovec of iovecs) {
        const { ret, data } = this.fds[fd].fd_read(iovec.buf_len);
        // console.log("fd_read: park: data: ", data);
        if (ret != wasi.ERRNO_SUCCESS) {
          return [[nread, buffer8], ret];
        }
        const new_buffer = new Uint8Array(buffer8.byteLength + data.byteLength);
        new_buffer.set(buffer8);
        new_buffer.set(data, buffer8.byteLength);
        buffer8 = new_buffer;
        nread += data.byteLength;
        if (data.byteLength != iovec.buf_len) {
          break;
        }
      }

      // console.log("fd_read: park: nread: ", nread);

      return [[
        nread,
        buffer8,
      ], wasi.ERRNO_SUCCESS];
    } else {
      return [undefined, wasi.ERRNO_BADF];
    }
  }

  protected fd_readdir(fd: number, buf_len: number, cookie: bigint): [[Uint8Array, number] | undefined, number] {
    if (this.fds[fd] != undefined) {
      const array = new Uint8Array(buf_len);

      let buf_used = 0;
      let offset = 0;

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { ret, dirent } = this.fds[fd].fd_readdir_single(cookie);
        if (ret != wasi.ERRNO_SUCCESS) {
          return [[array, buf_used], ret];
        }
        if (dirent == null) {
          break;
        }
        if (buf_len - buf_used < dirent.head_length()) {
          buf_used = buf_len;
          break;
        }

        const head_bytes = new ArrayBuffer(dirent.head_length());
        dirent.write_head_bytes(new DataView(head_bytes), 0);
        array.set(
          new Uint8Array(head_bytes).slice(
            0,
            Math.min(head_bytes.byteLength, buf_len - buf_used),
          ),
          offset,
        );
        offset += head_bytes.byteLength;
        buf_used += head_bytes.byteLength;

        if (buf_len - buf_used < dirent.name_length()) {
          buf_used = buf_len;
          break;
        }

        dirent.write_name_bytes(array, offset, buf_len - buf_used);
        offset += dirent.name_length();
        buf_used += dirent.name_length();

        cookie = dirent.d_next;
      }

      return [[array, buf_used], wasi.ERRNO_SUCCESS];
    } else {
      return [undefined, wasi.ERRNO_BADF];
    }
  }

  // protected async fd_renumber(fd: number, to: number): Promise<number> {
  //   if (this.fds[fd] != undefined) {
  //     const ret = this.fds[to].fd_close();
  //     if (ret != wasi.ERRNO_SUCCESS) {
  //       return ret;
  //     }
  //     this.fds[to] = this.fds[fd];
  //     this.fds[fd] = undefined;
  //     await this.notify_rm_fd(fd);
  //     return wasi.ERRNO_SUCCESS;
  //   } else {
  //     return wasi.ERRNO_BADF;
  //   }
  // }

  protected fd_seek(fd: number, offset: bigint, whence: number): [bigint | undefined, number] {
    if (this.fds[fd] != undefined) {
      const { ret, offset: new_offset } = this.fds[fd].fd_seek(offset, whence);
      return [new_offset, ret];
    } else {
      return [undefined, wasi.ERRNO_BADF];
    }
  }

  protected fd_sync(fd: number): number {
    if (this.fds[fd] != undefined) {
      return this.fds[fd].fd_sync();
    } else {
      return wasi.ERRNO_BADF;
    }
  }

  protected fd_tell(fd: number): [bigint | undefined, number] {
    if (this.fds[fd] != undefined) {
      const { ret, offset } = this.fds[fd].fd_tell();
      return [offset, ret];
    } else {
      return [undefined, wasi.ERRNO_BADF];
    }
  }

  protected fd_write(fd: number, write_data: Uint8Array): [number | undefined, number] {
    if (this.fds[fd] != undefined) {
      const { ret, nwritten } = this.fds[fd].fd_write(write_data);
      return [nwritten, ret];
    } else {
      return [undefined, wasi.ERRNO_BADF];
    }
  }

  protected path_create_directory(fd: number, path: string): number {
    if (this.fds[fd] != undefined) {
      return this.fds[fd].path_create_directory(path);
    } else {
      return wasi.ERRNO_BADF;
    }
  }

  protected path_filestat_get(fd: number, flags: number, path: string): [wasi.Filestat | undefined, number] {
    if (this.fds[fd] != undefined) {
      const { ret, filestat } = this.fds[fd].path_filestat_get(flags, path);
      if (filestat != null) {
        return [filestat, ret];
      }
      return [undefined, ret];
    }
    return [undefined, wasi.ERRNO_BADF];
  }

  protected path_filestat_set_times(fd: number, flags: number, path: string, atim: bigint, mtim: bigint, fst_flags: number): number {
    if (this.fds[fd] != undefined) {
      return this.fds[fd].path_filestat_set_times(flags, path, atim, mtim, fst_flags);
    } else {
      return wasi.ERRNO_BADF;
    }
  }

  protected path_link(old_fd: number, old_flags: number, old_path: string, new_fd: number, new_path: string): number {
    if (this.fds[old_fd] != undefined && this.fds[new_fd] != undefined) {
      const { ret, inode_obj } = this.fds[old_fd].path_lookup(
        old_path,
        old_flags,
      );
      if (inode_obj == null) {
        return ret;
      }
      return this.fds[new_fd].path_link(new_path, inode_obj, false);
    } else {
      return wasi.ERRNO_BADF;
    }
  }

  protected async path_open(
    fd: number,
    dirflags: number,
    path: string,
    oflags: number,
    fs_rights_base: bigint,
    fs_rights_inheriting: bigint,
    fs_flags: number,
  ): Promise<[number | undefined, number]> {
    if (this.fds[fd] != undefined) {
      debug.log("path_open", path);
      const { ret, fd_obj } = this.fds[fd].path_open(
        dirflags,
        path,
        oflags,
        fs_rights_base,
        fs_rights_inheriting,
        fs_flags,
      );
      // console.log("path_open: park: ", ret, fd_obj);
      if (ret != wasi.ERRNO_SUCCESS) {
        return [undefined, ret];
      }

      const [resolve, opened_fd] = await this.get_new_fd();

      // console.log("path_open: park: ", path, "opened_fd" ,opened_fd);

      this.fds[opened_fd] = fd_obj;

      await resolve();

      // console.log("path_open: park: len: ", len);

      // console.log("path_open: park: ", opened_fd);

      return [opened_fd, wasi.ERRNO_SUCCESS];
    } else {
      return [undefined, wasi.ERRNO_BADF];
    }
  }

  protected path_readlink(fd: number, path: string, buf_len: number): [Uint8Array | undefined, number] {
    if (this.fds[fd] != undefined) {
      debug.log("path_readlink", path);
      const { ret, data } = this.fds[fd].path_readlink(path);
      if (data != null) {
        const data_buf = new TextEncoder().encode(data);
        if (data_buf.byteLength > buf_len) {
          // wasi.ts use ERRNO_BADF. I think it should be ERRNO_OVERFLOW.
          return [data_buf.slice(0, buf_len), wasi.ERRNO_OVERFLOW];
        }
        return [data_buf, ret];
      }
      return [undefined, ret];
    } else {
      return [undefined, wasi.ERRNO_BADF];
    }
  }

  protected path_remove_directory(fd: number, path: string): number {
    if (this.fds[fd] != undefined) {
      return this.fds[fd].path_remove_directory(path);
    } else {
      return wasi.ERRNO_BADF;
    }
  }

  protected path_rename(old_fd: number, old_path: string, new_fd: number, new_path: string): number {
    if (this.fds[old_fd] != undefined && this.fds[new_fd] != undefined) {
      // eslint-disable-next-line prefer-const
      let { ret, inode_obj } = this.fds[old_fd].path_unlink(
        old_path,
      );
      if (inode_obj == null) {
        return ret;
      }
      ret = this.fds[new_fd].path_link(new_path, inode_obj, true);
      if (ret != wasi.ERRNO_SUCCESS) {
        if (
          this.fds[old_fd].path_link(old_path, inode_obj, true) !=
          wasi.ERRNO_SUCCESS
        ) {
          throw "path_link should always return success when relinking an inode back to the original place";
        }
      }
      return ret;
    } else {
      return wasi.ERRNO_BADF;
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected path_symlink(old_path: string, fd: number, new_path: string): number {
    if (this.fds[fd] != undefined) {
      return wasi.ERRNO_NOTSUP;
    } else {
      return wasi.ERRNO_BADF;
    }
  }

  protected path_unlink_file(fd: number, path: string): number {
    if (this.fds[fd] != undefined) {
      return this.fds[fd].path_unlink_file(path);
    } else {
      return wasi.ERRNO_BADF;
    }
  }
}
