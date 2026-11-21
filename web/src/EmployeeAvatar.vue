<script setup vapor>
import { computed, ref, watch } from "vue";
import { employeeAvatarURL, resolvePixelAvatar } from "../../shared/employee-avatars";
import PixelAvatar from "./PixelAvatar.vue";
const props = defineProps({ employeeId: String, avatar: String, name: String, animate: Boolean });
const emit = defineEmits(["clip"]);
const failed = ref(false);
const url = computed(() => employeeAvatarURL(props.employeeId, props.avatar));
// Pixel citizen presets render inline; an empty (default) avatar, legacy bot preset, or broken image gets its own pixel citizen.
const pixel = computed(() => resolvePixelAvatar(props.avatar, props.employeeId || props.name || ""));
watch(url, () => { failed.value = false; });
</script>
<template>
  <span :class="['employee-picture', { 'is-pixel': !url || failed }]"><img v-if="url && !failed" :src="url" alt="" @error="failed = true" /><PixelAvatar v-else :role="pixel.role" :hex="pixel.hex" :animate="animate" @clip="emit('clip', $event)" /></span>
</template>
<style scoped>
.employee-picture { display: grid; place-items: center; width: 100%; height: 100%; min-width: 0; min-height: 0; overflow: hidden; border-radius: inherit; }
.employee-picture img { display: block; width: 100%; height: 100%; object-fit: cover; }
</style>
