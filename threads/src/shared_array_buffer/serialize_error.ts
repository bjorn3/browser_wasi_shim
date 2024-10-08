export type SerializedError = {
  message: string;
  name: string;
  stack?: string;
  cause?: unknown;
};

export const serialize = (error: Error): SerializedError => {
  return {
    message: error.message,
    name: error.name,
    stack: error.stack,
    cause: error.cause,
  };
};

export const deserialize = (serializedError: SerializedError): Error => {
  const error = new Error(serializedError.message);
  error.name = serializedError.name;
  error.stack = serializedError.stack?.replace(/.wasm:/g, ".wasm\n");
  error.cause = serializedError.cause;
  return error;
};
