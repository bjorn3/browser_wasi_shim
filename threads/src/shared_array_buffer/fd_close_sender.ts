import type { FdCloseSender } from "../sender.js";
import {
  ToRefSenderUseArrayBuffer,
  type ToRefSenderUseArrayBufferObject,
} from "./sender.js";

export type FdCloseSenderUseArrayBufferObject = {
  max_share_arrays_memory?: number;
  share_arrays_memory?: SharedArrayBuffer;
} & ToRefSenderUseArrayBufferObject;

// Object to tell other processes,
// such as child processes,
// that the file descriptor has been closed
export class FdCloseSenderUseArrayBuffer
  extends ToRefSenderUseArrayBuffer
  implements FdCloseSender
{
  // Should be able to change the size of memory as it accumulates more and more on memory
  constructor(
    max_share_arrays_memory?: number,
    share_arrays_memory?: SharedArrayBuffer,
  ) {
    super(4, max_share_arrays_memory, share_arrays_memory);
  }

  // Send the closed file descriptor to the target process
  async send(targets: Array<number>, fd: number): Promise<void> {
    if (targets === undefined || targets.length === 0) {
      throw new Error("targets is empty");
    }
    // console.log("fd_close_sender send", targets, fd);

    await this.async_send(targets, new Uint32Array([fd]));
  }

  // Get the closed file descriptor from the target process
  get(id: number): Array<number> | undefined {
    const data = this.get_data(id);
    if (data === undefined) {
      return undefined;
    }

    // console.log("fd_close_sender get", data);

    const array = [];
    for (const i of data) {
      array.push(i[0]);
    }

    return array;
  }

  // Initialize the class from object
  static init_self(sl: FdCloseSenderUseArrayBufferObject): FdCloseSender {
    const sel = ToRefSenderUseArrayBuffer.init_self_inner(sl);
    return new FdCloseSenderUseArrayBuffer(
      sel.max_share_arrays_memory,
      sel.share_arrays_memory,
    );
  }
}
