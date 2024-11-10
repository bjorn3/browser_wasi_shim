import swc from "@swc/core";

import { readFileSync, writeFileSync } from "node:fs";

const old_code = readFileSync(
  "./dist/workers/worker_background_worker.js",
  "utf8",
);

const { code } = await swc.minify(old_code, {
  compress: {
    reduce_funcs: true,
    arguments: true,
    booleans_as_integers: true,
    hoist_funs: false,
    keep_classnames: false,
    unsafe: true,
  },
  mangle: true,
});

writeFileSync(
  "./dist/workers/worker_background_worker_minify.js",
  code,
  "utf8",
);

// \n -> \\n

const wrapper_code = `export const url = () => {
  const code =
    '${code.replace(/\\/g, "\\\\")}';

  const blob = new Blob([code], { type: "application/javascript" });

  const url = URL.createObjectURL(blob);

  return url;
};
`;

writeFileSync(
  "./src/shared_array_buffer/worker_background/worker_blob.ts",
  wrapper_code,
  "utf8",
);
