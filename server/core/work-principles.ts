/** Same length cap as a bot's private 工作原则 (`employee.instruction`). */
export const WORK_PRINCIPLES_MAX = 8000;

/**
 * Effective 工作原则 for one bot: the site-wide public text first, then that bot's private instruction.
 * Private text supplements the public text. It does not replace or drop it.
 * An empty side is left out. When the public text is empty, the private string is returned unchanged
 * so a bot with only its own principles keeps today's prompt.
 */
export function effectiveWorkPrinciples(global?: unknown, own?: unknown): string {
  const pub = typeof global === "string" ? global.trim() : "";
  const priv = typeof own === "string" ? own : "";
  if (!pub) return priv;
  const privateText = priv.trim();
  if (!privateText) return pub;
  return `${pub}\n\n${privateText}`;
}
