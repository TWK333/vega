/** Chat lists keep only the label; originals remain in the task and message history. */
export function stepSummary(message) {
  const output = message.stepOutput;
  if (output && typeof output === "object")
    return { ...message, stepOutput: { step: output.step, label: output.label, omitted: true, ...(output.legacy ? { legacy: true } : {}) } };
  const prefix = "**步骤产物（任务未完成）**\n\n", text = message.text || "";
  if (output === true && text.startsWith(prefix)) {
    const rest = text.slice(prefix.length), split = rest.indexOf("\n\n");
    return { ...message, text: "步骤产物已保存。", displayText: undefined, stepOutput: { step: 0, label: split < 0 ? "历史步骤产物" : rest.slice(0, split), omitted: true, legacy: true } };
  }
  return message;
}
