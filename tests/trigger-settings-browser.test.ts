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
      const change = (el, value) => { el.value = value; el.dispatchEvent(new Event('change', { bubbles: true })); };
      const checkTarget = (el, checked) => { el.checked = checked; el.dispatchEvent(new Event('change', { bubbles: true })); };
      const requests = [], errors = []; let rows = [];
      const api = async (path, method = 'GET', data) => {
        if (path === '/me/vault') return { entries: [] };
        if (path === '/me/external-mcp') return { configs: [] };
        if (path === '/groups') return [{ id: 'g1', name: '项目群' }];
        if (path === '/me/triggers' && method === 'GET') return { triggers: rows, droppedAt: null };
        requests.push({ path, method, data: data && JSON.parse(JSON.stringify(data)) });
        if (path === '/me/triggers' && method === 'POST') {
          rows = [{ id: 'tr1', name: data.name, enabled: data.enabled, condition: data.condition, action: data.action, scope: data.scope, url: data.url || rows[0]?.url, body: data.body, hasUrl: true, hasHeaders: true }];
        } else if (method === 'PATCH') rows[0].enabled = data.enabled;
        else if (method === 'DELETE') rows = [];
        return { ok: true };
      };
      try {
        window.confirm = () => true;
        createApp({ render: () => h(SettingsView, { api, config: {}, models: [], userId: 'u1', tab: 'triggers', admin: false, canExecute: true, employees: [{ id: 'e1', name: '热心市民小周' }, { id: 'e2', name: '热心市民小林' }], onError: error => errors.push(error) }) }).use(vaporInteropPlugin).mount('#app');
        await settle();
        check([...document.querySelectorAll('.settings-nav button')].some(button => button.textContent.includes('触发器')), 'personal settings has no trigger tab');
        let form = document.querySelector('.trigger-form');
        check(form && !form.closest('[hidden]'), 'trigger page is not visible');
        check(JSON.parse(form.querySelectorAll('textarea')[1].value).text.content.includes('{{message}}'), 'WeCom template is missing');
        check(JSON.parse(form.querySelectorAll('textarea')[1].value).text.content.includes('{{taskLinks}}'), 'task links are missing from the default template');
        const name = form.querySelector('input[name=trigger-name]'), url = form.querySelector('input[name=trigger-webhook-url]');
        check(form.autocomplete === 'off' && name.autocomplete === 'off' && url.autocomplete === 'off' && url.type === 'url', 'trigger fields must not be treated as a login');
        const actionBox = form.querySelectorAll('select')[1].getBoundingClientRect(), enabledBox = form.querySelector('.trigger-enabled input').getBoundingClientRect();
        if (enabledBox.left >= actionBox.right) check(Math.abs((actionBox.top + actionBox.bottom - enabledBox.top - enabledBox.bottom) / 2) <= 2, 'enable checkbox is not aligned with the action control');
        input(name, '企业微信');
        input(url, 'https://example.com/hook?key=secret');
        change(form.querySelector('select[name=trigger-scope]'), 'selected'); await settle();
        const labels = [...form.querySelectorAll('.targets fieldset:first-of-type label.check')].map(el => el.getBoundingClientRect());
        check(labels.length === 2 && (labels[1].top >= labels[0].bottom + 6 || labels[1].left >= labels[0].right + 16), 'target options overlap or lack spacing');
        form.requestSubmit(); await settle();
        check(requests.length === 0 && errors.at(-1)?.includes('至少选择'), 'empty restricted scope must not be saved');
        checkTarget(form.querySelector('input[value=e1]'), true);
        checkTarget(form.querySelector('input[value=g1]'), true); await settle();
        form.requestSubmit(); await settle();
        check(requests.length === 1 && requests[0].data.url.includes('key=secret'), 'create did not submit the URL');
        check(JSON.stringify(requests[0].data.scope) === JSON.stringify({ employees: ['e1'], groups: ['g1'] }), 'selected scope was not submitted');
        check(document.querySelector('.item-list li')?.textContent.includes('热心市民小周') && document.querySelector('.item-list li')?.textContent.includes('项目群'), 'selected scope is missing from the list');
        document.querySelectorAll('.item-list li button')[1].click(); await settle();
        form = document.querySelector('.trigger-form');
        check(form.querySelector('input[name=trigger-webhook-url]').value === 'https://example.com/hook?key=secret', 'saved URL must be visible on edit');
        check(form.querySelector('input[value=e1]').checked && form.querySelector('input[value=g1]').checked, 'saved targets must be selected on edit');
        input(form.querySelector('input[name=trigger-webhook-url]'), 'https://example.com/new-hook?key=updated');
        checkTarget(form.querySelector('input[value=e1]'), false); await settle();
        form.requestSubmit(); await settle();
        check(requests[1].data.id === 'tr1' && requests[1].data.url === 'https://example.com/new-hook?key=updated' && requests[1].data.scope.employees.length === 0 && requests[1].data.scope.groups[0] === 'g1', 'editing must update the URL and scope');
        document.querySelectorAll('.item-list li button')[1].click(); await settle();
        check(document.querySelector('input[name=trigger-webhook-url]').value === 'https://example.com/new-hook?key=updated', 'edited URL must remain visible');
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
    for (const width of [360, 1280]) {
      const { stdout } = await run(browser, ["--headless=new", "--no-first-run", "--no-default-browser-check", "--no-sandbox", "--disable-gpu", `--window-size=${width},900`, "--user-data-dir=" + join(dir, "profile-" + width), "--virtual-time-budget=10000", "--dump-dom", url], { timeout: 45000, maxBuffer: 4 << 20, windowsHide: true });
      const report = stdout.match(/<pre id="result">([\s\S]*?)<\/pre>/)?.[1];
      assert.equal(report, "ok", `${width}px: ${report || "fixture did not return a result"}`);
    }
  } finally {
    await server.close();
    await rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
});
