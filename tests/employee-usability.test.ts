import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, rm, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { extensionDirectory } from "../server/core/headless";
import { Store } from "../server/core/store";
import { Engine } from "../server/core/engine";
import { Catalog } from "../server/core/catalog";
import { Subscriptions } from "../server/core/subscriptions";
import { Chrome } from "../server/core/chrome";
import { ChromeBridge } from "../server/core/chrome-bridge";
import { Auth } from "../server/core/auth";
import { Tools } from "../server/core/tools";
import { LocalAgentUnavailable } from "../server/core/local-agent";
import { employeeCall } from "./public-call";

async function fixture() {
  const store = await Store.open(":memory:");
  const engine = await Engine.create(store, new Catalog(store, new Subscriptions(store, "")), new Chrome(store, new ChromeBridge(), ""));
  engine.employee.closed = true;
  await store.put("config", { scenes: { lightweight: ["fixture/model"], coding: ["fixture/model"], computer: ["fixture/model"] }, model: "fixture/model", provider: {} });
  return { store, engine };
}
async function add(employee: Engine["employee"], text = "work") {
  const created = await employee.execute("", { action: "add", kind: "todo", text });
  return employee.task(await employee.state(), created.value.id);
}

test("browser extension is resolved from source or packaged assets, never the workspace cwd", async () => {
  const dir = await mkdtemp(join(tmpdir(), "vega-extension-layout-"));
  try {
    for (const [asset, module, entry] of [
      ["source/local/extension/vega-chrome", "source/server/core/headless.ts", "source/server/index.ts"],
      ["built/.output/public/extension/vega-chrome", "built/.output/server/chunks/_/nitro.mjs", "built/.output/server/index.mjs"],
      ["container/extension", "container/.output/server/chunks/_/nitro.mjs", "container/.output/server/index.mjs"],
    ]) {
      const path = join(dir, asset);
      await mkdir(path, { recursive: true });
      await writeFile(join(path, "manifest.json"), "{}");
      await writeFile(join(path, "worker.js"), "// fixture");
      assert.equal(extensionDirectory(pathToFileURL(join(dir, module)).href, join(dir, entry)), path);
    }
    assert.throws(() => extensionDirectory(pathToFileURL(join(dir, "missing/core/module.js")).href, join(dir, "missing/main.mjs")), /完整部署/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("employees belong to their owner: nobody else, not even an administrator, sees or manages them", async () => {
  const { store, engine } = await fixture(), auth = new Auth(store, "test-token-at-least-16-characters");
  try {
    const mine = await engine.employee.for((await engine.employee.create({ name: "Admin's" }, "admin")).id);
    const personal = await engine.employee.for((await engine.employee.create({ name: "Private" }, "alice")).id);
    const alice = { id: "alice", role: "operator" } as any, bob = { id: "bob", role: "operator" } as any, viewer = { id: "viewer", role: "viewer" } as any, admin = { id: "admin", role: "admin" } as any;
    for (const user of [alice, bob, viewer]) assert(!await mine.accessible(user) && !await mine.manageable(user));
    assert(await mine.manageable(admin));
    assert(await personal.accessible(alice) && await personal.manageable(alice));
    assert(!await personal.accessible(admin) && !await personal.manageable(admin));
    assert(!await personal.accessible(bob) && !await personal.accessible(viewer));
    const privateSession = await personal.chat("alice");
    assert(await auth.canRead(alice, privateSession));
    assert(!await auth.canRead(admin, privateSession) && !await auth.canRead(bob, privateSession) && !await auth.canRead(viewer, privateSession));
    assert.equal("scope" in await engine.employee.state(), false, "there is no team scope any more");
  } finally { await engine.close(); await store.close(); }
});

test("employees are immediately available even with legacy disabled hours, and duty config is gone", async () => {
  const { store, engine } = await fixture();
  try {
    await engine.employee.update((state) => { state.enabled = false; state.workStart = "23:58"; state.workEnd = "23:59"; });
    assert.equal((await engine.employee.state()).enabled, true);
    assert.equal((await engine.employee.state()).workStart, "00:00");
    const employee = await engine.employee.for((await engine.employee.create({ name: "Ready" }, "alice")).id);
    await assert.rejects(() => employee.execute("", { action: "add", kind: "duty", text: "manual work", manual: true }), /职责配置已移除/);
    engine.employee.closed = false;
    await employee.tick();
    engine.employee.closed = true;
    const state = await employee.state();
    assert.equal(state.tasks.length, 0);
    assert.equal("duties" in state, false);
    const job = await add(employee);
    assert.equal(job.status, "queued");
  } finally { await engine.close(); await store.close(); }
});

test("new tasks run on the cloud; resumed and child tasks keep their bound execution", async () => {
  const { store, engine } = await fixture();
  const client = { instance: "a".repeat(32), clientId: "d".repeat(32), name: "Office PC", cwd: "C:\\client-only", platform: "windows" };
  try {
    const employee = await engine.employee.for((await engine.employee.create({ name: "Developer" }, "alice")).id);
    engine.localAgents.connect("alice", client);
    // 新任务默认云端执行，不再要求配置 Master。
    const original = await add(employee, "server work");
    assert.equal(original.execution?.localAgent, false);
    assert.equal(original.execution?.clientId, undefined);
    // 已绑定到客户端的任务（例如交接后）不跟着连接状态变；子任务继承父任务执行位置。
    const local = await add(employee, "client work");
    await employee.update((state) => {
      const task = employee.task(state, local.id);
      task.execution = { localAgent: true, localBrowser: true, clientId: client.clientId, browserClientId: client.clientId, clientName: client.name, browserClientName: client.name, localPlatform: client.platform, ownerId: "alice" };
      task.cwd = client.cwd;
      task.status = "running";
    });
    employee.busy.set(local.id, { computer: false, session: "" });
    const child = await employee.execute(local.id, { action: "add", kind: "todo", text: "child inherits client" });
    assert.equal(employee.task(await employee.state(), child.value.id).execution?.localAgent, true);
    assert.equal(employee.task(await employee.state(), child.value.id).execution?.clientId, client.clientId);
    // 断开后绑定的客户端不改绑到云端，回连后仍在原设备续做。
    engine.localAgents.disconnect("alice");
    assert.equal(employee.task(await employee.state(), local.id).execution?.clientId, client.clientId);
  } finally { engine.active.clear(); (await engine.employee.all()).forEach((employee) => employee.busy.clear()); await engine.close(); await store.close(); }
});

test("employee deletion removes its sessions/profile and its own vault and survives restart without deleting project files or other employees", async () => {
  const dir = await mkdtemp(join(tmpdir(), "vega-delete-employee-")), previous = process.env.VEGA_DB;
  process.env.VEGA_DB = join(dir, "database.db");
  const { store, engine } = await fixture();
  try {
    const a = await engine.employee.for((await engine.employee.create({ name: "Remove", cwd: dir }, "alice")).id), b = await engine.employee.for((await engine.employee.create({ name: "Keep", cwd: dir }, "alice")).id);
    const job = await add(a), chat = await a.chat("alice");
    const legacy = await store.newSession({ taskId: job.id, employeeId: a.employeeId, cwd: dir });
    await a.update((state) => { state.tasks[0].workSession = legacy.id; });
    await store.append(legacy.id, { role: "assistant", text: "private record" });
    // 浏览器配置按账号共享：删除一位热心市民不会清除同一账号的登录数据。
    const profile = engine.browsers.profile(engine.browserProfileKey("alice"));
    await mkdir(profile, { recursive: true }); await writeFile(join(profile, "Cookies"), "private");
    await writeFile(join(dir, "project.txt"), "keep");
    const credential = await a.vault.save({ name: "removed with A", condition: "authorized", content: "gone" }), kept = await b.vault.save({ name: "B own", condition: "authorized", content: "keep" });
    engine.active.set(chat.id, { control: new AbortController(), steer: [] });
    await assert.rejects(engine.removeEmployee(a.employeeId), /先停止/);
    assert.equal(a.deleting, false);
    engine.active.clear();
    await engine.removeEmployee(a.employeeId);
    await assert.rejects(async () => await engine.employee.for(a.employeeId), /not found/);
    await assert.rejects(async () => await store.session(chat.id), /not found/);
    await assert.rejects(async () => await store.session(legacy.id), /not found/);
    await access(profile);
    assert.equal(await readFile(join(profile, "Cookies"), "utf8"), "private", "删除热心市民不会清除账号共享的浏览器配置");
    assert.equal(await readFile(join(dir, "project.txt"), "utf8"), "keep");
    assert.deepEqual((await engine.vault.book("alice").list()).map((entry: any) => entry.id), [kept.id], "deleting A drops only the entry scoped to it, in the shared account book");
    assert(!(await b.vault.list()).some((entry) => entry.id === credential.id));
    assert.deepEqual((await b.vault.list()).map((entry) => entry.id), [kept.id]);
    assert.equal((await (await engine.employee.for(b.employeeId)).state()).name, "Keep");
    await engine.removeEmployee("default");
    assert(!(await engine.employee.all()).some((employee) => employee.employeeId === "default"));
    await engine.employee.start(); engine.employee.close();
    assert(!(await engine.employee.all()).some((employee) => employee.employeeId === "default"));
    await assert.rejects(engine.browsers.get(a.employeeId), /Employee not found|deleted/);
    await assert.rejects(async () => await a.update(() => {}), /being deleted/i);
  } finally {
    engine.active.clear(); await engine.close(); await store.close();
    if (previous === undefined) delete process.env.VEGA_DB; else process.env.VEGA_DB = previous;
    await rm(dir, { recursive: true, force: true });
  }
});

test("a task can reschedule only itself", async () => {
  const { store, engine } = await fixture();
  try {
    const employee = await engine.employee.for((await engine.employee.create({ name: "Planner" }, "alice")).id);
    const job = await add(employee, "call back later");
    const other = await add(employee, "someone else");
    const session = await store.newSession({ employeeId: employee.employeeId, taskId: job.id, cwd: job.cwd, ownerId: "alice" });
    await employee.update((state) => { state.tasks.find((t) => t.id === job.id)!.status = "running"; state.tasks.find((t) => t.id === job.id)!.workSession = session.id; });
    employee.busy.set(job.id, { session: session.id, computer: false });
    const tools = await Tools.create(engine, session, await engine.config(), new AbortController().signal, () => {});
    assert((await tools.definitions({} as any)).some((t) => t.name === "task_reschedule"));
    const before = Date.now();
    await tools.execute({ id: "r", name: "task_reschedule", arguments: { delayMinutes: 90 } }, {} as any);
    const moved = employee.task(await employee.state(), job.id);
    assert.equal(moved.status, "deferred");
    assert(moved.nextCheckAt >= before + 89 * 60_000 && moved.nextCheckAt <= Date.now() + 91 * 60_000);
    assert.equal(employee.task(await employee.state(), other.id).status, "queued", "other tasks are untouched");
  } finally { await engine.close(); await store.close(); }
});

test("one update changes several task fields together, or none", async () => {
  const { store, engine } = await fixture();
  try {
    const employee = await engine.employee.for((await engine.employee.create({ name: "Multi" }, "alice")).id);
    const tools = await Tools.create(engine, await employee.chat("alice"), await engine.config(), new AbortController().signal, () => {});
    tools.actorId = "alice";
    const job = await add(employee, "old task");
    await tools.execute({ id: "t", name: "employee_task_manage", arguments: { taskId: job.id, request: { command: "update", instructions: "new task", profile: "coding", delayMinutes: 60 } } }, {} as any);
    const moved = employee.task(await employee.state(), job.id);
    assert.deepEqual([moved.text, moved.profile, moved.status], ["new task", "coding", "queued"]);
    assert(moved.nextCheckAt > Date.now() + 59 * 60_000);
    await assert.rejects(tools.execute({ id: "past", name: "employee_task_manage", arguments: { taskId: job.id, request: { command: "update", instructions: "zzz", runAt: "2001-01-01 09:00" } } }, {} as any), /未来/);
    assert.equal(employee.task(await employee.state(), job.id).text, "new task", "the executor applies all parts or none");
  } finally { await engine.close(); await store.close(); }
});

test("a task whose client drops recovers on that same device instead of asking the user, and never elsewhere", async () => {
  const { store, engine } = await fixture();
  const client = { instance: "a".repeat(32), clientId: "d".repeat(32), name: "Office PC", cwd: "C:\\client-only", platform: "windows" };
  try {
    engine.localAgents.connect("alice", client);
    const employee = await engine.employee.for((await engine.employee.create({ name: "Recover" }, "alice")).id);
    const job = await add(employee, "client work");
    // 任务已绑定到这台客户端（交接后的状态）：掉线就在原设备恢复，不换端。
    await employee.update((state) => { employee.task(state, job.id).execution = { localAgent: true, clientId: client.clientId, clientName: client.name, localPlatform: client.platform, ownerId: "alice" }; });
    assert.equal(employee.task(await employee.state(), job.id).execution?.clientId, client.clientId);
    const session = await store.newSession({ taskId: job.id, employeeId: employee.employeeId, ownerId: "alice", cwd: job.cwd, localAgent: true, clientId: client.clientId, scene: "lightweight", model: "fixture/model" });
    await employee.update((state) => { const task = employee.task(state, job.id); task.workSession = session.id; task.status = "running"; });
    engine.localAgents.disconnect("alice");
    let operations = 0;
    engine.localAgents.request = async () => { operations++; throw new LocalAgentUnavailable(); };
    engine.catalog.resolve = async () => ({ selection: "fixture/model", contextWindow: 128000, maxOutputTokens: 1024 }) as any;
    engine.providers.chat = async () => ({ role: "assistant", calls: [{ id: "first", name: "bash", arguments: { command: "fixture" } }] });
    await engine.run(session.id, { role: "user", text: "run fixture" });
    const paused = employee.task(await employee.state(), job.id);
    assert.equal(operations, 0, "an offline device gets no operations, not even a probe");
    assert.equal(paused.status, "recovering");
    assert.equal(paused.recovery.attempts, 1);
    assert.equal(paused.recovery.waitClient, client.clientId);
    assert(!paused.waiting, "a dropped device is not a question for the user");
    assert.match((await store.messages(session.id)).at(-1)!.text!, /已进入自动恢复/);
    // 离线期间不派发，也不白白花掉恢复次数
    await employee.tick();
    assert.equal(employee.busy.size, 0);
    assert.equal(employee.task(await employee.state(), job.id).recovery.attempts, 1);
    // 回连后回到调度器，在同一台设备续做
    let resumed = 0;
    employee.run = async () => { resumed++; };
    engine.localAgents.connect("alice", client);
    await employee.tick();
    assert.equal(resumed, 1);
  } finally { engine.active.clear(); (await engine.employee.all()).forEach((member) => member.busy.clear()); await engine.close(); await store.close(); }
});
