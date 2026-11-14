import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { AuthError, type Auth } from "./auth";
import type { Engine } from "./engine";
import {
  authenticateExternalMcp,
  EXTERNAL_MCP_REJECTED,
  externalMcpTool,
  TargetError,
  tokenFromHeaders,
} from "./external-mcp";
import type { Obj } from "./util";

const MAX_BODY = 256 * 1024;
const INSTRUCTIONS = [
  "这是 Vega 的对外 MCP。你只能和这条连接已经绑定的牛马、群聊对话。",
  "用户说「给老张说做这个」时，调用 send_message，把「做这个」发给名为「老张」的对象（target 填名称或 id，message 填要说的话；也可以把整句放进 text）。",
  "只绑定了一个对象时，不写名字的消息会发给那一个。",
  "名字对不上，或有多个同名对象时，把候选告诉用户，不要改发给别人，也不要猜未绑定的牛马或群聊。",
  "send_message 只负责送达。接着用 read_reply，带上返回的 afterSeq，查看回复和是否仍在进行；running 为 true 时稍后再读。",
  "不能修改牛马设置、密码本、系统设置，也不能改这条连接绑定了谁。",
].join("");
const TOOLS = [
  {
    name: "list_targets",
    description: "列出这条连接可以对话的牛马和群聊（id、名称、类型）。未绑定的对象不会出现。",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "send_message",
    description: "把一句话发给绑定的牛马或群聊，并走该用户原来的对话。用户说「给老张说做这个」时，把「做这个」发给「老张」：target 填「老张」或它的 id，message 填「做这个」；或者只填 text 为「给老张说做这个」。只绑定一个对象时可以不填 target。找不到或有多个同名对象时会返回候选，不要自行改发给别人。",
    inputSchema: {
      type: "object",
      properties: {
        target: { type: "string", description: "牛马或群聊的显示名或 id。只绑定一个对象时可以省略。" },
        message: { type: "string", description: "要送达的内容。未填 target 时也可以是整句「给某人说……」。" },
        text: { type: "string", description: "与 message 相同，二选一。" },
      },
    },
  },
  {
    name: "read_reply",
    description: "读取发给某个绑定对象之后的回复和当前状态。target 为名称或 id；afterSeq 用 send_message 返回的 afterSeq。running 为 true 表示还在回复。",
    inputSchema: {
      type: "object",
      properties: {
        target: { type: "string", description: "牛马或群聊的显示名或 id。只绑定一个对象时可以省略。" },
        afterSeq: { type: "integer", minimum: 0, description: "只返回该序号之后的消息。用 send_message 返回的 afterSeq。" },
      },
    },
  },
];

export type ExternalMcpHttpDeps = { engine: Engine; auth: Auth; configId: string };

function rpcError(status: number, code: number, message: string) {
  return new Response(JSON.stringify({ jsonrpc: "2.0", id: null, error: { code, message } }), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}
function toolResult(value: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] };
}
function toolFailure(error: unknown) {
  const message = error instanceof Error ? error.message : "请求失败";
  const candidates = error instanceof TargetError ? error.candidates : undefined;
  return { isError: true, content: [{ type: "text" as const, text: JSON.stringify({ error: message.slice(0, 1000), ...(candidates ? { candidates } : {}) }) }] };
}

/** Streamable HTTP, stateless JSON responses. Each request carries the config token; no session cookie. */
export async function externalMcpResponse(request: Request, deps: ExternalMcpHttpDeps) {
  const token = tokenFromHeaders(request.headers);
  const record = await authenticateExternalMcp(deps.engine.store, deps.configId, token).catch(async (error) => {
    await request.body?.cancel().catch(() => {});
    const message = error instanceof AuthError ? error.message : EXTERNAL_MCP_REJECTED;
    return rpcError(401, -32001, message);
  });
  if (record instanceof Response) return record;
  const user = await deps.auth.user(record.ownerId);
  if (!user || user.disabled) {
    await request.body?.cancel().catch(() => {});
    return rpcError(401, -32001, EXTERNAL_MCP_REJECTED);
  }
  if (request.method === "GET" || request.method === "DELETE") {
    await request.body?.cancel().catch(() => {});
    return rpcError(405, -32000, "此端点使用 Streamable HTTP：请 POST JSON-RPC，不提供单独的 SSE 流。");
  }
  if (request.method !== "POST") {
    await request.body?.cancel().catch(() => {});
    return rpcError(405, -32000, "Method not allowed");
  }
  const declared = Number(request.headers.get("content-length") || 0);
  if (declared > MAX_BODY) {
    await request.body?.cancel().catch(() => {});
    return rpcError(413, -32000, "请求体过大");
  }
  const bytes = await request.arrayBuffer();
  if (bytes.byteLength > MAX_BODY) return rpcError(413, -32000, "请求体过大");
  let parsed: unknown;
  try { parsed = JSON.parse(new TextDecoder().decode(bytes) || ""); }
  catch { return rpcError(400, -32700, "Parse error"); }
  const headers = new Headers(request.headers);
  headers.delete("authorization");
  headers.delete("x-vega-mcp-token");
  const url = new URL(request.url);
  url.search = "";
  const safe = new Request(url, { method: "POST", headers });
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
    maxRequestBodySize: MAX_BODY,
  });
  transport.onerror = () => {};
  const server = new Server({ name: "vega-external", version: "0.2.0" }, { capabilities: { tools: {} }, instructions: INSTRUCTIONS });
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));
  server.setRequestHandler(CallToolRequestSchema, async (call) => {
    try {
      const args = (call.params.arguments || {}) as Obj;
      return toolResult(await externalMcpTool(deps.engine, user, record, call.params.name, args));
    } catch (error) {
      return toolFailure(error);
    }
  });
  await server.connect(transport);
  try { return await transport.handleRequest(safe, { parsedBody: parsed }); }
  finally { await server.close().catch(() => {}); }
}
