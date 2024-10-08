// https://swc.rs/docs/configuration/bundling

const { config } = require("@swc/core/spack");

console.log(__dirname);

module.exports = config({
  entry: {
    web: `${__dirname}/worker.ts`,
  },
  output: {
    path: `${__dirname}/../../../dist/workers/`,
    name: "worker_background_worker.js",
  },
});
