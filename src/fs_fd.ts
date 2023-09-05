import * as wasi from "./wasi_defs.js";
import { File, Directory, SyncOPFSFile, FileSystemSyncAccessHandle } from "./fs_core.js";
import { Fd } from "./fd.js";

declare var TextEncoder: {
  prototype: TextEncoder;
  new (encoding?: string): TextEncoder;
};

export class OpenFile extends Fd {
  file: File;
  file_pos: bigint = 0n;

  constructor(file: File) {
    super();
    this.file = file;
  }

  fd_fdstat_get(): { ret: number; fdstat: wasi.Fdstat | null } {
    return { ret: 0, fdstat: new wasi.Fdstat(wasi.FILETYPE_REGULAR_FILE, 0) };
  }

  fd_read(
    view8: Uint8Array,
    iovs: Array<wasi.Iovec>
  ): { ret: number; nread: number } {
    let nread = 0;
    for (let iovec of iovs) {
      // @ts-ignore
      if (this.file_pos < this.file.data.byteLength) {
        let slice = this.file.data.slice(
          Number(this.file_pos),
          // @ts-ignore
          Number(this.file_pos + BigInt(iovec.buf_len))
        );
        view8.set(slice, iovec.buf);
        // @ts-ignore
        this.file_pos += BigInt(slice.length);
        nread += slice.length;
      } else {
        break;
      }
    }
    return { ret: 0, nread };
  }

  fd_seek(offset: bigint, whence: number): { ret: number; offset: bigint } {
    let calculated_offset: bigint;
    switch (whence) {
      case wasi.WHENCE_SET:
        // @ts-ignore
        calculated_offset = offset;
        break;
      case wasi.WHENCE_CUR:
        // @ts-ignore
        calculated_offset = this.file_pos + offset;
        break;
      case wasi.WHENCE_END:
        // @ts-ignore
        calculated_offset = BigInt(this.file.data.byteLength) + offset;
        break;
      default:
        // @ts-ignore
        return { ret: wasi.ERRNO_INVAL, offset: 0n };
    }

    if (calculated_offset < 0) {
      // @ts-ignore
      return { ret: wasi.ERRNO_INVAL, offset: 0n };
    }

    this.file_pos = calculated_offset;
    return { ret: 0, offset: this.file_pos };
  }

  fd_write(
    view8: Uint8Array,
    iovs: Array<wasi.Ciovec>
  ): { ret: number; nwritten: number } {
    let nwritten = 0;
    if (this.file.readonly) return { ret: wasi.ERRNO_BADF, nwritten };
    for (let iovec of iovs) {
      let buffer = view8.slice(iovec.buf, iovec.buf + iovec.buf_len);
      if (this.file_pos + BigInt(buffer.byteLength) > this.file.size) {
        let old = this.file.data;
        this.file.data = new Uint8Array(
          Number(this.file_pos + BigInt(buffer.byteLength))
        );
        this.file.data.set(old);
      }
      this.file.data.set(
        buffer.slice(0, Number(this.file.size - this.file_pos)),
        Number(this.file_pos)
      );
      this.file_pos += BigInt(buffer.byteLength);
      nwritten += iovec.buf_len;
    }
    return { ret: 0, nwritten };
  }

  fd_filestat_get(): { ret: number; filestat: wasi.Filestat } {
    return { ret: 0, filestat: this.file.stat() };
  }
}

export class OpenSyncOPFSFile extends Fd {
  file: SyncOPFSFile;
  position: bigint = 0n;

  constructor(file: SyncOPFSFile) {
    super();
    this.file = file;
  };

  fd_fdstat_get(): { ret: number; fdstat: wasi.Fdstat | null } {
    return { ret: 0, fdstat: new wasi.Fdstat(wasi.FILETYPE_REGULAR_FILE, 0) };
  }

  fd_filestat_get(): { ret: number; filestat: wasi.Filestat } {
    return { ret: 0, filestat: new wasi.Filestat(wasi.FILETYPE_REGULAR_FILE, BigInt(this.file.handle.getSize())) };
  }

  fd_read(view8: Uint8Array, iovs: Array<wasi.Iovec>): { ret: number, nread: number } {
    let nread = 0;
    for (let iovec of iovs) {
      if (this.position < this.file.handle.getSize()) {
        let buf = new Uint8Array(view8.buffer, iovec.buf, iovec.buf_len);
        let n = this.file.handle.read(buf, { at: Number(this.position) });
        this.position += BigInt(n);
        nread += n;
      } else {
        break;
      }
    }
    return { ret: 0, nread };
  }

  fd_seek(offset: number | bigint, whence: number): { ret: number, offset: bigint } {
    let calculated_offset: bigint;
    switch (whence) {
      case wasi.WHENCE_SET:
        calculated_offset = BigInt(offset);
        break;
      case wasi.WHENCE_CUR:
        calculated_offset = this.position + BigInt(offset);
        break;
      case wasi.WHENCE_END:
        calculated_offset = BigInt(this.file.handle.getSize()) + BigInt(offset);
        break;
      default:
        return { ret: wasi.ERRNO_INVAL, offset: 0n };
    }
    if (calculated_offset < 0) {
      return { ret: wasi.ERRNO_INVAL, offset: 0n };
    }
    this.position = calculated_offset;
    return { ret: wasi.ERRNO_SUCCESS, offset: this.position };
  }

  fd_write(view8: Uint8Array, iovs: Array<wasi.Iovec>): { ret: number, nwritten: number } {
    let nwritten = 0;
    if (this.file.readonly) return { ret: wasi.ERRNO_BADF, nwritten };
    for (let iovec of iovs) {
      let buf = new Uint8Array(view8.buffer, iovec.buf, iovec.buf_len);
      // don't need to extend file manually, just write
      let n = this.file.handle.write(buf, { at: Number(this.position) });
      this.position += BigInt(n);
      nwritten += n;
    }
    return { ret: wasi.ERRNO_SUCCESS, nwritten };
  }

  fd_datasync(): number {
    this.file.handle.flush();
    return wasi.ERRNO_SUCCESS;
  }

  fd_sync(): number {
    return this.fd_datasync();
  }

  fd_close(): number {
    return wasi.ERRNO_SUCCESS;
  }

}

export class OpenDirectory extends Fd {
  dir: Directory;

  constructor(dir: Directory) {
    super();
    this.dir = dir;
  }

  fd_fdstat_get(): { ret: number; fdstat: wasi.Fdstat | null } {
    return { ret: 0, fdstat: new wasi.Fdstat(wasi.FILETYPE_DIRECTORY, 0) };
  }

  fd_readdir_single(cookie: bigint): {
    ret: number;
    dirent: wasi.Dirent | null;
  } {
    //console.log(cookie, Object.keys(this.dir.contents).slice(Number(cookie)));
    // @ts-ignore
    if (cookie >= BigInt(Object.keys(this.dir.contents).length)) {
      return { ret: 0, dirent: null };
    }

    let name = Object.keys(this.dir.contents)[Number(cookie)];
    let entry = this.dir.contents[name];
    let encoded_name = new TextEncoder("utf-8").encode(name);

    return {
      ret: 0,
      // @ts-ignore
      dirent: new wasi.Dirent(cookie + 1n, name, entry.stat().filetype),
    };
  }

  path_filestat_get(
    flags: number,
    path: string
  ): { ret: number; filestat: wasi.Filestat | null } {
    let entry = this.dir.get_entry_for_path(path);
    if (entry == null) {
      return { ret: wasi.ERRNO_EXIST, filestat: null };
    }
    return { ret: 0, filestat: entry.stat() };
  }

  path_open(
    dirflags: number,
    path: string,
    oflags: number,
    fs_rights_base: bigint,
    fs_rights_inheriting: bigint,
    fd_flags: number
  ): { ret: number; fd_obj: Fd | null } {
    let entry = this.dir.get_entry_for_path(path);
    if (entry == null) {
      if ((oflags & wasi.OFLAGS_CREAT) == wasi.OFLAGS_CREAT) {
        // doesn't exist, but shall be created
        entry = this.dir.create_entry_for_path(path, (oflags & wasi.OFLAGS_DIRECTORY) == wasi.OFLAGS_DIRECTORY);
      } else {
        // doesn't exist, no such file
        return { ret: wasi.ERRNO_NOENT, fd_obj: null };
      }
    } else if ((oflags & wasi.OFLAGS_EXCL) == wasi.OFLAGS_EXCL) {
      // was supposed to be created exclusively, but exists already
      return { ret: wasi.ERRNO_EXIST, fd_obj: null };
    }
    if (
      (oflags & wasi.OFLAGS_DIRECTORY) == wasi.OFLAGS_DIRECTORY &&
      entry.stat().filetype != wasi.FILETYPE_DIRECTORY
    ) {
      // file is actually a directory
      return { ret: wasi.ERRNO_ISDIR, fd_obj: null };
    }
    if (entry.readonly &&
      (fs_rights_base & BigInt(wasi.RIGHTS_FD_WRITE)) == BigInt(wasi.RIGHTS_FD_WRITE)
    ) {
      // no write permission to file
      return { ret: wasi.ERRNO_PERM, fd_obj: null };
    }
    if (
      (!(entry instanceof Directory)) &&
      (oflags & wasi.OFLAGS_TRUNC) == wasi.OFLAGS_TRUNC
    ) {
      // truncate existing file first
      let ret = entry.truncate();
      if (ret != wasi.ERRNO_SUCCESS)
        return { ret, fd_obj: null };
    }
    return { ret: wasi.ERRNO_SUCCESS, fd_obj: entry.open(fd_flags) };
  }

  path_create_directory(path: string): number {
    return this.path_open(0, path, wasi.OFLAGS_CREAT | wasi.OFLAGS_DIRECTORY, 0n, 0n, 0).ret;
  }
}

export class PreopenDirectory extends OpenDirectory {
  prestat_name: Uint8Array;

  constructor(name: string, contents: { [key: string]: File | Directory | SyncOPFSFile }) {
    super(new Directory(contents));
    this.prestat_name = new TextEncoder("utf-8").encode(name);
  }

  fd_prestat_get(): { ret: number; prestat: wasi.Prestat } {
    return {
      ret: 0,
      prestat: wasi.Prestat.dir(this.prestat_name.length),
    };
  }

  fd_prestat_dir_name(): { ret: number; prestat_dir_name: Uint8Array } {
    return {
      ret: 0,
      prestat_dir_name: this.prestat_name,
    };
  }
}
