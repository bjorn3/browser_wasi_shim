import { Worker, isMainThread, parentPort } from "node:worker_threads";

class WorkerWrapper {
  worker: Worker;
  onmessage?: (event: any) => void;
  constructor(path: string) {
    this.worker = new Worker(path);
    this.worker.on("message", (event) => {
      this.onmessage?.(event);
    });
  }
  postMessage(msg: any) {
    this.worker.postMessage({
      data: msg,
    });
  }
  terminate() {
    return this.worker.terminate();
  }
}

const set_fake_worker = () => {
  if (isMainThread) {
    throw new Error("not main thread");
  }

  globalThis.postMessage = (msg: any) => {
    parentPort.postMessage({
      data: msg,
    });
  };
  parentPort.on("message", (event) => {
    (globalThis as any).onmessage?.(event);
  });

  (globalThis as any).Worker = WorkerWrapper;
};

// BroadcastChannel ping/pong utilities
const PING_CHANNEL = "destroy_test_ping";
const PONG_CHANNEL = "destroy_test_pong";

/**
 * Set up a worker to respond to pings with pongs
 * @param worker_id Unique identifier for this worker
 * @returns Cleanup function to close the channel
 */
function setupPongResponder(worker_id: number): () => void {
  const pingChannel = new globalThis.BroadcastChannel(PING_CHANNEL);
  const pongChannel = new globalThis.BroadcastChannel(PONG_CHANNEL);

  pingChannel.onmessage = (event) => {
    // Respond to ping
    pongChannel.postMessage({
      pong: true,
      worker_id,
      timestamp: Date.now(),
      pingId: event.data.pingId,
    });
  };

  return () => {
    pingChannel.close();
    pongChannel.close();
  };
}

/**
 * Send pings and count unique pong responders
 * @param pingCount Number of pings to send
 * @param intervalMs Interval between pings in milliseconds
 * @returns Promise that resolves with Set of unique worker IDs that responded
 */
function sendPingsAndCountPongs(
  pingCount: number = 10,
  intervalMs: number = 100,
): Promise<Set<number>> {
  return new Promise((resolve) => {
    const pingChannel = new globalThis.BroadcastChannel(PING_CHANNEL);
    const pongChannel = new globalThis.BroadcastChannel(PONG_CHANNEL);
    const responders = new Set<number>();

    pongChannel.onmessage = (event) => {
      if (event.data.pong && event.data.worker_id !== undefined) {
        responders.add(event.data.worker_id);
      }
    };

    let sentCount = 0;
    const pingInterval = setInterval(() => {
      sentCount++;
      pingChannel.postMessage({
        ping: true,
        timestamp: Date.now(),
        pingId: sentCount,
      });

      if (sentCount >= pingCount) {
        clearInterval(pingInterval);

        // Wait a bit for final pongs to arrive
        setTimeout(() => {
          pingChannel.close();
          pongChannel.close();
          resolve(responders);
        }, 500);
      }
    }, intervalMs);
  });
}

export { set_fake_worker, setupPongResponder, sendPingsAndCountPongs };
