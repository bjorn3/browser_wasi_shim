import { WASI, File, PreopenDirectory } from "../dist/index.js";

const stdio = {
  stdin: undefined,
  stdout: new File(),
  stderr: new File(),
};

const WASI_ENVS = {
  DEFAULT: [
    stdio.stdin,
    stdio.stdout,
    stdio.stderr,
    new PreopenDirectory("/", {}),
  ],
};

async function main(options) {
  const wasmReq = await fetch(options.file);

  const args = [options.file];
  args.push(...(options.args || []));

  const wasi = new WASI(
    args,
    (options.env || "").split(","),
    WASI_ENVS[options.wasi_env] || WASI_ENVS.DEFAULT,
    {
      debug: true,
    },
  );
  const module = await WebAssembly.compileStreaming(wasmReq);

  const instance = await WebAssembly.instantiate(module, {
    wasi_snapshot_preview1: wasi.wasiImport,
  });

  const status = document.getElementById("status");
  try {
    if (options.reactor) {
      wasi.initialize(instance);
    }
    if (options.command) {
      wasi.start(instance);
    }
    printBuffer(stdio, "stdout", "log");
    printBuffer(stdio, "stderr", "log");
    status.innerText = "success";
  } catch (e) {
    printBuffer(stdio, "stdout", "log");
    printBuffer(stdio, "stderr", "error");
    status.innerText = "failure";
    throw e;
  }
}

function printBuffer(stdio, type, logger) {
  const output = new TextDecoder().decode(stdio[type].data);
  if (output.trim().length > 0) {
    console[logger](`${type}`, output);
  }
}

main(JSON.parse(decodeURI(location.search.slice(1))))
  .then(() => {
    console.log("done");
  })
  .catch((e) => {
    console.error(e);
    throw e;
  });
