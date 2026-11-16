<script setup vapor>
import { onMounted, ref } from "vue";
const props = defineProps({ requestId: String, api: Function, user: Object });
const emit = defineEmits(["done", "switch-account"]);
const request = ref(null), error = ref(""), busy = ref(false), result = ref("");
onMounted(async () => {
  try { request.value = await props.api("/local-agent/device/request?requestId=" + encodeURIComponent(props.requestId)); }
  catch (e) { error.value = e?.message || "授权请求不存在或已过期，请重新启动客户端。"; }
});
async function decide(approved) {
  if (busy.value) return;
  busy.value = true;
  error.value = "";
  try {
    const response = await props.api("/local-agent/device/decision", "POST", { requestId: props.requestId, approved });
    result.value = response.status === "approved" ? "已允许，客户端将直接连接本站。" : "已拒绝，客户端不会连接。";
  } catch (e) {
    request.value = null;
    error.value = (e?.message || "授权结果未确认") + "。请先查看客户端状态，不要重复授权。";
  }
  finally { busy.value = false; }
}
</script>
<template>
  <main class="authorize-page">
    <section class="authorize-card" aria-labelledby="authorize-title">
      <h1 id="authorize-title">授权本机客户端</h1>
      <p>当前账号：<strong>{{ user?.username }}</strong> <button type="button" class="link" @click="emit('switch-account')">切换账号</button></p>
      <p v-if="!request && !error" role="status">正在读取授权请求…</p>
      <template v-if="request && !result">
        <p>设备：<strong>{{ request.name }}</strong>（{{ request.platform }} · {{ request.clientId }}）</p>
        <p class="hint">授权请求在客户端发起后 10 分钟内有效。</p>
        <p>允许后，本站可让此设备读取和写入文件、执行命令、操作浏览器及电脑，也可能借用该设备的登录态、SSH 密钥和网络。请核对客户端设置里显示的设备尾号，只授权你刚刚启动并信任的客户端。</p>
        <p v-if="user?.role === 'viewer'" class="warning">只读账号不能授权执行设备，请切换有执行权限的账号。</p>
        <p v-else-if="request.status !== 'pending'" class="warning">此请求已处理，请查看客户端状态。</p>
        <div v-if="request.status === 'pending' && user?.role !== 'viewer'" class="actions">
          <button type="button" class="primary" :disabled="busy" @click="decide(true)">允许此设备</button>
          <button type="button" :disabled="busy" @click="decide(false)">拒绝</button>
        </div>
      </template>
      <p v-if="result" role="status">{{ result }}</p>
      <p v-if="error" class="warning" role="alert">{{ error }}</p>
      <button v-if="result || error || user?.role === 'viewer' || (request && request.status !== 'pending')" type="button" @click="emit('done')">返回工作台</button>
    </section>
  </main>
</template>
<style scoped>
.authorize-page { min-height: 100vh; display: grid; place-items: center; padding: 24px; background: var(--bg); }
.authorize-card { width: min(100%, 520px); padding: 28px; border: 1px solid var(--border); border-radius: var(--r-lg); background: var(--surface); }
.authorize-card h1 { margin: 0 0 16px; font-size: 22px; }
.authorize-card p { line-height: 1.7; overflow-wrap: anywhere; }
.actions { display: flex; flex-wrap: wrap; gap: 10px; margin: 20px 0; }
.link { border: 0; background: transparent; color: var(--accent); }
.warning { color: var(--danger); }
</style>
