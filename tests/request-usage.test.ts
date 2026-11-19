import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { estimateCost, modelPriceIndex } from "../server/core/model-prices";
import { reportedCost, usageCounts, type RequestUsage } from "../server/core/request-usage";
import { Providers } from "../server/core/provider";
import { resolveModel } from "../server/core/config";
import { Store } from "../server/core/store";
import { Engine } from "../server/core/engine";
import { Catalog } from "../server/core/catalog";
import { Subscriptions } from "../server/core/subscriptions";
import { Chrome } from "../server/core/chrome";
import { ChromeBridge } from "../server/core/chrome-bridge";

const pricing = { owner: { models: { "model-v1": { canonical_model_id: "owner/model-v1", cost: { input: 2, output: 4, cache_read: 0.5, cache_write: 3,
  tiers: [{ tier: { type: "context", size: 200000 }, input: 8, output: 12, cache_read: 1, cache_write: 5 }],
} } } }, reseller: { models: { "reseller-alias": { canonical_model_id: "owner/model-v1", cost: { input: 30, output: 40 } } } } };
const raw = { prompt_tokens: 200, completion_tokens: 10, prompt_tokens_details: { cached_tokens: 100, cache_write_tokens: 50 }, total_tokens: 210 };
const cfg = (url: string, api = "openai-completions") => ({ model: "gateway/alias", scenes: { lightweight: ["gateway/alias"] },
  provider: { gateway: { api, baseURL: url, models: { alias: { localModel: "reseller-alias", limit: { context: 400000, output: 8192 } } } } } });
const done = (usage: unknown, model = "owner/model-v1") => ({ model, usage, choices: [{ finish_reason: "stop", message: { content: "ok" } }] });
const frame = (value: any) => "data: " + JSON.stringify(value) + "\n\n";
const dollars = (nanos: number) => nanos / 1e9;
const scope = { userId: "alice", session: "session" };
async function fixture(t: TestContext, route: (a: any, res: ServerResponse, req: IncomingMessage) => void) {
  const server = createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk);
    route(JSON.parse(Buffer.concat(chunks).toString()), res, req);
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => {
    server.closeAllConnections();
    return new Promise<void>((resolve) => server.close(() => resolve()));
  });
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}
const json = (res: ServerResponse, data: any, status = 200) => res.writeHead(status, { "Content-Type": "application/json" }).end(JSON.stringify(data));

test("official model IDs take precedence over channel prices and estimates apply per-request tariffs", () => {
  const lookup = modelPriceIndex(pricing);
  assert.equal(lookup("RESELLER-ALIAS-fast")?.input, 2);
  assert.equal(lookup("owner/model-v1-1017"), undefined, "never discard dated model IDs");
  assert.equal(lookup("unknown"), undefined);
  const conflict = modelPriceIndex({ a: { models: { x: { cost: { input: 2 } } } }, b: { models: { x: { cost: { input: 3 } } } } });
  assert.equal(conflict("x"), undefined);
  assert.deepEqual(usageCounts("openai-completions", raw), { input: 50, output: 10, cacheRead: 100, cacheWrite: 50, total: 210, reasoningTokens: undefined });
  assert.equal(estimateCost(lookup("owner/model-v1"), usageCounts("openai-completions", raw)), 340000);
  assert.equal(estimateCost(lookup("owner/model-v1"), { input: 200001, output: 100 }), 1601208000);
  assert.equal(estimateCost({ input: 1, output: 2, reasoning: 3 }, { input: 100, output: 10 }), undefined);
  assert.equal(estimateCost({ input: 1, output: 2, reasoning: 3 }, { input: 100, output: 10, reasoningTokens: 4 }), 124000);
  assert.equal(estimateCost({ input: 1, output: 2 }, { input: 100, output: 10, cacheRead: 5 }), undefined);
  assert.equal(reportedCost("https://openrouter.ai", { cost: 0 }), 0);
  assert.equal(reportedCost("https://openrouter.ai", { cost: 0.00215 }), 2150000);
  assert.equal(reportedCost("https://openrouter.ai", { cost: 0.00215, is_byok: true }), undefined);
  assert.equal(reportedCost("https://compatible.test", { cost: 0.00215 }), undefined);
});

test("Responses re-send without continuation settles two distinct attempts, even when the first has usage", async (t) => {
  const rows: RequestUsage[] = [], p = new Providers();
  p.onRequestUsage = async (row) => { rows.push(row); };
  let called = 0;
  const url = await fixture(t, (body, res) => {
    called++;
    if (called === 2) {
      assert.equal(body.previous_response_id, "r1");
      json(res, { usage: { input_tokens: 11, output_tokens: 0 }, error: { message: "previous response missing" } }, 404);
    } else {
      assert.equal(body.previous_response_id, undefined);
      res.writeHead(200, { "Content-Type": "text/event-stream" }).end(frame({ type: "response.completed", response: {
        status: "completed", id: "r" + called, model: "owner/model-v1", usage: { input_tokens: 7, output_tokens: 3 }, output: [{ content: [{ type: "output_text", text: "ok" }] }],
      } }));
    }
  });
  const model = resolveModel(cfg(url, "openai-responses"));
  const input = { role: "user", text: "one" };
  const chat = (messages: any[]) => p.chat(model, "sys", messages, [], AbortSignal.timeout(5000), undefined, scope.session, undefined, false, scope);
  const reply = await chat([input]);
  await chat([input, reply, { role: "user", text: "two" }]);
  assert.equal(rows.length, called);
  assert.equal(new Set(rows.map((row) => row.requestId)).size, 3);
  assert.deepEqual(rows.map((row) => [row.outcome, row.status, row.usageComplete, row.input]), [["completed", 200, true, 7], ["failed", 404, true, 11], ["completed", 200, true, 7]]);
});

test("interrupted streams retain partial counts without inventing fees; already aborted calls are not metered", async (t) => {
  const rows: RequestUsage[] = [], p = new Providers(), stop = new AbortController();
  p.onRequestUsage = async (row) => { rows.push(row); };
  let requests = 0;
  const url = await fixture(t, (_body, res) => {
    requests++;
    res.writeHead(200, { "Content-Type": "text/event-stream" });
    res.write(frame({ model: "owner/model-v1", usage: { prompt_tokens: 200 }, choices: [{ delta: { content: "partial" } }] }));
  });
  const m = resolveModel(cfg(url));
  await assert.rejects(p.chat(m, "sys", [], [], stop.signal, (event) => { if (event === "text_delta") stop.abort(Error("user stop")); }, "", undefined, false, scope), /user stop/);
  await assert.rejects(p.chat(m, "sys", [], [], stop.signal, undefined, "", undefined, false, scope), /user stop/);
  assert.equal(requests, 1);
  assert.equal(rows.length, 1);
  assert.deepEqual([rows[0].outcome, rows[0].usageComplete, rows[0].input, rows[0].output, rows[0].reportedNanos], ["interrupted", false, 200, undefined, undefined]);
});

test("real Engine requests, including failed retry and Stages, are totalled once under the session owner", async (t) => {
  let requests = 0;
  const url = await fixture(t, (_body, res) => {
    requests++;
    if (requests === 1) return json(res, { error: { message: "please retry" } }, 429);
    json(res, done(raw));
  });
  const store = await Store.open(":memory:");
  await store.put("config", cfg(url));
  await store.put("models.dev", { at: Date.now(), data: pricing });
  const engine = await Engine.create(store, new Catalog(store, new Subscriptions(store, "")), new Chrome(store, new ChromeBridge(), ""));
  engine.employee.closed = true;
  t.after(async () => { await engine.close(); await store.close(); });
  const first = await store.newSession({ ownerId: "alice" });
  const stage = await store.stage(first.id);
  await engine.run(first.id, { role: "user", text: "answer" });
  await engine.run(stage.id, { role: "user", text: "answer in stage" });
  assert.equal(requests, 3);
  const rows = (await store.all("SELECT data FROM token_usage ORDER BY id")).map((row) => JSON.parse(row.data));
  assert.deepEqual(rows.map((row) => [row.session, row.outcome, row.modelId]), [[first.id, "failed", "reseller-alias"], [first.id, "completed", "owner/model-v1"], [stage.id, "completed", "owner/model-v1"]]);
  assert.equal(new Set(rows.map((row) => row.requestId)).size, 3);
  await store.recordTokenUsage({ ...rows[2], requestId: "separate-reported-request", at: rows[2].at + 10000, estimatedNanos: undefined, reportedNanos: 0 });
  await store.recordTokenUsage({ ...rows[2], userId: "bob", requestId: "other-account", estimatedNanos: undefined, reportedNanos: 950000 });
  const summary = await store.tokenUsageSummary({ userId: "alice" });
  assert.equal(summary.n, 4);
  assert.equal(summary.total, 630);
  assert.deepEqual(summary.cost, { reportedUsd: 0, estimatedUsd: dollars(680000), unknown: 1, missingUsage: 1 });
  assert.deepEqual((await store.tokenUsageTasks({ userId: "alice" })).tasks[0].cost, summary.cost);
  assert.deepEqual((await store.tokenUsageSummary({ userId: "alice", from: rows[2].at + 9999 })).cost, { reportedUsd: 0, estimatedUsd: null, unknown: 0, missingUsage: 0 });
});
