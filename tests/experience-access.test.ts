import assert from "node:assert/strict";
import test from "node:test";
import { clientExperienceKind, restoreClientExperiences, userExperienceGraph } from "../server/core/experience-access";
import { LocalBrowsers } from "../server/core/local-browsers";
import { Chrome } from "../server/core/chrome";
import { ChromeBridge } from "../server/core/chrome-bridge";
import { Store } from "../server/core/store";

function fixture() {
  const buckets = new Map<string, Map<string, any>>();
  const sessions: Record<string, any[]> = {
    alice: [{ id: "a1", ownerId: "alice", clientId: "shared" }],
    bob: [{ id: "b1", ownerId: "bob", clientId: "shared" }],
  };
  const store = {
    async objects<T>(kind: string): Promise<T[]> { return structuredClone([...(buckets.get(kind)?.values() || [])]); },
    async object(kind: string, id: string) { return structuredClone(buckets.get(kind)?.get(id)); },
    async save(kind: string, id: string, value: any) {
      if (!buckets.has(kind)) buckets.set(kind, new Map());
      buckets.get(kind)!.set(id, structuredClone(value));
    },
    async sessionsBy(column: string, user: string) { assert.equal(column, "owner"); return sessions[user] || []; },
    async session(id: string) {
      const session = Object.values(sessions).flat().find((item) => item.id === id);
      if (!session) throw Error("session not found");
      return session;
    },
    async all() { return [...buckets.keys()].filter((kind) => kind.startsWith("experience:client:")).map((kind) => ({ kind })); },
    async transaction<T>(fn: () => Promise<T>) { return fn(); },
  };
  return { store, buckets };
}

const entry = (id: string, refs: string[] = []) => ({
  id, scope: "https://fixture.test", task: id, conditions: ["start"], steps: ["click"], checks: ["done"], pitfalls: [],
  alternatives: [], successes: refs, failures: [], disabled: false, updatedAt: 1,
});

test("personal graph includes owned partitions and only provably owned legacy paths", async () => {
  const { store } = fixture();
  const put = async (kind: string, id: string, refs: string[] = []) => store.save(kind, id, entry(id, refs));
  await put("experience:user_alice", "cloud-a");
  await put("experience:user_bob", "cloud-b");
  await put("experience:desktop:alice", "desktop-a");
  await put(clientExperienceKind("alice", "shared"), "client-a");
  await put(clientExperienceKind("bob", "shared"), "client-b");
  await put("experience:eAlice", "employee-a");
  await put("experience:eBob", "employee-b");
  await put("experience:client:shared", "legacy-a", ["a1"]);
  await put("experience:client:shared", "legacy-b", ["b1"]);
  await put("experience:client:shared", "legacy-mixed", ["a1", "b1"]);
  await put("experience:client:shared", "legacy-unknown", ["deleted-session"]);
  await put("experience", "global-a", ["a1"]);
  await put("experience", "global-b", ["b1"]);
  await put("experience", "global-unowned");
  await store.save("client-token", "a", { userId: "alice", clientId: "shared" });
  await store.save("client-token", "b", { userId: "bob", clientId: "shared" });
  const alice = await userExperienceGraph(store as any, "alice", ["eAlice"]);
  assert.deepEqual(new Set(alice.routes.map((route: any) => route.id)), new Set(["cloud-a", "desktop-a", "client-a", "employee-a", "legacy-a", "global-a"]));
  const bob = await userExperienceGraph(store as any, "bob", ["eBob"]);
  assert.deepEqual(new Set(bob.routes.map((route: any) => route.id)), new Set(["cloud-b", "client-b", "employee-b", "legacy-b", "global-b"]));
});

test("ordinary shared-browser experiences are isolated per account and recover only owned legacy records", async () => {
  const { store } = fixture();
  await store.save("experience", "old-a", entry("old-a", ["a1"]));
  await store.save("experience", "old-b", entry("old-b", ["b1"]));
  await store.save("experience", "mixed", entry("mixed", ["a1", "b1"]));
  const chrome = new Chrome(store as any, new ChromeBridge(), "");
  const alice = await chrome.experiencesFor("a1"), bob = await chrome.experiencesFor("b1");
  assert.equal(alice.kind, "experience:user_alice");
  assert.equal(bob.kind, "experience:user_bob");
  assert.deepEqual((await alice.all()).map((value) => value.id), ["old-a"]);
  assert.deepEqual((await bob.all()).map((value) => value.id), ["old-b"]);
  assert(await store.object("experience", "old-a"), "legacy paths remain untouched");
});

test("automatic browser paths persist in the real account database and appear only to their owner", async () => {
  const store = await Store.open(":memory:");
  try {
    const alice = await store.newSession({ ownerId: "alice" });
    const chrome = new Chrome(store, new ChromeBridge(), "");
    const experiences = await chrome.experiencesFor(alice.id);
    experiences.record(alice.id, "https://fixture.test/start", "https://fixture.test/end", "fixture", ["click", "confirm"]);
    await experiences.finish(alice.id, true);
    const own = await userExperienceGraph(store, "alice", []), other = await userExperienceGraph(store, "bob", []);
    assert.equal(own.routes.length, 1);
    assert.equal(own.routes[0].source, "auto");
    assert.equal(other.routes.length, 0);
  } finally { await store.close(); }
});

test("legacy client routes are copied safely, remain reusable, and never overwrite feedback", async () => {
  const { store } = fixture();
  await store.save("experience:client:shared", "mine", entry("mine", ["a1"]));
  await store.save("experience:client:shared", "other", entry("other", ["b1"]));
  await store.save("experience:client:shared", "mixed", entry("mixed", ["a1", "b1"]));
  const agent = { userId: "alice", clientId: "shared", browserLeases: new Set<string>() };
  const hub = { active: () => agent, request: async () => ({ result: {} }) };
  const browsers = new LocalBrowsers(store as any, hub as any, "");
  const chrome = await browsers.get({ id: "a1", ownerId: "alice", clientId: "shared" } as any);
  assert.equal(chrome.experiences.kind, clientExperienceKind("alice", "shared"));
  assert.deepEqual((await chrome.experiences.all()).map((value) => value.id), ["mine"]);
  const copied = await store.object(clientExperienceKind("alice", "shared"), "mine");
  await store.save(clientExperienceKind("alice", "shared"), "mine", { ...copied, disabled: true });
  await restoreClientExperiences(store as any, "alice", "shared");
  assert.equal((await store.object(clientExperienceKind("alice", "shared"), "mine")).disabled, true);
  assert(await store.object("experience:client:shared", "mine"), "the legacy record must not be deleted");
  const graph = await userExperienceGraph(store as any, "alice", []);
  assert(!graph.routes.some((route: any) => route.id === "mine"), "disabled personal feedback must not resurrect its legacy copy");
  await browsers.release("a1", true);
});
