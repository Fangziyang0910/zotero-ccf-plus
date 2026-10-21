import { ExampleFactory } from "./modules/examples";
import { config } from "../package.json";
import { initLocale } from "./utils/locale";
import { stopRequests } from "./modules/requests";
import { getPref } from "./utils/prefs";
import { createZToolkit } from "./utils/ztoolkit";

const windows = new Map<Window, { toolkit: ZToolkit; cleanup: () => void }>();
let initialization: Promise<void> | undefined;

async function onStartup() {
  initialization ||= (async () => {
    await Promise.all([
      Zotero.initializationPromise,
      Zotero.unlockPromise,
      Zotero.uiReadyPromise,
    ]);
    initLocale();
    await ExampleFactory.registerExtraColumn();
    ExampleFactory.registerNotifier();
  })();
  await initialization;
  for (const win of Zotero.getMainWindows()) await onMainWindowLoad(win);
}

async function onMainWindowLoad(win: Window): Promise<void> {
  if (initialization) await initialization;
  if (!initialization || !addon.data.alive || windows.has(win)) return;
  const toolkit = createZToolkit();
  const cleanup = ExampleFactory.registerRightClickMenuItem(win, toolkit);
  windows.set(win, { toolkit, cleanup });
}

async function onMainWindowUnload(win: Window): Promise<void> {
  const state = windows.get(win);
  state?.cleanup?.();
  state?.toolkit.unregisterAll();
  windows.delete(win);
}

async function onNotify(
  event: string,
  type: string,
  ids: Array<string | number>,
  extraData: { [key: string]: any },
) {
  ztoolkit.log("notify", event, type, ids, extraData);

  if (event == "add" && type == "item" && getPref("enable") !== false) {
    // Get items and filter out attachments and other non-regular items
    const items = Zotero.Items.get(ids as number[]);
    const regularItems = items.filter((item) => {
      if (!item || item.deleted || !item.isRegularItem() || item.isAttachment())
        return false;
      const feedItem = (
        item as unknown as { isFeedItem?: boolean | (() => boolean) }
      ).isFeedItem;
      if (typeof feedItem === "function" ? feedItem.call(item) : feedItem)
        return false;
      const library = Zotero.Libraries.get(item.libraryID);
      return library && library.libraryType === "user" && library.editable;
    });

    if (regularItems.length !== 0) {
      await ExampleFactory.exampleNotifierCallback(regularItems);
      return;
    }
  }
}

function onShutdown(): void {
  addon.data.alive = false;
  stopRequests();
  ExampleFactory.unregisterApplicationResources();
  for (const state of windows.values()) {
    state.cleanup?.();
    state.toolkit.unregisterAll();
  }
  windows.clear();
  ztoolkit.unregisterAll();
  addon.data.dialog?.window?.close();
  // @ts-ignore: Dynamic addonInstance is not explicitly typed on Zotero global
  delete Zotero[config.addonInstance];
}

// Add your hooks here. For element click, etc.
// Keep in mind hooks only do dispatch. Don't add code that does real jobs in hooks.
// Otherwise the code would be hard to read and maintain.

export default {
  onStartup,
  onShutdown,
  onNotify,
  onMainWindowLoad,
  onMainWindowUnload,
};
