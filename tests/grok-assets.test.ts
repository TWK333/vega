import { test } from "node:test";
import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import postcss from "postcss";
import vm from "node:vm";
import { brotliDecompressSync } from "node:zlib";
import { createHash } from "node:crypto";

const resources = "local/resources/grok";

// Only public renderer assets are imported, never the original application's user data.
test("renderer assets match the original Grok Bot 1.1.0 release byte for byte", () => {
  const lines = readFileSync("tests/grok-renderer-1.1.0.sha256", "utf8").trim().split(/\r?\n/);
  assert.equal(lines.length, 696);
  for (const line of lines) {
    const [expected, path] = line.split("  ");
    assert.equal(createHash("sha256").update(readFileSync(join(resources, path))).digest("hex"), expected, path);
  }
  const html = readFileSync(join(resources, "index.html"), "utf8");
  assert.match(html, /data-vega-entry="\.\/assets\/index-DcdocK0f\.js"/);
  assert.match(html, /index-BkOHlEB9\.css/);
  assert.match(html, /grok_bridge\.js/);
  assert.doesNotMatch(html, /<script[^>]+src="\.\/assets\/index-DcdocK0f\.js"/, "the renderer must wait for the local device authorization check");
});

test("embedded desktop JavaScript parses as browser modules", () => {
  execFileSync(process.execPath, ["--experimental-vm-modules", "--input-type=module", "-e", `
    import { readdirSync, readFileSync } from 'node:fs';
    import { join } from 'node:path';
    import { SourceTextModule } from 'node:vm';
    const directory = 'local/resources/grok/assets';
    for (const name of readdirSync(directory).filter(name => name.endsWith('.js'))) {
      new SourceTextModule(readFileSync(join(directory, name), 'utf8'), { identifier: name });
    }
  `], { stdio: "pipe" });
});

test("desktop always keeps the new interface instead of redirecting to legacy", () => {
  const html = readFileSync(join(resources, "index.html"), "utf8");
  assert.doesNotMatch(html, /legacy=1|vega-boot-recovery/);
});

function bridge(dark = true, nativeHost = false, respond?: (url: string, body: any, signal: AbortSignal) => any, saved: Record<string, string> = {}) {
  const requests: { url: string; body: any }[] = [], replies: any[] = [], events: any[] = [], native: string[] = [];
  const listeners: Record<string, (event: any) => void> = {}, documentListeners: Record<string, (event: any) => void> = {};
  let port: any;
  const storage: Record<string, any> = { ...saved };
  Object.defineProperties(storage, {
    getItem: { value: (key: string) => storage[key] ?? null },
    setItem: { value: (key: string, value: string) => { storage[key] = value; } },
    removeItem: { value: (key: string) => { delete storage[key]; } },
  });
  let ok = true, timerId = 0;
  const timers = new Map<number, () => unknown>();
  const window: any = {
    location: { pathname: "/assistant/test/" }, devicePixelRatio: 2, vegaPanelDpiScale: 2,
    addEventListener: (type: string, listener: (event: any) => void) => { listeners[type] = listener; },
    matchMedia: () => ({ matches: dark, addEventListener() {} }),
    ...(nativeHost ? { chrome: { webview: { postMessage: (message: string) => native.push(message) } } } : {}),
  };
  const document = { hidden: false, hasFocus: () => true, getElementById: () => null, addEventListener: (type: string, listener: (event: any) => void) => { documentListeners[type] = listener; } };
  window.document = document;
  vm.runInNewContext(readFileSync(join(resources, "grok_bridge.js"), "utf8"), {
    window, document,
    getComputedStyle: (element: any) => ({ getPropertyValue: (property: string) => property === "--sand-app-region" ? element.region : "none" }),
    localStorage: storage, console: { log() {}, error() {} },
    setTimeout: (fn: () => unknown) => { timers.set(++timerId, fn); return timerId; },
    clearTimeout: (id: number) => timers.delete(id), setInterval: () => 1, clearInterval() {},
    AbortController,
    MessageChannel: class {
      port1 = { postMessage() {}, start() {}, close() {}, addEventListener() {} };
      port2 = port = { postMessage: (reply: any) => { (reply.kind === "event" ? events : replies).push(reply); } };
    },
    fetch: async (url: string, options: any) => {
      requests.push({ url, body: JSON.parse(options.body) });
      if (respond) return respond(url, JSON.parse(options.body), options.signal);
      return { ok, json: async () => url.endsWith("threads")
        ? { employees: [{ id: "e1", name: "热心市民小周", thread: "employee:e1", unread: 2, lastViewedAt: 930, lastText: "最新进展", lastAt: 1200, avatar: "bot:round:purple" }] }
        : url.endsWith("messages") ? { messages: [{ seq: 12, role: "assistant", text: "新版消息", at: 1000 }], readSeq: 0 } : { ok } };
    },
  });
  return {
    desktop: window.desktop, requests, events, storage,
    native, window, listeners, documentListeners,
    fail: () => { ok = false; },
    tick: async () => { const ready = [...timers.values()]; timers.clear(); await Promise.all(ready.map((fn) => fn())); },
    request: async (method: string, args: any = {}) => {
      await port.onmessage({ data: { kind: "request", requestId: "test", method, args } });
      return replies.pop().outcome;
    },
  };
}

test("new renderer bridge boots synchronously and preserves persistence scope", async () => {
  const { desktop } = bridge();
  assert.equal(typeof desktop.main.subscribe({ "theme-changed"() {} }), "function");
  assert.equal(desktop.boot.theme.preference, "system");
  assert.equal(desktop.boot.theme.resolved, "dark");
  assert.equal(desktop.boot.experiments.featureGates.sand_xvf_typeface, true);
  assert.equal((await desktop.main.getExperimentsSnapshot()).featureGates.sand_chat_prose_15px, true);
  assert.equal((await desktop.main.getThemeState()).resolved, "dark");
  assert.equal((await desktop.main.getLanguageState()).resolved, "zh-CN");
  assert.equal((await desktop.main.getUpdateStatus()).state.type, "disabled");
  assert.equal(JSON.stringify(await desktop.main.getLocalPitmanState()), '{"isRecorderReady":false,"session":null}');
  for (const method of ["getSandAccess", "getSandAccessFresh"]) {
    assert.equal((await desktop.main[method]()).speechUiHidden, true);
  }
  assert.equal(desktop.boot.experiments.featureGates.grok_bot_files_stage, true);
  assert.equal(desktop.boot.experiments.featureGates.sand_grok_main_agent, true);
  await desktop.main.writeClientPersistence({ key: "kept/a", value: "yes" });
  await desktop.main.writeClientPersistence({ key: "private/a", value: "no" });
  const values = await desktop.main.readManyClientPersistence({ include: [""], exclude: ["private/"] });
  assert.equal(JSON.stringify(values), '{"kept/a":"yes"}');
});

test("new renderer roster and transcript use the native API and message schema", async () => {
  const b = bridge();
  const roster = await b.request("getServerAgentRoster");
  assert.equal(roster.value.agents[0].harness, "temporal");
  assert.equal(roster.value.agents[0].lastMessagePreview, "最新进展");
  assert.equal(roster.value.agents[0].lastEntry.text, "最新进展");
  assert.equal(roster.value.agents[0].hasUnread, true);
  assert.equal(roster.value.agents[0].lastActivityAt, 1200);
  assert.equal(roster.value.agents[0].lastViewedAt, 930);
  assert.equal(roster.value.agents[0].lastMessageId, null);
  assert.equal(roster.value.agents[0].avatarShape, "pebble");
  assert.equal(roster.value.agents[0].avatarColor, "violet");
  assert.equal((await b.request("getMainAgent")).value.agentId, "e1");
  const tail = await b.request("openAgentTail", { id: "e1" });
  assert.deepEqual(JSON.parse(JSON.stringify(tail.value.entries[0])), {
    id: "entry-12", seq: 12, timestampMs: 1000, kind: "send-message", streaming: false, message: { type: "text", content: "新版消息" }, tasks: [],
  });
  assert(b.requests.some((request) => request.url === "/assistant/test/api/messages" && request.body.thread === "employee:e1"));
  await b.tick();
  assert(b.requests.some((request) => request.url.endsWith("/read") && request.body.through === 12), "the open foreground chat marks the loaded Vega history read");
  assert(!b.requests.some((r) => r.url.includes("//")), "API path must not redirect POST requests");
  const send = { agentId: "e1", prompt: "fixture only", clientNonce: "fixture-send-nonce" };
  assert.equal((await b.request("sendPrompt", send)).value.accepted, true);
  assert.equal((await b.request("sendPrompt", send)).value.accepted, true);
  assert.equal(b.requests.filter((r) => r.url.endsWith("/send")).length, 1, "a repeated renderer nonce never replays a write");
  assert.deepEqual(b.requests.at(-1)?.body, { thread: "employee:e1", text: "fixture only", clientMessageId: send.clientNonce });
  b.fail();
  assert.equal((await b.request("sendPrompt", { ...send, clientNonce: "fixture-second-nonce" })).status, "failed");
  assert.equal((await b.request("deleteAgents", { ids: ["e1"] })).failure.code, "capability-unavailable");
  await assert.rejects(b.desktop.main.publishGrokBotAgent({ agentId: "e1" }), /暂未接入/);
  assert.equal((await b.request("sendPrompt", { agentId: "e1", prompt: "fixture", attachmentPaths: ["file"] })).status, "failed");
});

test("a lost delivery reply is reconciled by message ID; the same draft is not submitted again", async () => {
  const nonce = "original-nonce-for-test-01", retry = `sand-resend-v1:${nonce.length}:${nonce}:new-nonce-for-retry-001`;
  let accepted = false;
  const b = bridge(true, false, (url, data) => {
    if (url.endsWith("/send")) {
      accepted = true;
      return { ok: false, status: 502, json: async () => ({ error: "lost response" }) };
    }
    if (url.endsWith("/messages") && data.receiptFor) return { ok: true, json: async () => ({ receiptFor: data.receiptFor,
      receipt: accepted && data.receiptFor === nonce ? { seq: 13 } : null }) };
    throw Error("unexpected request");
  });
  assert.equal((await b.request("sendPrompt", { agentId: "e1", prompt: "同一条", clientNonce: nonce })).value.accepted, true);
  assert.equal((await b.request("sendPrompt", { agentId: "e1", prompt: "同一条", clientNonce: retry })).value.accepted, true);
  assert.equal((await b.request("promptAcceptanceStatus", { agentId: "e1", clientNonce: retry })).value.record.echoEntryId, "entry-13");
  const missing = "another-really-unknown";
  assert.equal((await b.request("promptAcceptanceStatus", { agentId: "e1", clientNonce: missing })).value.outcome, "unknown-durability");
  assert.equal((await b.request("sendPrompt", { agentId: "e1", prompt: "不能重放", clientNonce: `sand-resend-v1:${missing.length}:${missing}:new-nonce-for-retry-002` })).status, "failed");
  assert.deepEqual(b.requests.filter(r => r.url.endsWith("/send")).map(r => r.body.clientMessageId), [nonce]);
});

test("reopening parks the send journal without replaying it or replacing ordinary drafts", async () => {
  const key = "sand.client.slice.account.me.send-journal", stored = "sand_client_p_" + key;
  const nonce = "fixture-persisted-send-01";
  const pending = { schemaVersion: 3, value: { records: [{ nonce, input: { agentId: "e1", prompt: "保留文字，不再挂在会话里" } }] } };
  const data = { [stored]: JSON.stringify(pending), "sand_client_p_sand.client.slice.account.me.composer-drafts": "other draft" };
  const b = bridge(true, false, undefined, data);
  assert.equal(await b.desktop.main.readClientPersistence({ key }), null);
  assert.deepEqual(JSON.parse(b.storage["vega:previous-send-journal:" + stored]).value.records, pending.value.records);
  assert.equal(b.storage["sand_client_p_sand.client.slice.account.me.composer-drafts"], "other draft");
  const again = bridge(true, false, undefined, b.storage);
  assert.deepEqual(JSON.parse(again.storage["vega:previous-send-journal:" + stored]).value.records, pending.value.records);
  assert.deepEqual(again.requests, []);
});

test("operations unavailable on master do not make requests to nonexistent routes", async () => {
  const b = bridge();
  for (const method of ["createAgent", "updateAgent", "interruptAgentRun"])
    assert.match((await b.request(method)).failure.message, /Vega 网页/);
  assert.equal((await b.request("promptAcceptanceStatus")).value.outcome, "unknown-durability");
  assert.deepEqual(b.requests, []);
});

test("groups use an independent roster ID, show the right sender and acknowledge only loaded foreground rows", async () => {
  const nonce = "fixture-send-group-1";
  const group = { id: "e1", kind: "group", thread: "group:e1", name: "协作群", unread: 2, lastAt: 200, lastViewedAt: 100 };
  const history = [
    { seq: 1, role: "user", text: "same text", actorId: "peer", clientMessageId: nonce, author: { kind: "user", id: "peer", name: "另一位成员" } },
    { seq: 2, role: "assistant", text: "收到", author: { kind: "employee", id: "e1", name: "热心市民小林" } },
    { seq: 3, role: "user", text: "same text", actorId: "me", clientMessageId: nonce, author: { kind: "user", id: "me", name: "自己" } },
  ];
  let seen = 0;
  const b = bridge(true, false, (url, body) => ({ ok: true, json: async () => {
    if (url.endsWith("metadata")) return { id: "me", name: "本人" };
    if (url.endsWith("threads")) return { employees: [{ id: "e1", name: "私聊" }], groups: [group] };
    if (url.endsWith("messages")) return { messages: history.filter((m) => m.seq > (body.after || 0)), readSeq: seen, lastSeq: 4 };
    if (url.endsWith("read")) seen = body.through;
    return { ok: true };
  } }));
  const roster = (await b.request("getServerAgentRoster")).value.agents;
  assert.deepEqual(Array.from(roster, (row: any) => [row.id, row.isGroup, row.unreadCount]), [["e1", false, 0], ["group:e1", true, 2]]);
  assert.equal((await b.request("getMainAgent")).value.agentId, "e1");
  assert.deepEqual(JSON.parse(JSON.stringify(await b.desktop.main.getHostSidebarSections())).map(({ id, agentIds }: any) => [id, agentIds]), [
    ["__agents__", []], ["vega-groups", ["group:e1"]],
  ]);
  assert.deepEqual(Array.from(await b.desktop.main.setHostPinnedAgents({ pinnedAgentIds: ["e1", "group:e1"] })), ["e1"]);
  b.window.document.hasFocus = () => false;
  const { entries } = (await b.request("openAgentTail", { id: "group:e1" })).value;
  assert.deepEqual(Array.from(entries, (row: any) => [row.kind, row.content ?? row.message.content, row.clientNonce]), [
    ["send-message", "另一位成员：\nsame text", undefined], ["send-message", "热心市民小林：\n收到", undefined], ["message", "same text", nonce],
  ]);
  await b.request("noteTranscriptOpened", { id: "group:e1" });
  await b.tick();
  assert.equal(seen, 0, "background focus neither reads nor acknowledges on open");
  b.window.document.hasFocus = () => true;
  await b.tick();
  assert.equal(seen, 3, "focus resumes marking read without swallowing a later unseen message");
  const receipt = await b.request("promptAcceptanceStatus", { agentId: "group:e1", clientNonce: nonce });
  assert.equal(receipt.value.record.echoEntryId, "entry-3");
  await b.request("sendPrompt", { agentId: "group:e1", prompt: "新的发言", clientNonce: "another-group-nonce" });
  assert.deepEqual(b.requests.at(-1)?.body, { thread: "group:e1", text: "新的发言", clientMessageId: "another-group-nonce" });
});

test("minimizing preserves the transcript and cursor; restoring catches up without marking unseen messages read", async () => {
  const rows = [1, 2].map(seq => ({ seq, role: "assistant", text: "message " + seq }));
  let count = 1, readThrough = 0, held: (() => void) | undefined;
  const b = bridge(true, true, async (url, body) => {
    let data: any = { ok: true };
    if (url.endsWith("messages")) {
      data = { messages: rows.slice(0, count).filter(row => row.seq > (body.after || 0)), readSeq: readThrough, lastSeq: count };
      if (count === 2 && !held) await new Promise<void>(resolve => { held = resolve; });
    } else if (url.endsWith("read")) readThrough = body.through;
    return { ok: true, json: async () => data };
  });
  await b.request("openAgentTail", { id: "e1" });
  await b.tick();
  const snapshots = () => b.events.filter(event => event.family === "transcript").map(event => event.payload);
  const visibility: boolean[] = [];
  b.desktop.main.subscribe({ "window-visibility": (event: { visible: boolean }) => visibility.push(event.visible) });
  const state = (visible: boolean) => b.listeners["vega-window-state"]({ detail: { visible, isMaximized: false } });
  const initial = snapshots().at(-1);
  assert.equal(initial.entries.length, 1);
  assert.equal(readThrough, 1);
  count = 2;
  const late = b.tick();
  assert(held, "the incremental poll is in flight");
  state(false);
  b.window.document.hidden = true;
  b.documentListeners.visibilitychange({});
  assert.equal(await b.desktop.main.isWindowShown(), false);
  held(); await late;
  assert.equal(snapshots().length, 1, "late messages do not mutate the hidden transcript");
  assert.equal(readThrough, 1);
  b.window.document.hidden = false;
  b.window.document.hasFocus = () => false;
  b.documentListeners.visibilitychange({});
  await b.tick();
  assert.equal(snapshots().length, 1, "DOM visibility alone cannot wake a minimized WebView");
  state(true);
  b.listeners.focus({});
  await b.tick();
  const restored = snapshots().at(-1);
  assert.equal(restored.ordered.epoch, initial.ordered.epoch);
  assert.deepEqual(Array.from(restored.entries, (row: any) => row.seq), [1, 2]);
  assert.equal(b.requests.at(-1)?.body.after, 1, "wake resumes the existing cursor");
  assert.equal(readThrough, 1, "a visible, unfocused window does not mark messages read");
  b.window.document.hasFocus = () => true;
  b.listeners.focus({});
  await b.tick();
  assert.equal(readThrough, 2);
  assert.deepEqual(visibility, [false, true], "the renderer sees one transition in each direction");
  assert(!b.requests.some(request => request.url.endsWith("send")));
});

test("master history polls append replies, filter internal rows and recover from a reset", async () => {
  const reply = { seq: 3, role: "assistant", text: "response", displayText: "visible reply" };
  let history = [{ seq: 1, role: "user", text: "older" }, { seq: 2, role: "tool", text: "private output" }, reply];
  const b = bridge(true, false, (url, body) => ({ ok: true, json: async () => {
    if (url.endsWith("threads")) return { employees: [] };
    if (url.endsWith("messages")) return {
      messages: history.filter((row) => body.after === undefined || row.seq > body.after),
      lastSeq: history.at(-1)?.seq ?? 0, running: false,
    };
    return { ok: true };
  } }));
  const tail = await b.request("openAgentTail", { id: "e1", limit: 1 });
  assert.equal(tail.value.nextBeforeSeq, 3);
  const older = await b.request("getAgentTranscriptTail", { id: "e1", beforeSeq: 3 });
  assert.deepEqual(Array.from(older.value.entries, (e: any) => e.seq), [1]);
  await b.tick();
  const snapshot = () => b.events.filter((e) => e.family === "transcript").at(-1).payload;
  assert.deepEqual(Array.from(snapshot().entries, (e: any) => e.seq), [1, 3]);
  assert.equal(snapshot().entries[1].message.content, "visible reply");
  history = [...history, { seq: 4, role: "assistant", text: "new reply" }];
  await b.tick();
  assert(b.requests.some((r) => r.body.after === 3));
  assert.deepEqual(Array.from(snapshot().entries, (e: any) => e.seq), [1, 3, 4]);
  assert.equal(snapshot().ordered.epoch, tail.value.ordered.epoch);
  assert(snapshot().ordered.sequence > tail.value.ordered.sequence);
  history = [];
  await b.tick();
  assert.equal(snapshot().entries.length, 0, "an emptied history must replace old entries");
  b.listeners.pagehide({});
  const before = b.requests.length;
  await b.tick();
  assert.equal(b.requests.length, before, "leaving a window stops the poll");
  assert(!b.requests.some((r) => /(?:\/stream|\/send)$/.test(r.url)), "polling cannot start an unsupported stream or replay writes");
});

test("main bot uses the original pinned tile and pin changes survive reads", async () => {
  const { desktop } = bridge();
  assert.equal(JSON.stringify(await desktop.main.getHostPinnedAgents()), '["e1"]');
  assert.equal(JSON.stringify(await desktop.main.getServerPinnedAgents()), '["e1"]');
  assert.equal(JSON.stringify(await desktop.main.setHostPinnedAgents({ pinnedAgentIds: ["e2", "e2"] })), '["e2"]');
  assert.equal(JSON.stringify(await desktop.main.getHostPinnedAgents()), '["e2"]');
  await desktop.main.setHostPinnedAgents({ pinnedAgentIds: [] });
  assert.equal(JSON.stringify(await desktop.main.getServerPinnedAgents()), '[]');
  await assert.rejects(desktop.main.setHostPinnedAgents({ pinnedAgentIds: [null] }));
});

test("desktop theme changes persist, notify the renderer and can return to system", async () => {
  const { desktop } = bridge(false);
  const events: string[] = [];
  const unsubscribe = desktop.main.subscribe({ "theme-changed": (state: any) => events.push(state.resolved) });
  assert.equal(desktop.boot.theme.resolved, "light");
  await desktop.main.setThemePreference({ preference: "dark" });
  assert.equal((await desktop.main.getThemeState()).resolved, "dark");
  await desktop.main.setThemePreference({ preference: "system" });
  assert.deepEqual(events, ["dark", "light"]);
  unsubscribe();
  await desktop.main.setThemePreference({ preference: "light" });
  assert.deepEqual(events, ["dark", "light"]);
  await assert.rejects(desktop.main.setThemePreference({ preference: "invalid" }));
});

test("appearance controls use persistent local preferences instead of frozen placeholders", async () => {
  const { desktop, window } = bridge();
  const languageEvents: string[] = [];
  desktop.main.subscribe({ "language-changed": (value: any) => languageEvents.push(value.resolved) });
  await desktop.main.setLanguagePreference({ preference: "en" });
  assert.equal((await desktop.main.getLanguageState()).resolved, "en");
  window.navigator = { language: "zh-CN" };
  await desktop.main.setLanguagePreference({ preference: "system" });
  assert.deepEqual(languageEvents, ["en", "zh-CN"]);
  await assert.rejects(desktop.main.setLanguagePreference({ preference: "invalid" }));
  await desktop.main.setBotColorInChatEnabled({ enabled: false });
  assert.equal(await desktop.main.getBotColorInChatEnabled(), false);
  await assert.rejects(desktop.main.setBotColorInChatEnabled({ enabled: "false" }));
  const controls: any = { dataset: {} };
  window.document.getElementById = () => controls;
  await desktop.main.setTitleBarOverlayTone({ isOverlayTone: true });
  assert.equal(controls.dataset.overlayTone, "true");
  await assert.rejects(desktop.main.setTitleBarOverlayTone({ isOverlayTone: "true" }));
});

test("desktop zoom and window commands use the host instead of fixed placeholders", async () => {
  const { desktop, native, window, listeners } = bridge();
  const windowEvents: any[] = [];
  desktop.main.subscribe({ "window-state": (state: any) => windowEvents.push(state) });
  listeners["vega-window-state"]({ detail: { isMaximized: true } });
  assert.equal((await desktop.main.getWindowState()).isMaximized, true);
  assert.equal(windowEvents[0].isMaximized, true);
  assert.equal(desktop.local.getZoomFactor(), 1);
  window.devicePixelRatio = 2.5;
  assert.equal(desktop.local.getZoomFactor(), 1.25);
  window.chrome = { webview: { postMessage: (message: string) => native.push(message) } };
  await desktop.main.minimizeWindow();
  await desktop.main.toggleMaximizeWindow();
  await desktop.main.closeWindow();
  assert.deepEqual(native, ["vega-window:minimize", "vega-window:toggle-maximize", "vega-window:close"]);
});

test("the renderer delegates title drag but leaves resize border handling to Win32", () => {
  const { native, window, documentListeners } = bridge(true, true);
  window.innerWidth = 1080;
  window.innerHeight = 780;
  native.length = 0;
  const target = { closest: () => null, parentElement: null, region: "drag", matches: (selector: string) => selector.includes(".sand-1a4o4su") };
  const event = { button: 0, clientX: 600, clientY: 30, detail: 1, target, preventDefault() {} };
  documentListeners.mousedown(event);
  documentListeners.mousedown({ ...event, detail: 2 });
  target.region = "no-drag";
  documentListeners.mousedown(event);
  documentListeners.mousedown({ ...event, clientX: 1079, clientY: 779 });
  assert.deepEqual(native, ["vega-window:drag", "vega-window:toggle-maximize"]);
});

test("all embedded stylesheets parse without truncated rules or displaced prefixes", () => {
  const directory = join(resources, "assets");
  for (const name of readdirSync(directory).filter((name) => name.endsWith(".css"))) {
    const css = readFileSync(join(directory, name), "utf8");
    assert.match(css.trimStart(), /^[.@:#*a-z]/, name);
    assert.doesNotMatch(css, /\u0000|\uFFFD/, name);
    assert.doesNotThrow(() => postcss.parse(css, { from: name }), name);
  }
});

for (const name of readdirSync(join(resources, "assets")).filter((name) => name.endsWith(".woff2"))) {
 test(`${name} has a valid WOFF2 directory and complete compressed payload`, () => {
  const font = readFileSync(join(resources, "assets", name));
  assert.equal(font.toString("ascii", 0, 4), "wOF2");
  assert.equal(font.length, font.readUInt32BE(8));
  let offset = 48, decodedLength = 0;
  const uint128 = () => {
    let value = 0;
    for (let i = 0; i < 5; i++) {
      const byte = font[offset++];
      value = value * 128 + (byte & 127);
      if (!(byte & 128)) return value;
    }
    throw new Error("Invalid WOFF2 table length");
  };
  for (let i = 0; i < font.readUInt16BE(12); i++) {
    const flags = font[offset++], tag = flags & 63, version = flags >> 6;
    if (tag === 63) offset += 4;
    const original = uint128();
    decodedLength += ((tag === 10 || tag === 11) ? version === 0 : version !== 0) ? uint128() : original;
  }
  const end = offset + font.readUInt32BE(20);
  assert.equal(brotliDecompressSync(font.subarray(offset, end)).length, decodedLength);
  assert(font.subarray(end).every((byte) => byte === 0), "WOFF2 alignment padding must be zero");
 });
}
