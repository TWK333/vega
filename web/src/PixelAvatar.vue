<script>
// Track the most recently chosen clip per role across instances so different employees with the same role vary too.
const lastClipByRole = new Map();
</script>
<script setup vapor>
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { PIXEL_GRID_SIZE, getPixelSprite, pickRandomAnimation, renderPixelFrame } from "./pixel-avatar.js";

const props = defineProps({ role: String, hex: String, animate: Boolean, clip: String });
const emit = defineEmits(["clip"]);
const sprite = computed(() => getPixelSprite(props.role));
const color = computed(() => props.hex || "#3878fb");
const activeClipId = ref("idle");
const frameIndex = ref(0);
const frame = computed(() => renderPixelFrame(sprite.value.id, color.value, frameIndex.value, activeClipId.value));
const root = ref(null);
const playing = ref(false);
const reduced = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

let timer = 0, onScreen = true, observer, lastOwnClipId = "", loopsLeft = 0;

function currentClip() {
  const clips = sprite.value.animations;
  return clips.find((item) => item.id === activeClipId.value) || clips[0];
}

function chooseClip() {
  const clips = sprite.value.animations;
  if (props.clip) {
    const forced = clips.find((item) => item.id === props.clip);
    if (forced) return forced;
  }
  const peerClip = lastClipByRole.get(sprite.value.id);
  const filtered = clips.filter((item) => item.id !== lastOwnClipId && item.id !== peerClip);
  const picked = filtered.length
    ? filtered[Math.floor(Math.random() * filtered.length)]
    : pickRandomAnimation(sprite.value.id, lastOwnClipId);
  lastOwnClipId = picked.id;
  lastClipByRole.set(sprite.value.id, picked.id);
  return picked;
}

function startClip(clipObj, stagger = false) {
  activeClipId.value = clipObj.id;
  frameIndex.value = 0;
  // Play 2 cycles of each gag animation before rotating to another random occupation clip.
  loopsLeft = props.clip ? Number.POSITIVE_INFINITY : 2;
  emit("clip", { id: clipObj.id, name: clipObj.name });
  const baseDelay = clipObj.durations[0] ?? 180;
  const firstDelay = stagger ? Math.round(baseDelay * (0.4 + Math.random() * 0.6)) : baseDelay;
  schedule(firstDelay);
}

function schedule(delay) {
  clearTimeout(timer);
  if (!playing.value) return;
  timer = setTimeout(() => {
    if (!playing.value) return;
    const clipObj = currentClip();
    const next = frameIndex.value + 1;
    if (next < clipObj.keyframes.length) {
      frameIndex.value = next;
      schedule(clipObj.durations[next] ?? 180);
      return;
    }
    loopsLeft -= 1;
    if (loopsLeft > 0) {
      frameIndex.value = 0;
      schedule(clipObj.durations[0] ?? 180);
      return;
    }
    // Brief calm resting beat before switching to another random occupation gag clip.
    activeClipId.value = "idle";
    frameIndex.value = 0;
    timer = setTimeout(() => {
      if (!playing.value) return;
      startClip(chooseClip(), false);
    }, 240 + Math.round(Math.random() * 200));
  }, delay);
}

function stop() {
  clearTimeout(timer);
  timer = 0;
  playing.value = false;
  activeClipId.value = "idle";
  frameIndex.value = 0;
}

/** Play a random occupation animation while running and visible; re-randomize on every run entry. */
function sync() {
  const play = !!props.animate && onScreen && !reduced();
  if (play === playing.value) return;
  stop();
  if (!play) return;
  playing.value = true;
  startClip(chooseClip(), true);
}

watch(() => props.animate, sync);
watch(() => props.clip, () => {
  if (playing.value) startClip(chooseClip(), false);
});
watch(() => sprite.value.id, () => {
  lastOwnClipId = "";
  if (playing.value) startClip(chooseClip(), false);
  else { activeClipId.value = "idle"; frameIndex.value = 0; }
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
    :data-clip="activeClipId"
    :data-frame="frameIndex"
    :data-color="color"
    :viewBox="`0 0 ${PIXEL_GRID_SIZE} ${PIXEL_GRID_SIZE}`"
    role="img"
    aria-hidden="true"
  >
    <rect x="0" y="0" :width="PIXEL_GRID_SIZE" :height="PIXEL_GRID_SIZE" rx="6.8" :fill="frame.bg" />
    <g shape-rendering="crispEdges">
      <path v-for="layer in frame.layers" :key="layer.key" :d="layer.d" :fill="layer.fill" />
    </g>
  </svg>
</template>
<style scoped>
.pixel-avatar { display: block; width: 100%; height: 100%; border-radius: inherit; image-rendering: pixelated; }
</style>
