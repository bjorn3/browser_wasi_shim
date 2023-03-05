
export function strace<T extends object>(imports: T, no_trace: Array<string|symbol>) {
  return new Proxy(imports, {
    get(target, prop, receiver) {
      let res = Reflect.get(target, prop, receiver);
      if (no_trace.includes(prop)) {
        return res;
      }
      return function (...args) {
        console.log(prop, "(", ...args, ")");
        return Reflect.apply(res as Function, receiver, args);
      };
    },
  });
}
