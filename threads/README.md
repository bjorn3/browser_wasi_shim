# A pure javascript shim for WASI Preview 1 threads

This project is implement threads on browser_wasi_shim

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
