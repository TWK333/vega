import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createServer } from "node:http";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, join } from "node:path";
import { test } from "node:test";
import { promisify } from "node:util";

const probe = `
const report = (value) => {
  const result = document.createElement('pre'); result.id = 'probe'; result.textContent = JSON.stringify(value); document.body.append(result);
};
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const wait = async (find) => { for (let i = 0; i < 130; i++) { const result = find(); if (result) return result; await delay(50); } };
const leaf = (text) => [...document.querySelectorAll('body *')].find(el => !el.childElementCount && el.textContent === text);
async function run() {
  if (location.search === '?authorize=1') {
    if (!await wait(() => document.querySelector('#vega-welcome-actions:not([hidden])'))) throw Error('missing Vega authorization screen');
    const title = document.querySelector('#vega-welcome-title').textContent;
    if (document.title !== title || document.querySelector('#root').childElementCount || /Grok Bot|Cursor/.test(document.body.innerText))
      throw Error('the vendor login must not mount before authorization');
    document.getElementById('vega-authorize').click();
    if (!await wait(() => document.getElementById('vega-welcome-status')?.textContent.includes('系统浏览器'))) throw Error('the Vega authorization button did not open the pending request');
    document.getElementById('vega-recheck').click();
    if (!await wait(() => !document.getElementById('vega-welcome') && document.querySelector('button[data-agent-id="e1"]'))) throw Error('chat did not load after authorization');
    report({ title, entered: true });
    return;
  }
  const rowIds = () => [...document.querySelectorAll('button[data-agent-id]')].map(el => el.dataset.agentId);
  const sidebarOrder = await wait(() => {
    const ids = rowIds();
    return ids.includes('e1') && ids.includes('e2') && ids.includes('group:g1') ? ids : null;
  });
  if (!sidebarOrder) throw Error('missing sidebar rows: ' + rowIds().join(','));
  const group = await wait(() => leaf('协作群样例'));
  if (!group) throw Error('missing group row');
  (group.closest('button,[role=button],a') || group).click();
  const peer = await wait(() => document.body.innerText.includes('群里原有消息') && document.body.innerText.includes('群成员样例：'));
  if (!peer) throw Error('missing group history');
  const composer = await wait(() => document.querySelector('[contenteditable=true]'));
  if (!composer) throw Error('missing compose editor');
  if (location.search === '?reopened=1') {
    const panel = await wait(() => {
      const el = document.querySelector('#vega-recovered-sends');
      return el && !el.hidden ? el : null;
    });
    if (!panel) throw Error('missing recovered send disclosure');
    report({ recovered: panel.querySelector('pre').textContent,
      inTimeline: [...document.querySelectorAll('[data-row-key]')].some(row => row.textContent.includes('本机未确认的发送样例')),
      copies: [...document.querySelectorAll('[data-row-key]')].filter(row => row.textContent.includes('回显只显示一次')).length });
  } else {
  let captureRequests = 0;
  Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { value: async () => { captureRequests++; throw Error('voice should be disabled'); } });
  composer.focus();
  const dictation = new KeyboardEvent('keydown', { key: 'd', code: 'KeyD', ctrlKey: true, bubbles: true, cancelable: true });
  composer.dispatchEvent(dictation);
  const availableVoice = () => [...document.querySelectorAll('button[aria-label]')].filter(el => el.getClientRects().length && /语音输入|麦克风|听写|dictat|voice input|microphone/i.test(el.getAttribute('aria-label'))).length;
  const voiceBefore = availableVoice();
  async function sendText(text) {
    const box = document.querySelector('[contenteditable=true]');
    box.focus();
    document.execCommand('insertText', false, text);
    const send = await wait(() => document.querySelector('.sand-prompt-send:enabled'));
    if (!send) throw Error('missing send button');
    send.click();
  }
  const copies = () => [...document.querySelectorAll('[data-row-key]')].filter(row => row.textContent.includes('回显只显示一次')).length;
  await sendText('回显只显示一次');
  if (!await wait(() => document.body.innerText.includes('群回复样例 1'))) throw Error('missing first saved reply');
  const first = copies();
  await sendText('回显只显示一次');
  if (!await wait(() => document.body.innerText.includes('群回复样例 2'))) throw Error('missing saved reply after losing the HTTP acknowledgement');
  const second = copies();
  await sendText('本机未确认的发送样例');
  const pending = await wait(() => Object.keys(localStorage).some(key => key.endsWith('.send-journal') && localStorage.getItem(key)?.includes('本机未确认的发送样例')));
  if (!pending) throw Error('unsent text is not recoverable');
  const reaction = document.querySelector('button.sand-message-hover-actions__button:is([aria-label="添加回应"],[aria-label="Add reaction"])');
  const pill = document.querySelector('.sand-new-messages-pill');
  const attach = !!document.querySelector('.sand-prompt-attach')?.getClientRects().length;
  report({ sidebarOrder, voiceBefore, voiceAfter: availableVoice(), captureRequests, dictationConsumed: dictation.defaultPrevented, attach,
    first, second, misleadingNew: pill != null && getComputedStyle(pill).display !== 'none', reaction: reaction ? getComputedStyle(reaction).display : 'absent' });
  }
}
try { await run(); } catch (error) { report({ error: String(error), page: document.body.innerText.slice(0, 900), editors: [...document.querySelectorAll('[contenteditable]')].map(el => el.outerHTML.slice(0, 360)) }); }
`;

test("the desktop renderer reconciles lost receipts and never turns old unsent drafts into history", { skip: process.env.VEGA_TEST_CHROME !== "1", timeout: 90000 }, async () => {
  const assets = "local/resources/grok", base = "/assistant/fixture/grok/", writes: any[] = [], attempts: any[] = [];
  let waitingForAuthorization = false, openedAuthorization = 0;
  const baseAt = Date.now() - 60000;
  const lastAt = () => baseAt + writes.length * 10;
  const groups = [{ id: "g1", thread: "group:g1", name: "协作群样例" }];
  const page = (await readFile(join(assets, "index.html"), "utf8")).replace("</body>", '<script type="module" src="./probe.js"></script></body>');
  const server = createServer(async (req, res) => {
    const path = req.url?.split("?")[0] || "";
    if (!path.startsWith(base) || path.includes("..")) { res.writeHead(404).end(); return; }
    const key = path.slice(base.length);
    if (key.startsWith("api/")) {
      const pieces: Buffer[] = []; for await (const chunk of req) pieces.push(chunk);
      const args = JSON.parse(Buffer.concat(pieces).toString() || "{}");
      let result: any = { ok: true };
      if (key === "api/threads") {
        result = { employees: [{ id: "e1", name: "私聊样例一" }, { id: "e2", name: "私聊样例二", lastAt: baseAt - 10000 }], groups: groups.map(group => ({ ...group, lastText: "群里原有消息", lastAt: lastAt(), lastViewedAt: lastAt() - 1, unread: 1 })) };
      } else if (key === "api/metadata") {
        if (waitingForAuthorization) { res.writeHead(409, { "Content-Type": "application/json" }).end('{"error":"客户端尚未授权"}'); return; }
        result = { id: "me", name: "本人样例" };
      } else if (key === "api/authorize") {
        openedAuthorization++;
        waitingForAuthorization = false; // Simulate external approval; the real client only opens the browser.
      } else if (key === "api/messages") {
        const saved = args.thread === "group:g1" ? [
          { seq: 1, role: "user", text: "群里原有消息", actorId: "peer", at: baseAt, author: { kind: "user", id: "peer", name: "群成员样例" } },
          ...writes.flatMap((row, i) => [
            { seq: 2 + 2 * i, role: "user", text: row.text, actorId: "me", clientMessageId: row.clientMessageId, at: baseAt + 10 * i + 1, author: { kind: "user", id: "me", name: "本人样例" } },
            { seq: 3 + 2 * i, role: "assistant", text: "群回复样例 " + (i + 1), at: baseAt + 10 * i + 2, author: { kind: "employee", id: "e1", name: "热心市民小林" } },
          ]),
        ] : [];
        if (args.receiptFor) {
          const match = saved.find(row => row.actorId === "me" && "clientMessageId" in row && row.clientMessageId === args.receiptFor);
          result = { receiptFor: args.receiptFor, receipt: match ? { seq: match.seq } : null };
        } else result = { messages: saved.filter(row => row.seq > (args.after || 0)), readSeq: saved.at(-1)?.seq ?? 0, lastSeq: saved.at(-1)?.seq ?? 0, running: false };
      } else if (key === "api/send") {
        attempts.push(args);
        if (args.text === "本机未确认的发送样例") { res.writeHead(502, { "Content-Type": "application/json" }).end("{}"); return; }
        writes.push(args);
        if (writes.length === 2) { res.writeHead(502, { "Content-Type": "application/json" }).end("{}"); return; }
      }
      res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(result)); return;
    }
    try {
      const type: Record<string, string> = { ".js": "text/javascript", ".css": "text/css", ".woff2": "font/woff2" };
      res.setHeader("Content-Type", key ? type[extname(key)] || "application/octet-stream" : "text/html; charset=utf-8");
      res.setHeader("Content-Security-Policy", "connect-src 'self'; img-src 'self' blob: data:");
      res.end(!key ? page : key === "probe.js" ? probe : await readFile(join(assets, key)));
    } catch { res.writeHead(404).end(); }
  });
  const dir = await mkdtemp(join(tmpdir(), "vega-grok-browser-"));
  try {
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    const { port } = server.address() as { port: number };
    const visit = async (query = "") => {
      const { stdout } = await promisify(execFile)(process.env.VEGA_CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe", [
        "--headless=new", "--no-first-run", "--no-default-browser-check", "--no-sandbox", "--disable-gpu", "--user-data-dir=" + dir,
        "--virtual-time-budget=20000", "--dump-dom", `http://127.0.0.1:${port}${base}${query}`,
      ], { encoding: "utf8", timeout: 40000, maxBuffer: 4 * 1024 * 1024, windowsHide: true });
      const match = stdout.match(/<pre id="probe">([\s\S]*?)<\/pre>/);
      assert(match, "the probe must finish");
      const result = JSON.parse(match[1].replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&amp;", "&"));
      assert(!result.error, JSON.stringify({ ...result, writeCount: writes.length }));
      return result;
    };
    const result = await visit();
    assert.equal(attempts.length, 3);
    assert.equal(writes.length, 2);
    assert.equal(new Set(writes.map(row => row.clientMessageId)).size, 2, "separate submits of identical text are distinct");
    assert.equal(writes[0].thread, "group:g1");
    assert.match(writes[0].clientMessageId, /^[a-zA-Z0-9_-]{16,80}$/);
    assert(result.sidebarOrder.indexOf("group:g1") > Math.max(result.sidebarOrder.indexOf("e1"), result.sidebarOrder.indexOf("e2")), `a newer unread group must stay below all bots: ${result.sidebarOrder}`);
    assert.equal(result.voiceBefore, 0);
    assert.equal(result.voiceAfter, 0);
    assert.equal(result.captureRequests, 0);
    assert.equal(result.dictationConsumed, false, "Ctrl+D no longer invokes dictation");
    assert.equal(result.attach, true, "do not remove the plus control");
    assert.equal(result.first, 1);
    assert.equal(result.second, 2);
    assert.equal(result.misleadingNew, false);
    assert(["none", "absent"].includes(result.reaction));
    const reopened = await visit("?reopened=1");
    assert.deepEqual(reopened, { recovered: "本机未确认的发送样例", inTimeline: false, copies: 2 });
    assert.equal(attempts.length, 3, "reopening never automatically sends anything");
    waitingForAuthorization = true;
    assert.deepEqual(await visit("?authorize=1"), { title: "牵牛星", entered: true });
    assert.equal(openedAuthorization, 1);
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
    await rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
});
