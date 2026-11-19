<script setup vapor>
import { computed, onBeforeUnmount, ref, watch } from "vue";
import Icon from "./Icon.vue";
import EmployeeAvatar from "./EmployeeAvatar.vue";
import TaskDetail from "./TaskDetail.vue";
import { taskLabel, taskTone, planProgress, shortTime } from "./task-status";
// The group's 工作面板: tasks started from this group, by member employee (GET /groups/:id/tasks, already ordered).
// Task details stay beside the chat; owners can explicitly open their execution workspace.
const props = defineProps({ members: Array, loading: Boolean, api: Function, groupId: String, focus: Object });
const emit = defineEmits(["select", "exit", "title", "open", "inspect", "close", "changed"]);
const selectedKey = computed(() => props.focus || null), selected = ref(null), detailLoading = ref(false), error = ref("");
const owned = () => props.members?.some((member) => member.mine && member.id === selectedKey.value?.member);
const requester = (task) => task.requester ? `${task.requester.kind === "employee" ? "牛马" : ""}${task.requester.name}` : "";
const note = (task) => task.status === "waiting" ? task.waiting : task.status === "approval" ? task.approval : task.progress?.at(-1)?.text || task.queueReason || "";
let version = 0;
const taskPath = (key) => `/groups/${encodeURIComponent(props.groupId)}/tasks/${encodeURIComponent(key.member)}/${encodeURIComponent(key.task)}`;
async function loadDetail() {
  const request = ++version, key = selectedKey.value;
  const current = () => version === request && selectedKey.value === key;
  if (!key) { selected.value = null; detailLoading.value = false; return; }
  detailLoading.value = true; error.value = "";
  try {
    const task = await props.api(taskPath(key));
    if (current()) { selected.value = task; emit("title", task.text); }
  } catch (e) {
    if (current()) {
      selected.value = null; error.value = e.message;
      if ([403, 404].includes(e.status)) emit("exit", true);
    }
  }
  finally { if (current()) detailLoading.value = false; }
}
function open(member, task) {
  emit("select", { employeeId: member.id, taskId: task.id, title: task.text });
}
async function control(action, text) {
  const key = selectedKey.value;
  if (!key || !selected.value?.canControl) return false;
  if (action === "remove" && !confirm("永久删除此任务记录？")) return false;
  if (action === "redispatch" && !confirm("重新派发为新任务？此前外部操作不会回滚。")) return false;
  if (action === "seal" && !confirm("封存此任务？封存后不能再恢复、续做或重新派发，只能查看或删除。")) return false;
  error.value = "";
  try {
    const result = await props.api(taskPath(key), "POST", { action: action === "reject" ? "approve" : action, ...(action === "approve" || action === "reject" ? { approved: action === "approve" } : {}), ...(text ? { text } : {}), ...(action === "redispatch" ? { confirmed: true } : {}), ...(action === "seal" ? { manual: true } : {}) });
    if (selectedKey.value === key) {
      if (action === "remove") emit("exit", true);
      else if (action === "redispatch" && result.id) open({ id: key.member }, { id: result.id, text: selected.value?.text });
      else await loadDetail();
    }
    emit("changed");
    return true;
  } catch (e) { if (selectedKey.value === key) error.value = e.message; return false; }
}
watch(selectedKey, (key, previous) => { if (key?.task !== previous?.task || key?.member !== previous?.member) selected.value = null; void loadDetail(); }, { immediate: true });
watch(() => props.members, () => { if (selectedKey.value) void loadDetail(); });
onBeforeUnmount(() => { version++; });
</script>
<template>
  <aside class="group-work" aria-label="工作面板">
    <header class="panel-head">
      <button v-if="selectedKey" type="button" class="icon sm" aria-label="返回任务列表" @click="emit('exit')"><Icon name="back" :size="16" /></button>
      <h3>工作面板</h3>
      <button type="button" class="icon sm" aria-label="收起工作面板" @click="emit('close')"><Icon name="close" :size="16" /></button>
    </header>
    <p v-if="error" class="banner error" role="alert">{{ error }}</p>
    <div v-if="selectedKey" class="panel-scroll detail" :aria-busy="detailLoading">
      <p v-if="detailLoading && !selected" class="panel-empty">正在读取任务…</p>
      <template v-if="selected">
        <p class="panel-empty access-note"><Icon name="lock" :size="12" />{{ selected.canControl ? '你可以操作此任务' : '只读 · 仅发起人和牛马归属人可操作' }}<button v-if="owned()" type="button" class="link" @click="emit('open', { employeeId: selectedKey.member, taskId: selectedKey.task })">打开任务会话</button></p>
        <TaskDetail :key="selected.id" :task="selected" :employee-id="selectedKey.member" :readonly="!selected.canControl" :act="control" @inspect="emit('inspect', $event)" />
      </template>
    </div>
    <div v-else class="panel-scroll">
      <p v-if="loading && !members?.length" class="panel-empty"><span class="spinner" aria-hidden="true"></span>加载中…</p>
      <p v-else-if="!members?.length" class="panel-empty">群里还没有牛马。</p>
      <section v-for="member in members" :key="member.id" class="member-section">
        <h4><span class="member-avatar"><EmployeeAvatar :employee-id="member.id" :name="member.name" :avatar="member.avatar" /></span>{{ member.name }}<small v-if="member.mine">我的</small><span class="count">{{ member.tasks.length }}</span></h4>
        <p v-if="!member.tasks.length" class="panel-empty">还没有群里发起的任务。</p>
        <button v-for="task in member.tasks" :key="task.id" type="button" class="task-row" :data-task-id="task.id" @click="open(member, task)">
          <span class="task-row-head"><span :class="['badge', taskTone(task.status)]">{{ taskLabel(task.status) }}</span><time>{{ shortTime(task.createdAt) }}</time></span>
          <strong>{{ task.text }}</strong>
          <span class="task-row-meta">{{ requester(task) }} 发起</span>
          <span v-if="note(task)" class="task-row-note">{{ note(task) }}</span>
          <span v-if="planProgress(task.plan)" class="mini-progress" :title="`计划 ${planProgress(task.plan).done}/${planProgress(task.plan).total}`"><span :style="{ width: planProgress(task.plan).percent + '%' }"></span></span>
        </button>
        <p v-if="member.endedHidden" class="panel-empty">更早结束的 {{ member.endedHidden }} 个任务未显示。</p>
      </section>
    </div>
  </aside>
</template>
<style scoped>
.group-work { display: flex; flex-direction: column; flex: none; min-height: 0; width: min(clamp(340px, 30vw, 560px), 50%); border-left: 1px solid var(--border); background: var(--bg); }
.panel-head { display: flex; align-items: center; gap: 8px; flex: none; height: 44px; padding: 0 8px 0 16px; border-bottom: 1px solid var(--border); }
.panel-head h3 { flex: 1; font-size: 13px; }
.panel-scroll { flex: 1; min-height: 0; overflow-y: auto; padding: 4px 12px 16px; scrollbar-width: thin; }
.panel-scroll.detail { display: flex; flex-direction: column; padding: 0; }
.member-section h4 { display: flex; align-items: center; gap: 8px; margin: 12px 4px 8px; color: var(--text-2); font-size: 12px; }
.member-section h4 small { color: var(--muted); font-weight: 400; }
.member-section h4 .count { margin-left: auto; }
.member-avatar { display: inline-grid; width: 22px; height: 22px; }
.task-row { display: grid; grid-template-columns: minmax(0, 1fr); justify-content: stretch; gap: 4px; width: 100%; height: auto; margin-bottom: 6px; padding: 10px 12px; border: 1px solid var(--border); border-radius: var(--r-md); background: var(--surface); font-weight: 400; text-align: left; white-space: normal; overflow-wrap: anywhere; }
.task-row:hover:not(:disabled) { border-color: var(--border-strong); background: var(--surface); box-shadow: var(--sh-sm); }
.task-row-head { display: flex; align-items: center; justify-content: space-between; }
.task-row time, .task-row-meta { color: var(--muted); font-size: 11px; }
.task-row strong { display: -webkit-box; overflow: hidden; color: var(--text); font-size: 13px; font-weight: 500; line-height: 1.45; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.task-row-note { display: -webkit-box; overflow: hidden; color: var(--muted); font-size: 12px; line-height: 1.5; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.mini-progress { display: block; height: 3px; margin-top: 2px; overflow: hidden; border-radius: 2px; background: var(--surface-3); }
.mini-progress span { display: block; height: 100%; border-radius: 2px; background: var(--accent); }
.panel-empty { display: flex; gap: 8px; padding: 8px 4px; color: var(--muted); font-size: 12px; line-height: 1.55; }
.group-work:has(.detail) { width: min(clamp(500px, 38vw, 680px), 50%); }
.panel-scroll.detail :deep(.task-detail) { flex: 1 0 auto; padding: 12px 16px 0; min-height: 0; }
.panel-scroll.detail :deep(.detail-foot) { position: sticky; bottom: 0; z-index: 1; margin-inline: -16px; padding: 10px 16px max(10px, env(safe-area-inset-bottom, 0px)); background: var(--bg); }
.panel-scroll.detail :deep(.detail-foot:not(:has(button, .hint))) { display: none; }
.access-note { align-items: center; margin: 0; padding: 10px 16px 0; }
@media (max-width: 767px) { .group-work, .group-work:has(.detail) { position: absolute; z-index: 20; top: 52px; right: 0; bottom: 0; width: min(460px, 100%); box-shadow: var(--sh-lg); } }
</style>
