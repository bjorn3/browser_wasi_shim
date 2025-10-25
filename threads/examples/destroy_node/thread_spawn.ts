import { thread_spawn_on_worker } from "../../src/index.ts";
import { set_fake_worker, setupPongResponder } from "./common.ts";

set_fake_worker();

let worker_id: number | undefined;
let cleanupPong: (() => void) | undefined;

globalThis.onmessage = (event) => {
  // Capture worker_id from the thread spawn message
  if (
    event.data &&
    event.data.worker_id !== undefined &&
    worker_id === undefined
  ) {
    worker_id = event.data.worker_id;
    console.log(`Thread worker ${worker_id}: Ready to respond to pings`);

    // Set up pong responder for this worker
    cleanupPong = setupPongResponder(worker_id);
  }

  thread_spawn_on_worker(event.data);
};
