import type { Model } from "./config";
import type { Session } from "./store";
import { object, request, type Obj } from "./util";

export type UsageScope = { userId?: string; session?: string; employee?: string; task?: string };
export const usageScope = (session: Session): UsageScope => ({ userId: session.ownerId, session: session.id, employee: session.employeeId, task: session.taskId });
export type UsageCounts = { input?: number; output?: number; cacheRead?: number; cacheWrite?: number; total?: number; reasoningTokens?: number };
export type RequestUsage = UsageScope & UsageCounts & {
  requestId: string; at: number; model: string; modelId: string;
  status?: number; outcome: "completed" | "failed" | "interrupted";
  usageComplete: boolean; reportedNanos?: number;
};
export type UsageSink = (usage: RequestUsage) => Promise<void>;
const tokens = (value: unknown) => typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : undefined;

export function usageCounts(api: string, raw: Obj): UsageCounts {
  const gross = tokens(raw.input ?? raw.input_tokens ?? raw.prompt_tokens), output = tokens(raw.output ?? raw.output_tokens ?? raw.completion_tokens);
  const details = raw.input_tokens_details ?? raw.prompt_tokens_details;
  const cacheRead = tokens(raw.cacheRead ?? raw.cache_read_input_tokens ?? details?.cached_tokens ?? raw.prompt_cache_hit_tokens ?? 0);
  const cacheWrite = tokens(raw.cacheWrite ?? raw.cache_creation_input_tokens ?? details?.cache_write_tokens ?? 0);
  const hit = (cacheRead ?? 0) + (cacheWrite ?? 0);
  const input = gross === undefined || cacheRead === undefined || cacheWrite === undefined ? undefined
    : api === "anthropic-messages" || raw.input !== undefined ? gross : hit <= gross ? gross - hit : undefined;
  return { input, output, cacheRead, cacheWrite,
    total: tokens(raw.total_tokens ?? raw.totalTokens) ?? (input !== undefined && output !== undefined ? input + hit + output : undefined),
    reasoningTokens: tokens((raw.output_tokens_details ?? raw.completion_tokens_details)?.reasoning_tokens),
  };
}

export function dollarNanos(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return;
  const nanos = Math.round(value * 1e9);
  return Number.isSafeInteger(nanos) && (value === 0 || nanos > 0) ? nanos : undefined;
}
export function reportedCost(origin: string, usage: Obj) {
  // Only an explicitly known contract defines this field in USD-equivalent credits. BYOK may bill elsewhere too.
  return origin === "https://openrouter.ai" && usage.is_byok !== true && (usage.currency == null || usage.currency === "USD")
    ? dollarNanos(usage.cost) : undefined;
}

/** One receipt per explicit inference request. Fallback POSTs replace a settled attempt, not a turn total. */
export class RequestMeter {
  private active?: { requestId: string; at: number; modelId: string; raw: Obj; final: boolean; status?: number; origin?: string };
  constructor(private model: Model, private scope?: UsageScope, private save?: UsageSink) {}

  async send(url: string, init: RequestInit) {
    init.signal?.throwIfAborted();
    if (this.active) await this.finish("failed");
    init.signal?.throwIfAborted();
    if (this.scope?.userId && this.save)
      this.active = { requestId: crypto.randomUUID(), at: Date.now(), modelId: this.model.id, raw: {}, final: false };
    const response = await request(url, init, 0);
    if (this.active) {
      this.active.status = response.status;
      if (response.url && new URL(url).origin === new URL(response.url).origin) this.active.origin = new URL(response.url).origin;
    }
    return response;
  }
  observe(usage: unknown, modelId?: unknown, final = false) {
    if (!this.active) return;
    if (typeof modelId === "string" && /^[\w.:[\]+/-]{1,256}$/.test(modelId)) this.active.modelId = modelId;
    const raw = object(usage);
    if (!Object.keys(raw).length) return;
    Object.assign(this.active.raw, raw);
    this.active.final ||= final;
  }
  completeUsage() { if (this.active) this.active.final = true; }
  observeError(bytes: Buffer) {
    if (!this.active) return;
    let data;
    try { data = JSON.parse(bytes.toString()); } catch { return; }
    this.observe(data?.usage ?? data?.error?.usage, data?.model, true);
  }
  async finish(outcome: RequestUsage["outcome"]) {
    // shortcut: a hard crash before settlement cannot supply a receipt; add a durable in-flight ledger if invoice reconciliation is required.
    const attempt = this.active;
    this.active = undefined;
    if (!attempt) return;
    const { requestId, at, modelId, status, raw, origin, final } = attempt;
    const counts = usageCounts(this.model.api, raw);
    // An opening usage snapshot is useful as partial data, but not a complete price on interruption.
    const usageComplete = final && counts.input !== undefined && counts.output !== undefined &&
      counts.total === counts.input + counts.output + (counts.cacheRead || 0) + (counts.cacheWrite || 0);
    const reportedNanos = final ? reportedCost(origin || "", raw) : undefined;
    try { await this.save?.({ ...this.scope, ...counts, requestId, at, model: this.model.selection, modelId, status, outcome, usageComplete, reportedNanos }); }
    catch {
      // Metering must not turn a finished model response into a retry (or hide the original error).
      console.error("[Vega] Failed to persist model request usage", requestId);
    }
  }
}
