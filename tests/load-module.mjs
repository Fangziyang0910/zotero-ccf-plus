import { build } from "esbuild";
import vm from "node:vm";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export async function loadModule(entry, globals = {}) {
  const result = await build({
    stdin: {
      contents: entry,
      resolveDir: root,
      loader: "ts",
    },
    bundle: true,
    platform: "node",
    format: "cjs",
    write: false,
    define: { __env__: '"production"' },
    plugins: [
      {
        name: "toolkit-fixture",
        setup(builder) {
          builder.onResolve({ filter: /utils\/ztoolkit$/ }, () => ({
            path: "toolkit-fixture",
            namespace: "fixture",
          }));
          builder.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({
            contents:
              "export const createZToolkit = () => globalThis.makeToolkit();",
          }));
        },
      },
    ],
  });
  const context = {
    module: { exports: {} },
    console,
    setTimeout,
    clearTimeout,
    AbortController,
    URL,
    ztoolkit: { log() {} },
    ...globals,
  };
  vm.runInNewContext(result.outputFiles[0].text, context);
  return context.module.exports;
}
