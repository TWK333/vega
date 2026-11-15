import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFileSync } from "node:fs";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { Store } from "../server/core/store";
import { Engine } from "../server/core/engine";
import { Catalog } from "../server/core/catalog";
import { Subscriptions } from "../server/core/subscriptions";
import { Chrome } from "../server/core/chrome";
import { ChromeBridge } from "../server/core/chrome-bridge";
import { Auth, AuthError, digest, type User } from "../server/core/auth";
import { NARRATOR_SYSTEM } from "../server/core/narrator";
import { sleep } from "../server/core/util";
import {
  EXTERNAL_MCP_REJECTED,
  externalMcpApi,
  interpretDelivery,
  TargetError,
  tokenFromHeaders,
  type TargetRef,
} from "../server/core/external-mcp";
import { externalMcpResponse } from "../server/core/external-mcp-server";

const ORIGIN = "https://vega.test";
const zhang: TargetRef = { type: "employee", id: "e-zhang", name: "老张" };
const zhang3: TargetRef = { type: "employee", id: "e-zhang3", name: "老张三" };
const lookalike: TargetRef = { type: "group", id: "g-zhang", name: "老张" };
const project: TargetRef = { type: "group", id: "g-project", name: "项目群" };
const wang: TargetRef = { type: "employee", id: "e-wang", name: "老王" };

test("name routing stays inside the bound set and does not guess", () => {
  assert.deepEqual(interpretDelivery("给老张说做这个", "", [zhang, project]), { target: zhang, message: "做这个" });
  assert.deepEqual(interpretDelivery("给老张说：写报告", "", [zhang]), { target: zhang, message: "写报告" });
  assert.deepEqual(interpretDelivery("给老张说:写周报", "", [zhang]), { target: zhang, message: "写周报" });
  assert.deepEqual(interpretDelivery("给老张：写周报", "", [zhang, project]), { target: zhang, message: "写周报" });
  assert.deepEqual(interpretDelivery("给老张三说只给三", "", [zhang, zhang3]), { target: zhang3, message: "只给三" });
  assert.deepEqual(interpretDelivery("给老张说只给张", "", [zhang, zhang3]), { target: zhang, message: "只给张" });
  assert.deepEqual(interpretDelivery("给abc说hi", "", [{ type: "employee", id: "e-abc", name: "ABC" }]), { target: { type: "employee", id: "e-abc", name: "ABC" }, message: "hi" });
  assert.deepEqual(interpretDelivery("做这个", "", [zhang]), { target: zhang, message: "做这个" });
  assert.deepEqual(interpretDelivery("直接说", zhang.id, [zhang, project]), { target: zhang, message: "直接说" });
  assert.deepEqual(interpretDelivery("给老张说做这个", zhang.id, [zhang, project]), { target: zhang, message: "做这个" });

  const ambiguous = thrown("给老张说做这个", "", [zhang, lookalike]);
  assert.ok(ambiguous instanceof TargetError);
  assert.deepEqual(ambiguous.candidates.map((item) => item.id).sort(), [lookalike.id, zhang.id].sort());
  assert.match(ambiguous.message, /多个对象/);

  const unknown = thrown("给小李说你好", "", [zhang]);
  assert.ok(unknown instanceof TargetError);
  assert.match(unknown.message, /小李/);
  assert.deepEqual(unknown.candidates.map((item) => item.id), [zhang.id]);
  assert.equal(JSON.stringify(unknown.candidates).includes("老王"), false);

  const unnamed = thrown("做这个", "", [zhang, project]);
  assert.ok(unnamed instanceof TargetError);
  assert.match(unnamed.message, /请指明/);
  assert.deepEqual(unnamed.candidates.map((item) => item.id).sort(), [project.id, zhang.id].sort());

  const conflict = thrown("给老张说做这个", project.id, [zhang, project]);
  assert.ok(conflict instanceof TargetError);
  assert.match(conflict.message, /不是同一个/);

  assert.throws(() => interpretDelivery("给老张说：", "", [zhang]), /消息是空的/);
  assert.throws(() => interpretDelivery("   ", "", [zhang]), /消息是空的/);
  const missing = thrown("给老张说做这个", "", []);
  assert.ok(missing instanceof TargetError);
  assert.deepEqual(missing.candidates, []);
});

test("对外 MCP is a personal settings section and does not open admin settings", () => {
  const settings = readFileSync("web/src/SettingsView.vue", "utf8");
  const capabilities = readFileSync("web/src/EmployeeCapabilities.vue", "utf8");
  const app = readFileSync("web/src/App.vue", "utf8");
  const router = readFileSync("web/src/router.js", "utf8");
  const gate = readFileSync("server/core/http-auth.ts", "utf8");
  const route = readFileSync("server/routes/api/[...path].ts", "utf8");
  const endpoint = readFileSync("server/routes/api/mcp/[id].ts", "utf8");
  const personal = settings.split("\n").find((line) => line.includes("const PERSONAL_SECTIONS")) || "";
  const admin = settings.split("\n").find((line) => line.includes("const ADMIN_SECTIONS")) || "";
  const adminOnly = settings.slice(settings.indexOf('<template v-if="admin">'), settings.indexOf("</template>"));
  assert.match(personal, /对外 MCP/);
  assert.match(admin, /对外 MCP/);
  assert.doesNotMatch(personal, /服务商|场景模型|任务调度/);
  assert.match(adminOnly, /ProviderSettings/);
  assert.match(adminOnly, /SceneSettings/);
  assert.match(adminOnly, /SchedulerSettings/);
  assert.doesNotMatch(adminOnly, /ExternalMcpSettings|VaultSettings/);
  assert.match(settings, /<ExternalMcpSettings :api="api" :employees="employees \|\| \[\]"/);
  assert.match(settings, /props\.admin \? "providers" : "vault"/);
  const page = readFileSync("web/src/ExternalMcpSettings.vue", "utf8");
  assert.match(page, /Authorization: Bearer/);
  assert.match(page, /X-Vega-MCP-Token/);
  assert.match(page, /\/me\/external-mcp/);
  assert.match(page, /Streamable HTTP/);
  assert.match(capabilities, /<h3>MCP 客户端<\/h3>/);
  assert.match(capabilities, /对外 MCP/);
  assert.match(capabilities, /尚未配置 MCP/);
  assert.match(app, /route\.sub !== "external-mcp"/);
  assert.match(router, /settings: \["scenes", "vault", "external-mcp", "principles"\]/);
  assert.doesNotMatch(readFileSync("web/src/router.js", "utf8"), /ADMIN_PAGES = \[[^\]]*settings/);
  const exempt = gate.indexOf("/^\\/api\\/mcp\\/[^/]+$/");
  const origin = gate.indexOf("sameOrigin(event);");
  const signIn = gate.indexOf("Please sign in");
  const manage = gate.indexOf("me\\/external-mcp");
  const adminError = gate.indexOf("Administrator permission required");
  assert.ok(exempt > 0 && exempt < origin, "the MCP endpoint is exempt before the website origin check");
  assert.ok(signIn > 0 && signIn < manage, "managing a config still requires a signed-in user");
  assert.ok(manage < adminError, "a signed-in non-admin is allowed to manage their own configs");
  assert.match(route, /path\[1\] === "external-mcp"/);
  assert.match(endpoint, /externalMcpResponse/);
  assert.equal(/^\/api\/mcp\/[^/]+$/.test("/api/mcp/xm" + "a".repeat(32)), true);
  assert.equal(/^\/api\/mcp\/[^/]+$/.test("/api/config"), false);
  assert.equal(/^\/api\/me\/external-mcp(?:\/|$)/.test("/api/me/external-mcp"), true);
  assert.equal(/^\/api\/me\/external-mcp(?:\/|$)/.test("/api/me/external-mcp/xm/rotate"), true);
  assert.equal(tokenFromHeaders(new Headers({ authorization: "Bearer one", "x-vega-mcp-token": "two" })), undefined);
});

test("two users each own their configs, and a token cannot use another user's bindings", async () => {
  const { engine, auth, close } = await fixture();
  try {
    const alice = person("u1", "alice", "operator");
    const bob = person("u2", "bob", "operator");
    const vera = person("u3", "vera", "viewer");
    assert.notEqual(alice.role, "admin");
    const zhangId = await make(engine, "老张", alice.id);
    const wangId = await make(engine, "老王", alice.id);
    const liId = await make(engine, "老李", bob.id);
    const readerId = await make(engine, "只读", vera.id);
    const projectId = (await engine.groups.create(alice, { name: "项目群", bulletin: "老张负责", employees: [zhangId] })).id;
    const sameNameId = (await engine.groups.create(alice, { name: "老张", employees: [zhangId] })).id;
    const bobGroup = (await engine.groups.create(bob, { name: "鲍勃的群", employees: [liId] })).id;

    await assert.rejects(externalMcpApi(engine, alice, "POST", [], { name: "越权", employees: [liId], groups: [] }, ORIGIN), /只能绑定你自己的牛马/);
    await assert.rejects(externalMcpApi(engine, alice, "POST", [], { name: "越权群", employees: [], groups: [bobGroup] }, ORIGIN), /只能绑定你已经加入的群聊/);

    const aliceConfig = await issued(engine, alice, [], { name: "爱丽丝的 Cursor", employees: [zhangId], groups: [projectId] });
    const solo = await issued(engine, alice, [], { name: "只连老王", employees: [wangId], groups: [] });
    const ambiguous = await issued(engine, alice, [], { name: "同名", employees: [zhangId], groups: [sameNameId] });
    const bobConfig = await issued(engine, bob, [], { name: "鲍勃的客户端", employees: [liId], groups: [] });
    const readerConfig = await issued(engine, vera, [], { name: "只读连接", employees: [readerId], groups: [] });
    assert.match(aliceConfig.token, /^vmcp_[A-Za-z0-9_-]{43}$/);
    assert.equal(aliceConfig.config.tokenHint, "vmcp_…" + aliceConfig.token.slice(-4));
    assert.equal("token" in aliceConfig.config, false);

    const aliceList = await listConfigs(engine, alice);
    const aliceJson = JSON.stringify(aliceList);
    for (const token of [aliceConfig.token, solo.token, bobConfig.token, readerConfig.token]) assert.equal(aliceJson.includes(token), false, "list APIs must not return raw tokens");
    assert.equal(aliceJson.includes("tokenHash"), false);
    assert.equal(aliceJson.includes(bobConfig.config.id), false, "alice cannot see bob's config");
    assert.deepEqual(aliceList.configs.map((item: { id: string }) => item.id).sort(), [aliceConfig.config.id, ambiguous.config.id, solo.config.id].sort());
    for (const item of aliceList.configs) {
      assert.equal("token" in item, false);
      assert.equal("ownerId" in item, false);
    }
    const bobList = await listConfigs(engine, bob);
    assert.deepEqual(bobList.configs.map((item: { id: string }) => item.id), [bobConfig.config.id]);
    const stored = await engine.store.object<any>("external-mcp", aliceConfig.config.id);
    assert.equal(stored.tokenHash, digest(aliceConfig.token));
    assert.equal(stored.ownerId, alice.id);
    assert.equal("token" in stored, false);
    assert.equal(await auth.authenticate(aliceConfig.token), undefined, "an MCP token is not a website session");

    await assert.rejects(externalMcpApi(engine, alice, "PATCH", [bobConfig.config.id], { name: "偷走" }, ORIGIN), /配置不存在/);
    await assert.rejects(externalMcpApi(engine, alice, "DELETE", [bobConfig.config.id], {}, ORIGIN), /配置不存在/);
    assert.equal((await listConfigs(engine, bob)).configs.length, 1);

    const listed = await call(engine, auth, aliceConfig.config.id, aliceConfig.token, "list_targets", {});
    assert.equal(listed.isError, false);
    assert.deepEqual(listed.json.targets.map((item: TargetRef) => item.name).sort(), ["老张", "项目群"]);
    assert.equal(JSON.stringify(listed.json).includes(liId), false);
    assert.equal(JSON.stringify(listed.json).includes("老王"), false);

    const cross = await post(engine, auth, bobConfig.config.id, aliceConfig.token, rpc("tools/list", {}));
    assert.equal(cross.status, 401);
    assert.match(cross.text, /凭据无效或已停用/);
    assert.equal(cross.text.includes(aliceConfig.token), false);
    assert.equal(cross.text.includes(bobConfig.token), false);

    const queryOnly = await externalMcpResponse(new Request(ORIGIN + "/api/mcp/" + aliceConfig.config.id + "?token=query-secret-token", { method: "POST", headers: { accept: "application/json, text/event-stream", "content-type": "application/json" }, body: JSON.stringify(rpc("tools/list", {})) }), { engine, auth, configId: aliceConfig.config.id });
    const queryText = await queryOnly.text();
    assert.equal(queryOnly.status, 401);
    assert.equal(queryText.includes("query-secret-token"), false);

    const alternate = new Headers({ "x-vega-mcp-token": aliceConfig.token });
    const byHeader = await post(engine, auth, aliceConfig.config.id, undefined, rpc("tools/list", {}), alternate);
    assert.equal(byHeader.status, 200, byHeader.text);
    const mismatched = new Headers({ authorization: "Bearer " + aliceConfig.token, "x-vega-mcp-token": bobConfig.token });
    const rejected = await post(engine, auth, aliceConfig.config.id, undefined, rpc("tools/list", {}), mismatched);
    assert.equal(rejected.status, 401);
    assert.equal(rejected.text.includes(aliceConfig.token), false);

    const sent = await call(engine, auth, aliceConfig.config.id, aliceConfig.token, "send_message", { text: "给老张说做这个" });
    assert.equal(sent.isError, false, sent.text);
    assert.equal(sent.json.target.id, zhangId);
    await until(async () => (await userTexts(engine, zhangId)).includes("做这个"), "老张收到「做这个」");
    const delivered = (await employeeMessages(engine, zhangId)).find((message) => message.role === "user" && message.text === "做这个");
    assert.equal(delivered?.actorId, alice.id);
    assert.equal((await userTexts(engine, zhangId)).includes("给老张说做这个"), false);
    await waitReplies(engine, (await chatSession(engine, zhangId))!, 1);
    const reply = await call(engine, auth, aliceConfig.config.id, aliceConfig.token, "read_reply", { target: "老张", afterSeq: sent.json.afterSeq });
    assert.equal(reply.isError, false, reply.text);
    assert.equal(reply.json.running, false);
    assert.match(reply.json.summary, /收到/);
    assert.equal(JSON.stringify(reply.json).includes(aliceConfig.token), false);
    assert.equal(JSON.stringify(reply.json).includes("chatSession"), false);

    const colon = await call(engine, auth, aliceConfig.config.id, aliceConfig.token, "send_message", { text: "给老张说：写报告" });
    assert.equal(colon.isError, false, colon.text);
    await until(async () => (await userTexts(engine, zhangId)).includes("写报告"), "冒号后的正文");
    await waitReplies(engine, (await chatSession(engine, zhangId))!, 2);

    const named = await call(engine, auth, aliceConfig.config.id, aliceConfig.token, "send_message", { target: "老张", message: "直接说" });
    assert.equal(named.isError, false, named.text);
    await until(async () => (await userTexts(engine, zhangId)).includes("直接说"));
    await waitReplies(engine, (await chatSession(engine, zhangId))!, 3);

    const beforeGroup = (await groupMessages(engine, projectId)).length;
    const grouped = await call(engine, auth, aliceConfig.config.id, aliceConfig.token, "send_message", { text: "给项目群说@老张 看一下" });
    assert.equal(grouped.isError, false, grouped.text);
    assert.equal(grouped.json.target.id, projectId);
    await until(async () => (await groupMessages(engine, projectId)).some((message) => message.role === "user" && message.text === "@老张 看一下" && message.author?.id === alice.id));
    await waitReplies(engine, (await engine.groups.get(projectId))!.session, 1);
    assert.ok((await groupMessages(engine, projectId)).length > beforeGroup);

    const unknown = await call(engine, auth, aliceConfig.config.id, aliceConfig.token, "send_message", { text: "给小李说你好" });
    assert.equal(unknown.isError, true);
    assert.match(unknown.json.error, /小李/);
    assert.equal(unknown.json.candidates.some((item: TargetRef) => item.id === liId || item.name === "老王"), false);
    assert.equal((await userTexts(engine, zhangId)).includes("你好"), false);
    assert.equal(await chatSession(engine, wangId), undefined);
    assert.equal(await chatSession(engine, liId), undefined);

    const beforeAmbiguous = (await userTexts(engine, zhangId)).length;
    const beforeSame = (await groupMessages(engine, sameNameId)).length;
    const both = await call(engine, auth, ambiguous.config.id, ambiguous.token, "send_message", { text: "给老张说别猜" });
    assert.equal(both.isError, true);
    assert.match(both.json.error, /多个对象/);
    assert.deepEqual(both.json.candidates.map((item: TargetRef) => item.id).sort(), [sameNameId, zhangId].sort());
    assert.equal((await userTexts(engine, zhangId)).length, beforeAmbiguous);
    assert.equal((await groupMessages(engine, sameNameId)).length, beforeSame);
    const byId = await call(engine, auth, ambiguous.config.id, ambiguous.token, "send_message", { target: zhangId, message: "按 id 发给牛马" });
    assert.equal(byId.isError, false, byId.text);
    await until(async () => (await userTexts(engine, zhangId)).includes("按 id 发给牛马"));
    await waitReplies(engine, (await chatSession(engine, zhangId))!, 4);

    const beforeConflict = (await userTexts(engine, zhangId)).length;
    const conflict = await call(engine, auth, aliceConfig.config.id, aliceConfig.token, "send_message", { target: projectId, text: "给老张说不要发到群里" });
    assert.equal(conflict.isError, true);
    assert.match(conflict.json.error, /不是同一个/);
    assert.equal((await userTexts(engine, zhangId)).length, beforeConflict);

    const setup = await call(engine, auth, aliceConfig.config.id, aliceConfig.token, "send_message", { text: "给老张说/setup 把模型改了" });
    assert.equal(setup.isError, true);
    assert.match(setup.json.error, /不能修改系统设置/);
    assert.equal((await userTexts(engine, zhangId)).some((text) => text.includes("/setup")), false);

    const stolen = await call(engine, auth, aliceConfig.config.id, aliceConfig.token, "send_message", { target: liId, message: "偷偷说" });
    assert.equal(stolen.isError, true);
    assert.equal(JSON.stringify(stolen.json.candidates).includes(liId), false);
    assert.equal(await chatSession(engine, liId), undefined);
    const otherToken = await call(engine, auth, solo.config.id, solo.token, "send_message", { target: zhangId, message: "老王的令牌找老张" });
    assert.equal(otherToken.isError, true);
    assert.equal((await userTexts(engine, zhangId)).includes("老王的令牌找老张"), false);

    const alone = await call(engine, auth, solo.config.id, solo.token, "send_message", { message: "单独去做" });
    assert.equal(alone.isError, false, alone.text);
    assert.equal(alone.json.target.id, wangId);
    await until(async () => (await userTexts(engine, wangId)).includes("单独去做"));
    const wangSession = (await chatSession(engine, wangId))!;
    await waitReplies(engine, wangSession, 1);
    const missed = (await userTexts(engine, wangId)).length;
    const notHim = await call(engine, auth, solo.config.id, solo.token, "send_message", { text: "给小李说你好" });
    assert.equal(notHim.isError, true);
    assert.equal((await userTexts(engine, wangId)).length, missed, "a named miss does not fall through to the only bound bot");

    const denied = await call(engine, auth, readerConfig.config.id, readerConfig.token, "send_message", { message: "只读也想说" });
    assert.equal(denied.isError, true);
    assert.match(denied.json.error, /只读账号不能执行操作/);
    assert.equal(await chatSession(engine, readerId), undefined);
    const readable = await call(engine, auth, readerConfig.config.id, readerConfig.token, "list_targets", {});
    assert.equal(readable.isError, false);
    assert.equal(readable.json.targets[0].id, readerId);

    await externalMcpApi(engine, alice, "PATCH", [solo.config.id], { enabled: false }, ORIGIN);
    const disabled = await post(engine, auth, solo.config.id, solo.token, rpc("tools/list", {}));
    assert.equal(disabled.status, 401);
    assert.match(disabled.text, new RegExp(EXTERNAL_MCP_REJECTED));
    const still = await call(engine, auth, aliceConfig.config.id, aliceConfig.token, "list_targets", {});
    assert.equal(still.isError, false, "disabling one config leaves the others working");
    const bobStill = await call(engine, auth, bobConfig.config.id, bobConfig.token, "list_targets", {});
    assert.equal(bobStill.json.targets[0].id, liId);
    await externalMcpApi(engine, alice, "PATCH", [solo.config.id], { enabled: true }, ORIGIN);
    assert.equal((await call(engine, auth, solo.config.id, solo.token, "list_targets", {})).isError, false);

    await externalMcpApi(engine, alice, "POST", [solo.config.id, "revoke"], {}, ORIGIN);
    assert.equal((await post(engine, auth, solo.config.id, solo.token, rpc("tools/list", {}))).status, 401);
    const rotated = await issued(engine, alice, [solo.config.id, "rotate"], {});
    assert.notEqual(rotated.token, solo.token);
    assert.equal((await post(engine, auth, solo.config.id, solo.token, rpc("tools/list", {}))).status, 401, "the previous token dies on rotate");
    assert.equal((await call(engine, auth, solo.config.id, rotated.token, "list_targets", {})).isError, false);
    assert.equal(JSON.stringify(await externalMcpApi(engine, alice, "GET", [], {}, ORIGIN)).includes(rotated.token), false);

    const kept = await userTexts(engine, wangId);
    await externalMcpApi(engine, alice, "DELETE", [solo.config.id], {}, ORIGIN);
    assert.deepEqual(await userTexts(engine, wangId), kept, "deleting a config leaves the conversation");
    assert.equal((await post(engine, auth, solo.config.id, rotated.token, rpc("tools/list", {}))).status, 401);

    await engine.store.run("UPDATE web_users SET disabled=1 WHERE id=?", alice.id);
    assert.equal((await post(engine, auth, aliceConfig.config.id, aliceConfig.token, rpc("tools/list", {}))).status, 401);
    await engine.store.run("UPDATE web_users SET disabled=0 WHERE id=?", alice.id);
    const get = await externalMcpResponse(new Request(ORIGIN + "/api/mcp/" + aliceConfig.config.id, { method: "GET", headers: { authorization: "Bearer " + aliceConfig.token, accept: "text/event-stream" } }), { engine, auth, configId: aliceConfig.config.id });
    assert.equal(get.status, 405);
    await get.body?.cancel();
  } finally {
    await close();
  }
});

test("a non-admin connects with the MCP client and reaches only their own bot", async () => {
  const { engine, auth, close } = await fixture();
  let client: Client | undefined;
  let stop = async () => {};
  try {
    const alice = person("u1", "alice", "operator");
    assert.notEqual(alice.role, "admin");
    const zhangId = await make(engine, "老张", alice.id);
    await make(engine, "老王", alice.id);
    const created = await issued(engine, alice, [], { name: "我的客户端", employees: [zhangId], groups: [] });
    const endpoint = await serve(async (request, id) => externalMcpResponse(request, { engine, auth, configId: id }));
    stop = endpoint.close;
    client = new Client({ name: "vega-test", version: "0.0.0" });
    const transport = new StreamableHTTPClientTransport(new URL(endpoint.base + "/api/mcp/" + created.config.id), {
      requestInit: { headers: { Authorization: "Bearer " + created.token } },
    });
    await client.connect(transport);
    const tools = await client.listTools();
    assert.deepEqual(tools.tools.map((tool) => tool.name).sort(), ["list_targets", "read_reply", "send_message"]);
    const targets = payload(await client.callTool({ name: "list_targets", arguments: {} }));
    assert.deepEqual(targets.json.targets.map((item: TargetRef) => item.id), [zhangId]);
    const sent = payload(await client.callTool({ name: "send_message", arguments: { text: "给老张说从客户端来" } }));
    assert.equal(sent.isError, false, sent.text);
    assert.equal(sent.json.target.id, zhangId);
    await until(async () => (await userTexts(engine, zhangId)).includes("从客户端来"));
    const session = (await chatSession(engine, zhangId))!;
    await waitReplies(engine, session, 1);
    const reply = payload(await client.callTool({ name: "read_reply", arguments: { afterSeq: sent.json.afterSeq } }));
    assert.match(reply.json.summary, /收到/);
    assert.equal((await employeeMessages(engine, zhangId)).some((message) => message.role === "user" && message.actorId === alice.id && message.text === "从客户端来"), true);
  } finally {
    await client?.close().catch(() => {});
    await stop();
    await close();
  }
});

function thrown(text: string, explicit: string, targets: TargetRef[]) {
  try {
    interpretDelivery(text, explicit, targets);
  } catch (error) {
    return error;
  }
  assert.fail("expected a routing error for " + text);
}

function person(id: string, username: string, role: User["role"]): User {
  return { id, username, role, disabled: false, createdAt: 0, lastLogin: 0 };
}
function rpc(method: string, params: unknown, id = 1) {
  return { jsonrpc: "2.0", id, method, params };
}
async function fixture() {
  const store = await Store.open(":memory:");
  const engine = await Engine.create(store, new Catalog(store, new Subscriptions(store, "")), new Chrome(store, new ChromeBridge(), ""));
  engine.employee.closed = true;
  await store.put("config", { scenes: { lightweight: ["fixture/model"], coding: ["fixture/model"] }, provider: { fixture: { api: "openai-completions", baseURL: "https://unused.test", models: { model: { limit: { context: 128000, output: 8192 } } } } } });
  for (const [id, name, role] of [["u1", "alice", "operator"], ["u2", "bob", "operator"], ["u3", "vera", "viewer"]])
    await store.run("INSERT INTO web_users VALUES(?,?,?,?,?,?,?)", id, name, "x", role, 0, Date.now(), 0);
  engine.providers.chat = (async (_model: unknown, system: string) => {
    if (system === NARRATOR_SYSTEM) return { role: "assistant", calls: [{ id: "n", name: "route_message", arguments: { targets: [], reason: "闲聊" } }] };
    return { role: "assistant", model: "fixture/model", text: "收到" };
  }) as typeof engine.providers.chat;
  const auth = new Auth(store, "");
  return { store, engine, auth, close: async () => { await engine.close(); await store.close(); } };
}
async function make(engine: Engine, name: string, ownerId: string) {
  return (await engine.employee.create({ name }, ownerId)).id as string;
}
async function employeeMessages(engine: Engine, employeeId: string) {
  const session = await chatSession(engine, employeeId);
  return session ? engine.store.messages(session) : [];
}
async function chatSession(engine: Engine, employeeId: string) {
  return (await (await engine.employee.for(employeeId)).profile()).chatSession;
}
async function userTexts(engine: Engine, employeeId: string) {
  return (await employeeMessages(engine, employeeId)).flatMap((message) => message.role === "user" && typeof message.text === "string" ? [message.text] : []);
}
async function issued(engine: Engine, user: User, path: string[], body: Record<string, unknown>) {
  const result = await externalMcpApi(engine, user, "POST", path, body, ORIGIN) as { token: string; config: { id: string; tokenHint: string; url: string } };
  assert.equal(typeof result.token, "string");
  assert.equal(typeof result.config?.id, "string");
  return result;
}
async function listConfigs(engine: Engine, user: User) {
  const result = await externalMcpApi(engine, user, "GET", [], {}, ORIGIN) as { configs: { id: string }[] };
  assert.ok(Array.isArray(result.configs));
  return result;
}
async function groupMessages(engine: Engine, groupId: string) {
  return engine.store.messages((await engine.groups.get(groupId))!.session);
}
const until = async (ready: () => boolean | Promise<boolean>, label = "condition") => {
  for (let i = 0; i < 800 && !await ready(); i++) await sleep(10);
  assert.equal(await ready(), true, label);
};
async function waitReplies(engine: Engine, session: string, count: number) {
  await until(async () => (await engine.store.messages(session)).filter((message) => message.role === "assistant" && message.text === "收到" && !message.notice).length >= count, "reply " + count + " in " + session);
  await until(() => engine.active.size === 0, "turn still running");
}
async function post(engine: Engine, auth: Auth, configId: string, token: string | undefined, message: unknown, extra?: Headers) {
  const headers = new Headers(extra);
  if (token) headers.set("authorization", "Bearer " + token);
  if (!headers.has("accept")) headers.set("accept", "application/json, text/event-stream");
  if (!headers.has("content-type")) headers.set("content-type", "application/json");
  const response = await externalMcpResponse(new Request(ORIGIN + "/api/mcp/" + configId, { method: "POST", headers, body: JSON.stringify(message) }), { engine, auth, configId });
  const text = await response.text();
  let json: any;
  try { json = text ? JSON.parse(text) : undefined; } catch { json = undefined; }
  return { status: response.status, text, json };
}
async function call(engine: Engine, auth: Auth, configId: string, token: string, name: string, args: Record<string, unknown>) {
  const response = await post(engine, auth, configId, token, rpc("tools/call", { name, arguments: args }));
  assert.equal(response.status, 200, response.text);
  const text = response.json.result.content[0].text as string;
  return { isError: !!response.json.result.isError, text, json: JSON.parse(text) };
}
function payload(result: unknown) {
  const value = result as { isError?: boolean; content?: { type: string; text?: string }[] };
  const text = value.content?.find((item) => item.type === "text")?.text || "";
  return { isError: !!value.isError, text, json: JSON.parse(text) };
}
/** Tiny HTTP server so the official MCP client connects the same way Cursor would. */
async function serve(handler: (request: Request, configId: string) => Promise<Response>) {
  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    try {
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      const method = req.method || "GET";
      const headers = new Headers();
      for (const [key, value] of Object.entries(req.headers)) {
        if (value == null || ["host", "connection", "keep-alive", "transfer-encoding", "content-length", "upgrade", "te", "trailer"].includes(key)) continue;
        for (const item of Array.isArray(value) ? value : [value]) headers.append(key, item);
      }
      const request = new Request("http://127.0.0.1" + (req.url || "/"), { method, headers, body: method === "GET" || method === "HEAD" ? undefined : Buffer.concat(chunks) });
      const id = new URL(request.url).pathname.split("/").pop() || "";
      const response = await handler(request, id);
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(Buffer.from(await response.arrayBuffer()));
    } catch (error) {
      res.statusCode = 500;
      res.end(String(error));
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  return { base: "http://127.0.0.1:" + port, close: () => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())) };
}
