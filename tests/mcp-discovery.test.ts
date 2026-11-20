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
  await assert.rejects(mcp.execute(call), preflightBlocked("definition_changed"));
  assert.equal(requests.filter((q) => q.method === "tools/call").length, 1);
});

const preflightBlocked = (kind: string) => (error: unknown) => {
  assert(error instanceof MCPFailure);
  assert.equal(error.diagnostic.kind, kind);
  assert.equal(error.diagnostic.stage, "revalidate");
  assert.equal(error.diagnostic.sideEffectsPossible, false);
  assert.match(error.message, /call was not executed/);
  return true;
};

test("MCP revalidation ignores nested object key order but preserves array order", async (t) => {
  let reordered = false;
  const choices = ["story", "bug"];
  const { mcp, requests } = await fixture(t, (q) => {
    if (q.method === "tools/list") {
      const scope = { type: "string", enum: choices }, limit = { type: "number" };
      return { tools: [{ ...tool, inputSchema: { type: "object", properties: reordered ? { limit, scope } : { scope, limit } } }] };
    }
    if (q.method === "tools/call") return { content: [{ type: "text", text: "ok" }] };
  });
  const describe = { op: "describe", server: "svc", tool: "lookup" }, call = { ...describe, op: "call" };
  await mcp.execute(describe);
  reordered = true;
  assert.equal((await mcp.execute(call)).content[0].text, "ok");
  choices.reverse();
  await assert.rejects(mcp.execute(call), preflightBlocked("definition_changed"));
  assert.equal(requests.filter((q) => q.method === "tools/call").length, 1);
});

test("MCP ignores only TAPD catalog order, not its contents or the rest of the definition", async (t) => {
  const a = "  - stories_get: 查询需求", b = "  - comments_get: 查询评论  ";
  const description = (rows: string[], footer = "返回参数结构。") =>
    ["请先确认所需工具。", "", "**所有可用工具：**", ...rows, "", `**返回内容**：${footer}`].join("\n");
  const describe = { op: "describe", server: "svc", tool: "lookup_tool_param_schema" }, call = { ...describe, op: "call" };
  const original = { ...tool, name: describe.tool, description: description([a, b]) };
  let remote = original;
  const { mcp, requests } = await fixture(t, (q) => {
    if (q.method === "tools/list") return { tools: [remote] };
    if (q.method === "tools/call") return { content: [{ type: "text", text: "ok" }] };
  });
  assert.equal((await mcp.execute(describe)).description, original.description);
  remote = { ...original, description: description([b, a]) };
  assert.equal((await mcp.execute(call)).content[0].text, "ok");
  for (const def of [
    { ...original, description: description([b, a + "和缺陷"]) },
    { ...original, description: description([b]) },
    { ...original, description: description([b, a], "返回完整数据。") },
    { ...original, description: description([b, a]), inputSchema: { ...tool.inputSchema, required: ["id"] } },
  ]) {
    remote = def;
    await assert.rejects(mcp.execute(call), preflightBlocked("definition_changed"));
  }
  const dup = a + "列表";
  remote = { ...original, description: description([a, dup]) };
  await mcp.execute(describe);
  remote = { ...original, description: description([dup, a]) };
  await assert.rejects(mcp.execute(call), preflightBlocked("definition_changed"));
  assert.equal(requests.filter((q) => q.method === "tools/call").length, 1);
});

test("MCP discovery to call needs no describe; refs bind the reviewed tool, definition and connection", async (t) => {
  let note = "Look up a book";
  const respond = (q: any) => {
    if (q.method === "tools/list") return { tools: [{ ...tool, description: note }, { ...tool, name: "other" }] };
    if (q.method === "tools/call") return { content: [{ type: "text", text: "ok" }] };
  };
  const { mcp, requests } = await fixture(t, respond);
  const list = { op: "list", server: "svc" }, call = { op: "call", server: "svc", tool: "lookup" };
  const [row] = (await mcp.execute(list)).tools;
  assert.deepEqual(row.definition.inputSchema, tool.inputSchema);
  assert.equal(row.definition.description, note);
  await assert.rejects(mcp.execute(call), /requires successful describe/); // Guessing without seeing the result is not enough.
  const reviewed = { ...call, definitionRef: row.definitionRef, arguments: { search: "novel" } };
  assert.equal((await mcp.execute(reviewed)).content[0].text, "ok");
  assert.deepEqual(requests.filter((q) => q.method.startsWith("tools/")).map((q) => q.method), ["tools/list", "tools/list", "tools/call"]);
  assert.deepEqual(requests.at(-1).params.arguments, { search: "novel" });
  await assert.rejects(mcp.execute(reviewed, true), /allowlist/);
  await assert.rejects(mcp.execute({ ...reviewed, tool: "other" }), preflightBlocked("definition_changed"));
  const other = await fixture(t, respond);
  await other.mcp.execute(list);
  await assert.rejects(other.mcp.execute(reviewed), preflightBlocked("definition_changed"));
  assert(!other.requests.some((q) => q.method === "tools/call"));
  note = `New scope ${credential}`;
  let nextRef: string | undefined;
  await assert.rejects(mcp.execute(reviewed), (error: unknown) => {
    preflightBlocked("definition_changed")(error);
    assert(error instanceof MCPFailure);
    assert(!JSON.stringify(error.diagnostic).includes(credential));
    assert.match(error.diagnostic.definition.description, /credential redacted/);
    nextRef = error.diagnostic.definitionRef;
    assert(nextRef && nextRef !== reviewed.definitionRef);
    return true;
  });
  assert.equal(requests.filter((q) => q.method === "tools/call").length, 1);
  await mcp.execute({ ...reviewed, definitionRef: nextRef });
  assert.equal(requests.filter((q) => q.method === "tools/call").length, 2);
});

test("MCP discovery keeps oversized rows as summaries and returns paged refs only with full definitions", async (t) => {
  const { mcp } = await fixture(t, (q) => q.method === "tools/list"
    ? { tools: [{ ...tool, name: "big", description: "x".repeat(16000) }, tool] }
    : q.method === "tools/call" ? { content: [] } : undefined);
  const list = { op: "list", server: "svc", limit: 1 }, first = await mcp.execute(list);
  assert(first.nextCursor && first.tools[0].name === "big");
  assert.equal(first.tools[0].definitionRef, undefined);
  assert.equal(first.tools[0].definition, undefined);
  await assert.rejects(mcp.execute({ op: "call", server: "svc", tool: "big" }), /requires successful describe/);
  const second = await mcp.execute({ ...list, cursor: first.nextCursor });
  assert.equal(second.moreAvailable, false);
  const row = second.tools[0];
  assert.equal(row.definition.name, "lookup");
  await mcp.execute({ op: "call", server: "svc", tool: row.name, definitionRef: row.definitionRef });
});

test("MCP tells missing tools apart from stale describe records and changed connections", async (t) => {
  let tools = [tool];
  let duringList: (() => void) | undefined;
  const { mcp, requests } = await fixture(t, (q) => {
    if (q.method === "tools/list") {
      duringList?.();
      return { tools };
    }
  });
  const describe = { op: "describe", server: "svc", tool: "lookup" }, call = { ...describe, op: "call" };
  await assert.rejects(mcp.execute({ ...describe, tool: "missing" }), /not found on this server.*op="list"/);
  await mcp.execute(describe);
  tools = [];
  await assert.rejects(mcp.execute(call), preflightBlocked("tool_not_found"));
  tools = [tool];
  duringList = () => { mcp.described.delete("svc"); };
  await assert.rejects(mcp.execute(call), preflightBlocked("describe_changed"));
  duringList = undefined;
  await mcp.execute(describe);
  const client = mcp.connections.get("svc")!;
  duringList = () => { mcp.connections.delete("svc"); };
  try {
    await assert.rejects(mcp.execute(call), preflightBlocked("connection_changed"));
  } finally {
    mcp.connections.set("svc", client);
  }
  assert(!requests.some((q) => q.method === "tools/call"));
});
