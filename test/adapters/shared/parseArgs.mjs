/// Parse command line arguments given by `adapter.py` through
/// `wasi-testsuite`'s test runner.
export function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    "version": false,
    "test-file": null,
    "arg": [],
    "env": [],
    "dir": [],
  };
  while (args.length > 0) {
    const arg = args.shift();
    if (arg.startsWith("--")) {
      let [name, value] = arg.split("=");
      name = name.slice(2);
      if (Object.prototype.hasOwnProperty.call(options, name)) {
        if (value === undefined) {
          value = args.shift() || true;
        }
        if (Array.isArray(options[name])) {
          options[name].push(value);
        } else {
          options[name] = value;
        }
      }
    }
  }

  return options;
}
