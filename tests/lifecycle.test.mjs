import test from "node:test";
import assert from "node:assert/strict";
import { loadModule } from "./load-module.mjs";

test("window reopening does not register application resources twice", async () => {
  const calls = { columns: 0, notifier: 0, menu: 0 };
  const win1 = { document: {}, addEventListener() {}, closed: false };
  const win2 = { document: {}, addEventListener() {}, closed: false };
  const toolkit = { unregisterAll() {} };
  const globals = {
    window: win1,
    addon: { data: { alive: true, ztoolkit: toolkit } },
    makeToolkit: () => toolkit,
    Zotero: {
      initializationPromise: Promise.resolve(),
      unlockPromise: Promise.resolve(),
      uiReadyPromise: Promise.resolve(),
      getMainWindows: () => [win1],
    },
    Localization: class {
      formatMessagesSync() {
        return [{ value: "test" }];
      }
    },
  };
  const { hooks, ExampleFactory } = await loadModule(
    'export { default as hooks } from "./src/hooks"; export { ExampleFactory } from "./src/modules/examples";',
    globals,
  );
  ExampleFactory.registerExtraColumn = async () => {
    calls.columns++;
  };
  ExampleFactory.registerNotifier = () => {
    calls.notifier++;
  };
  ExampleFactory.registerRightClickMenuItem = () => {
    calls.menu++;
  };
  await hooks.onStartup();
  await hooks.onMainWindowLoad(win1);
  await hooks.onMainWindowLoad(win2);
  assert.equal(calls.columns, 1);
  assert.equal(calls.notifier, 1);
  assert.equal(calls.menu, 2);
});
