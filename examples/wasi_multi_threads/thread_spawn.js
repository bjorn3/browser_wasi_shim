import { thread_spawn_on_worker } from "../../dist/wasi_farm/shared_array_buffer/thread_spawn.js";

self.onmessage = (event) => {
  thread_spawn_on_worker(event.data);
}
