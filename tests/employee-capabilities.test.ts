import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:http";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { zipSync, strToU8 } from "fflate";
import { Store } from "../server/core/store";
import { Engine } from "../server/core/engine";
import { Catalog } from "../server/core/catalog";
import { Subscriptions } from "../server/core/subscriptions";
import { Chrome } from "../server/core/chrome";
import { ChromeBridge } from "../server/core/chrome-bridge";
import { Tools } from "../server/core/tools";
import { employeeCapabilities, migrateEmployeeCapabilities } from "../server/core/employee-capabilities";
import { loadSkills } from "../server/core/prompt";
import { skillKind } from "../server/core/skills";

const alice = { id: "alice", role: "operator" }, bob = { id: "bob", role: "operator" }, admin = { id: "admin", role: "admin" }, viewer = { id: "reader", role: "viewer" };
async function fixture() {
  const store = await Store.open(":memory:");
  const engine = await Engine.create(store, new Catalog(store, new Subscriptions(store, "")), new Chrome(store, new ChromeBridge(), ""));
  engine.employee.closed = true;
  const a = await engine.employee.for((await engine.employee.create({ name: "A" }, alice.id)).id);
  const b = await engine.employee.for((await engine.employee.create({ name: "B" }, bob.id)).id);
  return { store, engine, a, b };
}
function bundle(text: string, name = "same-name") {
  return { filename: "skill.zip", content: Buffer.from(zipSync({ "SKILL.md": strToU8(`---\nname: ${name}\ndescription: private-${text}\n---\n${text}`), "references/guide.txt": strToU8("private-reference-" + text) })).toString("base64") };
}
const denied = (error: any) => error.statusCode === 403;

test("only the creator can edit or read details, including when the other user is an administrator", async () => {
  const { store, engine, a } = await fixture();
  try {
    await employeeCapabilities(a, alice, "PUT", ["mcp"], { mcp: { shared: { url: "https://private.example/mcp", headers: { Authorization: "private-token" } } } });
    await employeeCapabilities(a, alice, "POST", ["skills", "upload"], bundle("private-instructions"));
    // Employees are private to their owner: nobody else sees them, administrators included.
    for (const user of [bob, viewer, admin]) await assert.rejects(employeeCapabilities(a, user, "GET", ["capabilities"]), (error: any) => error.statusCode === 404);
    const owner: any = await employeeCapabilities(a, alice, "GET", ["capabilities"]);
    assert.equal(owner.canEdit, true);
    assert.equal(owner.mcp[0].config.url, "https://private.example/mcp");
    assert.equal(owner.mcp[0].config.headers.Authorization, "__stored_secret__");
    assert.match((await employeeCapabilities(a, alice, "GET", ["skills", "same-name"]) as any).content, /private-instructions/);
    await employeeCapabilities(a, alice, "PUT", ["mcp"], { mcp: { shared: owner.mcp[0].config } });
    assert.equal((await store.object<any>("employee-capabilities", a.employeeId)).mcp.shared.headers.Authorization, "private-token");
    await assert.rejects(employeeCapabilities(a, { ...alice, role: "viewer" }, "PUT", ["mcp"], { mcp: {} }), denied);
    assert(!JSON.stringify(await a.state()).includes("private-instructions"), "employee state and its normal API response contain no capability details");
  } finally { await engine.close(); await store.close(); }
});

test("same-named skills and MCP configurations are independent and execution never inherits other bots or global discovery", async () => {
  const { store, engine, a, b } = await fixture();
  const directory = await mkdtemp(join(tmpdir(), "vega-owned-skills-"));
  const previous = process.env.VEGA_SKILL_CACHE;
  process.env.VEGA_SKILL_CACHE = directory;
  try {
    for (const [employee, user, content] of [[a, alice, "alpha"], [b, bob, "beta"]] as const) {
      await employeeCapabilities(employee, user, "POST", ["skills", "upload"], bundle(content));
      await employeeCapabilities(employee, user, "PUT", ["mcp"], { mcp: { service: { url: `https://${content}.example/mcp` } } });
    }
    const sa = await store.newSession({ employeeId: a.employeeId, cwd: directory }), sb = await store.newSession({ employeeId: b.employeeId, cwd: directory });
    const ca = await engine.config(sa), cb = await engine.config(sb);
    assert.equal(ca.mcp!.service.url, "https://alpha.example/mcp");
    assert.equal(cb.mcp!.service.url, "https://beta.example/mcp");
    const installedA = await loadSkills(ca, store, directory), installedB = await loadSkills(cb, store, directory);
    assert.equal(installedA.length, 1); assert.equal(installedB.length, 1);
    assert.equal(installedA[0].resourceRoot, undefined);
    assert.equal(installedB[0].resourceRoot, undefined);
    assert.equal(installedA[0].path, "sqlite:skill/same-name");
    const toolsA = await Tools.create(engine, sa, ca, new AbortController().signal, () => {});
    const read = await toolsA.read({ path: "sqlite:skill/same-name" });
    const toolsB = await Tools.create(engine, sb, cb, new AbortController().signal, () => {});
    const otherRead = await toolsB.read({ path: "sqlite:skill/same-name" });
    assert.notEqual(JSON.parse(read.secret!).resourceRoot, JSON.parse(otherRead.secret!).resourceRoot);
    assert.match(JSON.parse(read.secret!).content, /alpha/);
    assert(!JSON.stringify(read.value).includes("alpha"), "shared tool records must not reveal private skill content");
    await assert.rejects(toolsA.read({ path: `sqlite:skill/${b.employeeId}:same-name` }), /Skill not found/);
    const oldClient = await engine.mcpFor(sa, ca), otherClient = await engine.mcpFor(sb, cb);
    await employeeCapabilities(a, alice, "PUT", ["mcp"], { mcp: {} });
    assert.notEqual(await engine.mcpFor(sa, ca), oldClient, "runtime refreshes changed MCP settings even with an older turn config");
    assert.equal(await engine.mcpFor(sb, cb), otherClient);
    await employeeCapabilities(a, alice, "POST", ["skills", "upload"], { ...bundle("updated"), replace: true });
    assert.match((await store.object<any>(skillKind(a.employeeId), "same-name")).content, /updated/);
    assert.match((await store.object<any>(skillKind(b.employeeId), "same-name")).content, /beta/);
    await employeeCapabilities(a, alice, "DELETE", ["skills", "same-name"]);
    assert.equal((await loadSkills(await engine.config(sa), store, directory)).length, 0);
    assert.equal((await loadSkills(await engine.config(sb), store, directory)).length, 1);
    const empty = await engine.employee.for((await engine.employee.create({ name: "Empty" }, alice.id)).id);
    const fresh = await engine.config(await store.newSession({ employeeId: empty.employeeId, cwd: directory }));
    assert.deepEqual(fresh.mcp, {}); assert.deepEqual(await loadSkills(fresh, store, directory), []);
    await assert.rejects(engine.saveConfig({ model: "", provider: {}, mcp: { shared: { command: "node" } } }), /各位热心市民/);
  } finally {
    await engine.close(); await store.close();
    if (previous === undefined) delete process.env.VEGA_SKILL_CACHE; else process.env.VEGA_SKILL_CACHE = previous;
    await rm(directory, { recursive: true, force: true });
  }
});

test("legacy global configuration migrates only to the default employee and never reappears after deletion", async () => {
  const store = await Store.open(":memory:");
  try {
    await store.put("config", { model: "", provider: {}, mcp: { legacy: { command: "node" } } });
    await store.save("skill", "legacy", { id: "legacy", name: "legacy", content: "old instructions" });
    await migrateEmployeeCapabilities(store);
    assert.equal((await store.object<any>("employee-capabilities", "default")).mcp.legacy.command, "node");
    assert.equal((await store.object<any>(skillKind("default"), "legacy")).content, "old instructions");
    assert.equal((await store.objects("skill")).length, 0);
    assert.equal((await store.get<any>("config", {})).mcp, undefined);
    await store.remove("employee-capabilities", "default");
    await store.remove(skillKind("default"), "legacy");
    await migrateEmployeeCapabilities(store);
    assert.equal(await store.object("employee-capabilities", "default"), undefined);
  } finally { await store.close(); }
});

test("built-in legacy employee binds its configuration to the original administrator, not every administrator", async () => {
  const { store, engine } = await fixture();
  try {
    const insert = "INSERT INTO web_users(id,username,password,role,createdAt) VALUES(?,?,?,?,?)";
    await store.run(insert, "first-admin", "first-admin", "unused", "admin", 1);
    await store.run(insert, "second-admin", "second-admin", "unused", "admin", 2);
    const root = engine.employee;
    assert.equal((await root.state()).ownerId, "first-admin");
    await employeeCapabilities(root, { id: "first-admin", role: "admin" }, "PUT", ["mcp"], { mcp: { service: { command: "node" } } });
    await assert.rejects(employeeCapabilities(root, { id: "second-admin", role: "admin" }, "PUT", ["mcp"], { mcp: {} }), (error: any) => error.statusCode === 404);
    const personal = await engine.employee.for((await engine.employee.create({ name: "Personal" }, alice.id)).id);
    await assert.rejects(employeeCapabilities(personal, bob, "GET", ["capabilities"]), (error: any) => error.statusCode === 404);
  } finally { await engine.close(); await store.close(); }
});

test("a task dispatched from an existing chat uses the newly saved MCP endpoint and headers", async () => {
  const { store, engine, a } = await fixture();
  const hits: string[] = [];
  const secret = "test-rotated-mcp-auth";
  const server = createServer(async (req, res) => {
    if (req.method !== "POST") { res.writeHead(405).end(); return; }
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk);
    const q = JSON.parse(Buffer.concat(chunks).toString());
    hits.push(`${req.url} ${q.method} ${req.headers.authorization === "Bearer " + secret ? "new header" : "other header"}`);
    if (q.id === undefined) { res.writeHead(202).end(); return; }
    const result = q.method === "initialize" ? { protocolVersion: "2025-03-26", capabilities: { tools: {} }, serverInfo: { name: "fixture", version: "1" } }
      : q.method === "tools/list" ? { tools: [{ name: "check", inputSchema: { type: "object" } }] }
      : { content: [{ type: "text", text: `new endpoint answered: ${secret} ` + "data".repeat(10000) }] };
    res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ jsonrpc: "2.0", id: q.id, result }));
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    await store.put("config", { scenes: { lightweight: ["p/m"] }, provider: { p: { baseURL: base, models: { m: {} } } } });
    await employeeCapabilities(a, alice, "PUT", ["mcp"], { mcp: { old: { url: base + "/old", headers: { Authorization: "Bearer test-old" } } } });
    const chat = await a.chat(alice.id);
    await engine.mcpFor(chat, await engine.config(chat)); // Already-open chat has a prior MCP configuration.
    await employeeCapabilities(a, alice, "PUT", ["mcp"], { mcp: { current: { url: base + "/new", headers: { Authorization: "Bearer " + secret } } } });
    const issued = new Map<string, number>();
    let staticPrefix: string | undefined;
    engine.providers.chat = async (_model, _system, messages, tools, _signal, _emit, session = "") => {
      const step = (issued.get(session) || 0) + 1;
      issued.set(session, step);
      const found = (name: string) => tools.some((tool) => tool.name === name);
      if (session === chat.id) {
        assert(!found("mcp"), "chat dispatches work; it does not use the credential itself");
        return step === 1 ? { role: "assistant", calls: [{ id: "dispatch", name: "employee_task_create", arguments: { instructions: "用 current MCP 服务核对记录" } }] }
          : { role: "assistant", text: "已派发" };
      }
      const dynamic = messages.filter((message) => message.runtime === "dynamic").map((message) => message.text || "").join("\n");
      assert.match(dynamic, /当前热心市民已启用的服务名.*\["current"\]/);
      assert(!dynamic.includes(secret));
      assert(found("mcp"));
      const prefix = JSON.stringify([_system, tools]);
      assert.equal(prefix, staticPrefix ??= prefix);
      const catalog = messages.findLast(message => message.name === "mcp_catalog")?.text;
      assert(catalog && !prefix.includes("[MCP 目录快照"));
      const [row] = JSON.parse(catalog.slice(catalog.indexOf("\n") + 1));
      assert.equal(row.definitionRef, undefined, "runtime binds the presented catalog, not the model");
      return step === 1 ? { role: "assistant", calls: [{ id: "call", name: "mcp", arguments: { op: "call", server: row.server, tool: row.tool } }] }
        : { role: "assistant", text: "MCP 已核对" };
    };
    await engine.run(chat.id, { role: "user", actorId: alice.id, text: "用 current 服务核对记录" });
    const task = (await a.state()).tasks[0];
    assert(task);
    const events: any[] = [];
    engine.events.on("event", (event) => events.push(event));
    // Run the actual work-session creation/Engine path once, without a live scheduler retrying the fixture.
    await a.update((state) => { a.task(state, task.id).status = "running"; });
    a.busy.set(task.id, { computer: false, session: "" });
    await a.run(task);
    const work = await store.session((await a.findTask(task.id))!.workSession);
    assert.equal(work.employeeId, a.employeeId);
    assert(hits.every((hit) => hit.startsWith("/new ") && hit.endsWith(" new header")));
    assert.equal(hits.filter((hit) => hit.includes("tools/list")).length, 1);
    assert.equal(hits.filter((hit) => hit.includes("tools/call")).length, 1);
    const result = events.find((event) => event.type === "tool_end" && event.data.call.id === "call");
    assert.match(JSON.stringify(result), /new endpoint answered: \[credential redacted\]/);
    assert(!JSON.stringify(result).includes(secret));
    const receipt = (await store.messages(work.id)).find((message) => message.callId === "call");
    assert(receipt?.text);
    const archived = JSON.parse(receipt.text);
    assert(archived.archivePath);
    assert(!String(await store.files.read(archived.archivePath)).includes(secret));
  } finally {
    await engine.close(); await store.close();
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test("invalid MCP updates leave all existing settings unchanged", async () => {
  const { store, engine, a } = await fixture();
  try {
    await employeeCapabilities(a, alice, "PUT", ["mcp"], { mcp: { service: { command: "node", args: ["server.mjs"] } } });
    const before = await store.object("employee-capabilities", a.employeeId);
    for (const mcp of [[], { broken: { url: "file:///private" } }, { broken: { command: "node", args: "invalid" } }, JSON.parse('{"__proto__":{"command":"node"}}')]) {
      await assert.rejects(employeeCapabilities(a, alice, "PUT", ["mcp"], { mcp }));
      assert.deepEqual(await store.object("employee-capabilities", a.employeeId), before);
    }
  } finally { await engine.close(); await store.close(); }
});

test("deleting one employee removes only its own capability configuration", async () => {
  const { store, engine, a, b } = await fixture();
  try {
    for (const [employee, user] of [[a, alice], [b, bob]] as const) {
      await employeeCapabilities(employee, user, "PUT", ["mcp"], { mcp: { service: { command: "node" } } });
      await employeeCapabilities(employee, user, "POST", ["skills", "upload"], bundle("owned"));
    }
    a.deleting = true; await a.forget();
    assert.equal(await store.object("employee-capabilities", a.employeeId), undefined);
    assert.equal((await store.objects(skillKind(a.employeeId))).length, 0);
    assert.equal((await store.objects(skillKind(b.employeeId))).length, 1);
    assert(await store.object("employee-capabilities", b.employeeId));
  } finally { await engine.close(); await store.close(); }
});
