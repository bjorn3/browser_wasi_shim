import fs from "node:fs";
import path from "node:path";

const worker_background_worker_url =
  "./src/shared_array_buffer/worker_background/worker_background_worker_minify.js";

fs.copyFileSync(
  worker_background_worker_url,
  "./dist/worker_background_worker.min.js",
);
