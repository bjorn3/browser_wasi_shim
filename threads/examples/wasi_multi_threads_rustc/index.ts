import { Fd } from "@bjorn3/browser_wasi_shim";
import { SharedObject } from "@oligami/shared-object";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "xterm-addon-fit";
import { WASIFarm } from "../../src";
import { wait_async_polyfill } from "../../src";

wait_async_polyfill();

import "@xterm/xterm/css/xterm.css";

const term = new Terminal({
  convertEol: true,
});
const terminalElement = document.getElementById("terminal");

if (!terminalElement) {
  throw new Error("No terminal element found");
}

term.open(terminalElement);

const fitAddon = new FitAddon();
term.loadAddon(fitAddon);
fitAddon.fit();

// term.onData(data => {
//   term.write(data);
// });

const shared = new SharedObject(
  {
    writeln(data) {
      term.writeln(data);
    },
    writeUtf8(data) {
      term.write(new TextDecoder().decode(data));
    },
  },
  "term",
);

term.writeln("Initializing WASI...");

class XtermStdio extends Fd {
  term: Terminal;

  constructor(term: Terminal) {
    super();
    this.term = term;
  }
  fd_write(data: Uint8Array) /*: {ret: number, nwritten: number}*/ {
    this.term.write(new TextDecoder().decode(data));
    return { ret: 0, nwritten: data.byteLength };
  }
}

const farm = new WASIFarm(
  new XtermStdio(term),
  new XtermStdio(term),
  new XtermStdio(term),
  [],
  // { debug: true },
);

const worker = new Worker("./worker.ts", { type: "module" });

worker.postMessage({
  wasi_ref: farm.get_ref(),
});
