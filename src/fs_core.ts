import * as wasi from "./wasi_defs.js";

export class File {
  data: Uint8Array;

  constructor(data: ArrayBuffer | Uint8Array | Array<number>) {
    //console.log(data);
    this.data = new Uint8Array(data);
  }

  get size(): number {
    return this.data.byteLength;
  }

  stat(): wasi.Filestat {
    return new wasi.Filestat(wasi.FILETYPE_REGULAR_FILE, this.size);
  }

  truncate() {
    this.data = new Uint8Array([]);
  }
}

export class Directory {
  contents: { [key: string]: File | Directory };

  constructor(contents: { [key: string]: File | Directory }) {
    this.contents = contents;
  }

  stat(): wasi.Filestat {
    return new wasi.Filestat(wasi.FILETYPE_DIRECTORY, 0);
  }

  get_entry_for_path(path: string): File | Directory | null {
    let entry: File | Directory = this;
    for (let component of path.split("/")) {
      if (component == "") break;
      if (this.contents[component] != undefined) {
        entry = this.contents[component];
      } else {
        //console.log(component);
        return null;
      }
    }
    return entry;
  }

  create_entry_for_path(path: string): File | Directory {
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
        if (i == components.length - 1) {
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
