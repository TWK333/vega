/**
 * 任务工作区检查点：只搬业务文件，不搬依赖、构建产物和凭据。
 * 两边用同一份清单比较，交接时同步增量；执行中的安全点只确认文件基线，不切换执行权。
 * 回传时按共同基线三方合并，冲突双方都保留。
 */
import { createHash } from "node:crypto";

/** 目录与文件黑名单：命中即不参与同步（依赖、缓存、Git 内部、常见凭据）。 */
const EXCLUDED = [
  /(^|\/)\.git(\/|$)/, /(^|\/)node_modules(\/|$)/, /(^|\/)\.venv(\/|$)/, /(^|\/)venv(\/|$)/,
  /(^|\/)dist(\/|$)/, /(^|\/)build(\/|$)/, /(^|\/)out(\/|$)/, /(^|\/)target(\/|$)/, /(^|\/)bin(\/|$)/,
  /(^|\/)\.next(\/|$)/, /(^|\/)\.nuxt(\/|$)/, /(^|\/)\.cache(\/|$)/, /(^|\/)__pycache__(\/|$)/,
  /(^|\/)\.gradle(\/|$)/, /(^|\/)\.pytest_cache(\/|$)/,
  /(^|\/)\.env(\.|$)/, /(^|\/)\.npmrc$/, /(^|\/)\.netrc$/, /(^|\/)\.ssh(\/|$)/, /(^|\/)\.aws(\/|$)/,
  /(^|\/)id_rsa/, /\.(pem|key|pfx|p12|keystore)$/i,
];

/** 一次交接的上限；超限就明确失败，不偷偷截断。 */
export const LIMITS = { files: 2000, bytes: 16 << 20, fileBytes: 4 << 20 };

/** 统一成 / 分隔的相对路径，拒绝绝对路径和上跳。 */
export function relativePath(path) {
  const value = String(path || "").replaceAll("\\", "/").replace(/^\.\//, "").replace(/\/+/g, "/");
  if (!value || value.startsWith("/") || /^[a-zA-Z]:\//.test(value) || value.split("/").includes("..")) return "";
  return value;
}

export function allowed(path) {
  const value = relativePath(path);
  return !!value && !EXCLUDED.some((pattern) => pattern.test(value));
}

export const hash = (data) => createHash("sha256").update(data).digest("hex");

/** entries: [{ path, data?: Buffer, size?, hash? }] → 按路径排序的清单。超限抛错，不做静默裁剪。 */
export function manifest(entries, limits = LIMITS) {
  const files = [];
  let bytes = 0;
  for (const entry of entries) {
    const path = relativePath(entry?.path);
    if (!allowed(path)) continue;
    const size = entry.data ? entry.data.length : Number(entry.size || 0);
    if (!Number.isFinite(size) || size < 0) continue;
    if (size > limits.fileBytes) throw Error(`文件过大，无法交接：${path}（${size} 字节，上限 ${limits.fileBytes}）`);
    bytes += size;
    if (files.length >= limits.files) throw Error(`交接文件数超过上限 ${limits.files}，请缩小工作区范围后再交接`);
    if (bytes > limits.bytes) throw Error(`交接内容超过上限 ${limits.bytes} 字节，请缩小工作区范围后再交接`);
    files.push({ path, size, hash: entry.hash || hash(entry.data) });
  }
  return files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}

const byPath = (files) => new Map((files || []).map((file) => [file.path, file]));

/** base → next 的变化：新增、修改、删除。 */
export function compare(base = [], next = []) {
  const before = byPath(base), after = byPath(next);
  const added = [], modified = [], removed = [];
  for (const [path, file] of after) {
    const old = before.get(path);
    if (!old) added.push(path);
    else if (old.hash !== file.hash) modified.push(path);
  }
  for (const path of before.keys()) if (!after.has(path)) removed.push(path);
  return { added, modified, removed };
}

/**
 * 三方合并：base 是交接时的共同基线。
 * 返回需要写入一侧的动作与冲突路径；冲突不覆盖任何一方，由调用方保留两份。
 */
export function merge(base = [], local = [], remote = []) {
  const b = byPath(base), l = byPath(local), r = byPath(remote);
  const changes = [], conflicts = [];
  for (const path of new Set([...b.keys(), ...l.keys(), ...r.keys()])) {
    const old = b.get(path)?.hash, mine = l.get(path)?.hash, theirs = r.get(path)?.hash;
    const localChanged = mine !== old, remoteChanged = theirs !== old;
    if (!localChanged && !remoteChanged) continue;
    if (localChanged && !remoteChanged) { changes.push({ path, side: "local", action: mine ? "write" : "delete" }); continue; }
    if (!localChanged && remoteChanged) { changes.push({ path, side: "remote", action: theirs ? "write" : "delete" }); continue; }
    if (mine && theirs && mine === theirs) continue; // 两边改成了一样，不需要动作
    conflicts.push(path);
  }
  return { changes, conflicts };
}

const hexHash = (value) => typeof value === "string" && /^[0-9a-f]{64}$/.test(value);

/**
 * 增量检查点：相对上一份已确认基线，只列出要上传的文件。
 * 单个超限文件记入 skipped，不让整次检查点失败；放不下的新增或修改留在原处，已确认的版本继续作为基线。
 * hold 是这次清单没能带上、但仍应保留的已确认路径（例如总量超限时没再传送的旧文件）。
 * entries: [{ path, data?: Buffer, size?, hash? }]
 */
export function checkpointPlan(entries, base = [], limits = LIMITS, hold = []) {
  const skipped = [];
  const present = new Map();
  for (const entry of entries || []) {
    const path = relativePath(entry?.path);
    if (!allowed(path)) continue;
    const size = entry?.data ? entry.data.length : Number(entry?.size || 0);
    if (!Number.isFinite(size) || size < 0) continue;
    if (size > limits.fileBytes) { skipped.push({ path, reason: "文件过大" }); continue; }
    const fileHash = entry?.data ? hash(entry.data) : entry?.hash;
    if (!hexHash(fileHash)) continue;
    present.set(path, { path, size, hash: fileHash });
  }
  const holdSet = new Set((hold || []).map((path) => relativePath(path)).filter(Boolean));
  const previous = byPath(base);
  const kept = [];
  let bytes = 0;
  const removed = [];
  for (const old of base || []) {
    const path = relativePath(old?.path);
    if (!path || !hexHash(old?.hash)) continue;
    const next = present.get(path);
    if (!next) {
      if (holdSet.has(path)) { kept.push({ path, size: Number(old.size) || 0, hash: old.hash }); bytes += Number(old.size) || 0; }
      else removed.push(path);
      continue;
    }
    if (next.hash === old.hash) {
      kept.push({ path, size: Number(old.size) || 0, hash: old.hash });
      bytes += Number(old.size) || 0;
      present.delete(path);
    }
  }
  const written = [];
  for (const file of [...present.values()].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))) {
    const old = previous.get(file.path);
    if (kept.length + written.length >= limits.files || bytes + file.size > limits.bytes) {
      skipped.push({ path: file.path, reason: "超出交接总量上限" });
      if (old && hexHash(old.hash)) { kept.push({ path: old.path, size: Number(old.size) || 0, hash: old.hash }); bytes += Number(old.size) || 0; }
      continue;
    }
    bytes += file.size;
    written.push({ path: file.path, size: file.size, hash: file.hash });
  }
  const files = [...kept, ...written].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  skipped.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return { files, skipped, pack: { written, removed } };
}
