import { WASIProcExit } from "@bjorn3/browser_wasi_shim";
import { wasi } from "@bjorn3/browser_wasi_shim";
import type { WASIFarmRef } from "./ref.ts";
import type { WASIFarmRefObject } from "./ref.ts";
import type { FdCloseSender } from "./sender.ts";
import { WASIFarmRefUseArrayBuffer } from "./shared_array_buffer/index.ts";
import type { WASIFarmRefUseArrayBufferObject } from "./shared_array_buffer/index.ts";
import { ThreadSpawner } from "./shared_array_buffer/index.ts";

export class WASIFarmAnimal {
  args: Array<string>;
  env: Array<string>;

  private wasi_farm_refs: WASIFarmRef[];

  private id_in_wasi_farm_ref: Array<number>;

  inst: { exports: { memory: WebAssembly.Memory } } | undefined;
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  wasiImport: { [key: string]: (...args: Array<any>) => unknown };

  wasiThreadImport: {
    "thread-spawn": (start_arg: number) => number;
  };

  private can_array_buffer;

  private can_thread_spawn?: boolean;

  private thread_spawner?: ThreadSpawner;

  async wait_worker_background_worker(): Promise<void> {
    await this.thread_spawner?.wait_worker_background_worker();
  }

  check_worker_background_worker(): void {
    this.thread_spawner?.check_worker_background_worker();
  }

  // Each process has a specific fd that it can access.
  // If it does not exist in the map, it cannot be accessed.
  // child process can access parent process's fd.
  // so, it is necessary to manage the fd on global scope.
  // [fd, wasi_ref_n]
  protected fd_map: Array<[number, number]> = [];

  protected get_fd_and_wasi_ref(
    fd: number,
  ): [number | undefined, WASIFarmRef | undefined] {
    const mapped_fd_and_wasi_ref_n = this.fd_map[fd];
    if (!mapped_fd_and_wasi_ref_n) {
      // console.log("fd", fd, "is not found");
      return [undefined, undefined];
    }
    const [mapped_fd, wasi_ref_n] = mapped_fd_and_wasi_ref_n;
    // console.log("fd", fd, "is found", "mapped_fd", mapped_fd, "wasi_ref_n", wasi_ref_n);
    return [mapped_fd, this.wasi_farm_refs[wasi_ref_n]];
  }

  protected get_fd_and_wasi_ref_n(
    fd: number,
  ): [number | undefined, number | undefined] {
    const mapped_fd_and_wasi_ref_n = this.fd_map[fd];
    if (!mapped_fd_and_wasi_ref_n) {
      // console.log("fd", fd, "is not found");
      return [undefined, undefined];
    }
    const [mapped_fd, wasi_ref_n] = mapped_fd_and_wasi_ref_n;
    // console.log("fd", fd, "is found", "mapped_fd", mapped_fd, "wasi_ref_n", wasi_ref_n);
    return [mapped_fd, wasi_ref_n];
  }

  /** Start a WASI command
  When this function is executed, the WebAssembly (Wasm) code runs on that thread.
  If the Wasm code throws an error or calls process_exit,
  the main thread would need to be forcibly terminated. However, since this is not possible, if the Wasm code aborts in a child thread, it will be thrown from the worker_background_worker function. By default, this function is hidden. For detailed usage, please refer to the examples/worker_background_worker.ts file.
  If you are dealing with programs that may abort,
  consider using async_start_on_thread or block_start_on_thread instead. */
  start(instance: {
    // FIXME v0.3: close opened Fds after execution
    exports: { memory: WebAssembly.Memory; _start: () => unknown };
  }): number {
    this.inst = instance;

    try {
      instance.exports._start();

      if (this.can_thread_spawn) {
        if (!this.thread_spawner) {
          throw new Error("thread_spawner is not defined");
        }
        this.thread_spawner.done_notify(0);
      }

      return 0;
    } catch (e) {
      if (e instanceof WASIProcExit) {
        if (this.can_thread_spawn) {
          // biome-ignore lint/style/noNonNullAssertion: <explanation>
          this.thread_spawner!.done_notify(e.code);
        }

        return e.code;
      }
      throw e;
    }
  }

  /**
   * This function is similar to start, but it does not handle error and exit code.
   */
  start_only(instance: {
    exports: { memory: WebAssembly.Memory; _start: () => unknown };
  }) {
    this.inst = instance;
    instance.exports._start();
  }

  /** Start a WASI command on a thread.
    If the module has child threads and one of them throws an error,
    the main thread should normally also be stopped.
    However, since there is no way to stop it,
    the entire worker will be stopped instead.
    Do not use this if it is not necessary.
    If you want to use custom imports,
    pass the optional instantiate function as an argument
    to the thread_spawn_on_worker function.
  */
  async async_start_on_thread(): Promise<number> {
    if (!this.can_thread_spawn || !this.thread_spawner) {
      throw new Error("thread_spawn is not supported");
    }

    await this.wait_worker_background_worker();

    if (this.inst) {
      throw new Error("what happened?");
    }

    const memories = this.thread_spawner.get_share_memory();
    for (const share_memory in memories) {
      const view = new Uint8Array(memories[share_memory].buffer);
      view.fill(0);
    }

    const code_promise = this.thread_spawner.async_wait_done_or_error();

    await this.thread_spawner.async_start_on_thread(
      this.args,
      this.env,
      this.fd_map,
    );

    const code = await code_promise;

    return code;
  }

  /** Start a WASI command on a thread.
    If the module has child threads and one of them throws an error,
    the main thread should normally also be stopped.
    However, since there is no way to stop it,
    the entire worker will be stopped instead.
    Do not use this if it is not necessary.
    If you want to use custom imports,
    pass the optional instantiate function as an argument
    to the thread_spawn_on_worker function.
  */
  block_start_on_thread(): number {
    if (!this.can_thread_spawn || !this.thread_spawner) {
      throw new Error("thread_spawn is not supported");
    }

    console.log("block_start_on_thread");

    this.check_worker_background_worker();

    console.log("block_start_on_thread");

    if (this.inst) {
      throw new Error("what happened?");
    }

    const memories = this.thread_spawner.get_share_memory();
    for (const share_memory in memories) {
      const view = new Uint8Array(memories[share_memory].buffer);
      view.fill(0);
    }

    console.log("block_start_on_thread: start");

    this.thread_spawner.block_start_on_thread(this.args, this.env, this.fd_map);

    console.log("block_start_on_thread: wait");

    const code = this.thread_spawner.block_wait_done_or_error();

    console.log("block_start_on_thread: done");

    return code;
  }

  wasi_thread_start(
    instance: {
      exports: {
        memory: WebAssembly.Memory;
        wasi_thread_start: (thread_id: number, start_arg: number) => void;
      };
    },
    thread_id: number,
    start_arg: number,
  ) {
    this.inst = instance;
    instance.exports.wasi_thread_start(thread_id, start_arg);
  }

  /// Initialize a WASI reactor
  initialize(instance: {
    exports: { memory: WebAssembly.Memory; _initialize?: () => unknown };
  }) {
    this.inst = instance;
    if (instance.exports._initialize) {
      instance.exports._initialize();
    }
  }

  private mapping_fds(
    wasi_farm_refs: Array<WASIFarmRef>,
    override_fd_maps?: Array<number[]>,
  ) {
    this.fd_map = [undefined, undefined, undefined] as unknown as Array<
      [number, number]
    >;

    // console.log("wasi_farm_refs", wasi_farm_refs);
    for (let i = 0; i < wasi_farm_refs.length; i++) {
      // console.log("fd_map", [...fd_map]);

      const wasi_farm_ref = wasi_farm_refs[i];
      // console.log("override_fd_map", wasi_farm_ref.default_fds);
      const override_fd_map = override_fd_maps
        ? override_fd_maps[i]
        : wasi_farm_ref.default_fds;
      // console.log("override_fd_map", override_fd_map);
      const stdin = wasi_farm_ref.get_stdin();
      const stdout = wasi_farm_ref.get_stdout();
      const stderr = wasi_farm_ref.get_stderr();
      // console.log("stdin", stdin, "stdout", stdout, "stderr", stderr);
      if (stdin !== undefined) {
        if (this.fd_map[0] === undefined) {
          if (override_fd_map.includes(stdin)) {
            this.fd_map[0] = [stdin, i];
          }
        }
      }
      if (stdout !== undefined) {
        // console.log("stdout", stdout, i, "override_fd_map", override_fd_map);
        if (this.fd_map[1] === undefined) {
          if (override_fd_map.includes(stdout)) {
            // console.log("stdout defined");
            this.fd_map[1] = [stdout, i];
          }
        }
      }
      if (stderr !== undefined) {
        if (this.fd_map[2] === undefined) {
          if (override_fd_map.includes(stderr)) {
            this.fd_map[2] = [stderr, i];
          }
        }
      }
      for (const j of override_fd_map) {
        if (j === stdin || j === stdout || j === stderr) {
          continue;
        }
        this.map_new_fd(j, i);
      }

      wasi_farm_ref.set_park_fds_map(override_fd_map);

      // console.log("this.fd_map", this.fd_map);
    }

    if (this.fd_map[0] === undefined) {
      throw new Error("stdin is not found");
    }
    if (this.fd_map[1] === undefined) {
      throw new Error("stdout is not found");
    }
    if (this.fd_map[2] === undefined) {
      throw new Error("stderr is not found");
    }
  }

  private map_new_fd(fd: number, wasi_ref_n: number): number {
    let n = -1;
    // 0, 1, 2 are reserved for stdin, stdout, stderr
    for (let i = 3; i < this.fd_map.length; i++) {
      if (this.fd_map[i] === undefined) {
        n = i;
        break;
      }
    }
    if (n === -1) {
      n =
        (this.fd_map as Array<[number, number] | undefined>).push(undefined) -
        1;
    }
    this.fd_map[n] = [fd, wasi_ref_n];
    return n;
  }

  private map_new_fd_and_notify(fd: number, wasi_ref_n: number): number {
    const n = this.map_new_fd(fd, wasi_ref_n);
    // console.log("animals: fd", fd, "is mapped to", n);
    // console.log("wasi_ref_n", wasi_ref_n);
    this.wasi_farm_refs[wasi_ref_n].set_park_fds_map([fd]);
    return n;
  }

  // @ts-ignore
  private map_set_fd_and_notify(fd: number, wasi_ref_n: number, index: number) {
    if (this.fd_map[index] !== undefined) {
      throw new Error("fd is already mapped");
    }
    this.fd_map[index] = [fd, wasi_ref_n];
    this.wasi_farm_refs[wasi_ref_n].set_park_fds_map([fd]);
  }

  private check_fds() {
    const rm_fds: Array<[number, number]> = [];
    for (let i = 0; i < this.id_in_wasi_farm_ref.length; i++) {
      const id = this.id_in_wasi_farm_ref[i];
      const removed_fds = (this.wasi_farm_refs[i] as FdCloseSender).get(id);
      if (removed_fds) {
        for (const fd of removed_fds) {
          rm_fds.push([fd, i]);
        }
      }
    }

    if (rm_fds.length > 0) {
      for (let i = 0; i < this.fd_map.length; i++) {
        const fd_and_wasi_ref_n = this.fd_map[i];
        if (!fd_and_wasi_ref_n) {
          continue;
        }
        const [fd, wasi_ref_n] = fd_and_wasi_ref_n;
        for (const [rm_fd_fd, rm_fd_wasi_ref_n] of rm_fds) {
          if (fd === rm_fd_fd && wasi_ref_n === rm_fd_wasi_ref_n) {
            (this.fd_map as Array<[number, number] | undefined>)[i] = undefined;
            // console.log("fd", i, "is removed");
            break;
          }
        }
        // console.log("fd_and_wasi_ref_n", fd_and_wasi_ref_n);
      }
      // console.log("rm_fds.length", rm_fds.length);
      // console.log("rm_fds", rm_fds);
    }
  }

  get_share_memory(): {
    [key: string]: WebAssembly.Memory;
  } {
    if (!this.thread_spawner) {
      throw new Error("thread_spawner is not defined");
    }

    return this.thread_spawner.get_share_memory();
  }

  /// Destroys the all threads spawned by this Runtime.
  destroy() {
    if (this.thread_spawner) {
      this.thread_spawner.destroy();
    }
  }

  constructor(
    wasi_farm_refs: WASIFarmRefObject[] | WASIFarmRefObject,
    args: Array<string>,
    env: Array<string>,
    options: {
      can_thread_spawn?: boolean;
      thread_spawn_worker_url?: string;
      thread_spawn_wasm?: WebAssembly.Module;
      hand_override_fd_map?: Array<[number, number]>;
      worker_background_worker_url?: string;
      share_memory?: {
        [key: string]: WebAssembly.Memory;
      };
    } = {},
    override_fd_maps?: Array<number[]>,
    thread_spawner?: ThreadSpawner,
  ) {
    let wasi_farm_refs_tmp: WASIFarmRefObject[];
    if (Array.isArray(wasi_farm_refs)) {
      wasi_farm_refs_tmp =
        wasi_farm_refs as unknown as Array<WASIFarmRefObject>;
    } else {
      wasi_farm_refs_tmp = [wasi_farm_refs as unknown as WASIFarmRefObject];
    }

    try {
      new SharedArrayBuffer(4);
      this.can_array_buffer = true;
    } catch (_) {
      this.can_array_buffer = false;
    }

    this.id_in_wasi_farm_ref = [];
    this.wasi_farm_refs = [];
    for (let i = 0; i < wasi_farm_refs_tmp.length; i++) {
      if (this.can_array_buffer) {
        this.wasi_farm_refs.push(
          WASIFarmRefUseArrayBuffer.init_self(
            wasi_farm_refs_tmp[i] as WASIFarmRefUseArrayBufferObject,
          ),
        );
      } else {
        throw new Error("Non SharedArrayBuffer is not supported yet");
      }
      this.id_in_wasi_farm_ref.push(this.wasi_farm_refs[i].set_id());
    }

    // console.log("this.wasi_farm_refs", this.wasi_farm_refs);

    if (options.can_thread_spawn) {
      this.can_thread_spawn = options.can_thread_spawn;

      if (thread_spawner) {
        if (!(thread_spawner instanceof ThreadSpawner)) {
          throw new Error("thread_spawner is not ThreadSpawner");
        }

        this.thread_spawner = thread_spawner;
      } else {
        if (options.thread_spawn_worker_url === undefined) {
          throw new Error("thread_spawn_worker_url is not defined");
        }
        if (options.thread_spawn_wasm === undefined) {
          throw new Error("thread_spawn_wasm is not defined");
        }

        this.thread_spawner = new ThreadSpawner(
          options.thread_spawn_worker_url,
          wasi_farm_refs_tmp,
          options.share_memory,
          undefined,
          undefined,
          options.thread_spawn_wasm,
          options.worker_background_worker_url,
        );
      }
    }

    this.mapping_fds(this.wasi_farm_refs, override_fd_maps);

    if (options.hand_override_fd_map) {
      this.fd_map = options.hand_override_fd_map;
    }

    // console.log("this.fd_map", this.fd_map);

    this.args = args;
    this.env = env;
    const self = this;
    this.wasiImport = {
      args_sizes_get(argc: number, argv_buf_size: number): number {
        self.check_fds();
        // biome-ignore lint/style/noNonNullAssertion: <explanation>
        const buffer = new DataView(self.inst!.exports.memory.buffer);
        buffer.setUint32(argc, self.args.length, true);
        let buf_size = 0;
        for (const arg of self.args) {
          buf_size += arg.length + 1;
        }
        buffer.setUint32(argv_buf_size, buf_size, true);
        return 0;
      },
      args_get(argv: number, argv_buf: number): number {
        self.check_fds();
        // biome-ignore lint/style/noNonNullAssertion: <explanation>
        const buffer = new DataView(self.inst!.exports.memory.buffer);
        // biome-ignore lint/style/noNonNullAssertion: <explanation>
        const buffer8 = new Uint8Array(self.inst!.exports.memory.buffer);
        for (let i = 0; i < self.args.length; i++) {
          buffer.setUint32(argv, argv_buf, true);
          // biome-ignore lint/style/noParameterAssign: <explanation>
          argv += 4;
          const arg = new TextEncoder().encode(self.args[i]);
          buffer8.set(arg, argv_buf);
          buffer.setUint8(argv_buf + arg.length, 0);
          // biome-ignore lint/style/noParameterAssign: <explanation>
          argv_buf += arg.length + 1;
        }
        return 0;
      },
      environ_sizes_get(environ_count: number, environ_size: number): number {
        self.check_fds();
        // biome-ignore lint/style/noNonNullAssertion: <explanation>
        const buffer = new DataView(self.inst!.exports.memory.buffer);
        buffer.setUint32(environ_count, self.env.length, true);
        let buf_size = 0;
        for (const environ of self.env) {
          buf_size += environ.length + 1;
        }
        buffer.setUint32(environ_size, buf_size, true);
        return 0;
      },
      environ_get(environ: number, environ_buf: number): number {
        self.check_fds();
        // biome-ignore lint/style/noNonNullAssertion: <explanation>
        const buffer = new DataView(self.inst!.exports.memory.buffer);
        // biome-ignore lint/style/noNonNullAssertion: <explanation>
        const buffer8 = new Uint8Array(self.inst!.exports.memory.buffer);
        for (let i = 0; i < self.env.length; i++) {
          buffer.setUint32(environ, environ_buf, true);
          // biome-ignore lint/style/noParameterAssign: <explanation>
          environ += 4;
          const e = new TextEncoder().encode(self.env[i]);
          buffer8.set(e, environ_buf);
          buffer.setUint8(environ_buf + e.length, 0);
          // biome-ignore lint/style/noParameterAssign: <explanation>
          environ_buf += e.length + 1;
        }
        return 0;
      },
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      clock_res_get(id: number, res_ptr: number): number {
        self.check_fds();
        let resolutionValue: bigint;
        switch (id) {
          case wasi.CLOCKID_MONOTONIC: {
            // https://developer.mozilla.org/en-US/docs/Web/API/Performance/now
            // > Resolution in isolated contexts: 5 microseconds
            resolutionValue = 5_000n; // 5 microseconds
            break;
          }
          case wasi.CLOCKID_REALTIME: {
            resolutionValue = 1_000_000n; // 1 millisecond?
            break;
          }
          default:
            return wasi.ERRNO_NOSYS;
        }
        // biome-ignore lint/style/noNonNullAssertion: <explanation>
        const view = new DataView(self.inst!.exports.memory.buffer);
        view.setBigUint64(res_ptr, resolutionValue, true);
        return wasi.ERRNO_SUCCESS;
      },
      clock_time_get(id: number, _precision: bigint, time: number): number {
        self.check_fds();
        // biome-ignore lint/style/noNonNullAssertion: <explanation>
        const buffer = new DataView(self.inst!.exports.memory.buffer);
        if (id === wasi.CLOCKID_REALTIME) {
          buffer.setBigUint64(
            time,
            BigInt(new Date().getTime()) * 1_000_000n,
            true,
          );
        } else if (id === wasi.CLOCKID_MONOTONIC) {
          let monotonic_time: bigint;
          try {
            monotonic_time = BigInt(Math.round(performance.now() * 1000000));
          } catch (e) {
            // performance.now() is only available in browsers.
            // TODO use the perf_hooks builtin module for NodeJS
            monotonic_time = 0n;
          }
          buffer.setBigUint64(time, monotonic_time, true);
        } else {
          // TODO
          buffer.setBigUint64(time, 0n, true);
        }
        return 0;
      },
      fd_advise(
        fd: number,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        _offset: bigint,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        _len: bigint,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        _advice: number,
      ) {
        self.check_fds();
        const [mapped_fd, wasi_farm_ref] = self.get_fd_and_wasi_ref(fd);
        if (mapped_fd === undefined || wasi_farm_ref === undefined) {
          return wasi.ERRNO_BADF;
        }
        return wasi_farm_ref.fd_advise(mapped_fd);
      },
      fd_allocate(fd: number, offset: bigint, len: bigint) {
        self.check_fds();
        const [mapped_fd, wasi_farm_ref] = self.get_fd_and_wasi_ref(fd);
        if (mapped_fd === undefined || wasi_farm_ref === undefined) {
          return wasi.ERRNO_BADF;
        }
        return wasi_farm_ref.fd_allocate(mapped_fd, offset, len);
      },
      fd_close(fd: number) {
        self.check_fds();
        const [mapped_fd, wasi_farm_ref] = self.get_fd_and_wasi_ref(fd);
        if (mapped_fd === undefined || wasi_farm_ref === undefined) {
          return wasi.ERRNO_BADF;
        }
        const ret = wasi_farm_ref.fd_close(mapped_fd);
        self.check_fds();
        return ret;
      },
      fd_datasync(fd: number) {
        self.check_fds();
        const [mapped_fd, wasi_farm_ref] = self.get_fd_and_wasi_ref(fd);
        if (mapped_fd === undefined || wasi_farm_ref === undefined) {
          return wasi.ERRNO_BADF;
        }
        return wasi_farm_ref.fd_datasync(mapped_fd);
      },
      fd_fdstat_get(fd: number, fdstat_ptr: number) {
        self.check_fds();
        const [mapped_fd, wasi_farm_ref] = self.get_fd_and_wasi_ref(fd);
        if (mapped_fd === undefined || wasi_farm_ref === undefined) {
          return wasi.ERRNO_BADF;
        }
        const [fdstat, ret] = wasi_farm_ref.fd_fdstat_get(mapped_fd);
        if (fdstat) {
          fdstat.write_bytes(
            // biome-ignore lint/style/noNonNullAssertion: <explanation>
            new DataView(self.inst!.exports.memory.buffer),
            fdstat_ptr,
          );
        }
        return ret;
      },
      fd_fdstat_set_flags(fd: number, flags: number) {
        self.check_fds();
        const [mapped_fd, wasi_farm_ref] = self.get_fd_and_wasi_ref(fd);
        if (mapped_fd === undefined || wasi_farm_ref === undefined) {
          return wasi.ERRNO_BADF;
        }
        return wasi_farm_ref.fd_fdstat_set_flags(mapped_fd, flags);
      },
      fd_fdstat_set_rights(
        fd: number,
        fs_rights_base: bigint,
        fs_rights_inheriting: bigint,
      ) {
        self.check_fds();
        const [mapped_fd, wasi_farm_ref] = self.get_fd_and_wasi_ref(fd);
        if (mapped_fd === undefined || wasi_farm_ref === undefined) {
          return wasi.ERRNO_BADF;
        }
        return wasi_farm_ref.fd_fdstat_set_rights(
          mapped_fd,
          fs_rights_base,
          fs_rights_inheriting,
        );
      },
      fd_filestat_get(fd: number, filestat_ptr: number) {
        self.check_fds();
        const [mapped_fd, wasi_farm_ref] = self.get_fd_and_wasi_ref(fd);
        if (mapped_fd === undefined || wasi_farm_ref === undefined) {
          return wasi.ERRNO_BADF;
        }
        const [filestat, ret] = wasi_farm_ref.fd_filestat_get(mapped_fd);
        if (filestat) {
          filestat.write_bytes(
            // biome-ignore lint/style/noNonNullAssertion: <explanation>
            new DataView(self.inst!.exports.memory.buffer),
            filestat_ptr,
          );
        }
        return ret;
      },
      fd_filestat_set_size(fd: number, size: bigint) {
        self.check_fds();
        const [mapped_fd, wasi_farm_ref] = self.get_fd_and_wasi_ref(fd);
        if (mapped_fd === undefined || wasi_farm_ref === undefined) {
          return wasi.ERRNO_BADF;
        }
        return wasi_farm_ref.fd_filestat_set_size(mapped_fd, size);
      },
      fd_filestat_set_times(
        fd: number,
        atim: bigint,
        mtim: bigint,
        fst_flags: number,
      ) {
        self.check_fds();
        const [mapped_fd, wasi_farm_ref] = self.get_fd_and_wasi_ref(fd);
        if (mapped_fd === undefined || wasi_farm_ref === undefined) {
          return wasi.ERRNO_BADF;
        }
        return wasi_farm_ref.fd_filestat_set_times(
          mapped_fd,
          atim,
          mtim,
          fst_flags,
        );
      },
      fd_pread(
        fd: number,
        iovs_ptr: number,
        iovs_len: number,
        offset: bigint,
        nread_ptr: number,
      ) {
        self.check_fds();
        const [mapped_fd, wasi_farm_ref] = self.get_fd_and_wasi_ref(fd);
        if (mapped_fd === undefined || wasi_farm_ref === undefined) {
          return wasi.ERRNO_BADF;
        }
        // biome-ignore lint/style/noNonNullAssertion: <explanation>
        const buffer = new DataView(self.inst!.exports.memory.buffer);
        // biome-ignore lint/style/noNonNullAssertion: <explanation>
        const buffer8 = new Uint8Array(self.inst!.exports.memory.buffer);
        const iovs_view = new Uint32Array(
          buffer.buffer,
          iovs_ptr,
          iovs_len * 2,
        );
        const [nerad_and_read_data, ret] = wasi_farm_ref.fd_pread(
          mapped_fd,
          iovs_view,
          offset,
        );
        if (nerad_and_read_data) {
          const iovecs = wasi.Iovec.read_bytes_array(
            buffer,
            iovs_ptr,
            iovs_len,
          );
          const [nread, read_data] = nerad_and_read_data;
          buffer.setUint32(nread_ptr, nread, true);
          let nreaded = 0;
          for (const iovec of iovecs) {
            if (nreaded + iovec.buf_len >= read_data.length) {
              buffer8.set(read_data, iovec.buf);
              break;
            }
            buffer8.set(
              read_data.slice(nreaded, nreaded + iovec.buf_len),
              iovec.buf,
            );
            nreaded += iovec.buf_len;
          }
        }
        return ret;
      },
      fd_prestat_get(fd: number, prestat_ptr: number) {
        self.check_fds();
        const [mapped_fd, wasi_farm_ref] = self.get_fd_and_wasi_ref(fd);
        if (mapped_fd === undefined || wasi_farm_ref === undefined) {
          return wasi.ERRNO_BADF;
        }
        const [prestat, ret] = wasi_farm_ref.fd_prestat_get(mapped_fd);
        if (prestat) {
          const [tag, name_len] = prestat;
          // biome-ignore lint/style/noNonNullAssertion: <explanation>
          const buffer = new DataView(self.inst!.exports.memory.buffer);
          buffer.setUint32(prestat_ptr, tag, true);
          buffer.setUint32(prestat_ptr + 4, name_len, true);
        }
        return ret;
      },
      fd_prestat_dir_name(fd: number, path_ptr: number, path_len: number) {
        self.check_fds();
        const [mapped_fd, wasi_farm_ref] = self.get_fd_and_wasi_ref(fd);
        if (mapped_fd === undefined || wasi_farm_ref === undefined) {
          return [undefined, wasi.ERRNO_BADF];
        }
        // console.log("fd_prestat_dir_name: fd", mapped_fd, "path_len", path_len);
        const [path, ret] = wasi_farm_ref.fd_prestat_dir_name(
          mapped_fd,
          path_len,
        );
        if (path) {
          // console.log("fd_prestat_dir_name", new TextDecoder().decode(path));
          // console.log("fd_prestat_dir_name", path);
          // biome-ignore lint/style/noNonNullAssertion: <explanation>
          const buffer8 = new Uint8Array(self.inst!.exports.memory.buffer);
          buffer8.set(path, path_ptr);
        }
        return ret;
      },
      fd_pwrite(
        fd: number,
        iovs_ptr: number,
        iovs_len: number,
        offset: bigint,
        nwritten_ptr: number,
      ) {
        self.check_fds();
        const [mapped_fd, wasi_farm_ref] = self.get_fd_and_wasi_ref(fd);
        if (mapped_fd === undefined || wasi_farm_ref === undefined) {
          return wasi.ERRNO_BADF;
        }
        // biome-ignore lint/style/noNonNullAssertion: <explanation>
        const buffer = new DataView(self.inst!.exports.memory.buffer);
        // biome-ignore lint/style/noNonNullAssertion: <explanation>
        const buffer8 = new Uint8Array(self.inst!.exports.memory.buffer);
        const iovecs = wasi.Ciovec.read_bytes_array(buffer, iovs_ptr, iovs_len);
        const data = new Uint8Array(
          iovecs.reduce((acc, iovec) => acc + iovec.buf_len, 0),
        );
        let nwritten = 0;
        for (const iovec of iovecs) {
          data.set(
            buffer8.slice(iovec.buf, iovec.buf + iovec.buf_len),
            nwritten,
          );
          nwritten += iovec.buf_len;
        }
        const [written, ret] = wasi_farm_ref.fd_pwrite(mapped_fd, data, offset);
        if (written) {
          buffer.setUint32(nwritten_ptr, written, true);
        }
        return ret;
      },
      fd_read(
        fd: number,
        iovs_ptr: number,
        iovs_len: number,
        nread_ptr: number,
      ) {
        self.check_fds();
        const [mapped_fd, wasi_farm_ref] = self.get_fd_and_wasi_ref(fd);
        if (mapped_fd === undefined || wasi_farm_ref === undefined) {
          return wasi.ERRNO_BADF;
        }
        // biome-ignore lint/style/noNonNullAssertion: <explanation>
        const buffer = new DataView(self.inst!.exports.memory.buffer);
        // biome-ignore lint/style/noNonNullAssertion: <explanation>
        const buffer8 = new Uint8Array(self.inst!.exports.memory.buffer);
        const iovs_view = new Uint32Array(
          buffer.buffer,
          iovs_ptr,
          iovs_len * 2,
        );

        const [nerad_and_read_data, ret] = wasi_farm_ref.fd_read(
          mapped_fd,
          iovs_view,
        );
        if (nerad_and_read_data) {
          const iovecs = wasi.Iovec.read_bytes_array(
            buffer,
            iovs_ptr,
            iovs_len,
          );
          const [nread, read_data] = nerad_and_read_data;

          // console.log("fd_read: nread", nread, new TextDecoder().decode(read_data));

          // fd_read: ref:  14 30 14
          // animals.ts:325 fd_read: nread 14 Hello, world!

          buffer.setUint32(nread_ptr, nread, true);
          let nreaded = 0;
          for (const iovec of iovecs) {
            if (nreaded + iovec.buf_len >= read_data.length) {
              buffer8.set(read_data, iovec.buf);
              break;
            }
            buffer8.set(
              read_data.slice(nreaded, nreaded + iovec.buf_len),
              iovec.buf,
            );
            nreaded += iovec.buf_len;
          }
        }
        return ret;
      },
      fd_readdir(
        fd: number,
        buf_ptr: number,
        buf_len: number,
        cookie: bigint,
        buf_used_ptr: number,
      ) {
        self.check_fds();
        const [mapped_fd, wasi_farm_ref] = self.get_fd_and_wasi_ref(fd);
        if (mapped_fd === undefined || wasi_farm_ref === undefined) {
          return [undefined, wasi.ERRNO_BADF];
        }
        // biome-ignore lint/style/noNonNullAssertion: <explanation>
        const buffer = new DataView(self.inst!.exports.memory.buffer);
        // biome-ignore lint/style/noNonNullAssertion: <explanation>
        const buffer8 = new Uint8Array(self.inst!.exports.memory.buffer);
        const [nerad_and_read_data, ret] = wasi_farm_ref.fd_readdir(
          mapped_fd,
          buf_len,
          cookie,
        );
        if (nerad_and_read_data) {
          const [read_data, buf_used] = nerad_and_read_data;
          buffer.setUint32(buf_used_ptr, buf_used, true);
          buffer8.set(read_data, buf_ptr);
        }
        return ret;
      },
      fd_renumber(fd: number, to: number) {
        self.check_fds();

        const [mapped_to, wasi_farm_ref_to] = self.get_fd_and_wasi_ref(to);

        if (mapped_to !== undefined && wasi_farm_ref_to !== undefined) {
          const ret = wasi_farm_ref_to.fd_close(mapped_to);
          self.check_fds();
          if (ret !== wasi.ERRNO_SUCCESS) {
            return ret;
          }
        }

        if (self.fd_map[to]) {
          throw new Error("fd is already mapped");
        }

        self.fd_map[to] = self.fd_map[fd];

        (self.fd_map as Array<[number, number] | undefined>)[fd] = undefined;

        return wasi.ERRNO_SUCCESS;
      },
      fd_seek(
        fd: number,
        offset: bigint,
        whence: number,
        newoffset_ptr: number,
      ) {
        self.check_fds();
        const [mapped_fd, wasi_farm_ref] = self.get_fd_and_wasi_ref(fd);
        if (mapped_fd === undefined || wasi_farm_ref === undefined) {
          return [undefined, wasi.ERRNO_BADF];
        }
        const [newoffset, ret] = wasi_farm_ref.fd_seek(
          mapped_fd,
          offset,
          whence,
        );
        if (newoffset) {
          // biome-ignore lint/style/noNonNullAssertion: <explanation>
          const buffer = new DataView(self.inst!.exports.memory.buffer);

          // wasi.ts use BigInt for offset, but API use Uint64
          buffer.setBigUint64(newoffset_ptr, newoffset, true);
        }
        return ret;
      },
      fd_sync(fd: number) {
        self.check_fds();
        const [mapped_fd, wasi_farm_ref] = self.get_fd_and_wasi_ref(fd);
        if (mapped_fd === undefined || wasi_farm_ref === undefined) {
          return wasi.ERRNO_BADF;
        }
        return wasi_farm_ref.fd_sync(mapped_fd);
      },
      fd_tell(fd: number, newoffset_ptr: number) {
        self.check_fds();
        const [mapped_fd, wasi_farm_ref] = self.get_fd_and_wasi_ref(fd);
        if (mapped_fd === undefined || wasi_farm_ref === undefined) {
          return [undefined, wasi.ERRNO_BADF];
        }
        const [newoffset, ret] = wasi_farm_ref.fd_tell(mapped_fd);
        if (newoffset) {
          // biome-ignore lint/style/noNonNullAssertion: <explanation>
          const buffer = new DataView(self.inst!.exports.memory.buffer);
          buffer.setBigUint64(newoffset_ptr, newoffset, true);
        }
        return ret;
      },
      fd_write(
        fd: number,
        iovs_ptr: number,
        iovs_len: number,
        nwritten_ptr: number,
      ) {
        self.check_fds();
        const [mapped_fd, wasi_farm_ref] = self.get_fd_and_wasi_ref(fd);
        if (mapped_fd === undefined || wasi_farm_ref === undefined) {
          return wasi.ERRNO_BADF;
        }

        // console.log("fd_write", fd, iovs_ptr, iovs_len, nwritten_ptr);

        // biome-ignore lint/style/noNonNullAssertion: <explanation>
        const buffer = new DataView(self.inst!.exports.memory.buffer);
        // biome-ignore lint/style/noNonNullAssertion: <explanation>
        const buffer8 = new Uint8Array(self.inst!.exports.memory.buffer);
        const iovecs = wasi.Ciovec.read_bytes_array(buffer, iovs_ptr, iovs_len);
        // console.log("iovecs", iovecs);
        const data = new Uint8Array(
          iovecs.reduce((acc, iovec) => acc + iovec.buf_len, 0),
        );
        // console.log("data", data);
        let nwritten = 0;
        for (const iovec of iovecs) {
          data.set(
            buffer8.slice(iovec.buf, iovec.buf + iovec.buf_len),
            nwritten,
          );
          nwritten += iovec.buf_len;
        }

        // console.log("fd_write: ", fd, new TextDecoder().decode(data));

        const [written, ret] = wasi_farm_ref.fd_write(mapped_fd, data);

        // console.log("fd_write end", fd, ret, written);

        if (written) {
          buffer.setUint32(nwritten_ptr, written, true);
        }
        return ret;
      },
      path_create_directory(fd: number, path_ptr: number, path_len: number) {
        self.check_fds();
        const [mapped_fd, wasi_farm_ref] = self.get_fd_and_wasi_ref(fd);
        if (mapped_fd === undefined || wasi_farm_ref === undefined) {
          return wasi.ERRNO_BADF;
        }
        // biome-ignore lint/style/noNonNullAssertion: <explanation>
        const buffer8 = new Uint8Array(self.inst!.exports.memory.buffer);
        const path = buffer8.slice(path_ptr, path_ptr + path_len);
        return wasi_farm_ref.path_create_directory(mapped_fd, path);
      },
      path_filestat_get(
        fd: number,
        flags: number,
        path_ptr: number,
        path_len: number,
        filestat_ptr: number,
      ) {
        self.check_fds();
        const [mapped_fd, wasi_farm_ref] = self.get_fd_and_wasi_ref(fd);
        if (mapped_fd === undefined || wasi_farm_ref === undefined) {
          return [undefined, wasi.ERRNO_BADF];
        }
        // biome-ignore lint/style/noNonNullAssertion: <explanation>
        const buffer = new DataView(self.inst!.exports.memory.buffer);
        // biome-ignore lint/style/noNonNullAssertion: <explanation>
        const buffer8 = new Uint8Array(self.inst!.exports.memory.buffer);
        const path = buffer8.slice(path_ptr, path_ptr + path_len);
        const [filestat, ret] = wasi_farm_ref.path_filestat_get(
          mapped_fd,
          flags,
          path,
        );
        if (filestat) {
          filestat.write_bytes(buffer, filestat_ptr);
        }
        return ret;
      },
      path_filestat_set_times(
        fd: number,
        flags: number,
        path_ptr: number,
        path_len: number,
        atim: bigint,
        mtim: bigint,
        fst_flags: number,
      ) {
        self.check_fds();
        const [mapped_fd, wasi_farm_ref] = self.get_fd_and_wasi_ref(fd);
        if (mapped_fd === undefined || wasi_farm_ref === undefined) {
          return [undefined, wasi.ERRNO_BADF];
        }
        // biome-ignore lint/style/noNonNullAssertion: <explanation>
        const buffer8 = new Uint8Array(self.inst!.exports.memory.buffer);
        const path = buffer8.slice(path_ptr, path_ptr + path_len);
        return wasi_farm_ref.path_filestat_set_times(
          mapped_fd,
          flags,
          path,
          atim,
          mtim,
          fst_flags,
        );
      },
      // TODO! Make it work with different wasi_farm_ref
      path_link(
        old_fd: number,
        old_flags: number,
        old_path_ptr: number,
        old_path_len: number,
        new_fd: number,
        new_path_ptr: number,
        new_path_len: number,
      ) {
        self.check_fds();
        const [mapped_old_fd, wasi_farm_ref] = self.get_fd_and_wasi_ref(old_fd);
        const [mapped_new_fd, wasi_farm_ref_new] =
          self.get_fd_and_wasi_ref(new_fd);
        if (
          mapped_old_fd === undefined ||
          wasi_farm_ref === undefined ||
          mapped_new_fd === undefined ||
          wasi_farm_ref_new === undefined
        ) {
          return wasi.ERRNO_BADF;
        }
        if (wasi_farm_ref !== wasi_farm_ref_new) {
          return wasi.ERRNO_BADF;
        }
        // biome-ignore lint/style/noNonNullAssertion: <explanation>
        const buffer8 = new Uint8Array(self.inst!.exports.memory.buffer);
        const old_path = buffer8.slice(
          old_path_ptr,
          old_path_ptr + old_path_len,
        );
        const new_path = buffer8.slice(
          new_path_ptr,
          new_path_ptr + new_path_len,
        );
        return wasi_farm_ref.path_link(
          mapped_old_fd,
          old_flags,
          old_path,
          mapped_new_fd,
          new_path,
        );
      },
      path_open(
        fd: number,
        dirflags: number,
        path_ptr: number,
        path_len: number,
        oflags: number,
        fs_rights_base: bigint,
        fs_rights_inheriting: bigint,
        fs_flags: number,
        opened_fd_ptr: number,
      ) {
        self.check_fds();
        const [mapped_fd, wasi_farm_ref_n] = self.get_fd_and_wasi_ref_n(fd);
        if (mapped_fd === undefined || wasi_farm_ref_n === undefined) {
          return wasi.ERRNO_BADF;
        }
        const wasi_farm_ref = self.wasi_farm_refs[wasi_farm_ref_n];
        // biome-ignore lint/style/noNonNullAssertion: <explanation>
        const buffer8 = new Uint8Array(self.inst!.exports.memory.buffer);
        const path = buffer8.slice(path_ptr, path_ptr + path_len);
        const [opened_fd, ret] = wasi_farm_ref.path_open(
          mapped_fd,
          dirflags,
          path,
          oflags,
          fs_rights_base,
          fs_rights_inheriting,
          fs_flags,
        );
        if (opened_fd) {
          if (self.fd_map.includes([opened_fd, wasi_farm_ref_n])) {
            throw new Error("opened_fd already exists");
          }
          const mapped_opened_fd = self.map_new_fd_and_notify(
            opened_fd,
            wasi_farm_ref_n,
          );
          // biome-ignore lint/style/noNonNullAssertion: <explanation>
          const buffer = new DataView(self.inst!.exports.memory.buffer);
          buffer.setUint32(opened_fd_ptr, mapped_opened_fd, true);
        }
        return ret;
      },
      path_readlink(
        fd: number,
        path_ptr: number,
        path_len: number,
        buf_ptr: number,
        buf_len: number,
        buf_used_ptr: number,
      ) {
        self.check_fds();
        const [mapped_fd, wasi_farm_ref] = self.get_fd_and_wasi_ref(fd);
        if (mapped_fd === undefined || wasi_farm_ref === undefined) {
          return [undefined, wasi.ERRNO_BADF];
        }
        // biome-ignore lint/style/noNonNullAssertion: <explanation>
        const buffer8 = new Uint8Array(self.inst!.exports.memory.buffer);
        const path = buffer8.slice(path_ptr, path_ptr + path_len);
        const [buf, ret] = wasi_farm_ref.path_readlink(
          mapped_fd,
          path,
          buf_len,
        );
        if (buf) {
          // biome-ignore lint/style/noNonNullAssertion: <explanation>
          const buffer = new DataView(self.inst!.exports.memory.buffer);
          buffer.setUint32(buf_used_ptr, buf.length, true);
          buffer8.set(buf, buf_ptr);
        }
        return ret;
      },
      path_remove_directory(fd: number, path_ptr: number, path_len: number) {
        self.check_fds();
        const [mapped_fd, wasi_farm_ref] = self.get_fd_and_wasi_ref(fd);
        if (mapped_fd === undefined || wasi_farm_ref === undefined) {
          return wasi.ERRNO_BADF;
        }
        // biome-ignore lint/style/noNonNullAssertion: <explanation>
        const buffer8 = new Uint8Array(self.inst!.exports.memory.buffer);
        const path = buffer8.slice(path_ptr, path_ptr + path_len);
        return wasi_farm_ref.path_remove_directory(mapped_fd, path);
      },
      // TODO! Make it work with different wasi_farm_ref
      path_rename(
        old_fd: number,
        old_path_ptr: number,
        old_path_len: number,
        new_fd: number,
        new_path_ptr: number,
        new_path_len: number,
      ) {
        if (old_fd === new_fd) {
          return wasi.ERRNO_SUCCESS;
        }
        self.check_fds();
        const [mapped_old_fd, wasi_farm_ref] = self.get_fd_and_wasi_ref(old_fd);
        const [mapped_new_fd, wasi_farm_ref_new] =
          self.get_fd_and_wasi_ref(new_fd);
        if (
          mapped_old_fd === undefined ||
          wasi_farm_ref === undefined ||
          mapped_new_fd === undefined ||
          wasi_farm_ref_new === undefined
        ) {
          return wasi.ERRNO_BADF;
        }
        if (wasi_farm_ref !== wasi_farm_ref_new) {
          return wasi.ERRNO_BADF;
        }
        // biome-ignore lint/style/noNonNullAssertion: <explanation>
        const buffer8 = new Uint8Array(self.inst!.exports.memory.buffer);
        const old_path = buffer8.slice(
          old_path_ptr,
          old_path_ptr + old_path_len,
        );
        const new_path = buffer8.slice(
          new_path_ptr,
          new_path_ptr + new_path_len,
        );
        return wasi_farm_ref.path_rename(
          mapped_old_fd,
          old_path,
          mapped_new_fd,
          new_path,
        );
      },
      path_symlink(
        old_path_ptr: number,
        old_path_len: number,
        fd: number,
        new_path_ptr: number,
        new_path_len: number,
      ) {
        self.check_fds();
        const [mapped_fd, wasi_farm_ref] = self.get_fd_and_wasi_ref(fd);
        if (mapped_fd === undefined || wasi_farm_ref === undefined) {
          return wasi.ERRNO_BADF;
        }
        // biome-ignore lint/style/noNonNullAssertion: <explanation>
        const buffer8 = new Uint8Array(self.inst!.exports.memory.buffer);
        const old_path = buffer8.slice(
          old_path_ptr,
          old_path_ptr + old_path_len,
        );
        const new_path = buffer8.slice(
          new_path_ptr,
          new_path_ptr + new_path_len,
        );
        return wasi_farm_ref.path_symlink(old_path, mapped_fd, new_path);
      },
      path_unlink_file(fd: number, path_ptr: number, path_len: number) {
        self.check_fds();
        const [mapped_fd, wasi_farm_ref] = self.get_fd_and_wasi_ref(fd);
        if (mapped_fd === undefined || wasi_farm_ref === undefined) {
          return wasi.ERRNO_BADF;
        }
        // biome-ignore lint/style/noNonNullAssertion: <explanation>
        const buffer8 = new Uint8Array(self.inst!.exports.memory.buffer);
        const path = buffer8.slice(path_ptr, path_ptr + path_len);
        return wasi_farm_ref.path_unlink_file(mapped_fd, path);
      },
      poll_oneoff(
        in_ptr: number,
        out_ptr: number,
        nsubscriptions: number,
        stored_events_count_ptr: number,
      ): number {
        if (nsubscriptions === 0) {
          return wasi.ERRNO_INVAL;
        }
        // TODO: For now, we only support a single subscription just to be enough for wasi-libc's
        // clock_nanosleep.
        if (nsubscriptions > 1) {
          console.error("poll_oneoff: only a single subscription is supported");
          return wasi.ERRNO_NOTSUP;
        }

        // Read a subscription from the in buffer
        const buffer = new DataView(self.inst!.exports.memory.buffer);
        const s = wasi.Subscription.read_bytes(buffer, in_ptr);
        const eventtype = s.eventtype;
        const clockid = s.clockid;
        const timeout = s.timeout;
        // TODO: For now, we only support clock subscriptions.
        if (eventtype !== wasi.EVENTTYPE_CLOCK) {
          console.error("poll_oneoff: only clock subscriptions are supported");
          return wasi.ERRNO_NOTSUP;
        }

        // Select timer
        let getNow: (() => bigint) | undefined = undefined;
        if (clockid === wasi.CLOCKID_MONOTONIC) {
          getNow = () => BigInt(Math.round(performance.now() * 1_000_000));
        } else if (clockid === wasi.CLOCKID_REALTIME) {
          getNow = () => BigInt(new Date().getTime()) * 1_000_000n;
        } else {
          return wasi.ERRNO_INVAL;
        }

        // Perform the wait
        const endTime =
          ((s.flags & wasi.SUBCLOCKFLAGS_SUBSCRIPTION_CLOCK_ABSTIME) !== 0
            ? timeout
            : getNow() + timeout) - s.precision;
        while (endTime > getNow()) {
          // block until the timeout is reached
        }

        // Write an event to the out buffer
        const event = new wasi.Event(s.userdata, wasi.ERRNO_SUCCESS, eventtype);
        event.write_bytes(buffer, out_ptr);

        buffer.setUint32(stored_events_count_ptr, 1, true);

        return wasi.ERRNO_SUCCESS;
      },
      proc_exit(exit_code: number) {
        self.check_fds();
        throw new WASIProcExit(exit_code);
      },
      proc_raise(sig: number) {
        self.check_fds();
        throw `raised signal ${sig}`;
      },
      sched_yield() {
        self.check_fds();
      },
      random_get(buf: number, buf_len: number) {
        self.check_fds();
        const buffer8 = new Uint8Array(
          // biome-ignore lint/style/noNonNullAssertion: <explanation>
          self.inst!.exports.memory.buffer,
        ).subarray(buf, buf + buf_len);

        if (
          "crypto" in globalThis &&
          // biome-ignore lint/style/noNonNullAssertion: <explanation>
          !(self.inst!.exports.memory.buffer instanceof SharedArrayBuffer)
        ) {
          for (let i = 0; i < buf_len; i += 65536) {
            crypto.getRandomValues(buffer8.subarray(i, i + 65536));
          }
        } else {
          for (let i = 0; i < buf_len; i++) {
            buffer8[i] = (Math.random() * 256) | 0;
          }
        }
      },
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      sock_recv(_fd: number, _ri_data, _ri_flags) {
        self.check_fds();
        throw "sockets not supported";
      },
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      sock_send(_fd: number, _si_data, _si_flags) {
        self.check_fds();
        throw "sockets not supported";
      },
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      sock_shutdown(_fd: number, _how) {
        self.check_fds();
        throw "sockets not supported";
      },
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      sock_accept(_fd: number, _flags) {
        self.check_fds();
        throw "sockets not supported";
      },
    };

    this.wasiThreadImport = {
      "thread-spawn": (start_arg: number) => {
        self.check_fds();
        if (!self.can_thread_spawn || !self.thread_spawner) {
          throw new Error("thread_spawn is not allowed");
        }

        const thread_id = self.thread_spawner.thread_spawn(
          start_arg,
          self.args,
          self.env,
          self.fd_map,
        );

        return thread_id;
      },
    };
  }
}
