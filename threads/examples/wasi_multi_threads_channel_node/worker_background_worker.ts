// @ts-ignore
import run from "../node_modules/@oligami/browser_wasi_shim-threads/dist/worker_background_worker.min.js";

import { set_fake_worker } from "./common.ts";

set_fake_worker();

run();
