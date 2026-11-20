<script setup vapor>
import { computed, onMounted, ref } from "vue";
import PageHeader from "./PageHeader.vue";
import Icon from "./Icon.vue";
import { beijingDateTime, beijingParts, beijingTimestamp, formatBeijing } from "../../shared/time";
const props = defineProps({ api: Function, admin: Boolean, selfId: String });
// Presets count natural days in Beijing time: 今天 is one day, the rest run back from today's midnight.
const RANGES = [
  { id: "today", label: "今天", days: 1 },
  { id: "7d", label: "近 7 天", days: 7 },
  { id: "30d", label: "近 30 天", days: 30 },
  { id: "90d", label: "近 90 天", days: 90 },
  { id: "all", label: "全部", days: 0 },
  { id: "custom", label: "自定义" },
];
const emptyCost = { reportedUsd: null, estimatedUsd: null, unknown: 0, missingUsage: 0 };
const empty = { n: 0, input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0, users: [], cost: emptyCost };
const stats = ref({ ...empty }), busy = ref(false), error = ref("");
const page = ref({ tasks: [], total: 0, page: 1, pageSize: 20 });
const userId = ref(""), range = ref("all"), isAdmin = ref(!!props.admin);
const displayedRange = ref("全部");
let latestRequest = 0;
// Custom range: two Beijing calendar days (inclusive), as yyyy-mm-dd from the date inputs.
const custom = ref({ from: "", to: "" });
const rangeLabel = computed(() => range.value === "custom"
  ? custom.value.from || custom.value.to ? `${custom.value.from || "最早"} 至 ${custom.value.to || "现在"}` : "自定义时间"
  : RANGES.find((item) => item.id === range.value)?.label || "");
const pageCount = computed(() => Math.max(1, Math.ceil(page.value.total / page.value.pageSize)));
function dayStart(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || "");
  return match ? beijingTimestamp(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 0, 0) : undefined;
}
function bounds() {
  if (range.value === "custom") {
    let from = dayStart(custom.value.from), to = dayStart(custom.value.to);
    if (from !== undefined && to !== undefined && from > to) [from, to] = [to, from];
    return { from, to: to === undefined ? undefined : to + 86400000 - 1 };
  }
  const days = RANGES.find((item) => item.id === range.value)?.days || 0;
  if (!days) return {};
  const p = beijingParts(Date.now());
  return { from: beijingTimestamp(p.year, p.month, p.day, 0, 0) - (days - 1) * 86400000 };
}
async function load(number = 1) {
  const requestId = ++latestRequest, label = rangeLabel.value;
  busy.value = true;
  error.value = "";
  try {
    const query = new URLSearchParams({ page: String(number) });
    if (userId.value) query.set("userId", userId.value);
    const { from, to } = bounds();
    if (from !== undefined) query.set("from", String(from));
    if (to !== undefined) query.set("to", String(to));
    const result = await props.api("/usage?" + query.toString());
    if (requestId !== latestRequest) return;
    displayedRange.value = label;
    stats.value = { ...empty, ...result, users: result.users || [] };
    isAdmin.value = !!result.admin;
    page.value = result.taskPage || { tasks: [], total: 0, page: 1, pageSize: 20 };
    // A range or user filter can shrink the list under the current page; fall back to the last one that exists.
    if (!page.value.tasks.length && page.value.page > pageCount.value) return await load(pageCount.value);
  } catch (e) {
    if (requestId === latestRequest) error.value = e.message;
  } finally {
    if (requestId === latestRequest) busy.value = false;
  }
}
function setRange(id) {
  range.value = id;
  // First click on 自定义 starts from today so the result is never an accidental “everything” query.
  if (id === "custom" && !custom.value.from && !custom.value.to) {
    const today = beijingDateTime(Date.now()).slice(0, 10);
    custom.value = { from: today, to: today };
  }
  load();
}
const numbers = new Intl.NumberFormat("zh-CN");
const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 9 });
const formatTokens = (n) => numbers.format(n || 0);
const formatCost = (n) => n == null ? "—" : money.format(n);
const taskLabel = (row) => row.text || (row.task ? "任务记录已删除" : "普通会话");
onMounted(load);
</script>
<template>
  <PageHeader title="Token 统计" subtitle="按时间范围统计模型用量和费用；管理员可查看全部或筛选某一用户" />
  <div class="page-scroll settings">
    <p v-if="error" class="callout warn" role="alert"><Icon name="alert" :size="14" /><span>{{ error }}</span></p>
    <section class="card">
      <div class="card-head row">
        <div>
          <h3>用量汇总</h3>
          <p class="hint">{{ displayedRange }} 共 {{ formatTokens(stats.n) }} 次模型请求（含失败、重试和中断）。{{ isAdmin ? "管理员默认看到全部用户。" : "仅显示你自己的记录。" }}</p>
        </div>
        <div class="actions">
          <label v-if="isAdmin" class="user-filter">用户
            <select v-model="userId" :disabled="busy" @change="load()">
              <option value="">全部用户</option>
              <option v-for="item in stats.users" :key="item.id" :value="item.id">{{ item.name + (item.id === selfId ? "（我）" : "") }}</option>
            </select>
          </label>
          <button type="button" class="sm" :disabled="busy" @click="load(page.page)"><Icon name="refresh" :size="14" />刷新</button>
        </div>
      </div>
      <div class="segmented ranges" role="group" aria-label="时间范围">
        <button v-for="item in RANGES" :key="item.id" type="button" :aria-pressed="range === item.id" :disabled="busy" @click="setRange(item.id)">{{ item.label }}</button>
      </div>
      <div v-if="range === 'custom'" class="custom-range">
        <label>从 <input v-model="custom.from" type="date" :max="custom.to || undefined" :disabled="busy" @change="load()" /></label>
        <label>到 <input v-model="custom.to" type="date" :min="custom.from || undefined" :disabled="busy" @change="load()" /></label>
        <span class="hint">按北京时间日期，包含起止两天；只填一端也可以。</span>
      </div>
      <div class="usage-grid" aria-label="费用（美元）">
        <article class="stat"><span class="hint">上游回报费用（USD）</span><strong>{{ formatCost(stats.cost.reportedUsd) }}</strong></article>
        <article class="stat"><span class="hint">按用量估算（USD）</span><strong>{{ formatCost(stats.cost.estimatedUsd) }}</strong></article>
        <article class="stat"><span class="hint">无法核算费用</span><strong>{{ formatTokens(stats.cost.unknown) }} 笔</strong></article>
      </div>
      <p class="hint cost-note"><template v-if="stats.cost.unknown">费用不完整。历史无账单、缺价或缺用量的请求不按零计。 </template>上游回报不与同笔估算重复计入；估算基于模型目录价格，不等于账单。<template v-if="stats.cost.missingUsage">另有 {{ formatTokens(stats.cost.missingUsage) }} 笔请求未取得完整 Token 用量。</template></p>
      <div class="usage-grid">
        <article class="stat"><span class="hint">合计</span><strong>{{ formatTokens(stats.total) }}</strong></article>
        <article class="stat"><span class="hint">输入</span><strong>{{ formatTokens(stats.input) }}</strong></article>
        <article class="stat"><span class="hint">输出</span><strong>{{ formatTokens(stats.output) }}</strong></article>
        <article class="stat"><span class="hint">缓存命中</span><strong>{{ formatTokens(stats.cacheRead) }}</strong></article>
        <article class="stat"><span class="hint">缓存写入</span><strong>{{ formatTokens(stats.cacheWrite) }}</strong></article>
      </div>
    </section>
    <section class="card">
      <div class="card-head">
        <h3>按任务统计</h3>
        <p class="hint">{{ displayedRange }}共 {{ formatTokens(page.total) }} 项，按任务创建时间从新到旧排列；已删除任务和普通会话排在末尾，按最近用量时间排列。</p>
      </div>
      <div class="task-table" role="table" aria-label="按任务统计的用量">
        <div class="task-row task-header" :class="{ admin: isAdmin }" role="row">
          <span role="columnheader">任务</span>
          <span v-if="isAdmin" role="columnheader">用户</span>
          <span role="columnheader">热心市民</span>
          <span class="num" role="columnheader">请求</span>
          <span class="num" role="columnheader">合计</span>
          <span class="num optional" role="columnheader">输入</span>
          <span class="num optional" role="columnheader">输出</span>
          <span class="num optional" role="columnheader">缓存</span>
          <span class="time optional" role="columnheader">最近</span>
        </div>
        <div v-for="row in page.tasks" :key="row.task + row.user + row.employee + row.last" class="task-row" :class="{ admin: isAdmin }" role="row">
          <span class="task-cell" role="cell">
            <span class="truncate" :title="row.text || row.task">{{ taskLabel(row) }}</span>
            <small v-if="row.cost" class="hint task-cost">
              <span v-if="row.cost.reportedUsd != null">回报 {{ formatCost(row.cost.reportedUsd) }}</span>
              <span v-if="row.cost.estimatedUsd != null">估算 {{ formatCost(row.cost.estimatedUsd) }}</span>
              <span v-if="row.cost.unknown">{{ formatTokens(row.cost.unknown) }} 笔费用不完整</span>
            </small>
          </span>
          <span v-if="isAdmin" class="truncate" role="cell">{{ row.userName }}</span>
          <span class="truncate" role="cell">{{ row.employeeName || "—" }}</span>
          <span class="num" role="cell">{{ formatTokens(row.n) }}</span>
          <span class="num strong" role="cell">{{ formatTokens(row.total) }}</span>
          <span class="num optional" role="cell">{{ formatTokens(row.input) }}</span>
          <span class="num optional" role="cell">{{ formatTokens(row.output) }}</span>
          <span class="num optional" role="cell">{{ formatTokens(row.cacheRead) }}</span>
          <span class="time optional" role="cell">{{ formatBeijing(row.last) }}</span>
        </div>
        <p v-if="!page.tasks.length" class="hint empty">{{ busy ? "正在统计…" : "这个时间范围还没有记录。" }}</p>
      </div>
      <div class="pager">
        <span class="hint">第 {{ page.page }} / {{ pageCount }} 页 · 共 {{ formatTokens(page.total) }} 项</span>
        <button type="button" class="sm" :disabled="busy || page.page <= 1" @click="load(page.page - 1)">上一页</button>
        <button type="button" class="sm" :disabled="busy || page.page >= pageCount" @click="load(page.page + 1)">下一页<Icon name="right" :size="14" /></button>
      </div>
    </section>
  </div>
</template>
<style scoped>
.card-head.row { align-items: flex-start; gap: 12px; }
.actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.user-filter { display: flex; align-items: center; gap: 6px; color: var(--muted); font-size: 12px; }
.ranges { margin-top: 12px; flex-wrap: wrap; }
.custom-range { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-top: 10px; }
.custom-range > label { display: flex; align-items: center; gap: 6px; color: var(--muted); font-size: 12px; }
.custom-range > label > input { width: auto; min-height: 32px; padding: 0 8px; }
.usage-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 12px; margin-top: 12px; }
.stat { display: grid; gap: 4px; padding: 12px 14px; border: 1px solid var(--border); border-radius: var(--r-md); background: var(--surface-2); }
.stat strong { font-size: 18px; overflow-wrap: anywhere; }
.cost-note { margin-top: 8px; }
.task-cell { display: grid; min-width: 0; gap: 2px; }
.task-cost { display: flex; flex-wrap: wrap; column-gap: 8px; overflow-wrap: anywhere; }
.task-table { display: grid; border: 1px solid var(--border); border-radius: var(--r-md); overflow: hidden; }
.task-row { display: grid; grid-template-columns: minmax(0, 2.4fr) minmax(0, 1fr) repeat(5, minmax(0, 0.8fr)) minmax(0, 1.1fr); align-items: center; gap: 10px; min-height: 44px; padding: 8px 12px; border-top: 1px solid var(--border); font-size: 12px; }
.task-row.admin { grid-template-columns: minmax(0, 2.2fr) minmax(0, 0.9fr) minmax(0, 0.9fr) repeat(5, minmax(0, 0.75fr)) minmax(0, 1.1fr); }
.task-row:first-child { border-top: 0; }
.task-header { min-height: 34px; background: var(--surface-2); color: var(--muted); font-size: 11px; font-weight: 600; }
.task-row .num { text-align: right; font-variant-numeric: tabular-nums; }
.task-row .time { color: var(--muted); white-space: nowrap; }
.task-row .strong { font-weight: 600; }
.task-table .empty { padding: 14px 12px; }
.pager { display: flex; align-items: center; justify-content: flex-end; gap: 8px; margin-top: 12px; }
@media (max-width: 899px) {
  .task-row .optional { display: none; }
  .task-row { grid-template-columns: minmax(0, 2.4fr) minmax(0, 1fr) minmax(0, 0.8fr) minmax(0, 0.9fr); }
  .task-row.admin { grid-template-columns: minmax(0, 2fr) minmax(0, 0.9fr) minmax(0, 0.9fr) minmax(0, 0.7fr) minmax(0, 0.9fr); }
}
@media (max-width: 767px) {
  .pager { justify-content: space-between; flex-wrap: wrap; }
}
</style>
