import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { sleep } from "../server/core/util";

type Login = { cookie: string; csrf: string };

test("deployed personal settings are scoped to the account, and triggers require execution permission", { skip: process.env.VEGA_TEST_DEPLOYED !== "1", timeout: 60000 }, async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "vega-trigger-auth-"));
  const reserve = createServer();
  await new Promise<void>((done) => reserve.listen(0, "127.0.0.1", done));
  const port = (reserve.address() as any).port;
  await new Promise<void>((done) => reserve.close(() => done()));
  const base = `http://127.0.0.1:${port}`, token = randomBytes(32).toString("base64url");
  const child = spawn(process.execPath, [resolve(".output/server/index.mjs")], {
    env: { ...process.env, NITRO_HOST: "127.0.0.1", NITRO_PORT: String(port), VEGA_TOKEN: token, VEGA_DB: join(dir, "vega.db"), VEGA_PUBLIC_URL: base, VEGA_CHROMIUM_EXTERNAL: "1" },
    stdio: ["ignore", "pipe", "pipe"], windowsHide: true,
  });
  let logs = "";
  child.stdout!.on("data", (chunk) => { logs += chunk; });
  child.stderr!.on("data", (chunk) => { logs += chunk; });
  const request = async (path: string, method = "GET", data?: unknown, login?: Login) => {
    const response = await fetch(base + "/api" + path, {
      method, signal: AbortSignal.timeout(10000),
      headers: { Origin: base, ...(data !== undefined ? { "Content-Type": "application/json" } : {}), ...(login ? { Cookie: login.cookie, "X-CSRF-Token": login.csrf } : {}) },
      body: data === undefined ? undefined : JSON.stringify(data),
    });
    return { response, value: await response.json() as any };
  };
  const loginFrom = (result: Awaited<ReturnType<typeof request>>): Login => ({ cookie: result.response.headers.get("set-cookie")!.split(";")[0], csrf: result.value.csrfToken });
  try {
    let ready = false;
    for (let i = 0; i < 120 && !ready; i++) {
      if (child.exitCode !== null) throw Error(logs);
      try { const r = await fetch(base + "/api/health", { headers: { Authorization: "Bearer " + token }, signal: AbortSignal.timeout(1000) }); await r.arrayBuffer(); ready = r.ok; } catch {}
      if (!ready) await sleep(50);
    }
    assert(ready, logs);
    const setup = await request("/auth/setup", "POST", { setupToken: token, username: "admin", password: "fixture-admin-password" });
    assert.equal(setup.response.status, 200, JSON.stringify(setup.value));
    const admin = loginFrom(setup);
    for (const [username, role] of [["operator-a", "operator"], ["operator-b", "operator"], ["viewer", "viewer"]]) {
      const added = await request("/users", "POST", { username, role, password: "fixture-user-password" }, admin);
      assert.equal(added.response.status, 200, JSON.stringify(added.value));
    }
    const sign = async (username: string) => {
      const result = await request("/auth/login", "POST", { username, password: "fixture-user-password" });
      assert.equal(result.response.status, 200, JSON.stringify(result.value));
      return loginFrom(result);
    };
    const a = await sign("operator-a"), b = await sign("operator-b"), viewer = await sign("viewer");
    await t.test("every role can save only its own work principles", async () => {
      const path = "/me/work-principles";
      assert.equal((await request(path)).response.status, 401);
      assert.equal((await request(path, "PUT", { workPrinciples: "not authorized" }, { ...a, csrf: "" })).response.status, 403);
      for (const [login, text] of [[admin, "管理员的原则"], [a, "操作者的原则"], [viewer, "只读账号的原则"]] as const) {
        const saved = await request(path, "PUT", { workPrinciples: `  ${text}  ` }, login);
        assert.equal(saved.response.status, 200, JSON.stringify(saved.value));
        assert.equal(saved.value.workPrinciples, text);
        const loaded = await request(path, "GET", undefined, login);
        assert.equal(loaded.value.workPrinciples, text);
        assert.match(loaded.response.headers.get("cache-control") || "", /no-store/i);
      }
      assert.equal((await request(path, "GET", undefined, b)).value.workPrinciples, "");
      const other = await request(path, "PUT", { workPrinciples: "另一账号的原则", userId: setup.value.user.id }, b);
      assert.equal(other.response.status, 200, JSON.stringify(other.value));
      assert.equal((await request(path, "GET", undefined, b)).value.workPrinciples, "另一账号的原则");
      assert.equal((await request(path, "GET", undefined, admin)).value.workPrinciples, "管理员的原则");
      assert.equal((await request(path + "/other", "PUT", { workPrinciples: "not authorized" }, b)).response.status, 403);
      assert.equal((await request(path, "GET", undefined, a)).value.workPrinciples, "操作者的原则");
      assert.equal((await request(path, "PUT", { workPrinciples: 1 }, a)).response.status, 400);
      assert.equal((await request(path, "GET", undefined, a)).value.workPrinciples, "操作者的原则");
    });
    assert.equal((await request("/me/triggers", "GET", undefined, a)).response.status, 200);
    assert.equal((await request("/me/triggers", "GET", undefined, viewer)).response.status, 403);
    const input = { name: "hook", enabled: true, condition: "employee_message", action: "http", url: "https://example.com/hook?key=secret", headers: '{"Authorization":"Bearer secret-header"}', body: '{"text":"{{message}}\\n{{taskLinks}}"}' };
    const rejected = await request("/me/triggers", "POST", input, { ...a, csrf: "" });
    assert.equal(rejected.response.status, 403);
    const created = await request("/me/triggers", "POST", input, a);
    assert.equal(created.response.status, 200, JSON.stringify(created.value));
    const id = created.value.trigger.id;
    assert.equal(created.value.trigger.url, input.url);
    assert(!JSON.stringify(created.value).includes("secret-header"));
    const listed = await request("/me/triggers", "GET", undefined, a);
    assert.equal(listed.value.triggers[0].url, input.url);
    assert(!JSON.stringify(listed.value).includes("secret-header"));
    assert.match(listed.response.headers.get("cache-control") || "", /no-store/i);
    assert.equal((await request("/me/triggers/" + id, "PATCH", { enabled: false }, b)).response.status, 404);
    assert.deepEqual((await request("/me/triggers", "GET", undefined, b)).value.triggers, []);
    assert.equal((await request("/me/triggers/" + id, "PATCH", { enabled: false }, a)).response.status, 200);
    assert.equal((await request("/me/triggers/" + id, "DELETE", undefined, a)).response.status, 200);
  } finally {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill("SIGTERM");
      await new Promise<void>((done) => { const timer = setTimeout(() => { child.kill("SIGKILL"); done(); }, 5000); child.once("exit", () => { clearTimeout(timer); done(); }); });
    }
    await rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
});
