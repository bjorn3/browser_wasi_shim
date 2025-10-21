import json
import os
import shlex
from functools import lru_cache
from pathlib import Path
from typing import Dict, List, Tuple

def _adapter_dir() -> Path:
    spec = globals().get("__spec__")
    if spec is not None and getattr(spec, "origin", None):
        return Path(spec.origin).parent
    return Path(__file__).parent


_ADAPTER_DIR = _adapter_dir()


@lru_cache(maxsize=1)
def _package_metadata() -> Dict[str, str]:
    with (_ADAPTER_DIR.parents[2] / "package.json").open(encoding="utf-8") as pkg_file:
        return json.load(pkg_file)


def get_name() -> str:
    return f"{_package_metadata()['name']} ({_ADAPTER_DIR.name})"


def get_version() -> str:
    return _package_metadata()["version"]


def get_wasi_versions() -> List[str]:
    return ["wasm32-wasip1"]


def compute_argv(test_path: str,
                 args: List[str],
                 env: Dict[str, str],
                 dirs: List[Tuple[Path, str]],
                 wasi_version: str) -> List[str]:
    if wasi_version != "wasm32-wasip1":
        raise RuntimeError(f"unsupported WASI version: {wasi_version}")

    node_cmd = shlex.split(os.environ.get("NODE", "node"))
    run_wasi = _ADAPTER_DIR / "run-wasi.mjs"
    argv = node_cmd + [str(run_wasi), f"--test-file={test_path}"]

    for arg in args:
        argv.extend(["--arg", arg])

    for key, value in env.items():
        argv.extend(["--env", f"{key}={value}"])

    for host, guest in dirs:
        argv.extend(["--dir", f"{os.fspath(host)}::{guest}"])

    if os.environ.get("VERBOSE_ADAPTER"):
        print(" ".join(shlex.quote(component) for component in argv))

    return argv
