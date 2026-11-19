import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Store, type Message } from "../server/core/store";
import { Engine } from "../server/core/engine";
import { Catalog } from "../server/core/catalog";
import { Subscriptions } from "../server/core/subscriptions";
import { Chrome } from "../server/core/chrome";
import { ChromeBridge } from "../server/core/chrome-bridge";
import { completeBashJob, createBashJob, type BashJob } from "../server/core/bash-jobs";
import { sleep } from "../server/core/util";

const until = async (condition: () => unknown, why: string) => {
  for (let i = 0; i < 800; i++) { if (await condition()) return; await sleep(10); }
  assert.fail(why);
};
const call = (id: string, name: string, args: object): Message => ({ role: "assistant", calls: [{ id, name, arguments: args }] });
const verified = (id: string) => call(id + "-plan", "task_progress", { message: "verified", plan: [{ content: "verify work", status: "completed" }] });
const completed = (id: string) => call(id + "-end", "task_complete", { evidence: "verified", deliverableRefs: [] });
const finish = (id: string, messages: Message[]) => messages.some(m => m.callId === id + "-plan") ? completed(id) : verified(id);

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}

// Fire the real 30s grace timer on demand; leave scheduler and other timers alone.
function waitWindow(t: TestContext) {
  const expiry = deferred<() => void>(), set = globalThis.setTimeout;
  let captured = false;
  t.mock.method(globalThis, "setTimeout", (callback: (...args: any[]) => void, ms?: number, ...args: any[]) => {
    if (ms !== 30_000 || captured) return set(callback, ms, ...args);
    captured = true;
    expiry.resolve(() => callback(...args));
    return set(() => {}, ms).unref();
  });
  return expiry.promise;
}

async function fixture(t: TestContext) {
  const cwd = await mkdtemp(join(tmpdir(), "vega-result-wait-")), store = await Store.open(":memory:");
  const engine = await Engine.create(store, new Catalog(store, new Subscriptions(store, "")), new Chrome(store, new ChromeBridge(), ""));
  engine.employee.closed = true;
  await store.put("config", { scenes: { lightweight: ["p/light"] }, provider: { p: { api: "openai-completions", baseURL: "https://unused.test", models: { light: { limit: { context: 128000, output: 8192 } } } } }, scheduler: { globalSlots: 1, perEmployeeSlots: 1 } });
  const employee = await engine.employee.for((await engine.employee.create({ name: "Async result worker", cwd }, "owner")).id);
  const add = async (text: string, dir = cwd) => (await employee.execute("", { action: "add", kind: "todo", text, cwd: dir })).value.id as string;
  const task = async (id: string) => (await employee.findTask(id))!;
  const runs = async (id: string) => (await employee.state()).runs.filter(run => run.taskId === id);
  const start = async () => { engine.employee.closed = false; await engine.employee.drain(); };
  t.after(async () => {
    await engine.close();
    await until(() => !employee.busy.size, "fixture worker should stop");
    await store.close();
    await rm(cwd, { recursive: true, force: true });
  });
  return { engine, store, employee, cwd, add, task, runs, start };
}

for (const quick of [false, true]) test(`generic result: ${quick ? "short wait keeps the original slot" : "long wait gives the slot to the queued task and resumes once"}`, { timeout: 12000 }, async t => {
  const { engine, store, employee, add, task, runs, start } = await fixture(t);
  const first = await add("A"), second = await add("B");
  const window = waitWindow(t);
  const reply = deferred<string>(), waiting = deferred<void>();
  let originalSession = "", acknowledgements = 0;
  engine.backgroundResults.push(session => session === originalSession && !acknowledgements ? {
    wait: () => { waiting.resolve(); return reply.promise; },
    acknowledge: () => { acknowledgements++; },
  } : undefined);
  engine.providers.chat = async (_model, _system, messages, _defs, _signal, _emit, session) => {
    const id = (await store.session(session!)).taskId!;
    if (id === first) {
      originalSession ||= session!;
      assert.equal(session, originalSession);
      if (!messages.some(m => m.callId === "launch-once")) return call("launch-once", "write", { path: "submitted.txt", content: "one operation" });
      if (!messages.some(m => m.text?.includes("unique async receipt"))) return { role: "assistant", text: "Waiting for the existing operation" };
    }
    return finish(id, messages);
  };
  await start();
  await waiting.promise;
  const expire = await window;
  if (quick) {
    assert.equal((await task(second)).status, "queued");
    assert(employee.busy.has(first));
  } else {
    expire();
    await until(async () => (await task(second)).status === "done" && !employee.busy.has(first), "B must finish while A has no result");
    assert.equal((await task(first)).status, "deferred");
    assert.equal((await store.session(originalSession)).turnInProgress, false);
    assert((await task(first)).backgroundWait?.token);
  }
  reply.resolve("unique async receipt");
  await until(async () => (await task(first)).status === "done" && (await task(second)).status === "done" && !employee.busy.size, "both tasks should finish");
  const rows = await store.messages(originalSession);
  assert.equal(rows.filter(m => m.callId === "launch-once").length, 1);
  assert.equal(rows.filter(m => m.text?.includes("unique async receipt")).length, 1);
  assert.equal(acknowledgements, 1);
  assert.equal((await runs(first)).length, quick ? 1 : 2);
});

test("a lone long bash_poll parks without unlocking an active writer", { timeout: 12000 }, async t => {
  const { engine, store, cwd, add, task, start } = await fixture(t);
  const other = join(cwd, "..", `vega-other-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await mkdir(other);
  t.after(() => rm(other, { recursive: true, force: true }));
  const first = await add("writer"), conflict = await add("overlapping writer"), independent = await add("independent writer", other);
  const window = waitWindow(t);
  const exited = deferred<void>();
  let job: BashJob | undefined;
  t.after(() => { exited.resolve(); if (job) completeBashJob(job); });
  engine.providers.chat = async (_model, _system, messages, _defs, _signal, _emit, session) => {
    const id = (await store.session(session!)).taskId!;
    if (!messages.some(m => m.name === "write" && !m.error)) return call(id + "-write", "write", { path: "shared.txt", content: id });
    if (id === first) {
      job ||= createBashJob({ session: session!, timeoutSecs: 120, waitable: true, exited: exited.promise, kill() { exited.resolve(); } });
      if (!messages.some(m => m.text?.includes("shell result once"))) return call("long-poll", "bash_poll", { job_id: job.id, wait: 30 });
    }
    return finish(id, messages);
  };
  await start();
  (await window)();
  await until(async () => (await task(independent)).status === "done", "the unrelated writer must run while the original command is active");
  assert.equal((await task(first)).status, "deferred");
  assert((await task(conflict)).workspaceWait, "shared workspace must remain locked");
  assert([...engine.employee.writers.values()].some(writer => writer.taskId === first));
  completeBashJob(job!, { output: "shell result once", exitCode: 0 });
  exited.resolve();
  await until(async () => (await task(first)).status === "done" && (await task(conflict)).status === "done", "original and overlapping writer must both continue");
  const rows = await store.messages((await task(first)).workSession);
  assert.equal(rows.filter(m => m.callId === "long-poll").length, 1);
  assert.equal(rows.filter(m => m.text?.includes("shell result once")).length, 1);
});

for (const parked of [false, true]) test(`stop ${parked ? "after parking" : "during the grace period"} ignores late results`, { timeout: 12000 }, async t => {
  const { engine, store, employee, add, task, runs, start } = await fixture(t);
  const id = await add("wait, then stop"), waiting = deferred<string>();
  const window = waitWindow(t);
  let observed: AbortSignal | undefined, requests = 0, acknowledgements = 0;
  engine.backgroundResults.push(() => ({ wait: signal => { observed = signal; return waiting.promise; }, acknowledge: () => { acknowledgements++; } }));
  engine.providers.chat = async () => { requests++; return { role: "assistant", text: "waiting" }; };
  await start();
  const expire = await window;
  if (parked) {
    expire();
    await until(async () => (await task(id)).status === "deferred" && !employee.busy.has(id), "the task must first park");
  }
  assert.equal((await employee.control({ action: "stop", id })).executionStopped, true);
  assert(observed?.aborted);
  waiting.resolve("late unsolicited result");
  await engine.employee.drain();
  assert.equal((await task(id)).status, "stopped");
  assert.equal((await runs(id)).length, 1);
  assert.equal(requests, 1);
  assert.equal(acknowledgements, 0);
  assert(!(await store.messages((await task(id)).workSession)).some(m => m.text?.includes("late unsolicited result")));
});

test("restart recovers a persisted missing handle without resubmitting the operation", async t => {
  const { store, employee, add, task, cwd } = await fixture(t);
  const id = await add("check original operation only");
  const session = await store.newSession({ cwd, employeeId: employee.employeeId, taskId: id });
  const due = Date.now() + 60_000;
  await employee.update(state => Object.assign(employee.task(state, id), { workSession: session.id, status: "deferred", nextCheckAt: due, backgroundWait: { token: "lost", session: session.id } }));
  await employee.start();
  const recovered = await task(id);
  assert.equal(recovered.status, "recovering");
  assert.equal(recovered.workSession, session.id);
  assert.equal(recovered.nextCheckAt, due);
  assert.equal(recovered.backgroundWait, undefined);
  assert.match(recovered.recovery.reason, /先核对实际状态，不自动重跑/);
});
