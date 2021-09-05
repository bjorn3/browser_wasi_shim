import * as wasi from "./wasi_defs.js";
import { File, Directory } from "./fs_core.js";

export class Fd {
    fd_advise(offset, len, advice) {
        return -1;
    }
    fd_allocate(offset, len) {
        return -1;
    }
    fd_close() {
        return -1;
    }
    fd_datasync() {
        return -1;
    }
    fd_fdstat_get() {
        return { ret: -1, fdstat: null };
    }
    fd_fdstat_set_flags(flags) {
        return -1;
    }
    fd_fdstat_set_rights(fs_rights_base, fs_rights_inheriting) {
        return -1;
    }
    fd_filestat_get() {
        return { ret: -1, filestat: null };
    }
    fd_filestat_set_size(size) {
        return -1;
    }
    fd_filestat_set_times(atim, mtim, fst_flags) {
        return -1;
    }
    fd_pread(view8, iovs, offset) {
        return { ret: -1, nread: 0 };
    }
    fd_prestat_get() {
        return { ret: -1, prestat: null };
    }
    fd_prestat_dir_name(path_ptr, path_len) {
        return { ret: -1, prestat_dir_name: null };
    }
    fd_pwrite(view8, iovs, offset) {
        return { ret: -1, nwritten: 0 };
    }
    fd_read(view8, iovs) {
        return { ret: -1, nread: 0 };
    }
    fd_readdir_single(cookie) {
        return { ret: -1, dirent: null };
    }
    fd_seek(offset, whence) {
        return { ret: -1, offset: 0 };
    }
    fd_sync() {
        return -1;
    }
    fd_tell() {
        return { ret: -1, offset: 0 };
    }
    fd_write(view8, iovs) {
        return { ret: -1, nwritten: 0 };
    }
    path_create_directory(path) {
        return -1;
    }
    path_filestat_get(flags, path) {
        return { ret: -1, filestat: null };
    }
    path_filestat_set_times(flags, path, atim, mtim, fst_flags) {
        return -1;
    }
    path_link(old_fd, old_flags, old_path, new_path) {
        return -1;
    }
    path_open(dirflags, path, oflags, fs_rights_base, fs_rights_inheriting, fdflags) {
        return { ret: -1, fd_obj: null };
    }
    path_readlink(path) {
        return { ret: -1, data: null };
    }
    path_remove_directory(path) {
        return -1;
    }
    path_rename(old_path, new_fd, new_path) {
        return -1;
    }
    path_symlink(old_path, new_path) {
        return -1;
    }
    path_unlink_file(path) {
        return -1;
    }
}

export class OpenFile extends Fd {
    file = null;
    file_pos = 0;

    constructor(file) {
        super();
        this.file = file;
    }

    fd_read(view8, iovs) {
        let nread = 0;
        for (let iovec of iovs) {
            if (this.file_pos < this.file.data.byteLength) {
                let slice = this.file.data.slice(this.file_pos, this.file_pos + iovec.buf_len);
                view8.set(slice, iovec.buf);
                this.file_pos += slice.length;
                nread += slice.length;
            } else {
                break;
            }
        }
        return { ret: 0, nread };
    }

    fd_write(view8, iovs) {
        let nwritten = 0;
        for (let iovec of iovs) {
            let buffer = view8.slice(iovec.buf, iovec.buf + iovec.buf_len);
            if (this.file_pos + buffer.byteLength > this.file.size) {
                let old = this.file.data;
                this.file.data = new Uint8Array(this.file_pos + buffer.byteLength);
                this.file.data.set(old);
            }
            this.file.data.set(
                buffer.slice(
                    0,
                    this.file.size - this.file_pos,
                ), this.file_pos
            );
            this.file_pos += buffer.byteLength;
            nwritten += iovec.buf_len;
        }
        return { ret: 0, nwritten };
    }

    fd_filestat_get() {
        return { ret: 0, stat: this.file.stat() };
    }
}

export class OpenDirectory extends Fd {
    dir = null;

    constructor(dir) {
        super();
        this.dir = dir;
    }

    fd_readdir_single(cookie) {
        console.log(cookie, Object.keys(this.dir.contents).slice(Number(cookie)));
        if (cookie >= BigInt(Object.keys(this.dir.contents).length)) {
            return { ret: 0, dirent: null };
        }

        let name = Object.keys(this.dir.contents)[Number(cookie)];
        let entry = this.dir.contents[name];
        let encoded_name = new TextEncoder("utf-8").encode(name);

        return { ret: 0, dirent: new wasi.Dirent(cookie + 1n, name, entry.stat().filetype) };
    }

    path_filestat_get(flags, path) {
        let entry = this.dir.get_entry_for_path(path);
        if (entry == null) {
            return { ret: -1, filestat: null };
        }
        return { ret: 0, filestat: entry.stat() };
    }

    path_open(dirflags, path, oflags, fs_rights_base, fs_rights_inheriting, fd_flags) {
        let entry = this.dir.get_entry_for_path(path);
        if (entry == null) {
            if ((oflags & wasi.OFLAGS_CREAT) == wasi.OFLAGS_CREAT) {
                entry = this.dir.create_entry_for_path(path);
            } else {
                return { ret: -1, fd_obj: null };
            }
        } else if ((oflags & wasi.OFLAGS_EXCL) == wasi.OFLAGS_EXCL) {
            return { ret: -1, fd_obj: null };
        }
        if ((oflags & wasi.OFLAGS_DIRECTORY) == wasi.OFLAGS_DIRECTORY && entry.stat().filetype != wasi.FILETYPE_DIRECTORY) {
            return { ret: -1, fd_obj: null };
        }
        if ((oflags & wasi.OFLAGS_TRUNC) == wasi.OFLAGS_TRUNC) {
            entry.truncate();
        }
        // FIXME handle this more elegantly
        if (entry instanceof File) {
            return { ret: 0, fd_obj: new OpenFile(entry) };
        } else if (entry instanceof Directory) {
            return { ret: 0, fd_obj: new OpenDirectory(entry) };
        } else {
            throw "dir entry neither file nor dir";
        }
    }
}

export class PreopenDirectory extends OpenDirectory {
    prestat_name = null;

    constructor(name, contents) {
        super(new Directory(contents));
        this.prestat_name = new TextEncoder("utf-8").encode(name);
    }

    fd_prestat_get() {
        return {
            ret: 0, prestat: wasi.Prestat.dir(this.prestat_name.length)
        };
    }

    fd_prestat_dir_name() {
        return {
            ret: 0, prestat_dir_name: this.prestat_name
        };
    }
}

export class Stdio extends Fd {
    fd_write(view8, iovs) {
        let nwritten = 0;
        for (let iovec of iovs) {
            console.log(iovec.buf_len, iovec.buf_len, view8.slice(iovec.buf, iovec.buf + iovec.buf_len));
            let buffer = view8.slice(iovec.buf, iovec.buf + iovec.buf_len);
            document.body.innerText += new TextDecoder("utf-8").decode(buffer);
            nwritten += iovec.buf_len;
        }
        return { ret: 0, nwritten };
    }
}
