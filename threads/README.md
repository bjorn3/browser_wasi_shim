# A pure javascript shim for WASI Preview 1 threads

> [!WARNING]
> The code in this directory is less production ready than the main browser_wasi_shim code.
> This code requires `SharedArrayBuffer`, `waitAsync` and `Atomics` to be enabled in the browser, so it may not work in all browsers.
> For example, Firefox failed to run the demo in this directory.
> Chrome worked fine.
> This library require `cross-origin isolation` to be enabled in the browser.

This project implement threads on browser_wasi_shim

# Features
- [x] thread creation
- [x] Filesystem wrapper accessible by multiple workers
- [ ] thread pool

# Building
```sh
$ npm install
$ npm run build
```

# Running the demo
```sh
$ git submodule update --init
$ cd examples && npm install && npm run dev
```
And visit http://localhost
