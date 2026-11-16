import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { promisify } from "node:util";
import { createServer } from "vite";
import vue from "@vitejs/plugin-vue";

const run = promisify(execFile);
test("authorization page requires an explicit allow or deny and blocks viewer approval", { skip: process.env.VEGA_TEST_CHROME !== "1", timeout: 60000 }, async () => {
  const root = process.cwd(), temp = join(root, ".tmp");
  await mkdir(temp, { recursive: true });
  const dir = await mkdtemp(join(temp, "device-auth-"));
  const server = await createServer({ configFile: false, root, plugins: [vue()], server: { host: "127.0.0.1", port: 0, watch: null }, logLevel: "error" });
  try {
    await writeFile(join(dir, "index.html"), '<!doctype html><meta charset="utf-8"><div id="allow"></div><div id="deny"></div><div id="viewer"></div><div id="uncertain"></div><pre id="result">pending</pre><script type="module" src="./fixture.js"></script>');
    await writeFile(join(dir, "fixture.js"), `
      import { createApp, h, nextTick, vaporInteropPlugin } from 'vue';
      import ClientAuthorization from '/web/src/ClientAuthorization.vue';
      import '/web/src/style.css';
      const result = document.querySelector('#result'), calls = [], check = (ok, text) => { if (!ok) throw Error(text); };
      const api = async (path, method, body) => {
        calls.push({ path, method, body });
        if (!method) return { name: 'Fixture PC', platform: 'windows', clientId: 'abcdef', status: 'pending' };
        if (body.requestId === 'uncertain') throw Error('连接中断');
        return { status: body.approved ? 'approved' : 'denied' };
      };
      try {
        for (const id of ['allow', 'deny', 'viewer', 'uncertain'])
          createApp({ render: () => h(ClientAuthorization, { requestId: id, api, user: { username: 'alice', role: id === 'viewer' ? 'viewer' : 'operator' } }) }).use(vaporInteropPlugin).mount('#' + id);
        await new Promise(resolve => setTimeout(resolve, 50)); await nextTick();
        check(calls.length === 4 && calls.every(c => !c.method), 'rendering must not approve a device');
        check(document.querySelector('#allow').textContent.includes('Fixture PC'), 'device identity missing');
        check(document.querySelector('#allow').textContent.includes('执行命令'), 'permissions missing');
        check(!document.querySelector('#viewer .actions') && document.querySelector('#viewer').textContent.includes('只读账号'), 'viewer must not be able to approve');
        document.querySelector('#allow .primary').click();
        document.querySelector('#deny .actions button:last-child').click();
        document.querySelector('#uncertain .primary').click();
        await new Promise(resolve => setTimeout(resolve, 50)); await nextTick();
        const decisions = calls.filter(c => c.method === 'POST');
        check(decisions.length === 3 && decisions[0].body.approved === true && decisions[1].body.approved === false, 'wrong consent decisions');
        check(document.querySelector('#allow').textContent.includes('已允许') && document.querySelector('#deny').textContent.includes('已拒绝'), 'confirmation missing');
        check(!document.querySelector('#uncertain .actions') && document.querySelector('#uncertain').textContent.includes('不要重复授权'), 'uncertain decision must not be replayed');
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
