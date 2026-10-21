import test from "node:test";
import assert from "node:assert/strict";
import { loadModule } from "./load-module.mjs";

const entry = 'export * from "./src/modules/requests";';
test("429 cooldown avoids repeatedly hitting a rate-limited service", async () => {
  let calls = 0;
  const { requestJSON } = await loadModule(entry, {
    fetch: async () => {
      calls++;
      return { ok: false, status: 429 };
    },
  });
  await assert.rejects(
    requestJSON("https://api.semanticscholar.org/one"),
    /429/,
  );
  await assert.rejects(
    requestJSON("https://api.semanticscholar.org/two"),
    /429/,
  );
  assert.equal(calls, 1);
});

test("timeout aborts a stalled request", async () => {
  let aborted = false;
  const { requestJSON } = await loadModule(entry, {
    setTimeout: (callback, ms) => setTimeout(callback, ms === 15000 ? 0 : ms),
    fetch: (_, { signal }) =>
      new Promise((_, reject) =>
        signal.addEventListener("abort", () => {
          aborted = true;
          reject(new Error("aborted"));
        }),
      ),
  });
  await assert.rejects(
    requestJSON("https://dblp.timetrap.workers.dev/"),
    /aborted/,
  );
  assert.equal(aborted, true);
});

test("shutdown aborts in-flight requests and rejects later requests", async () => {
  const { requestJSON, stopRequests } = await loadModule(entry, {
    fetch: (_, { signal }) =>
      new Promise((_, reject) =>
        signal.addEventListener("abort", () => reject(new Error("aborted"))),
      ),
  });
  const request = requestJSON("https://dblp.timetrap.workers.dev/");
  stopRequests();
  await assert.rejects(request, /aborted/);
  await assert.rejects(
    requestJSON("https://dblp.timetrap.workers.dev/"),
    /Cancelled/,
  );
});
