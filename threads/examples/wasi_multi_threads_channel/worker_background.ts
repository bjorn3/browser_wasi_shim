// @ts-ignore
import run from "../node_modules/@oligami/browser_wasi_shim-threads/dist/worker_background_worker.min.js";

import { wait_async_polyfill } from "../../src";

wait_async_polyfill();

run();
