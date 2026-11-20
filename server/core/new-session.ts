/** /new: run the request as a new independent task while keeping the conversation context. */
export const NEW_TASK_NOTICE = "下条消息将作为新任务执行（保留当前对话上下文）";
/** Legacy divider notice kept for historical sessions that already recorded newSession dividers. */
export const NEW_SESSION_NOTICE = "已开启新会话，之前的对话不再作为上下文";
/** "/new" alone (arms the next message) or "/new <text>" (handled as a new task in the same context); anything else is an ordinary message. */
export function newCommand(text: unknown): { rest: string } | undefined {
  const match = typeof text === "string" ? /^\s*\/new(?:\s+([\s\S]*))?$/.exec(text) : null;
  return match ? { rest: (match[1] || "").trim() } : undefined;
}
