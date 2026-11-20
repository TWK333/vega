import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { groupDebugSessions, visibleDebugSessions } from "../web/src/debug-sessions.js";

const sessions = [
  { id: "narr-1", title: "旁白记录", employeeName: "旁白 · 发布小组", employeeId: "", kind: "narrator", createdAt: 1 },
  { id: "chat-1", title: "早安", employeeName: "阿甲", employeeId: "e1", ownerId: "account-001", ownerName: "Alice", kind: "chat", taskText: "", createdAt: 6 },
  { id: "work-1", title: "主会话", employeeName: "阿甲", employeeId: "e1", ownerId: "account-001", ownerName: "Alice", taskId: "task-alpha", taskText: "整理发布说明", taskStatus: "running", kind: "work", scene: "coding", createdAt: 5 },
  { id: "comp-1", title: "浏览器", employeeName: "阿甲", employeeId: "e1", taskId: "task-alpha", taskText: "整理发布说明", taskStatus: "running", kind: "computer", scene: "computer", createdAt: 4 },
  { id: "chat-2", title: "补充一句", employeeName: "阿乙", employeeId: "e2", kind: "chat", createdAt: 3 },
  { id: "work-2", title: "另一任务", employeeName: "阿乙", employeeId: "e2", taskId: "task-beta", taskText: "检查登录回归", taskStatus: "done", kind: "work", createdAt: 2 },
  { id: "group-1", title: "群里问", employeeName: "阿乙", employeeId: "e2", kind: "group", createdAt: 7 },
];

test("debug sessions group by task, and unlinked chats stay in their own sections", () => {
  const groups = groupDebugSessions(sessions);
  assert.deepEqual(groups.map((group) => group.key), ["loose:narrator", "loose:chat", "task:task-alpha", "task:task-beta", "loose:group"]);
  const alpha = groups.find((group) => group.taskId === "task-alpha")!;
  assert.equal(alpha.taskText, "整理发布说明");
  assert.equal(alpha.taskStatus, "running");
  assert.deepEqual(alpha.sessions.map((session) => session.id), ["work-1", "comp-1"], "a task keeps its work and computer sessions together, in list order");
  assert.deepEqual(groups.find((group) => group.kind === "chat")!.sessions.map((session) => session.id), ["chat-1", "chat-2"], "later chats join the earlier 沟通会话 section");
  assert.equal(groups.find((group) => group.kind === "chat")!.label, "沟通会话");
  assert.equal(groups.find((group) => group.kind === "group")!.label, "群聊会话");
  assert.equal(groups.find((group) => group.kind === "narrator")!.label, "旁白会话");
  assert.equal(groups.filter((group) => group.taskId).every((group) => group.sessions.every((session) => session.taskId === group.taskId)), true);
  assert.equal(groups.filter((group) => !group.taskId).every((group) => group.sessions.every((session) => !session.taskId)), true);
});

test("a task heading keeps the first available text and status, and unknown loose kinds stay out of task groups", () => {
  const groups = groupDebugSessions([
    { id: "a", taskId: "task-gap", taskText: "", kind: "work" },
    { id: "b", taskId: "task-gap", taskText: "后补的任务正文", taskStatus: "waiting", kind: "computer" },
    { id: "same-text", taskId: "task-other", taskText: "后补的任务正文", taskStatus: "done", kind: "work" },
    { id: "orphan", kind: "work", title: "没有任务" },
  ]);
  assert.deepEqual(groups.map((group) => group.key), ["task:task-gap", "task:task-other", "loose:other"]);
  assert.equal(groups[0].taskText, "后补的任务正文");
  assert.equal(groups[0].taskStatus, "waiting");
  assert.deepEqual(groups[0].sessions.map((session) => session.id), ["a", "b"]);
  assert.equal(groups[1].taskId, "task-other");
  assert.equal(groups[2].label, "未关联任务");
  assert.deepEqual(groups[2].sessions.map((session) => session.id), ["orphan"]);
});

test("search matches task id and task text, and still matches session id, title, and employee name", () => {
  assert.deepEqual(visibleDebugSessions(sessions, { query: "TASK-ALPHA" }).map((session) => session.id), ["work-1", "comp-1"]);
  assert.deepEqual(visibleDebugSessions(sessions, { query: "beta" }).map((session) => session.id), ["work-2"], "a partial task id matches");
  assert.deepEqual(visibleDebugSessions(sessions, { query: "  登录回归 " }).map((session) => session.id), ["work-2"], "task text matches, and surrounding spaces are ignored");
  assert.deepEqual(visibleDebugSessions(sessions, { query: "发布说" }).map((session) => session.id), ["work-1", "comp-1"]);
  assert.deepEqual(visibleDebugSessions(sessions, { query: "work-2" }).map((session) => session.id), ["work-2"]);
  assert.deepEqual(visibleDebugSessions(sessions, { query: "另一" }).map((session) => session.id), ["work-2"]);
  assert.deepEqual(visibleDebugSessions(sessions, { query: "阿乙" }).map((session) => session.id), ["chat-2", "work-2", "group-1"]);
  for (const query of [" ALICE ", "account-001"]) assert.deepEqual(visibleDebugSessions(sessions, { query }).map((session) => session.id), ["chat-1", "work-1"]);
  assert.deepEqual(visibleDebugSessions(sessions, { query: "不存在" }), []);
  assert.equal(visibleDebugSessions(sessions, { query: "   " }).length, sessions.length);
  const filtered = visibleDebugSessions(sessions, { employeeId: "e1", query: "发布" });
  assert.deepEqual(filtered.map((session) => session.id), ["work-1", "comp-1"], "employee filter still narrows the task search");
  const grouped = groupDebugSessions(visibleDebugSessions(sessions, { query: "task-alpha" }));
  assert.equal(grouped.length, 1);
  assert.equal(grouped[0].taskId, "task-alpha");
  assert.equal(grouped[0].taskText, "整理发布说明");
  assert.equal(grouped[0].taskStatus, "running");
  assert.deepEqual(grouped[0].sessions.map((session) => session.id), ["work-1", "comp-1"]);
});

test("the debug page renders task sections and tells the user that task id and task text are searchable", () => {
  const source = readFileSync("web/src/DebugSessions.vue", "utf8");
  assert.match(source, /visibleDebugSessions\(sessions\.value, \{ employeeId: employee\.value, query: search\.value \}\)/);
  assert.match(source, /groupDebugSessions\(visible\.value\)/);
  assert.match(source, /placeholder="用户、任务 ID、内容或会话"/);
  assert.match(source, /aria-label="按归属用户、任务 ID、任务内容、会话 ID、标题或热心市民查找"/);
  assert.match(source, /class="debug-owner"[^\n]*session\.ownerName/);
  assert.match(source, /v-for="group in groups"/);
  assert.match(source, /v-for="session in group\.sessions"/);
  assert.match(source, /group\.taskText \|\| '任务 ' \+ group\.taskId\.slice\(0, 8\)/);
  assert.match(source, /:title="group\.taskId"/);
  assert.match(source, /taskLabel\(group\.taskStatus\)/);
  assert.match(source, /narrator: "旁白"/);
  assert.doesNotMatch(source, /position:\s*sticky/, "headers do not cover session rows while scrolling");
  assert.match(source, /\.debug-group \{[^}]*border-radius:\s*12px/);
  assert.match(source, /v-if="!group\.taskId" class="debug-title"/, "task text is not repeated on every session");
  assert.match(source, /class="debug-model"[^>]*:title=/, "long model details remain available without wrapping the list");
  assert.match(source, /aria-label="热心市民"/);
  assert.match(source, /sessions\.value\.filter\(\(session\) => session\.employeeId\)/, "narrator sessions are not offered as a blank employee filter");
  assert.match(source, /title="刷新"/);
  assert.match(source, /EmployeeSessionView/);
  assert.match(source, /emit\("tab", id\)/);
  assert.match(source, /session\.employeeName/);
  assert.match(source, /labels\[session\.kind\]/);
  assert.match(source, /session\.running/);
  assert.match(source, /session\.title/);
  assert.match(source, /session\.id/);
  assert.match(source, /session\.scene/);
  assert.match(source, /session\.localAgent/);
});
