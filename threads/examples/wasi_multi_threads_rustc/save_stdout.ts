import { SharedObject, SharedObjectRef } from "@oligami/shared-object";
import { WASIFarm } from "../../src";
import { Fd } from "@bjorn3/browser_wasi_shim";
import { resolve } from "node:path";

const term = new SharedObjectRef("term").proxy<{
  writeln: (data) => Promise<void>;
  writeUtf8: (data) => Promise<void>;
}>();

class Stdout extends Fd {
  buffer = new Uint8Array(0);

  fd_write(data: Uint8Array): { ret: number; nwritten: number } {
    const { promise, resolve } = Promise.withResolvers();

    (async () => {
      const new_buffer = new Uint8Array(this.buffer.length + data.length);
      new_buffer.set(this.buffer);
      new_buffer.set(data, this.buffer.length);
      this.buffer = new_buffer;
      await term.writeUtf8(data);

      resolve({ ret: 0, nwritten: data.byteLength });
    })();

    return promise as unknown as { ret: number; nwritten: number };
  }
}

const std_out = new Stdout();

const std_err = new Stdout();

const shared_std_out = new SharedObject(
  {
    get() {
      return new TextDecoder().decode(std_out.buffer);
    },
    reset() {
      std_out.buffer = new Uint8Array(0);
    },
  },
  "std_out_keep",
);

const shared_std_err = new SharedObject(
  {
    get() {
      return new TextDecoder().decode(std_err.buffer);
    },
    reset() {
      std_err.buffer = new Uint8Array(0);
    },
  },
  "std_err_keep",
);

const farm = new WASIFarm(undefined, std_out, std_err);

const ret = await farm.get_ref();

postMessage({ wasi_ref: ret });
