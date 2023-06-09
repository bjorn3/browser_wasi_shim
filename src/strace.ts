
export function strace<T extends object>(imports: T, no_trace: Array<string|symbol>) {
  return new Proxy(imports, {
    get(target, prop, receiver) {
      let f = Reflect.get(target, prop, receiver);
      if (no_trace.includes(prop)) {
        return f;
      }
      return function (...args) {
        console.log(prop, "(", ...args, ")");
        let result = Reflect.apply(f as Function, receiver, args);
        console.log(" =", result);
        return result;
      };
    },
  });
}
