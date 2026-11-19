import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { promisify } from "node:util";
import { createServer } from "vite";
import vue from "@vitejs/plugin-vue";

const run = promisify(execFile);
test("debug cards stay compact; group history pages up and topics switch without a blank frame or scroll jump", { skip: process.env.VEGA_TEST_CHROME !== "1", timeout: 90000 }, async () => {
  const root = process.cwd(), temp = join(root, ".tmp");
  await mkdir(temp, { recursive: true });
  const dir = await mkdtemp(join(temp, "group-debug-ui-"));
  const server = await createServer({ configFile: false, root, plugins: [vue()], server: { host: "127.0.0.1", port: 0, watch: null }, logLevel: "error" });
  try {
    await writeFile(join(dir, "index.html"), '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;height:100%}#app{display:flex;height:100vh;min-width:0}#result{display:none}</style><div id="app"></div><pre id="result">pending</pre><script type="module" src="./fixture.js"></script></html>');
    await writeFile(join(dir, "fixture.js"), `
      import { createApp, h, nextTick, reactive, vaporInteropPlugin } from 'vue';
      import DebugSessions from '/web/src/DebugSessions.vue';
      import GroupChat from '/web/src/GroupChat.vue';
      import '/web/src/style.css';
      const check = (ok, text) => { if (!ok) throw Error(text); };
      const flush = async () => { for (let i = 0; i < 12; i++) await nextTick(); };
      const input = (el, value) => { el.value = value; el.dispatchEvent(new Event('input', { bubbles: true })); };
      const result = document.querySelector('#result');
      const state = reactive({ view: 'group', selectedTask: null, revision: 0, user: { id: 'requester', role: 'operator' } });
      let replacedTask = false;
      const onTaskChange = (task, replace = false) => { state.selectedTask = task; replacedTask = replace; };
      const task = { id: 't1', text: '核对指标筛选器的中英文提示文案', status: 'waiting', createdAt: Date.now(), waiting: '请补充验收环境', plan: [{ content: '核对提示文案', status: 'pending' }], requester: { kind: 'user', id: 'requester', name: '发起人' } };
      const group = { id: 'g1', name: '情报小分队', bulletin: '', users: [{ id: 'owner', name: '归属人' }, { id: 'requester', name: '发起人' }, { id: 'member', name: '同事' }], employees: [{ id: 'e1', name: '情报开发', mine: false, avatar: 'bot:round:blue' }], running: [] };
      const posts = [], messagePosts = [];
      const other = { ...task, id: 't-other', text: '核对账号列表', status: 'queued' };
      const peer = { kind: 'user', id: 'member', name: '同事' };
      const messages = Array.from({ length: 160 }, (_, i) => ({ seq: i + 1, role: 'user', text: '历史消息 ' + (i + 1), ...(i % 2 ? { topicTaskId: task.id } : {}), author: peer }));
      const otherSeq = messages.length + 3;
      messages.push(
        { seq: otherSeq - 2, role: 'assistant', text: '请核对这条任务', topicTaskId: task.id, author: { kind: 'employee', id: 'e1', name: '情报开发' }, tasks: [{ id: task.id, title: task.text, status: task.status }] },
        { seq: otherSeq - 1, role: 'user', text: '无关的主聊天', author: peer },
        { seq: otherSeq, role: 'assistant', text: '另一项任务的讨论', topicTaskId: other.id, author: { kind: 'employee', id: 'e1', name: '情报开发' }, tasks: [{ id: other.id, title: other.text, status: other.status }] },
      );
      const historyRequests = [];
      let holdHistory, failOlderOnce = false;
      function pauseHistory(topicId, before = null) {
        let release;
        const ready = new Promise(resolve => { release = resolve; });
        return holdHistory = { topicId, before, ready, release, started: false };
      }
      let confirmed = false;
      window.confirm = () => confirmed;
      const sessions = [
        { id: 'narrator-session', title: '旁白：情报小分队', employeeName: '旁白 · 情报小分队', kind: 'narrator', createdAt: Date.now() },
        { id: '2a66a5ac849047fbb9d96c3e3b37e33f', title: '情报开发 · 重复的任务说明', employeeId: 'e1', employeeName: '情报开发', taskId: 't8aad9b57018842b49b39635cc1724c7f', taskText: '重新发起开发：修改指标筛选器 hover 文案并验证中英文显示与长文案边界'.repeat(3), taskStatus: 'running', kind: 'computer', scene: 'computer', model: 'provider-1/deepseek-v4-flash/variant/high', createdAt: Date.now(), running: true },
        { id: 'work-session-1234567890', title: '情报开发 · 重复的任务说明', employeeId: 'e1', employeeName: '情报开发', taskId: 't8aad9b57018842b49b39635cc1724c7f', taskText: '修改指标筛选器 hover 文案', taskStatus: 'running', kind: 'work', scene: 'coding', model: 'provider-1/very-long-model-identifier-with-variant/high', createdAt: Date.now() },
        { id: 'group-session-123', title: '群聊：情报小分队', employeeId: 'e1', employeeName: '情报开发', kind: 'group', createdAt: Date.now(), model: 'provider-1/deepseek-v4-flash/variant/high' },
        { id: 'orphan-session', title: '浏览器中的历史会话', employeeId: 'e1', employeeName: '情报开发', taskId: 't0386bfd54f2b4193bf9715b8797adee1', kind: 'computer', createdAt: Date.now() }
      ];
      const api = async (path, method = 'GET', body) => {
        if (path === '/debug/sessions') return sessions;
        if (path.includes('/messages?')) {
          const query = new URLSearchParams(path.split('?')[1]);
          const topicId = query.get('topicTaskId'), before = query.get('before'), after = query.get('after');
          historyRequests.push({ topicId, before, after });
          if (topicId === 'gone') throw Object.assign(Error('群任务话题不存在'), { status: 404 });
          if (before !== null && failOlderOnce) { failOlderOnce = false; throw Error('测试：暂时无法加载'); }
          if (holdHistory?.topicId === topicId && holdHistory.before === before && after === null) { holdHistory.started = true; await holdHistory.ready; }
          const scoped = messages.filter((m) => !topicId || m.topicTaskId === topicId);
          const eligible = scoped.filter((m) => (before === null || m.seq < Number(before)) && (after === null || m.seq > Number(after)));
          const page = eligible.slice(-Number(query.get('limit') || Infinity));
          return { group, messages: page, hasMore: page.length < eligible.length, lastSeq: scoped.at(-1)?.seq ?? 0, taskStatus: { [task.id]: task.status } };
        }
        if (path.endsWith('/messages') && method === 'POST') {
          messagePosts.push(body);
          messages.push({ seq: messages.length + 1, role: 'user', text: body.text, topicTaskId: body.topicTaskId, author: { kind: 'user', id: state.user.id, name: '发起人' } });
          return {};
        }
        if (path.endsWith('/read')) return {};
        if (path.startsWith('/groups/g1/tasks?')) return { members: [{ id: 'e1', name: '情报开发', mine: false, tasks: [other] }] };
        if (path.startsWith('/groups/g1/tasks/e1/')) {
          if (method === 'POST') { posts.push(body); task.status = body.action === 'answer' ? 'queued' : task.status; return body.action === 'redispatch' ? { id: 't2' } : {}; }
          return { ...(path.endsWith(other.id) ? other : task), id: path.split('/').at(-1), canControl: state.user.id === 'requester' };
        }
        throw Error('unexpected API ' + path);
      };
      const app = createApp({ render: () => state.view === 'debug' ? h(DebugSessions, { api, revision: state.revision }) : h(GroupChat, { api, user: state.user, groupId: 'g1', myEmployees: [], revision: state.revision, selectedTask: state.selectedTask, onTaskChange }) }).use(vaporInteropPlugin);
      try {
        app.mount('#app'); await flush();
        const scroller = () => document.querySelector('.chat-scroll');
        const chat = () => scroller().textContent;
        const tabs = () => [...document.querySelectorAll('.group-chat-tabs button')];
        const draft = () => document.querySelector('.chat-composer textarea');
        const firstRow = () => scroller().querySelector('[data-message-seq]');
        const row = seq => scroller().querySelector('[data-message-seq="' + seq + '"]');
        const scrollUp = () => { scroller().scrollTop = 0; scroller().dispatchEvent(new Event('scroll')); };
        const anchor = firstRow(), first = Number(anchor.dataset.messageSeq);
        check(first === otherSeq - 59 && !row(first - 1), 'main chat opens the latest page only');
        const page = pauseHistory(null, String(first));
        scrollUp(); scrollUp(); await flush();
        const anchorY = anchor.getBoundingClientRect().top;
        check(page.started && historyRequests.filter(r => r.before === String(first)).length === 1, 'scrolling up loads one older page even while the request is pending');
        for (let i = 1; i <= 65; i++) messages.push({ seq: otherSeq + i, role: 'user', text: '实时到达 ' + i, author: peer });
        state.revision++; await flush();
        page.release(); holdHistory = undefined; await flush();
        check(Number(firstRow().dataset.messageSeq) === first - 60 && !!row(otherSeq + 1) && !!row(otherSeq + 65), 'older rows and the full live gap both survive');
        check(Math.abs(anchor.getBoundingClientRect().top - anchorY) <= 2, 'prepending old messages keeps the visible row still');
        const opening = pauseHistory(task.id);
        scroller().scrollTop = 120;
        input(draft(), '暂未发送的主聊天草稿');
        document.querySelector('.chat-task-link').click(); await flush();
        check(opening.started && chat().includes('无关的主聊天') && tabs()[1].getAttribute('aria-busy') === 'true', 'a slow first visit keeps the main history on screen');
        check(document.querySelector('.chat-composer .send').disabled, 'the main draft cannot accidentally send during a cold switch');
        const mainTop = scroller().scrollTop;
        opening.release(); holdHistory = undefined; await flush();
        check(tabs()[1].getAttribute('aria-pressed') === 'true' && chat().includes('请核对这条任务') && !chat().includes('无关的主聊天'), 'first task opens its filtered topic');
        const firstTopic = firstRow().dataset.messageSeq;
        failOlderOnce = true;
        scrollUp(); await flush();
        const retry = document.querySelector('.older-messages button');
        check(retry?.textContent.includes('加载失败') && firstRow().dataset.messageSeq === firstTopic, 'a failed older-page request keeps the current topic visible');
        retry.click(); await flush();
        check(historyRequests.some(r => r.topicId === task.id && r.before === firstTopic) && !!row(2) && !row(1) && !document.querySelector('.older-messages'), 'retry loads the filtered topic page and stops at the beginning');
        scroller().scrollTop = 160;
        const topicTop = scroller().scrollTop;
        check(mainTop > 0 && topicTop > 0, 'both histories can actually scroll');
        const refreshingMain = pauseHistory(null);
        tabs()[0].click(); await flush();
        check(refreshingMain.started && !!row(first - 60) && chat().includes('无关的主聊天') && Math.abs(scroller().scrollTop - mainTop) <= 1, 'the cached main chat keeps its older pages and scroll position before the network replies');
        const refreshingTopic = pauseHistory(task.id);
        tabs()[1].click(); state.revision++; await flush();
        check(refreshingTopic.started && !!row(2) && !chat().includes('无关的主聊天') && Math.abs(scroller().scrollTop - topicTop) <= 1, 'the cached topic keeps its older pages and scroll position during a live refresh');
        refreshingMain.release(); await flush();
        check(tabs()[1].getAttribute('aria-pressed') === 'true' && !chat().includes('无关的主聊天'), 'a late main-chat response cannot replace the current topic');
        refreshingTopic.release(); holdHistory = undefined; await flush();
        check(document.querySelector('.task-detail')?.textContent.includes(task.text), 'a non-owner opens a linked task even when it is absent from the recent board');
        check(document.querySelector('.access-note')?.textContent.includes('可以操作'), 'requester gets controls');
        input(document.querySelector('.task-detail textarea'), '使用开发环境'); await flush();
        document.querySelector('.task-detail form button').click(); await flush();
        check(posts.length === 1 && posts[0].action === 'answer' && posts[0].text === '使用开发环境', 'answer targets the selected group task once');
        state.user.id = 'member'; state.revision++; await flush();
        check(document.querySelector('.task-detail') && document.querySelector('.access-note').textContent.includes('只读'), 'other group members still read task details');
        check(!document.querySelector('.task-detail textarea') && !document.querySelector('.task-detail .detail-foot button'), 'other members do not get task controls');
        state.user.id = 'requester'; task.status = 'done'; task.result = ('文案已核对，记录细节。\\n\\n').repeat(110); state.revision++; await flush();
        const detailScroll = document.querySelector('.group-work .panel-scroll.detail'), actions = detailScroll.querySelector('.detail-foot');
        check(detailScroll.scrollHeight > detailScroll.clientHeight + 200, 'long task detail actually scrolls');
        if (innerWidth >= 1000) check(document.querySelector('.group-work').clientWidth >= 495, 'desktop task panel uses the wider detail width');
        for (const offset of [0, 180, detailScroll.scrollHeight]) {
          detailScroll.scrollTop = offset;
          const body = detailScroll.getBoundingClientRect(), bar = actions.getBoundingClientRect();
          check(bar.top >= body.top && Math.abs(bar.bottom - body.bottom) <= 2, 'actions remain at the bottom while scrolling: ' + JSON.stringify({ offset, bar: bar.bottom, body: body.bottom }));
        }
        let redispatch = [...document.querySelectorAll('.task-detail button')].find(el => el.textContent.includes('重新派发'));
        redispatch.click(); await flush(); check(posts.length === 1, 'cancelled confirmation does not submit');
        confirmed = true; redispatch.click(); await flush();
        check(posts.length === 2 && posts[1].action === 'redispatch' && posts[1].confirmed === true, 'redispatch needs explicit confirmation');
        tabs()[0].click(); await flush();
        check(!!document.querySelector('.task-detail') && chat().includes('无关的主聊天'), 'the main tab does not close the task');
        input(draft(), '主聊天草稿'); await flush();
        // Clicking a different task overrides the manually selected main tab.
        row(otherSeq).querySelector('.chat-task-link').click(); await flush();
        check(tabs()[1].getAttribute('aria-pressed') === 'true' && tabs()[1].textContent.includes(other.text), 'clicking another task enters its topic');
        check(chat().includes('另一项任务的讨论') && !chat().includes('请核对这条任务') && !chat().includes('无关的主聊天'), 'only this task appears in the topic');
        check(draft().value === '', 'switching to a task does not copy a main-chat draft');
        row(otherSeq).querySelector('.chat-task-link').click(); await flush();
        check(tabs()[0].getAttribute('aria-pressed') === 'true' && document.querySelector('.task-detail')?.dataset.taskId === other.id, 'clicking the same task toggles back without exiting its detail');
        row(otherSeq).querySelector('.chat-task-link').click(); await flush();
        input(draft(), '话题补充'); await flush();
        document.querySelector('.chat-composer .send').click(); await flush();
        check(messagePosts.length === 1 && messagePosts[0].topicTaskId === other.id && chat().includes('话题补充'), 'topic send is tied to the selected task');
        document.querySelector('[aria-label="返回任务列表"]').click(); await flush();
        check(!tabs().length && draft().value === '主聊天草稿' && chat().includes('话题补充'), 'exiting the task returns to the main chat and preserves its draft');
        document.querySelector('[data-task-id="t-other"]').click(); await flush();
        check(tabs()[1].getAttribute('aria-pressed') === 'true', 'the work list opens a topic too');
        document.querySelector('[aria-label="收起工作面板"]').click(); await flush();
        check(!tabs().length && !state.selectedTask && !document.querySelector('.group-work') && chat().includes('无关的主聊天'), 'closing the work panel exits the topic and clears the route selection');
        state.view = 'debug'; await flush();
        state.selectedTask = { employeeId: 'e1', taskId: task.id };
        state.view = 'group'; await flush();
        check(document.querySelector('.task-detail')?.dataset.taskId === task.id && tabs()[1]?.textContent.includes(task.text) && chat().includes('请核对这条任务') && !chat().includes('无关的主聊天'), 'a fresh group page restores the routed task, title and topic even when it is absent from the work list');
        tabs()[0].click(); await flush();
        check(state.selectedTask?.taskId === task.id && document.querySelector('.task-detail'), 'manual chat tab switches leave the routed task open');
        state.view = 'debug'; await flush();
        state.selectedTask = { employeeId: 'e1', taskId: 'gone' };
        state.view = 'group'; await flush();
        check(!state.selectedTask && replacedTask && !tabs().length && !!row(otherSeq + 65), 'an unavailable deep link falls back to the latest main chat without adding history');
        state.view = 'debug'; await flush();
        for (const width of [320, 390, 880, 1280]) {
          document.querySelector('#app').style.width = width + 'px'; await flush();
          for (const el of document.querySelectorAll('.debug-list-pane, .debug-group, .debug-session, .debug-filters')) {
            check(el.scrollWidth <= el.clientWidth + 1, 'debug list overflows at ' + width + ': ' + el.className);
            check(el.getBoundingClientRect().right <= document.querySelector('#app').getBoundingClientRect().right + 1, 'debug element escapes its container at ' + width + ': ' + el.className + ' (' + el.getBoundingClientRect().right + ' > ' + document.querySelector('#app').getBoundingClientRect().right + ', viewport ' + innerWidth + ')');
          }
        }
        document.querySelector('#app').style.width = new URL(location.href).searchParams.get('width') + 'px';
        check(document.querySelectorAll('.debug-group').length === 4, 'work and computer sessions share a single task card');
        const taskCard = document.querySelector('.debug-group[aria-label^="任务"]');
        check(!taskCard.querySelector('.debug-title'), 'task titles are not repeated in every session row');
        check(getComputedStyle(taskCard.querySelector('.debug-group-head')).position !== 'sticky', 'task headers do not obscure scrolling rows');
        input(document.querySelector('.search input'), 't8aad9b570188'); await flush();
        check(document.querySelectorAll('.debug-session').length === 2, 'full task ids remain searchable');
        input(document.querySelector('.search input'), ''); await flush();
        result.textContent = 'ok';
      } catch (error) { result.textContent = error.stack || String(error); }
    `);
    await server.listen();
    const address = server.httpServer!.address();
    assert(address && typeof address !== "string");
    const url = `http://127.0.0.1:${address.port}/.tmp/${basename(dir)}/index.html`;
    const browser = process.env.VEGA_CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";
    for (const width of [390, 1280]) {
      const { stdout } = await run(browser, ["--headless=new", "--no-first-run", "--no-default-browser-check", "--no-sandbox", "--disable-gpu", `--window-size=${width},900`, "--user-data-dir=" + join(dir, "profile-" + width), "--virtual-time-budget=12000", "--screenshot=" + join(temp, `group-debug-ui-${width}.png`), "--dump-dom", url + "?width=" + width], { timeout: 45000, maxBuffer: 4 << 20, windowsHide: true });
      const report = stdout.match(/<pre id="result">([\s\S]*?)<\/pre>/)?.[1];
      assert.equal(report, "ok", report || "fixture did not return a result");
    }
  } finally {
    await server.close();
    await rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
});
