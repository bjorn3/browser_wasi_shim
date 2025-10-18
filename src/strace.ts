export function strace<T extends object>(
  imports: T,
  no_trace: Array<string | symbol>,
) {
  return new Proxy(imports, {
    get(target, prop, receiver) {
      const f = Reflect.get(target, prop, receiver);
      if (no_trace.includes(prop) || typeof f !== "function") {
        return f;
      }
      return (...args: unknown[]) => {
        console.log(prop, "(", ...args, ")");
        const result = Reflect.apply(
          f as (...fnArgs: unknown[]) => unknown,
          receiver,
          args,
        );
        console.log(" =", result);
        return result;
      };
    },
  });
}
