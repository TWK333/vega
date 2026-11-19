import { check } from "./auth";
import { stepSummary } from "../../shared/step-output.js";
import type { Message, Store } from "./store";

/** A task list needs status and progress, not the full step artifacts. */
export function withoutStepOutputs<T extends Record<string, any>>(task: T) {
  const { stepOutputs: _stepOutputs, ...summary } = task;
  return summary;
}

export const CHAT_PAGE_MAX = 500;

function seqParam(query: URLSearchParams, name: string, min: number, max = Number.MAX_SAFE_INTEGER) {
  if (!query.has(name)) return undefined;
  const raw = query.get(name)!, value = Number(raw);
  check(/^\d+$/.test(raw) && Number.isSafeInteger(value) && value >= min && value <= max, 400, `Invalid ${name}`);
  return value;
}

/**
 * Optional, backward-compatible pagination for an employee chat.
 * Without parameters the full history is returned exactly as before.
 * `limit` (1–500) with optional `before` returns the newest messages older than `before`;
 * `after` returns every message newer than `after` (used to append after stream events).
 */
export async function chatHistory(store: Store, session: string, query: URLSearchParams, scoped?: readonly Readonly<Message>[]) {
  const limit = seqParam(query, "limit", 1, CHAT_PAGE_MAX), before = seqParam(query, "before", 1), after = seqParam(query, "after", 0);
  const messages = (rows: readonly Readonly<Message>[]) => rows.map((row) => query.get("stepSummaries") === "1" ? stepSummary(row) : { ...row });
  if (limit === undefined && before === undefined && after === undefined) return { messages: messages(scoped ?? await store.messages(session)) };
  check(after === undefined || (before === undefined && limit === undefined), 400, "after cannot be combined with before or limit");
  if (scoped) {
    const selected = scoped.filter((row) => after !== undefined ? row.seq! > after : before === undefined || row.seq! < before);
    if (after !== undefined) return { messages: messages(selected), hasMore: scoped.some((row) => row.seq! <= after), lastSeq: scoped.at(-1)?.seq || 0 };
    return { messages: messages(selected.slice(-(limit ?? 100))), hasMore: selected.length > (limit ?? 100) };
  }
  const page = await store.messagePage(session, { before, after, limit: limit ?? 100 });
  if (after === undefined) return { ...page, messages: messages(page.messages) };
  const lastSeq = (await store.one("SELECT COALESCE(MAX(seq),0) seq FROM messages WHERE session=?", session) as { seq: number }).seq;
  return { ...page, messages: messages(page.messages), lastSeq };
}
