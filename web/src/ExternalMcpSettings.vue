<script setup vapor>
import { onBeforeUnmount, onMounted, ref } from "vue";
import Icon from "./Icon.vue";
const props = defineProps({ api: Function, employees: Array });
const emit = defineEmits(["error", "notice"]);
const confirm = window.confirm.bind(window);
const busy = ref(false);
const configs = ref([]);
const groups = ref([]);
const revealed = ref({});
const creating = ref(blank());
let disposed = false;
function blank() {
  return { name: "", enabled: true, employees: [], groups: [] };
}
function people() {
  return props.employees || [];
}
function nameOf(list, id) {
  return list.find((item) => item.id === id)?.name || "";
}
async function run(fn) {
  if (busy.value) return;
  busy.value = true;
  try { await fn(); }
  catch (error) { if (!disposed) emit("error", error.message); }
  finally { busy.value = false; }
}
async function load() {
  const [mine, joined] = await Promise.all([props.api("/me/external-mcp"), props.api("/groups")]);
  if (disposed) return;
  configs.value = mine.configs;
  groups.value = joined;
}
function toggle(form, key, id) {
  form[key] = form[key].includes(id) ? form[key].filter((value) => value !== id) : [...form[key], id];
}
function showConfig({ config, token }) {
  revealed.value[config.id] = JSON.stringify({
    mcpServers: { vega: { url: config.url, headers: { Authorization: "Bearer " + token } } },
  }, null, 2);
}
async function copy(id) {
  try {
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(revealed.value[id]);
        emit("notice", "已复制配置");
        return;
      } catch { /* 非安全上下文或剪贴板权限受限时尝试选中文本复制。 */ }
    }
    const field = document.getElementById("mcp-json-" + id);
    field?.focus();
    field?.select();
    if (!field || !document.execCommand?.("copy")) throw Error();
    emit("notice", "已复制配置");
  } catch {
    emit("error", "复制失败，请手动选择文本复制");
  }
}
async function create() {
  if (!creating.value.employees.length && !creating.value.groups.length) {
    emit("error", "至少选择一个牛马或群聊");
    return;
  }
  await run(async () => {
    const result = await props.api("/me/external-mcp", "POST", creating.value);
    if (disposed) return;
    showConfig(result);
    configs.value = [result.config, ...configs.value];
    creating.value = blank();
    await load();
    emit("notice", "已创建。配置只显示这一次，请立刻复制。");
  });
}
async function save(item, form) {
  if (!form.employees.length && !form.groups.length) {
    emit("error", "至少选择一个牛马或群聊");
    return;
  }
  await run(async () => {
    await props.api("/me/external-mcp/" + item.id, "PATCH", { name: form.name, enabled: item.enabled, employees: form.employees, groups: form.groups });
    if (disposed) return;
    await load();
    emit("notice", "已保存");
  });
}
async function setEnabled(item, enabled) {
  await run(async () => {
    await props.api("/me/external-mcp/" + item.id, "PATCH", { enabled });
    if (!disposed) await load();
  });
}
async function rotate(item) {
  if (!confirm(`轮换「${item.name}」的令牌？旧令牌会立刻失效。`)) return;
  await run(async () => {
    const result = await props.api("/me/external-mcp/" + item.id + "/rotate", "POST", {});
    if (disposed) return;
    showConfig(result);
    await load();
    emit("notice", "新配置只显示这一次，请立刻复制。");
  });
}
async function revoke(item) {
  if (!confirm(`吊销「${item.name}」的令牌？吊销后必须轮换才能再连接。`)) return;
  await run(async () => {
    await props.api("/me/external-mcp/" + item.id + "/revoke", "POST", {});
    if (disposed) return;
    delete revealed.value[item.id];
    await load();
  });
}
async function remove(item) {
  if (!confirm(`删除对外 MCP「${item.name}」？已有的对话记录仍留在牛马和群聊里。`)) return;
  await run(async () => {
    await props.api("/me/external-mcp/" + item.id, "DELETE");
    if (disposed) return;
    delete revealed.value[item.id];
    await load();
  });
}
onMounted(() => void run(load));
onBeforeUnmount(() => { disposed = true; revealed.value = {}; });
</script>
<template>
  <div class="external-mcp">
    <section class="card">
      <div class="card-head">
        <h3>对外 MCP</h3>
        <p class="hint">让 Cursor、Claude 等外部客户端连接你已经能对话的牛马和群聊，只能看到你勾选的对象。这和牛马「技能 / MCP 客户端」不是一回事：那边是牛马去调用外部服务，这里是外部客户端来找你的牛马。</p>
      </div>
      <p class="callout info"><Icon name="plug" :size="14" /><span>创建后复制 JSON 到支持 Streamable HTTP 的客户端。配置包含访问凭据，请妥善保管。</span></p>
    </section>
    <section class="card">
      <div class="card-head row"><div><h3>新建连接</h3><p class="hint">名称只用于你自己区分。配置仅在创建或轮换时显示，服务端不保存明文令牌。</p></div></div>
      <form class="form-grid" @submit.prevent="create">
        <label>名称<input v-model="creating.name" required maxlength="40" placeholder="例如：我的 Cursor" :disabled="busy" /></label>
        <label class="check"><input v-model="creating.enabled" type="checkbox" :disabled="busy" />创建后立即启用</label>
        <div class="targets">
          <div>
            <span class="field-label">牛马</span>
            <div class="checks">
              <p v-if="!people().length" class="hint">还没有你的牛马</p>
              <label v-for="employee in people()" :key="employee.id" class="check"><input type="checkbox" :checked="creating.employees.includes(employee.id)" :disabled="busy" @change="toggle(creating, 'employees', employee.id)" /><span>{{ employee.name }}</span></label>
            </div>
          </div>
          <div>
            <span class="field-label">群聊</span>
            <div class="checks">
              <p v-if="!groups.length" class="hint">还没有你加入的群聊</p>
              <label v-for="group in groups" :key="group.id" class="check"><input type="checkbox" :checked="creating.groups.includes(group.id)" :disabled="busy" @change="toggle(creating, 'groups', group.id)" /><span>{{ group.name }}</span></label>
            </div>
          </div>
        </div>
        <button class="primary" type="submit" :disabled="busy">创建并显示配置</button>
      </form>
    </section>
    <p v-if="!configs.length" class="empty-state">还没有对外 MCP</p>
    <section v-for="item in configs" :key="item.id" class="card">
      <div class="card-head row">
        <div>
          <h3>{{ item.name }}</h3>
          <p class="hint">{{ item.revoked ? "已吊销" : item.enabled ? "启用中" : "已停用" }}</p>
        </div>
        <div class="actions">
          <button type="button" class="sm" :disabled="busy" @click="setEnabled(item, !item.enabled)">{{ item.enabled ? "停用" : "启用" }}</button>
          <button type="button" class="sm" :disabled="busy" @click="rotate(item)">轮换令牌</button>
          <button type="button" class="sm" :disabled="busy || item.revoked" @click="revoke(item)">吊销</button>
          <button type="button" class="sm danger-text" :disabled="busy" @click="remove(item)">删除</button>
        </div>
      </div>
      <div v-if="revealed[item.id]" class="callout info config-reveal">
        <Icon name="plug" :size="14" />
        <div>
          <p>配置只显示这一次，刷新或离开后无法再查看，请复制并妥善保存。</p>
          <textarea :id="'mcp-json-' + item.id" class="config-json" readonly spellcheck="false" :value="revealed[item.id]" :aria-label="item.name + ' MCP 配置 JSON'"></textarea>
          <div class="config-actions"><button type="button" class="sm" @click="copy(item.id)">复制 JSON</button><button type="button" class="link" @click="delete revealed[item.id]">我已保存，不再显示</button></div>
        </div>
      </div>
      <p v-else class="hint">配置仅在创建或轮换时显示；未保存可轮换令牌重新生成。</p>
      <form class="form-grid" @submit.prevent="save(item, item)">
        <label>名称<input v-model="item.name" required maxlength="40" :disabled="busy" /></label>
        <div class="targets">
          <div>
            <span class="field-label">牛马</span>
            <div class="checks">
              <label v-for="employee in people()" :key="employee.id" class="check"><input type="checkbox" :checked="item.employees.includes(employee.id)" :disabled="busy" @change="toggle(item, 'employees', employee.id)" /><span>{{ employee.name }}</span></label>
              <label v-for="id in item.employees.filter((id) => !nameOf(people(), id))" :key="id" class="check"><input type="checkbox" checked :disabled="busy" @change="toggle(item, 'employees', id)" /><span>已不可用的牛马 {{ id }}</span></label>
            </div>
          </div>
          <div>
            <span class="field-label">群聊</span>
            <div class="checks">
              <label v-for="group in groups" :key="group.id" class="check"><input type="checkbox" :checked="item.groups.includes(group.id)" :disabled="busy" @change="toggle(item, 'groups', group.id)" /><span>{{ group.name }}</span></label>
              <label v-for="id in item.groups.filter((id) => !nameOf(groups, id))" :key="id" class="check"><input type="checkbox" checked :disabled="busy" @change="toggle(item, 'groups', id)" /><span>已不可用的群聊 {{ id }}</span></label>
            </div>
          </div>
        </div>
        <button class="primary sm" type="submit" :disabled="busy">保存修改</button>
      </form>
    </section>
  </div>
</template>
<style scoped>
.external-mcp { display: grid; gap: 16px; }
.external-mcp > .card { margin-top: 0; }
.field-label { display: block; margin-bottom: 6px; font-size: 13px; font-weight: 500; }
.targets { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.checks { display: grid; align-content: start; gap: 6px; max-height: 180px; overflow: auto; padding: 8px; border: 1px solid var(--border); border-radius: 8px; }
.check { display: flex; align-items: center; gap: 8px; font-weight: 500; }
.actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 6px; }
.config-reveal { margin: 12px 0; }
.config-reveal > div { flex: 1; min-width: 0; }
.config-reveal p { margin: 0 0 8px; }
.config-json { display: block; width: 100%; min-height: 12em; resize: vertical; font: 12px/1.6 var(--mono); }
.config-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-top: 8px; }
@media (max-width: 699px) { .targets { grid-template-columns: minmax(0, 1fr); } .actions { justify-content: flex-start; } }
</style>
