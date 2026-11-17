import { test } from "node:test";
import assert from "node:assert/strict";
import { createChatHistory, loadStepOutput, mergeMessages } from "../web/src/chat-history.js";
import { createChatCache } from "../web/src/chat-cache.js";

const message = (seq: number, text = "message-" + seq) => ({ seq, role: "user", text });
const tick = () => new Promise<void>((resolve) => setImmediate(resolve));
function cacheFixture(rows = [message(1), message(2)]) {
  let messages = rows, session = "chat-a", valid = true;
  const writes: any[] = [];
  return {
    valid: () => valid,
    writes,
    read: async (before = Number.MAX_SAFE_INTEGER, limit = 60) => ({ session, messages: messages.filter((m) => m.seq < before).slice(-limit) }),
    put: async (id: string, rows: any[], replace = false) => { if (!valid) return; writes.push({ id, rows, replace }); session = id; messages = replace ? rows : mergeMessages(messages, rows); },
    clear: async () => { valid = false; messages = []; },
  };
}
function fixture(api: any, cache: any = cacheFixture(), pageSize = 60) {
  const messages = { value: [] as any[] }, running = { value: false }, hasMore = { value: false };
  const history = createChatHistory({ api, path: () => "/employees/a/chat", messages, running, hasMore, cache, pageSize });
  return { history, messages, running, hasMore, cache };
}

test("a missing task's original step artifact is fetched one message at a time, including legacy records", async () => {
  const urls: string[] = [], output = { step: 1, label: "设计", text: "完整正文", files: [{ blobId: "blob-a" }] };
  const api = async (url: string) => { urls.push(url); return { messages: [{ seq: 4, stepOutput: output }] }; };
  assert.deepEqual(await loadStepOutput(api, "/employees/a/chat", 4), output);
  assert.deepEqual(urls, ["/employees/a/chat?before=5&limit=1"]);
  const legacy = async () => ({ messages: [{ seq: 9, stepOutput: true, text: "**步骤产物（任务未完成）**\n\n旧标题\n\n旧正文" }] });
  assert.deepEqual(await loadStepOutput(legacy, "/groups/g/messages", 9), { label: "旧标题", text: "旧正文" });
  await assert.rejects(loadStepOutput(api, "/employees/a/chat", 0), /编号无效/);
  await assert.rejects(loadStepOutput(api, "/employees/a/chat", 5), /不存在/);
  await assert.rejects(loadStepOutput(async () => { throw Error("无权查看"); }, "/groups/g/messages", 9), /无权查看/);
  await assert.rejects(loadStepOutput(async () => ({ session: { id: "new-chat" }, messages: [{ seq: 4, stepOutput: output }] }), "/employees/a/chat", 4, "old-chat"), /会话已变化/);
  const expected = { tasks: [{ id: "old-task" }], stepOutput: { step: 1, label: "设计", omitted: true } };
  await assert.rejects(loadStepOutput(async () => ({ messages: [{ seq: 4, tasks: [{ id: "other-task" }], stepOutput: output }] }), "/employees/a/chat", 4, "", expected), /原产物已变化/);
});

test("cached messages render before network resolution and opening requests only newer sequences", async () => {
  let release!: (value: any) => void;
  const paths: string[] = [], cached: any[] = [];
  const state = fixture((path: string) => { paths.push(path); return new Promise((resolve) => release = resolve); });
  const load = state.history.load(() => cached.push([...state.messages.value]));
  await tick();
  assert.equal(cached.length, 1);
  assert.deepEqual(cached[0].map((m: any) => m.seq), [1, 2]);
  assert.deepEqual(paths, ["/employees/a/chat?after=2"]);
  release({ session: { id: "chat-a" }, messages: [message(3)], lastSeq: 3, running: false });
  await load;
  assert.deepEqual(state.messages.value.map((m) => m.seq), [1, 2, 3]);
  assert.deepEqual(state.cache.writes[0].rows, [message(3)], "only confirmed deltas are written");
});

test("network failures retain cached messages; next passive refresh resumes without a full history fetch", async () => {
  let offline = true;
  const state = fixture(async (path: string) => {
    assert(path.endsWith("?after=2"));
    if (offline) throw Object.assign(Error("offline"), { network: true });
    return { session: { id: "chat-a" }, messages: [message(3)], running: false };
  });
  await assert.rejects(state.history.load(), /offline/);
  assert.equal(state.messages.value.length, 2);
  assert.equal(state.cache.valid(), true);
  offline = false;
  await state.history.newer();
  assert.equal(state.messages.value.length, 3);
});

test("storage unavailable degrades to the original paginated server path", async () => {
  const state = fixture(async (path: string) => {
    assert(path.endsWith("?limit=60"));
    return { session: { id: "chat-a" }, messages: [message(1)], hasMore: false };
  }, createChatCache("storage-unavailable-test", "a"));
  await state.history.load();
  assert.equal(state.messages.value.length, 1);
});

test("bot deletion and permission revocation clear cached messages, but transient server errors do not", async () => {
  for (const status of [401, 403, 404, 500]) {
    const state = fixture(async () => { throw Object.assign(Error("denied"), { status }); });
    await assert.rejects(state.history.load(), /denied/);
    assert.equal(state.messages.value.length, status === 500 ? 2 : 0);
    assert.equal(state.cache.valid(), status === 500);
  }
});

test("late responses cannot resurrect a deleted bot or a disposed conversation", async () => {
  for (const action of ["delete", "dispose"]) {
    let release!: (value: any) => void;
    const state = fixture(() => new Promise((resolve) => release = resolve));
    const loading = state.history.load();
    await tick();
    if (action === "delete") await state.cache.clear();
    else state.history.dispose();
    release({ session: { id: "chat-a" }, messages: [message(3)], lastSeq: 3 });
    await loading;
    assert.deepEqual(state.messages.value.map((m) => m.seq), [1, 2]);
    assert.equal(state.cache.writes.length, 0);
  }
});

test("rebuilt conversations and rolled-back histories discard old cached rows before refreshing", async () => {
  for (const replacement of [{ session: { id: "chat-b" }, lastSeq: 1 }, { session: { id: "chat-a" }, lastSeq: 1 }]) {
    const paths: string[] = [];
    const state = fixture(async (path: string) => {
      paths.push(path);
      return { ...replacement, messages: path.includes("after=") ? [] : [message(1, "replacement")], hasMore: false };
    });
    await state.history.load();
    assert.deepEqual(paths, ["/employees/a/chat?after=2", "/employees/a/chat?limit=60"]);
    assert.deepEqual(state.messages.value, [message(1, "replacement")]);
    assert.deepEqual((await state.cache.read()).messages, state.messages.value);
  }
});

test("older cached pages avoid network; cache gaps fall back to authoritative pagination", async () => {
  const rows = Array.from({ length: 120 }, (_, i) => message(i + 1));
  const paths: string[] = [];
  const state = fixture(async (path: string) => {
    paths.push(path);
    return { session: { id: "chat-a" }, messages: [], lastSeq: 120 };
  }, cacheFixture(rows));
  await state.history.load();
  assert.equal(state.messages.value[0].seq, 61);
  await state.history.older();
  assert.equal(state.messages.value[0].seq, 1);
  assert.equal(state.hasMore.value, false);
  assert.equal(paths.length, 1);
  const gap = fixture(async (path: string) => {
    if (path.includes("after=")) return { session: { id: "chat-a" }, messages: [] };
    assert(path.includes("before=3"));
    return { session: { id: "chat-a" }, messages: [message(1), message(2)], hasMore: false };
  }, cacheFixture([message(1), message(3), message(4)]), 2);
  await gap.history.load(); await gap.history.older();
  assert.deepEqual(gap.messages.value.map((m) => m.seq), [1, 2, 3, 4]);
});

test("stream events during cache hydration prevent a delayed snapshot from clearing typing", async () => {
  let release!: (value: any) => void;
  const state = fixture(() => new Promise((resolve) => release = resolve));
  const loading = state.history.load();
  await tick();
  state.history.touch(); state.running.value = true;
  release({ session: { id: "chat-a" }, messages: [], running: false });
  await loading;
  assert.equal(state.running.value, true);
});
