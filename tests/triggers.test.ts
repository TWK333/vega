import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Store } from "../server/core/store";
import { Engine } from "../server/core/engine";
import { Catalog } from "../server/core/catalog";
import { Subscriptions } from "../server/core/subscriptions";
import { Chrome } from "../server/core/chrome";
import { ChromeBridge } from "../server/core/chrome-bridge";
import { postTrigger, publicAddress, triggersApi } from "../server/core/triggers";
import { NARRATOR_SYSTEM } from "../server/core/narrator";
import { formatRoute, parseRoute } from "../web/src/router.js";
import { sleep } from "../server/core/util";

const alice = { id: "u1", role: "operator" } as any, bob = { id: "u2", role: "operator" } as any;
const input = { name: "微信", condition: "employee_message", action: "http", enabled: true, url: "https://example.com/hook?key=secret", headers: '{"Authorization":"Bearer secret-header"}', body: '{"msgtype":"text","text":{"content":"{{employeeName}}: {{message}} / {{groupName}}"}}' };
async function fixture() {
  const store = await Store.open(":memory:");
  const engine = await Engine.create(store, new Catalog(store, new Subscriptions(store, "")), new Chrome(store, new ChromeBridge(), ""));
  engine.employee.closed = true;
  for (const user of [alice, bob]) await store.run("INSERT INTO web_users VALUES(?,?,?,?,?,?,?)", user.id, user.id, "x", user.role, 0, Date.now(), 0);
  await store.put("config", { scenes: { lightweight: ["fixture/model"], coding: ["fixture/model"] }, provider: { fixture: { api: "openai-completions", baseURL: "https://unused.test", models: { model: { limit: { context: 128000, output: 8192 } } } } } });
  return { store, engine, close: async () => { await engine.close(); await store.close(); } };
}
async function until(predicate: () => boolean) {
  for (let i = 0; i < 400 && !predicate(); i++) await sleep(5);
  assert(predicate(), "event did not arrive");
}

test("personal trigger CRUD encrypts secrets, preserves edits and rejects other accounts and viewers", async () => {
  const { store, engine, close } = await fixture();
  try {
    const created = await triggersApi(engine.triggers, alice, "POST", [], input) as any;
    const item = created.trigger;
    assert(item.id && item.hasUrl && item.hasHeaders);
    assert.equal(item.url, input.url);
    assert(!JSON.stringify(item).includes("secret-header") && !("secret" in item));
    assert.equal((await triggersApi(engine.triggers, alice, "GET", [], {}) as any).triggers[0].url, input.url);
    const saved = await store.object<any>("trigger:user:u1", item.id);
    assert(!JSON.stringify(saved).includes("key=secret") && !JSON.stringify(saved).includes("secret-header"));
    assert.equal((await triggersApi(engine.triggers, bob, "GET", [], {}) as any).triggers.length, 0);
    await assert.rejects(triggersApi(engine.triggers, bob, "PATCH", [item.id], { enabled: false }), /不存在/);
    await assert.rejects(triggersApi(engine.triggers, { ...alice, role: "viewer" }, "GET", [], {}), /只读/);
    await assert.rejects(triggersApi(engine.triggers, alice, "POST", [], { ...input, name: "bad", url: "http://127.0.0.1/" }), /内网|本机/);
    await assert.rejects(triggersApi(engine.triggers, alice, "POST", [], { ...input, body: '{"x":{{message}}}' }), /JSON/);
    await assert.rejects(triggersApi(engine.triggers, alice, "POST", [], { ...input, headers: '{"Host":"internal"}' }), /请求头/);
    const kept = await triggersApi(engine.triggers, alice, "POST", [], { ...input, id: item.id, url: "", headers: "", name: "改名" }) as any;
    assert.equal(kept.trigger.url, input.url);
    const changedUrl = "https://example.com/new-hook?key=updated";
    const changed = await triggersApi(engine.triggers, alice, "POST", [], { ...input, id: item.id, url: changedUrl, headers: "" }) as any;
    assert.equal(changed.trigger.url, changedUrl);
    const sent: any[] = [];
    engine.triggers.post = async (url, headers, body) => { sent.push({ url, headers, body: JSON.parse(body) }); };
    engine.triggers.fire(alice.id, { employeeId: "e", employeeName: "热心市民小周", message: '引号"\n换行', groupName: "" });
    await until(() => sent.length === 1);
    assert.equal(sent[0].url, changedUrl);
    assert.equal(sent[0].headers.Authorization, "Bearer secret-header");
    assert.equal(sent[0].body.text.content, '热心市民小周: 引号"\n换行 / ');
    await triggersApi(engine.triggers, alice, "PATCH", [item.id], { enabled: false });
    engine.triggers.fire(alice.id, { employeeId: "e", employeeName: "热心市民小周", message: "disabled", groupName: "" });
    await Promise.allSettled([...engine.triggers.pending]);
    assert.equal(sent.length, 1);
    await triggersApi(engine.triggers, alice, "DELETE", [item.id], {});
    assert.deepEqual(await engine.triggers.list(alice.id), []);
  } finally { await close(); }
});

test("trigger scopes match selected employees or groups by ID without crossing accounts", async () => {
  const { store, engine, close } = await fixture();
  try {
    const one = await engine.employee.for((await engine.employee.create({ name: "一号" }, alice.id)).id);
    const two = await engine.employee.for((await engine.employee.create({ name: "二号" }, alice.id)).id);
    const other = await engine.employee.for((await engine.employee.create({ name: "热心市民小bob" }, bob.id)).id);
    const group = await engine.groups.create(alice, { name: "同名群", employees: [one.employeeId, two.employeeId], users: [bob.id] });
    const sameName = await engine.groups.create(alice, { name: "同名群", employees: [one.employeeId, two.employeeId] });
    const privateGroup = await engine.groups.create(bob, { name: "私有群", employees: [other.employeeId] });
    await engine.groups.addEmployee(bob, group.id, other.employeeId);
    const scope = (employees: string[], groups: string[]) => ({ employees, groups });
    const hook = (name: string, selection?: { employees: string[]; groups: string[] }) => ({ ...input, url: `https://example.com/${name}`, ...(selection ? { scope: selection } : {}) });
    await engine.triggers.save(alice.id, hook("all"));
    const selected = await engine.triggers.save(alice.id, hook("employee", scope([one.employeeId], [])));
    await engine.triggers.save(alice.id, hook("group", scope([], [group.id])));
    await engine.triggers.save(alice.id, hook("union", scope([one.employeeId], [group.id])));
    await engine.triggers.save(bob.id, hook("bob"));
    await assert.rejects(engine.triggers.save(alice.id, hook("empty", scope([], []))), /至少选择/);
    await assert.rejects(engine.triggers.save(alice.id, hook("other", scope([other.employeeId], []))), /你名下的热心市民/);
    await assert.rejects(engine.triggers.save(alice.id, hook("other-group", scope([], [privateGroup.id]))), /已加入的群聊/);
    await assert.rejects(engine.triggers.save(alice.id, { ...input, scope: { employees: "wrong", groups: [] } }), /范围无效/);
    // An older client that omits scope must not turn a restricted trigger into an unrestricted one.
    await engine.triggers.save(alice.id, { ...input, id: selected.id, url: "", headers: "" });
    assert.deepEqual((await engine.triggers.list(alice.id)).find((item) => item.id === selected.id)!.scope, scope([one.employeeId], []));
    const sent: { url: string; text: string }[] = [];
    engine.triggers.post = async (url, _headers, body) => { sent.push({ url, text: JSON.parse(body).text.content }); };
    await one.toChat((await one.chat(alice.id)).id, undefined, { role: "assistant", text: "私聊一" }, false);
    await two.toChat((await two.chat(alice.id)).id, undefined, { role: "assistant", text: "私聊二" }, false);
    await engine.groups.replied({ groupId: group.id } as any, one.employeeId, "目标群一", [], 1);
    await engine.groups.replied({ groupId: group.id } as any, two.employeeId, "目标群二", [], 1);
    await engine.groups.replied({ groupId: sameName.id } as any, one.employeeId, "同名群一", [], 1);
    await engine.groups.replied({ groupId: sameName.id } as any, two.employeeId, "同名群二", [], 1);
    await engine.groups.replied({ groupId: group.id } as any, other.employeeId, "其他人", [], 1);
    await until(() => sent.length === 16);
    await Promise.allSettled([...engine.triggers.pending]);
    const texts = (name: string) => sent.filter((item) => item.url.endsWith("/" + name)).map((item) => item.text).sort();
    assert.equal(texts("all").length, 6);
    assert.deepEqual(texts("employee"), ["一号: 私聊一 / ", "一号: 目标群一 / 同名群", "一号: 同名群一 / 同名群"].sort());
    assert.deepEqual(texts("group"), ["一号: 目标群一 / 同名群", "二号: 目标群二 / 同名群"].sort());
    assert.deepEqual(texts("union"), ["一号: 私聊一 / ", "一号: 目标群一 / 同名群", "一号: 同名群一 / 同名群", "二号: 目标群二 / 同名群"].sort());
    assert.deepEqual(texts("bob"), ["热心市民小bob: 其他人 / 同名群"]);
    await engine.triggers.save(alice.id, { ...input, id: selected.id, url: "", headers: "", scope: null });
    assert.equal((await engine.triggers.list(alice.id)).find((item) => item.id === selected.id)!.scope, undefined);
    const groupSession = (await engine.groups.get(group.id))!.session;
    const delayed = await store.append(groupSession, { role: "assistant", text: "离群前的延迟消息", author: { kind: "employee", id: other.employeeId, name: "热心市民小bob" } });
    await engine.groups.removeUser(bob, group.id, bob.id);
    engine.employeeMessage(other.employeeId, groupSession, delayed, { id: group.id, name: group.name });
    await sleep(80);
    await Promise.allSettled([...engine.triggers.pending]);
    assert.equal(sent.length, 16, "a delayed group event must not be delivered after its owner leaves");
  } finally { await close(); }
});

test("only public IPs may be used, including mapped and reserved addresses", async () => {
  for (const address of ["127.0.0.1", "10.0.1.1", "169.254.169.254", "100.64.0.1", "192.168.1.1", "192.0.2.1", "::1", "::ffff:127.0.0.1", "fc00::1", "fe80::1", "2001:db8::1", "2002:7f00:1::1"]) assert.equal(publicAddress(address), false, address);
  for (const address of ["8.8.8.8", "1.1.1.1", "2606:4700:4700::1111"]) assert.equal(publicAddress(address), true, address);
  await assert.rejects(postTrigger("http://127.0.0.1/hook", {}, "{}"), /本机|内网/);
  await assert.rejects(postTrigger("http://localhost/hook", {}, "{}"), /本机|内网/);
});

test("committed private, group and task messages trigger once; users, notices and rolled-back messages do not", async () => {
  const { store, engine, close } = await fixture();
  try {
    const e = await engine.employee.for((await engine.employee.create({ name: "小牛" }, alice.id)).id);
    const chat = await e.chat(alice.id);
    await engine.triggers.save(alice.id, input);
    await engine.triggers.save(bob.id, { ...input, url: "https://example.com/bob" });
    const sent: { url: string; body: any }[] = [];
    engine.triggers.post = async (url, _headers, body) => { sent.push({ url, body: JSON.parse(body) }); };
    engine.providers.chat = (async (_model: any, system: string) => system === NARRATOR_SYSTEM
      ? { role: "assistant", calls: [{ id: "n", name: "route_message", arguments: { targets: [], reason: "无回复" } }] }
      : { role: "assistant", model: "fixture/model", text: "私聊回复" }) as any;
    await engine.run(chat.id, { role: "user", text: "你好" });
    await until(() => sent.length === 1);
    assert.match(sent[0].body.text.content, /小牛: 私聊回复/);
    await assert.rejects(store.transaction(async () => {
      await e.toChat(chat.id, undefined, { role: "assistant", text: "回滚消息" }, false);
      throw Error("rollback");
    }), /rollback/);
    await store.transaction(async () => {
      await assert.rejects(store.transaction(async () => {
        await e.toChat(chat.id, undefined, { role: "assistant", text: "嵌套回滚消息" }, false);
        throw Error("nested rollback");
      }), /nested rollback/);
    });
    await e.toChat(chat.id, undefined, { role: "assistant", text: "任务已交付", delivery: true }, false);
    const group = await engine.groups.create(alice, { name: "项目群", employees: [e.employeeId], users: [bob.id] });
    await engine.groups.replied({ groupId: group.id } as any, e.employeeId, "群里回复", [], 1);
    await engine.groups.post({ groupId: group.id, hop: 0 } as any, e.employeeId, { role: "assistant", text: "群任务进度", stepOutput: true }, false);
    await engine.groups.send(alice, group.id, { text: "@u2 普通用户消息" });
    await until(() => sent.length === 4);
    assert(sent.every((item) => item.url === input.url), "other users' triggers must not receive this employee's messages");
    assert.deepEqual(sent.map((item) => item.body.text.content).sort(), ["小牛: 私聊回复 / ", "小牛: 任务已交付 / ", "小牛: 群里回复 / 项目群", "小牛: 群任务进度 / 项目群"].sort());
    await sleep(30);
    assert.equal(sent.length, 4);
  } finally { await close(); }
});

test("task messages include usable task links based on the owner's saved site", async () => {
  const { engine, close } = await fixture();
  try {
    const e = await engine.employee.for((await engine.employee.create({ name: "小牛" }, alice.id)).id);
    const chat = await e.chat(alice.id);
    await triggersApi(engine.triggers, alice, "POST", [], { ...input, siteOrigin: "https://attacker.example", body: JSON.stringify({ text: "{{message}}\n{{taskLinks}}" }) }, "https://vega.example");
    const sent: string[] = [];
    engine.triggers.post = async (_url, _headers, body) => { sent.push(JSON.parse(body).text); };
    await e.toChat(chat.id, undefined, { role: "assistant", text: "任务完成", tasks: [{ id: "t1", title: "一", status: "done" }, { id: "t2", title: "二", status: "done" }] }, false);
    await e.toChat(chat.id, undefined, { role: "assistant", text: "没有任务" }, false);
    await until(() => sent.length === 2);
    assert(sent.includes(`任务完成\nhttps://vega.example/employees/${e.employeeId}/tasks/t1\nhttps://vega.example/employees/${e.employeeId}/tasks/t2`));
    assert(sent.includes("没有任务\n"));
  } finally { await close(); }
});

test("a rolled-back message cannot trigger again when its sequence and timestamp are reused", async () => {
  const { store, engine, close } = await fixture();
  try {
    const e = await engine.employee.for((await engine.employee.create({ name: "小牛" }, alice.id)).id);
    const chat = await e.chat(alice.id);
    let notifications = 0;
    engine.employeeMessage = () => { notifications++; };
    const message = { role: "assistant", text: "同一条消息", at: 123456789 };
    await store.transaction(async () => {
      await assert.rejects(store.transaction(async () => {
        await e.toChat(chat.id, undefined, message, false);
        throw Error("rollback");
      }), /rollback/);
      await e.toChat(chat.id, undefined, message, false);
    });
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(notifications, 1);
  } finally { await close(); }
});

test("attachment-only and task-card messages also trigger, but empty, tool and notice messages do not", async () => {
  const { engine, close } = await fixture();
  try {
    const e = await engine.employee.for((await engine.employee.create({ name: "小牛" }, alice.id)).id);
    const chat = await e.chat(alice.id);
    await engine.triggers.save(alice.id, input);
    const sent: any[] = [];
    engine.triggers.post = async (_url, _headers, body) => { sent.push(JSON.parse(body)); };
    await e.toChat(chat.id, undefined, { role: "assistant", images: [{ mime: "image/png", data: "aW1hZ2U=" }] }, false);
    await e.toChat(chat.id, undefined, { role: "assistant", files: [{ name: "report.txt" } as any] }, false);
    await e.toChat(chat.id, undefined, { role: "assistant", tasks: [{ id: "t1", title: "任务", status: "done" }] }, false);
    await e.toChat(chat.id, undefined, { role: "assistant", text: "" }, false);
    await e.toChat(chat.id, undefined, { role: "tool", text: "内部结果" }, false);
    await e.toChat(chat.id, undefined, { role: "assistant", notice: true, text: "系统通知" }, false);
    await until(() => sent.length === 3);
    await Promise.allSettled([...engine.triggers.pending]);
    assert.deepEqual(sent.map((item) => item.text.content), ["小牛:  / ", "小牛:  / ", "小牛:  / "]);
  } finally { await close(); }
});

test("failed call status does not leak the URL or response, and calls are not replayed", async () => {
  const { engine, close } = await fixture();
  try {
    await engine.triggers.save(alice.id, input);
    let attempts = 0;
    engine.triggers.post = async (url) => { attempts++; throw Error("network failed " + url); };
    engine.triggers.fire(alice.id, { employeeId: "e", employeeName: "热心市民小周", message: "hello", groupName: "" });
    await until(() => attempts === 1);
    await Promise.allSettled([...engine.triggers.pending]);
    const item = (await engine.triggers.list(alice.id))[0];
    assert.match(item.lastResult!, /调用失败/);
    assert.equal(item.url, input.url);
    assert(!item.lastResult!.includes("secret") && !JSON.stringify(item).includes("secret-header"));
    assert.equal(attempts, 1);
  } finally { await close(); }
});

test("queue overflow is reported to the owner without sending or exposing it to other users", async () => {
  const { engine, close } = await fixture();
  try {
    for (let i = 0; i < 100; i++) engine.triggers.pending.add(Promise.resolve());
    engine.triggers.fire(alice.id, { employeeId: "e", employeeName: "热心市民小周", message: "overflow", groupName: "" });
    assert((await triggersApi(engine.triggers, alice, "GET", [], {}) as any).droppedAt > 0);
    assert.equal((await triggersApi(engine.triggers, bob, "GET", [], {}) as any).droppedAt, null);
    engine.triggers.pending.clear();
  } finally { await close(); }
});

test("HTTP saturation skips the call and records a visible result", async () => {
  const { engine, close } = await fixture();
  try {
    await engine.triggers.save(alice.id, input);
    (engine.triggers as any).inFlight = 100;
    let attempted = false;
    engine.triggers.post = async () => { attempted = true; };
    engine.triggers.fire(alice.id, { employeeId: "e", employeeName: "热心市民小周", message: "busy", groupName: "" });
    await Promise.allSettled([...engine.triggers.pending]);
    assert.equal(attempted, false);
    assert.equal((await engine.triggers.list(alice.id))[0].lastResult, "接口调用过多，本次跳过");
  } finally { await close(); }
});

test("the trigger settings route and form are available to personal settings", () => {
  assert.equal(formatRoute(parseRoute("/settings/triggers")), "/settings/triggers");
  const settings = readFileSync("web/src/SettingsView.vue", "utf8"), component = readFileSync("web/src/TriggerSettings.vue", "utf8");
  assert.match(settings, /TRIGGERS.*触发器/);
  assert.match(component, /热心市民发送消息/);
  assert.match(component, /调用接口（POST JSON）/);
  assert.match(component, /\{\{message\}\}/);
});
