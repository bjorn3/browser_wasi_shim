import * as wasi from "./wasi_defs.js";
import { Fd, Inode } from "./fd.js";

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
  constructor(
    handle: FileSystemSyncAccessHandle,
    options?: Partial<{
      readonly: boolean;
    }>,
  ) {
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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
}
