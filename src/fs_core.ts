import { OpenDirectory, OpenFile, OpenSyncOPFSFile } from "./fs_fd.js";
import * as wasi from "./wasi_defs.js";

export class File {
  data: Uint8Array;

  constructor(data: ArrayBuffer | Uint8Array | Array<number>) {
    //console.log(data);
    this.data = new Uint8Array(data);
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

  truncate() {
    this.data = new Uint8Array([]);
  }
}

// shim https://developer.mozilla.org/en-US/docs/Web/API/FileSystemSyncAccessHandle
export interface FileSystemSyncAccessHandle {
  close(): undefined;
  flush(): undefined;
  getSize(): number;
  read(buffer: ArrayBuffer | ArrayBufferView, options?: { at: number }): number;
  truncate(to: number): undefined;
  write(buffer: ArrayBuffer | ArrayBufferView, options?: { at: number }): number;
}

export class SyncOPFSFile {
  // FIXME needs a close() method to be called after start() to release the underlying handle
  constructor(public handle: FileSystemSyncAccessHandle) { }

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

  truncate() {
    return this.handle.truncate(0);
  }

}

export class Directory {
  contents: { [key: string]: File | Directory | SyncOPFSFile };

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
