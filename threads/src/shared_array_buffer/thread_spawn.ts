//  (export "wasi_thread_start" (func $61879))
//  (func $61879 (param $0 i32) (param $1 i32)
//   (local $2 i32)
//   (local $3 i32)
//   (local $4 i32)
//   (local $5 i32)
//   (local $6 i32)
//   (local $7 i32)
//   (global.set $global$0
//    (i32.load
//     (local.get $1)
//    )
//   )

//  (import "wasi" "thread-spawn" (func $fimport$27 (param i32) (result i32)))

import { WASIFarmAnimal } from "../animals.js";
import type { WASIFarmRefObject } from "../ref.js";
import type { WorkerBackgroundRefObject } from "./worker_background/index.js";
import {
  WorkerBackgroundRef,
  worker_background_worker_url,
} from "./worker_background/index.js";
import { WorkerBackgroundRefObjectConstructor } from "./worker_background/worker_export.js";

type ThreadSpawnerObject = {
  share_memory: WebAssembly.Memory;
  wasi_farm_refs_object: Array<WASIFarmRefObject>;
  worker_url: string;
  worker_background_ref_object: WorkerBackgroundRefObject;
  // inst_default_buffer_kept: WebAssembly.Memory;
};

export class ThreadSpawner {
  private share_memory: WebAssembly.Memory;
  private wasi_farm_refs_object: Array<WASIFarmRefObject>;
  private worker_url: string;
  private worker_background_ref: WorkerBackgroundRef;
  private worker_background_ref_object: WorkerBackgroundRefObject;
  // inst_default_buffer_kept: WebAssembly.Memory;

  // hold the worker to prevent GC.
  private worker_background_worker?: Worker;
  private worker_background_worker_promise?: Promise<void>;

  // https://github.com/rustwasm/wasm-pack/issues/479

  constructor(
    worker_url: string,
    wasi_farm_refs_object: Array<WASIFarmRefObject>,
    share_memory?: WebAssembly.Memory,
    // 16MB for the time being.
    // https://users.rust-lang.org/t/what-is-the-size-limit-of-threads-stack-in-rust/11867/3
    MIN_STACK = 16777216,
    worker_background_ref_object?: WorkerBackgroundRefObject,
    thread_spawn_wasm?: WebAssembly.Module,
    // inst_default_buffer_kept?: WebAssembly.Memory,
  ) {
    this.worker_url = worker_url;
    this.wasi_farm_refs_object = wasi_farm_refs_object;

    const min_initial_size = 1048576 / 65536; // Rust's default stack size is 1MB.
    const initial_size = MIN_STACK / 65536;
    if (initial_size < min_initial_size) {
      throw new Error(
        `The stack size must be at least ${min_initial_size} bytes.`,
      );
    }
    const max_memory = 1073741824 / 65536; // Rust's default maximum memory size is 1GB.

    // this.inst_default_buffer_kept =
    //   inst_default_buffer_kept ||
    //   new WebAssembly.Memory({
    //     initial: 1,
    //     maximum: max_memory,
    //     shared: true,
    //   });

    this.share_memory =
      share_memory ||
      // WebAssembly.Memory's 1 page is 65536 bytes.
      new WebAssembly.Memory({
        initial: initial_size,
        maximum: max_memory,
        shared: true,
      });

    if (worker_background_ref_object === undefined) {
      const worker_background_worker_url__ = worker_background_worker_url();
      this.worker_background_worker = new Worker(
        worker_background_worker_url__,
        { type: "module" },
      );
      URL.revokeObjectURL(worker_background_worker_url__);
      const { promise, resolve } = Promise.withResolvers<void>();
      this.worker_background_worker_promise = promise;
      this.worker_background_worker.onmessage = () => {
        this.worker_background_worker_promise = undefined;
        resolve();
      };
      this.worker_background_ref_object =
        WorkerBackgroundRefObjectConstructor();
      this.worker_background_ref = WorkerBackgroundRef.init_self(
        this.worker_background_ref_object,
      );
      this.worker_background_worker.postMessage({
        override_object: {
          sl_object: this.get_object(),
          thread_spawn_wasm,
        },
        worker_background_ref_object: this.worker_background_ref_object,
      });
    } else {
      this.worker_background_ref_object = worker_background_ref_object;
      this.worker_background_ref = WorkerBackgroundRef.init_self(
        this.worker_background_ref_object,
      );
    }
  }

  // This cannot blocking.
  async wait_worker_background_worker(): Promise<void> {
    if (this.worker_background_worker_promise) {
      const promise = this.worker_background_worker_promise;

      await promise;

      return;
    }
    return;
  }

  check_worker_background_worker(): void {
    if (this.worker_background_worker_promise) {
      throw new Error("worker_background_worker is not ready.");
    }
  }

  thread_spawn(
    start_arg: number,
    args: Array<string>,
    env: Array<string>,
    fd_map: Array<[number, number]>,
  ): number {
    const worker = this.worker_background_ref.new_worker(
      this.worker_url,
      { type: "module" },
      {
        this_is_thread_spawn: true,
        start_arg,
        args,
        env,
        fd_map,
      },
    );

    const thread_id = worker.get_id();

    return thread_id;
  }

  async async_start_on_thread(
    args: Array<string>,
    env: Array<string>,
    fd_map: Array<[number, number]>,
  ): Promise<void> {
    if (!self.Worker.toString().includes("[native code]")) {
      if (self.Worker.toString().includes("function")) {
        console.warn("SubWorker(new Worker on Worker) is polyfilled maybe.");
      } else {
        throw new Error("SubWorker(new Worker on Worker) is not supported.");
      }
    }

    await this.worker_background_ref.async_start_on_thread(
      this.worker_url,
      { type: "module" },
      {
        this_is_thread_spawn: true,
        this_is_start: true,
        args,
        env,
        fd_map,
      },
    );
  }

  block_start_on_thread(
    args: Array<string>,
    env: Array<string>,
    fd_map: Array<[number, number]>,
  ): void {
    if (!self.Worker.toString().includes("[native code]")) {
      if (self.Worker.toString().includes("function")) {
        console.warn("SubWorker(new Worker on Worker) is polyfilled maybe.");
      } else {
        throw new Error("SubWorker(new Worker on Worker) is not supported.");
      }
    }

    this.worker_background_ref.block_start_on_thread(
      this.worker_url,
      { type: "module" },
      {
        this_is_thread_spawn: true,
        this_is_start: true,
        args,
        env,
        fd_map,
      },
    );
  }

  static init_self(sl: ThreadSpawnerObject): ThreadSpawner {
    const thread_spawner = new ThreadSpawner(
      sl.worker_url,
      sl.wasi_farm_refs_object,
      sl.share_memory,
      undefined,
      sl.worker_background_ref_object,
      // undefined,
      // sl.inst_default_buffer_kept,
    );
    return thread_spawner;
  }

  static init_self_with_worker_background_ref(
    sl: ThreadSpawnerObject,
    worker_background_ref_object: WorkerBackgroundRefObject,
  ): ThreadSpawner {
    const thread_spawner = new ThreadSpawner(
      sl.worker_url,
      sl.wasi_farm_refs_object,
      sl.share_memory,
      undefined,
      worker_background_ref_object,
      // undefined,
      // sl.inst_default_buffer_kept,
    );
    return thread_spawner;
  }

  get_share_memory(): WebAssembly.Memory {
    return this.share_memory;
  }

  get_object(): ThreadSpawnerObject {
    return {
      share_memory: this.share_memory,
      wasi_farm_refs_object: this.wasi_farm_refs_object,
      worker_url: this.worker_url,
      worker_background_ref_object: this.worker_background_ref_object,
      // inst_default_buffer_kept: this.inst_default_buffer_kept,
    };
  }

  done_notify(code: number): void {
    this.worker_background_ref.done_notify(code);
  }

  async async_wait_done_or_error(): Promise<number> {
    if (this.worker_background_worker === undefined) {
      throw new Error("worker_background_worker is undefined.");
    }

    return await this.worker_background_ref.async_wait_done_or_error();
  }

  block_wait_done_or_error(): number {
    if (this.worker_background_worker === undefined) {
      throw new Error("worker_background_worker is undefined.");
    }

    return this.worker_background_ref.block_wait_done_or_error();
  }
}

// send fd_map is not implemented yet.
// issue: the fd passed to the child process is different from the parent process.
export const thread_spawn_on_worker = async (msg: {
  this_is_thread_spawn: boolean;
  worker_id?: number;
  start_arg: number;
  worker_background_ref: WorkerBackgroundRefObject;
  sl_object: ThreadSpawnerObject;
  thread_spawn_wasm: WebAssembly.Module;
  args: Array<string>;
  env: Array<string>;
  fd_map: [number, number][];
  this_is_start?: boolean;
}): Promise<WASIFarmAnimal | undefined> => {
  if (msg.this_is_thread_spawn) {
    const {
      sl_object,
      fd_map,
      worker_background_ref,
      thread_spawn_wasm,
      args,
      env,
    } = msg;

    const override_fd_map: Array<number[]> = new Array(
      sl_object.wasi_farm_refs_object.length,
    );

    // Possibly null (undefined)
    for (const fd_and_wasi_ref_n of fd_map) {
      // biome-ignore lint/suspicious/noDoubleEquals: <explanation>
      if (fd_and_wasi_ref_n == undefined) {
        continue;
      }
      const [fd, wasi_ref_n] = fd_and_wasi_ref_n;
      if (override_fd_map[wasi_ref_n] === undefined) {
        override_fd_map[wasi_ref_n] = [];
      }
      override_fd_map[wasi_ref_n].push(fd);
    }

    const thread_spawner = ThreadSpawner.init_self_with_worker_background_ref(
      sl_object,
      worker_background_ref,
    );

    if (msg.this_is_start) {
      const wasi = new WASIFarmAnimal(
        sl_object.wasi_farm_refs_object,
        args,
        env,
        {
          can_thread_spawn: true,
          thread_spawn_worker_url: sl_object.worker_url,
          hand_override_fd_map: fd_map,
        },
        override_fd_map,
        thread_spawner,
      );

      const inst = await WebAssembly.instantiate(thread_spawn_wasm, {
        env: {
          memory: wasi.get_share_memory(),
        },
        wasi: wasi.wasiThreadImport,
        wasi_snapshot_preview1: wasi.wasiImport,
      });

      wasi.start(
        inst as unknown as {
          exports: {
            memory: WebAssembly.Memory;
            _start: () => unknown;
          };
        },
      );

      globalThis.postMessage({
        msg: "done",
      });

      return wasi;
    }

    const { worker_id: thread_id, start_arg } = msg;

    console.log(`thread_spawn worker ${thread_id} start`);

    const wasi = new WASIFarmAnimal(
      sl_object.wasi_farm_refs_object,
      args,
      env,
      {
        can_thread_spawn: true,
        thread_spawn_worker_url: sl_object.worker_url,
        hand_override_fd_map: fd_map,
      },
      override_fd_map,
      thread_spawner,
    );

    const inst = await WebAssembly.instantiate(thread_spawn_wasm, {
      env: {
        memory: wasi.get_share_memory(),
      },
      wasi: wasi.wasiThreadImport,
      wasi_snapshot_preview1: wasi.wasiImport,
    });

    globalThis.postMessage({
      msg: "ready",
    });

    try {
      wasi.wasi_thread_start(
        inst as unknown as {
          exports: {
            memory: WebAssembly.Memory;
            wasi_thread_start: (thread_id: number, start_arg: number) => void;
          };
        },
        // biome-ignore lint/style/noNonNullAssertion: <explanation>
        thread_id!,
        start_arg,
      );
    } catch (e) {
      globalThis.postMessage({
        msg: "error",
        error: e,
      });

      return wasi;
    }

    globalThis.postMessage({
      msg: "done",
    });

    return wasi;
  }
};
