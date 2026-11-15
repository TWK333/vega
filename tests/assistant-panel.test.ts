import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash, webcrypto } from "node:crypto";
import vm from "node:vm";

const source = readFileSync("local/grok_ui/vega-bridge.js", "utf8");
const plain = (value: unknown) => JSON.parse(JSON.stringify(value));
function bridge(respond: (op: string, body: any) => any = () => ({})) {
  const calls: any[] = [], storage = new Map<string, string>(), events: any[] = [];
  class Reader {
    result: string | null = null;
    onload?: () => void;
    readAsDataURL(blob: Blob) { blob.arrayBuffer().then(bytes => { this.result = `data:${blob.type};base64,` + Buffer.from(bytes).toString("base64"); this.onload?.(); }); }
  }
  const context: any = {
    URL, Blob, Uint8Array, FileReader: Reader, crypto: webcrypto, atob, console,
    location: new URL("http://127.0.0.1:47673/assistant/fixture/"), navigator: { language: "en" },
    localStorage: { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key) },
    matchMedia: () => ({ matches: false }), setInterval() {}, setTimeout,
    addEventListener() {}, document: { visibilityState: "visible", addEventListener() {} },
    fetch: async (url: URL, init: any) => {
      const op = url.pathname.split("/").at(-1), body = JSON.parse(init.body);
      calls.push([op, body]);
      const value = op === "host" ? { paired: true, account: "fixture", version: "test" } : await respond(op!, body);
      return { ok: true, json: async () => value };
    },
  };
  context.window = context;
  vm.runInNewContext(source.replace(/\}\)\(\);\s*$/, "window.fixture = { coordinator, poll, entriesOf, boot, ports, resizeEdge };})();"), context);
  context.fixture.ports.add({ postMessage: (value: any) => events.push(plain(value)) });
  return { ...context.fixture, desktop: context.desktop, windowChanged: context.__vegaWindowChanged, calls, events, storage };
}

test("the embedded renderer assets remain byte-identical to the installed Grok build", () => {
  const manifest = JSON.parse(readFileSync("local/grok_ui/source-manifest.json", "utf8"));
  assert.equal(manifest.product, "Grok Bot");
  assert(manifest.files.length > 600);
  for (const entry of manifest.files) {
    if (entry.file === "index.html") continue; // Only the preload scripts and CSP are adapted.
    const bytes = readFileSync("local/grok_ui/" + entry.file);
    assert.equal(bytes.length, entry.bytes, entry.file);
    assert.equal(createHash("sha256").update(bytes).digest("hex"), entry.sha256, entry.file);
  }
  const index = readFileSync("local/grok_ui/index.html", "utf8");
  assert(index.indexOf("vega-bridge.js") < index.indexOf('type="module"'));
  assert.match(index, /connect-src 'self';/);
  assert.match(index, /id="root"/);
  assert.doesNotMatch(source, /innerHTML|insertAdjacentHTML/, "the adapter does not repaint or replace Grok's components");
});

test("WebView2 forwards all resize edges and disables them while maximized", () => {
  const b = bridge();
  for (const [x, y, edge] of [[0, 0, 13], [999, 0, 14], [0, 799, 16], [999, 799, 17], [0, 400, 10], [999, 400, 11], [500, 0, 12], [500, 799, 15], [500, 400, 0]])
    assert.equal(b.resizeEdge(x, y, 1000, 800), edge);
  b.windowChanged({ isFullscreen: false, isMaximized: true });
  assert.equal(b.resizeEdge(0, 0, 1000, 800), 0);
});

test("tail pagination keeps the server cursor even when the last rows are tools; read state is forwarded", async () => {
  const b = bridge(op => op === "messages" ? { messages: [{ seq: 9, role: "assistant", text: "tail" }, { seq: 10, role: "tool", text: "tool" }], hasMore: true } : {});
  const page = await b.coordinator("openAgentTail", { agentId: "employee:e1" });
  assert.equal(page.nextBeforeSeq, 9);
  await b.desktop.main.setViewingAgent({ agentId: "employee:e1" });
  await b.poll();
  assert(b.calls.some(([op, body]: any[]) => op === "read" && body.thread === "employee:e1"));
  assert(b.calls.some(([op, body]: any[]) => op === "messages" && body.after === 10));
  await b.coordinator("getAgentTranscriptTail", { agentId: "employee:e1", beforeSeq: 9 });
  assert.equal(b.calls.at(-1)[1].before, 9);
});

test("history rollback clears the original transcript replica instead of waiting on a stale cursor", async () => {
  const b = bridge((op, body) => op === "messages" ? body.after ? { messages: [], lastSeq: 0 } : { messages: [{ seq: 10, role: "assistant", text: "old" }] } : {});
  await b.boot;
  await b.coordinator("openAgentTail", { agentId: "employee:e1" });
  await b.desktop.main.setViewingAgent({ agentId: "employee:e1" });
  await b.poll(); await b.poll();
  assert.equal(b.events.filter((e: any) => e.family === "transcript" && e.payload.type === "cleared").length, 1);
});

test("sending a nonce is single-flight, and an uncertain failure is not automatically replayed", async () => {
  let sends = 0;
  const b = bridge(op => { if (op === "send") { sends++; throw Error("connection lost after dispatch"); } return {}; });
  const args = { agentId: "employee:e1", prompt: "once", clientNonce: "a".repeat(32) };
  await assert.rejects(b.coordinator("sendPrompt", args), /connection lost/);
  await assert.rejects(b.coordinator("sendPrompt", args), /connection lost/);
  assert.equal(sends, 1);
  assert.equal(b.calls.find(([op]: any[]) => op === "send")[1].clientMessageId, args.clientNonce);
});

test("new bots return the original creation contract, never a simulated success for unavailable features", async () => {
  const b = bridge(op => op === "create" ? { id: "e2" } : op === "threads" ? { employees: [{ thread: "employee:e2", name: "New Bot" }] } : {});
  const value = await b.coordinator("createAgent", { name: "New Bot" });
  assert.equal(value.agent.id, "employee:e2");
  assert.deepEqual(plain(value.transcript), []);
  await assert.rejects(b.coordinator("notImplemented"), /尚未接入/);
  await assert.rejects(b.desktop.main.openExternal({ url: "file:///private" }), /Only HTTP/);
});

test("the original attachment staging contract forwards file/image bytes and renders artifact references", async () => {
  const b = bridge(op => op === "file" ? { data: Buffer.from("artifact").toString("base64"), mime: "text/plain" } : {});
  const file = await b.desktop.local.stageAttachmentFile("C:\\tmp\\notes.txt", new Blob(["hello"], { type: "text/plain" }));
  assert.equal(file.ok, true);
  const paths = await b.desktop.main.commitStagedAttachments({ paths: [file.path] });
  await b.coordinator("sendPrompt", { agentId: "employee:e1", prompt: "", attachmentPaths: paths, clientNonce: "b".repeat(32) });
  assert.deepEqual(b.calls.find(([op]: any[]) => op === "send")[1].files, [{ name: "notes.txt", mime: "text/plain", data: "aGVsbG8=" }]);
  const id = "blob-" + "a".repeat(32);
  const entries = b.entriesOf([{ seq: 1, role: "assistant", text: "continue", stepOutput: { text: "full artifact", files: [{ blobId: id, name: "app.zip", size: 7 }] } }], "employee:e1");
  assert.equal(entries[0].kind, "user-attachment");
  assert.equal(entries[0].file_name, "app.zip");
  assert.equal(entries[1].content, "continue\n\nfull artifact");
  const bytes = await b.desktop.main.readAttachmentBytes({ path: entries[0].file_path });
  assert.equal(Buffer.from(bytes.bytes).toString(), "artifact");
  await assert.rejects(b.desktop.main.readAttachmentBytes({ path: "C:/private.txt" }), /Unknown attachment/);
  const oversized = await b.desktop.local.stageAttachmentFile("huge", new Blob([new Uint8Array((25 << 20) + 1)]));
  assert.equal(oversized.ok, false);
  await b.desktop.main.discardStagedAttachment({ path: file.path });
  await assert.rejects(b.desktop.main.commitStagedAttachments({ paths: [file.path] }), /已失效/);
});
