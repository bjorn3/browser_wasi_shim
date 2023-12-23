import fs from 'fs/promises';
import path from 'path';

/**
 * Walks a directory recursively and returns the result of combining the found entries
 * using the given reducer function.
 *
 * @typedef {{ kind: "dir", contents: any } | { kind: "file", buffer: Buffer }} Entry
 * @param {string} dir
 * @param {(name: string, entry: Entry, out: any) => any} nextPartialResult
 * @param {() => any} initial
 */
export async function walkFs(dir, nextPartialResult, initial) {
  let result = initial();
  const srcContents = await fs.readdir(dir, { withFileTypes: true });
  for (let entry of srcContents) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const contents = await walkFs(entryPath, nextPartialResult, initial);
      result = nextPartialResult(entry.name, { kind: "dir", contents }, result);
    } else {
      const buffer = await fs.readFile(entryPath);
      result = nextPartialResult(entry.name, { kind: "file", buffer }, result);
    }
  }
  return result;
}
