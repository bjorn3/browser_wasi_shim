export const get_func_name_from_number = (num: number): string => {
  switch (num) {
    case 7: return "fd_advise";
    case 8: return "fd_allocate";
    case 9: return "fd_close";
    case 10: return "fd_datasync";
    case 11: return "fd_fdstat_get";
    case 12: return "fd_fdstat_set_flags";
    case 13: return "fd_fdstat_set_rights";
    case 14: return "fd_filestat_get";
    case 15: return "fd_filestat_set_size";
    case 16: return "fd_filestat_set_times";
    case 17: return "fd_pread";
    case 18: return "fd_prestat_get";
    case 19: return "fd_prestat_dir_name";
    case 20: return "fd_pwrite";
    case 21: return "fd_read";
    case 22: return "fd_readdir";
    case 23: return "fd_renumber";
    case 24: return "fd_seek";
    case 25: return "fd_sync";
    case 26: return "fd_tell";
    case 27: return "fd_write";
    case 28: return "path_create_directory";
    case 29: return "path_filestat_get";
    case 30: return "path_filestat_set_times";
    case 31: return "path_link";
    case 32: return "path_open";
    case 33: return "path_readlink";
    case 34: return "path_remove_directory";
    case 35: return "path_rename";
    case 36: return "path_symlink";
    case 37: return "path_unlink_file";
    default: return "unknown";
  }
}
