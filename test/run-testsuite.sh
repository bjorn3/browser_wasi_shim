#!/bin/bash

set -euo pipefail

TEST_DIR="$(cd "$(dirname $0)" && pwd)"
TESTSUITE_ROOT="$TEST_DIR/wasi-testsuite"

python3 "$TESTSUITE_ROOT/test-runner/wasi_test_runner.py"  \
    --test-suite "$TESTSUITE_ROOT/tests/assemblyscript/testsuite/" \
                 "$TESTSUITE_ROOT/tests/c/testsuite/" \
                 "$TESTSUITE_ROOT/tests/rust/testsuite/" \
    --runtime-adapter "$TEST_DIR/adapter.py" \
    --exclude-filter "$TEST_DIR/skip.json" \
    $@
