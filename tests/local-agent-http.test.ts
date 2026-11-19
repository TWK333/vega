import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { createServer, request as httpRequest } from "node:http";
import { pipeline } from "node:stream";
import { createServer as tcpServer } from "node:net";
import { mkdtemp, mkdir, writeFile, readFile, rm, copyFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createHash, randomBytes } from "node:crypto";
import { strFromU8, unzipSync } from "fflate";
import { sleep } from "../server/core/util";

/**
 * 读一条 text/event-stream：按空行切帧，丢掉 `:` 开头的注释行（心跳），把每个 `data: ` 后的 JSON 交给 onMessage。
 * 跨 chunk 拆开的帧留在 pending 里等下一块；onMessage 返回 true 表示读够了，立刻取消读流。
 * 浏览器端同一份逻辑在 web/src/sse-socket.js，测试不共享模块，各自内联。
 */
async function readEvents(
  response: Response,
  onMessage: (value: any) => boolean | void,
  signal?: AbortSignal,
) {
  const reader = response.body!.getReader(),
    decoder = new TextDecoder();
  const cancel = () => {
    reader.cancel().catch(() => {});
  };
  signal?.addEventListener("abort", cancel, { once: true });
  let pending = "";
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) return;
      pending = (pending + decoder.decode(value, { stream: true })).replace(
        /\r\n/g,
        "\n",
      );
      for (let cut; (cut = pending.indexOf("\n\n")) >= 0; ) {
        const block = pending.slice(0, cut);
        pending = pending.slice(cut + 2);
        const data = block
          .split("\n")
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).replace(/^ /, ""))
          .join("\n");
        if (data && onMessage(JSON.parse(data)) === true) return;
      }
    }
  } catch (error) {
    // 收尾时自己取消读流不算失败；真正的断流由调用方自己判断。
    if (!signal?.aborted) throw error;
  } finally {
    signal?.removeEventListener("abort", cancel);
    cancel();
  }
}

test("native client authorizes through a site directory and runs directly without replaying lost operations", {
  skip: process.env.VEGA_TEST_LOCAL_AGENT !== "1", timeout: 90000,
}, async (t) => {
  const binary = process.env.VEGA_TEST_CLIENT_BINARY || resolve("local", process.platform === "win32" ? "vega-local.exe" : "vega-local");
  assert(existsSync(binary), "Build the updated native client first");
  const helper = process.env.VEGA_TEST_CLIENT_HELPER === "1";
  if (!helper) {
    const reserved = tcpServer();
    try { await new Promise<void>((yes, no) => { reserved.once("error", no); reserved.listen(47673, "127.0.0.1", yes); }); }
    catch { t.skip("Local client port is in use; do not interfere with a user's client"); return; }
    await new Promise<void>((yes) => reserved.close(() => yes()));
  }
  const dir = await mkdtemp(join(tmpdir(), "vega-native-e2e-"));
  const clientDir = join(dir, "client"), serverDir = join(dir, "server"), configDir = join(dir, "config");
  await mkdir(clientDir); await mkdir(serverDir); await mkdir(join(configDir, "vega-local"), { recursive: true });
  const reserve = createServer();
  await new Promise<void>((yes) => reserve.listen(0, "127.0.0.1", yes));
  const port = (reserve.address() as any).port;
  await new Promise<void>((yes) => reserve.close(() => yes()));
  const prefix = "/vega";
  const socketStatuses: number[] = [];
  // Match a reverse proxy that redirects old root URLs and strips the mount path internally.
  const proxy = createServer((req, res) => {
    const path = req.url || "/";
    if (!path.startsWith(prefix + "/")) {
      res.writeHead(302, { location: prefix + path }).end();
      return;
    }
    const upstream = httpRequest({ host: "127.0.0.1", port, path: path.slice(prefix.length), method: req.method, headers: req.headers }, (response) => {
      const status = response.statusCode || 502;
      if (req.method === "GET" && path.split("?")[0] === prefix + "/api/local-agent/socket") socketStatuses.push(status);
      res.writeHead(status, response.headers);
      // If the backend aborts an SSE response, the native client must see the disconnect too.
      pipeline(response, res, () => {});
    });
    upstream.on("error", () => res.headersSent ? res.destroy() : res.writeHead(502).end());
    res.on("close", () => upstream.destroy());
    req.pipe(upstream);
  });
  await new Promise<void>((yes) => proxy.listen(0, "127.0.0.1", yes));
  const proxyPort = (proxy.address() as any).port;
  const publicOrigin = "http://127.0.0.1:" + proxyPort, base = publicOrigin + prefix;
  const setupToken = randomBytes(32).toString("base64url");
  await writeFile(join(configDir, "vega-local", "trusted-sites.json"), JSON.stringify({ trustedOrigins: [base] }));
  // >1 MiB once base64-encoded, so the client must post it to /api/local-agent/result instead of the socket.
  await writeFile(join(clientDir, "large.txt"), "x".repeat(900000));
  let modelCalls = 0;
  const mock = createServer(async (req, res) => {
    const chunks: Buffer[] = []; for await (const chunk of req) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString());
    modelCalls++;
    // Actual worker inputs wrap the task instructions; runtime snapshots are separate user rows.
    const workerPlacement = /^原始任务（不是新授权）：check placement fixture:/m;
    const isPlacementAsk = (text: string) => /^(?:列出\s*d\s*盘目录|在服务器上列出d盘目录|检查本机目录)$/i.test(text);
    const latest = [...body.messages].reverse().find((m: any) => m.role === "user" && typeof m.content === "string" &&
      (/^(?:write (?:server )?fixture|large fixture|loss fixture|continue after repair)/.test(m.content) || isPlacementAsk(m.content) || workerPlacement.test(m.content)))?.content;
    const hasTool = body.messages.at(-1)?.role === "tool", loss = String(latest).includes("loss fixture");
    const placementCheck = workerPlacement.test(latest || "");
    const command = process.platform === "win32"
      ? (loss ? "Add-Content -LiteralPath loss.txt -Value once; Start-Sleep -Seconds 10" : placementCheck ? "Set-Content -LiteralPath routing-fixture.txt -Value placement-success" : "Set-Content -LiteralPath from-client.txt -Value local-success")
      : (loss ? "printf 'once\\n' >> loss.txt; sleep 10" : placementCheck ? "printf 'placement-success\\n' > routing-fixture.txt" : "printf 'local-success\\n' > from-client.txt");
    const tool = isPlacementAsk(latest || "") ? { name: "employee_task_create", arguments: JSON.stringify({ instructions: "check placement fixture: " + latest }) }
      : String(latest).includes("large fixture") ? { name: "read", arguments: JSON.stringify({ path: "large.txt" }) } : { name: "bash", arguments: JSON.stringify({ command, timeout: 20 }) };
    const delta = hasTool || String(latest).includes("continue after repair")
      ? { content: "verified completion" }
      : { tool_calls: [{ index: 0, id: "fixture-" + modelCalls, function: tool }] };
    res.setHeader("Content-Type", "text/event-stream");
    res.end("data: " + JSON.stringify({ choices: [{ index: 0, delta, finish_reason: "tool_calls" in delta ? "tool_calls" : "stop" }] }) + "\n\ndata: [DONE]\n\n");
  });
  await new Promise<void>((yes) => mock.listen(0, "127.0.0.1", yes));
  const children: ChildProcess[] = [], events: any[] = [];
  let logs = "", cookie = "", csrf = "", webpage: AbortController | undefined, webpageRead: Promise<void> | undefined;
  const backendEnv = { ...process.env, VEGA_DB: join(dir, "app.db"), VEGA_TOKEN: setupToken, VEGA_PUBLIC_URL: base, VEGA_BROWSER_MODE: "", NITRO_HOST: "127.0.0.1", NITRO_PORT: String(port), VEGA_SKILL_CACHE: join(dir, "skills"), VEGA_CLIENTS_DIR: clientDir };
  const serverEntry = resolve(process.env.VEGA_TEST_SERVER_ENTRY || ".output/server/index.mjs");
  const startBackend = () => {
    const child = spawn(process.execPath, [serverEntry], { windowsHide: true, stdio: "pipe", env: backendEnv });
    child.stdout!.on("data", (b) => logs += b); child.stderr!.on("data", (b) => logs += b);
    children.push(child); return child;
  };
  // 客户端只从「站点下载的安装包」启动：exe 同目录要有 instance.json（local/instance.go），
  // 否则它弹窗就退出，这里只会等到配对超时。拷一份到临时目录，别把站点信息写进仓库。
  const clientExe = join(clientDir, process.platform === "win32" ? "vega-local.exe" : "vega-local");
  await copyFile(binary, clientExe);
  await writeFile(join(clientDir, "vega-local-package-fixture"), "test binary");
  await writeFile(join(clientDir, "instance.json"), JSON.stringify({ origin: base }));
  const startClient = (chatOnly = false) => {
    const child = spawn(clientExe, helper ? ["-test.run=^TestDeviceClientFixture$"] : [], { cwd: clientDir, windowsHide: true, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, APPDATA: configDir, XDG_CONFIG_HOME: configDir, VEGA_DEVICE_E2E_HELPER: process.env.VEGA_TEST_CLIENT_HELPER, VEGA_DEVICE_E2E_CHAT_ONLY: chatOnly ? "1" : "0" } });
    child.stdout!.on("data", (b) => logs += b); child.stderr!.on("data", (b) => logs += b);
    children.push(child); return child;
  };
  const stop = async (child: ChildProcess) => {
    if (child.exitCode !== null || child.signalCode !== null) return;
    child.kill(); await new Promise<void>((yes) => child.once("exit", () => yes()));
  };
  let backend = startBackend(), client = startClient();
  const api = async (path: string, method = "GET", data?: any) => {
    const r = await fetch(base + "/api" + path, { method, headers: { cookie, "x-csrf-token": csrf, "content-type": "application/json", origin: publicOrigin }, body: data === undefined ? undefined : JSON.stringify(data) });
    const value = await r.json(); if (!r.ok) throw Error(JSON.stringify(value)); return value;
  };
  const until = async (condition: () => boolean | Promise<boolean>) => {
    for (let i = 0; i < 600; i++) { if (await condition()) return; await sleep(20); }
    throw Error("Native client fixture timed out: " + logs.replace(/client_authorization=[\w-]+/g, "client_authorization=[fixture]") + "\nSocket GET statuses: " + socketStatuses.join(", "));
  };
  const run = async (id: string, text: string) => {
    const before = (await api("/sessions/" + id)).messages.length;
    await api("/sessions/" + id + "/messages", "POST", { text });
    await until(async () => { const value = await api("/sessions/" + id); return !value.running && value.messages.length > before && value.messages.at(-1)?.role === "assistant"; });
    return api("/sessions/" + id);
  };
  const usedRequests = new Set<string>();
  const authorizeClient = async () => {
    await until(() => [...logs.matchAll(/client_authorization=([A-Za-z0-9_-]{43})/g)].some((match) => !usedRequests.has(match[1])));
    const requestId = [...logs.matchAll(/client_authorization=([A-Za-z0-9_-]{43})/g)].map((match) => match[1]).find((id) => !usedRequests.has(id))!;
    usedRequests.add(requestId);
    const info = await api("/local-agent/device/request?requestId=" + requestId);
    assert.equal(info.status, "pending");
    const anonymous = await fetch(base + "/api/local-agent/device/request?requestId=" + requestId);
    assert.equal(anonymous.status, 401, "device details require a website login");
    const withoutCsrf = await fetch(base + "/api/local-agent/device/decision", { method: "POST", headers: { cookie, "content-type": "application/json" }, body: JSON.stringify({ requestId, approved: true }) });
    assert.equal(withoutCsrf.status, 403, "website consent requires CSRF protection");
    const forgedBrowser = await fetch(base + "/api/local-agent/device/token", { method: "POST", headers: { origin: publicOrigin, "content-type": "application/json" }, body: "{}" });
    assert.equal(forgedBrowser.status, 403, "browser origins cannot impersonate the native token exchange");
    assert.equal((await api("/bootstrap")).clients.length, 0, "the client is offline until a user approves");
    await api("/local-agent/device/decision", "POST", { requestId, approved: true });
    await until(async () => (await api("/bootstrap")).clients.length === 1);
  };
  try {
    const oldAddress = await fetch(publicOrigin + "/api/auth/me", { redirect: "manual" });
    assert.equal(oldAddress.status, 302);
    assert.equal(oldAddress.headers.get("location"), prefix + "/api/auth/me");
    await oldAddress.body?.cancel();
    await until(async () => { try { return (await fetch(base + "/api/auth/me")).ok; } catch { return false; } });
    const setup = await fetch(base + "/api/auth/setup", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ setupToken, username: "native-fixture", password: "a-long-native-fixture-password" }) });
    assert.equal(setup.status, 200);
    cookie = setup.headers.get("set-cookie")!.split(";")[0]; const login = await setup.json(); csrf = login.csrfToken;
    const cookieAge = Number(/Max-Age=(\d+)/i.exec(setup.headers.get("set-cookie")!)?.[1]);
    assert(cookieAge >= 604790 && cookieAge <= 604800);
    const download = await fetch(base + "/api/clients/vega-local-package-fixture.zip", { headers: { cookie } });
    assert.equal(download.status, 200);
    const archive = unzipSync(new Uint8Array(await download.arrayBuffer()));
    assert.equal(JSON.parse(strFromU8(archive["instance.json"])).origin, base);
    const denied = await fetch(base + "/api/local-agent/ticket", { method: "POST", headers: { cookie, "content-type": "application/json" }, body: JSON.stringify({ instance: "a".repeat(32) }) });
    assert.equal(denied.status, 403);
    const ticket = await api("/events", "POST", {});
    // 网页那条实时通道也是 SSE：Cookie + Origin 走请求头（和浏览器一致），读流由测试自己管。
    webpage = new AbortController();
    const eventsResponse = await fetch(base + "/api/events?ticket=" + ticket.ticket, { headers: { cookie, origin: publicOrigin, accept: "text/event-stream" }, signal: webpage.signal });
    assert.equal(eventsResponse.status, 200);
    webpageRead = readEvents(eventsResponse, (value) => { events.push(value); }, webpage.signal);
    await until(() => events.some((event) => event.type === "ready"));
    const serverSession = await api("/sessions", "POST", { cwd: serverDir });
    await authorizeClient();
    const device = (await api("/bootstrap")).clients[0];
    assert.equal((await api("/sessions/" + serverSession.id)).session.localAgent, false);
    webpage.abort(); await webpageRead;
    assert.equal(webpage.signal.aborted, true, "closing the webpage does not disconnect the client");
    await api("/config", "PUT", { model: "test/m", scenes: { lightweight: ["test/m"], coding: ["test/m"] }, provider: { test: { api: "openai-completions", baseURL: "http://127.0.0.1:" + (mock.address() as any).port, models: { m: { limit: { context: 128000, output: 1000 } } } } } });
    if (helper) await t.test("desktop and web private chats dispatch explicit local work to the authorized device", async () => {
      const employee = await api("/employees", "POST", { name: "Native placement fixture", cwd: serverDir });
      const employeePath = "/employees/" + employee.id;
      const thread = "employee:" + employee.id;
      const desktopChat = async (op: "send" | "messages", body: object) => {
        let chatPort = "";
        await until(() => !!(chatPort = [...logs.matchAll(/fixture_chat_port=(\d+)/g)].at(-1)?.[1] || ""));
        return fetch(`http://127.0.0.1:${chatPort}/assistant/fixture-chat/api/${op}`, {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ ...body, thread, clientId: "b".repeat(32) }),
        });
      };
      const desktopSend = (text: string, clientMessageId: string) => desktopChat("send", { text, clientMessageId });
      const settled = async () => {
        const state = await api(employeePath);
        return !state.chatRunning && !state.busy.length;
      };
      const local = await desktopSend("列出d盘目录", "local-placement-test-1");
      assert.equal(local.status, 200, await local.text());
      const receipt = await desktopChat("messages", { receiptFor: "local-placement-test-1" });
      assert.equal(receipt.status, 200);
      assert.deepEqual(await receipt.json(), { receiptFor: "local-placement-test-1", receipt: { seq: 1 } });
      const absent = await desktopChat("messages", { receiptFor: "cloud-placement-test-1" });
      assert.equal(absent.status, 200);
      assert.deepEqual(await absent.json(), { receiptFor: "cloud-placement-test-1", receipt: null });
      let task: any;
      await until(async () => !!(task = (await api(employeePath)).tasks.find((row: any) => row.text === "check placement fixture: 列出d盘目录")));
      assert.equal(task.execution.localAgent, true);
      assert.equal(task.execution.clientId, device.id, "use the credential's device, not a device supplied by the caller");
      assert.equal(task.execution.localPlatform, process.platform === "win32" ? "windows" : process.platform);
      await until(async () => existsSync(join(clientDir, "routing-fixture.txt")) && await settled());
      assert.match(await readFile(join(clientDir, "routing-fixture.txt"), "utf8"), /placement-success/);
      assert(!existsSync(join(serverDir, "routing-fixture.txt")), "the mock operation must not run in the backend workspace");
      await rm(join(clientDir, "routing-fixture.txt"));
      const webMessage = { text: process.platform === "win32" ? "列出 D 盘目录" : "检查本机目录", clientMessageId: "web-placement-test-1", clientId: "b".repeat(32) };
      await api(employeePath + "/messages", "POST", webMessage);
      await until(async () => existsSync(join(clientDir, "routing-fixture.txt")) && await settled());
      const webTask = (await api(employeePath)).tasks.find((row: any) => row.text === "check placement fixture: " + webMessage.text);
      assert.equal(webTask?.execution.clientId, device.id, "the browser selects the only eligible device for its account, not a body-supplied ID");
      assert.equal(webTask.execution.localAgent, true);
      assert(!existsSync(join(serverDir, "routing-fixture.txt")));
      const cloud = await desktopSend("在服务器上列出d盘目录", "cloud-placement-test-1");
      assert.equal(cloud.status, 200, await cloud.text());
      await until(async () => existsSync(join(serverDir, "routing-fixture.txt")) && await settled());
      assert.match(await readFile(join(serverDir, "routing-fixture.txt"), "utf8"), /placement-success/);
      const lastLog = logs.length;
      await stop(client);
      const disconnected = startClient(true);
      try {
        await until(() => logs.slice(lastLog).includes("fixture_chat_port="));
        const before = modelCalls;
        await api(employeePath + "/messages", "POST", webMessage); // A retry acknowledges the already accepted message even while offline.
        await assert.rejects(api(employeePath + "/messages", "POST", { ...webMessage, clientMessageId: "web-offline-placement-test-1" }), /"statusCode":409.*不会在云端执行/);
        const offline = await desktopSend("列出d盘目录", "offline-placement-test-1");
        assert.equal(offline.status, 409);
        assert.match(await offline.text(), /未连接执行通道/);
        assert.equal(modelCalls, before, "an offline request never reaches a model or starts on the backend");
      } finally {
        await stop(disconnected);
        client = startClient();
        await until(async () => (await api("/bootstrap")).clients.some((item: any) => item.id === device.id && !item.reconnecting));
      }
    });
    await run(serverSession.id, "write server fixture");
    assert.match(await readFile(join(serverDir, "from-client.txt"), "utf8"), /local-success/);
    assert.equal(existsSync(join(clientDir, "from-client.txt")), false);
    const session = await api("/sessions", "POST", { localAgent: true, clientId: device.id });
    await run(session.id, "write fixture with the webpage closed");
    assert.match(await readFile(join(clientDir, "from-client.txt"), "utf8"), /local-success/);
    const large = await run(session.id, "large fixture with the webpage closed");
    assert(large.messages.some((item: any) => item.name === "read" && !item.error), "direct socket supports file results larger than the website RPC limit: " + JSON.stringify(large.messages.map((item: any) => ({ role: item.role, name: item.name, error: item.error, text: String(item.text || "").slice(0, 200) }))));
    assert.equal(events.some((event) => event.type === "local_agent_request"), false);
    await stop(client); client = startClient();
    await until(async () => (await api("/bootstrap")).clients.some((item: any) => item.id === device.id));
    await run(session.id, "write fixture after native restart without pairing again");
    await stop(backend); backend = startBackend();
    await until(async () => { try { return (await api("/bootstrap")).clients.some((item: any) => item.id === device.id); } catch { return false; } });
    await run(session.id, "write fixture after backend restart without a webpage");
    await api("/sessions/" + session.id + "/messages", "POST", { text: "loss fixture" });
    await until(() => existsSync(join(clientDir, "loss.txt")));
    await api("/local-agent/revoke", "POST", { clientId: device.id });
    await until(async () => !(await api("/sessions/" + session.id)).running);
    assert.match((await api("/sessions/" + session.id)).messages.at(-1).text, /本轮已暂停/);
    assert.equal((await readFile(join(clientDir, "loss.txt"), "utf8")).trim(), "once");
    const callsAtPause = modelCalls;
    await sleep(100);
    assert.equal(modelCalls, callsAtPause);
    await until(async () => (await api("/bootstrap")).clients.length === 0);
    const siteKey = createHash("sha256").update(base).digest("hex").slice(0, 24);
    const clientConfig = join(configDir, "vega-local", `http-127.0.0.1_${proxyPort}~${siteKey}`, "trusted-sites.json");
    await until(async () => { try { return !(JSON.parse(await readFile(clientConfig, "utf8")).servers || []).length; } catch { return false; } });
    await stop(client); client = startClient();
    await authorizeClient();
    assert((await api("/bootstrap")).clients.some((item: any) => item.id === device.id));
    await run(session.id, "continue after repair");
    assert.equal((await readFile(join(clientDir, "loss.txt"), "utf8")).trim(), "once", "a renewed device credential must never replay the old mutation");
  } finally {
    webpage?.abort(); await webpageRead?.catch(() => {});
    for (const child of children) await stop(child);
    proxy.closeAllConnections();
    await new Promise<void>((yes) => proxy.close(() => yes()));
    await new Promise<void>((yes) => mock.close(() => yes()));
    await rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
});
