<script setup vapor>
import Icon from "./Icon.vue";
defineProps({ quote: Object, name: String });
const emit = defineEmits(["jump", "remove"]);
</script>
<template>
  <div class="composer-quote">
    <Icon name="reply" :size="14" />
    <button type="button" @click="emit('jump', quote.seq)"><strong>回复 {{ quote.author?.name || (quote.role === 'user' ? '我' : name) }}</strong><span>{{ quote.text }}</span></button>
    <button type="button" class="icon sm" aria-label="取消引用" @click="emit('remove')"><Icon name="close" :size="14" /></button>
  </div>
</template>
<style scoped>
.composer-quote { display: flex; align-items: center; gap: 8px; margin: 0 0 6px; padding: 4px 4px 4px 10px; border-left: 3px solid var(--accent); border-radius: 4px var(--r-md) var(--r-md) 4px; background: var(--surface-2); color: var(--muted); }
.composer-quote > button:nth-child(2) { display: grid; justify-content: stretch; flex: 1; gap: 1px; min-width: 0; height: auto; min-height: 0; padding: 2px 0; border: 0; background: transparent; font-weight: 400; text-align: left; }
.composer-quote strong { color: var(--text-2); font-size: 11px; }
.composer-quote span { overflow: hidden; font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
</style>
