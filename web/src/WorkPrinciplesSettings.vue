<script setup vapor>
import { ref, watch } from "vue";
const props = defineProps({ api: Function, config: Object });
const emit = defineEmits(["saved", "error", "notice"]);
const busy = ref(false);
const text = ref("");
watch(
  () => props.config,
  () => { text.value = props.config?.workPrinciples || ""; },
  { immediate: true },
);
async function save() {
  busy.value = true;
  try {
    const next = JSON.parse(JSON.stringify(props.config || {}));
    delete next.model;
    next.workPrinciples = text.value;
    emit("saved", await props.api("/config", "PUT", next));
    emit("notice", "公共工作原则已保存");
  } catch (e) {
    emit("error", e.message);
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <section class="card">
    <div class="card-head row">
      <div>
        <h3>公共工作原则</h3>
        <p class="hint">全局（global）设置，对所有牛马生效。每只牛马在自己的设置里写的私有工作原则会接在这段后面，补充这里的内容，不会替换或隐藏它。留空时，各牛马仍只使用自己的私有原则。</p>
      </div>
      <button class="primary sm" :disabled="busy" @click="save">保存</button>
    </div>
    <label class="principles">
      <span>公共工作原则</span>
      <textarea v-model="text" rows="10" maxlength="8000" aria-label="公共工作原则" placeholder="例如：先核对事实再下结论；不扩大用户没有给出的授权；完成后说明实际验证结果。"></textarea>
    </label>
  </section>
</template>
<style scoped>
.principles { display: grid; gap: 8px; font-size: 13px; font-weight: 500; }
.principles textarea { width: 100%; min-height: 180px; padding: 10px 12px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); color: var(--text); font: inherit; font-weight: 400; line-height: 1.5; resize: vertical; }
</style>
