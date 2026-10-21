import test from "node:test";
import assert from "node:assert/strict";
import { loadModule } from "./load-module.mjs";

const entry = 'export { PaperInfo } from "./src/modules/getPaperInfo";';
const item = (fields = {}) => ({ getField: (name) => fields[name] || "" });
const tick = () => new Promise((resolve) => setImmediate(resolve));

test("HTTP errors produce exactly one citation result", async () => {
  const { PaperInfo } = await loadModule(entry, {
    fetch: async () => ({ ok: false, status: 429 }),
  });
  const results = [];
  await PaperInfo.getPaperCitationNumber(
    item(),
    "A unique paper title",
    (_, data) => results.push(data),
  );
  await tick();
  assert.equal(results.length, 1);
});

test("short unrelated titles cannot receive another paper's citation count", async () => {
  const { PaperInfo } = await loadModule(entry, {
    fetch: async () => ({
      ok: true,
      json: async () => ({ data: [{ title: "Dogs", citationCount: 987 }] }),
    }),
  });
  const results = [];
  await PaperInfo.getPaperCitationNumber(item(), "Cats", (_, data) =>
    results.push(data),
  );
  await tick();
  assert.equal(results.at(-1).citationNumber, "Not Found");
});

test("missing citation counts are unknown rather than zero", async () => {
  const { PaperInfo } = await loadModule(entry, {
    fetch: async () => ({
      ok: true,
      json: async () => ({ data: [{ title: "An exact title" }] }),
    }),
  });
  const results = [];
  await PaperInfo.getPaperCitationNumber(item(), "An exact title", (_, data) =>
    results.push(data),
  );
  await tick();
  assert.equal(results.at(-1).citationNumber, "Not Found");
});

test("local conference metadata is enough to resolve a rating without network", async () => {
  const { PaperInfo } = await loadModule(entry, {
    fetch: () => {
      throw new Error("network not needed");
    },
  });
  let result;
  await PaperInfo.getPaperCCFRank(
    item({ conferenceName: "NeurIPS" }),
    "A title",
    (_, data) => {
      result = data.ccfInfo;
    },
  );
  assert.equal(result, "CCF-A NeurIPS");
});

test("exact matches accept a real zero citation count and Unicode titles", async () => {
  const { PaperInfo } = await loadModule(entry, {
    fetch: async () => ({
      ok: true,
      json: async () => ({
        data: [{ title: "中文：图优化", citationCount: 0 }],
      }),
    }),
  });
  let value;
  await PaperInfo.getPaperCitationNumber(item(), "中文: 图优化", (_, data) => {
    value = data.citationNumber;
  });
  assert.equal(value, "0");
});

test("rank and citation lookups reuse a matched Semantic Scholar paper", async () => {
  let requests = 0;
  const { PaperInfo } = await loadModule(entry, {
    fetch: async () => {
      requests++;
      return {
        ok: true,
        json: async () => ({
          data: [
            { title: "An exact title", venue: "NeurIPS", citationCount: 42 },
          ],
        }),
      };
    },
  });
  let rank, count;
  await PaperInfo.getPaperCCFRank(item(), "An exact title", (_, data) => {
    rank = data.ccfInfo;
  });
  await PaperInfo.getPaperCitationNumber(
    item(),
    "An exact title",
    (_, data) => {
      count = data.citationNumber;
    },
  );
  assert.equal(rank, "CCF-A NeurIPS");
  assert.equal(count, "42");
  assert.equal(requests, 1);
});

test("DBLP fallback survives a Semantic Scholar outage and malformed response", async () => {
  const { PaperInfo } = await loadModule(entry, {
    fetch: async (url) =>
      url.includes("semanticscholar")
        ? { ok: false, status: 429 }
        : {
            ok: true,
            json: async () => {
              throw new SyntaxError("invalid JSON");
            },
          },
  });
  const results = [];
  await PaperInfo.getPaperCCFRank(item(), "An exact title", (_, data) =>
    results.push(data.ccfInfo),
  );
  assert.equal(results.length, 1);
  assert.match(results[0], /^Error/);
});

test("DBLP fallback resolves the publication when Semantic Scholar is rate limited", async () => {
  const { PaperInfo } = await loadModule(entry, {
    fetch: async (url) =>
      url.includes("semanticscholar")
        ? { ok: false, status: 429 }
        : {
            ok: true,
            json: async () => ({
              urls: [
                {
                  title: "attentionisallyouneed",
                  url: "conf/nips/VaswaniSPUJGKP17",
                },
              ],
            }),
          },
  });
  let result;
  await PaperInfo.getPaperCCFRank(
    item(),
    "Attention Is All You Need",
    (_, data) => {
      result = data.ccfInfo;
    },
  );
  assert.equal(result, "CCF-A NeurIPS");
});

test("batch callbacks preserve input order and await completion", async () => {
  const { PaperInfo } = await loadModule(entry);
  let completed = false;
  await PaperInfo.batchGetPaperCCFRank(
    [item({ conferenceName: "NeurIPS" }), item({ conferenceName: "ICML" })],
    ["one", "two"],
    async (_, data) => {
      await tick();
      assert.equal(data[0].ccfInfo, "CCF-A NeurIPS");
      assert.equal(data[1].ccfInfo, "CCF-A ICML");
      completed = true;
    },
  );
  assert.equal(completed, true);
});
