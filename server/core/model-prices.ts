import { isDeepStrictEqual } from "node:util";
import { object, type Obj } from "./util";
import { dollarNanos, type UsageCounts } from "./request-usage";

type Quote = { rank: number; price?: Obj };
const modelName = (value: string) => value.trim().toLowerCase();
const bare = (value: string) => modelName(value).split("/").at(-1)!;
const knownVariant = /(?:\[1m\]|-1m|-fast|-paid|:free)$/;

/** Prefer model-owner rates over reseller catalog rates. Equal-rank disagreements are not estimates. */
export function modelPriceIndex(catalog: unknown) {
  const rates = new Map<string, Quote>();
  const rows = Object.entries(object(catalog)).flatMap(([owner, provider]) => Object.entries(object(provider?.models))
    .map(([id, value]) => ({ owner: modelName(owner), id: modelName(id), canonical: typeof value?.canonical_model_id === "string" ? modelName(value.canonical_model_id) : "", price: object(value?.cost) })));
  const priced = rows.filter((row) => Object.keys(row.price).length);
  const byCanonical = new Map<string, typeof rows>();
  for (const row of priced) if (row.canonical) {
    const group = byCanonical.get(row.canonical) || [];
    group.push(row);
    byCanonical.set(row.canonical, group);
  }
  const put = (id: string, price: Obj, rank: number) => {
    if (!id) return;
    const previous = rates.get(id);
    if (!previous || rank > previous.rank) rates.set(id, { rank, price });
    else if (rank === previous.rank && !isDeepStrictEqual(previous.price, price)) previous.price = undefined;
  };
  for (const row of rows) {
    const owner = row.canonical.split("/")[0], own = row.owner === owner;
    if (Object.keys(row.price).length) {
      put(row.id, row.price, own ? 3 : 1);
      put(bare(row.id), row.price, own ? 3 : 1);
      put(`${row.owner}/${row.id}`, row.price, own ? 3 : 0);
    }
    const group = byCanonical.get(row.canonical);
    if (!group) continue;
    const [author, ...parts] = row.canonical.split("/"), canonicalId = parts.join("/");
    const official = group.filter((item) => item.owner === author);
    const exact = official.find((item) => item.id === canonicalId || `${item.owner}/${item.id}` === row.canonical)
      ?? (row.canonical === "deepseek/deepseek-v4.1-flash-1017" ? official.find((item) => item.id === "deepseek-flash") : undefined);
    for (const item of exact ? [exact] : official.length ? official : group) {
      const rank = official.length ? 2 : 1;
      put(row.canonical, item.price, rank);
      put(bare(row.canonical), item.price, rank);
      // Do not overwrite the owner's explicit edition (e.g. a long-context SKU).
      put(row.id, item.price, rank);
      put(`${row.owner}/${row.id}`, item.price, rank);
    }
  }
  return (id: string) => {
    for (let candidate = modelName(id); candidate; candidate = candidate.replace(knownVariant, "")) {
      const found = rates.get(candidate) ?? rates.get(bare(candidate));
      if (found) return found.price;
      if (!knownVariant.test(candidate)) return undefined;
    }
  };
}

export function estimateCost(price: Obj | undefined, usage: UsageCounts) {
  if (!price || usage.input === undefined || usage.output === undefined) return;
  const { input, output, cacheRead = 0, cacheWrite = 0 } = usage;
  const context = input + cacheRead + cacheWrite;
  let tier = price;
  if (Array.isArray(price.tiers) && price.tiers.length) {
    let lower = 0;
    for (const entry of price.tiers) {
      const size = entry?.tier?.size;
      if (entry?.tier?.type !== "context" || !Number.isSafeInteger(size) || size < 0) return;
      if (context > size && size >= lower) { tier = entry; lower = size; }
    }
  } else if (context > 200000 && price.context_over_200k) tier = price.context_over_200k;
  const valid = (value: unknown) => typeof value === "number" && Number.isFinite(value) && value >= 0;
  const separateReasoning = tier.reasoning !== undefined && tier.reasoning !== tier.output && output > 0;
  const reasoning = separateReasoning ? usage.reasoningTokens : 0;
  if (reasoning === undefined || reasoning > output) return;
  const parts = [[input, "input"], [output - reasoning, "output"], [reasoning, "reasoning"], [cacheRead, "cache_read"], [cacheWrite, "cache_write"]] as const;
  let total = 0;
  for (const [count, key] of parts) if (count > 0) {
    if (!valid(tier[key])) return;
    total += count * tier[key] / 1_000_000;
  }
  // A priced model with a reported zero-token request can be exactly zero, unlike absent usage.
  return dollarNanos(total);
}
