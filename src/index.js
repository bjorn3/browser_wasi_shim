import WASI from "./wasi.js"
import { File } from "./fs_core.js"
import { PreopenDirectory } from "./fs_fd.js"
import { strace } from "./strace.js"

module.exports = {
    WASI,
    File,
    PreopenDirectory,
    strace,
}

