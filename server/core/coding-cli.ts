import { assert } from "./util";
import { assertShellCommand } from "./shell-policy";

export type CodingCLI = "codex" | "antigravity";

// The bound client transport accepts a shell command, not argv. Keep prompt data out of shell syntax.
export function codingCommand(cli: CodingCLI, handoff: string, windows: boolean) {
  assert(cli === "codex" || cli === "antigravity", "Unknown coding CLI");
  assert(handoff.trim() && Buffer.byteLength(handoff) <= 16_384 && !handoff.includes("\0"), "编码交接必须为 1–16 KiB 文本；只保留约束、工作目标与证据定位");
  assertShellCommand(handoff);
  const prompt = "在当前工作区仅执行以下编码阶段。不得操作网页、发布、推送或使用凭据；需审批或其它场景时停止并说明。报告修改、测试和未完成项。\n" + handoff;
  const codex = "codex exec --ephemeral --sandbox workspace-write --json -";
  const agy = "--sandbox --mode accept-edits --disable-slash-commands --print";
  if (windows) {
    const value = Buffer.from(prompt).toString("base64");
    const init = `$ErrorActionPreference='Stop'; $OutputEncoding=[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false); $p=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${value}')); `;
    return init + (cli === "codex" ? `$p | ${codex}` : `agy.exe ${agy} $p`) + "; exit $LASTEXITCODE";
  }
  const quoted = "'" + prompt.replaceAll("'", "'\\''") + "'";
  return cli === "codex" ? `printf '%s' ${quoted} | ${codex}` : `agy ${agy} ${quoted} </dev/null`;
}

export function codingResult(cli: CodingCLI, output: string) {
  if (cli === "antigravity") {
    assert(output.trim(), "agy 未返回阶段结果");
    return output.trim();
  }
  // Only the final agent text, never command transcripts, goes back to the caller.
  let last = "", completed = false;
  for (const line of output.split(/\r?\n/)) {
    let event;
    try { event = JSON.parse(line); } catch { continue; }
    if (event?.type === "item.completed" && event.item?.type === "agent_message" && typeof event.item.text === "string") last = event.item.text;
    if (event?.type === "turn.completed") completed = true;
  }
  assert(completed && last.trim(), "Codex 未返回完整阶段结果；请核对工作区，不要重跑");
  return last;
}
