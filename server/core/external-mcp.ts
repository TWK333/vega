import { createHash, randomBytes } from "node:crypto";
import { AuthError, check, digest, equal, type User } from "./auth";
import type { Engine } from "./engine";
import { nameKey } from "./names";
import type { Message, Store } from "./store";
import { id, sleep, type Obj } from "./util";

/**
 * 对外 MCP：外部客户端连到 Vega，向用户选定的牛马或群聊发消息。
 * 和牛马「MCP 客户端」（server/core/mcp.ts，牛马去调用外部服务）方向相反，存储也不共用。
 * 每条配置属于创建它的用户，令牌只代表该用户，且只能碰到这条配置绑定的对象。
 */
const KIND = "external-mcp";
const MAX_CONFIGS = 20;
const MAX_TARGETS = 20;
const MESSAGE_MAX = 20000;
const REPLY_MESSAGES = 30;
const REPLY_CHARS = 4000;
export const EXTERNAL_MCP_REJECTED = "对外 MCP 凭据无效或已停用";
const CONFIG_ID = /^xm[a-f0-9]{32}$/;
const TOKEN_RE = /^vmcp_[A-Za-z0-9_-]{43}$/;

export type TargetRef = { type: "employee" | "group"; id: string; name: string };
export type ExternalMcpRecord = {
  id: string;
  name: string;
  ownerId: string;
  enabled: boolean;
  /** sha256 hex of the token. Empty after revoke. The raw token is never stored. */
  tokenHash: string;
  tokenHint: string;
  employees: string[];
  groups: string[];
  createdAt: number;
  updatedAt: number;
};
export type ExternalMcpPublic = {
  id: string;
  name: string;
  enabled: boolean;
  revoked: boolean;
  tokenHint: string;
  employees: string[];
  groups: string[];
  url: string;
  createdAt: number;
  updatedAt: number;
};

export class TargetError extends Error {
  readonly candidates: TargetRef[];
  constructor(message: string, candidates: TargetRef[]) {
    super(message);
    this.candidates = candidates.map(({ id, name, type }) => ({ id, name, type }));
  }
}

export function mcpEndpoint(origin: string, configId: string) {
  return new URL("/api/mcp/" + encodeURIComponent(configId), origin).href;
}
function hintOf(token: string) {
  return "vmcp_…" + token.slice(-4);
}
function issueToken() {
  const token = "vmcp_" + randomBytes(32).toString("base64url");
  return { token, tokenHash: digest(token), tokenHint: hintOf(token) };
}
function configName(value: unknown) {
  check(typeof value === "string", 400, "名称需要 1–40 个字");
  const name = value.trim();
  check(name && [...name].length <= 40 && !/[\u0000-\u001f]/.test(name), 400, "名称需要 1–40 个字，不能换行");
  return name;
}
function idList(value: unknown, label: string) {
  check(Array.isArray(value), 400, `${label}必须是 id 数组`);
  check(value.length <= MAX_TARGETS, 400, `${label}最多 ${MAX_TARGETS} 个`);
  const ids: string[] = [];
  for (const item of value) {
    check(typeof item === "string" && /^[A-Za-z0-9_-]{1,80}$/.test(item), 400, `${label}包含无效 id`);
    if (!ids.includes(item)) ids.push(item);
  }
  return ids;
}
function flag(value: unknown, fallback: boolean) {
  if (value === undefined) return fallback;
  check(typeof value === "boolean", 400, "enabled 必须是 true 或 false");
  return value;
}
export function toPublic(record: ExternalMcpRecord, origin: string): ExternalMcpPublic {
  return {
    id: record.id,
    name: record.name,
    enabled: record.enabled,
    revoked: !record.tokenHash,
    tokenHint: record.tokenHint,
    employees: [...record.employees],
    groups: [...record.groups],
    url: mcpEndpoint(origin, record.id),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}
async function owned(store: Store, userId: string, configId: string) {
  check(CONFIG_ID.test(configId), 404, "配置不存在");
  const record = await store.object<ExternalMcpRecord>(KIND, configId);
  check(record && record.ownerId === userId, 404, "配置不存在");
  return record;
}
async function assertBindings(engine: Engine, user: User, employees: string[], groups: string[]) {
  check(employees.length + groups.length > 0, 400, "至少选择一个牛马或群聊");
  for (const employeeId of employees) {
    const employee = (await engine.employee.all()).find((item) => item.employeeId === employeeId && !item.deleting && !item.deleted);
    check(employee && await employee.accessible(user), 400, "只能绑定你自己的牛马");
  }
  for (const groupId of groups) {
    try { await engine.groups.mine(user, groupId); }
    catch { check(false, 400, "只能绑定你已经加入的群聊"); }
  }
}

export async function externalMcpApi(engine: Engine, user: User, method: string, path: string[], body: Obj, origin: string) {
  const store = engine.store;
  if (!path.length && method === "GET") {
    const configs = (await store.objects<ExternalMcpRecord>(KIND)).filter((item) => item.ownerId === user.id);
    configs.sort((a, b) => b.createdAt - a.createdAt || a.id.localeCompare(b.id));
    return { configs: configs.map((item) => toPublic(item, origin)) };
  }
  if (!path.length && method === "POST") {
    const name = configName(body.name);
    const employees = idList(body.employees ?? [], "牛马");
    const groups = idList(body.groups ?? [], "群聊");
    const enabled = flag(body.enabled, true);
    await assertBindings(engine, user, employees, groups);
    const issued = issueToken();
    const now = Date.now();
    const record: ExternalMcpRecord = {
      id: id("xm"), name, ownerId: user.id, enabled,
      tokenHash: issued.tokenHash, tokenHint: issued.tokenHint,
      employees, groups, createdAt: now, updatedAt: now,
    };
    await store.transaction(async () => {
      const count = (await store.objects<ExternalMcpRecord>(KIND)).filter((item) => item.ownerId === user.id).length;
      check(count < MAX_CONFIGS, 400, `最多创建 ${MAX_CONFIGS} 条对外 MCP`);
      await store.save(KIND, record.id, record);
    });
    return { config: toPublic(record, origin), token: issued.token };
  }
  if (path.length === 2 && path[1] === "rotate" && method === "POST") {
    const issued = issueToken();
    const record = await store.transaction(async () => {
      const current = await owned(store, user.id, path[0]);
      current.tokenHash = issued.tokenHash;
      current.tokenHint = issued.tokenHint;
      current.updatedAt = Date.now();
      await store.save(KIND, current.id, current);
      return current;
    });
    return { config: toPublic(record, origin), token: issued.token };
  }
  if (path.length === 2 && path[1] === "revoke" && method === "POST") {
    const record = await store.transaction(async () => {
      const current = await owned(store, user.id, path[0]);
      current.tokenHash = "";
      current.tokenHint = "";
      current.updatedAt = Date.now();
      await store.save(KIND, current.id, current);
      return current;
    });
    return { config: toPublic(record, origin) };
  }
  if (path.length === 1 && method === "PATCH") {
    const record = await store.transaction(async () => {
      const current = await owned(store, user.id, path[0]);
      if (body.name !== undefined) current.name = configName(body.name);
      if (body.enabled !== undefined) current.enabled = flag(body.enabled, current.enabled);
      if (body.employees !== undefined || body.groups !== undefined) {
        current.employees = body.employees === undefined ? current.employees : idList(body.employees, "牛马");
        current.groups = body.groups === undefined ? current.groups : idList(body.groups, "群聊");
        await assertBindings(engine, user, current.employees, current.groups);
      }
      check(body.name !== undefined || body.enabled !== undefined || body.employees !== undefined || body.groups !== undefined, 400, "没有要修改的内容");
      current.updatedAt = Date.now();
      await store.save(KIND, current.id, current);
      return current;
    });
    return { config: toPublic(record, origin) };
  }
  if (path.length === 1 && method === "DELETE") {
    await store.transaction(async () => {
      await owned(store, user.id, path[0]);
      await store.remove(KIND, path[0]);
    });
    return { ok: true };
  }
  check(false, 404, "配置不存在");
}

/** Header token only. Query strings are ignored so the secret is not part of the URL. */
export function tokenFromHeaders(headers: Headers) {
  const authorization = headers.get("authorization") || "";
  const bearer = /^Bearer\s+(\S+)\s*$/i.exec(authorization)?.[1];
  const alternate = headers.get("x-vega-mcp-token")?.trim() || "";
  if (bearer && alternate && bearer !== alternate) return undefined;
  return bearer || alternate || undefined;
}
export async function authenticateExternalMcp(store: Store, configId: string, token: string | undefined): Promise<ExternalMcpRecord> {
  if (!token || !TOKEN_RE.test(token) || !CONFIG_ID.test(configId)) throw new AuthError(401, EXTERNAL_MCP_REJECTED);
  const record = await store.object<ExternalMcpRecord>(KIND, configId);
  if (!record || !record.enabled || !record.tokenHash || !equal(record.tokenHash, digest(token))) throw new AuthError(401, EXTERNAL_MCP_REJECTED);
  return record;
}

function listing(targets: TargetRef[]) {
  if (!targets.length) return "当前没有可对话的对象。";
  return "可选：" + targets.map((target) => `${target.type === "employee" ? "牛马" : "群聊"}「${target.name}」（${target.id}）`).join("、") + "。";
}
function resolveQuery(query: string, targets: TargetRef[]) {
  const byId = targets.filter((target) => target.id === query);
  if (byId.length) return byId;
  const key = nameKey(query);
  return key ? targets.filter((target) => nameKey(target.name) === key) : [];
}
function splitAddress(after: string) {
  const match = /^(?:说[:：]?|[:：])\s*([\s\S]*)$/.exec(after);
  if (!match) return;
  return match[1].trim();
}
/**
 * 「给老张说做这个」/「给老张：做这个」：在绑定对象里按显示名（最长优先）取出要送达的正文。
 * 对不上任何绑定名称时视为点名失败，不退回“唯一对象”。
 */
function matchAddress(text: string, targets: TargetRef[]) {
  if (!text.startsWith("给")) return;
  const rest = [...text.slice("给".length)];
  const ranked = targets.filter((target) => target.name.trim()).sort((a, b) => [...b.name.trim()].length - [...a.name.trim()].length);
  let best = -1;
  const matches: { target: TargetRef; message: string }[] = [];
  for (const target of ranked) {
    const name = [...target.name.trim()];
    if (!name.length || rest.length <= name.length) continue;
    if (nameKey(rest.slice(0, name.length).join("")) !== nameKey(target.name)) continue;
    const message = splitAddress(rest.slice(name.length).join(""));
    if (message === undefined) continue;
    if (name.length < best) continue;
    if (name.length > best) { best = name.length; matches.length = 0; }
    matches.push({ target, message });
  }
  if (matches.length) return { kind: "matched" as const, name: rest.slice(0, best).join(""), matches };
  const loose = /^([\s\S]+?)(?:说[:：]?|[:：])/.exec(rest.join(""));
  if (!loose || !loose[1].trim()) return;
  return { kind: "unknown" as const, name: loose[1].trim() };
}
export function interpretDelivery(text: string, explicit: string, targets: TargetRef[]) {
  const body = text.trim();
  check(body, 400, "消息是空的");
  check([...body].length <= MESSAGE_MAX, 400, `消息最多 ${MESSAGE_MAX} 字`);
  if (!targets.length) throw new TargetError("这条配置没有可对话的牛马或群聊。", []);
  const addressed = matchAddress(body, targets);
  const named = explicit.trim();
  const one = (query: string, found: TargetRef[], pool: TargetRef[]) => {
    if (found.length === 1) return found[0];
    throw new TargetError(found.length ? `「${query}」对应多个对象，请改用 id。${listing(found)}` : `没有找到名为「${query}」的对象。${listing(pool)}`, found.length ? found : pool);
  };
  if (addressed?.kind === "unknown") throw new TargetError(`没有找到名为「${addressed.name}」的对象。${listing(targets)}`, targets);
  if (named) {
    const target = one(named, resolveQuery(named, targets), targets);
    if (addressed?.kind === "matched") {
      const picked = one(addressed.name, addressed.matches.map((item) => item.target), targets);
      if (picked.id !== target.id || picked.type !== target.type)
        throw new TargetError(`指定的对象和「给…说」里的「${addressed.name}」不是同一个。${listing(targets)}`, targets);
      check(addressed.matches[0].message, 400, "消息是空的");
      return { target, message: addressed.matches.find((item) => item.target.id === target.id && item.target.type === target.type)!.message };
    }
    return { target, message: body };
  }
  if (addressed?.kind === "matched") {
    const found = addressed.matches.map((item) => item.target);
    const target = one(addressed.name, found, targets);
    const message = addressed.matches.find((item) => item.target.id === target.id && item.target.type === target.type)!.message;
    check(message, 400, "消息是空的");
    return { target, message };
  }
  if (targets.length === 1) return { target: targets[0], message: body };
  throw new TargetError(`请指明要发给哪一个牛马或群聊。${listing(targets)}`, targets);
}

export async function visibleTargets(engine: Engine, user: User, record: ExternalMcpRecord): Promise<TargetRef[]> {
  const employees = await engine.employee.all();
  const targets: TargetRef[] = [];
  for (const employeeId of record.employees) {
    const employee = employees.find((item) => item.employeeId === employeeId && !item.deleting && !item.deleted && !item.resetting);
    if (!employee || !await employee.accessible(user)) continue;
    const profile = await employee.profile();
    targets.push({ type: "employee", id: profile.id, name: profile.name });
  }
  for (const groupId of record.groups) {
    const group = await engine.groups.get(groupId);
    if (!group || !group.users.includes(user.id)) continue;
    targets.push({ type: "group", id: group.id, name: group.name });
  }
  return targets;
}
function textOf(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}
function clipText(value: string) {
  const chars = [...value];
  return chars.length > REPLY_CHARS ? chars.slice(0, REPLY_CHARS).join("") + "…" : value;
}
function messageHash(text: string) {
  return createHash("sha256").update(JSON.stringify([text, [], [], null])).digest("hex");
}

export async function sendExternalMessage(engine: Engine, user: User, record: ExternalMcpRecord, input: Obj) {
  check(user.id === record.ownerId, 403, "不能使用别人的对外 MCP");
  check(user.role !== "viewer", 403, "只读账号不能执行操作");
  const targets = await visibleTargets(engine, user, record);
  const text = textOf(input.message) || textOf(input.text);
  const { target, message } = interpretDelivery(text, textOf(input.target), targets);
  // /setup 会打开全局配置写入。对外连接只负责把话送进现有对话，不能借此改设置或密码本。
  check(!/^\s*\/setup(?:\s|$)/i.test(message), 400, "对外 MCP 不能修改系统设置或密码本");
  if (target.type === "group") {
    const saved = await engine.groups.send(user, target.id, { text: message, clientMessageId: id("m") });
    return {
      ok: true,
      summary: `已把消息发给群聊「${target.name}」。用 read_reply 查看回复。`,
      target, sentSeq: saved.seq, afterSeq: saved.seq,
    };
  }
  const employee = (await engine.employee.all()).find((item) => item.employeeId === target.id);
  check(employee && await employee.accessible(user) && !employee.deleting && !employee.resetting, 404, "牛马不存在");
  const session = await employee.chat(user.id);
  const before = await engine.store.lastSeq(session.id);
  const clientMessageId = id("m");
  await engine.submitChat(session.id, {
    role: "user", text: message, actorId: user.id, clientMessageId, clientMessageHash: messageHash(message),
  });
  let sentSeq: number | undefined;
  for (let i = 0; i < 20 && !sentSeq; i++) {
    sentSeq = (await engine.store.clientMessage(session.id, user.id, clientMessageId))?.seq;
    if (!sentSeq) await sleep(15);
  }
  return {
    ok: true,
    summary: `已把消息发给牛马「${target.name}」。用 read_reply 查看回复。`,
    target, sentSeq: sentSeq ?? null, afterSeq: sentSeq ?? before,
  };
}

function publishMessage(message: Message, taskStatus?: Map<string, string>) {
  if (message.runtime || (message.role !== "user" && message.role !== "assistant")) return;
  const text = String(message.text || "").trim();
  const tasks = (message.tasks || []).map((task) => ({ id: task.id, title: task.title, status: taskStatus?.get(task.id) || task.status }));
  if (!text && !tasks.length && !message.notice) return;
  return {
    seq: message.seq, role: message.role, text: clipText(text), at: message.at,
    ...(message.notice ? { notice: true } : {}),
    ...(message.author ? { author: { kind: message.author.kind, id: message.author.id, name: message.author.name } } : {}),
    ...(tasks.length ? { tasks } : {}),
  };
}
function afterSeqOf(value: unknown) {
  if (value === undefined || value === null || value === "") return undefined;
  const number = typeof value === "number" ? value : typeof value === "string" && /^\d+$/.test(value) ? Number(value) : NaN;
  check(Number.isSafeInteger(number) && number >= 0, 400, "afterSeq 必须是大于等于 0 的整数");
  return number;
}
export async function readExternalReply(engine: Engine, user: User, record: ExternalMcpRecord, input: Obj) {
  check(user.id === record.ownerId, 403, "不能使用别人的对外 MCP");
  const targets = await visibleTargets(engine, user, record);
  const named = textOf(input.target);
  let target: TargetRef;
  if (named) {
    const found = resolveQuery(named, targets);
    if (found.length !== 1) throw new TargetError(found.length ? `「${named}」对应多个对象，请改用 id。${listing(found)}` : `没有找到名为「${named}」的对象。${listing(targets)}`, found.length ? found : targets);
    target = found[0];
  } else if (targets.length === 1) target = targets[0];
  else throw new TargetError(`请指明要查看哪一个牛马或群聊。${listing(targets)}`, targets);
  const after = afterSeqOf(input.afterSeq);
  if (target.type === "group") {
    const group = await engine.groups.mine(user, target.id);
    const page = after === undefined ? await engine.store.messagePage(group.session, { limit: REPLY_MESSAGES }) : await engine.store.messagePage(group.session, { after });
    const rows = page.messages.slice(-REPLY_MESSAGES);
    const taskStatus = await engine.groups.taskStatus(rows);
    const messages = rows.map((message) => publishMessage(message, new Map(Object.entries(taskStatus)))).filter(Boolean);
    const running = Object.values(group.memberSessions).some((session) => engine.active.has(session));
    return replyView(target, messages, await engine.store.lastSeq(group.session), running);
  }
  const employee = (await engine.employee.all()).find((item) => item.employeeId === target.id);
  check(employee && await employee.accessible(user), 404, "牛马不存在");
  const sessionId = (await employee.profile()).chatSession;
  if (!sessionId) return replyView(target, [], 0, false);
  const page = after === undefined ? await engine.store.messagePage(sessionId, { limit: REPLY_MESSAGES }) : await engine.store.messagePage(sessionId, { after });
  const rows = page.messages.slice(-REPLY_MESSAGES);
  const live = rows.some((message) => message.tasks?.length) ? new Map((await employee.state()).tasks.map((task) => [task.id, task.status])) : undefined;
  const messages = rows.map((message) => publishMessage(message, live)).filter(Boolean);
  return replyView(target, messages, await engine.store.lastSeq(sessionId), engine.active.has(sessionId));
}
function replyView(target: TargetRef, messages: ReturnType<typeof publishMessage>[], lastSeq: number, running: boolean) {
  const latest = [...messages].reverse().find((message) => message && message.role === "assistant" && message.text && !message.notice);
  const summary = latest?.text ? clipText(latest.text).slice(0, 500) : running ? "对方正在回复，稍后再用 read_reply 读取。" : "还没有新的回复。";
  return { target, running, lastSeq, summary, messages };
}

export async function externalMcpTool(engine: Engine, user: User, record: ExternalMcpRecord, name: string, args: Obj) {
  if (name === "list_targets") {
    const targets = await visibleTargets(engine, user, record);
    return { summary: targets.length ? `可以对话的对象有 ${targets.length} 个。` : "这条连接还没有可对话的对象。", targets };
  }
  if (name === "send_message") return await sendExternalMessage(engine, user, record, args);
  if (name === "read_reply") return await readExternalReply(engine, user, record, args);
  throw new TargetError(`未知工具「${name}」。可用：list_targets、send_message、read_reply。`, []);
}
