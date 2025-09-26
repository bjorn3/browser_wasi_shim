import { thread_spawn_on_worker } from "../../src";

self.onmessage = (event) => {
  thread_spawn_on_worker(event.data);
};
