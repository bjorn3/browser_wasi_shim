export function strace<T extends object>(
  imports: T,
  no_trace: Array<string | symbol>,
) {
  return new Proxy(imports, {
    get(target, prop, receiver) {
      const f = Reflect.get(target, prop, receiver);
      if (no_trace.includes(prop)) {
        return f;
      }
      return function (...args: undefined[]) {
        console.log(prop, "(", ...args, ")");
        // eslint-disable-next-line @typescript-eslint/ban-types
        const result = Reflect.apply(f as Function, receiver, args);
        console.log(" =", result);
        return result;
      };
    },
  });
}
