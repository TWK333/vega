import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { promisify } from "node:util";
import { createServer } from "vite";
import vue from "@vitejs/plugin-vue";

const run = promisify(execFile);

test("personal trigger settings can create, edit, disable and delete a webhook", { skip: process.env.VEGA_TEST_CHROME !== "1", timeout: 60000 }, async () => {
  const root = process.cwd(), temp = join(root, ".tmp");
  await mkdir(temp, { recursive: true });
  const dir = await mkdtemp(join(temp, "trigger-settings-"));
  const server = await createServer({ configFile: false, root, plugins: [vue()], server: { host: "127.0.0.1", port: 0, watch: null }, logLevel: "error" });
  try {
    await writeFile(join(dir, "index.html"), '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><div id="app"></div><pre id="result">pending</pre><script type="module" src="./fixture.js"></script>');
    await writeFile(join(dir, "fixture.js"), `
      import { createApp, h, nextTick, vaporInteropPlugin } from 'vue';
      import SettingsView from '/web/src/SettingsView.vue';
      import '/web/src/style.css';
      const result = document.querySelector('#result');
      const check = (ok, text) => { if (!ok) throw Error(text); };
      const settle = async () => { await nextTick(); await new Promise(resolve => setTimeout(resolve, 10)); await nextTick(); };
      const input = (el, value) => { el.value = value; el.dispatchEvent(new Event('input', { bubbles: true })); };
      const requests = []; let rows = [];
      const api = async (path, method = 'GET', data) => {
        if (path === '/me/vault') return { entries: [] };
        if (path === '/me/external-mcp') return { configs: [] };
        if (path === '/groups') return [];
        if (path === '/me/triggers' && method === 'GET') return { triggers: rows, droppedAt: null };
        requests.push({ path, method, data: data && JSON.parse(JSON.stringify(data)) });
        if (path === '/me/triggers' && method === 'POST') {
          rows = [{ id: 'tr1', name: data.name, enabled: data.enabled, condition: data.condition, action: data.action, body: data.body, hasUrl: true, hasHeaders: true }];
        } else if (method === 'PATCH') rows[0].enabled = data.enabled;
        else if (method === 'DELETE') rows = [];
        return { ok: true };
      };
      try {
        window.confirm = () => true;
        createApp({ render: () => h(SettingsView, { api, config: {}, models: [], userId: 'u1', tab: 'triggers', admin: false, canExecute: true, employees: [] }) }).use(vaporInteropPlugin).mount('#app');
        await settle();
        check([...document.querySelectorAll('.settings-nav button')].some(button => button.textContent.includes('触发器')), 'personal settings has no trigger tab');
        let form = document.querySelector('.trigger-form');
        check(form && !form.closest('[hidden]'), 'trigger page is not visible');
        check(JSON.parse(form.querySelectorAll('textarea')[1].value).text.content.includes('{{message}}'), 'WeCom template is missing');
        check(JSON.parse(form.querySelectorAll('textarea')[1].value).text.content.includes('{{taskLinks}}'), 'task links are missing from the default template');
        input(form.querySelector('input[required]'), '企业微信');
        input(form.querySelector('input[type=password]'), 'https://example.com/hook?key=secret');
        form.requestSubmit(); await settle();
        check(requests.length === 1 && requests[0].data.url.includes('key=secret'), 'create did not submit the URL');
        check(document.querySelector('.item-list li')?.textContent.includes('企业微信'), 'created trigger is missing');
        document.querySelectorAll('.item-list li button')[1].click(); await settle();
        form = document.querySelector('.trigger-form');
        check(form.querySelector('input[type=password]').value === '', 'saved URL must not be exposed on edit');
        form.requestSubmit(); await settle();
        check(requests[1].data.id === 'tr1' && requests[1].data.url === '', 'editing must retain the saved URL');
        document.querySelectorAll('.item-list li button')[0].click(); await settle();
        check(requests[2].method === 'PATCH' && requests[2].data.enabled === false, 'disable did not save');
        document.querySelectorAll('.item-list li button')[2].click(); await settle();
        check(requests[3].method === 'DELETE' && !document.querySelector('.item-list li'), 'delete did not update the list');
        check(document.documentElement.scrollWidth <= innerWidth + 1, 'settings overflow on a narrow screen');
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
