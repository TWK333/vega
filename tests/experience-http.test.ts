import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { Auth } from "../server/core/auth";
import { Store } from "../server/core/store";
import { clientExperienceKind } from "../server/core/experience-access";
import { sleep } from "../server/core/util";

const entry = (id: string, successes: string[] = []) => ({ id, scope: "https://fixture.test", task: id,
  conditions: ["start"], steps: ["click"], checks: ["done"], pitfalls: [], alternatives: [], successes, failures: [], disabled: false, updatedAt: 1 });

test("deployed personal experience API is accessible to every role without leaking other accounts", { timeout: 60000, skip: process.env.VEGA_TEST_DEPLOYED !== "1" }, async () => {
  const dir = await mkdtemp(join(tmpdir(), "vega-experience-http-"));
  const db = join(dir, "experience.db"), token = "experience-fixture-initial-token", password = "experience-fixture-password";
  let child: ReturnType<typeof spawn> | undefined;
  try {
    const store = await Store.open(db), auth = new Auth(store, token);
    const admin = (await auth.setup({ setupToken: token, username: "admin", password })).principal.user;
    const operator = await auth.add({ username: "operator", password, role: "operator" });
    const viewer = await auth.add({ username: "viewer", password, role: "viewer" });
    const clientId = "a".repeat(32);
    const opSession = await store.newSession({ ownerId: operator.id, cwd: dir, clientId });
    const adminSession = await store.newSession({ ownerId: admin.id, cwd: dir, clientId });
    await store.save("experience:user_" + admin.id, "admin", entry("admin"));
    await store.save("experience:user_" + operator.id, "operator", entry("operator"));
    await store.save("experience:desktop:" + operator.id, "desktop", entry("desktop"));
    await store.save(clientExperienceKind(operator.id, clientId), "client", entry("client"));
    await store.save("experience:user_" + viewer.id, "viewer", entry("viewer"));
    await store.save("experience:client:" + clientId, "old-op", entry("old-op", [opSession.id]));
    await store.save("experience:client:" + clientId, "old-admin", entry("old-admin", [adminSession.id]));
    await store.close();

    const reserve = createServer();
    await new Promise<void>((yes) => reserve.listen(0, "127.0.0.1", yes));
    const port = (reserve.address() as any).port;
    await new Promise<void>((yes) => reserve.close(() => yes()));
    const base = `http://127.0.0.1:${port}`;
    child = spawn(process.execPath, [resolve(".output/server/index.mjs")], { windowsHide: true, env: {
      ...process.env, DB_TYPE: "sqlite", VEGA_DB: db, VEGA_TOKEN: token, VEGA_PUBLIC_URL: base,
      VEGA_CHROMIUM_EXTERNAL: "1", NITRO_HOST: "127.0.0.1", NITRO_PORT: String(port),
    }, stdio: ["ignore", "pipe", "pipe"] });
    let logs = "";
    child.stdout!.on("data", (data) => { logs += String(data); });
    child.stderr!.on("data", (data) => { logs += String(data); });
    let ready = false;
    for (let n = 0; n < 120; n++) {
      if (child.exitCode !== null) throw Error(logs);
      try {
        const response = await fetch(base + "/api/health", { headers: { Authorization: "Bearer " + token }, signal: AbortSignal.timeout(1000) });
        if (response.ok) { ready = true; break; }
      } catch { /* server is still starting */ }
      await sleep(100);
    }
    assert(ready, logs);
    assert.equal((await fetch(base + "/api/experiences")).status, 401);
    for (const [username, expected] of [["admin", ["admin", "old-admin"]], ["operator", ["operator", "desktop", "client", "old-op"]], ["viewer", ["viewer"]]] as const) {
      const login = await fetch(base + "/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password }) });
      assert.equal(login.status, 200, await login.clone().text());
      const cookie = login.headers.get("set-cookie")!.split(";")[0], value = await login.json() as any;
      const response = await fetch(base + "/api/experiences", { headers: { Cookie: cookie } });
      assert.equal(response.status, 200, username);
      const graph = await response.json() as any;
      assert.deepEqual(new Set(graph.routes.map((route: any) => route.id)), new Set(expected), username);
      if (username !== "admin") {
        const denied = await fetch(base + "/api/experiences", { method: "POST", headers: { Cookie: cookie, "X-CSRF-Token": value.csrfToken } });
        assert.equal(denied.status, 403, "read permission must not grant writes");
      }
    }
  } finally {
    if (child && child.exitCode === null) { child.kill(); await Promise.race([once(child, "exit"), sleep(3000)]); }
    await rm(dir, { recursive: true, force: true });
  }
});
