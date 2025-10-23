import { debug } from "./debug.js";
import * as wasi from "./wasi_defs.js";
import { Fd, Inode } from "./fd.js";

function dataResize(data: Uint8Array, newDataSize: number): Uint8Array {
  // reuse same data if not actually resizing
  if (data.byteLength === newDataSize) {
    return data;
  }

  // prefer using
  // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/ArrayBuffer/resize
  // when applicable; can be used to shrink/grow
  if (
    data.buffer instanceof ArrayBuffer &&
    data.buffer.resizable &&
    newDataSize <= data.buffer.maxByteLength
  ) {
    data.buffer.resize(newDataSize);
    return data;
  }

  // shrinking: create a new resizable ArrayBuffer and copy a subset
  // of old data onto it
  if (data.byteLength > newDataSize) {
    const newBuffer = new ArrayBuffer(newDataSize, {
      maxByteLength: newDataSize,
    });
    const newData = new Uint8Array(newBuffer);
    newData.set(new Uint8Array(data.buffer, 0, newDataSize));
    return newData;
  }

  // growing: create a new resizable ArrayBuffer with exponential
  // growth of maxByteLength, to avoid O(n^2) overhead of repeatedly
  // concatenating buffers when doing a lot of small writes at the end
  const newBuffer = new ArrayBuffer(newDataSize, {
    maxByteLength: Math.max(newDataSize, data.buffer.maxByteLength * 2),
  });
  const newData = new Uint8Array(newBuffer);
  newData.set(data);
  return newData;
}

export class OpenFile extends Fd {
  file: File;
  file_pos: bigint = 0n;

  constructor(file: File) {
    super();
    this.file = file;
  }

  fd_allocate(offset: bigint, len: bigint): number {
    if (this.file.size >= offset + len) {
      // already big enough
    } else {
      // extend
      this.file.data = dataResize(this.file.data, Number(offset + len));
    }
    return wasi.ERRNO_SUCCESS;
  }

  fd_close(): number {
    // convert file.data back to a non-resizable arraybuffer after
    // closing, otherwise using it in web api (e.g. creating a
    // Response object) could throw. see:
    //
    // https://webidl.spec.whatwg.org/#AllowResizable
    // https://issues.chromium.org/issues/40249433
    // https://bugzilla.mozilla.org/show_bug.cgi?id=1842773
    if (
      this.file.data.buffer instanceof ArrayBuffer &&
      this.file.data.buffer.resizable
    ) {
      this.file.data = new Uint8Array(this.file.data);
    }
    return wasi.ERRNO_SUCCESS;
  }

  fd_fdstat_get(): { ret: number; fdstat: wasi.Fdstat | null } {
    return { ret: 0, fdstat: new wasi.Fdstat(wasi.FILETYPE_REGULAR_FILE, 0) };
  }

  fd_filestat_set_size(size: bigint): number {
    this.file.data = dataResize(this.file.data, Number(size));
    return wasi.ERRNO_SUCCESS;
  }

  fd_filestat_set_times(atim: bigint, mtim: bigint, fst_flags: number): number {
    return this.file.set_times(atim, mtim, fst_flags);
  }

  fd_read(size: number): { ret: number; data: Uint8Array } {
    const slice = this.file.data.slice(
      Number(this.file_pos),
      Number(this.file_pos + BigInt(size)),
    );
    this.file_pos += BigInt(slice.length);
    return { ret: 0, data: slice };
  }

  fd_pread(size: number, offset: bigint): { ret: number; data: Uint8Array } {
    const slice = this.file.data.slice(
      Number(offset),
      Number(offset + BigInt(size)),
    );
    return { ret: 0, data: slice };
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

  fd_write(data: Uint8Array): { ret: number; nwritten: number } {
    if (this.file.readonly) return { ret: wasi.ERRNO_BADF, nwritten: 0 };

    if (this.file_pos + BigInt(data.byteLength) > this.file.size) {
      this.file.data = dataResize(
        this.file.data,
        Number(this.file_pos + BigInt(data.byteLength)),
      );
    }

    this.file.data.set(data, Number(this.file_pos));
    this.file_pos += BigInt(data.byteLength);
    return { ret: 0, nwritten: data.byteLength };
  }

  fd_pwrite(data: Uint8Array, offset: bigint) {
    if (this.file.readonly) return { ret: wasi.ERRNO_BADF, nwritten: 0 };

    if (offset + BigInt(data.byteLength) > this.file.size) {
      this.file.data = dataResize(
        this.file.data,
        Number(offset + BigInt(data.byteLength)),
      );
    }

    this.file.data.set(data, Number(offset));
    return { ret: 0, nwritten: data.byteLength };
  }

  fd_filestat_get(): { ret: number; filestat: wasi.Filestat } {
    return { ret: 0, filestat: this.file.stat() };
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
    return { ret: wasi.ERRNO_BADF, offset: 0n };
  }

  fd_tell(): { ret: number; offset: bigint } {
    return { ret: wasi.ERRNO_BADF, offset: 0n };
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  fd_allocate(offset: bigint, len: bigint): number {
    return wasi.ERRNO_BADF;
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

    if (cookie == 0n) {
      return {
        ret: wasi.ERRNO_SUCCESS,
        dirent: new wasi.Dirent(1n, this.dir.ino, ".", wasi.FILETYPE_DIRECTORY),
      };
    } else if (cookie == 1n) {
      return {
        ret: wasi.ERRNO_SUCCESS,
        dirent: new wasi.Dirent(
          2n,
          this.dir.parent_ino(),
          "..",
          wasi.FILETYPE_DIRECTORY,
        ),
      };
    }

    if (cookie >= BigInt(this.dir.contents.size) + 2n) {
      return { ret: 0, dirent: null };
    }

    const [name, entry] = Array.from(this.dir.contents.entries())[
      Number(cookie - 2n)
    ];

    return {
      ret: 0,
      dirent: new wasi.Dirent(
        cookie + 1n,
        entry.ino,
        name,
        entry.stat().filetype,
      ),
    };
  }

  path_filestat_get(
    flags: number,
    path_str: string,
  ): { ret: number; filestat: wasi.Filestat | null } {
    const { ret: path_err, path } = Path.from(path_str);
    if (path == null) {
      return { ret: path_err, filestat: null };
    }

    const { ret, entry } = this.dir.get_entry_for_path(path);
    if (entry == null) {
      return { ret, filestat: null };
    }

    return { ret: 0, filestat: entry.stat() };
  }

  path_filestat_set_times(
    _flags: number,
    path_str: string,
    atim: bigint,
    mtim: bigint,
    fst_flags: number,
  ): number {
    const { ret: path_err, path } = Path.from(path_str);
    if (path == null) {
      return path_err;
    }

    const { ret, entry } = this.dir.get_entry_for_path(path);
    if (entry == null) {
      return ret;
    }

    return entry.set_times(atim, mtim, fst_flags);
  }

  path_lookup(
    path_str: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    dirflags: number,
  ): { ret: number; inode_obj: InodeMem | null } {
    const { ret: path_ret, path } = Path.from(path_str);
    if (path == null) {
      return { ret: path_ret, inode_obj: null };
    }

    const { ret, entry } = this.dir.get_entry_for_path(path);
    if (entry == null) {
      return { ret, inode_obj: null };
    }

    return { ret: wasi.ERRNO_SUCCESS, inode_obj: entry };
  }

  path_open(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    dirflags: number,
    path_str: string,
    oflags: number,
    fs_rights_base: bigint,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    fs_rights_inheriting: bigint,
    fd_flags: number,
  ): { ret: number; fd_obj: Fd | null } {
    const { ret: path_ret, path } = Path.from(path_str);
    if (path == null) {
      return { ret: path_ret, fd_obj: null };
    }

    // eslint-disable-next-line prefer-const
    let { ret, entry } = this.dir.get_entry_for_path(path);
    if (entry == null) {
      if (ret != wasi.ERRNO_NOENT) {
        return { ret, fd_obj: null };
      }
      if ((oflags & wasi.OFLAGS_CREAT) == wasi.OFLAGS_CREAT) {
        // doesn't exist, but shall be created
        const { ret, entry: new_entry } = this.dir.create_entry_for_path(
          path_str,
          (oflags & wasi.OFLAGS_DIRECTORY) == wasi.OFLAGS_DIRECTORY,
        );
        if (new_entry == null) {
          return { ret, fd_obj: null };
        }
        entry = new_entry;
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

  path_link(path_str: string, inode: InodeMem, allow_dir: boolean): number {
    const { ret: path_ret, path } = Path.from(path_str);
    if (path == null) {
      return path_ret;
    }

    if (path.is_dir) {
      return wasi.ERRNO_NOENT;
    }

    const {
      ret: parent_ret,
      parent_entry,
      filename,
      entry,
    } = this.dir.get_parent_dir_and_entry_for_path(path, true);
    if (parent_entry == null || filename == null) {
      return parent_ret;
    }

    if (entry != null) {
      const source_is_dir = inode.stat().filetype == wasi.FILETYPE_DIRECTORY;
      const target_is_dir = entry.stat().filetype == wasi.FILETYPE_DIRECTORY;
      if (source_is_dir && target_is_dir) {
        if (allow_dir && entry instanceof Directory) {
          if (entry.contents.size == 0) {
            // Allow overwriting empty directories
          } else {
            return wasi.ERRNO_NOTEMPTY;
          }
        } else {
          return wasi.ERRNO_EXIST;
        }
      } else if (source_is_dir && !target_is_dir) {
        return wasi.ERRNO_NOTDIR;
      } else if (!source_is_dir && target_is_dir) {
        return wasi.ERRNO_ISDIR;
      } else if (
        inode.stat().filetype == wasi.FILETYPE_REGULAR_FILE &&
        entry.stat().filetype == wasi.FILETYPE_REGULAR_FILE
      ) {
        // Overwriting regular files is fine
      } else {
        return wasi.ERRNO_EXIST;
      }
    }

    if (!allow_dir && inode.stat().filetype == wasi.FILETYPE_DIRECTORY) {
      return wasi.ERRNO_PERM;
    }

    if (inode instanceof Directory) {
      inode.parent = parent_entry;
    }
    parent_entry.contents.set(filename, inode);

    return wasi.ERRNO_SUCCESS;
  }

  path_unlink(path_str: string): { ret: number; inode_obj: InodeMem | null } {
    const { ret: path_ret, path } = Path.from(path_str);
    if (path == null) {
      return { ret: path_ret, inode_obj: null };
    }

    const {
      ret: parent_ret,
      parent_entry,
      filename,
      entry,
    } = this.dir.get_parent_dir_and_entry_for_path(path, true);
    if (parent_entry == null || filename == null) {
      return { ret: parent_ret, inode_obj: null };
    }

    if (entry == null) {
      return { ret: wasi.ERRNO_NOENT, inode_obj: null };
    }

    parent_entry.contents.delete(filename);

    return { ret: wasi.ERRNO_SUCCESS, inode_obj: entry };
  }

  path_unlink_file(path_str: string): number {
    const { ret: path_ret, path } = Path.from(path_str);
    if (path == null) {
      return path_ret;
    }

    const {
      ret: parent_ret,
      parent_entry,
      filename,
      entry,
    } = this.dir.get_parent_dir_and_entry_for_path(path, false);
    if (parent_entry == null || filename == null || entry == null) {
      return parent_ret;
    }
    if (entry.stat().filetype === wasi.FILETYPE_DIRECTORY) {
      return wasi.ERRNO_ISDIR;
    }
    parent_entry.contents.delete(filename);
    return wasi.ERRNO_SUCCESS;
  }

  path_remove_directory(path_str: string): number {
    const { ret: path_ret, path } = Path.from(path_str);
    if (path == null) {
      return path_ret;
    }

    const {
      ret: parent_ret,
      parent_entry,
      filename,
      entry,
    } = this.dir.get_parent_dir_and_entry_for_path(path, false);
    if (parent_entry == null || filename == null || entry == null) {
      return parent_ret;
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
    if (!parent_entry.contents.delete(filename)) {
      return wasi.ERRNO_NOENT;
    }
    return wasi.ERRNO_SUCCESS;
  }

  fd_filestat_get(): { ret: number; filestat: wasi.Filestat } {
    return { ret: 0, filestat: this.dir.stat() };
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  fd_filestat_set_size(size: bigint): number {
    return wasi.ERRNO_BADF;
  }

  fd_filestat_set_times(atim: bigint, mtim: bigint, fst_flags: number): number {
    return this.dir.set_times(atim, mtim, fst_flags);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  fd_read(size: number): { ret: number; data: Uint8Array } {
    return { ret: wasi.ERRNO_BADF, data: new Uint8Array() };
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  fd_pread(size: number, offset: bigint): { ret: number; data: Uint8Array } {
    return { ret: wasi.ERRNO_BADF, data: new Uint8Array() };
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  fd_write(data: Uint8Array): { ret: number; nwritten: number } {
    return { ret: wasi.ERRNO_BADF, nwritten: 0 };
  }

  fd_pwrite(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    data: Uint8Array,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    offset: bigint,
  ): { ret: number; nwritten: number } {
    return { ret: wasi.ERRNO_BADF, nwritten: 0 };
  }
}

export class PreopenDirectory extends OpenDirectory {
  prestat_name: string;

  constructor(name: string, contents: Map<string, InodeMem>) {
    super(new Directory(contents));
    this.prestat_name = name;
  }

  fd_prestat_get(): { ret: number; prestat: wasi.Prestat | null } {
    return {
      ret: 0,
      prestat: wasi.Prestat.dir(this.prestat_name),
    };
  }
}

function realtime(): bigint {
  return BigInt(Date.now()) * 1000000n;
}

export abstract class InodeMem extends Inode {
  atim: bigint;
  mtim: bigint;
  ctim: bigint;

  constructor() {
    super();
    const now = realtime();
    this.atim = now;
    this.mtim = now;
    this.ctim = now;
  }

  set_times(atim: bigint, mtim: bigint, fst_flags: number): number {
    const now = realtime();

    if (fst_flags & wasi.FSTFLAGS_ATIM) {
      this.atim = atim;
      this.ctim = now;
    }

    if (fst_flags & wasi.FSTFLAGS_ATIM_NOW) {
      this.atim = now;
      this.ctim = now;
    }

    if (fst_flags & wasi.FSTFLAGS_MTIM) {
      this.mtim = mtim;
      this.ctim = now;
    }

    if (fst_flags & wasi.FSTFLAGS_MTIM_NOW) {
      this.mtim = now;
      this.ctim = now;
    }

    return wasi.ERRNO_SUCCESS;
  }
}

export class File extends InodeMem {
  data: Uint8Array;
  readonly: boolean;

  constructor(
    data: ArrayBufferLike | ArrayLike<number>,
    options?: Partial<{
      readonly: boolean;
    }>,
  ) {
    super();
    this.data = new Uint8Array(data as ArrayLike<number>);
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
    return new wasi.Filestat(
      this.ino,
      wasi.FILETYPE_REGULAR_FILE,
      this.size,
      this.atim,
      this.mtim,
      this.ctim,
    );
  }
}

class Path {
  parts: string[] = [];
  is_dir: boolean = false;

  static from(path: string): { ret: number; path: Path | null } {
    const self = new Path();
    self.is_dir = path.endsWith("/");

    if (path.startsWith("/")) {
      return { ret: wasi.ERRNO_NOTCAPABLE, path: null };
    }
    if (path.includes("\0")) {
      return { ret: wasi.ERRNO_INVAL, path: null };
    }

    for (const component of path.split("/")) {
      if (component === "" || component === ".") {
        continue;
      }
      if (component === "..") {
        if (self.parts.pop() == undefined) {
          return { ret: wasi.ERRNO_NOTCAPABLE, path: null };
        }
        continue;
      }
      self.parts.push(component);
    }

    return { ret: wasi.ERRNO_SUCCESS, path: self };
  }

  to_path_string(): string {
    let s = this.parts.join("/");
    if (this.is_dir) {
      s += "/";
    }
    return s;
  }
}

export class Directory extends InodeMem {
  contents: Map<string, InodeMem>;
  parent: Directory | null = null;

  constructor(contents: Map<string, InodeMem> | [string, InodeMem][]) {
    super();
    if (contents instanceof Array) {
      this.contents = new Map(contents);
    } else {
      this.contents = contents;
    }

    for (const entry of this.contents.values()) {
      if (entry instanceof Directory) {
        entry.parent = this;
      }
    }
  }

  parent_ino(): bigint {
    if (this.parent == null) {
      return Inode.root_ino();
    }
    return this.parent.ino;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  path_open(oflags: number, fs_rights_base: bigint, fd_flags: number) {
    return { ret: wasi.ERRNO_SUCCESS, fd_obj: new OpenDirectory(this) };
  }

  stat(): wasi.Filestat {
    return new wasi.Filestat(
      this.ino,
      wasi.FILETYPE_DIRECTORY,
      0n,
      this.atim,
      this.mtim,
      this.ctim,
    );
  }

  get_entry_for_path(path: Path): { ret: number; entry: InodeMem | null } {
    let entry: InodeMem = this;
    for (const component of path.parts) {
      if (!(entry instanceof Directory)) {
        return { ret: wasi.ERRNO_NOTDIR, entry: null };
      }
      const child = entry.contents.get(component);
      if (child !== undefined) {
        entry = child;
      } else {
        debug.log(component);
        return { ret: wasi.ERRNO_NOENT, entry: null };
      }
    }

    if (path.is_dir) {
      if (entry.stat().filetype != wasi.FILETYPE_DIRECTORY) {
        return { ret: wasi.ERRNO_NOTDIR, entry: null };
      }
    }

    return { ret: wasi.ERRNO_SUCCESS, entry };
  }

  get_parent_dir_and_entry_for_path(
    path: Path,
    allow_undefined: boolean,
  ): {
    ret: number;
    parent_entry: Directory | null;
    filename: string | null;
    entry: InodeMem | null;
  } {
    const filename = path.parts.pop();

    if (filename === undefined) {
      return {
        ret: wasi.ERRNO_INVAL,
        parent_entry: null,
        filename: null,
        entry: null,
      };
    }

    const { ret: entry_ret, entry: parent_entry } =
      this.get_entry_for_path(path);
    if (parent_entry == null) {
      return {
        ret: entry_ret,
        parent_entry: null,
        filename: null,
        entry: null,
      };
    }
    if (!(parent_entry instanceof Directory)) {
      return {
        ret: wasi.ERRNO_NOTDIR,
        parent_entry: null,
        filename: null,
        entry: null,
      };
    }
    const entry: InodeMem | undefined | null =
      parent_entry.contents.get(filename);
    if (entry === undefined) {
      if (!allow_undefined) {
        return {
          ret: wasi.ERRNO_NOENT,
          parent_entry: null,
          filename: null,
          entry: null,
        };
      } else {
        return { ret: wasi.ERRNO_SUCCESS, parent_entry, filename, entry: null };
      }
    }

    if (path.is_dir) {
      if (entry.stat().filetype != wasi.FILETYPE_DIRECTORY) {
        return {
          ret: wasi.ERRNO_NOTDIR,
          parent_entry: null,
          filename: null,
          entry: null,
        };
      }
    }

    return { ret: wasi.ERRNO_SUCCESS, parent_entry, filename, entry };
  }

  create_entry_for_path(
    path_str: string,
    is_dir: boolean,
  ): { ret: number; entry: InodeMem | null } {
    const { ret: path_ret, path } = Path.from(path_str);
    if (path == null) {
      return { ret: path_ret, entry: null };
    }

    let {
      // eslint-disable-next-line prefer-const
      ret: parent_ret,
      // eslint-disable-next-line prefer-const
      parent_entry,
      // eslint-disable-next-line prefer-const
      filename,
      entry,
    } = this.get_parent_dir_and_entry_for_path(path, true);
    if (parent_entry == null || filename == null) {
      return { ret: parent_ret, entry: null };
    }

    if (entry != null) {
      return { ret: wasi.ERRNO_EXIST, entry: null };
    }

    debug.log("create", path);
    let new_child;
    if (!is_dir) {
      new_child = new File(new ArrayBuffer(0));
    } else {
      new_child = new Directory(new Map());
      new_child.parent = parent_entry;
    }
    parent_entry.contents.set(filename, new_child);
    entry = new_child;

    return { ret: wasi.ERRNO_SUCCESS, entry };
  }
}

export class ConsoleStdout extends Fd {
  private ino: bigint;
  write: (buffer: Uint8Array) => void;

  constructor(write: (buffer: Uint8Array) => void) {
    super();
    this.ino = Inode.issue_ino();
    this.write = write;
  }

  fd_filestat_get(): { ret: number; filestat: wasi.Filestat } {
    const filestat = new wasi.Filestat(
      this.ino,
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

  fd_write(data: Uint8Array): { ret: number; nwritten: number } {
    this.write(data);
    return { ret: 0, nwritten: data.byteLength };
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
