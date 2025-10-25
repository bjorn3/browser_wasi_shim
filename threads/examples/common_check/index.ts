import { Fd } from "@bjorn3/browser_wasi_shim";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "xterm-addon-fit";
import { WASIFarm } from "../../src";
import { wait_async_polyfill } from "../../src";

import "@xterm/xterm/css/xterm.css";

wait_async_polyfill();

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

term.writeln("Initializing...");

class XtermStdio extends Fd {
  term: Terminal;

  constructor(term: Terminal) {
    super();
    this.term = term;
  }
  fd_write(data: Uint8Array) /*: {ret: number, nwritten: number}*/ {
    const str = new TextDecoder().decode(data);
    this.term.write(str);
    console.log(str);
    return { ret: 0, nwritten: data.byteLength };
  }
}

const farm = new WASIFarm(
  new XtermStdio(term),
  new XtermStdio(term),
  new XtermStdio(term),
  [],
);

const worker = new Worker("./worker.ts", { type: "module" });

worker.postMessage({
  wasi_ref: farm.get_ref(),
});

worker.onmessage = (e) => {
  if (e.data.done) {
    term.writeln("All Done!!");
  }
};
