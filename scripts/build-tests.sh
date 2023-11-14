#!/bin/bash

SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )

WASMTIME_DIR=$SCRIPT_DIR/../wasmtime

if ! [[ -d wasmtime ]]; then
  git clone --recurse-submodules https://github.com/bytecodealliance/wasmtime.git --depth=1 $WASMTIME_DIR;
fi

cargo build --manifest-path $WASMTIME_DIR/crates/test-programs/artifacts/Cargo.toml

TARGET_DIR=$(ls -dt $WASMTIME_DIR/target/debug/build/test-programs-artifacts-* | head -n 1)

if [[ -f $WASMTIME_DIR/artifacts ]]; then
  $WASMTIME_DIR/artifacts
fi

ln -s $TARGET_DIR/out/wasm32-wasi/debug $WASMTIME_DIR/artifacts

