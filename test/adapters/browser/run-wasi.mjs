#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import { chromium } from "playwright"
import { parseArgs } from "../shared/parseArgs.mjs"
import { walkFs } from "../shared/walkFs.mjs"

function parseDirSpec(dirSpec) {
  const separator = dirSpec.indexOf("::");
  if (separator === -1) {
    return { host: dirSpec, guest: dirSpec };
  }
  const host = dirSpec.slice(0, separator);
  const guest = dirSpec.slice(separator + 2) || ".";
  return { host, guest };
}

async function derivePreopens(dirs) {
  const preopens = [];
  for (const dirSpec of dirs) {
    const { host, guest } = parseDirSpec(dirSpec);
    const contents = await walkFs(host, (name, entry, out) => {
      if (entry.kind === "file") {
        // Convert buffer to array to make it serializable.
        entry.buffer = Array.from(entry.buffer);
      }
      return { ...out, [name]: entry };
    }, () => {});
    preopens.push({ dir: guest, contents });
  }
  return preopens;
}

/**
 * Configure routes for the browser harness.
 *
 * @param {import('playwright').BrowserContext} context
 * @param {string} harnessURL
 */
async function configureRoutes(context, harnessURL) {

  // Serve the main test page.
  context.route(`${harnessURL}/run-test.html`, async route => {
    const dirname = new URL(".", import.meta.url).pathname;
    const body = await fs.readFile(path.join(dirname, "run-test.html"), "utf8");
    route.fulfill({
      status: 200,
      contentType: 'text/html',
      // Browsers reduce the precision of performance.now() if the page is not
      // isolated. To keep the precision for `clock_get_time` we need to set the
      // following headers.
      // See: https://developer.mozilla.org/en-US/docs/Web/API/Performance/now#security_requirements
      headers: {
        "Cross-Origin-Opener-Policy": "same-origin",
        "Cross-Origin-Embedder-Policy": "require-corp",
      },
      body,
    });
  })

  // Serve wasi-testsuite files.
  // e.g. http://browser-wasi-shim.localhost/home/me/browser_wasi_shim/test/wasi-testsuite/xxx
  let projectDir = path.join(new URL("../../wasi-testsuite", import.meta.url).pathname);
  projectDir = path.resolve(projectDir);
  context.route(`${harnessURL}${projectDir}/**/*`, async route => {
    const pathname = new URL(route.request().url()).pathname;
    const relativePath = pathname.slice(pathname.indexOf(projectDir) + projectDir.length);
    const content = await fs.readFile(path.join(projectDir, relativePath));
    route.fulfill({
      status: 200,
      contentType:
        {
          ".wasm": "application/wasm",
          ".json": "application/json",
          ".js": "application/javascript",
        }[path.extname(pathname)] || "application/octet-stream",
      body: content,
    });
  });

  // Serve transpiled browser_wasi_shim files under ./dist.
  context.route(`${harnessURL}/dist/*.js`, async route => {
    const pathname = new URL(route.request().url()).pathname;
    const distRelativePath = pathname.slice(pathname.indexOf("/dist/"));
    const distDir = new URL("../../..", import.meta.url);
    const distPath = path.join(distDir.pathname, distRelativePath);
    const content = await fs.readFile(distPath);
    route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: content,
    });
  });
}

async function runWASIOnBrowser(options) {
  const browser = await chromium.launch({channel: "chromium"});
  const context = await browser.newContext();
  const harnessURL = 'http://browser-wasi-shim.localhost'

  await configureRoutes(context, harnessURL);

  const page = await context.newPage();
  // Expose stdout/stderr bindings to allow test driver to capture output.
  await page.exposeBinding("bindingWriteIO", (_, buffer, destination) => {
    buffer = Buffer.from(buffer);
    switch (destination) {
      case "stdout":
        process.stdout.write(buffer);
        break;
      case "stderr":
        process.stderr.write(buffer);
        break;
      default:
        throw new Error(`Unknown destination ${destination}`);
    }
  });
  // Expose a way to serialize preopened directories to the browser.
  await page.exposeBinding("bindingDerivePreopens", async (_, dirs) => {
    return await derivePreopens(dirs);
  });

  page.on('console', msg => console.log(msg.text()));
  page.on('pageerror', ({ message }) => {
    console.log('PAGE ERROR:', message)
    process.exit(1); // Unexpected error.
  });

  await page.goto(`${harnessURL}/run-test.html`, { waitUntil: "load" })
  const status = await page.evaluate(async (o) => await window.runWASI(o), options)
  await page.close();
  process.exit(status);
}

async function main() {
  const options = parseArgs();
  if (options.version) {
    const pkg = JSON.parse(await fs.readFile(new URL("../../../package.json", import.meta.url)));
    console.log(`${pkg.name} v${pkg.version}`);
    return;
  }

  await runWASIOnBrowser(options);
}

await main();
