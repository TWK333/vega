import { stepSummary } from "../../shared/step-output.js";

// Windowed employee chat history: cached messages render first, then stream events append server deltas.
export const CHAT_PAGE_SIZE = 60;

/** Fetch a single original artifact only when its task is no longer available. */
export async function loadStepOutput(api, path, seq, sessionId, expected) {
  if (!Number.isSafeInteger(seq) || seq < 1 || seq === Number.MAX_SAFE_INTEGER) throw Error("产物消息编号无效");
  const page = await api(`${path}?before=${seq + 1}&limit=1`);
  if (sessionId && page.session?.id && page.session.id !== sessionId) throw Error("会话已变化，原产物可能已不可见；请刷新后再试");
  const message = page.messages?.find((row) => row.seq === seq), output = message?.stepOutput;
  if (expected) {
    const actual = message && stepSummary(message);
    const expectedTask = expected.tasks?.[0]?.id, actualTask = actual?.tasks?.[0]?.id;
    if (!actual || actual.stepOutput?.step !== expected.stepOutput?.step || actual.stepOutput?.label !== expected.stepOutput?.label || expectedTask !== actualTask)
      throw Error("原产物已变化或不存在，请刷新会话后再试");
  }
  if (output && typeof output === "object" && !output.omitted) return output;
  const prefix = "**步骤产物（任务未完成）**\n\n", text = String(message?.text || "");
  if (output === true && text.startsWith(prefix)) {
    const rest = text.slice(prefix.length), split = rest.indexOf("\n\n");
    return { label: split < 0 ? "历史步骤产物" : rest.slice(0, split), text: split < 0 ? rest : rest.slice(split + 2) };
  }
  throw Error("原产物暂不可见或已不存在");
}

/** Merge two seq-sorted message lists, preferring the incoming copy of any duplicate. */
export function mergeMessages(current, incoming) {
  if (!incoming.length) return current;
  const bySeq = new Map(current.map((message) => [message.seq, message]));
  for (const message of incoming) bySeq.set(message.seq, message);
  return [...bySeq.values()].sort((a, b) => a.seq - b.seq);
}

/**
 * @param {{ api: Function, path: () => string, messages: {value:any[]}, running: {value:boolean}, hasMore: {value:boolean}, moodWeather?: {value:string}, pageSize?: number, cache?: any }} options
 */
export function createChatHistory({ api, path, messages, running, hasMore, moodWeather, pageSize = CHAT_PAGE_SIZE, cache }) {
  let session = "", stream = 0, queue = Promise.resolve(), generation = 0, disposed = false;
  const enqueue = (job) => { const next = queue.then(job, job); queue = next.catch(() => {}); return next; };
  const lastSeq = () => messages.value.at(-1)?.seq ?? 0;
  const valid = (current) => !disposed && current === generation && (!cache || cache.valid());
  const contiguous = (rows) => rows.every((row, i) => i === 0 || row.seq === rows[i - 1].seq + 1);
  function reset() { session = ""; messages.value = []; hasMore.value = false; running.value = false; if (moodWeather) moodWeather.value = ""; }
  async function request(url, current) {
    try { return await api(url); }
    catch (error) {
      if (valid(current) && [401, 403, 404].includes(error.status)) {
        reset(); generation++;
        void cache?.clear();
      }
      throw error;
    }
  }
  function changed(result) {
    return (result.session?.id && result.session.id !== session) || (Number.isSafeInteger(result.lastSeq) && result.lastSeq < lastSeq());
  }
  async function replaceHistory(result) {
    reset();
    void cache?.put(result.session?.id, [], true);
    return fetchLatest();
  }
  async function fetchLatest() {
    const version = stream, current = generation;
    if (!valid(current)) return [];
    const result = await request(`${path()}?limit=${pageSize}`, current);
    if (!valid(current)) return [];
    session = result.session?.id || "";
    messages.value = result.messages;
    hasMore.value = !!result.hasMore;
    if (moodWeather && typeof result.moodWeather === "string") moodWeather.value = result.moodWeather;
    if (version === stream) running.value = !!result.running;
    void cache?.put(session, result.messages, true);
    return result.messages;
  }
  /** Fetch messages after the newest confirmed seq; apply merges replies and typing state in the same tick. */
  async function fetchNewer(apply, syncRunning = true) {
    if (!session) { const added = await fetchLatest(); apply?.(added); return added; }
    const version = stream, current = generation;
    if (!valid(current)) return [];
    const result = await request(`${path()}?after=${lastSeq()}`, current);
    if (!valid(current)) return [];
    if (changed(result)) { const added = await replaceHistory(result); apply?.(added); return added; }
    const known = new Set(messages.value.map((message) => message.seq));
    const added = result.messages.filter((message) => !known.has(message.seq));
    messages.value = mergeMessages(messages.value, result.messages);
    if (moodWeather && typeof result.moodWeather === "string") moodWeather.value = result.moodWeather;
    if (version === stream && !apply && syncRunning) running.value = !!result.running;
    void cache?.put(session, result.messages);
    apply?.(added);
    return added;
  }
  async function fetchOlder() {
    const first = messages.value[0]?.seq, current = generation;
    if (!hasMore.value || !first || !valid(current)) return [];
    const saved = await cache?.read(first, pageSize);
    if (!valid(current)) return [];
    if (saved?.session === session && saved.messages.at(-1)?.seq === first - 1 && contiguous(saved.messages)) {
      messages.value = mergeMessages(saved.messages, messages.value);
      hasMore.value = saved.messages[0].seq > 1;
      return saved.messages;
    }
    const result = await request(`${path()}?before=${first}&limit=${pageSize}`, current);
    if (!valid(current) || messages.value[0]?.seq !== first) return [];
    if (changed(result)) return replaceHistory(result);
    messages.value = mergeMessages(result.messages, messages.value);
    hasMore.value = !!result.hasMore;
    void cache?.put(session, result.messages);
    return result.messages;
  }
  return {
    lastSeq,
    get session() { return session; },
    touch() { stream++; return stream; },
    get stream() { return stream; },
    load(onCached) {
      const current = ++generation;
      session = "";
      return enqueue(async () => {
        if (!valid(current)) return [];
        const saved = await cache?.read(undefined, pageSize);
        if (!valid(current)) return [];
        if (saved?.messages.length && contiguous(saved.messages)) {
          session = saved.session;
          messages.value = saved.messages;
          hasMore.value = saved.messages[0].seq > 1;
          await onCached?.();
          if (!valid(current)) return [];
          return fetchNewer();
        }
        return fetchLatest();
      });
    },
    /** syncRunning: false for stream-driven fetches: only done (via apply) may end typing. */
    newer: (apply, syncRunning) => enqueue(() => fetchNewer(apply, syncRunning)),
    older: () => enqueue(fetchOlder),
    dispose() { disposed = true; generation++; },
  };
}
