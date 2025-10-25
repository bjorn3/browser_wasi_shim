import { thread_spawn_on_worker } from "../../src/index.ts";
import { set_fake_worker } from "./common.ts";

set_fake_worker();

globalThis.onmessage = (event) => {
  thread_spawn_on_worker(event.data);
};
