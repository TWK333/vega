import { Experiences } from "./experiences";
import type { Store } from "./store";
import { assert, type Obj } from "./util";

export const clientExperienceKind = (userId: string, clientId: string) => `experience:client:${userId}:${clientId}`;

const ownedSessions = (sessions: { id: string }[], userId: string) => new Set([...sessions.map((session) => session.id), `browser-view:${userId}`]);
const ownedLegacy = (entry: Obj, sessions: Set<string>) => {
  const refs = [...(entry.successes || []), ...(entry.failures || [])];
  return refs.length > 0 && refs.every((ref) => typeof ref === "string" && sessions.has(ref));
};

async function restoreLegacy(store: Store, userId: string, source: string, target: string) {
  const legacy = await store.objects<Obj>(source);
  if (!legacy.length) return;
  const sessions = ownedSessions(await store.sessionsBy("owner", userId), userId);
  await store.transaction(async () => {
    for (const entry of legacy) {
      if (!ownedLegacy(entry, sessions) || await store.object(target, entry.id)) continue;
      await store.save(target, entry.id, entry);
    }
  });
}

/** Copy only unambiguously owned legacy paths; leave originals intact for other accounts. */
export const restoreClientExperiences = (store: Store, userId: string, clientId: string) =>
  restoreLegacy(store, userId, "experience:client:" + clientId, clientExperienceKind(userId, clientId));
export const restoreGlobalExperiences = (store: Store, userId: string) =>
  restoreLegacy(store, userId, "experience", "experience:user_" + userId);

/** A person's own browser and desktop routes, including safely attributable older routes. */
export async function userExperienceGraph(store: Store, userId: string, employeeIds: string[]) {
  assert(userId, "经验图谱需要归属账号");
  const sessions = await store.sessionsBy("owner", userId), sessionIds = ownedSessions(sessions, userId);
  const clientIds = new Set(sessions.flatMap((session) => [session.clientId, session.browserClientId]).filter((id): id is string => !!id));
  for (const grant of await store.objects<{ userId: string; clientId: string }>("client-token"))
    if (grant.userId === userId && grant.clientId) clientIds.add(grant.clientId);
  const prefix = `experience:client:${userId}:`;
  const kinds = (await store.all("SELECT DISTINCT kind FROM objects WHERE kind LIKE ?", prefix + "%"))
    .map((row) => String(row.kind)).filter((kind) => kind.startsWith(prefix));
  const personalKinds = new Set(["experience:user_" + userId, "experience:desktop:" + userId, ...employeeIds.map((id) => "experience:" + id), ...kinds]);
  const legacyKinds = new Set(["experience", ...[...clientIds].map((id) => "experience:client:" + id)]);
  const legacy = (await Promise.all([...legacyKinds].map((kind) => store.objects<Obj>(kind)))).flat().filter((entry) => ownedLegacy(entry, sessionIds));
  const personal = (await Promise.all([...personalKinds].map((kind) => store.objects<Obj>(kind)))).flat();
  const entries = new Map<string, Obj>();
  for (const entry of [...legacy, ...personal]) entries.set(entry.id, entry);
  return new Experiences(store).graph([...entries.values()].filter((entry) => !entry.disabled));
}
