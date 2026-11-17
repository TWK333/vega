import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { promisify } from "node:util";
import { createServer } from "vite";
import vue from "@vitejs/plugin-vue";

const run = promisify(execFile);

test("external MCP configuration is copyable JSON only when a token is issued", { skip: process.env.VEGA_TEST_CHROME !== "1", timeout: 60000 }, async () => {
  const root = process.cwd(), temp = join(root, ".tmp");
  await mkdir(temp, { recursive: true });
  const dir = await mkdtemp(join(temp, "external-mcp-ui-"));
  const server = await createServer({ configFile: false, root, plugins: [vue()], server: { host: "127.0.0.1", port: 0, watch: null }, logLevel: "error" });
  try {
    await writeFile(join(dir, "index.html"), '<!doctype html><meta charset="utf-8"><div id="app"></div><pre id="result">pending</pre><script type="module" src="./fixture.js"></script>');
    await writeFile(join(dir, "fixture.js"), `
      import { createApp, h, vaporInteropPlugin } from 'vue';
      import ExternalMcpSettings from '/web/src/ExternalMcpSettings.vue';
      import '/web/src/style.css';
      const result = document.querySelector('#result');
      const check = (ok, message) => { if (!ok) throw Error(message); };
      const waitFor = async (condition, message) => {
        for (let i = 0; i < 100; i++) {
          if (condition()) return;
          await new Promise(resolve => setTimeout(resolve, 10));
        }
        throw Error(message);
      };
      const clone = value => JSON.parse(JSON.stringify(value));
      const old = { id: 'old', name: '已有连接', enabled: true, revoked: false, tokenHint: 'vmcp_…old', url: 'https://vega.example/api/mcp/old', employees: ['e1'], groups: [] };
      let records = [old], count = 0, failNextLoad = false, copied = '';
      const errors = [];
      const api = async (path, method, body) => {
        if (path === '/groups') return [];
        if (path === '/me/external-mcp' && !method) {
          if (failNextLoad) { failNextLoad = false; throw Error('列表加载失败'); }
          return { configs: clone(records) };
        }
        if (path === '/me/external-mcp' && method === 'POST') {
          count++;
          const config = { ...clone(body), id: 'xm' + count, revoked: false, url: 'https://vega.example/api/mcp/xm' + count };
          records.unshift(config);
          if (count === 1) failNextLoad = true;
          return { config: clone(config), token: 'vmcp_' + String(count).repeat(43) };
        }
        const match = /^\\/me\\/external-mcp\\/([^/]+)\\/(rotate|revoke)$/.exec(path);
        if (match && method === 'POST') {
          const config = records.find(item => item.id === match[1]);
          if (match[2] === 'rotate') return { config: clone(config), token: 'vmcp_' + 'r'.repeat(43) };
          config.revoked = true;
          return { config: clone(config) };
        }
        throw Error('unexpected API: ' + path + ' ' + method);
      };
      const button = (scope, text) => [...scope.querySelectorAll('button')].find(node => node.textContent.trim() === text);
      const textarea = id => document.getElementById('mcp-json-' + id);
      const form = () => [...document.querySelectorAll('.external-mcp > .card')].find(node => node.querySelector('h3')?.textContent === '新建连接').querySelector('form');
      const create = async name => {
        await waitFor(() => !form().querySelector('button[type=submit]').disabled, 'creation form remained busy');
        const node = form(), nameInput = node.querySelector('input:not([type=checkbox])');
        nameInput.value = name;
        nameInput.dispatchEvent(new Event('input', { bubbles: true }));
        node.querySelector('.targets input[type=checkbox]').click();
        node.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      };
      try {
        window.confirm = () => true;
        const app = createApp({ render: () => h(ExternalMcpSettings, { api, employees: [{ id: 'e1', name: '牛马' }], onError: error => errors.push(error) }) });
        app.use(vaporInteropPlugin).mount('#app');
        await waitFor(() => document.body.textContent.includes('已有连接'), 'existing configuration did not load');
        check(!document.querySelector('.config-json'), 'existing tokens must not be recoverable');
        check(!document.body.textContent.includes('连接地址') && !document.body.textContent.includes('vmcp_…old'), 'address or token hint shown separately');
        check(!document.querySelector('input[readonly]'), 'address or token field shown separately');

        await create('第一条');
        await waitFor(() => textarea('xm1'), 'created JSON missing after list reload failed');
        check(errors.includes('列表加载失败'), 'failed list reload should be reported');
        const one = textarea('xm1');
        const first = JSON.parse(one.value);
        check(first.mcpServers.vega.url === 'https://vega.example/api/mcp/xm1', 'wrong endpoint in JSON');
        check(first.mcpServers.vega.headers.Authorization === 'Bearer vmcp_' + '1'.repeat(43), 'wrong authorization in JSON');
        check(one.readOnly, 'configuration should be selectable but not editable');

        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async value => { copied = value; } } });
        button(one.closest('section'), '复制 JSON').click();
        await waitFor(() => copied, 'clipboard copy not called');
        check(copied === one.value, 'clipboard did not receive the displayed JSON');
        copied = '';
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
        document.execCommand = command => {
          check(command === 'copy' && document.activeElement === one && one.selectionStart === 0 && one.selectionEnd === one.value.length, 'fallback must select the full JSON');
          copied = one.value;
          return true;
        };
        button(one.closest('section'), '复制 JSON').click();
        check(copied === one.value, 'clipboard fallback did not copy JSON');

        await create('第二条');
        await waitFor(() => textarea('xm2'), 'second JSON missing');
        check(textarea('xm1'), 'creating another connection must not lose an unacknowledged JSON');
        const firstCard = textarea('xm1').closest('section');
        button(firstCard, '轮换令牌').click();
        await waitFor(() => textarea('xm1')?.value.includes('vmcp_' + 'r'.repeat(43)), 'rotated JSON missing');
        const rotated = JSON.parse(textarea('xm1').value);
        check(rotated.mcpServers.vega.headers.Authorization === 'Bearer vmcp_' + 'r'.repeat(43), 'rotated JSON contains the old token');
        check(textarea('xm2'), 'rotating one connection must not hide another JSON');
        button(textarea('xm1').closest('section'), '吊销').click();
        await waitFor(() => !textarea('xm1'), 'revocation must clear the JSON');
        button(textarea('xm2').closest('section'), '我已保存，不再显示').click();
        await waitFor(() => !textarea('xm2'), 'dismissed JSON is still visible');
        app.unmount();
        result.textContent = 'ok';
      } catch (error) { result.textContent = (error.stack || String(error)) + '\\ncreated=' + count + ', errors=' + errors.join(' | '); }
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
