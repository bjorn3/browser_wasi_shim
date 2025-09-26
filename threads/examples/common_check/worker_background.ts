// @ts-ignore
import worker_background_worker from "../node_modules/@oligami/browser_wasi_shim-threads/dist/worker_background_worker.min.js";

import { wait_async_polyfill } from "../../src/index.js";

wait_async_polyfill();

worker_background_worker();
