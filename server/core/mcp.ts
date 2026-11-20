import { createHmac, randomBytes } from "node:crypto";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport, StreamableHTTPError } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { ErrorCode, McpError, ToolListChangedNotificationSchema } from "@modelcontextprotocol/sdk/types.js";
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
type ToolList = Awaited<ReturnType<Client["listTools"]>>;
type Catalog = { page?: ToolList; pending?: Promise<ToolList>; refs: Map<string, string> };
type Page = { server: string; client: Client; catalog: Catalog; query: string; rows: Obj[]; remote?: string };
const timeout = (value: number, fallback: number) => Number.isSafeInteger(value) && value > 0 ? Math.min(120000, value) : fallback;
const connectTimeoutCodes = new Set(["UND_ERR_CONNECT_TIMEOUT"]);
const connectFailedCodes = new Set(["ECONNREFUSED", "EAI_AGAIN", "ENOTFOUND", "EHOSTUNREACH", "ENETUNREACH"]);
const transportCodes = new Set(["ECONNRESET", "ECONNABORTED", "EPIPE", "ETIMEDOUT", "UND_ERR_SOCKET", "UND_ERR_HEADERS_TIMEOUT", "UND_ERR_BODY_TIMEOUT"]);
function classify(error: any, aborted: boolean): { kind: string; status?: number; transient: boolean; unsent?: boolean; causeCode?: string } {
  if (aborted) return { kind: "cancelled", transient: false };
  if (error instanceof StreamableHTTPError && error.code && error.code >= 100 && error.code <= 599)
    return { kind: "http_status", status: error.code, transient: [408, 429, 500, 502, 503, 504].includes(error.code) };
  if (error?.name === "TimeoutError" || (error instanceof McpError && error.code === ErrorCode.RequestTimeout))
    return { kind: "timeout", transient: true };
  const code = typeof error?.cause?.code === "string" ? error.cause.code : typeof error?.code === "string" ? error.code : undefined;
  if (code && connectTimeoutCodes.has(code)) return { kind: "connect_timeout", transient: true, unsent: true, causeCode: code };
  if (code && connectFailedCodes.has(code)) return { kind: "connect_failed", transient: true, unsent: true, causeCode: code };
  if (error instanceof McpError && error.code === ErrorCode.ConnectionClosed)
    return { kind: "connection_lost", transient: true, causeCode: "ConnectionClosed" };
  if (code && transportCodes.has(code))
    return { kind: "connection_lost", transient: true, causeCode: code };
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
  private readonly catalogs = new WeakMap<Client, Catalog>();
  private readonly reviewKeys = new Map<string, Buffer>();
  // A ref proves this exact definition was returned on this session and server configuration; listing and guessing a call in the same batch is not enough.
  private definitionRef(server: string, fingerprint: string) {
    let key = this.reviewKeys.get(server);
    if (!key) this.reviewKeys.set(server, key = randomBytes(32));
    return createHmac("sha256", key).update(fingerprint).digest("base64url");
  }
  private review(server: string, client: Client, def: Obj, budget: number) {
    if (Buffer.byteLength(JSON.stringify(def)) > budget) return;
    const review = { definition: this.safe(def), definitionRef: this.definitionRef(server, definitionFingerprint(def)) };
    if (Buffer.byteLength(JSON.stringify(review)) <= budget) {
      this.bind(client, def.name, review.definitionRef);
      return review;
    }
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

  private readonly warmed = new Set<string>();
  /** Only warm a server explicitly named for MCP work, once per configured session. */
  async warmMentioned(text: string, signal?: AbortSignal) {
    if (!/\bmcp\b/i.test(text)) return;
    const name = Object.keys(this.config).find(key => this.config[key].enabled !== false && !this.warmed.has(key) &&
      new RegExp(`(?<![a-z0-9_.-])${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![a-z0-9_.-])`, "i").test(text));
    if (!name) return;
    this.warmed.add(name);
    try {
      await this.operation(name, "list", false, signal, (client, options) =>
        Promise.resolve(this.firstToolPage(client, this.catalog(client), options)));
    } catch { signal?.throwIfAborted(); } // Optional discovery; explicit list/describe still reports errors.
  }

  private isLocallyReadOnly(server: string, tool: string) {
    const allowlist = this.config[server]?.readOnlyTools;
    return Array.isArray(allowlist) && allowlist.includes(tool);
  }

  /** Request-only preview; never connect to an unused server from prompt preparation. */
  catalogPreview(readOnly: boolean) {
    const entries: Obj[] = [];
    let budget = 16 * 1024;
    for (const [name, client] of [...this.connections].sort(([a], [b]) => a.localeCompare(b))) {
      const catalog = this.catalogs.get(client);
      if (!catalog?.page) continue;
      const tools = [...catalog.page.tools].sort((a, b) => a.name.localeCompare(b.name));
      for (const tool of tools) {
        if (readOnly && !this.isLocallyReadOnly(name, tool.name)) continue;
        const review = this.review(name, client, tool, Math.min(budget, 12 * 1024));
        if (!review) continue;
        const entry = { server: this.text(name), tool: this.text(tool.name), ...review,
          definition: JSON.parse(definitionFingerprint(review.definition)) };
        const size = Buffer.byteLength(JSON.stringify(entry)) + 1;
        if (size > budget) continue;
        budget -= size;
        entries.push(entry);
      }
    }
    return entries;
  }

  private catalog(client: Client) {
    let state = this.catalogs.get(client);
    if (!state) this.catalogs.set(client, state = { refs: new Map() });
    return state;
  }

  private bind(client: Client, name: string, ref: string) {
    const refs = this.catalog(client).refs;
    refs.set(name, ref);
    // shortcut: evicted entries are rediscovered on demand, not authorized by name alone.
    if (refs.size > 1024) refs.delete(refs.keys().next().value!);
  }

  private invalidateCatalog(client: Client) {
    this.catalogs.delete(client);
    for (const [key, page] of this.pages) if (page.client === client) this.pages.delete(key);
  }

  private firstToolPage(client: Client, catalog: Catalog, options: Options) {
    options.signal.throwIfAborted();
    if (catalog.pending) return catalog.pending;
    if (catalog.page) return catalog.page;
    // shortcut: cache one upstream page (<=256 KiB); use ordinary discovery for later or oversized pages.
    return catalog.pending = client.listTools({}, options).then((result) => {
      if (this.catalogs.get(client) === catalog && !options.signal.aborted &&
          Buffer.byteLength(JSON.stringify(result)) <= 256 * 1024) {
        catalog.page = result;
      }
      return result;
    }).finally(() => { catalog.pending = undefined; });
  }

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
    client.setNotificationHandler(ToolListChangedNotificationSchema, () => { this.invalidateCatalog(client); });
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
    this.invalidateCatalog(client);
  }
  async close() {
    this.lifetime.abort();
    await Promise.allSettled([...this.connecting.values()]);
    const clients = [...this.connections.values()];
    this.connections.clear();
    this.described.clear();
    this.reviewKeys.clear();
    this.pages.clear();
    await Promise.all(clients.map((client) => client.close().catch(() => {})));
  }

  private async operation<T>(name: string, op: Operation, fresh: boolean, signal: AbortSignal | undefined, work: (client: Client, options: Options, step: Step) => Promise<T>, expected?: Client): Promise<T> {
    const started = Date.now(), cancel = signal ? AbortSignal.any([signal, this.lifetime.signal]) : this.lifetime.signal;
    const cfg = Object.hasOwn(this.config, name) ? this.config[name] : undefined;
    const failure = (message: string, kind: string, attempts: number, stage: Step["stage"], sent = false, status?: number, causeCode?: string) => new MCPFailure(message, {
      server: this.text(name), operation: op, stage, kind, status, ...(causeCode ? { causeCode } : {}), attempts, elapsedMs: Date.now() - started, sideEffectsPossible: sent, automaticRetryAllowed: false,
    });
    if (!cfg || cfg.enabled === false) throw failure("MCP server not enabled/configured; check the current employee's service list", "unknown_or_disabled", 0, "initialize");
    // Tenant MCP configuration must never expand host environment variables.
    if (cfg.url && Object.values(object(cfg.headers)).some((value) => typeof value === "string" &&
      [...value.matchAll(/\{env:([\w]+)\}|\$\{([\w]+)\}/g)].some((m) => this.cloud || !process.env[m[1] || m[2]])))
      throw failure(this.cloud ? "隔离部署的 HTTP MCP 不读取宿主环境变量；请在当前热心市民的 MCP 配置中保存请求头。"
        : "HTTP MCP 请求头引用了未配置的服务端环境变量；本步未连接。", "unresolved_environment", 0, "initialize");
    for (let attempt = 1; ; attempt++) {
      const step: Step = { stage: "initialize" };
      let client: Client | undefined, deadline: AbortSignal | undefined;
      try {
        cancel.throwIfAborted();
        client = (attempt === 1 && expected) || await this.connection(name, cancel);
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
        const retryable = (fresh && !step.cursor) || (!!issue.unsent && !step.cursor);
        if (attempt === 1 && cfg.url && retryable && issue.transient && !cancel.aborted) {
          await sleep(150, cancel).catch(() => {});
          if (!cancel.aborted) continue;
        }
        const kind = cancel.aborted ? "cancelled" : issue.kind;
        const detail = issue.status ? `HTTP ${issue.status}` : kind;
        const sent = !!step.sent && !issue.unsent;
        throw failure(`MCP ${step.stage} failed (${detail}); URL, headers and upstream error text withheld.` +
          (sent ? " The call may have executed; never retry automatically." : ""), kind, attempt, step.stage, sent, issue.status, issue.causeCode);
      }
    }
  }
  private async definition(client: Client, name: string, options: Options, step: Step, catalog?: Catalog) {
    let cursor: string | undefined;
    for (let page = 0; page < 32; page++) {
      step.cursor = !!cursor;
      const result = !cursor && catalog
        ? await this.firstToolPage(client, catalog, options)
        : await client.listTools({ cursor }, options);
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
      const { client, catalog, def, budgetExhausted } = await this.operation(name, "describe", true, signal, async (client, options, step) => {
        const catalog = this.catalog(client);
        const result = await this.definition(client, a.tool, options, step, catalog);
        options.signal.throwIfAborted();
        return { client, catalog, ...result };
      });
      assert(this.connections.get(name) === client, "MCP connection changed; describe again");
      assert(this.catalogs.get(client) === catalog, "MCP catalog changed during discovery; describe again");
      assert(def, (budgetExhausted ? "MCP tool not found within 32-page discovery budget" : "MCP tool not found on this server") + '; use op="list" with server and copy the exact tool name');
      let grants = this.described.get(name);
      if (!grants) this.described.set(name, grants = new Map());
      const fingerprint = definitionFingerprint(def);
      grants.set(a.tool, fingerprint);
      this.bind(client, a.tool, this.definitionRef(name, fingerprint));
      return this.safe(def);
    }
    if (a.op === "call") {
      assert(typeof a.tool === "string" && a.tool, "MCP tool name required");
      const grant = this.described.get(name)?.get(a.tool), connected = this.connections.get(name);
      const ref = a.definitionRef;
      assert(ref === undefined || (typeof ref === "string" && /^[A-Za-z0-9_-]{43}$/.test(ref)), "Invalid MCP definitionRef; copy it from the current discovery result");
      assert(grant || (ref && (connected || this.reviewKeys.has(name))), "MCP call requires successful describe or a definitionRef from list on the current configuration and connection; call was not executed");
      const locallyReadOnly = this.isLocallyReadOnly(name, a.tool);
      assert(!readOnly || locallyReadOnly, "Tool not in local read-only allowlist; annotations are not authorization");
      const started = Date.now();
      const blocked = (kind: string, reason: string) => new MCPFailure(`MCP ${reason}; describe again, call was not executed`, {
        server: this.text(name), operation: "call", stage: "revalidate", kind, attempts: 1,
        elapsedMs: Date.now() - started, sideEffectsPossible: false, automaticRetryAllowed: false,
      });
      const result = await this.operation(name, "call", false, signal, async (client, options, step) => {
        step.stage = "revalidate";
        const catalog = this.catalog(client);
        const reviewed = ref ?? this.definitionRef(name, grant!);
        const send = () => {
          options.signal.throwIfAborted();
          step.stage = "call";
          step.sent = true;
          return client.callTool({ name: a.tool, arguments: object(a.arguments) }, undefined, options);
        };
        // A reviewed binding belongs to this connection and this catalog generation, including proxy tools.
        if (catalog.refs.get(a.tool) === reviewed && (ref || this.described.get(name)?.get(a.tool) === grant)) return send();
        const { def, budgetExhausted } = await this.definition(client, a.tool, options, step, catalog);
        options.signal.throwIfAborted();
        if (this.connections.get(name) !== client) throw blocked("connection_changed", "connection changed");
        if (!ref && this.described.get(name)?.get(a.tool) !== grant) throw blocked("describe_changed", "describe record changed");
        if (this.catalogs.get(client) !== catalog) throw blocked("catalog_changed", "catalog changed during revalidation");
        if (!def) {
          throw budgetExhausted
            ? blocked("discovery_budget_exhausted", "tool not found within 32-page revalidation budget")
            : blocked("tool_not_found", "tool no longer listed by the server");
        }
        const fingerprint = definitionFingerprint(def);
        if (ref ? this.definitionRef(name, fingerprint) !== ref : fingerprint !== grant) {
          const error = blocked("definition_changed", "tool definition or its review reference changed");
          const review = this.review(name, client, def, 12 * 1024);
          if (review) {
            Object.assign(error.diagnostic, review);
            error.message = "MCP definition does not match the reviewed version; call was not executed. Review diagnostic.definition before any new call with diagnostic.definitionRef.";
          }
          throw error;
        }
        this.bind(client, a.tool, reviewed);
        return send();
      }, connected);
      return this.safe(result);
    }
    const limit = a.limit ?? 20;
    assert(Number.isInteger(limit) && limit >= 1 && limit <= 50, "MCP list limit is 1–50");
    const query = String(a.query || "").toLowerCase();
    const saved = a.cursor === undefined ? undefined : this.pages.get(a.cursor);
    assert(a.cursor === undefined || (saved && saved.server === name && saved.query === query && this.connections.get(name) === saved.client), "Invalid or expired MCP discovery cursor; start a fresh list");
    const page = await this.operation(name, "list", !saved, signal, async (client, options) => {
      if (!saved && !this.catalog(client).pending) this.invalidateCatalog(client);
      const page: Page = saved || { server: name, client, catalog: this.catalog(client), query, rows: [] };
      assert(client === page.client, "MCP connection changed");
      if (!page.rows.length) {
        const result = saved ? await client.listTools({ cursor: page.remote }, options)
          : await this.firstToolPage(client, page.catalog, options);
        options.signal.throwIfAborted();
        assert(this.connections.get(name) === client && this.catalogs.get(client) === page.catalog,
          "MCP catalog changed during discovery; start a fresh list");
        page.remote = result.nextCursor;
        const matches = result.tools.filter((tool) => !query || (tool.name + " " + tool.description).toLowerCase().includes(query));
        page.rows = matches.map((tool) => ({ name: this.text(tool.name), description: clip(this.text(tool.description || ""), 300) }));
        // Fit more directly callable definitions without changing list order or letting later rows crowd out this page.
        let budget = 16 * 1024;
        const candidates = matches.map((tool, index) => ({ tool, index, size: Buffer.byteLength(JSON.stringify(tool)) }))
          .sort((a, b) => Number(a.index >= limit) - Number(b.index >= limit) || a.size - b.size);
        for (const { tool, index, size } of candidates) {
          const cap = Math.min(budget, 12 * 1024);
          if (size > cap) continue;
          const review = this.review(name, client, tool, cap);
          if (!review) continue;
          budget -= Buffer.byteLength(JSON.stringify(review));
          Object.assign(page.rows[index], review);
        }
      }
      return page;
    }, saved?.client);
    assert(this.connections.get(name) === page.client && this.catalogs.get(page.client) === page.catalog,
      "MCP catalog changed during discovery; start a fresh list");
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
