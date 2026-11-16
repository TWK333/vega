<script setup vapor>
import { ref, computed, onMounted, onBeforeUnmount, watch } from "vue";
import EmployeeSessionView from "./EmployeeSessionView.vue";
import PageHeader from "./PageHeader.vue";
import Icon from "./Icon.vue";
import { formatBeijing } from "../../shared/time";
import { taskLabel, taskTone } from "./task-status";
import { groupDebugSessions, visibleDebugSessions } from "./debug-sessions.js";
const props = defineProps({ api: Function, revision: Number, tab: String });
const emit = defineEmits(["tab"]);
const sessions = ref([]), selected = ref(""), employee = ref(""), search = ref(""), busy = ref(false), error = ref("");
const labels = { chat: "沟通", group: "群聊", narrator: "旁白", work: "主执行", computer: "浏览器" };
const icons = { chat: "inbox", group: "users", narrator: "inbox", work: "code", computer: "globe" };
const employees = computed(() => [...new Map(sessions.value.filter((session) => session.employeeId).map((session) => [session.employeeId, session.employeeName])).entries()]);
const visible = computed(() => visibleDebugSessions(sessions.value, { employeeId: employee.value, query: search.value }));
const groups = computed(() => groupDebugSessions(visible.value));
let disposed = false, version = 0;
async function refresh() {
  const current = ++version; busy.value = true; error.value = "";
  try { const result = await props.api("/debug/sessions"); if (!disposed && current === version) sessions.value = result; }
  catch (e) { if (!disposed) error.value = e.message; }
  finally { if (!disposed && current === version) busy.value = false; }
}
watch(() => props.revision, refresh);
onMounted(refresh);
// The selected session lives in the address (/debug/:session).
watch(() => props.tab, (id) => { selected.value = id || ""; }, { immediate: true });
watch(selected, (id) => { if (id !== (props.tab || "")) emit("tab", id); });
onBeforeUnmount(() => { disposed = true; version++; });
</script>
<template>
  <div class="debug-layout" :class="{ 'has-selection': !!selected }">
    <section class="debug-list-pane" aria-label="调试会话列表">
      <PageHeader title="调试会话" subtitle="按任务归组，查看真实消息与工具记录">
        <button type="button" class="sm" :disabled="busy" title="刷新" @click="refresh"><Icon name="refresh" :size="14" /><span class="hide-mobile">刷新</span></button>
      </PageHeader>
      <div class="debug-filters">
        <select v-model="employee" aria-label="牛马"><option value="">全部牛马</option><option v-for="[id, name] in employees" :key="id" :value="id">{{ name }}</option></select>
        <label class="search"><Icon name="search" :size="14" /><input v-model="search" aria-label="按任务 ID、任务内容、会话 ID、标题或牛马查找" placeholder="任务 ID、任务内容或会话" /></label>
      </div>
      <p class="debug-count"><span>{{ groups.filter(group => group.taskId).length }} 个任务 · {{ visible.length }} 个会话</span><span><Icon name="lock" :size="11" />只读</span></p>
      <p v-if="error" class="banner error" role="alert"><span>{{ error }}</span></p>
      <div class="debug-list">
        <p v-if="!groups.length" class="empty-state">{{ busy ? '正在读取…' : '没有匹配的牛马会话' }}</p>
        <section v-for="group in groups" :key="group.key" class="debug-group" :class="{ loose: !group.taskId }" :aria-label="group.taskId ? '任务 ' + group.taskId : group.label">
          <header class="debug-group-head">
            <div class="debug-group-meta"><span>{{ group.taskId ? '任务' : group.label }}<span class="session-count">{{ group.sessions.length }} 个会话</span></span><span v-if="group.taskStatus" :class="['badge', taskTone(group.taskStatus)]">{{ taskLabel(group.taskStatus) }}</span></div>
            <strong v-if="group.taskId" class="debug-group-title" :title="group.taskText || group.taskId">{{ group.taskText || '任务 ' + group.taskId.slice(0, 8) }}</strong>
            <code v-if="group.taskId" class="debug-task-id" :title="group.taskId">{{ group.taskId.slice(0, 12) }}…</code>
          </header>
          <button v-for="session in group.sessions" :key="session.id" type="button" class="debug-session" :class="{ selected: selected === session.id }" :aria-current="selected === session.id ? 'true' : undefined" :title="session.title" @click="selected = session.id">
            <span class="debug-kind"><Icon :name="icons[session.kind] || 'code'" :size="16" /></span>
            <span class="debug-session-body">
              <span class="debug-row"><strong>{{ session.employeeName }}</strong><span class="debug-label">{{ labels[session.kind] }}</span><span v-if="session.running" class="debug-running" aria-label="执行中"><span class="dot ok pulse"></span>执行中</span></span>
              <span v-if="!group.taskId" class="debug-title">{{ session.title }}</span>
              <span class="debug-secondary"><span class="debug-model" :title="(session.scene || 'lightweight') + ' · ' + (session.model || '默认模型')">{{ session.model || '默认模型' }}</span><code :title="'会话 ID：' + session.id">{{ session.id.slice(0, 8) }}</code></span>
            </span>
            <span class="debug-session-end"><time :title="formatBeijing(session.createdAt)">{{ formatBeijing(session.createdAt).slice(5, 16) }}</time><Icon :name="session.localAgent ? 'laptop' : 'server'" :size="12" :title="session.localAgent ? '客户端 · ' + (session.clientName || session.clientId) : '服务端'" /></span>
          </button>
        </section>
      </div>
    </section>
    <section class="debug-detail-pane" aria-label="会话记录">
      <EmployeeSessionView v-if="selected" :key="selected" :api="api" :session-id="selected" :revision="revision" debug @back="selected = ''" />
      <div v-else class="debug-placeholder"><Icon name="code" :size="32" /><strong>选择一个会话</strong><span>查看完整消息、工具调用与原始参数。</span></div>
    </section>
  </div>
</template>
<style scoped>
.debug-layout { display: grid; grid-template-columns: minmax(0, 400px) minmax(0, 1fr); flex: 1; min-height: 0; min-width: 0; }
.debug-list-pane { display: flex; flex-direction: column; min-height: 0; min-width: 0; border-right: 1px solid var(--border); background: var(--bg); }
.debug-detail-pane { display: flex; flex-direction: column; min-width: 0; min-height: 0; background: var(--surface); }
.debug-filters { display: flex; gap: 8px; flex: none; padding: 12px 14px 0; }
.debug-filters select { flex: 0 1 116px; min-width: 0; }
.search { position: relative; display: flex; align-items: center; flex: 1; min-width: 0; }
.search .icon-svg { position: absolute; left: 9px; color: var(--muted); pointer-events: none; }
.search input { width: 100%; padding-left: 28px; }
.debug-count { display: flex; justify-content: space-between; flex: none; padding: 10px 16px; color: var(--muted); font-size: 11px; }
.debug-count > span:last-child { display: flex; align-items: center; gap: 4px; }
.debug-list-pane > .banner { flex: none; }
.debug-list { flex: 1; min-height: 0; overflow-y: auto; padding: 0 12px 16px; scrollbar-width: thin; }
.debug-group { overflow: hidden; margin-bottom: 10px; border: 1px solid var(--border); border-radius: 12px; background: var(--surface); }
.debug-group-head { display: grid; grid-template-columns: minmax(0, 1fr); gap: 6px; padding: 12px 12px 10px; }
.debug-group-title { display: -webkit-box; overflow: hidden; min-width: 0; color: var(--text); font-size: 13px; font-weight: 600; line-height: 1.55; overflow-wrap: anywhere; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.debug-group-meta { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-width: 0; color: var(--muted); font-size: 11px; }
.session-count { margin-left: 8px; color: var(--faint); }
.debug-task-id { width: fit-content; color: var(--faint); font-size: 10px; }
.debug-session { display: grid; grid-template-columns: 28px minmax(0, 1fr) auto; align-items: start; justify-content: stretch; gap: 8px; width: 100%; height: auto; min-height: 64px; padding: 10px 12px; border: 0; border-top: 1px solid var(--border); border-radius: 0; background: transparent; font-weight: 400; text-align: left; white-space: normal; }
.debug-session:hover:not(:disabled) { background: var(--surface-2); }
.debug-session.selected { background: var(--accent-softer); box-shadow: inset 3px 0 var(--accent); }
.debug-kind { display: grid; place-items: center; width: 28px; height: 28px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg); color: var(--muted); }
.selected .debug-kind { border-color: var(--accent-soft); color: var(--accent); background: var(--surface); }
.debug-session-body { display: grid; gap: 4px; min-width: 0; }
.debug-row { display: flex; align-items: center; gap: 6px; min-width: 0; font-size: 12px; }
.debug-row strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; }
.debug-label { flex: none; color: var(--muted); font-size: 11px; }
.debug-running { display: flex; align-items: center; gap: 3px; flex: none; color: var(--ok); font-size: 10px; }
.debug-running .dot { width: 5px; height: 5px; }
.debug-title { overflow: hidden; color: var(--text-2); font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
.debug-secondary { display: flex; gap: 8px; min-width: 0; color: var(--faint); font-size: 10px; }
.debug-model { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.debug-secondary code { flex: none; font-size: 10px; }
.debug-session-end { display: grid; justify-items: end; gap: 8px; padding-top: 1px; color: var(--faint); font-size: 10px; white-space: nowrap; }
@media (max-width: 399px) { .debug-list { padding-inline: 8px; } .debug-session { padding-inline: 9px; gap: 6px; } .debug-session-end time { max-width: 42px; overflow: hidden; } }
.debug-placeholder { display: grid; align-content: center; justify-items: center; gap: 6px; flex: 1; color: var(--muted); font-size: 12px; }
.debug-placeholder strong { color: var(--text); font-size: 14px; }
.debug-placeholder .icon-svg { color: var(--faint); }
@media (max-width: 1099px) {
  .debug-layout { grid-template-columns: minmax(0, 1fr); }
  .debug-list-pane { border-right: 0; }
  .debug-layout:not(.has-selection) .debug-detail-pane, .debug-layout.has-selection .debug-list-pane { display: none; }
}
</style>
