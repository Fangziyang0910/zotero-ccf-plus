import test from "node:test";
import assert from "node:assert/strict";
import { loadModule } from "./load-module.mjs";

async function fixture() {
  const notes = new Map();
  let nextID = 1;
  const parent = { id: 10, libraryID: 1, getNotes: () => [...notes.keys()] };
  class Note {
    setNote(value) {
      this.content = value;
    }
    getNote() {
      return this.content;
    }
    getNoteTitle() {
      return "CCF Info & Citations";
    }
    async saveTx() {
      await new Promise((resolve) => setImmediate(resolve));
      this.id ||= nextID++;
      notes.set(this.id, this);
    }
  }
  const { ExampleFactory } = await loadModule(
    'export { ExampleFactory } from "./src/modules/examples";',
    {
      Zotero: {
        Item: Note,
        Items: { get: (id) => notes.get(id) },
        Notifier: { trigger() {} },
        getActiveZoteroPane: () => null,
      },
    },
  );
  return { ExampleFactory, parent, notes };
}

test("overlapping updates create one note and retain both fields", async () => {
  const { ExampleFactory: factory, parent, notes } = await fixture();
  await Promise.all([
    factory.saveCCFInfoToNote(parent, "CCF-A NeurIPS"),
    factory.saveCCFInfoToNote(parent, undefined, "42"),
  ]);
  assert.equal(notes.size, 1);
  const data = factory.getCCFInfoFromNote(parent);
  assert.equal(data.ccfInfo, "CCF-A NeurIPS");
  assert.equal(data.citationNumber, "42");
});

test("failed refresh preserves the last successful rating and citation count", async () => {
  const { ExampleFactory: factory, parent } = await fixture();
  await factory.saveCCFInfoToNote(parent, "CCF-A NeurIPS", "42");
  await factory.saveCCFInfoToNote(parent, "Net Error: 0", "Error: 429");
  const data = factory.getCCFInfoFromNote(parent);
  assert.equal(data.ccfInfo, "CCF-A NeurIPS");
  assert.equal(data.citationNumber, "42");
});
