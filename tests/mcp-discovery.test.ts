import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { MCP, MCPFailure } from "../server/core/mcp";

const tool = { name: "lookup", inputSchema: { type: "object" } };
const credential = "test-only-literal-auth";
const querySecret = "test-only-url-param";
const envSecret = "test-only-expanded-env";
async function fixture(t: import("node:test").TestContext, respond: (q: any) => any, envHeader = false) {
  const requests: any[] = [];
  const server = createServer(async (req, res) => {
    if (req.method !== "POST") { res.writeHead(405).end(); return; }
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk);
    const q = JSON.parse(Buffer.concat(chunks).toString());
    requests.push(q);
    if (q.id === undefined) { res.writeHead(202).end(); return; }
    const result = respond(q) ?? (q.method === "initialize" ? {
      protocolVersion: "2025-03-26", capabilities: { tools: {} }, serverInfo: { name: "fixture", version: "1" },
    } : { tools: [tool] });
    if (result === "disconnect") { res.destroy(); return; }
    if (typeof result === "number") { res.writeHead(result).end(`raw error echo ${credential} ${req.url}`); return; }
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ jsonrpc: "2.0", id: q.id, result }));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/mcp?token=${querySecret}`;
  const mcp = new MCP({ svc: { url, headers: { Authorization: `Bearer ${credential}`, ...(envHeader ? { "x-extra": "prefix-{env:VEGA_TEST_MCP_TOKEN}" } : {}) }, requestTimeoutMs: 1500 } }, process.cwd());
  t.after(async () => { await mcp.close(); server.closeAllConnections(); await new Promise<void>((resolve) => server.close(() => resolve())); });
  return { mcp, requests };
}

test("MCP retries a transient first discovery only once and returns safe diagnostics", async (t) => {
  let lists = 0;
  const { mcp, requests } = await fixture(t, (q) => q.method === "tools/list" && ++lists <= 2 ? (lists === 1 ? "disconnect" : 503) : undefined);
  await assert.rejects(mcp.execute({ op: "list", server: "svc" }), (error: MCPFailure) => {
    assert(error instanceof MCPFailure);
    assert.equal(error.diagnostic.attempts, 2);
    assert.equal(error.diagnostic.stage, "list");
    assert.equal(error.diagnostic.status, 503);
    assert(!error.message.includes(credential) && !error.message.includes(querySecret));
    return true;
  });
  assert.equal(requests.filter((q) => q.method === "initialize").length, 2);
  assert.equal(lists, 2);
});

test("MCP never replays pagination, the call preflight, or a call with an unknown outcome", async (t) => {
  let fail: "next" | "preflight" | "call" | undefined;
  const { mcp, requests } = await fixture(t, (q) => {
    if (q.method === "tools/list") return q.params?.cursor || fail === "preflight" ? 503 : { tools: [tool], nextCursor: "remote-page" };
    if (q.method === "tools/call" && fail === "call") return 503;
  });
  const list = { op: "list", server: "svc" }, describe = { op: "describe", server: "svc", tool: "lookup" }, call = { ...describe, op: "call" };
  const first = await mcp.execute(list);
  await mcp.execute(describe);
  fail = "next";
  await assert.rejects(mcp.execute({ ...list, cursor: first.nextCursor }), (e: MCPFailure) => e.diagnostic?.attempts === 1);
  await assert.rejects(mcp.execute({ ...list, cursor: first.nextCursor }), /expired MCP discovery cursor/);
  await assert.rejects(mcp.execute(call), /requires successful describe/);
  fail = undefined;
  await mcp.execute(describe);
  fail = "preflight";
  await assert.rejects(mcp.execute(call), (e: MCPFailure) => e.diagnostic?.attempts === 1 && !e.diagnostic.sideEffectsPossible);
  assert(!requests.some((q) => q.method === "tools/call"));
  fail = undefined;
  await mcp.execute(describe);
  fail = "call";
  await assert.rejects(mcp.execute(call), (error: MCPFailure) => error.diagnostic?.attempts === 1 && error.diagnostic.sideEffectsPossible && /may have executed/.test(error.message));
  assert.equal(requests.filter((q) => q.method === "tools/call").length, 1);
  assert.equal(requests.filter((q) => q.params?.cursor === "remote-page").length, 1);
});

test("MCP redacts literal and expanded secrets, but revalidates the original schema", async (t) => {
  const previous = process.env.VEGA_TEST_MCP_TOKEN;
  process.env.VEGA_TEST_MCP_TOKEN = envSecret;
  t.after(() => { if (previous === undefined) delete process.env.VEGA_TEST_MCP_TOKEN; else process.env.VEGA_TEST_MCP_TOKEN = previous; });
  let echo = credential;
  const { mcp, requests } = await fixture(t, (q) => {
    if (q.method === "tools/list") return { tools: [{ ...tool, description: echo + " " + envSecret }] };
    if (q.method === "tools/call") return { content: [{ type: "text", text: `Bearer ${credential} ${envSecret} ${querySecret}` }], structuredContent: { echoed: envSecret } };
  }, true);
  const describe = { op: "describe", server: "svc", tool: "lookup" }, call = { ...describe, op: "call" };
  for (const result of [await mcp.execute({ op: "list", server: "svc" }), await mcp.execute(describe), await mcp.execute(call)]) {
    const json = JSON.stringify(result);
    assert(!json.includes(credential) && !json.includes(envSecret) && !json.includes(querySecret));
    assert.match(json, /credential redacted/);
  }
  echo = `Bearer ${credential}`; // Same public masked description, different raw definition.
  await assert.rejects(mcp.execute(call), /definition or connection changed/);
  assert.equal(requests.filter((q) => q.method === "tools/call").length, 1);
});
