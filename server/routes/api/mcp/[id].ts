import { defineEventHandler, getRouterParam, sendWebResponse, toWebRequest } from "h3";
import { app } from "../../../core/application";
import { externalMcpResponse } from "../../../core/external-mcp-server";

/** 对外 MCP（Streamable HTTP）。令牌在请求头里，不走网站登录态。 */
export default defineEventHandler(async (event) => {
  const response = await externalMcpResponse(toWebRequest(event), {
    engine: app().engine,
    auth: app().auth,
    configId: getRouterParam(event, "id") || "",
  });
  return sendWebResponse(event, response);
});
