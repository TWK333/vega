import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { promisify } from "node:util";
import { createServer } from "vite";
import vue from "@vitejs/plugin-vue";

const run = promisify(execFile);

test("scene model search and deleted task cards work in the rendered UI", { skip: process.env.VEGA_TEST_CHROME !== "1", timeout: 60000 }, async () => {
  const root = process.cwd(), temp = join(root, ".tmp");
  await mkdir(temp, { recursive: true });
  const dir = await mkdtemp(join(temp, "scene-picker-"));
  const server = await createServer({ configFile: false, root, plugins: [vue()], server: { host: "127.0.0.1", port: 0, watch: null }, logLevel: "error" });
  try {
    await writeFile(join(dir, "index.html"), '<!doctype html><meta charset="utf-8"><div id="scenes"></div><div id="chat"></div><pre id="result">pending</pre><script type="module" src="./fixture.js"></script>');
    await writeFile(join(dir, "fixture.js"), `
      import { createApp, h, nextTick, reactive, vaporInteropPlugin } from 'vue';
      import SceneSettings from '/web/src/SceneSettings.vue';
      import ChatMessage from '/web/src/ChatMessage.vue';
      import '/web/src/style.css';
      const result = document.querySelector('#result');
      const check = (ok, text) => { if (!ok) throw Error(text); };
      const input = (el, value) => { el.value = value; el.dispatchEvent(new Event('input', { bubbles: true })); };
      const change = (el, value) => { el.value = value; el.dispatchEvent(new Event('change', { bubbles: true })); };
      try {
        const config = { scenes: { lightweight: ['a/text'], coding: ['a/text'], computer: ['b/vision'] } };
        const models = [
          { id: 'a/text', name: 'Alpha Text', supportsImages: false },
          { id: 'b/vision', name: 'Beta Vision', supportsImages: true, variants: ['high'] }
        ];
        let saved;
        createApp({ render: () => h(SceneSettings, { config, models, api: async (_path, _method, data) => { saved = data; return data; } }) }).use(vaporInteropPlugin).mount('#scenes');
        await nextTick();
        const rows = () => document.querySelectorAll('.scene-item');
        document.querySelector('#scenes').style.width = '320px';
        for (const row of document.querySelectorAll('.scene-item, .scene-row, .model-picker'))
          check(row.scrollWidth <= row.clientWidth + 1, 'model picker overflows a narrow screen');
        let search = rows()[0].querySelector('input[type=search]'), select = rows()[0].querySelector('select');
        input(search, 'vIsIoN'); await nextTick();
        check(select.value === 'a/text', 'filter must preserve the previous selection');
        check([...select.options].some(o => o.value === 'b/vision/variant/high'), 'search finds variants');
        change(select, 'b/vision/variant/high'); await nextTick();
        input(search, 'no matches'); await nextTick();
        check(select.value === 'b/vision/variant/high' && select.textContent.includes('没有匹配的模型'), 'no-match search preserves the chosen model');
        const visionSearch = rows()[2].querySelector('input[type=search]'), visionSelect = rows()[2].querySelector('select');
        input(visionSearch, 'alpha'); await nextTick();
        check(![...visionSelect.options].some(o => o.value === 'a/text'), 'text-only model is not offered for browser use');
        rows()[0].querySelector('.add-model').click(); await nextTick();
        const firstRow = rows()[0].querySelectorAll('.scene-row')[0];
        firstRow.querySelector('button[aria-label^=下移]').click(); await nextTick();
        check(rows()[0].querySelectorAll('.scene-row')[1].querySelector('input[type=search]').value === 'no matches', 'search stays with its row when reordered');
        document.querySelector('.card-head button').click(); await nextTick();
        check(saved.scenes.lightweight[0] === 'b/vision/variant/high', 'saving keeps the selected model after filtering');
        check(!JSON.stringify(saved).includes('no matches'), 'search text is not saved in configuration');
        const data = reactive({ tasks: undefined, taskStatus: {}, message: { role: 'assistant', text: 'result', tasks: [{ id: 't1', title: 'task', status: 'waiting' }] } });
        createApp({ render: () => h(ChatMessage, { ...data, name: 'bot', employeeId: 'e1' }) }).use(vaporInteropPlugin).mount('#chat');
        await nextTick();
        let task = document.querySelector('.chat-task-link');
        check(!task.disabled && task.textContent.includes('待补充信息'), 'unloaded tasks keep the snapshot');
        data.tasks = []; await nextTick();
        task = document.querySelector('.chat-task-link');
        check(task.disabled && task.textContent.includes('已删除'), 'a missing loaded task is marked deleted and disabled');
        data.tasks = undefined; data.taskStatus = { t1: 'running' }; await nextTick();
        task = document.querySelector('.chat-task-link');
        check(!task.disabled && task.textContent.includes('执行中'), 'live group status wins over the snapshot');
        result.textContent = 'ok';
      } catch (error) { result.textContent = error.stack || String(error); }
    `);
    await server.listen();
    const address = server.httpServer!.address();
    assert(address && typeof address !== "string");
    const url = `http://127.0.0.1:${address.port}/.tmp/${basename(dir)}/index.html`;
    const browser = process.env.VEGA_CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";
    const { stdout } = await run(browser, ["--headless=new", "--no-first-run", "--no-default-browser-check", "--no-sandbox", "--disable-gpu", "--window-size=360,900", "--user-data-dir=" + join(dir, "profile"), "--virtual-time-budget=10000", "--dump-dom", url], { timeout: 45000, maxBuffer: 4 << 20, windowsHide: true });
    const report = stdout.match(/<pre id="result">([\s\S]*?)<\/pre>/)?.[1];
    assert.equal(report, "ok", report || "fixture did not return a result");
  } finally {
    await server.close();
    await rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
});
