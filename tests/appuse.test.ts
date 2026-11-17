import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { LocalAgents } from "../server/core/local-agent";
import { Tools } from "../server/core/tools";
import { Store } from "../server/core/store";
import { APPUSE_TOOLS, appuseArguments, normalizeDesktopAction } from "../server/core/appuse-tools";
import { DesktopObservations } from "../server/core/desktop-observations";

const client = { instance: "a".repeat(32), clientId: "b".repeat(32), name: "笔记本", platform: "windows", cwd: "C:\\client" };
const png = Buffer.from("fake-png");

async function setup(t: any) {
  const store = await Store.open(":memory:"), hub = new LocalAgents();
  hub.connect("alice", client, { send() {}, close() {} });
  t.after(async () => { hub.close(); await store.close(); });
  const session = await store.newSession({ ownerId: "alice", cwd: client.cwd, localAgent: true, localPlatform: "windows", clientId: client.clientId });
  const engine = { store, localAgents: hub, desktopObservations: new DesktopObservations(), mcpFor: () => ({}) };
  const tools = await Tools.create(engine as any, session, { model: "", provider: {} }, new AbortController().signal, () => {});
  return { store, hub, session, tools, engine };
}

test("desktop tools are the nine narrow ones, listed only in a Windows client session", async (t) => {
  const { store, tools } = await setup(t);
  const names = (await tools.definitions()).map((tool) => tool.name);
  assert.deepEqual([...APPUSE_TOOLS].sort(), names.filter((name) => name.startsWith("appuse_")).sort());
  assert.equal(APPUSE_TOOLS.size, 9);
  assert.match(await tools.rules(), /\[桌面操作\]/);
  // 单个 appuse 已不再列出：模型乱塞字段的根因就是那个扁平 schema。
  assert(!names.includes("appuse"));
  const server = await Tools.create({ store, localAgents: new LocalAgents(), mcpFor: () => ({}) } as any, await store.newSession({ ownerId: "alice" }), { model: "", provider: {} }, new AbortController().signal, () => {});
  assert(!(await server.definitions()).some((tool) => tool.name.startsWith("appuse_")));
  assert.doesNotMatch(await server.rules(), /\[桌面操作\]/);
  const linux = await Tools.create({ store, localAgents: new LocalAgents(), mcpFor: () => ({}) } as any, await store.newSession({ ownerId: "alice", localAgent: true, localPlatform: "linux", clientId: client.clientId, cwd: "/home/alice" }), { model: "", provider: {} }, new AbortController().signal, () => {});
  assert(!(await linux.definitions()).some((tool) => tool.name.startsWith("appuse_")));
});

test("elements are read-only queries and physical screen input is validated before dispatch", async (t) => {
  const { hub, tools } = await setup(t);
  let seen: any, calls = 0;
  (hub as any).request = async (_agent: unknown, _op: string, args: any) => { calls++; seen = args; return { elements: [], truncated: true }; };
  const result = await tools.execute({ id: "tree", name: "appuse_elements", arguments: { windowId: 42, depth: 4, maxItems: 60, filter: "Save" } }, {} as any);
  assert.equal(seen.operation, "elements");
  assert.equal(seen.windowId, 42);
  assert.equal(result.value.truncated, true);
  const actions = [{ action: "click", x: -120, y: 20 }];
  await tools.execute({ id: "screen", name: "appuse_act", arguments: { coordinateSpace: "screen", actions } }, {} as any);
  assert.equal(seen.coordinateSpace, "screen");
  assert.equal(seen.actions[0].x, -120);
  const before = calls;
  for (const arguments_ of [
    { coordinateSpace: "screen", snapshotId: "old", actions },
    { coordinateSpace: "screen", imageId: "old", actions },
    { coordinateSpace: "screen", background: true, actions },
    { coordinateSpace: "screen", actions: [{ action: "press", key: "Enter" }] },
    { actions },
  ]) await assert.rejects(tools.execute({ id: "bad", name: "appuse_act", arguments: arguments_ }, {} as any));
  for (const arguments_ of [{ x: 1 }, { x: 1, y: 2, windowId: 42 }, { depth: 21 }, { maxItems: 201 }])
    await assert.rejects(tools.execute({ id: "bad-tree", name: "appuse_elements", arguments: arguments_ }, {} as any));
  assert.equal(calls, before, "invalid requests never reach the client");
});

test("screenshot capture kinds map onto the executor without changing region spaces", () => {
  const owner = "session-1";
  assert.deepEqual(appuseArguments("appuse_windows", { query: "Nova", observe: true }, owner), { operation: "windows", query: "Nova", observe: true, owner });
  // appuse_window-only 选项不再让别的操作整批退回，但它们也不会被翻译进截图/输入。
  assert.deepEqual(appuseArguments("appuse_activate", { windowId: 42 }, owner), { operation: "activate", windowId: 42, owner });
  const desktop = appuseArguments("appuse_screenshot", { capture: { kind: "desktop" } }, owner);
  assert.equal(desktop.operation, "screenshot");
  assert.equal(desktop.regionSpace, undefined);
  const imageRegion = appuseArguments("appuse_screenshot", {
    capture: { kind: "image_region", snapshotId: "s", imageId: "i", region: { x: 0, y: 1, width: 2, height: 3 } },
  }, owner);
  assert.equal(imageRegion.regionSpace, "image");
  assert.equal(imageRegion.snapshotId, "s");
  const windowRegion = appuseArguments("appuse_screenshot", {
    capture: { kind: "window_region", windowId: 1, region: { x: 0, y: 1, width: 2, height: 3 } },
  }, owner);
  assert.equal(windowRegion.regionSpace, "source");
  assert.equal(windowRegion.windowId, 1);
  const act = appuseArguments("appuse_act", { actions: [{ action: "wait", ms: 10 }] }, owner);
  assert.equal(act.operation, "act");
  assert.equal(act.actions.length, 1);
});

test("desktop dispatch binds the owner and stores returned screenshots as session files", async (t) => {
  const { hub, session, tools } = await setup(t);
  let seen: { op?: string; args?: any } = {};
  (hub as any).request = async (_agent: unknown, op: string, args: any) => {
    seen = { op, args };
    return { snapshotId: "snap1", images: [{ imageId: "monitor-0", mime: "image/png", path: "C:\\shots\\monitor-0.png", data: png.toString("base64") }] };
  };
  const result = await tools.execute({ id: "shot", name: "appuse_screenshot", arguments: { capture: { kind: "monitor", monitorId: 0 } } }, {} as any);
  assert.equal(seen.op, "appuse");
  assert.equal(seen.args.owner, session.id);
  assert.equal(seen.args.monitorId, 0);
  assert.equal(seen.args.operation, "screenshot");
  const image = result.images![0];
  assert.equal(image.mime, "image/png");
  assert.match(image.url!, /^\/api\/files\//);
  assert((await readFile(image.path!)).equals(png));
  // The base64 payload is dropped from the tool result; only the saved path and URL stay.
  assert.equal(result.value.images[0].data, undefined);
  assert.equal(result.value.images[0].path, image.path);
});

test("weak-model action shapes are normalized instead of bounced", () => {
  // 动作名写在 type 上。
  assert.deepEqual(normalizeDesktopAction({ type: "left_click", x: 1, y: 2 }), { action: "click", x: 1, y: 2 });
  // 别名与字符串/小数坐标。
  assert.deepEqual(normalizeDesktopAction({ action: "tap", x: "10", y: 20.4 }), { action: "click", x: 10, y: 20 });
  assert.deepEqual(normalizeDesktopAction({ action: "hover", x: 1, y: 2 }), { action: "move", x: 1, y: 2 });
  assert.deepEqual(normalizeDesktopAction({ action: "sendkeys", keys: "ctrl+s" }), { action: "press", key: "ctrl+s" });
  assert.deepEqual(normalizeDesktopAction({ action: "write", value: "你好" }), { action: "type", text: "你好" });
  assert.deepEqual(normalizeDesktopAction({ action: "sleep", duration_ms: "500" }), { action: "wait", ms: 500 });
  assert.deepEqual(normalizeDesktopAction({ action: "dragto", x: 0, y: 0, to_x: 5, to_y: 6 }), { action: "drag", x: 0, y: 0, toX: 5, toY: 6 });
  // press 只给 text / type 只给 key：只有一种意思。
  assert.deepEqual(normalizeDesktopAction({ action: "press", text: "Enter" }), { action: "press", key: "Enter" });
  assert.deepEqual(normalizeDesktopAction({ action: "type", key: "Enter" }), { action: "press", key: "Enter" });
  // 真正说不清的写法不能被动过：没有动作名就原样留下，交给 schema 报错。
  assert.deepEqual(normalizeDesktopAction({ x: 1, y: 2 }), { x: 1, y: 2 });
  // 已经规范的形状不动。
  const clean = { action: "click", x: 1, y: 2, button: "right" };
  assert.deepEqual(normalizeDesktopAction(clean), clean);
});

test("normalized shapes still pass the narrow schema, ambiguous ones do not", async (t) => {
  const { hub, tools } = await setup(t);
  let seen: any = {};
  (hub as any).request = async (_a: unknown, _op: string, args: any) => { seen = args; return { status: "executed", completedActions: 1 }; };
  await tools.execute({ id: "a", name: "appuse_act", arguments: { actions: [{ type: "left_click", x: "3", y: 4.6 }] } }, {} as any);
  assert.equal(seen.actions[0].action, "click");
  assert.equal(seen.actions[0].x, 3);
  assert.equal(seen.actions[0].y, 5);
  await assert.rejects(() => tools.execute({ id: "b", name: "appuse_act", arguments: { actions: [{ x: 1, y: 2 }] } }, {} as any), /action/);
});

test("a stray field is rejected against the narrow schema before any desktop work", async (t) => {
  const { hub, tools } = await setup(t);
  let called = false;
  (hub as any).request = async () => { called = true; return {}; };
  // 旧单个 appuse 会把 observe 塞给 activate；窄工具里它根本不属于该工具的参数。
  await assert.rejects(
    () => tools.execute({ id: "x", name: "appuse_activate", arguments: { windowId: 1, observe: false } }, {} as any),
    /不接受字段 observe/,
  );
  assert.equal(called, false);
});

test("desktop experience save and feedback verify the actual latest session window", async (t) => {
  const { store, hub, session, tools, engine } = await setup(t);
  let valid = true, checks = 0;
  (hub as any).request = async (_agent: unknown, op: string, args: any) => {
    assert.equal(op, "appuse");
    assert.equal(args.owner, session.id);
    if (args.operation === "windows") return {
      windows: [{ windowId: 42, app: "Editor", title: "Document" }],
      windowId: 42, historical: false, snapshotId: "snap-1", images: [{ imageId: "monitor-0" }],
    };
    if (args.operation === "elements") {
      checks++;
      assert.equal(args.windowId, 42);
      assert.equal(args.snapshotId, "snap-1");
      return valid ? { windowId: 42, app: "Editor", title: "Document" } : { error: "快照已失效" };
    }
    if (args.operation === "act") { valid = false; return { status: "executed", completedActions: 1 }; }
    throw Error("unexpected desktop request");
  };
  const save = { scope: "Editor", task: "Save a document", conditions: ["Document open"], steps: ["Save", "Confirm"], checks: ["Saved"], evidence: "Saved", redacted: true };
  await assert.rejects(tools.execute({ id: "before", name: "appuse_experience_save", arguments: save }, {} as any), /目标窗口截图/);
  await tools.execute({ id: "observe", name: "appuse_windows", arguments: { windowId: 42, observe: true } }, {} as any);
  const saved = await tools.execute({ id: "save", name: "appuse_experience_save", arguments: save }, {} as any);
  assert.equal(saved.value.saved, true);
  assert.equal((await store.objects("experience:desktop:alice")).length, 1);
  assert.equal((await store.objects("experience")).length, 0);
  const feedback = { snapshotId: "snap-1", routeId: saved.value.experience.id, scope: "Editor", task: save.task, outcome: "success", reason: "confirmed", evidence: "Saved", redacted: true };
  assert.equal((await tools.execute({ id: "feedback", name: "appuse_experience_feedback", arguments: feedback }, {} as any)).value.saved, true);
  assert.equal(checks, 2);
  await assert.rejects(tools.execute({ id: "stale", name: "appuse_experience_save", arguments: { ...save, snapshotId: "old" } }, {} as any), /snapshotId/);
  await assert.rejects(tools.execute({ id: "wrong-app", name: "appuse_experience_save", arguments: { ...save, scope: "Other" } }, {} as any), /scope/);
  const otherSession = await store.newSession({ ownerId: "alice", cwd: client.cwd, localAgent: true, localPlatform: "windows", clientId: client.clientId });
  const other = await Tools.create(engine as any, otherSession, { model: "", provider: {} }, new AbortController().signal, () => {});
  await assert.rejects(other.execute({ id: "other", name: "appuse_experience_save", arguments: save }, {} as any), /目标窗口截图/);
  await tools.execute({ id: "input", name: "appuse_act", arguments: { feedback: "none", actions: [{ action: "click", x: 1, y: 1 }] } }, {} as any);
  await assert.rejects(tools.execute({ id: "invalidated", name: "appuse_experience_save", arguments: save }, {} as any), /快照已失效/);
});
