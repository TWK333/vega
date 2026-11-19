import type { Store } from "./store";
import { assert } from "./util";

/** Same length cap as a bot's private 工作原则 (`employee.instruction`). */
export const WORK_PRINCIPLES_MAX = 8000;
const KIND = "user-work-principles";

export async function getWorkPrinciples(store: Store, ownerId?: string) {
  return ownerId ? (await store.object<string>(KIND, ownerId)) ?? "" : "";
}

export async function setWorkPrinciples(store: Store, ownerId: string, value: unknown) {
  assert(typeof value === "string" && value.length <= WORK_PRINCIPLES_MAX, "公共工作原则须为不超过 8000 字的文本");
  const text = value.trim();
  await store.save(KIND, ownerId, text);
  return text;
}

export async function migrateWorkPrinciples(store: Store) {
  await store.transaction(async () => {
    const { workPrinciples, ...config } = await store.get<Record<string, unknown>>("config", {});
    if (typeof workPrinciples !== "string" || !workPrinciples.trim()) return;
    // Like the legacy default employee, the old site setting belongs to the initializing admin, not every account.
    const owner = await store.one("SELECT id FROM web_users WHERE role='admin' ORDER BY createdAt,id LIMIT 1");
    if (!owner) return;
    if (await store.object<string>(KIND, owner.id) === undefined) await store.save(KIND, owner.id, workPrinciples.trim());
    await store.put("config", config);
  });
}

/**
 * Effective 工作原则 for one bot: its owner's shared text first, then that bot's private instruction.
 * Private text supplements the public text. It does not replace or drop it.
 * An empty side is left out. When the public text is empty, the private string is returned unchanged
 * so a bot with only its own principles keeps today's prompt.
 */
export function effectiveWorkPrinciples(shared?: unknown, own?: unknown): string {
  const pub = typeof shared === "string" ? shared.trim() : "";
  const priv = typeof own === "string" ? own : "";
  if (!pub) return priv;
  const privateText = priv.trim();
  if (!privateText) return pub;
  return `${pub}\n\n${privateText}`;
}
