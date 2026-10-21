import { config } from "../../package.json";
import { getString } from "../utils/locale";
import { PaperInfo } from "./getPaperInfo";

// Note标题常量
const CCF_INFO_NOTE_TITLE = "CCF Info & Citations";

// 数据接口
interface CCFInfoData {
  ccfInfo: string;
  citationNumber: string;
}

export class ExampleFactory {
  private static noteWrites = new Map<number, Promise<void>>();
  private static pendingItems = new Map<number, Promise<boolean>>();
  private static notifierID: string | undefined;
  private static notifierTimer: ReturnType<typeof setTimeout> | undefined;
  private static addedItems = new Set<number>();
  private static columnKeys: string[] = [];

  private static canUpdateItem(item: Zotero.Item): boolean {
    const library = item && Zotero.Libraries.get(item.libraryID);
    return Boolean(
      item?.isRegularItem() && !item.deleted && library && library.editable,
    );
  }

  private static preserveSuccessfulValue(
    value: string | undefined,
    existing: string,
    valid: (text: string) => boolean,
  ): string {
    if (value && valid(value)) return value;
    if (valid(existing)) return existing;
    return value || existing;
  }

  private static escapeHtml(value: string): string {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  private static formatCCFForColumn(ccfInfo: string): string {
    if (!ccfInfo) {
      return "";
    }

    if (ccfInfo === "arXiv") {
      return "Preprint | arXiv";
    }

    const match = ccfInfo.match(/^CCF-([ABC])\s+(.+)$/);
    if (match) {
      return `CCF ${match[1]} | ${match[2]}`;
    }

    const noneMatch = ccfInfo.match(/^CCF-None\s+(.+)$/);
    if (noneMatch) {
      return `CCF None | ${noneMatch[1]}`;
    }

    if (ccfInfo === "Not Found") {
      return "Unknown | Not Found";
    }

    return ccfInfo;
  }

  private static formatCitationForColumn(citationNumber: string): string {
    if (!citationNumber) {
      return "";
    }

    if (/^\d+$/.test(citationNumber)) {
      return `Cited ${citationNumber}`;
    }

    return citationNumber;
  }

  private static getCCFBadgeColors(data: string) {
    if (data.startsWith("CCF A |")) {
      return { background: "#dff3e8", color: "#146c43", border: "#b7dfc8" };
    }
    if (data.startsWith("CCF B |")) {
      return { background: "#e8eefc", color: "#2f56a6", border: "#c8d5f6" };
    }
    if (data.startsWith("CCF C |")) {
      return { background: "#fff2cc", color: "#8a5a00", border: "#ead083" };
    }
    if (data.startsWith("Preprint |")) {
      return { background: "#edf0f4", color: "#52616b", border: "#d4dae2" };
    }
    if (data.startsWith("Unknown |")) {
      return { background: "#f4e8e8", color: "#9b2c2c", border: "#e8c9c9" };
    }
    return { background: "#f1e5f6", color: "#7a2c8f", border: "#e0c8e8" };
  }

  private static renderCCFCell(
    data: string,
    doc: Document,
    columnClassName: string,
  ): HTMLElement {
    const cell = doc.createElement("span");
    cell.className = `cell ${columnClassName}`;
    cell.title = data || "";
    cell.style.overflow = "hidden";
    cell.style.textOverflow = "ellipsis";
    cell.style.whiteSpace = "nowrap";
    cell.style.minWidth = "0";

    if (!data) {
      return cell;
    }

    const colors = ExampleFactory.getCCFBadgeColors(data);
    const badge = doc.createElement("span");
    badge.textContent = data;
    badge.className = "ccf-info-badge";
    badge.style.display = "inline-block";
    badge.style.maxWidth = "100%";
    badge.style.minWidth = "0";
    badge.style.boxSizing = "border-box";
    badge.style.padding = "2px 8px";
    badge.style.border = `1px solid ${colors.border}`;
    badge.style.borderRadius = "6px";
    badge.style.backgroundColor = colors.background;
    badge.style.color = colors.color;
    badge.style.fontWeight = "650";
    badge.style.lineHeight = "1.3";
    badge.style.whiteSpace = "nowrap";
    badge.style.overflow = "hidden";
    badge.style.textOverflow = "ellipsis";
    badge.style.verticalAlign = "middle";
    cell.appendChild(badge);
    return cell;
  }

  private static buildCCFNoteContent(data: CCFInfoData): string {
    const ccfText = data.ccfInfo || "Not Found";
    const citationText = data.citationNumber || "Not Found";
    const escapedCcfText = ExampleFactory.escapeHtml(ccfText);
    const escapedCitationText = ExampleFactory.escapeHtml(citationText);
    const jsonString = JSON.stringify(data, null, 2);
    const escapedJson = ExampleFactory.escapeHtml(jsonString);

    return `
<div><b>${CCF_INFO_NOTE_TITLE}</b></div>
<div><br /></div>
<table>
  <tr>
    <th align="left">CCF</th>
    <td>${escapedCcfText}</td>
  </tr>
  <tr>
    <th align="left">Citations</th>
    <td>${escapedCitationText}</td>
  </tr>
</table>
<div><br /></div>
<div><b>Raw Data</b></div>
<div><pre data-ccf-json="1">${escapedJson}</pre></div>`.trim();
  }

  // 从note中获取CCF信息
  private static getCCFInfoFromNote(item: Zotero.Item): CCFInfoData {
    try {
      // getNotes()返回的是note ID数组
      const noteIDs = item.getNotes();
      if (!noteIDs || noteIDs.length === 0) {
        return { ccfInfo: "", citationNumber: "" };
      }

      // 遍历所有notes查找CCF信息note
      for (const noteID of noteIDs) {
        const note = Zotero.Items.get(noteID);
        if (!note) continue;

        const title = note.getNoteTitle();
        if (title === CCF_INFO_NOTE_TITLE) {
          const noteContent = note.getNote();
          ztoolkit.log("Found CCF note, content:", noteContent);

          // 优先读取带标记的 JSON 数据
          const preJsonMatch = noteContent.match(
            /<pre[^>]*data-ccf-json="1"[^>]*>([\s\S]*?)<\/pre>/i,
          );
          if (preJsonMatch) {
            const jsonText = preJsonMatch[1]
              .replace(/&quot;/g, '"')
              .replace(/&lt;/g, "<")
              .replace(/&gt;/g, ">")
              .replace(/&amp;/g, "&");
            const parsed = JSON.parse(jsonText) as CCFInfoData;
            return {
              ccfInfo: parsed.ccfInfo || "",
              citationNumber: parsed.citationNumber || "",
            };
          }

          // 兼容旧 note：移除HTML标签，提取JSON内容
          const textContent = noteContent.replace(/<[^>]*>/g, "").trim();
          ztoolkit.log("Text content:", textContent);

          // 尝试找到JSON部分
          const jsonMatch = textContent.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const data = JSON.parse(jsonMatch[0]) as CCFInfoData;
            ztoolkit.log("Parsed data:", data);
            return {
              ccfInfo: data.ccfInfo || "",
              citationNumber: data.citationNumber || "",
            };
          }
        }
      }
    } catch (error) {
      ztoolkit.log("Error reading CCF info from note:", error);
    }
    return { ccfInfo: "", citationNumber: "" };
  }

  // 保存CCF信息到note
  private static async saveCCFInfoToNote(
    item: Zotero.Item,
    ccfInfo?: string,
    citationNumber?: string,
  ) {
    const previous = this.noteWrites.get(item.id) || Promise.resolve();
    const write = previous
      .catch(() => undefined)
      .then(() => this.writeCCFInfoToNote(item, ccfInfo, citationNumber));
    this.noteWrites.set(item.id, write);
    try {
      await write;
    } finally {
      if (this.noteWrites.get(item.id) === write)
        this.noteWrites.delete(item.id);
    }
  }

  private static async writeCCFInfoToNote(
    item: Zotero.Item,
    ccfInfo?: string,
    citationNumber?: string,
  ) {
    try {
      // getNotes()返回的是note ID数组
      const noteIDs = item.getNotes();
      let ccfNote: Zotero.Item | null = null;

      // 查找现有的CCF信息note
      if (noteIDs && noteIDs.length > 0) {
        for (const noteID of noteIDs) {
          const note = Zotero.Items.get(noteID);
          if (note && note.getNoteTitle() === CCF_INFO_NOTE_TITLE) {
            ccfNote = note;
            break;
          }
        }
      }

      // 如果note不存在，创建新的
      if (!ccfNote) {
        ccfNote = new Zotero.Item("note");
        ccfNote.libraryID = item.libraryID;
        ccfNote.parentID = item.id;
        // 设置临时内容以便note有标题
        ccfNote.setNote(`<div><b>${CCF_INFO_NOTE_TITLE}</b></div>`);
        await ccfNote.saveTx();
        ztoolkit.log("Created new CCF note for item:", item.id);
      }

      // 获取现有数据
      const existingData = ExampleFactory.getCCFInfoFromNote(item);

      // 只更新提供的字段，保留现有值
      const finalCcfInfo = this.preserveSuccessfulValue(
        ccfInfo,
        existingData.ccfInfo,
        (value) => value === "arXiv" || /^CCF-(?:[ABC]|None)\s+\S/.test(value),
      );
      const finalCitationNumber = this.preserveSuccessfulValue(
        citationNumber,
        existingData.citationNumber,
        (value) => /^\d+$/.test(value),
      );

      // 构建JSON数据
      const jsonData: CCFInfoData = {
        ccfInfo: finalCcfInfo,
        citationNumber: finalCitationNumber,
      };

      // 构建可读 note + 可解析 JSON 数据
      const noteContent = ExampleFactory.buildCCFNoteContent(jsonData);

      ztoolkit.log("Saving CCF note with data:", jsonData);
      ccfNote.setNote(noteContent);
      await ccfNote.saveTx();

      // 刷新列显示
      ExampleFactory.refreshItemTreeRow(item);
    } catch (error) {
      ztoolkit.log("Error saving CCF info to note:", error);
      throw error;
    }
  }

  // 刷新条目树中的行显示
  private static refreshItemTreeRow(item: Zotero.Item) {
    try {
      // 方法1: 使用 Zotero.Notifier 触发刷新
      Zotero.Notifier.trigger("refresh", "item", [item.id]);

      // 方法2: 尝试直接刷新itemsView
      const ZoteroPane = Zotero.getActiveZoteroPane();
      if (ZoteroPane && ZoteroPane.itemsView) {
        try {
          const rowIndex = ZoteroPane.itemsView.getRowIndexByID(
            item.id.toString(),
          );
          if (rowIndex !== false && rowIndex !== undefined) {
            ZoteroPane.itemsView.tree.invalidateRow(rowIndex);
          }
        } catch (e) {
          ztoolkit.log("Could not invalidate specific row, refreshing all:", e);
        }
      }

      ztoolkit.log("Refreshed display for item:", item.id);
    } catch (error) {
      ztoolkit.log("Error refreshing item tree row:", error);
    }
  }

  static async registerExtraColumn() {
    const keys = await Zotero.ItemTreeManager.registerColumns([
      {
        pluginID: config.addonID,
        dataKey: "ccfInfo",
        label: getString("ccf-info"),
        dataProvider: (item: Zotero.Item, dataKey: string) => {
          try {
            // 确保是正常条目，不是note或附件
            if (
              !item ||
              !item.itemTypeID ||
              item.isNote() ||
              item.isAttachment()
            ) {
              return "";
            }

            const data = ExampleFactory.getCCFInfoFromNote(item);
            const result = ExampleFactory.formatCCFForColumn(
              data.ccfInfo || "",
            );
            return result;
          } catch (error) {
            ztoolkit.log("Error in ccfInfo dataProvider:", error);
            return "";
          }
        },
        renderCell: (
          index: number,
          data: string,
          column: any,
          isFirstColumn: boolean,
          doc: Document,
        ) => ExampleFactory.renderCCFCell(data, doc, column.className),
        zoteroPersist: ["width", "hidden", "sortDirection"],
      },
      {
        pluginID: config.addonID,
        dataKey: "citationNumber",
        label: getString("citation-number"),
        dataProvider: (item: Zotero.Item, dataKey: string) => {
          try {
            // 确保是正常条目，不是note或附件
            if (
              !item ||
              !item.itemTypeID ||
              item.isNote() ||
              item.isAttachment()
            ) {
              return "";
            }

            const data = ExampleFactory.getCCFInfoFromNote(item);
            const result = ExampleFactory.formatCitationForColumn(
              data.citationNumber || "",
            );
            return result;
          } catch (error) {
            ztoolkit.log("Error in citationNumber dataProvider:", error);
            return "";
          }
        },
        zoteroPersist: ["width", "hidden", "sortDirection"],
      },
    ]);
    this.columnKeys = keys || [];
  }

  public static async handleGetCCFInfo(items: Zotero.Item[]) {
    const regularItems = [
      ...new Map(
        items
          .filter((item) => this.canUpdateItem(item))
          .map((item) => [item.id, item]),
      ).values(),
    ];
    if (!regularItems.length || !addon.data.alive) return;
    const progress = new ztoolkit.ProgressWindow(
      getString("paper-info-update"),
    );
    progress.createLine({
      text: getString("requesting-citations-multiple", {
        args: { count: regularItems.length },
      }),
      type: "default",
      progress: 0,
    });
    progress.show();
    let unavailable = 0;
    for (let index = 0; index < regularItems.length; index++) {
      if (!addon.data.alive) break;
      const item = regularItems[index];
      try {
        let pending = this.pendingItems.get(item.id);
        if (!pending) {
          pending = this.updateItem(item);
          this.pendingItems.set(item.id, pending);
        }
        try {
          if (await pending) unavailable++;
        } finally {
          if (this.pendingItems.get(item.id) === pending)
            this.pendingItems.delete(item.id);
        }
      } catch (error) {
        unavailable++;
        ztoolkit.log("Item update failed", error);
      }
      progress.changeLine({
        idx: 0,
        progress: ((index + 1) / regularItems.length) * 100,
        text: `${index + 1} / ${regularItems.length}`,
      });
    }
    progress.changeLine({
      idx: 0,
      progress: 100,
      text: getString(unavailable ? "update-partial" : "update-complete", {
        args: { count: unavailable || regularItems.length },
      }),
    });
    progress.startCloseTimer(unavailable ? 8000 : 3000);
  }

  private static async updateItem(item: Zotero.Item): Promise<boolean> {
    let ccfInfo = "";
    let citationNumber = "";
    const title = item.getField("title");
    await PaperInfo.getPaperCCFRank(item, title, (_, data) => {
      ccfInfo = data.ccfInfo;
    });
    await PaperInfo.getPaperCitationNumber(item, title, (_, data) => {
      citationNumber = data.citationNumber;
    });
    if (!addon.data.alive || item.deleted) return true;
    await this.saveCCFInfoToNote(item, ccfInfo, citationNumber);
    return (
      /^(?:Error|Net Error|Not Found)/.test(ccfInfo) ||
      !/^\d+$/.test(citationNumber)
    );
  }

  static registerRightClickMenuItem(
    win: Window,
    toolkit: ZToolkit,
  ): () => void {
    const popup = win.document.getElementById(
      "zotero-itemmenu",
    ) as XUL.MenuPopup | null;
    if (!popup) return () => {};
    const id = "zotero-itemmenu-get-ccf-info";
    win.document.getElementById(id)?.remove();
    const pane = () =>
      (win as Window & { ZoteroPane: typeof ZoteroPane }).ZoteroPane;
    toolkit.Menu.register(popup, {
      tag: "menuitem",
      id,
      label: getString("get-ccf-info"),
      commandListener: () => {
        void this.handleGetCCFInfo(pane().getSelectedItems()).catch((error) =>
          ztoolkit.log("CCF update failed", error),
        );
      },
      icon: `chrome://${config.addonRef}/content/icons/favicon@0.5x.png`,
    });
    const onShowing = () => {
      const selected = pane().getSelectedItems();
      win.document
        .getElementById(id)
        ?.setAttribute(
          "hidden",
          String(
            !selected.some((item: Zotero.Item) => this.canUpdateItem(item)),
          ),
        );
    };
    popup.addEventListener("popupshowing", onShowing);
    return () => {
      popup.removeEventListener("popupshowing", onShowing);
      win.document.getElementById(id)?.remove();
    };
  }

  static registerNotifier() {
    if (this.notifierID) return;
    this.notifierID = Zotero.Notifier.registerObserver(
      {
        notify: (event, type, ids) => {
          if (addon.data.alive)
            void addon.hooks
              .onNotify(event, type, ids, {})
              .catch((error) => ztoolkit.log("CCF observer failed", error));
        },
      },
      ["item"],
    );
  }

  static async exampleNotifierCallback(items: Zotero.Item[]) {
    for (const item of items) this.addedItems.add(item.id);
    if (this.notifierTimer) clearTimeout(this.notifierTimer);
    this.notifierTimer = setTimeout(() => {
      this.notifierTimer = undefined;
      const ids = [...this.addedItems];
      this.addedItems.clear();
      if (!addon.data.alive) return;
      const entries = Zotero.Items.get(ids).filter(
        (item) => item && !item.deleted,
      );
      void this.handleGetCCFInfo(entries).catch((error) =>
        ztoolkit.log("Automatic CCF update failed", error),
      );
    }, 10000);
  }

  static unregisterApplicationResources() {
    if (this.notifierID) Zotero.Notifier.unregisterObserver(this.notifierID);
    this.notifierID = undefined;
    if (this.notifierTimer) clearTimeout(this.notifierTimer);
    this.notifierTimer = undefined;
    this.addedItems.clear();
    if (typeof Zotero.ItemTreeManager.unregisterColumn === "function") {
      for (const key of this.columnKeys)
        Zotero.ItemTreeManager.unregisterColumn(key);
    } else if (this.columnKeys.length) {
      void Zotero.ItemTreeManager.unregisterColumns(this.columnKeys);
    }
    this.columnKeys = [];
  }
}
