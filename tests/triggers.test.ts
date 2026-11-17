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
    assert(!JSON.stringify(item).includes("secret"));
    const saved = await store.object<any>("trigger:user:u1", item.id);
    assert(!JSON.stringify(saved).includes("key=secret") && !JSON.stringify(saved).includes("secret-header"));
    assert.equal((await triggersApi(engine.triggers, bob, "GET", [], {}) as any).triggers.length, 0);
    await assert.rejects(triggersApi(engine.triggers, bob, "PATCH", [item.id], { enabled: false }), /不存在/);
    await assert.rejects(triggersApi(engine.triggers, { ...alice, role: "viewer" }, "GET", [], {}), /只读/);
    await assert.rejects(triggersApi(engine.triggers, alice, "POST", [], { ...input, name: "bad", url: "http://127.0.0.1/" }), /内网|本机/);
    await assert.rejects(triggersApi(engine.triggers, alice, "POST", [], { ...input, body: '{"x":{{message}}}' }), /JSON/);
    await assert.rejects(triggersApi(engine.triggers, alice, "POST", [], { ...input, headers: '{"Host":"internal"}' }), /请求头/);
    await triggersApi(engine.triggers, alice, "POST", [], { ...input, id: item.id, url: "", headers: "", name: "改名" });
    const sent: any[] = [];
    engine.triggers.post = async (url, headers, body) => { sent.push({ url, headers, body: JSON.parse(body) }); };
    engine.triggers.fire(alice.id, { employeeId: "e", employeeName: "牛马", message: '引号"\n换行', groupName: "" });
    await until(() => sent.length === 1);
    assert.equal(sent[0].url, input.url);
    assert.equal(sent[0].headers.Authorization, "Bearer secret-header");
    assert.equal(sent[0].body.text.content, '牛马: 引号"\n换行 / ');
    await triggersApi(engine.triggers, alice, "PATCH", [item.id], { enabled: false });
    engine.triggers.fire(alice.id, { employeeId: "e", employeeName: "牛马", message: "disabled", groupName: "" });
    await Promise.allSettled([...engine.triggers.pending]);
    assert.equal(sent.length, 1);
    await triggersApi(engine.triggers, alice, "DELETE", [item.id], {});
    assert.deepEqual(await engine.triggers.list(alice.id), []);
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

test("failed calls are visible without leaking their URL or response, and are not replayed", async () => {
  const { engine, close } = await fixture();
  try {
    await engine.triggers.save(alice.id, input);
    let attempts = 0;
    engine.triggers.post = async (url) => { attempts++; throw Error("network failed " + url); };
    engine.triggers.fire(alice.id, { employeeId: "e", employeeName: "牛马", message: "hello", groupName: "" });
    await until(() => attempts === 1);
    await Promise.allSettled([...engine.triggers.pending]);
    const item = (await engine.triggers.list(alice.id))[0];
    assert.match(item.lastResult!, /调用失败/);
    assert(!JSON.stringify(item).includes("secret"));
    assert.equal(attempts, 1);
  } finally { await close(); }
});

test("queue overflow is reported to the owner without sending or exposing it to other users", async () => {
  const { engine, close } = await fixture();
  try {
    for (let i = 0; i < 100; i++) engine.triggers.pending.add(Promise.resolve());
    engine.triggers.fire(alice.id, { employeeId: "e", employeeName: "牛马", message: "overflow", groupName: "" });
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
    engine.triggers.fire(alice.id, { employeeId: "e", employeeName: "牛马", message: "busy", groupName: "" });
    await Promise.allSettled([...engine.triggers.pending]);
    assert.equal(attempted, false);
    assert.equal((await engine.triggers.list(alice.id))[0].lastResult, "接口调用过多，本次跳过");
  } finally { await close(); }
});

test("the trigger settings route and form are available to personal settings", () => {
  assert.equal(formatRoute(parseRoute("/settings/triggers")), "/settings/triggers");
  const settings = readFileSync("web/src/SettingsView.vue", "utf8"), component = readFileSync("web/src/TriggerSettings.vue", "utf8");
  assert.match(settings, /TRIGGERS.*触发器/);
  assert.match(component, /牛马发送消息/);
  assert.match(component, /调用接口（POST JSON）/);
  assert.match(component, /\{\{message\}\}/);
});
