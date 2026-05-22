import { config } from "../../package.json";
import { getLocaleID, getString } from "../utils/locale";
import { PaperInfo } from "./getPaperInfo";

// Note标题常量
const CCF_INFO_NOTE_TITLE = "CCF Info & Citations";

// 数据接口
interface CCFInfoData {
  ccfInfo: string;
  citationNumber: string;
}

export class ExampleFactory {
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
      const finalCcfInfo =
        ccfInfo !== undefined && ccfInfo !== ""
          ? ccfInfo
          : existingData.ccfInfo;
      const finalCitationNumber =
        citationNumber !== undefined && citationNumber !== ""
          ? citationNumber
          : existingData.citationNumber;

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

      // 等待一小段时间确保保存完成
      await new Promise((resolve) => setTimeout(resolve, 100));

      // 刷新列显示
      ExampleFactory.refreshItemTreeRow(item);
    } catch (error) {
      ztoolkit.log("Error saving CCF info to note:", error);
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
    await Zotero.ItemTreeManager.registerColumns([
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
  }

  public static async handleGetCCFInfo(items: Zotero.Item[]) {
    if (!items || items.length === 0) return;
    ztoolkit.log("handleGetCCFInfo", items);
    if (items.length === 1) {
      await ExampleFactory.handleSingleItem(items[0]);
    } else {
      await ExampleFactory.handleMultipleItems(items);
    }
  }

  private static async handleSingleItem(entry: Zotero.Item) {
    const progressWindow = new ztoolkit.ProgressWindow(
      getString("paper-info-update"),
      {
        closeOtherProgressWindows: true,
      },
    );
    progressWindow.createLine({
      text: getString("requesting-citation-single"),
      type: "default",
    });
    progressWindow.show();
    progressWindow.startCloseTimer(2000);

    // Get new CCF rank and citation number
    PaperInfo.getPaperCCFRank(
      entry,
      entry.getField("title"),
      async (item, data) => {
        await ExampleFactory.saveCCFInfoToNote(item, data.ccfInfo);
        ExampleFactory.updateCitationNumber(entry, 1);
      },
    );
  }

  private static async handleMultipleItems(items: Zotero.Item[]) {
    const progressWindow = new ztoolkit.ProgressWindow(
      getString("paper-info-update"),
      {
        closeOtherProgressWindows: true,
      },
    );
    progressWindow.createLine({
      text: getString("requesting-citations-multiple", {
        args: { count: items.length },
      }),
      type: "default",
    });
    progressWindow.show();
    progressWindow.startCloseTimer(2000);

    const titles = items.map((item) => item.getField("title"));
    PaperInfo.batchGetPaperCCFRank(items, titles, async (items, data) => {
      if (data.length === items.length) {
        for (let index = 0; index < items.length; index++) {
          const entry = items[index];
          await ExampleFactory.saveCCFInfoToNote(entry, data[index].ccfInfo);
          ExampleFactory.updateCitationNumber(entry, index, items.length);
        }
      } else {
        for (let index = 0; index < items.length; index++) {
          const entry = items[index];
          await ExampleFactory.saveCCFInfoToNote(entry, data.ccfInfo);
          ExampleFactory.updateCitationNumber(entry, items.length, index);
        }
      }
    });
  }

  private static async updateCitationNumber(
    entry: Zotero.Item,
    index?: number,
    total?: number,
  ) {
    PaperInfo.getPaperCitationNumber(
      entry,
      entry.getField("title"),
      async (item, data) => {
        await ExampleFactory.saveCCFInfoToNote(
          item,
          undefined,
          data.citationNumber,
        );
      },
    );
  }

  static registerRightClickMenuItem() {
    const menuIcon = `chrome://${config.addonRef}/content/icons/favicon@0.5x.png`;
    ztoolkit.Menu.register("item", {
      tag: "menuitem",
      id: "zotero-itemmenu-get-ccf-info",
      label: getString("get-ccf-info"),
      commandListener: (ev) => {
        const items = ZoteroPane.getSelectedItems();
        ExampleFactory.handleGetCCFInfo(items);
      },
      icon: menuIcon,
    });
  }

  static registerNotifier() {
    const callback = {
      notify: async (
        event: string,
        type: string,
        ids: Array<string | number>,
        extraData: { [key: string]: any },
      ) => {
        if (!addon?.data.alive) {
          this.unregisterNotifier(notifierID);
          return;
        }
        addon.hooks.onNotify(event, type, ids, extraData);
      },
    };

    const notifierID = Zotero.Notifier.registerObserver(callback, ["item"]);

    // Unregister callback when the window closes (important to avoid a memory leak)
    window.addEventListener(
      "unload",
      (e: Event) => {
        this.unregisterNotifier(notifierID);
      },
      false,
    );
  }

  static async exampleNotifierCallback(regularItems: any) {
    // 等待 10s 以防止 Zotero 未完成条目添加
    await new Promise((resolve) => setTimeout(resolve, 10000));
    await ExampleFactory.handleGetCCFInfo(regularItems);
  }

  private static unregisterNotifier(notifierID: string) {
    Zotero.Notifier.unregisterObserver(notifierID);
  }
}
