import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import {
  ZODIAC_AVATARS,
  BOT_AVATAR_SHAPES,
  BOT_AVATAR_COLORS,
  PIXEL_AVATAR_ROLES,
  PIXEL_AVATAR_COLORS,
  PIXEL_AVATAR_GENDERS,
  isAvatarPreset,
  employeeAvatarURL,
  parseBotAvatar,
  parsePixelAvatar,
  defaultBotAvatar,
  defaultPixelAvatar,
  resolvePixelAvatar,
  botAvatarPreset,
  pixelAvatarPreset,
  bubbleTint,
  avatarBubble,
} from "../shared/employee-avatars";
import {
  PIXEL_GRID_SIZE,
  RIG_PARTS,
  PIXEL_SPRITES,
  PIXEL_ROLE_IDS,
  composeKeyframe,
  renderPixelFrame,
  pickRandomAnimation,
  getPixelSprite,
  clearPixelFrameCache,
  getPixelFrameCacheSize,
  shade,
} from "../web/src/pixel-avatar.js";
import { updateEmployeeAvatar } from "../server/core/employee-avatar";
import { Employee, type EmployeeRuntime } from "../server/core/employee";
import { Store } from "../server/core/store";
import { Vault } from "../server/core/vault";

async function fixture() {
  const store = await Store.open(":memory:");
  const runtime: EmployeeRuntime = { run: async () => {}, cancel() {}, isRunning: () => false, emit() {}, config: () => ({ scenes: { lightweight: ["p/m"], coding: ["p/m"], computer: ["p/m"] }, model: "fixture/model" }) };
  const root = new Employee(store, new Vault(store), runtime); root.closed = true;
  const employee = await root.for((await root.create({ name: "Avatar employee", avatar: "zodiac:aries" }, "owner")).id);
  return { store, root, employee };
}

test("all 12 zodiac presets are real square WebP assets and avatar URLs never accept arbitrary paths or remote tracking URLs", async () => {
  assert.equal(ZODIAC_AVATARS.length, 12);
  assert.equal(new Set(ZODIAC_AVATARS.map(avatar => avatar.id)).size, 12);
  for (const avatar of ZODIAC_AVATARS) {
    const value = "zodiac:" + avatar.id;
    assert(isAvatarPreset(value));
    assert.equal(employeeAvatarURL("employee", value), `/avatars/zodiac/${avatar.id}.webp`);
    const metadata = await sharp(`web/public/avatars/zodiac/${avatar.id}.webp`).metadata();
    assert.equal(metadata.format, "webp");
    assert.equal(metadata.width, 512); assert.equal(metadata.height, 512);
  }
  assert.equal(employeeAvatarURL("employee", ""), "");
  const blob = "blob-" + "1".repeat(32);
  assert.equal(employeeAvatarURL("employee", blob), `/api/employees/employee/avatar?v=${blob}`);
  for (const value of ["https://tracker.example/avatar", "javascript:alert(1)", "data:image/svg+xml,...", "zodiac:../secret", "/api/blobs/" + blob, "zodiac:unknown"]) {
    assert.equal(isAvatarPreset(value), false);
    assert.equal(employeeAvatarURL("employee", value), "");
  }
});

test("64x64 rigged pixel citizens expose 7 skeletal parts with joint-arc poses, 100 smooth 12-20 frame keyframe animations, and (role,clip,frame,hex) caching", () => {
  assert.equal(PIXEL_GRID_SIZE, 64, "upgraded to 64×64 pixel grid");
  assert.deepEqual([...RIG_PARTS], ["head", "torso", "armL", "armR", "legL", "legR", "prop"]);
  assert(PIXEL_AVATAR_ROLES.length >= 20 && PIXEL_AVATAR_COLORS.length >= 12);
  assert.equal(new Set(PIXEL_AVATAR_ROLES.map(role => role.id)).size, PIXEL_AVATAR_ROLES.length);
  const females = PIXEL_AVATAR_ROLES.filter(role => role.gender === "female");
  const males = PIXEL_AVATAR_ROLES.filter(role => role.gender === "male");
  assert(females.length >= 8 && males.length >= 8, "both genders are well represented");
  assert.deepEqual(PIXEL_AVATAR_GENDERS.map(g => g.id), ["all", "female", "male"]);
  assert.deepEqual(PIXEL_ROLE_IDS, PIXEL_AVATAR_ROLES.map(role => role.id));

  const allClipSignatures = new Set<string>();
  let totalClips = 0;

  for (const role of PIXEL_AVATAR_ROLES) {
    const sprite = getPixelSprite(role.id);
    assert.equal(sprite.id, role.id);
    assert.equal(sprite.gender, role.gender, role.id);
    assert(role.actions.length >= 5, `${role.id} defines >= 5 actions in shared metadata`);
    assert(sprite.animations.length >= 5, `${role.id} has >= 5 independent animations`);
    assert.deepEqual(sprite.actions, [...role.actions], `${role.id} sprite actions match shared metadata`);
    assert.equal(new Set(sprite.animations.map((c: any) => c.id)).size, sprite.animations.length, `${role.id} clip ids are unique`);
    assert.equal(new Set(sprite.animations.map((c: any) => c.name)).size, sprite.animations.length, `${role.id} clip names are unique`);

    // 1. Verify 7-part skeletal rig structure, 64×64 part assets & intermediate joint-arc variants
    assert(sprite.rig, `${role.id} has skeletal rig`);
    for (const part of RIG_PARTS) {
      const variants = (sprite.rig as Record<string, Record<string, string[][]>>)[part];
      assert(variants && typeof variants === "object", `${role.id}.rig.${part} exists`);
      if (part === "armL" || part === "armR") {
        for (const arcPose of ["down", "lowOut", "mid", "highOut", "up", "forwardLow", "forward", "forwardHigh"]) {
          assert(variants[arcPose], `${role.id}.rig.${part} includes intermediate arc pose ${arcPose}`);
        }
      } else if (part === "legL" || part === "legR") {
        for (const stridePose of ["stand", "halfStep", "step", "halfWide", "wide", "halfCrouch", "crouch"]) {
          assert(variants[stridePose], `${role.id}.rig.${part} includes intermediate stride pose ${stridePose}`);
        }
      } else if (part !== "prop") {
        assert(Object.keys(variants).length >= 5, `${role.id}.rig.${part} has multiple articulated variants`);
      }
      for (const [vName, mat] of Object.entries(variants)) {
        assert.equal(mat.length, PIXEL_GRID_SIZE, `${role.id}.rig.${part}.${vName} height`);
        for (const row of mat) assert.equal(row.length, PIXEL_GRID_SIZE, `${role.id}.rig.${part}.${vName} width`);
      }
    }

    // 2. Verify idle keyframe covers all 7 parts and composes cleanly to 64×64
    assert(sprite.idleKeyframe, `${role.id} has idleKeyframe`);
    for (const part of RIG_PARTS) {
      const tf = (sprite.idleKeyframe as any)[part];
      assert(tf && typeof tf.dx === "number" && typeof tf.dy === "number" && typeof tf.variant === "string" && typeof tf.flip === "boolean" && typeof tf.visible === "boolean", `${role.id}.idleKeyframe.${part}`);
    }
    const idleMatrix = composeKeyframe(sprite.rig, sprite.idleKeyframe);
    assert.equal(idleMatrix.length, PIXEL_GRID_SIZE);
    const idleRendered = renderPixelFrame(role.id, "#3878fb", 0, "idle");
    assert(idleRendered.layers.length >= 6, `${role.id} idle frame has rich shaded pixel layers`);

    // 3. Verify all 5 occupation keyframe clips (12–20 frames each) & smooth local articulation
    const roleClipSignatures = new Set<string>();
    for (const clipObj of sprite.animations) {
      totalClips++;
      assert(Array.isArray(clipObj.keyframes), `${role.id}:${clipObj.id} stores keyframes table`);
      assert(clipObj.keyframes.length >= 12 && clipObj.keyframes.length <= 20, `${role.id}:${clipObj.id} has 12-20 keyframes (got ${clipObj.keyframes.length})`);
      assert.equal(clipObj.durations.length, clipObj.keyframes.length, `${role.id}:${clipObj.id} has per-frame timing`);
      for (const ms of clipObj.durations) assert(ms >= 50 && ms <= 300, `${role.id}:${clipObj.id} duration ${ms}ms in range`);

      const frameHashes = new Set<string>();
      const partMotionSignatures = new Map<string, Set<string>>(RIG_PARTS.map((p) => [p, new Set<string>()]));

      for (let f = 0; f < clipObj.keyframes.length; f++) {
        const keyframe = clipObj.keyframes[f];
        for (const part of RIG_PARTS) {
          const tf = (keyframe as any)[part];
          assert(tf && typeof tf.dx === "number" && typeof tf.dy === "number" && typeof tf.variant === "string" && typeof tf.flip === "boolean" && typeof tf.visible === "boolean", `${role.id}:${clipObj.id}[${f}].${part}`);
          if (tf.visible) assert((sprite.rig as any)[part]?.[tf.variant], `${role.id}:${clipObj.id}[${f}].${part} variant "${tf.variant}" exists in rig`);
          partMotionSignatures.get(part)!.add(`${tf.dx},${tf.dy},${tf.variant},${tf.flip},${tf.visible}`);
        }
        const matrix = composeKeyframe(sprite.rig, keyframe);
        assert.equal(matrix.length, PIXEL_GRID_SIZE, `${role.id}:${clipObj.id} frame ${f} height`);
        for (const row of matrix) assert.equal(row.length, PIXEL_GRID_SIZE, `${role.id}:${clipObj.id} frame ${f} width`);

        const rendered = renderPixelFrame(role.id, "#3878fb", f, clipObj.id);
        assert(rendered.layers.length >= 4, `${role.id}:${clipObj.id} frame ${f} renders multi-color pixel paths`);
        assert.match(rendered.bg, /^#[0-9a-f]{6}$/);
        for (const layer of rendered.layers) {
          assert.match(layer.d, /^M\d+ \d+h\d+v1h-\d+z/, `${role.id}:${clipObj.id} valid pixel path`);
        }
        frameHashes.add(JSON.stringify(rendered.layers.map((l: { fill: string; d: string }) => [l.fill, l.d])));
      }
      assert(frameHashes.size >= 6, `${role.id}:${clipObj.id} has smooth multi-frame progression`);
      const movingParts = [...partMotionSignatures.values()].filter((s) => s.size > 1).length;
      assert(movingParts >= 2, `${role.id}:${clipObj.id} articulates multiple skeletal parts independently`);

      const sig = [...frameHashes].join("|");
      roleClipSignatures.add(sig);
      allClipSignatures.add(sig);
    }
    assert.equal(roleClipSignatures.size, sprite.animations.length, `${role.id} all 5 clips are visually distinct`);

    // 4. Verify random picker avoids immediate repeats and visits diverse clips
    const chosen = new Set<string>();
    let prev = "";
    for (let i = 0; i < 40; i++) {
      const next = pickRandomAnimation(role.id, prev);
      assert(next.id !== prev, `${role.id} avoids repeating the same clip immediately`);
      assert(sprite.animations.some((c: any) => c.id === next.id));
      chosen.add(next.id);
      prev = next.id;
    }
    assert(chosen.size >= 4, `${role.id} random picker visits diverse occupation animations`);

    for (const color of PIXEL_AVATAR_COLORS) {
      const value = pixelAvatarPreset(role.id, color.id);
      assert(isAvatarPreset(value), value);
      assert.deepEqual(parsePixelAvatar(value), { role: role.id, color: color.id, hex: color.hex, gender: role.gender });
      assert.equal(employeeAvatarURL("employee", value), "", "pixel avatars render inline, never as a URL");
    }
  }
  assert.equal(totalClips, 100, "20 professions × 5 occupation animations = 100 total clips");
  assert.equal(allClipSignatures.size, totalClips, "every single occupation animation clip across all 20 roles is unique");

  // 5. Verify (role, clip, frame, hex) cache behavior & backward-compatible 3-arg API
  clearPixelFrameCache();
  assert.equal(getPixelFrameCacheSize(), 0);
  const f1 = renderPixelFrame("coder", "#3878fb", 1, "typing");
  const f1Again = renderPixelFrame("coder", "#3878fb", 1, "typing");
  assert.equal(f1, f1Again, "identical (role, clip, frame, hex) returns exact cached object");
  assert.equal(getPixelFrameCacheSize(), 1);
  const fDiffHex = renderPixelFrame("coder", "#f2374a", 1, "typing");
  const fDiffClip = renderPixelFrame("coder", "#3878fb", 1, "coffee");
  const fDiffFrame = renderPixelFrame("coder", "#3878fb", 2, "typing");
  const fIdle = renderPixelFrame("coder", "#3878fb", 0, "idle");
  assert.notEqual(f1, fDiffHex);
  assert.notEqual(f1, fDiffClip);
  assert.notEqual(f1, fDiffFrame);
  assert.notEqual(f1, fIdle);
  assert.equal(getPixelFrameCacheSize(), 5);
  assert(renderPixelFrame("coder", "#3878fb", 0).layers.length >= 5, "3-arg renderPixelFrame still works");
  assert(renderPixelFrame("unknown", "#3878fb", 0).layers.length >= 5, "unknown role falls back gracefully");

  for (const value of [
    "pixel:", "pixel:coder", "pixel:coder:", "pixel:unknown:red", "pixel:coder:unknown",
    "pixel:coder:red:extra", "pixel:coder:#ff0000", "pixel:../x:red", "PIXEL:coder:red",
    "bot:", "bot:round", "bot:unknown:red", "bot:round:#ff0000",
  ]) assert.equal(isAvatarPreset(value), false, value);

  for (const shape of BOT_AVATAR_SHAPES) {
    const legacy = botAvatarPreset(shape.id, "teal");
    assert(isAvatarPreset(legacy), legacy);
    assert.deepEqual(parseBotAvatar(legacy), { shape: shape.id, color: "teal", hex: "#0fb4a3" });
    const resolved = resolvePixelAvatar(legacy, "seed");
    assert.equal(resolved.color, "teal");
    assert.equal(resolved.hex, "#0fb4a3");
    assert(PIXEL_AVATAR_ROLES.some(r => r.id === resolved.role));
  }

  assert.deepEqual(defaultPixelAvatar("employee-a"), defaultPixelAvatar("employee-a"), "the default pixel citizen is stable per employee");
  assert(new Set(["a", "b", "c", "d", "e", "f", "g", "h"].map(seed => JSON.stringify(defaultPixelAvatar(seed)))).size > 4, "default citizens vary across employees");
  assert.deepEqual(defaultBotAvatar("employee-a"), defaultBotAvatar("employee-a"));
  assert.equal(shade("#000000", 0.5), "#808080");
  assert.equal(shade("#ffffff", -1), "#000000");
});

test("preset selection, clearing and reopening preserve the employee's own avatar without accepting an arbitrary blob reference", async () => {
  const { store, root, employee } = await fixture();
  try {
    assert.equal((await employee.state()).avatar, "zodiac:aries");
    await updateEmployeeAvatar(employee, { preset: "zodiac:pisces" });
    const reopened = new Employee(store, root.vault, root.runtime);
    assert.equal((await (await reopened.for(employee.employeeId)).state()).avatar, "zodiac:pisces");
    await assert.rejects(employee.control({ action: "settings", avatar: "blob-" + "1".repeat(32) }), /avatar/);
    assert.equal((await employee.state()).avatar, "zodiac:pisces");
    await updateEmployeeAvatar(employee, { preset: "pixel:doctor:teal" });
    assert.equal((await employee.state()).avatar, "pixel:doctor:teal");
    await updateEmployeeAvatar(employee, { preset: "bot:cloud:teal" });
    assert.equal((await employee.state()).avatar, "bot:cloud:teal");
    await assert.rejects(updateEmployeeAvatar(employee, { preset: "pixel:doctor:#00ffaa" }));
    assert.equal((await employee.state()).avatar, "bot:cloud:teal");
    await updateEmployeeAvatar(employee, { preset: "" });
    assert.equal((await employee.state()).avatar, "");
    await assert.rejects(async () => await root.create({ name: "Bad", avatar: "https://tracker.example/pixel" }, "owner"), /avatar/);
  } finally { root.close(); await store.close(); }
});

test("new employees automatically get diverse unused pixel citizens without changing existing avatars", async () => {
  const { store, root } = await fixture();
  try {
    const selected = await root.create({ name: "Selected", avatar: "pixel:doctor:teal" }, "owner");
    const legacy = await root.create({ name: "Legacy" }, "owner");
    await (await root.for(legacy.id)).update((state) => { state.avatar = ""; });
    const before = await Promise.all((await root.all()).map(async (employee) => await employee.state()));
    const used = new Set(before.map((state) => {
      const pixel = resolvePixelAvatar(state.avatar, state.id);
      return pixelAvatarPreset(pixel.role, pixel.color);
    }));
    const created = [];
    while ((await root.all()).length < 50) {
      const state = await root.create({ name: `Automatic ${created.length}`, ...(created.length % 2 ? { avatar: "" } : {}) }, "owner");
      assert(parsePixelAvatar(state.avatar), "persist an explicit pixel preset, not a hash-only default");
      assert(!used.has(state.avatar!), state.avatar);
      used.add(state.avatar!);
      created.push(state);
    }
    const createdRoles = new Set(created.map(s => parsePixelAvatar(s.avatar)!.role));
    assert(createdRoles.size >= 15, "auto-assignment spreads across diverse professions before repeating");
    for (const state of before) assert.equal((await (await root.for(state.id)).state()).avatar, state.avatar);
    const reopened = new Employee(store, root.vault, root.runtime);
    for (const state of created) assert.equal((await (await reopened.for(state.id)).state()).avatar, state.avatar);
    assert.equal((await (await reopened.for(selected.id)).state()).avatar, "pixel:doctor:teal");
    await assert.rejects(async () => await root.create({ name: "Full" }, "owner"), /capacity/);
  } finally { root.close(); await store.close(); }
});

test("custom avatar uploads are normalized, metadata-free and stored separately from employee state", async () => {
  const { store, root, employee } = await fixture();
  try {
    const input = await sharp({ create: { width: 300, height: 180, channels: 4, background: "#6699dd" } }).withMetadata({ orientation: 6 }).png().toBuffer();
    const result = await updateEmployeeAvatar(employee, { mime: "image/png", data: input.toString("base64") });
    assert.equal(result.employeeId, employee.employeeId);
    assert.match(result.avatar, /^blob-[a-f\d]{32}$/);
    assert.equal((await employee.state()).avatar, result.avatar);
    const image = (await store.blobData(result.avatar))!;
    assert.equal(image.mime, "image/webp");
    const metadata = await sharp(image.data).metadata();
    assert.equal(metadata.width, 512); assert.equal(metadata.height, 512);
    assert.equal(metadata.exif, undefined); assert.equal(metadata.orientation, undefined);
    assert(!JSON.stringify(await employee.state()).includes(input.toString("base64")));
    assert.equal((await root.state()).avatar, undefined, "another employee's avatar is unchanged");
  } finally { root.close(); await store.close(); }
});

test("invalid, oversized and disguised image uploads leave the current avatar and blob store unchanged", async () => {
  const { store, root, employee } = await fixture();
  try {
    const before = (await store.one("SELECT COUNT(*) count FROM blobs") as any).count;
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>').toString("base64");
    const jpeg = await sharp({ create: { width: 10, height: 10, channels: 3, background: "white" } }).jpeg().toBuffer();
    for (const input of [
      { preset: "zodiac:unknown" }, { preset: "javascript:alert(1)" },
      { mime: "image/svg+xml", data: svg }, { mime: "image/png", data: svg },
      { mime: "image/png", data: jpeg.toString("base64") }, { mime: "image/png", data: "not base64!" },
      { mime: "__proto__", data: "YQ==" }, { mime: "image/png", data: "A".repeat(7 * 1024 * 1024 + 1) },
    ]) await assert.rejects(updateEmployeeAvatar(employee, input));
    assert.equal((await employee.state()).avatar, "zodiac:aries");
    assert.equal((await store.one("SELECT COUNT(*) count FROM blobs") as any).count, before);
  } finally { root.close(); await store.close(); }
});

test("my own message bubbles take the color of the employee I am talking to, one color per employee", () => {
  assert.equal(bubbleTint("#1d1d21").fill, "#1d1d21", "deep fills keep their exact color");
  assert.notEqual(bubbleTint("#ffa424").fill, "#ffa424");
  assert.equal(bubbleTint("#ffa424").ink, "#fff");
  const luminance = (hex: string) => {
    const full = hex.length === 4 ? "#" + hex.slice(1).replace(/./g, (digit) => digit + digit) : hex;
    const [r, g, b] = [1, 3, 5].map(at => Number.parseInt(full.slice(at, at + 2), 16) / 255)
      .map(value => value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  for (const color of BOT_AVATAR_COLORS) {
    const { fill, ink } = bubbleTint(color.hex);
    assert.equal(ink, "#fff", color.id);
    const [light, dark] = [luminance(fill), luminance(ink)].sort((a, b) => b - a);
    assert((light + 0.05) / (dark + 0.05) >= 4.5, `${color.id} bubble text is below WCAG AA`);
  }
  assert.deepEqual(avatarBubble("pixel:doctor:teal", "any"), bubbleTint("#0fb4a3"));
  assert.deepEqual(avatarBubble("bot:cloud:teal", "any"), bubbleTint("#0fb4a3"));
  assert.deepEqual(avatarBubble("pixel:doctor:teal", "another"), avatarBubble("pixel:doctor:teal", "any"));
  for (const seed of ["e1", "e2", "e3"]) assert.deepEqual(avatarBubble("", seed), bubbleTint(defaultPixelAvatar(seed).hex));
  assert.notDeepEqual(avatarBubble("pixel:doctor:teal", "e1"), avatarBubble("pixel:coder:red", "e1"));
  assert(new Set(Array.from({ length: 8 }, (_, n) => avatarBubble("", "employee-" + n).fill)).size > 1, "two employees do not share one color");
});
