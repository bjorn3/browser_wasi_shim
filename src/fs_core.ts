import { OpenDirectory, OpenFile, OpenSyncOPFSFile } from "./fs_fd.js";
import * as wasi from "./wasi_defs.js";

// options that can be passed to Files and SyncOPFSFiles
type FileOptions = Partial<{
  readonly: boolean;
}>;

export class File {
  data: Uint8Array;
  readonly: boolean;

  constructor(data: ArrayBuffer | SharedArrayBuffer | Uint8Array | Array<number>, options?: FileOptions) {
    this.data = new Uint8Array(data);
    this.readonly = !!options?.readonly;
  }

  open(fd_flags: number) {
    let file = new OpenFile(this);
    if (fd_flags & wasi.FDFLAGS_APPEND) file.fd_seek(0n, wasi.WHENCE_END);
    return file;
  }

  get size(): bigint {
    return BigInt(this.data.byteLength);
  }

  stat(): wasi.Filestat {
    return new wasi.Filestat(wasi.FILETYPE_REGULAR_FILE, this.size);
  }

  truncate(): number {
    if (this.readonly) return wasi.ERRNO_PERM;
    this.data = new Uint8Array([]);
    return wasi.ERRNO_SUCCESS;
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
  write(buffer: ArrayBuffer | ArrayBufferView, options?: { at: number }): number;
}

// Synchronous access to an individual file in the origin private file system.
// Only allowed inside a WebWorker.
export class SyncOPFSFile {
  handle: FileSystemSyncAccessHandle;
  readonly: boolean;

  // FIXME needs a close() method to be called after start() to release the underlying handle
  constructor(handle: FileSystemSyncAccessHandle, options?: FileOptions) {
    this.handle = handle;
    this.readonly = !!options?.readonly;
  }

  open(fd_flags: number) {
    let file = new OpenSyncOPFSFile(this);
    if (fd_flags & wasi.FDFLAGS_APPEND) file.fd_seek(0n, wasi.WHENCE_END);
    return file;
  }

  get size(): bigint {
    return BigInt(this.handle.getSize());
  }

  stat(): wasi.Filestat {
    return new wasi.Filestat(wasi.FILETYPE_REGULAR_FILE, this.size);
  }

  truncate(): number {
    if (this.readonly) return wasi.ERRNO_PERM;
    this.handle.truncate(0);
    return wasi.ERRNO_SUCCESS;
  }

}

export class Directory {
  contents: { [key: string]: File | Directory | SyncOPFSFile };
  readonly = false; // FIXME implement, like marking all files within readonly?

  constructor(contents: { [key: string]: File | Directory | SyncOPFSFile }) {
    this.contents = contents;
  }

  open(fd_flags: number) {
    return new OpenDirectory(this);
  }

  stat(): wasi.Filestat {
    return new wasi.Filestat(wasi.FILETYPE_DIRECTORY, 0n);
  }

  get_entry_for_path(path: string): File | Directory | SyncOPFSFile | null {
    let entry: File | Directory | SyncOPFSFile = this;
    for (let component of path.split("/")) {
      if (component == "") break;
      if (component == ".") continue;
      if (!(entry instanceof Directory)) {
        return null;
      }
      if (entry.contents[component] != undefined) {
        entry = entry.contents[component];
      } else {
        //console.log(component);
        return null;
      }
    }
    return entry;
  }

  create_entry_for_path(path: string, is_dir: boolean): File | Directory {
    // FIXME fix type errors
    let entry: File | Directory = this;
    let components: Array<string> = path
      .split("/")
      .filter((component) => component != "/");
    for (let i = 0; i < components.length; i++) {
      let component = components[i];
      // @ts-ignore
      if (entry.contents[component] != undefined) {
        // @ts-ignore
        entry = entry.contents[component];
      } else {
        //console.log("create", component);
        if ((i == components.length - 1) && !is_dir) {
          // @ts-ignore
          entry.contents[component] = new File(new ArrayBuffer(0));
        } else {
          // @ts-ignore
          entry.contents[component] = new Directory({});
        }
        // @ts-ignore
        entry = entry.contents[component];
      }
    }
    return entry;
  }
}
