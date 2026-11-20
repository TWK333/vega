import { createHmac, randomBytes } from "node:crypto";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport, StreamableHTTPError } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { assert, expand, id, object, clip, sleep, type Obj } from "./util";
import type { CloudRuntime } from "./cloud";

type Operation = "list" | "describe" | "call";
type Step = { stage: "initialize" | "revalidate" | Operation; cursor?: boolean; sent?: boolean };

// TAPD emits this catalog in varying order; compare its entries, not their positions.
const normalizeTapdCatalog = (description: string) => description.replace(
  /^(\*\*所有可用工具：\*\*\n)((?:  - [a-z0-9_]+: [^\r\n]+\n)+)(?=\n\*\*返回内容\*\*：)/m,
  (section, heading: string, catalog: string) => {
    const rows = catalog.slice(0, -1).split("\n");
    if (new Set(rows.map((row) => row.slice(4, row.indexOf(":")))).size !== rows.length) return section;
    return heading + rows.sort().join("\n") + "\n";
  },
);

// Compare the original wire definition, preserving array order and all other description text.
const definitionFingerprint = (definition: Obj) => JSON.stringify(
  definition.name === "lookup_tool_param_schema" && typeof definition.description === "string"
    ? { ...definition, description: normalizeTapdCatalog(definition.description) }
    : definition,
  (_, value) => value && typeof value === "object" && !Array.isArray(value)
    ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, value[key]]))
    : value,
);
type Options = { timeout: number; signal: AbortSignal };
type Page = { server: string; client: Client; query: string; rows: Obj[]; remote?: string };
const timeout = (value: number, fallback: number) => Number.isSafeInteger(value) && value > 0 ? Math.min(120000, value) : fallback;
const transportCodes = new Set(["ECONNRESET", "ECONNREFUSED", "ECONNABORTED", "EPIPE", "EAI_AGAIN", "ETIMEDOUT", "UND_ERR_SOCKET", "UND_ERR_CONNECT_TIMEOUT", "UND_ERR_HEADERS_TIMEOUT", "UND_ERR_BODY_TIMEOUT"]);
function classify(error: any, aborted: boolean) {
  if (aborted) return { kind: "cancelled", transient: false };
  if (error instanceof StreamableHTTPError && error.code && error.code >= 100 && error.code <= 599)
    return { kind: "http_status", status: error.code, transient: [408, 429, 500, 502, 503, 504].includes(error.code) };
  if (error?.name === "TimeoutError" || (error instanceof McpError && error.code === ErrorCode.RequestTimeout))
    return { kind: "timeout", transient: true };
  if ((error instanceof McpError && error.code === ErrorCode.ConnectionClosed) || transportCodes.has(error?.cause?.code || error?.code))
    return { kind: "connection_lost", transient: true };
  return { kind: error instanceof McpError ? "rpc_error" : "invalid_response_or_configuration", transient: false };
}

export class MCPFailure extends Error {
  constructor(message: string, readonly diagnostic: Obj) { super(message); }
}

export class MCP {
  readonly connections = new Map<string, Client>();
  private readonly connecting = new Map<string, Promise<Client>>();
  readonly described = new Map<string, Map<string, string>>();
  private readonly pages = new Map<string, Page>();
  private readonly reviewKeys = new WeakMap<Client, Buffer>();
  // A ref proves this exact definition was returned on this connection; listing and guessing a call in the same batch is not enough.
  private definitionRef(client: Client, fingerprint: string) {
    let key = this.reviewKeys.get(client);
    if (!key) this.reviewKeys.set(client, key = randomBytes(32));
    return createHmac("sha256", key).update(fingerprint).digest("base64url");
  }
  private review(client: Client, def: Obj, budget: number) {
    if (Buffer.byteLength(JSON.stringify(def)) > budget) return;
    const review = { definition: this.safe(def), definitionRef: this.definitionRef(client, definitionFingerprint(def)) };
    if (Buffer.byteLength(JSON.stringify(review)) <= budget) return review;
  }
  private readonly lifetime = new AbortController();
  private readonly mask?: RegExp;
  constructor(
    private readonly config: Record<string, Obj> = {},
    private readonly cwd: string,
    private readonly cloud?: CloudRuntime,
  ) {
    const secrets = new Set<string>();
    for (const cfg of Object.values(config)) {
      // URL query values can serve as credentials too; diagnostics never quote the endpoint itself.
      const url = typeof cfg.url === "string" ? URL.parse(cfg.url) : null;
      if (url) for (const value of url.searchParams.values()) if (value) secrets.add(value);
      for (const fields of [cfg.headers, cfg.env]) {
        for (const [key, template] of Object.entries(object(fields))) {
          if (typeof template !== "string") continue;
          const envValues = this.cloud ? [] : [...template.matchAll(/\{env:([\w]+)\}|\$\{([\w]+)\}/g)].map((m) => process.env[m[1] || m[2]] || "");
          for (const value of this.cloud ? [template] : [template, expand(template), ...envValues]) {
            if (value) secrets.add(value);
            if (/^(?:proxy-)?authorization$/i.test(key)) {
              const bare = value.trim().match(/^\S+\s+(.+)$/)?.[1];
              if (bare) secrets.add(bare);
            }
            if (/^cookie$/i.test(key)) for (const item of value.split(";")) {
              const equals = item.indexOf("=");
              if (equals >= 0 && item.slice(equals + 1).trim()) secrets.add(item.slice(equals + 1).trim());
            }
          }
        }
      }
    }
    if (secrets.size) this.mask = new RegExp([...secrets].sort((a, b) => b.length - a.length)
      .map((value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"), "g");
  }

  private text(value: string) { return this.mask ? value.replace(this.mask, "[credential redacted]") : value; }
  private safe<T>(value: T): T {
    if (typeof value === "string") return this.text(value) as T;
    if (Array.isArray(value)) return value.map((item) => this.safe(item)) as T;
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [this.text(key), this.safe(item)])) as T;
    return value;
  }

  serviceNames() { return Object.keys(this.config).filter((name) => this.config[name].enabled !== false).map((name) => this.text(name)); }

  private connection(name: string, signal: AbortSignal) {
    let pending = this.connecting.get(name);
    if (!pending) {
      pending = this.connect(name, signal);
      this.connecting.set(name, pending);
      void pending.finally(() => { if (this.connecting.get(name) === pending) this.connecting.delete(name); }).catch(() => {});
    }
    return pending;
  }
  private async connect(name: string, signal: AbortSignal) {
    signal.throwIfAborted();
    const current = this.connections.get(name);
    if (current) return current;
    const cfg = this.config[name], ms = timeout(cfg.startupTimeoutMs, 10000);
    const startup = AbortSignal.any([signal, AbortSignal.timeout(ms)]);
    const client = new Client({ name: "vega", version: "0.2.0" }, { capabilities: {} });
    const expanded = (values: Obj) => Object.fromEntries(Object.entries(values || {}).map(([key, value]) => [key, this.cloud ? String(value) : expand(String(value))]));
    const launch = !cfg.url && this.cloud?.launch(cfg.command, cfg.args || [], cfg.cwd || this.cwd || (await this.cloud.identity()).cwd, expanded(cfg.env));
    startup.throwIfAborted();
    const transport = cfg.url
      ? new StreamableHTTPClientTransport(new URL(cfg.url), {
          requestInit: { headers: expanded(cfg.headers), redirect: "manual" },
          reconnectionOptions: { maxRetries: 0, initialReconnectionDelay: 1000, maxReconnectionDelay: 1000, reconnectionDelayGrowFactor: 1 },
        })
      : new StdioClientTransport({
          ...(launch || { command: cfg.command, args: cfg.args || [], cwd: cfg.cwd || this.cwd, env: { ...process.env, ...expanded(cfg.env) } as Record<string, string> }),
          // The server's arbitrary stderr is not a diagnostic safe to publish.
          stderr: "ignore",
        });
    const abort = () => { void transport.close().catch(() => {}); };
    startup.addEventListener("abort", abort, { once: true });
    try {
      await client.connect(transport, { timeout: ms, signal: startup });
      startup.throwIfAborted();
      this.connections.set(name, client);
      client.onclose = () => this.forget(name, client);
      return client;
    } catch (error) {
      await client.close().catch(() => {});
      startup.throwIfAborted();
      throw error;
    } finally { startup.removeEventListener("abort", abort); }
  }
  private forget(name: string, client: Client) {
    if (this.connections.get(name) !== client) return;
    this.connections.delete(name);
    this.described.delete(name);
    for (const [key, page] of this.pages) if (page.client === client) this.pages.delete(key);
  }
  async close() {
    this.lifetime.abort();
    await Promise.allSettled([...this.connecting.values()]);
    const clients = [...this.connections.values()];
    this.connections.clear();
    this.described.clear();
    this.pages.clear();
    await Promise.all(clients.map((client) => client.close().catch(() => {})));
  }

  private async operation<T>(name: string, op: Operation, fresh: boolean, signal: AbortSignal | undefined, work: (client: Client, options: Options, step: Step) => Promise<T>, expected?: Client): Promise<T> {
    const started = Date.now(), cancel = signal ? AbortSignal.any([signal, this.lifetime.signal]) : this.lifetime.signal;
    const cfg = Object.hasOwn(this.config, name) ? this.config[name] : undefined;
    const failure = (message: string, kind: string, attempts: number, stage: Step["stage"], sent = false, status?: number) => new MCPFailure(message, {
      server: this.text(name), operation: op, stage, kind, status, attempts, elapsedMs: Date.now() - started, sideEffectsPossible: sent, automaticRetryAllowed: false,
    });
    if (!cfg || cfg.enabled === false) throw failure("MCP server not enabled/configured; check the current employee's service list", "unknown_or_disabled", 0, "initialize");
    // Tenant MCP configuration must never expand host environment variables.
    if (cfg.url && Object.values(object(cfg.headers)).some((value) => typeof value === "string" &&
      [...value.matchAll(/\{env:([\w]+)\}|\$\{([\w]+)\}/g)].some((m) => this.cloud || !process.env[m[1] || m[2]])))
      throw failure(this.cloud ? "隔离部署的 HTTP MCP 不读取宿主环境变量；请在当前牛马的 MCP 配置中保存请求头。"
        : "HTTP MCP 请求头引用了未配置的服务端环境变量；本步未连接。", "unresolved_environment", 0, "initialize");
    for (let attempt = 1; ; attempt++) {
      const step: Step = { stage: "initialize" };
      let client: Client | undefined, deadline: AbortSignal | undefined;
      try {
        cancel.throwIfAborted();
        client = expected || await this.connection(name, cancel);
        step.stage = op;
        if (this.connections.get(name) !== client) throw new McpError(ErrorCode.ConnectionClosed, "MCP connection expired");
        const ms = timeout(cfg.requestTimeoutMs, 30000);
        deadline = AbortSignal.timeout(ms);
        return await work(client, { timeout: ms, signal: AbortSignal.any([cancel, deadline]) }, step);
      } catch (error) {
        if (error instanceof MCPFailure) throw error;
        const issue = classify(deadline?.aborted ? deadline.reason : error, cancel.aborted);
        if (client && (issue.transient || cancel.aborted || issue.status === 404)) {
          this.forget(name, client);
          void client.close().catch(() => {});
        }
        if (attempt === 1 && cfg.url && fresh && !step.cursor && issue.transient && !cancel.aborted) {
          await sleep(150, cancel).catch(() => {});
          if (!cancel.aborted) continue;
        }
        const kind = cancel.aborted ? "cancelled" : issue.kind;
        const detail = issue.status ? `HTTP ${issue.status}` : kind;
        throw failure(`MCP ${step.stage} failed (${detail}); URL, headers and upstream error text withheld.` +
          (step.sent ? " The call may have executed; never retry automatically." : ""), kind, attempt, step.stage, step.sent, issue.status);
      }
    }
  }
  private async definition(client: Client, name: string, options: Options, step: Step) {
    let cursor: string | undefined;
    for (let page = 0; page < 32; page++) {
      step.cursor = !!cursor;
      const result = await client.listTools({ cursor }, options);
      const def = result.tools.find((tool) => tool.name === name);
      if (def) return { def, budgetExhausted: false };
      cursor = result.nextCursor;
      if (!cursor) break;
    }
    return { def: undefined, budgetExhausted: !!cursor };
  }

  async execute(a: Obj, readOnly = false, signal?: AbortSignal): Promise<any> {
    assert(["list", "describe", "call"].includes(a.op), "MCP op must be list/describe/call");
    if (a.op === "list" && !a.server) {
      assert(a.cursor === undefined, "Invalid MCP discovery cursor");
      return { servers: await Promise.all(Object.keys(this.config).map(async (name) => {
        try {
          await this.operation(name, "list", true, signal, async () => {});
          return { name: this.text(name), available: true };
        } catch (error) {
          if (!(error instanceof MCPFailure)) throw error;
          return { name: this.text(name), available: false, error: error.message, diagnostic: error.diagnostic };
        }
      })) };
    }
    const name = a.server;
    assert(typeof name === "string" && name, "MCP server name required");
    if (a.op === "describe") {
      assert(typeof a.tool === "string" && a.tool, 'MCP tool name required; use op="list" with server to discover tool names');
      const { client, def, budgetExhausted } = await this.operation(name, "describe", true, signal, async (client, options, step) => ({ client, ...await this.definition(client, a.tool, options, step) }));
      assert(def, (budgetExhausted ? "MCP tool not found within 32-page discovery budget" : "MCP tool not found on this server") + '; use op="list" with server and copy the exact tool name');
      assert(this.connections.get(name) === client, "MCP connection changed; describe again");
      let grants = this.described.get(name);
      if (!grants) this.described.set(name, grants = new Map());
      grants.set(a.tool, definitionFingerprint(def));
      return this.safe(def);
    }
    if (a.op === "call") {
      assert(typeof a.tool === "string" && a.tool, "MCP tool name required");
      const grant = this.described.get(name)?.get(a.tool), connected = this.connections.get(name);
      const ref = a.definitionRef;
      assert(ref === undefined || (typeof ref === "string" && /^[A-Za-z0-9_-]{43}$/.test(ref)), "Invalid MCP definitionRef; copy it from the current discovery result");
      assert(connected && (ref || grant), "MCP call requires successful describe or a definitionRef from list on the current configuration and connection; call was not executed");
      const allowlist = this.config[name].readOnlyTools;
      assert(!readOnly || (Array.isArray(allowlist) && allowlist.includes(a.tool)), "Tool not in local read-only allowlist; annotations are not authorization");
      const started = Date.now();
      const blocked = (kind: string, reason: string) => new MCPFailure(`MCP ${reason}; describe again, call was not executed`, {
        server: this.text(name), operation: "call", stage: "revalidate", kind, attempts: 1,
        elapsedMs: Date.now() - started, sideEffectsPossible: false, automaticRetryAllowed: false,
      });
      const result = await this.operation(name, "call", false, signal, async (client, options, step) => {
        step.stage = "revalidate";
        const { def, budgetExhausted } = await this.definition(client, a.tool, options, step);
        options.signal.throwIfAborted();
        if (this.connections.get(name) !== client) throw blocked("connection_changed", "connection changed");
        if (!ref && this.described.get(name)?.get(a.tool) !== grant) throw blocked("describe_changed", "describe record changed");
        if (!def) throw budgetExhausted
          ? blocked("discovery_budget_exhausted", "tool not found within 32-page revalidation budget")
          : blocked("tool_not_found", "tool no longer listed by the server");
        const fingerprint = definitionFingerprint(def);
        if (ref ? this.definitionRef(client, fingerprint) !== ref : fingerprint !== grant) {
          const error = blocked("definition_changed", "tool definition or its review reference changed");
          const review = this.review(client, def, 12 * 1024);
          if (review) {
            Object.assign(error.diagnostic, review);
            error.message = "MCP definition does not match the reviewed version; call was not executed. Review diagnostic.definition before any new call with diagnostic.definitionRef.";
          }
          throw error;
        }
        step.stage = "call";
        step.sent = true;
        return await client.callTool({ name: a.tool, arguments: object(a.arguments) }, undefined, options);
      }, connected);
      return this.safe(result);
    }
    const limit = a.limit ?? 20;
    assert(Number.isInteger(limit) && limit >= 1 && limit <= 50, "MCP list limit is 1–50");
    const query = String(a.query || "").toLowerCase();
    const saved = a.cursor === undefined ? undefined : this.pages.get(a.cursor);
    assert(a.cursor === undefined || (saved && saved.server === name && saved.query === query && this.connections.get(name) === saved.client), "Invalid or expired MCP discovery cursor; start a fresh list");
    const page = await this.operation(name, "list", !saved, signal, async (client, options) => {
      const page: Page = saved || { server: name, client, query, rows: [] };
      assert(client === page.client, "MCP connection changed");
      if (!page.rows.length) {
        const result = await client.listTools({ cursor: page.remote }, options);
        page.remote = result.nextCursor;
        // Bound inline schemas per remote page, including the rows held for local pagination.
        let budget = 16 * 1024;
        page.rows = result.tools.filter((tool) => !query || (tool.name + " " + tool.description).toLowerCase().includes(query))
          .map((tool) => {
            const review = this.review(client, tool, Math.min(budget, 12 * 1024));
            if (review) budget -= Buffer.byteLength(JSON.stringify(review));
            return { name: this.text(tool.name), description: clip(this.text(tool.description || ""), 300), ...review };
          });
      }
      return page;
    }, saved?.client);
    if (saved) this.pages.delete(a.cursor);
    const tools = page.rows.splice(0, limit);
    const nextCursor = page.rows.length || page.remote ? id() : undefined;
    if (nextCursor && this.connections.get(name) === page.client) {
      // shortcut: retain at most 128 discovery cursors per session; use a fresh list after expiry.
      if (this.pages.size >= 128) this.pages.delete(this.pages.keys().next().value!);
      this.pages.set(nextCursor, page);
    }
    return { tools, nextCursor, moreAvailable: !!nextCursor };
  }
}
