import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, join, resolve } from "node:path";
import { promisify } from "node:util";

// Exercise the unmodified React bundle, not a mocked rendering of the bridge contracts.
test("original Grok components load history, send once and create a separate Vega bot", { skip: process.env.VEGA_TEST_CHROME !== "1", timeout: 45000 }, async () => {
  const dir = await mkdtemp(join(tmpdir(), "vega-grok-ui-")), root = resolve("local/grok_ui");
  const employees = [{ thread: "employee:e1", id: "e1", name: "Fixture Bot", mine: true }];
  const histories: Record<string, any[]> = { "employee:e1": [{ seq: 1, role: "user", text: "History fixture", at: 1794290000000 }, { seq: 2, role: "assistant", text: "**Original Grok components**", at: 1794290001000 }] };
  const requests: [string, any][] = [];
  const probe = `
    const errors=[]; addEventListener('error',e=>errors.push(e.message)); addEventListener('unhandledrejection',e=>errors.push(String(e.reason)));
    const wait=async check=>{for(let n=0;n<100;n++){if(check())return;await new Promise(r=>setTimeout(r,50));}throw Error('Renderer condition timed out');};
    (async()=>{try{
      await wait(()=>[...document.querySelectorAll('button')].some(b=>b.textContent==='Fixture Bot'));
      [...document.querySelectorAll('button')].find(b=>b.textContent==='Fixture Bot').click();
      await wait(()=>document.body.innerText.includes('Original Grok components'));
      const editor=document.querySelector('[contenteditable=true]');editor.focus();document.execCommand('insertText',false,'Sent through original composer');
      await wait(()=>document.querySelector('[aria-label="Send message"]'));document.querySelector('[aria-label="Send message"]').click();
      await wait(()=>document.body.innerText.includes('Fixture reply after send'));
      document.querySelector('[aria-label="New Bot"]').click();
      await wait(()=>document.querySelector('input[aria-label="Bot name"]'));
      const input=document.querySelector('input[aria-label="Bot name"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'Created fixture');input.dispatchEvent(new Event('input',{bubbles:true}));
      await wait(()=>[...document.querySelectorAll('button')].some(b=>b.textContent==='Create'&&!b.disabled));
      [...document.querySelectorAll('button')].find(b=>b.textContent==='Create').click();
      await wait(()=>document.querySelector('[contenteditable=true]')?.getAttribute('aria-placeholder')==='Message Created fixture');
      await new Promise(r=>setTimeout(r,200));
      document.documentElement.dataset.fixture=JSON.stringify({ok:true,errors,text:document.body.innerText,original:!!document.querySelector('.sand-prompt-field')});
    }catch(e){document.documentElement.dataset.fixture=JSON.stringify({ok:false,errors:[...errors,String(e)]});}})();`;
  const types: Record<string, string> = { ".js": "text/javascript", ".css": "text/css", ".html": "text/html", ".woff2": "font/woff2", ".svg": "image/svg+xml", ".png": "image/png" };
  const server = createServer(async (req, res) => {
    try {
      const path = new URL(req.url!, "http://fixture").pathname;
      if (path.includes("/api/")) {
        const chunks = []; for await (const chunk of req) chunks.push(chunk);
        const body = JSON.parse(Buffer.concat(chunks).toString() || "{}"), op = path.split("/").at(-1)!;
        requests.push([op, body]);
        let value: any = {};
        if (op === "host") value = { paired: true, account: "fixture", version: "test" };
        if (op === "threads") value = { employees, groups: [] };
        if (op === "messages") { const rows = histories[body.thread] || []; value = { messages: rows.filter(m => !body.after || m.seq > body.after), lastSeq: rows.at(-1)?.seq || 0 }; }
        if (op === "send") {
          histories[body.thread].push({ seq: 3, role: "user", text: body.text, clientMessageId: body.clientMessageId, at: Date.now() }, { seq: 4, role: "assistant", text: "Fixture reply after send", at: Date.now() });
          value = { ok: true };
        }
        if (op === "create") { employees.push({ thread: "employee:e2", id: "e2", name: body.name, mine: true }); histories["employee:e2"] = []; value = { id: "e2" }; }
        res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(value)); return;
      }
      if (path === "/probe.js") { res.setHeader("Content-Type", "text/javascript"); res.end(probe); return; }
      const file = resolve(root, path.replace(/^\/assistant\/fixture\//, "") || "index.html");
      if (!file.startsWith(root + "/") && !file.startsWith(root + "\\")) { res.writeHead(404).end(); return; }
      let bytes: Buffer | string = await readFile(file);
      if (file.endsWith("index.html")) bytes = bytes.toString().replace("<head>", '<head><script src="/probe.js"></script>');
      res.setHeader("Content-Type", types[extname(file)] || "application/octet-stream"); res.end(bytes);
    } catch { res.writeHead(404).end(); }
  });
  try {
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    const url = `http://127.0.0.1:${(server.address() as any).port}/assistant/fixture/`;
    const { stdout } = await promisify(execFile)(process.env.VEGA_CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe", ["--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "--no-sandbox", "--user-data-dir=" + dir, "--virtual-time-budget=12000", "--dump-dom", url], { timeout: 35000, maxBuffer: 16 << 20, windowsHide: true });
    const encoded = stdout.match(/data-fixture="([^"]+)"/)?.[1];
    assert(encoded, "the original renderer must finish its interaction probe");
    const result = JSON.parse(encoded.replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">"));
    assert.equal(result.ok, true, JSON.stringify(result)); assert.equal(result.original, true); assert.deepEqual(result.errors, []);
    assert.doesNotMatch(result.text, /History fixture|Original Grok components|Sent through original composer/, "new bot transcripts must not inherit a different conversation");
    assert.equal(requests.filter(([op]) => op === "send").length, 1);
    assert.equal(requests.find(([op]) => op === "send")![1].text, "Sent through original composer");
    assert.equal(requests.filter(([op]) => op === "create").length, 1);
    assert.equal(requests.find(([op]) => op === "create")![1].name, "Created fixture");
  } finally {
    server.closeAllConnections(); if (server.listening) await new Promise<void>(resolve => server.close(() => resolve()));
    await rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
});
