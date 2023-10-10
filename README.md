# A pure javascript shim for WASI

Implementation status: A subset of wasi_snapshot_preview1 is implemented. The rest either throws an exception, returns an error or is incorrectly implemented.

## Usage

```
npm install @bjorn3/browser_wasi_shim --save
```

```javascript
import { WASI, File, OpenFile, PreopenDirectory } from "@bjorn3/browser_wasi_shim";

let args = ["bin", "arg1", "arg2"];
let env = ["FOO=bar"];
let fds = [
    new OpenFile(new File([])), // stdin
    new OpenFile(new File([])), // stdout
    new OpenFile(new File([])), // stderr
    new PreopenDirectory(".", {
        "example.c": new File(new TextEncoder("utf-8").encode(`#include "a"`)),
        "hello.rs": new File(new TextEncoder("utf-8").encode(`fn main() { println!("Hello World!"); }`)),
    }),
];
let wasi = new WASI(args, env, fds);

let wasm = await WebAssembly.compileStreaming(fetch("bin.wasm"));
let inst = await WebAssembly.instantiate(wasm, {
    "wasi_snapshot_preview1": wasi.wasiImport,
});
wasi.start(inst);
```

## Building

```
$ npm install
$ npm run build
```

## Running tests

This project uses playwright to run tests in a browser using WebAssembly built from the Wasmtime project.

To clone wasmtime and build the test WebAssembly, run:

```
$ npm test:build
```

Once the WebAssembly is built, you can run the tests with:

```
$ npm test
```

## Running the demo

The demo requires the wasm rustc artifacts and the xterm js package. To get them run:

```
$ git submodule update --init
$ cd examples && npm install
```

Run the demo with a static web server from the root of this project:

```
$ npx http-server
```

And visit [http://127.0.0.1:8080/examples/rustc.html]() in your browser.

## License

Licensed under either of

  * Apache License, Version 2.0 ([LICENSE-APACHE](LICENSE-APACHE) or
    http://www.apache.org/licenses/LICENSE-2.0)
  * MIT license ([LICENSE-MIT](LICENSE-MIT) or
    http://opensource.org/licenses/MIT)

at your option.

### Contribution

Unless you explicitly state otherwise, any contribution intentionally submitted
for inclusion in the work by you shall be dual licensed as above, without any
additional terms or conditions.
