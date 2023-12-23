import { debug } from "./debug.js";
import * as wasi from "./wasi_defs.js";
import { Fd } from "./fd.js";
import { Inode } from "./inode.js";

export class OpenFile extends Fd {
  file: File;
  file_pos: bigint = 0n;

  constructor(file: File) {
    super();
    this.file = file;
  }

  fd_allocate(offset: bigint, len: bigint): number {
    if (this.file.size > offset + len) {
      // already big enough
    } else {
      // extend
      const new_data = new Uint8Array(Number(offset + len));
      new_data.set(this.file.data, 0);
      this.file.data = new_data;
    }
    return wasi.ERRNO_SUCCESS;
  }

  fd_fdstat_get(): { ret: number; fdstat: wasi.Fdstat | null } {
    return { ret: 0, fdstat: new wasi.Fdstat(wasi.FILETYPE_REGULAR_FILE, 0) };
  }

  fd_filestat_set_size(size: bigint): number {
    if (this.file.size > size) {
      // truncate
      this.file.data = new Uint8Array(
        this.file.data.buffer.slice(0, Number(size)),
      );
    } else {
      // extend
      const new_data = new Uint8Array(Number(size));
      new_data.set(this.file.data, 0);
      this.file.data = new_data;
    }
    return wasi.ERRNO_SUCCESS;
  }

  fd_read(
    view8: Uint8Array,
    iovs: Array<wasi.Iovec>,
  ): { ret: number; nread: number } {
    let nread = 0;
    for (const iovec of iovs) {
      if (this.file_pos < this.file.data.byteLength) {
        const slice = this.file.data.slice(
          Number(this.file_pos),
          Number(this.file_pos + BigInt(iovec.buf_len)),
        );
        view8.set(slice, iovec.buf);
        this.file_pos += BigInt(slice.length);
        nread += slice.length;
      } else {
        break;
      }
    }
    return { ret: 0, nread };
  }

  fd_pread(
    view8: Uint8Array,
    iovs: Array<wasi.Iovec>,
    offset: bigint,
  ): { ret: number; nread: number } {
    let nread = 0;
    for (const iovec of iovs) {
      if (offset < this.file.data.byteLength) {
        const slice = this.file.data.slice(
          Number(offset),
          Number(offset + BigInt(iovec.buf_len)),
        );
        view8.set(slice, iovec.buf);
        offset += BigInt(slice.length);
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
        calculated_offset = offset;
        break;
      case wasi.WHENCE_CUR:
        calculated_offset = this.file_pos + offset;
        break;
      case wasi.WHENCE_END:
        calculated_offset = BigInt(this.file.data.byteLength) + offset;
        break;
      default:
        return { ret: wasi.ERRNO_INVAL, offset: 0n };
    }

    if (calculated_offset < 0) {
      return { ret: wasi.ERRNO_INVAL, offset: 0n };
    }

    this.file_pos = calculated_offset;
    return { ret: 0, offset: this.file_pos };
  }

  fd_tell(): { ret: number; offset: bigint } {
    return { ret: 0, offset: this.file_pos };
  }

  fd_write(
    view8: Uint8Array,
    iovs: Array<wasi.Ciovec>,
  ): { ret: number; nwritten: number } {
    let nwritten = 0;
    if (this.file.readonly) return { ret: wasi.ERRNO_BADF, nwritten };
    for (const iovec of iovs) {
      const buffer = view8.slice(iovec.buf, iovec.buf + iovec.buf_len);
      if (this.file_pos + BigInt(buffer.byteLength) > this.file.size) {
        const old = this.file.data;
        this.file.data = new Uint8Array(
          Number(this.file_pos + BigInt(buffer.byteLength)),
        );
        this.file.data.set(old);
      }
      this.file.data.set(
        buffer.slice(0, Number(this.file.size - this.file_pos)),
        Number(this.file_pos),
      );
      this.file_pos += BigInt(buffer.byteLength);
      nwritten += iovec.buf_len;
    }
    return { ret: 0, nwritten };
  }

  fd_pwrite(view8: Uint8Array, iovs: Array<wasi.Ciovec>, offset: bigint) {
    let nwritten = 0;
    if (this.file.readonly) return { ret: wasi.ERRNO_BADF, nwritten };
    for (const iovec of iovs) {
      const buffer = view8.slice(iovec.buf, iovec.buf + iovec.buf_len);
      if (offset + BigInt(buffer.byteLength) > this.file.size) {
        const old = this.file.data;
        this.file.data = new Uint8Array(
          Number(offset + BigInt(buffer.byteLength)),
        );
        this.file.data.set(old);
      }
      this.file.data.set(
        buffer.slice(0, Number(this.file.size - offset)),
        Number(offset),
      );
      offset += BigInt(buffer.byteLength);
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
  }

  fd_allocate(offset: bigint, len: bigint): number {
    if (BigInt(this.file.handle.getSize()) > offset + len) {
      // already big enough
    } else {
      // extend
      this.file.handle.truncate(Number(offset + len));
    }
    return wasi.ERRNO_SUCCESS;
  }

  fd_fdstat_get(): { ret: number; fdstat: wasi.Fdstat | null } {
    return { ret: 0, fdstat: new wasi.Fdstat(wasi.FILETYPE_REGULAR_FILE, 0) };
  }

  fd_filestat_get(): { ret: number; filestat: wasi.Filestat } {
    return {
      ret: 0,
      filestat: new wasi.Filestat(
        wasi.FILETYPE_REGULAR_FILE,
        BigInt(this.file.handle.getSize()),
      ),
    };
  }

  fd_filestat_set_size(size: bigint): number {
    this.file.handle.truncate(Number(size));
    return wasi.ERRNO_SUCCESS;
  }

  fd_read(
    view8: Uint8Array,
    iovs: Array<wasi.Iovec>,
  ): { ret: number; nread: number } {
    let nread = 0;
    for (const iovec of iovs) {
      if (this.position < this.file.handle.getSize()) {
        const buf = new Uint8Array(view8.buffer, iovec.buf, iovec.buf_len);
        const n = this.file.handle.read(buf, { at: Number(this.position) });
        this.position += BigInt(n);
        nread += n;
      } else {
        break;
      }
    }
    return { ret: 0, nread };
  }

  fd_seek(
    offset: number | bigint,
    whence: number,
  ): { ret: number; offset: bigint } {
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

  fd_write(
    view8: Uint8Array,
    iovs: Array<wasi.Iovec>,
  ): { ret: number; nwritten: number } {
    let nwritten = 0;
    if (this.file.readonly) return { ret: wasi.ERRNO_BADF, nwritten };
    for (const iovec of iovs) {
      const buf = new Uint8Array(view8.buffer, iovec.buf, iovec.buf_len);
      // don't need to extend file manually, just write
      const n = this.file.handle.write(buf, { at: Number(this.position) });
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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  fd_seek(offset: bigint, whence: number): { ret: number; offset: bigint } {
    return { ret: wasi.ERRNO_ISDIR, offset: 0n };
  }

  fd_fdstat_get(): { ret: number; fdstat: wasi.Fdstat | null } {
    return { ret: 0, fdstat: new wasi.Fdstat(wasi.FILETYPE_DIRECTORY, 0) };
  }

  fd_readdir_single(cookie: bigint): {
    ret: number;
    dirent: wasi.Dirent | null;
  } {
    if (debug.enabled) {
      debug.log("readdir_single", cookie);
      debug.log(cookie, this.dir.contents.keys());
    }
    if (cookie >= BigInt(this.dir.contents.size)) {
      return { ret: 0, dirent: null };
    }

    const [name, entry] = Array.from(this.dir.contents.entries())[
      Number(cookie)
    ];

    return {
      ret: 0,
      dirent: new wasi.Dirent(cookie + 1n, name, entry.stat().filetype),
    };
  }

  path_filestat_get(
    flags: number,
    path: string,
  ): { ret: number; filestat: wasi.Filestat | null } {
    const entry = this.dir.get_entry_for_path(path);
    if (entry == null) {
      return { ret: wasi.ERRNO_NOENT, filestat: null };
    }
    return { ret: 0, filestat: entry.stat() };
  }

  path_open(
    dirflags: number,
    path: string,
    oflags: number,
    fs_rights_base: bigint,
    fs_rights_inheriting: bigint,
    fd_flags: number,
  ): { ret: number; fd_obj: Fd | null } {
    let entry = this.dir.get_entry_for_path(path);
    if (entry == null) {
      if ((oflags & wasi.OFLAGS_CREAT) == wasi.OFLAGS_CREAT) {
        // doesn't exist, but shall be created
        entry = this.dir.create_entry_for_path(
          path,
          (oflags & wasi.OFLAGS_DIRECTORY) == wasi.OFLAGS_DIRECTORY,
        );
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
      entry.stat().filetype !== wasi.FILETYPE_DIRECTORY
    ) {
      // expected a directory but the file is not a directory
      return { ret: wasi.ERRNO_NOTDIR, fd_obj: null };
    }
    return entry.path_open(oflags, fs_rights_base, fd_flags);
  }

  path_create_directory(path: string): number {
    return this.path_open(
      0,
      path,
      wasi.OFLAGS_CREAT | wasi.OFLAGS_DIRECTORY,
      0n,
      0n,
      0,
    ).ret;
  }

  path_unlink_file(path: string): number {
    path = this.clean_path(path);
    const parentDirEntry = this.dir.get_parent_dir_for_path(path);
    const pathComponents = path.split("/");
    const fileName = pathComponents[pathComponents.length - 1];
    const entry = this.dir.get_entry_for_path(path);
    if (entry === null) {
      return wasi.ERRNO_NOENT;
    }
    if (entry.stat().filetype === wasi.FILETYPE_DIRECTORY) {
      return wasi.ERRNO_ISDIR;
    }
    parentDirEntry.contents.delete(fileName);
    return wasi.ERRNO_SUCCESS;
  }

  path_remove_directory(path: string): number {
    path = this.clean_path(path);
    const parentDirEntry = this.dir.get_parent_dir_for_path(path);
    const pathComponents = path.split("/");
    const fileName = pathComponents[pathComponents.length - 1];

    const entry = this.dir.get_entry_for_path(path);

    if (entry === null) {
      return wasi.ERRNO_NOENT;
    }
    if (
      !(entry instanceof Directory) ||
      entry.stat().filetype !== wasi.FILETYPE_DIRECTORY
    ) {
      return wasi.ERRNO_NOTDIR;
    }
    if (entry.contents.size !== 0) {
      return wasi.ERRNO_NOTEMPTY;
    }
    if (!parentDirEntry.contents.delete(fileName)) {
      return wasi.ERRNO_NOENT;
    }
    return wasi.ERRNO_SUCCESS;
  }

  clean_path(path: string): string {
    while (path.length > 0 && path[path.length - 1] === "/") {
      path = path.slice(0, path.length - 1);
    }
    return path;
  }
}

export class PreopenDirectory extends OpenDirectory {
  prestat_name: Uint8Array;

  constructor(name: string, contents: Map<string, Inode>) {
    super(new Directory(contents));
    this.prestat_name = new TextEncoder().encode(name);
  }

  fd_prestat_get(): { ret: number; prestat: wasi.Prestat | null } {
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

// options that can be passed to Files and SyncOPFSFiles
type FileOptions = Partial<{
  readonly: boolean;
}>;

export class File extends Inode {
  data: Uint8Array;
  readonly: boolean;

  constructor(
    data: ArrayBuffer | SharedArrayBuffer | Uint8Array | Array<number>,
    options?: FileOptions,
  ) {
    super();
    this.data = new Uint8Array(data);
    this.readonly = !!options?.readonly;
  }

  path_open(oflags: number, fs_rights_base: bigint, fd_flags: number) {
    if (
      this.readonly &&
      (fs_rights_base & BigInt(wasi.RIGHTS_FD_WRITE)) ==
        BigInt(wasi.RIGHTS_FD_WRITE)
    ) {
      // no write permission to file
      return { ret: wasi.ERRNO_PERM, fd_obj: null };
    }

    if ((oflags & wasi.OFLAGS_TRUNC) == wasi.OFLAGS_TRUNC) {
      if (this.readonly) return { ret: wasi.ERRNO_PERM, fd_obj: null };
      this.data = new Uint8Array([]);
    }

    const file = new OpenFile(this);
    if (fd_flags & wasi.FDFLAGS_APPEND) file.fd_seek(0n, wasi.WHENCE_END);
    return { ret: wasi.ERRNO_SUCCESS, fd_obj: file };
  }

  get size(): bigint {
    return BigInt(this.data.byteLength);
  }

  stat(): wasi.Filestat {
    return new wasi.Filestat(wasi.FILETYPE_REGULAR_FILE, this.size);
  }
}

// Shim for https://developer.mozilla.org/en-US/docs/Web/API/FileSystemSyncAccessHandle
// This is not part of the public interface.
export interface FileSystemSyncAccessHandle {
  close(): void;
  flush(): void;
  getSize(): number;
  read(buffer: ArrayBuffer | ArrayBufferView, options?: { at: number }): number;
  truncate(to: number): void;
  write(
    buffer: ArrayBuffer | ArrayBufferView,
    options?: { at: number },
  ): number;
}

// Synchronous access to an individual file in the origin private file system.
// Only allowed inside a WebWorker.
export class SyncOPFSFile extends Inode {
  handle: FileSystemSyncAccessHandle;
  readonly: boolean;

  // FIXME needs a close() method to be called after start() to release the underlying handle
  constructor(handle: FileSystemSyncAccessHandle, options?: FileOptions) {
    super();
    this.handle = handle;
    this.readonly = !!options?.readonly;
  }

  path_open(oflags: number, fs_rights_base: bigint, fd_flags: number) {
    if (
      this.readonly &&
      (fs_rights_base & BigInt(wasi.RIGHTS_FD_WRITE)) ==
        BigInt(wasi.RIGHTS_FD_WRITE)
    ) {
      // no write permission to file
      return { ret: wasi.ERRNO_PERM, fd_obj: null };
    }

    if ((oflags & wasi.OFLAGS_TRUNC) == wasi.OFLAGS_TRUNC) {
      if (this.readonly) return { ret: wasi.ERRNO_PERM, fd_obj: null };
      this.handle.truncate(0);
    }

    const file = new OpenSyncOPFSFile(this);
    if (fd_flags & wasi.FDFLAGS_APPEND) file.fd_seek(0n, wasi.WHENCE_END);
    return { ret: wasi.ERRNO_SUCCESS, fd_obj: file };
  }

  get size(): bigint {
    return BigInt(this.handle.getSize());
  }

  stat(): wasi.Filestat {
    return new wasi.Filestat(wasi.FILETYPE_REGULAR_FILE, this.size);
  }
}

export class Directory extends Inode {
  contents: Map<string, Inode>;

  constructor(contents: Map<string, Inode> | [string, Inode][]) {
    super();
    if (contents instanceof Array) {
      this.contents = new Map(contents);
    } else {
      this.contents = contents;
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  path_open(oflags: number, fs_rights_base: bigint, fd_flags: number) {
    return { ret: wasi.ERRNO_SUCCESS, fd_obj: new OpenDirectory(this) };
  }

  stat(): wasi.Filestat {
    return new wasi.Filestat(wasi.FILETYPE_DIRECTORY, 0n);
  }

  get_entry_for_path(path: string): Inode | null {
    let entry: Inode = this;
    for (const component of path.split("/")) {
      if (component == "") break;
      if (component == ".") continue;
      if (!(entry instanceof Directory)) {
        return null;
      }
      const child = entry.contents.get(component);
      if (child !== undefined) {
        entry = child;
      } else {
        debug.log(component);
        return null;
      }
    }
    return entry;
  }

  get_parent_dir_for_path(path: string): Directory | null {
    if (path === "") return null;
    let entry: Inode = this;
    let parentEntry: Directory = this;
    for (const component of path.split("/")) {
      if (component === "") break;
      if (component === ".") continue;
      if (!(entry instanceof Directory)) {
        debug.log(entry);
        return null;
      }
      const child = entry.contents.get(component);
      if (child === undefined) {
        debug.log(component);
        return null;
      }
      parentEntry = entry;
      entry = child;
    }
    return parentEntry;
  }

  create_entry_for_path(path: string, is_dir: boolean): Inode {
    let entry: Inode = this;

    const components: Array<string> = path
      .split("/")
      .filter((component) => component != "/");
    for (let i = 0; i < components.length; i++) {
      const component = components[i];
      if (!(entry instanceof Directory)) {
        break;
      }
      const child = entry.contents.get(component);
      if (child !== undefined) {
        entry = child;
      } else {
        debug.log("create", component);
        let new_child;
        if (i == components.length - 1 && !is_dir) {
          new_child = new File(new ArrayBuffer(0));
        } else {
          new_child = new Directory(new Map());
        }
        entry.contents.set(component, new_child);
        entry = new_child;
      }
    }

    return entry;
  }
}

export class ConsoleStdout extends Fd {
  write: (buffer: Uint8Array) => void;

  constructor(write: (buffer: Uint8Array) => void) {
    super();
    this.write = write;
  }

  fd_filestat_get(): { ret: number; filestat: wasi.Filestat } {
    const filestat = new wasi.Filestat(
      wasi.FILETYPE_CHARACTER_DEVICE,
      BigInt(0),
    );
    return { ret: 0, filestat };
  }

  fd_fdstat_get(): { ret: number; fdstat: wasi.Fdstat | null } {
    const fdstat = new wasi.Fdstat(wasi.FILETYPE_CHARACTER_DEVICE, 0);
    fdstat.fs_rights_base = BigInt(wasi.RIGHTS_FD_WRITE);
    return { ret: 0, fdstat };
  }

  fd_write(
    view8: Uint8Array,
    iovs: Array<wasi.Ciovec>,
  ): { ret: number; nwritten: number } {
    let nwritten = 0;
    for (const iovec of iovs) {
      const buffer = view8.slice(iovec.buf, iovec.buf + iovec.buf_len);
      this.write(buffer);
      nwritten += iovec.buf_len;
    }
    return { ret: 0, nwritten };
  }

  static lineBuffered(write: (line: string) => void): ConsoleStdout {
    const dec = new TextDecoder("utf-8", { fatal: false });
    let line_buf = "";
    return new ConsoleStdout((buffer) => {
      line_buf += dec.decode(buffer, { stream: true });
      const lines = line_buf.split("\n");
      for (const [i, line] of lines.entries()) {
        if (i < lines.length - 1) {
          write(line);
        } else {
          line_buf = line;
        }
      }
    });
  }
}
