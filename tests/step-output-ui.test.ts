import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import vue from "@vitejs/plugin-vue";
import { createServer } from "vite";

const execFile = promisify(execFileCallback);

test("聊天产物卡跳到对应任务，历史产物和任务详情只在展开时渲染正文", { skip: process.env.VEGA_TEST_CHROME !== "1", timeout: 45000 }, async () => {
  const dir = await mkdtemp(join(tmpdir(), "vega-step-ui-")), profile = await mkdtemp(join(tmpdir(), "vega-step-profile-"));
  const root = process.cwd();
  let done = false, release: (() => void) | undefined;
  const server = await createServer({
    configFile: false, root: dir, cacheDir: join(dir, "vite-cache"), logLevel: "error",
    plugins: [vue(), { name: "wait-for-fixture", configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url === "/__hold") {
          const finish = () => { res.setHeader("Content-Type", "image/gif"); res.end(Buffer.from("R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==", "base64")); };
          if (done) finish(); else release = finish;
        } else if (req.url === "/__done") { done = true; release?.(); res.end("ok"); }
        else next();
      });
    } }],
    resolve: { alias: {
      vue: resolve(root, "node_modules/vue/dist/vue.runtime.esm-bundler.js"),
      "@chat": resolve(root, "web/src/ChatMessage.vue"),
      "@step": resolve(root, "web/src/StepOutput.vue"),
      "@employee": resolve(root, "web/src/EmployeeChat.vue"),
      "@group": resolve(root, "web/src/GroupChat.vue"),
      "@cache": resolve(root, "web/src/chat-cache.js"),
    } },
    server: { host: "127.0.0.1", port: 0, fs: { allow: [root, dir] } },
  });
  try {
    await writeFile(join(dir, "index.html"), `<div id="app"></div><pre id="result">pending</pre><img src="/__hold" hidden><script>addEventListener("error", e => { document.querySelector("#result").textContent = JSON.stringify({ error: e.error?.stack || e.message || e.target?.src || "script error" }); void fetch('/__done'); }, true); addEventListener("unhandledrejection", e => { document.querySelector("#result").textContent = JSON.stringify({ error: String(e.reason?.stack || e.reason) }); void fetch('/__done'); });</script><script type="module" src="/fixture.js"></script>`);
    await writeFile(join(dir, "Fixture.vue"), `<script setup vapor>
import { ref } from "vue";
import ChatMessage from "@chat";
import StepOutput from "@step";
import EmployeeChat from "@employee";
import GroupChat from "@group";
const clicked = ref([]), requests = ref([]), selectedTask = ref(null);
const output = { step: 1, label: "设计结果", text: "ONLY_IN_ARTIFACT " + "报告正文 ".repeat(200) };
const message = (id) => ({ role: "assistant", text: "已生成", stepOutput: output, tasks: [{ id, title: "工作", status: "running" }] });
const legacy = { role: "assistant", text: "**步骤产物（任务未完成）**\\n\\n旧报告\\n\\nONLY_IN_ARTIFACT 旧正文", stepOutput: true, tasks: [{ id: "old", title: "旧任务" }] };
const groupMessage = { ...message('group-task'), seq: 1, author: { kind: 'employee', id: 'worker', name: '牛马' } };
const groupDeleted = { ...message('removed'), seq: 2, author: groupMessage.author };
const groupLegacy = { ...legacy, seq: 3, author: groupMessage.author };
const compact = (row) => ({ ...row, stepOutput: { step: row.stepOutput.step, label: row.stepOutput.label, omitted: true } });
const repeated = (row, start) => [start, start + 1].map((seq) => compact({ ...row, seq, text: '核对进度 ' + seq }));
const compactLegacy = { ...groupLegacy, text: '步骤产物已保存。', stepOutput: { step: 0, label: '旧报告', omitted: true, legacy: true } };
const task = { id: 'group-task', text: '工作', status: 'running', createdAt: Date.now(), stepOutputs: [output], canControl: false };
const group = { name: '测试群', users: [{ id: 'viewer', name: '成员' }], employees: [{ id: 'worker', name: '牛马', mine: false }], running: [] };
async function api(path) {
  requests.value.push(path);
  if (path.startsWith('/employees/worker/chat')) {
    const messages = path.includes('before=3') ? [{ ...message('removed'), seq: 2 }] : [compact({ ...message('private'), seq: 1 }), compact({ ...message('removed'), seq: 2 }), ...repeated(message('private'), 3)];
    return { session: { id: 'chat' }, messages, hasMore: false };
  }
  if (path.startsWith('/groups/fixture/messages')) {
    const messages = path.includes('before=3') ? [groupDeleted] : path.includes('before=4') ? [groupLegacy] : path.includes('topicTaskId=') ? [compact(groupMessage)] : [compact(groupMessage), compact(groupDeleted), compactLegacy, ...repeated(groupMessage, 4)];
    return { group, messages, taskStatus: { 'group-task': 'running', removed: 'deleted', old: 'deleted' } };
  }
  if (path === '/groups/fixture/tasks/worker/group-task') return task;
  if (path === '/groups/fixture/tasks?stepSummaries=1') return { members: [{ id: 'worker', name: '牛马', mine: false, tasks: [{ ...task, stepOutputs: undefined }] }] };
  return {};
}
</script>
<template>
  <div id="private"><ChatMessage :message="message('private')" :tasks="[{ id: 'private', status: 'running' }]" :task-status="{ private: 'running' }" @task="clicked.push('private:' + $event)" /></div>
  <div id="group"><ChatMessage :message="message('group')" :task-status="{ group: 'running' }" @task="clicked.push('group:' + $event)" /></div>
  <div id="deleted"><ChatMessage :message="message('deleted')" :task-status="{ deleted: 'deleted' }" /></div>
  <div id="legacy"><ChatMessage :message="legacy" /></div>
  <div id="detail"><StepOutput :output="output" /></div>
  <div id="employee"><EmployeeChat :api="api" user-id="viewer" employee-id="worker" name="牛马" :composer="{ text: '', attachments: [] }" :tasks="[{ id: 'private', status: 'running' }]" @task="clicked.push('employee:' + $event)" /></div>
  <div id="groupnav"><GroupChat :api="api" :user="{ id: 'viewer', role: 'operator' }" group-id="fixture" :my-employees="[]" :selected-task="selectedTask" @task-change="selectedTask = $event" /></div>
  <span id="clicked">{{ clicked.join('|') }}</span><span id="requests">{{ requests.join('|') }}</span>
</template>`);
    await writeFile(join(dir, "fixture.js"), `import { createVaporApp, nextTick } from "vue";
import { createChatCache, clearChatCache } from "@cache";
import Fixture from "./Fixture.vue";
const marker = "ONLY_IN_ARTIFACT";
const cache = createChatCache('old-cache-fixture', 'worker');
await cache.put('old-chat', [
  { seq: 1, role: 'assistant', text: '进度', stepOutput: { step: 1, label: '设计', text: marker } },
  { seq: 2, role: 'assistant', text: '**步骤产物（任务未完成）**\\n\\n旧报告\\n\\n' + marker, stepOutput: true }
], true);
const cached = await cache.read();
if (!cached) throw Error('IndexedDB cache was unavailable');
const cacheHasBody = JSON.stringify(cached).includes(marker);
await cache.put('old-chat', cached.messages, true);
const cachedAgain = await cache.read(), cacheLegacy = cachedAgain.messages[1].stepOutput.legacy === true;
await clearChatCache('old-cache-fixture');
createVaporApp(Fixture).mount("#app");
await nextTick();
const q = (selector) => document.querySelector(selector);
for (let i = 0; i < 80 && !(q('#employee .chat-step-output') && q('#groupnav .chat-step-output')); i++) await new Promise(resolve => setTimeout(resolve, 50));
const row = (view, seq) => q('#' + view + ' [data-message-seq="' + seq + '"]');
const keepsLatestCards = (view, seq) => row(view, seq)?.querySelector('.chat-bubble')?.textContent.includes('核对进度') &&
  !row(view, seq).querySelector('.chat-step-output,.chat-task-link') &&
  !!row(view, seq + 1)?.querySelector('.chat-step-output') && !!row(view, seq + 1)?.querySelector('.chat-task-link');
const before = {
  privateRepeats: keepsLatestCards('employee', 3), groupRepeats: keepsLatestCards('groupnav', 4),
  privateLink: !!q("#private .chat-step-output"), groupLink: !!q("#group .chat-step-output"),
  privateBody: q("#private").textContent.includes(marker), groupBody: q("#group").textContent.includes(marker),
  privatePreview: !!q("#private .step-output-content"), privateExport: !!q("#private .step-output-export"),
  deletedFallback: !!q("#deleted .step-output-content"), legacyFallback: !!q("#legacy .step-output-content"),
  deletedBody: q("#deleted").textContent.includes(marker), legacyBody: q("#legacy").textContent.includes(marker),
  detailBody: q("#detail").textContent.includes(marker), detailExport: !!q("#detail .step-output-export button"),
  employeeLink: !!q("#employee .chat-step-output"), groupNavLink: !!q("#groupnav .chat-step-output"),
  fullRequestedBefore: q('#requests').textContent.includes('before=3') || q('#requests').textContent.includes('before=4'),
  privateOldBody: !!q('#employee [data-message-seq="2"]')?.textContent.includes(marker),
  groupOldBody: !!q('#groupnav [data-message-seq="2"]')?.textContent.includes(marker),
  groupLegacyBody: !!q('#groupnav [data-message-seq="3"]')?.textContent.includes(marker)
};
q("#private .chat-step-output")?.click(); q("#group .chat-step-output")?.click();
row('employee', 4)?.querySelector('.chat-step-output')?.click(); row('groupnav', 5)?.querySelector('.chat-step-output')?.click();
await nextTick();
for (let i = 0; i < 80 && !q('#groupnav .task-detail'); i++) await new Promise(resolve => setTimeout(resolve, 50));
const groupTask = q('#groupnav .task-detail')?.dataset.taskId || '';
const groupBodyBefore = !!q('#groupnav .task-detail')?.textContent.includes(marker);
q("#deleted summary")?.click(); q("#legacy summary")?.click(); q("#detail summary")?.click(); q("#groupnav .task-detail summary")?.click();
await nextTick();
q('#groupnav .group-chat-tabs button')?.click();
await nextTick();
q('#employee [data-message-seq="2"] .chat-step-output')?.click();
q('#groupnav [data-message-seq="2"] .chat-step-output')?.click();
q('#groupnav [data-message-seq="3"] .chat-step-output')?.click();
for (let i = 0; i < 80 && !(q('#employee [data-message-seq="2"] .step-output-content[open]') && q('#groupnav [data-message-seq="3"] .step-output-content[open]')); i++) await new Promise(resolve => setTimeout(resolve, 50));
await new Promise(resolve => setTimeout(resolve, 50)); await nextTick();
q("#detail .step-output-export button")?.click(); await nextTick();
document.querySelector("#result").textContent = JSON.stringify({ ...before, clicked: q("#clicked").textContent,
  deletedOpened: q("#deleted").textContent.includes(marker), legacyOpened: q("#legacy").textContent.includes(marker),
  detailOpened: q("#detail").textContent.includes(marker), exportFormats: q("#detail .step-output-menu")?.querySelectorAll("button").length,
  groupTask, groupBodyBefore, groupOpened: !!q('#groupnav .task-detail')?.textContent.includes(marker),
  privateOldOpened: !!q('#employee [data-message-seq="2"]')?.textContent.includes(marker),
  groupOldOpened: !!q('#groupnav [data-message-seq="2"]')?.textContent.includes(marker),
  groupLegacyOpened: !!q('#groupnav [data-message-seq="3"]')?.textContent.includes(marker),
  fullRequests: (q('#requests').textContent.match(/before=[34]/g) || []).length, cacheHasBody, cacheLegacy });
await fetch('/__done');`);
    await server.listen();
    const address = server.httpServer!.address();
    assert(address && typeof address !== "string");
    const binary = process.env.VEGA_CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";
    const { stdout, stderr } = await execFile(binary, ["--headless=new", "--no-first-run", "--no-default-browser-check", "--no-sandbox", "--disable-gpu", "--user-data-dir=" + profile, "--dump-dom", `http://127.0.0.1:${address.port}/`], { encoding: "utf8", timeout: 30000, maxBuffer: 8 << 20, windowsHide: true });
    const body = stdout.match(/<pre id="result">([\s\S]*?)<\/pre>/)?.[1];
    assert(body && body !== "pending", `fixture did not finish: ${stdout}\n${stderr}`);
    const { privateRepeats, groupRepeats, ...result } = JSON.parse(body);
    assert.equal(privateRepeats, true, result.error || "private chat keeps only the latest repeated cards");
    assert.equal(groupRepeats, true, result.error || "group chat keeps only the latest repeated cards");
    assert.deepEqual(result, {
      privateLink: true, groupLink: true, privateBody: false, groupBody: false,
      privatePreview: false, privateExport: false, deletedFallback: true, legacyFallback: true,
      deletedBody: false, legacyBody: false, detailBody: false, detailExport: true, employeeLink: true, groupNavLink: true,
      fullRequestedBefore: false, privateOldBody: false, groupOldBody: false, groupLegacyBody: false,
      clicked: "private:private|group:group|employee:private", deletedOpened: true, legacyOpened: true, detailOpened: true, exportFormats: 5,
      groupTask: "group-task", groupBodyBefore: false, groupOpened: true,
      privateOldOpened: true, groupOldOpened: true, groupLegacyOpened: true, fullRequests: 3, cacheHasBody: false, cacheLegacy: true,
    });
  } finally {
    await server.close();
    await rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
});
