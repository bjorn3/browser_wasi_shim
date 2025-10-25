import { AllocatorUseArrayBuffer } from "../allocator.ts";
import * as Serializer from "../serialize_error.ts";
import type {
  WorkerBackgroundRefObject,
  WorkerOptions,
} from "./worker_export.ts";

export class WorkerBackgroundRef {
  private allocator: AllocatorUseArrayBuffer;
  private lock: SharedArrayBuffer;
  private signature_input: SharedArrayBuffer;

  constructor(
    allocator: AllocatorUseArrayBuffer,
    lock: SharedArrayBuffer,
    signature_input: SharedArrayBuffer,
  ) {
    this.allocator = allocator;
    this.lock = lock;
    this.signature_input = signature_input;
  }

  private block_lock_base_func(): void {
    const view = new Int32Array(this.lock);
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const lock = Atomics.wait(view, 0, 1);
      if (lock === "timed-out") {
        throw new Error("timed-out lock");
      }
      const old = Atomics.compareExchange(view, 0, 0, 1);
      if (old === 0) {
        return;
      }
    }
  }

  private async async_lock_base_func(): Promise<void> {
    const view = new Int32Array(this.lock);
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { value } = Atomics.waitAsync(view, 0, 1);
      if ((await value) === "timed-out") {
        throw new Error("timed-out lock");
      }
      const old = Atomics.compareExchange(view, 0, 0, 1);
      if (old === 0) {
        return;
      }
    }
  }

  private call_base_func(): void {
    const view = new Int32Array(this.lock);
    Atomics.store(view, 2, 1);
    Atomics.store(view, 1, 0);
    Atomics.notify(view, 1, 1);
  }

  // wait base_func
  private block_wait_base_func(): void {
    const view = new Int32Array(this.lock);
    const lock = Atomics.wait(view, 2, 1);
    if (lock === "timed-out") {
      throw new Error("timed-out lock");
    }
  }

  private async async_wait_base_func(): Promise<void> {
    const view = new Int32Array(this.lock);
    const { value } = Atomics.waitAsync(view, 2, 1);
    if ((await value) === "timed-out") {
      throw new Error("timed-out lock");
    }
  }

  // release base_func
  private release_base_func(): void {
    const view = new Int32Array(this.lock);
    Atomics.store(view, 0, 0);
    Atomics.notify(view, 0, 1);
  }

  new_worker(
    url: string,
    options?: WorkerOptions,
    post_obj?: unknown,
  ): WorkerRef {
    console.log("new_worker", url, options, post_obj);

    this.block_lock_base_func();
    const view = new Int32Array(this.signature_input);
    Atomics.store(view, 0, 1);
    const url_buffer = new TextEncoder().encode(url);
    this.allocator.block_write(url_buffer, this.signature_input, 1);
    Atomics.store(view, 3, options?.type === "module" ? 1 : 0);
    const obj_json = JSON.stringify(post_obj);
    const obj_buffer = new TextEncoder().encode(obj_json);
    this.allocator.block_write(obj_buffer, this.signature_input, 4);
    this.call_base_func();
    this.block_wait_base_func();

    const id = Atomics.load(view, 0);

    this.release_base_func();

    return new WorkerRef(id);
  }

  async async_start_on_thread(
    url: string,
    options: WorkerOptions | undefined,
    post_obj: unknown,
  ) {
    await this.async_lock_base_func();
    const view = new Int32Array(this.signature_input);
    Atomics.store(view, 0, 2);
    const url_buffer = new TextEncoder().encode(url);
    await this.allocator.async_write(url_buffer, this.signature_input, 1);
    Atomics.store(view, 3, options?.type === "module" ? 1 : 0);
    const obj_json = JSON.stringify(post_obj);
    const obj_buffer = new TextEncoder().encode(obj_json);
    await this.allocator.async_write(obj_buffer, this.signature_input, 4);
    this.call_base_func();
    await this.async_wait_base_func();

    this.release_base_func();
  }

  block_start_on_thread(
    url: string,
    options: WorkerOptions | undefined,
    post_obj: unknown,
  ) {
    this.block_lock_base_func();
    const view = new Int32Array(this.signature_input);
    Atomics.store(view, 0, 2);
    const url_buffer = new TextEncoder().encode(url);
    this.allocator.block_write(url_buffer, this.signature_input, 1);
    Atomics.store(view, 3, options?.type === "module" ? 1 : 0);
    const obj_json = JSON.stringify(post_obj);
    const obj_buffer = new TextEncoder().encode(obj_json);
    this.allocator.block_write(obj_buffer, this.signature_input, 4);
    this.call_base_func();
    this.block_wait_base_func();

    this.release_base_func();
  }

  static init_self(sl: WorkerBackgroundRefObject): WorkerBackgroundRef {
    return new WorkerBackgroundRef(
      AllocatorUseArrayBuffer.init_self(sl.allocator),
      sl.lock,
      sl.signature_input,
    );
  }

  done_notify(code: number): void {
    const notify_view = new Int32Array(this.lock, 12);

    // notify done = code 2
    const old = Atomics.compareExchange(notify_view, 0, 0, 2);

    if (old !== 0) {
      console.error("what happened?");

      return;
    }

    Atomics.store(notify_view, 1, code);

    const num = Atomics.notify(notify_view, 0);

    if (num === 0) {
      Atomics.store(notify_view, 0, 0);
    }
  }

  async async_wait_done_or_error(): Promise<number> {
    const notify_view = new Int32Array(this.lock, 12);

    Atomics.store(notify_view, 0, 0);

    let value: "timed-out" | "not-equal" | "ok";
    const { value: _value } = Atomics.waitAsync(notify_view, 0, 0);
    if (_value instanceof Promise) {
      value = await _value;
    } else {
      value = _value;
    }

    if (value === "timed-out") {
      throw new Error("timed-out");
    }

    const code = Atomics.load(notify_view, 0);

    if (code === 3) {
      const old = Atomics.compareExchange(notify_view, 0, 3, 0);

      if (old !== 3) {
        console.error("what happened?");
      }

      return 0;
    }

    if (code === 2) {
      const old = Atomics.compareExchange(notify_view, 0, 2, 0);

      const code = Atomics.load(notify_view, 1);

      if (old !== 2) {
        console.error("what happened?");
      }

      return code;
    }

    if (code !== 1) {
      throw new Error("unknown code");
    }

    // get error
    const ptr = Atomics.load(notify_view, 1);
    const size = Atomics.load(notify_view, 2);
    const error_buffer = this.allocator.get_memory(ptr, size);
    const error_txt = new TextDecoder().decode(error_buffer);
    const error_serialized = JSON.parse(
      error_txt,
    ) as Serializer.SerializedError;
    const error = Serializer.deserialize(error_serialized);

    const old = Atomics.compareExchange(notify_view, 0, 1, 0);

    if (old !== 1) {
      console.error("what happened?");
    }

    throw error;
  }

  block_wait_done_or_error(): number {
    const notify_view = new Int32Array(this.lock, 12);

    Atomics.store(notify_view, 0, 0);

    const value = Atomics.wait(notify_view, 0, 0);

    if (value === "timed-out") {
      throw new Error("timed-out");
    }

    const code = Atomics.load(notify_view, 0);

    if (code === 3) {
      const old = Atomics.compareExchange(notify_view, 0, 3, 0);

      if (old !== 3) {
        console.error("what happened?");
      }

      return 0;
    }

    if (code === 2) {
      const old = Atomics.compareExchange(notify_view, 0, 2, 0);

      const code = Atomics.load(notify_view, 1);

      if (old !== 2) {
        console.error("what happened?");
      }

      return code;
    }

    if (code !== 1) {
      throw new Error("unknown code");
    }

    // get error
    const ptr = Atomics.load(notify_view, 1);
    const size = Atomics.load(notify_view, 2);
    const error_buffer = this.allocator.get_memory(ptr, size);
    const error_txt = new TextDecoder().decode(error_buffer);
    const error_serialized = JSON.parse(
      error_txt,
    ) as Serializer.SerializedError;
    const error = Serializer.deserialize(error_serialized);

    const old = Atomics.compareExchange(notify_view, 0, 1, 0);

    if (old !== 1) {
      console.error("what happened?");
    }

    throw error;
  }

  terminate_all_workers(): void {
    this.block_lock_base_func();
    const view = new Int32Array(this.signature_input);
    Atomics.store(view, 0, 3);
    this.call_base_func();
    this.block_wait_base_func();
    this.release_base_func();
  }
}

export class WorkerRef {
  private id: number;

  constructor(id: number) {
    this.id = id;
  }

  get_id(): number {
    return this.id;
  }
}
