<script setup vapor>
import { onMounted, ref } from "vue";
const props = defineProps({ api: Function });
const emit = defineEmits(["error", "notice"]);
const busy = ref(false), loaded = ref(false), text = ref("");
async function sync(save = false) {
  if (busy.value || (save && !loaded.value)) return;
  busy.value = true;
  try {
    const result = save
      ? await props.api("/me/work-principles", "PUT", { workPrinciples: text.value })
      : await props.api("/me/work-principles");
    text.value = result.workPrinciples;
    loaded.value = true;
    if (save) emit("notice", "公共工作原则已保存");
  } catch (e) {
    emit("error", e.message);
  } finally {
    busy.value = false;
  }
}
onMounted(() => void sync());
</script>
<template>
  <section class="card">
    <div class="card-head row">
      <div>
        <h3>公共工作原则</h3>
        <p class="hint">仅对你名下的牛马生效，下次对话或任务运行时使用。单只牛马的私有工作原则接在这段后面；留空时只使用各自的私有原则。</p>
      </div>
      <button v-if="loaded" class="primary sm" :disabled="busy" @click="sync(true)">{{ busy ? '保存中…' : '保存' }}</button>
      <button v-else class="sm" :disabled="busy" @click="sync()">{{ busy ? '加载中…' : '重新加载' }}</button>
    </div>
    <label class="principles">
      <span>公共工作原则</span>
      <textarea v-model="text" :disabled="busy || !loaded" rows="10" maxlength="8000" aria-label="公共工作原则" placeholder="例如：先核对事实再下结论；不扩大用户没有给出的授权；完成后说明实际验证结果。"></textarea>
    </label>
  </section>
</template>
<style scoped>
.principles { display: grid; gap: 8px; font-size: 13px; font-weight: 500; }
.principles textarea { width: 100%; min-height: 180px; padding: 10px 12px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); color: var(--text); font: inherit; font-weight: 400; line-height: 1.5; resize: vertical; }
</style>
