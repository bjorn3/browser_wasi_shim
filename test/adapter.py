import subprocess
import pathlib
import sys
import os

run_wasi_mjs = pathlib.Path(__file__).parent / "run-wasi.mjs"
args = sys.argv[1:]
cmd = ["node", str(run_wasi_mjs)] + args
if os.environ.get("VERBOSE_ADAPTER") is not None:
    print(" ".join(map(lambda x: f"'{x}'", cmd)))

result = subprocess.run(cmd, check=False)
sys.exit(result.returncode)
