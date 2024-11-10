export interface FdCloseSender {
  send(targets: Array<number>, fd: number): Promise<void>;
  get(id: number): Array<number> | undefined;
}
