#!/bin/bash

set -euo pipefail

TEST_DIR="$(cd "$(dirname $0)" && pwd)"
TESTSUITE_ROOT="$TEST_DIR/wasi-testsuite"
ADAPTER="node"
# Take the first argument as the adapter name if given
if [ $# -gt 0 ]; then
    ADAPTER="$1"
    shift
fi

python3 "$TESTSUITE_ROOT/test-runner/wasi_test_runner.py"  \
    --test-suite "$TESTSUITE_ROOT/tests/assemblyscript/testsuite/" \
                 "$TESTSUITE_ROOT/tests/c/testsuite/" \
                 "$TESTSUITE_ROOT/tests/rust/testsuite/" \
    --runtime-adapter "$TEST_DIR/adapters/$ADAPTER/adapter.py" \
    --exclude-filter "$TEST_DIR/skip.json" \
    $@
