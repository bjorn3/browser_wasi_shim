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

export { set_fake_worker };
