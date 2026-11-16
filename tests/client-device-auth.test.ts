import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { Auth } from "../server/core/auth";
import { Store } from "../server/core/store";
import { LocalAgents } from "../server/core/local-agent";
import { ClientSockets } from "../server/core/client-socket";
import type { Wire } from "../server/core/sse";

const secret = "device-authorization-fixture-token";
const random = () => randomBytes(32).toString("base64url");
async function fixture(t: any) {
  const store = await Store.open(":memory:"), auth = new Auth(store, secret);
  const login = await auth.setup({ setupToken: secret, username: "admin", password: "A long fixture password" });
  const hub = new LocalAgents(), sockets = new ClientSockets(store, auth, hub, () => false);
  t.after(async () => { sockets.closeAll(); hub.close(); await store.close(); });
  return { store, auth, login, hub, sockets };
}
function request(sockets: ClientSockets) {
  const verifier = random(), token = random(), clientId = "c".repeat(32);
  const started = sockets.deviceStart({ clientId, challenge: createHash("sha256").update(verifier).digest("base64url"), name: "My PC", platform: "windows" }, "127.0.0.1");
  return { ...started, verifier, deviceToken: token, clientId };
}
function peer(token: string): Wire {
  return { id: "native", request: { url: "http://localhost/api/local-agent/socket", headers: new Headers({ authorization: "Bearer " + token }) }, send() {}, close() {}, buffered: 0 };
}

test("device authorization requires explicit consent and client-held proof; retries cannot duplicate a grant", async (t) => {
  const f = await fixture(t), claim = request(f.sockets), info = f.sockets.deviceInfo(claim.requestId);
  assert.deepEqual(info, { name: "My PC", platform: "windows", clientId: "cccccc", expiresAt: claim.expiresAt, status: "pending" });
  assert(!JSON.stringify(info).includes(claim.verifier) && !JSON.stringify(info).includes(claim.deviceToken));
  assert.deepEqual(await f.sockets.deviceToken(claim), { status: "pending" });
  assert.equal((await f.store.objects("client-token")).length, 0, "a request or a website visit is not consent");
  await assert.rejects(f.sockets.deviceToken({ ...claim, verifier: random() }), /proof/);
  await assert.rejects(f.sockets.deviceToken({ ...claim, clientId: "d".repeat(32) }), /identity/);
  assert.deepEqual(await f.sockets.deviceDecision(f.login.principal, { requestId: claim.requestId, approved: true }), { status: "approved" });
  const result = { status: "authorized", userId: f.login.principal.user.id, clientId: claim.clientId };
  assert.deepEqual(await f.sockets.deviceToken(claim), result);
  assert.deepEqual(await f.sockets.deviceToken(claim), result, "a lost response can be retried with the same credential");
  assert.equal((await f.store.objects("client-token")).length, 1);
  assert(!JSON.stringify(await f.store.objects("client-token")).includes(claim.deviceToken));
  await assert.rejects(f.sockets.deviceToken({ ...claim, deviceToken: random() }), /already claimed/);
  await f.sockets.open(peer(claim.deviceToken));
  await assert.rejects(f.sockets.deviceToken(claim), /expired or not found/);
  await f.auth.logout(f.login.principal.hash);
  assert.equal((await f.sockets.authorize(peer(claim.deviceToken).request)).userId, result.userId, "an authorized device survives website logout");
});

test("denial, expiry, logout before redemption and read-only accounts do not authorize a device", async (t) => {
  const f = await fixture(t), denied = request(f.sockets);
  assert.deepEqual(await f.sockets.deviceDecision(f.login.principal, { requestId: denied.requestId, approved: false }), { status: "denied" });
  assert.deepEqual(await f.sockets.deviceToken(denied), { status: "denied" });
  await assert.rejects(f.sockets.deviceDecision(f.login.principal, { requestId: denied.requestId, approved: true }), /already decided/);
  const expired = request(f.sockets);
  (f.sockets as any).deviceRequests.get(expired.requestId).until = Date.now() - 1;
  assert.throws(() => f.sockets.deviceInfo(expired.requestId), /expired/);
  await assert.rejects(f.sockets.deviceToken(expired), /expired/);
  const viewer = request(f.sockets);
  const readonly = await f.auth.add({ username: "readonly", password: "A long readonly password", role: "viewer" });
  const viewerLogin = await f.auth.issue(readonly);
  await assert.rejects(f.sockets.deviceDecision(viewerLogin.principal, { requestId: viewer.requestId, approved: true }), /execution permission/);
  const pending = request(f.sockets);
  await f.sockets.deviceDecision(f.login.principal, { requestId: pending.requestId, approved: true });
  await f.auth.logout(f.login.principal.hash);
  await assert.rejects(f.sockets.deviceToken(pending), /login expired or revoked/);
  assert.equal((await f.store.objects("client-token")).length, 0);
});

test("competing credentials, revocation and request limits fail closed", async (t) => {
  const f = await fixture(t), claim = request(f.sockets);
  await f.sockets.deviceDecision(f.login.principal, { requestId: claim.requestId, approved: true });
  const other = { ...claim, deviceToken: random() };
  const results = await Promise.allSettled([f.sockets.deviceToken(claim), f.sockets.deviceToken(other)]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  const winner = results[0].status === "fulfilled" ? claim : other;
  await f.sockets.revoke(f.login.principal.user.id, winner.clientId);
  await assert.rejects(f.sockets.deviceToken(winner), /already claimed/);
  await assert.rejects(f.sockets.authorize(peer(winner.deviceToken).request));
  for (let i = 0; i < 31; i++) request(f.sockets);
  assert.throws(() => request(f.sockets), /Too many pending/);
});
