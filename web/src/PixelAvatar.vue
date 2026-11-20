<script setup vapor>
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { getPixelSprite, renderPixelFrame } from "./pixel-avatar.js";

const props = defineProps({ role: String, hex: String, animate: Boolean });
const sprite = computed(() => getPixelSprite(props.role));
const color = computed(() => props.hex || "#3878fb");
const frameIndex = ref(0);
const frame = computed(() => renderPixelFrame(sprite.value.id, color.value, frameIndex.value));
const root = ref(null);
const playing = ref(false);
const reduced = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

let timer = 0, onScreen = true, observer;

function schedule(delay) {
  clearTimeout(timer);
  if (!playing.value) return;
  timer = setTimeout(() => {
    if (!playing.value) return;
    const total = sprite.value.frames.length;
    frameIndex.value = (frameIndex.value + 1) % total;
    const durations = sprite.value.durations;
    schedule(durations[frameIndex.value] ?? 260);
  }, delay);
}

function stop() {
  clearTimeout(timer);
  timer = 0;
  playing.value = false;
  frameIndex.value = 0;
}

/** Play this citizen's own independent pixel animation while active and visible on screen. */
function sync() {
  const play = !!props.animate && onScreen && !reduced();
  if (play === playing.value) return;
  stop();
  if (!play) return;
  playing.value = true;
  // Stagger start slightly so multiple citizens on screen animate independently rather than in lockstep.
  const firstDelay = (sprite.value.durations[0] ?? 260) * (0.4 + Math.random() * 0.6);
  schedule(Math.round(firstDelay));
}

watch(() => props.animate, sync);
watch(() => sprite.value.id, () => {
  frameIndex.value = 0;
  if (playing.value) schedule(sprite.value.durations[0] ?? 260);
});

onMounted(() => {
  if (typeof IntersectionObserver === "function" && root.value) {
    observer = new IntersectionObserver((entries) => {
      onScreen = entries.at(-1).isIntersecting;
      sync();
    });
    observer.observe(root.value);
  }
  sync();
});

onBeforeUnmount(() => {
  stop();
  observer?.disconnect();
});
</script>
<template>
  <svg
    ref="root"
    :class="['pixel-avatar', { animate: playing }]"
    :data-playing="playing ? '' : undefined"
    :data-role="sprite.id"
    :data-gender="sprite.gender"
    :data-frame="frameIndex"
    :data-color="color"
    viewBox="0 0 20 20"
    role="img"
    aria-hidden="true"
  >
    <rect x="0" y="0" width="20" height="20" rx="4.2" :fill="frame.bg" />
    <g shape-rendering="crispEdges">
      <path v-for="layer in frame.layers" :key="layer.key" :d="layer.d" :fill="layer.fill" />
    </g>
  </svg>
</template>
<style scoped>
.pixel-avatar { display: block; width: 100%; height: 100%; border-radius: inherit; image-rendering: pixelated; }
</style>
