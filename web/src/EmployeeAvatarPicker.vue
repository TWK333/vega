<script setup vapor>
import { computed, ref, watch } from "vue";
import Icon from "./Icon.vue";
import EmployeeAvatar from "./EmployeeAvatar.vue";
import PixelAvatar from "./PixelAvatar.vue";
import { getPixelSprite } from "./pixel-avatar.js";
import {
  PIXEL_AVATAR_COLORS,
  PIXEL_AVATAR_GENDERS,
  PIXEL_AVATAR_ROLES,
  parsePixelAvatar,
  pixelAvatarPreset,
  resolvePixelAvatar,
} from "../../shared/employee-avatars";

const props = defineProps({ api: Function, employeeId: String, avatar: String, name: String });
const emit = defineEmits(["change"]);
const busy = ref(false), error = ref(""), fileInput = ref(null), genderFilter = ref("all"), previewClip = ref(""), playingAction = ref("");

// The color row and character grid edit one `pixel:<role>:<color>` preset; start from the current resolved citizen.
const current = computed(() => parsePixelAvatar(props.avatar));
const draft = computed(() => resolvePixelAvatar(props.avatar, props.employeeId || props.name || ""));
const activeRole = computed(() => PIXEL_AVATAR_ROLES.find((item) => item.id === draft.value.role) || PIXEL_AVATAR_ROLES[0]);
const activeClips = computed(() => getPixelSprite(draft.value.role).animations);
const colorHex = computed(() => PIXEL_AVATAR_COLORS.find((color) => color.id === draft.value.color)?.hex || "#3878fb");
const visibleRoles = computed(() => genderFilter.value === "all" ? PIXEL_AVATAR_ROLES : PIXEL_AVATAR_ROLES.filter((role) => role.gender === genderFilter.value));

watch(() => draft.value.role, () => { previewClip.value = ""; playingAction.value = ""; });

function defaultHexOf(role) {
  return PIXEL_AVATAR_COLORS.find((color) => color.id === role.defaultColor)?.hex || colorHex.value;
}
function cardHex(role) {
  return draft.value.role === role.id ? colorHex.value : defaultHexOf(role);
}
function genderCount(id) {
  return id === "all" ? PIXEL_AVATAR_ROLES.length : PIXEL_AVATAR_ROLES.filter((role) => role.gender === id).length;
}
function togglePreviewClip(id) {
  previewClip.value = previewClip.value === id ? "" : id;
}

async function save(payload) {
  if (busy.value) return;
  busy.value = true; error.value = "";
  try { emit("change", await props.api(`/employees/${props.employeeId}/avatar`, "POST", payload)); }
  catch (failure) { error.value = failure.message; }
  finally { busy.value = false; }
}
async function choose(preset) { if ((props.avatar || "") !== preset) await save({ preset }); }
const pickRole = (role) => choose(pixelAvatarPreset(role.id, current.value ? draft.value.color : role.defaultColor));
const pickColor = (color) => choose(pixelAvatarPreset(draft.value.role, color));

async function upload(event) {
  const file = event.target.files?.[0];
  event.target.value = "";
  if (!file) return;
  if (!["image/png", "image/jpeg", "image/webp", "image/gif"].includes(file.type) || file.size > 5 * 1024 * 1024) { error.value = "请使用 5MiB 以内的 PNG、JPEG、WebP 或 GIF 图片"; return; }
  busy.value = true;
  try {
    const data = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result.split(",")[1]); reader.onerror = () => reject(Error("读取头像失败")); reader.readAsDataURL(file); });
    busy.value = false;
    await save({ mime: file.type, data });
  } catch (failure) { error.value = failure.message; }
  finally { busy.value = false; }
}
</script>
<template>
  <section class="card avatar-picker" aria-label="热心市民头像" :aria-busy="busy">
    <div class="avatar-head">
      <span class="avatar-current" aria-hidden="true">
        <EmployeeAvatar v-if="!previewClip" :employee-id="employeeId" :name="name" :avatar="avatar" :animate="true" @clip="playingAction = $event.name" />
        <PixelAvatar v-else :role="draft.role" :hex="colorHex" :animate="true" :clip="previewClip" @clip="playingAction = $event.name" />
      </span>
      <div class="avatar-text">
        <div class="avatar-title-row">
          <h3>像素小人头像</h3>
          <span class="role-badge">{{ activeRole.name }} · {{ activeRole.gender === "female" ? "女" : "男" }} · {{ playingAction || activeRole.action }}</span>
        </div>
        <p class="hint">每位像素小人都有 {{ activeClips.length }} 组职业专属恶搞动画，任务运行中会随机切换播放。</p>
        <div class="clip-pills" role="group" aria-label="预览职业动画">
          <button v-for="item in activeClips" :key="item.id" type="button" :class="['clip-pill', { selected: previewClip === item.id }]" :aria-pressed="previewClip === item.id" @click="togglePreviewClip(item.id)">{{ item.name }}</button>
        </div>
      </div>
    </div>

    <div class="color-row" role="group" aria-label="头像主题色">
      <button v-for="color in PIXEL_AVATAR_COLORS" :key="color.id" type="button" :class="['swatch', { selected: current?.color === color.id }]" :style="{ '--swatch': color.hex }" :aria-pressed="current?.color === color.id" :aria-label="'使用' + color.name" :title="color.name" :disabled="busy" @click="pickColor(color.id)"></button>
    </div>

    <div class="gender-tabs" role="group" aria-label="按性别筛选像素小人">
      <button v-for="tab in PIXEL_AVATAR_GENDERS" :key="tab.id" type="button" :class="['gender-tab', { selected: genderFilter === tab.id }]" :aria-pressed="genderFilter === tab.id" @click="genderFilter = tab.id">{{ tab.name }}<span class="tab-count">{{ genderCount(tab.id) }}</span></button>
    </div>

    <div class="role-grid" role="group" aria-label="像素小人职业">
      <button
        v-for="role in visibleRoles"
        :key="role.id"
        type="button"
        :class="['role-card', { selected: current?.role === role.id }]"
        :aria-pressed="current?.role === role.id"
        :aria-label="'使用' + role.name + '像素小人'"
        :title="role.name + '（' + (role.gender === 'female' ? '女' : '男') + ' · ' + role.actions.join(' / ') + '）'"
        :disabled="busy"
        @click="pickRole(role)"
      >
        <span class="role-sprite" aria-hidden="true"><PixelAvatar :role="role.id" :hex="cardHex(role)" :animate="true" /></span>
        <span class="role-name">{{ role.name }}</span>
        <span class="role-action">{{ role.actions.length }} 组动画</span>
      </button>
    </div>

    <div class="avatar-actions">
      <button type="button" class="sm" :disabled="busy" @click="fileInput.click()"><Icon name="image" :size="14" />上传图片</button>
      <button type="button" class="sm ghost" :disabled="busy || !avatar" @click="choose('')">恢复默认头像</button>
    </div>
    <input ref="fileInput" type="file" hidden accept="image/png,image/jpeg,image/webp,image/gif" aria-label="上传热心市民头像" :disabled="busy" @change="upload" />
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <p v-else class="hint foot">{{ busy ? '正在保存头像…' : '自定义图片会裁为正方形，GIF 取首帧；支持 PNG、JPEG、WebP、GIF，最大 5MiB。' }}</p>
  </section>
</template>
<style scoped>
.avatar-head { display: flex; align-items: flex-start; gap: 12px; }
.avatar-current { display: grid; place-items: center; flex: none; width: 64px; height: 64px; overflow: hidden; border-radius: 14px; background: var(--accent-soft); color: var(--accent-text); font-size: 22px; font-weight: 600; }
.avatar-text { min-width: 0; flex: 1; }
.avatar-title-row { display: flex; align-items: center; flex-wrap: wrap; gap: 6px 8px; margin-bottom: 2px; }
.avatar-text h3 { font-size: 14px; }
.role-badge { padding: 1px 7px; border-radius: 999px; background: var(--surface-2); color: var(--text-2); font-size: 11px; font-weight: 500; }
.clip-pills { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px; }
.clip-pill { height: 22px; min-height: 0; padding: 0 7px; border: 1px solid var(--border); border-radius: 999px; background: var(--surface); color: var(--text-2); font-size: 11px; font-weight: 400; }
.clip-pill:hover:not(:disabled) { border-color: var(--accent); color: var(--accent-text); }
.clip-pill.selected { border-color: var(--accent); background: var(--accent-soft); color: var(--accent-text); font-weight: 500; }
.color-row { display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); gap: 6px 4px; margin: 14px 0 12px; }
.swatch { justify-self: center; width: 28px; height: 28px; min-height: 0; padding: 0; border: 0; border-radius: 50%; background: var(--swatch); box-shadow: inset 0 0 0 1px rgb(0 0 0 / .08); }
.swatch.selected { box-shadow: 0 0 0 2px var(--surface), 0 0 0 4px var(--swatch); }
.gender-tabs { display: flex; flex-wrap: wrap; gap: 6px; margin: 0 0 10px; }
.gender-tab { display: inline-flex; align-items: center; gap: 5px; height: 28px; min-height: 0; padding: 0 10px; border: 1px solid var(--border); border-radius: 999px; background: var(--surface); color: var(--text-2); font-size: 12px; font-weight: 500; }
.gender-tab:hover:not(:disabled) { border-color: var(--border-strong); color: var(--text); }
.gender-tab.selected { border-color: var(--accent); background: var(--accent-soft); color: var(--accent-text); }
.tab-count { font-size: 11px; opacity: .72; }
.role-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 8px; }
.role-card { display: flex; flex-direction: column; align-items: center; gap: 3px; height: auto; min-height: 0; padding: 8px 4px 7px; border: 2px solid transparent; border-radius: 12px; background: var(--surface-2); color: var(--text); transition: background .12s, border-color .12s; }
.role-card:hover:not(:disabled) { background: var(--accent-softer); }
.role-card.selected { border-color: var(--accent); background: var(--accent-soft); }
.role-sprite { display: grid; place-items: center; width: 48px; height: 48px; border-radius: 10px; overflow: hidden; }
.role-name { font-size: 12px; font-weight: 600; line-height: 1.25; }
.role-action { color: var(--muted); font-size: 10px; line-height: 1.2; }
.avatar-actions { display: flex; gap: 6px; flex-wrap: wrap; margin: 12px 0 0; }
.foot { margin-top: 10px; font-size: 11px; }
@media (max-width: 640px) {
  .color-row { grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 10px 4px; }
  .role-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; }
}
@media (max-width: 420px) {
  .role-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
</style>
