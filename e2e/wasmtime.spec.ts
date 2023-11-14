import { test, expect } from "@playwright/test";

const URL = "http://127.0.0.1:3000/e2e/harness.html";
const WASMDIR = "../wasmtime/artifacts";

const tests = [
  {
    file: `${WASMDIR}/preview1_path_open_read_write.wasm`,
    command: true,
    args: ["/"],
  },
];

for (const testDef of tests) {
  test(`first ${testDef.file}`, async ({ page }) => {
    await page.goto(`${URL}?${JSON.stringify(testDef)}`);
    await page.waitForFunction(
      () => document.getElementById("status")?.textContent !== "Not started",
    );
    expect(await await page.getByTestId("status").textContent()).toBe(
      "success",
    );
  });
}
