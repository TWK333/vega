<script setup vapor>
import { onBeforeUnmount, onMounted, ref } from "vue";
import Icon from "./Icon.vue";
const props = defineProps({ api: Function });
const emit = defineEmits(["error", "notice"]);
const base = "/me/triggers";
const blank = () => ({ name: "", enabled: true, condition: "employee_message", action: "http", url: "", headers: "", body: JSON.stringify({ msgtype: "text", text: { content: "【{{employeeName}}】\n{{message}}\n{{taskLinks}}" } }, null, 2) });
const entries = ref([]), form = ref(blank()), busy = ref(false), droppedAt = ref(null);
let disposed = false;
async function run(fn) {
  if (busy.value) return;
  busy.value = true;
  try { await fn(); } catch (error) { if (!disposed) emit("error", error.message); }
  finally { busy.value = false; }
}
async function load() { const value = await props.api(base); if (!disposed) { entries.value = value.triggers; droppedAt.value = value.droppedAt; } }
function reset() { form.value = blank(); }
function edit(item) { form.value = { ...item, url: "", headers: "" }; }
async function save() {
  await run(async () => {
    await props.api(base, "POST", form.value);
    if (disposed) return;
    reset(); await load(); emit("notice", "触发器已保存");
  });
}
async function toggle(item) {
  await run(async () => { await props.api(base + "/" + encodeURIComponent(item.id), "PATCH", { enabled: !item.enabled }); if (!disposed) await load(); });
}
async function remove(item) {
  if (!window.confirm(`删除触发器「${item.name}」？`)) return;
  await run(async () => { await props.api(base + "/" + encodeURIComponent(item.id), "DELETE"); if (disposed) return; if (form.value.id === item.id) reset(); await load(); });
}
onMounted(() => void run(load));
onBeforeUnmount(() => { disposed = true; });
</script>
<template>
  <div class="trigger-settings">
    <section class="card">
      <div class="card-head row"><div><h3>触发器 · {{ entries.length }} 条</h3><p class="hint">你的牛马在私聊或群聊中发送消息时，自动向指定接口发送一次 POST 请求。包括任务进度、交付和提问，不包含思考和工具输出。</p></div><button type="button" class="sm" :disabled="busy" @click="run(load)">刷新状态</button></div>
      <p class="callout info">启用后，消息内容会自动发送给接口接收方，请确认地址和请求体。仅支持公网 HTTP(S)，建议使用 HTTPS；停用不会撤回已发出的请求。调用失败不自动重试，接口地址和请求头加密保存。</p>
      <p v-if="droppedAt" class="callout" role="alert">{{ new Date(droppedAt).toLocaleString() }} 因待处理的触发过多跳过了消息，不会自动补发。</p>
      <form class="form-grid two trigger-form" @submit.prevent="save">
        <label>名称<input v-model="form.name" required maxlength="80" placeholder="例如：推送到企业微信" /></label>
        <label>触发条件<select v-model="form.condition"><option value="employee_message">牛马发送消息</option></select></label>
        <label>执行动作<select v-model="form.action"><option value="http">调用接口（POST JSON）</option></select></label>
        <label class="check"><input v-model="form.enabled" type="checkbox" />启用触发器</label>
        <label class="span-2">接口地址<input v-model="form.url" type="password" autocomplete="off" :required="!form.id" maxlength="4096" :placeholder="form.id ? '已加密，留空保留原地址' : 'https://…'" /></label>
        <label class="span-2">请求头 JSON（可选）<textarea v-model="form.headers" rows="3" maxlength="16000" autocomplete="off" spellcheck="false" :placeholder="form.id ? '留空保留原请求头，填 {} 清空' : '{&quot;Authorization&quot;: &quot;Bearer …&quot;}'"></textarea></label>
        <label class="span-2">请求体 JSON<textarea v-model="form.body" required rows="7" maxlength="16000" spellcheck="false"></textarea><small class="hint">在 JSON 字符串内使用 <code v-pre>{{message}}</code>（消息文字）、<code v-pre>{{employeeName}}</code>（牛马名称）、<code v-pre>{{employeeId}}</code>、<code v-pre>{{groupName}}</code>（私聊为空）和 <code v-pre>{{taskLinks}}</code>（关联任务链接，没有任务时为空）。纯附件或任务卡消息的文字为空，附件本身不会发送。默认请求体适用于企业微信机器人；其单条消息长度限制由企业微信决定。</small></label>
        <div class="span-2 actions end"><button v-if="form.id" type="button" class="sm" @click="reset">取消编辑</button><button class="primary sm" :disabled="busy"><Icon name="check" :size="14" />{{ form.id ? '保存修改' : '新建触发器' }}</button></div>
      </form>
      <p v-if="!entries.length" class="empty-state">还没有触发器</p>
      <ul v-else class="item-list">
        <li v-for="item in entries" :key="item.id"><span class="item-text"><strong>{{ item.name }}</strong><small>{{ item.enabled ? '已启用' : '已停用' }} · 牛马发送消息 → 调用接口</small><small v-if="item.lastAt">最近调用：{{ new Date(item.lastAt).toLocaleString() }} · {{ item.lastResult }}</small></span><button type="button" class="sm" :disabled="busy" @click="toggle(item)">{{ item.enabled ? '停用' : '启用' }}</button><button type="button" class="sm" :disabled="busy" @click="edit(item)">编辑</button><button type="button" class="sm danger-text" :disabled="busy" @click="remove(item)">删除</button></li>
      </ul>
    </section>
  </div>
</template>
<style scoped>
.trigger-settings { display: grid; gap: 16px; }
.trigger-settings > * { width: 100%; }
.trigger-form { margin: 16px 0; padding-bottom: 16px; border-bottom: 1px solid var(--border); }
.trigger-form textarea { font-family: var(--font-mono, monospace); }
.item-list { display: grid; margin: 0; padding: 0; list-style: none; }
.item-list li { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; padding: 10px 0; border-top: 1px solid var(--border); }
.item-text { display: grid; flex: 1; min-width: 160px; gap: 2px; }
.item-text small { color: var(--muted); overflow-wrap: anywhere; }
</style>
