/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 *
 * Author: Lars T Hansen, lhansen@mozilla.com
 *
 * Modified to implement a dynamic worker pool with idle timeout,
 * avoiding the 'delete' operator for better performance.
 */

export function wait_async_polyfill() {
  // If native implementation already exists, do nothing
  if (typeof Atomics.waitAsync === "function") return;

  // Code to be executed within the worker
  const helperCode = `
    onmessage = function (ev) {
      try {
        switch (ev.data[0]) {
          case 'wait': {
            let [_, ia, index, value, timeout] = ev.data;
            let result = Atomics.wait(ia, index, value, timeout);
            postMessage(['ok', result]);
            break;
          }
          default: {
            throw new Error("Bogus message sent to wait helper: " + ev.data.join(','));
          }
        }
      } catch (e) {
        // Notify the main thread of any errors
        postMessage(['error', e.name + ': ' + e.message]);
      }
    }
  `;

  // Pool to hold idle workers
  const idleHelpers = [];
  const IDLE_TIMEOUT = 10000; // 10 seconds

  /**
   * Gets a worker from the pool.
   * Reuses an idle worker if available, otherwise creates a new one.
   */
  function allocHelper() {
    if (idleHelpers.length > 0) {
      const h = idleHelpers.pop();
      // Cancel the scheduled termination timer for the reused worker
      if (h.terminationTimer) {
        clearTimeout(h.terminationTimer);
        // Avoid 'delete' by setting the property to null
        h.terminationTimer = null;
      }
      return h;
    }

    console.debug("Allocating new waitAsync helper worker");

    // Create a new worker if the pool is empty
    const blob = new Blob([helperCode], { type: "application/javascript" });
    const url = URL.createObjectURL(blob);
    const h = new Worker(url);
    URL.revokeObjectURL(url); // Clean up the object URL
    // Add an error handler for debugging
    h.onerror = (e) => {
      console.error(
        "Error in waitAsync helper worker:",
        e.message,
        e.filename,
        e.lineno,
      );
    };
    return h;
  }

  /**
   * Returns a worker to the pool.
   * Sets a timer to terminate the worker after 10 seconds of inactivity.
   * @param {Worker} h - The worker to return to the pool.
   */
  function freeHelper(h) {
    // Schedule the worker for termination if it remains idle
    h.terminationTimer = setTimeout(() => {
      const index = idleHelpers.indexOf(h);
      if (index !== -1) {
        h.terminate(); // Terminate the worker
        idleHelpers.splice(index, 1); // Remove from the pool
        console.debug("Terminated idle waitAsync helper worker");
      }
    }, IDLE_TIMEOUT);

    // Add the worker back to the idle pool
    idleHelpers.push(h);
  }

  /**
   * Polyfill implementation for Atomics.waitAsync
   */
  function waitAsync(ia, index_, value_, timeout_) {
    if (
      typeof ia !== "object" ||
      !(ia instanceof Int32Array) ||
      !(ia.buffer instanceof SharedArrayBuffer)
    )
      throw new TypeError("Atomics.waitAsync requires a shared Int32Array.");

    const index = index_ | 0;
    const value = value_ | 0;
    const timeout =
      timeout_ === undefined ? Number.POSITIVE_INFINITY : +timeout_;

    if (index < 0 || index >= ia.length) {
      throw new RangeError("Index out of bounds.");
    }

    // Optimization: avoid waiting if the value already doesn't match
    if (Atomics.load(ia, index) !== value) {
      return {
        async: false,
        value: "not-equal",
      };
    }

    // General case: must wait for a notification
    return {
      async: true,
      value: new Promise((resolve, reject) => {
        const h = allocHelper();

        h.onmessage = (ev) => {
          // Return the worker to the pool for reuse
          freeHelper(h);
          h.onmessage = null; // Clear the handler

          switch (ev.data[0]) {
            case "ok":
              resolve(ev.data[1]);
              break;
            case "error":
              // Note: rejection is an artifact of the polyfill, not in the spec
              reject(new Error(`Error in waitAsync helper: ${ev.data[1]}`));
              break;
          }
        };

        // Send the wait command to the worker
        h.postMessage(["wait", ia, index, value, timeout]);
      }),
    };
  }

  // Define the waitAsync property on the Atomics object
  Object.defineProperty(Atomics, "waitAsync", {
    value: waitAsync,
    configurable: true,
    enumerable: false,
    writable: true,
  });
}
