import { lookup } from "node:dns/promises";
import { request as httpRequest, validateHeaderName, validateHeaderValue } from "node:http";
import { request as httpsRequest } from "node:https";
import { BlockList, isIP } from "node:net";
import { check, type User } from "./auth";
import type { Store } from "./store";
import type { Vault } from "./vault";
import { httpURL, id, type Obj } from "./util";

const MAX_TRIGGERS = 20, MAX_PENDING = 100, MAX_IN_FLIGHT = 100;
const kind = (userId: string) => "trigger:user:" + userId;
type Secret = { url: string; headers: string; body: string; siteOrigin?: string };
type TriggerScope = { employees: string[]; groups: string[] };
type Trigger = { id: string; name: string; enabled: boolean; condition: "employee_message"; action: "http"; scope?: TriggerScope; secret: string; updatedAt: number; lastAt?: number; lastResult?: string };
export type EmployeeMessage = { employeeId: string; employeeName: string; message: string; groupName: string; groupId?: string; taskIds?: string[] };

// Only public destinations: validate every resolved address and pin the actual connection to one of them.
const blocked = new BlockList();
for (const [address, bits] of [["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.88.99.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15], ["198.51.100.0", 24], ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4]] as [string, number][]) blocked.addSubnet(address, bits, "ipv4");
for (const [address, bits] of [["2001::", 23], ["2001:db8::", 32], ["2002::", 16], ["3fff::", 20]] as [string, number][]) blocked.addSubnet(address, bits, "ipv6");
const globalIPv6 = new BlockList();
globalIPv6.addSubnet("2000::", 3, "ipv6");
export function publicAddress(address: string) {
  const family = isIP(address);
  return family === 4 ? !blocked.check(address, "ipv4") : family === 6 && globalIPv6.check(address, "ipv6") && !blocked.check(address, "ipv6");
}
function endpoint(value: unknown) {
  check(typeof value === "string" && value.trim().length > 0 && value.length <= 4096, 400, "请填写 4096 字符以内的 HTTP(S) 接口地址");
  let url: URL;
  try { url = httpURL(value.trim()); } catch { throw Error("接口地址必须是不能包含账号密码的 HTTP(S) 地址"); }
  check(!url.hash, 400, "接口地址不能包含片段标识");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  check(!isIP(host) || publicAddress(host), 400, "接口地址不能指向本机、内网或保留地址");
  return url;
}
function headersOf(raw: string) {
  let value: unknown;
  try { value = JSON.parse(raw || "{}"); } catch { throw Error("请求头必须是 JSON 对象"); }
  check(value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length <= 30, 400, "请求头必须是最多 30 项的 JSON 对象");
  const headers: Record<string, string> = {};
  for (const [name, content] of Object.entries(value)) {
    check(typeof content === "string" && content.length <= 8192 && !/^(host|content-length|transfer-encoding|connection|proxy-authorization)$/i.test(name), 400, "请求头名称或内容无效");
    try { validateHeaderName(name); validateHeaderValue(name, content); } catch { throw Error("请求头名称或内容无效"); }
    headers[name] = content;
  }
  return headers;
}
function bodyOf(template: string, event: EmployeeMessage, siteOrigin = "") {
  const taskLinks = siteOrigin ? [...new Set(event.taskIds || [])].map((taskId) => `${siteOrigin}/employees/${encodeURIComponent(event.employeeId)}/tasks/${encodeURIComponent(taskId)}`).join("\n") : "";
  const values: Record<string, string> = { message: event.message, employeeName: event.employeeName, employeeId: event.employeeId, groupName: event.groupName, taskLinks };
  const text = template.replace(/\{\{(message|employeeName|employeeId|groupName|taskLinks)\}\}/g, (_, name: string) => JSON.stringify(values[name]).slice(1, -1));
  try { JSON.parse(text); } catch { throw Error("请求体必须是有效 JSON，变量须放在 JSON 字符串内"); }
  check(Buffer.byteLength(text) <= 256 * 1024, 400, "请求体超过 256 KiB");
  return text;
}

/** One POST, no redirects or automatic retry. Never return the URL or response body in an error. */
export async function postTrigger(raw: string, headers: Record<string, string>, body: string) {
  const url = endpoint(raw), host = url.hostname.replace(/^\[|\]$/g, ""), signal = AbortSignal.timeout(10000);
  const addresses = isIP(host) ? [{ address: host, family: isIP(host) }] : await Promise.race([
    lookup(host, { all: true, verbatim: true }),
    new Promise<never>((_, reject) => signal.addEventListener("abort", () => reject(Error("接口请求超时")), { once: true })),
  ]);
  check(addresses.length && addresses.every((entry) => publicAddress(entry.address)), 400, "接口解析到本机、内网或保留地址，已阻止调用");
  const chosen = addresses[0];
  return await new Promise<void>((resolve, reject) => {
    const req = (url.protocol === "https:" ? httpsRequest : httpRequest)(url, {
      method: "POST", signal, agent: false,
      headers: { "Content-Type": "application/json", ...headers },
      lookup: ((_host: string, options: any, callback: any) => options.all ? callback(null, [chosen]) : callback(null, chosen.address, chosen.family)) as any,
    }, (response) => {
      const chunks: Buffer[] = [];
      let size = 0;
      response.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size > 4096) response.destroy(Error("接口响应超过 4 KiB"));
        else chunks.push(chunk);
      });
      response.on("error", reject);
      response.on("end", () => {
        if (!response.statusCode || response.statusCode < 200 || response.statusCode >= 300) return reject(Error("接口返回 HTTP " + response.statusCode));
        if (url.hostname === "qyapi.weixin.qq.com" && url.pathname === "/cgi-bin/webhook/send") {
          try {
            const result = JSON.parse(Buffer.concat(chunks).toString());
            if (result.errcode !== 0) return reject(Error("企业微信机器人返回错误码 " + String(result.errcode).slice(0, 30)));
          } catch { return reject(Error("企业微信机器人响应无效")); }
        }
        resolve();
      });
    });
    req.on("error", reject);
    req.end(body);
  });
}

export class Triggers {
  pending = new Set<Promise<void>>();
  dropped = new Map<string, number>();
  private inFlight = 0;
  post = postTrigger;
  constructor(private store: Store, private vault: Vault, private canScope: (userId: string, scope: TriggerScope) => Promise<boolean>) {}
  private aad(userId: string, key: string) { return "trigger:" + userId + ":" + key; }
  private async owned(userId: string, key: string) {
    const record = await this.store.object<Trigger>(kind(userId), key);
    check(record, 404, "触发器不存在");
    return record;
  }
  private async view(userId: string, record: Trigger) {
    const secret: Secret = await this.vault.openObject(record.secret, this.aad(userId, record.id));
    const { secret: _secret, ...visible } = record;
    return { ...visible, url: secret.url, body: secret.body, hasUrl: !!secret.url, hasHeaders: secret.headers !== "{}" };
  }
  async list(userId: string) {
    return await Promise.all((await this.store.objects<Trigger>(kind(userId))).map((record) => this.view(userId, record)));
  }
  async save(userId: string, input: Obj, siteOrigin = "") {
    return await this.store.transaction(async () => {
      const old = input.id ? await this.owned(userId, String(input.id)) : undefined;
      check(old || (await this.store.objects(kind(userId))).length < MAX_TRIGGERS, 400, "最多创建 20 个触发器");
      check(typeof input.name === "string" && input.name.trim() && input.name.length <= 80 && !/[\x00-\x1f]/.test(input.name), 400, "名称需要 1–80 字，不能换行");
      check(input.condition === "employee_message" && input.action === "http" && typeof input.enabled === "boolean", 400, "触发条件或动作无效");
      const selected = input.scope === undefined ? old?.scope : input.scope;
      let scope: TriggerScope | undefined;
      if (selected != null) {
        check(typeof selected === "object" && !Array.isArray(selected), 400, "触发范围无效");
        const validIds = (values: unknown, max: number) => Array.isArray(values) && values.length <= max && values.every((value) => typeof value === "string" && value.length > 0 && value.length <= 128);
        check(validIds(selected.employees, 50) && validIds(selected.groups, 100), 400, "触发范围无效");
        scope = { employees: [...new Set(selected.employees as string[])], groups: [...new Set(selected.groups as string[])] };
        check(scope.employees.length || scope.groups.length, 400, "请至少选择一位热心市民或一个群聊");
        if (input.scope !== undefined) check(await this.canScope(userId, scope), 400, "只能选择你名下的热心市民或已加入的群聊");
      }
      const previous: Secret | undefined = old && await this.vault.openObject(old.secret, this.aad(userId, old.id));
      check(input.url === undefined || typeof input.url === "string", 400, "接口地址无效");
      check(input.headers === undefined || (typeof input.headers === "string" && input.headers.length <= 16000), 400, "请求头过长");
      check(typeof input.body === "string" && input.body.length <= 16000, 400, "请求体需要 JSON，最多 16000 字符");
      const secret = { url: input.url?.trim() || previous?.url || "", headers: input.headers?.trim() || previous?.headers || "{}", body: input.body, siteOrigin: siteOrigin ? httpURL(siteOrigin, true).origin : previous?.siteOrigin || "" };
      endpoint(secret.url);
      headersOf(secret.headers);
      bodyOf(secret.body, { message: '消息"\n\\', employeeName: "热心市民", employeeId: "id", groupName: "群聊" });
      const key = old?.id || id("tr"), record: Trigger = { ...old, id: key, name: input.name.trim(), enabled: input.enabled, condition: "employee_message", action: "http", scope, secret: await this.vault.sealObject(secret, this.aad(userId, key)), updatedAt: Date.now() };
      await this.store.save(kind(userId), key, record);
      return await this.view(userId, record);
    });
  }
  async setEnabled(userId: string, key: string, enabled: unknown) {
    check(typeof enabled === "boolean", 400, "请选择启用或停用");
    await this.store.transaction(async () => {
      const record = await this.owned(userId, key);
      await this.store.save(kind(userId), key, { ...record, enabled, updatedAt: Date.now() });
    });
  }
  async remove(userId: string, key: string) {
    await this.store.transaction(async () => { await this.owned(userId, key); await this.store.remove(kind(userId), key); });
  }
  /** Best effort after commit; never delay a chat or replay a possibly executed webhook. */
  fire(userId: string, event: EmployeeMessage) {
    if (this.pending.size >= MAX_PENDING) {
      this.dropped.set(userId, Date.now());
      if (this.dropped.size > 1000) this.dropped.delete(this.dropped.keys().next().value!);
      return;
    }
    const job = this.deliver(userId, event).catch(() => {});
    this.pending.add(job);
    void job.finally(() => this.pending.delete(job));
  }
  private async deliver(userId: string, event: EmployeeMessage) {
    const account = await this.store.one("SELECT disabled,role FROM web_users WHERE id=?", userId);
    if (!account || account.disabled || account.role === "viewer") return;
    const entries = (await this.store.objects<Trigger>(kind(userId))).filter((item) => item.enabled && (!item.scope || item.scope.employees.includes(event.employeeId) || (!!event.groupId && item.scope.groups.includes(event.groupId))));
    await Promise.all(entries.map(async (entry) => {
      let result = "成功";
      if (this.inFlight >= MAX_IN_FLIGHT) result = "接口调用过多，本次跳过";
      else {
        this.inFlight++;
        try {
          const secret: Secret = await this.vault.openObject(entry.secret, this.aad(userId, entry.id));
          await this.post(secret.url, headersOf(secret.headers), bodyOf(secret.body, event, secret.siteOrigin));
        } catch (error: any) {
          // DNS/network exceptions can contain the secret URL: persist only vetted error categories.
          const message = String(error?.message || "");
          result = /^(接口返回 HTTP \d+|企业微信机器人返回错误码 \d+|企业微信机器人响应无效|接口响应超过 4 KiB|接口请求超时|接口解析到本机、内网或保留地址，已阻止调用|请求体超过 256 KiB)$/.test(message) ? message : "接口调用失败，请检查地址、网络和请求配置";
        } finally { this.inFlight--; }
      }
      await this.store.transaction(async () => {
        const current = await this.store.object<Trigger>(kind(userId), entry.id);
        if (current && current.updatedAt === entry.updatedAt && current.secret === entry.secret && current.enabled === entry.enabled) await this.store.save(kind(userId), entry.id, { ...current, lastAt: Date.now(), lastResult: result });
      });
    }));
  }
}

export async function triggersApi(triggers: Triggers, user: User, method: string, path: string[], input: Obj, siteOrigin = "") {
  check(user.role !== "viewer", 403, "只读账号不能配置触发器");
  if (!path.length && method === "GET") return { triggers: await triggers.list(user.id), droppedAt: triggers.dropped.get(user.id) || null };
  if (!path.length && method === "POST") return { trigger: await triggers.save(user.id, input, siteOrigin) };
  if (path.length === 1 && method === "PATCH") { await triggers.setEnabled(user.id, path[0], input.enabled); return { ok: true }; }
  if (path.length === 1 && method === "DELETE") { await triggers.remove(user.id, path[0]); return { ok: true }; }
  check(false, 404, "触发器接口不存在");
}
