import { thread_spawn_on_worker } from "../../src";

self.onmessage = async (event) => {
  await thread_spawn_on_worker(event.data);
};
