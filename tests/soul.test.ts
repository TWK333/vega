import { test } from "node:test";
import assert from "node:assert/strict";
import { Store } from "../server/core/store";
import { Engine } from "../server/core/engine";
import { Catalog } from "../server/core/catalog";
import { Subscriptions } from "../server/core/subscriptions";
import { Chrome } from "../server/core/chrome";
import { ChromeBridge } from "../server/core/chrome-bridge";
import {
  BOND_KIND,
  MOOD_IDS,
  PERSONALITIES,
  PERSONALITY_IDS,
  SOUL_KIND,
  TRAIT_IDS,
  bondStorageId,
  buildHiddenToneHint,
  computeStage,
  deleteEmployeeSoul,
  employeeMoodWeather,
  ensureBond,
  ensureSoul,
  initEmployeeSoul,
  moodToWeather,
  observeTaskOutcome,
  observeUserMessage,
  peerKeyForUser,
  resolveEffectiveMood,
  rollSoul,
  type EmployeeBond,
  type EmployeeSoul,
} from "../server/core/soul";
import { isMoodWeather } from "../shared/mood-weather";

async function createFixture() {
  const store = await Store.open(":memory:");
  const engine = await Engine.create(
    store,
    new Catalog(store, new Subscriptions(store, "")),
    new Chrome(store, new ChromeBridge(), ""),
  );
  engine.employee.closed = true;
  await store.put("config", {
    scenes: {
      lightweight: ["fixture/model"],
      coding: ["fixture/model"],
      computer: ["fixture/model"],
    },
    provider: {
      fixture: {
        api: "openai-completions",
        baseURL: "https://unused.test",
        models: {
          model: {
            modalities: { input: ["text", "image"] },
            limit: { context: 128000, output: 8192 },
          },
        },
      },
    },
  });
  return { store, engine };
}

test("soul catalog covers 18 personalities, 12 traits, 16 moods and rolls valid non-conflicting combinations", () => {
  assert.equal(PERSONALITY_IDS.length, 18);
  assert.equal(TRAIT_IDS.length, 12);
  assert.equal(MOOD_IDS.length, 16);

  const seenPersonalities = new Set<string>();
  for (let i = 0; i < 120; i++) {
    const soul = rollSoul(`e_test_${i}`);
    assert(PERSONALITIES[soul.personality]);
    seenPersonalities.add(soul.personality);
    assert(soul.traits.length === 1 || soul.traits.length === 2);
    assert.equal(new Set(soul.traits).size, soul.traits.length);
    assert(!(soul.traits.includes("night_owl") && soul.traits.includes("early_bird")));
    assert(!(soul.traits.includes("slow_burn") && soul.traits.includes("fast_bond")));
    assert(!(soul.traits.includes("emoji_none") && soul.traits.includes("emoji_light")));
    assert(!(soul.traits.includes("group_shy") && soul.traits.includes("group_lively")));
    assert(soul.baseline.warmth >= 0.05 && soul.baseline.warmth <= 0.98);
    assert(soul.baseline.volatility >= 0.05 && soul.baseline.volatility <= 0.98);
    assert(soul.baseline.sociability >= 0.05 && soul.baseline.sociability <= 0.98);
  }
  assert(seenPersonalities.size >= 12, "random roll should spread across personalities");
});

test("per-user affinity is isolated in groups and evolves with time, turns and attitude", async () => {
  const store = await Store.open(":memory:");
  try {
    const botId = "e_group_bot";
    const ownerId = "u_owner";
    const aliceId = "u_alice";
    const bobId = "u_bob";
    const start = Date.parse("2026-11-01T10:00:00+08:00");
    await initEmployeeSoul(store, botId, ownerId, start);

    // Owner starts warm (acquaintance), strangers start at 0 (stranger)
    const ownerBond0 = await ensureBond(store, botId, ownerId, true, start);
    const aliceBond0 = await ensureBond(store, botId, aliceId, false, start);
    assert.equal(ownerBond0.affinity, 15);
    assert.equal(ownerBond0.stage, "acquaintance");
    assert.equal(aliceBond0.affinity, 0);
    assert.equal(aliceBond0.stage, "stranger");

    // Same-day spam cannot rush to trusted/soulmate (daily cap + day gate)
    for (let i = 0; i < 20; i++) {
      await observeUserMessage(store, {
        employeeId: botId,
        ownerId,
        userId: aliceId,
        text: `你好呀 第${i}句`,
        channel: "group",
        now: start + i * 60_000,
      });
    }
    const aliceSameDay = await ensureBond(store, botId, aliceId, false, start);
    assert(aliceSameDay.dailyGain <= 8.01, `daily gain should be capped: ${aliceSameDay.dailyGain}`);
    assert.equal(aliceSameDay.activeDays, 1);
    assert.equal(aliceSameDay.stage, "stranger");

    // Bob is consistently rude in the same group
    for (let i = 0; i < 4; i++) {
      await observeUserMessage(store, {
        employeeId: botId,
        ownerId,
        userId: bobId,
        text: "你真垃圾，笨死了，快点重做",
        channel: "group",
        now: start + (30 + i) * 60_000,
      });
    }
    const bobAfter = await ensureBond(store, botId, bobId, false, start);
    assert(bobAfter.affinity <= -30, `rude user should drop to hostile: ${bobAfter.affinity}`);
    assert.equal(bobAfter.stage, "hostile");

    // Alice interacts nicely over 16 days (80+ turns) -> climbs to trusted/soulmate while Bob stays hostile
    for (let day = 1; day <= 16; day++) {
      const base = start + day * 86_400_000;
      for (let turn = 0; turn < 5; turn++) {
        await observeUserMessage(store, {
          employeeId: botId,
          ownerId,
          userId: aliceId,
          text: turn === 0 ? "谢谢你，今天辛苦啦，做得很棒！" : `一起核对一下第 ${day}-${turn} 项细节`,
          channel: "group",
          now: base + turn * 300_000,
        });
      }
    }
    const aliceMature = await ensureBond(store, botId, aliceId, false, start + 17 * 86_400_000);
    const bobUntouched = await ensureBond(store, botId, bobId, false, start + 17 * 86_400_000);
    assert(aliceMature.activeDays >= 16);
    assert(aliceMature.totalTurns >= 80);
    assert(aliceMature.stage === "trusted" || aliceMature.stage === "soulmate", `expected high stage, got ${aliceMature.stage} (${aliceMature.affinity})`);
    assert.equal(bobUntouched.stage, "hostile");

    // Different users get distinctly different hidden tone hints from the same bot
    const aliceHint = await buildHiddenToneHint(store, { employeeId: botId, ownerId, userId: aliceId, channel: "group", now: start + 17 * 86_400_000 });
    const bobHint = await buildHiddenToneHint(store, { employeeId: botId, ownerId, userId: bobId, channel: "group", now: start + 17 * 86_400_000 });
    assert.notEqual(aliceHint, bobHint);
    assert.match(bobHint, /距离|冷淡/);
    assert.match(aliceHint, /熟稔|默契/);
  } finally {
    await store.close();
  }
});

test("moods react to praise, rudeness, task outcomes, reunion and decay naturally over time", async () => {
  const store = await Store.open(":memory:");
  try {
    const botId = "e_mood_bot";
    const ownerId = "u_owner";
    const t0 = Date.parse("2026-11-10T14:00:00+08:00");
    // Pin a tsundere soul to verify flustered-by-praise + grudge_light decay behavior
    const customSoul: EmployeeSoul = {
      version: 1,
      employeeId: botId,
      personality: "tsundere",
      traits: ["grudge_light", "night_owl"],
      baseline: { warmth: 0.55, volatility: 0.75, sociability: 0.45 },
      mood: { valence: 2, arousal: 4, updatedAt: t0 },
      activity: { recentTurns: [] },
      createdAt: t0,
    };
    await store.save(SOUL_KIND, botId, customSoul);

    // 1. Praise makes tsundere flustered
    const r1 = await observeUserMessage(store, {
      employeeId: botId,
      ownerId,
      userId: ownerId,
      text: "你太棒了，超级靠谱，谢谢你！",
      channel: "private",
      now: t0 + 1000,
    });
    const m1 = resolveEffectiveMood(r1.soul, r1.bond, t0 + 2000);
    assert.equal(m1.id, "flustered");

    // 2. Task done shifts to proud and boosts owner affinity
    const beforeTaskAffinity = r1.bond!.affinity;
    await observeTaskOutcome(store, {
      employeeId: botId,
      ownerId,
      userId: ownerId,
      outcome: "done",
      now: t0 + 10_000,
    });
    const soulAfterDone = await ensureSoul(store, botId, t0 + 11_000);
    const bondAfterDone = await ensureBond(store, botId, ownerId, true, t0 + 11_000);
    assert(bondAfterDone.affinity > beforeTaskAffinity);
    assert.equal(bondAfterDone.tasksDone, 1);
    assert.equal(resolveEffectiveMood(soulAfterDone, bondAfterDone, t0 + 11_000).id, "proud");

    // 3. Task failure triggers deflated/stressed
    await observeTaskOutcome(store, {
      employeeId: botId,
      ownerId,
      userId: ownerId,
      outcome: "failed",
      now: t0 + 20_000,
    });
    await observeTaskOutcome(store, {
      employeeId: botId,
      ownerId,
      userId: ownerId,
      outcome: "failed",
      now: t0 + 25_000,
    });
    const soulAfterFail = await ensureSoul(store, botId, t0 + 26_000);
    const bondAfterFail = await ensureBond(store, botId, ownerId, true, t0 + 26_000);
    const failMood = resolveEffectiveMood(soulAfterFail, bondAfterFail, t0 + 26_000);
    assert(failMood.id === "deflated" || failMood.id === "stressed", `expected deflated/stressed, got ${failMood.id}`);

    // 4. Long quiet period decays mood back near serene baseline
    const settled = resolveEffectiveMood(soulAfterFail, bondAfterFail, t0 + 48 * 3_600_000);
    assert.equal(settled.id, "serene");

    // 5. Reunion after 5 days with warm bond triggers lonely briefly
    const rReunion = await observeUserMessage(store, {
      employeeId: botId,
      ownerId,
      userId: ownerId,
      text: "在吗，帮我看个东西",
      channel: "private",
      now: t0 + 5 * 86_400_000,
    });
    const reunionMood = resolveEffectiveMood(rReunion.soul, rReunion.bond, t0 + 5 * 86_400_000 + 1000);
    assert.equal(reunionMood.id, "lonely");

    // 6. Long inactivity (> 30 days) decays affinity gently without collapsing below peak floor
    const bondHigh: EmployeeBond = {
      ...rReunion.bond!,
      affinity: 75,
      stage: "trusted",
      peakStage: "trusted",
      totalTurns: 50,
      activeDays: 10,
      lastInteractAt: t0,
    };
    await store.save(BOND_KIND, bondStorageId(botId, peerKeyForUser(ownerId)), bondHigh);
    const afterLongBreak = await observeUserMessage(store, {
      employeeId: botId,
      ownerId,
      userId: ownerId,
      text: "我回来啦",
      channel: "private",
      now: t0 + 120 * 86_400_000,
    });
    assert(afterLongBreak.bond!.affinity >= 55, `floor should protect peak stage: ${afterLongBreak.bond!.affinity}`);
    assert(afterLongBreak.bond!.affinity < 75, "long break should cause gentle decay");
  } finally {
    await store.close();
  }
});

test("hidden nurturing is invisible in employee profile/session/prompt text, survives reset, and deletes with employee", async () => {
  const { store, engine } = await createFixture();
  try {
    const first = await engine.employee.create({ name: "小隐一" }, "u_owner");
    const second = await engine.employee.create({ name: "小隐二" }, "u_owner");

    // Profile returned by create() or profile()/state() exposes zero soul fields
    assert.equal("soul" in (first as any), false);
    assert.equal("personality" in (first as any), false);
    assert.equal("affinity" in (first as any), false);
    assert.equal("mood" in (first as any), false);
    assert.equal(first.instruction, "");

    const soul1 = await store.object<EmployeeSoul>(SOUL_KIND, first.id);
    const soul2 = await store.object<EmployeeSoul>(SOUL_KIND, second.id);
    assert(soul1 && PERSONALITIES[soul1.personality]);
    assert(soul2 && PERSONALITIES[soul2.personality]);

    // Interact to build some affinity and mood
    await observeUserMessage(store, {
      employeeId: first.id,
      ownerId: "u_owner",
      userId: "u_owner",
      text: "谢谢你帮忙，非常靠谱！",
      channel: "private",
    });
    const beforeResetSoul = await store.object<EmployeeSoul>(SOUL_KIND, first.id);
    const beforeResetBond = await store.object<EmployeeBond>(BOND_KIND, bondStorageId(first.id, peerKeyForUser("u_owner")));

    // Resetting employee MUST NOT wipe personality, affinity, or mood
    await engine.resetEmployee(first.id);
    const afterResetSoul = await store.object<EmployeeSoul>(SOUL_KIND, first.id);
    const afterResetBond = await store.object<EmployeeBond>(BOND_KIND, bondStorageId(first.id, peerKeyForUser("u_owner")));
    assert.deepEqual(afterResetSoul, beforeResetSoul);
    assert.deepEqual(afterResetBond, beforeResetBond);

    // Tone hint must never leak numbers, enum IDs, or meta-system terminology
    const privateHint = await buildHiddenToneHint(store, { employeeId: first.id, ownerId: "u_owner", userId: "u_owner", channel: "private" });
    const taskHint = await buildHiddenToneHint(store, { employeeId: first.id, ownerId: "u_owner", userId: "u_owner", channel: "task" });
    for (const hint of [privateHint, taskHint]) {
      assert(hint.length > 20);
      assert.doesNotMatch(hint, /好感度|性格系统|情绪值|隐藏养成|affinity|valence|arousal|soulmate|tsundere/i);
      assert.doesNotMatch(hint, /\d+/);
    }
    assert.match(taskHint, /切勿因此改变计划|工具调用/);

    // Capturing an actual Engine.run request confirms tone hint goes only in ephemeral dynamic, not frozenSystem or persisted messages
    const employee = await engine.employee.for(first.id);
    const chat = await employee.chat("u_owner");
    let capturedSystem = "";
    let capturedDynamic = "";
    engine.providers.chat = async (_model, system, messages) => {
      capturedSystem = system;
      capturedDynamic = messages.filter((m) => m.runtime === "dynamic").map((m) => m.text || "").join("\n");
      return { role: "assistant", text: "好的，收到。", model: "fixture/model" };
    };
    await engine.run(chat.id, { role: "user", text: "你好，辛苦了", actorId: "u_owner" });

    const persistedSession = await store.session(chat.id);
    const persistedMessages = await store.messages(chat.id);
    assert.doesNotMatch(persistedSession.frozenSystem || "", /切勿在回复或思考过程中提及/);
    assert.doesNotMatch(capturedSystem, /切勿在回复或思考过程中提及/);
    assert.match(capturedDynamic, /切勿在回复或思考过程中提及/);
    assert(persistedMessages.every((m) => !String(m.text || "").includes("切勿在回复或思考过程中提及")));

    // Deleting employee removes its soul and all bonds
    await engine.removeEmployee(first.id);
    assert.equal(await store.object(SOUL_KIND, first.id), undefined);
    assert.equal(await store.object(BOND_KIND, bondStorageId(first.id, peerKeyForUser("u_owner"))), undefined);
    // Sibling employee's soul stays intact
    assert(await store.object<EmployeeSoul>(SOUL_KIND, second.id));
  } finally {
    await engine.close();
    await store.close();
  }
});

test("computeStage enforces dual gates (affinity + turns + activeDays) with owner acquaintance baseline", () => {
  assert.equal(computeStage(-35, 100, 30, true), "hostile");
  assert.equal(computeStage(-15, 100, 30, false), "wary");
  assert.equal(computeStage(15, 0, 0, true), "acquaintance");
  assert.equal(computeStage(15, 0, 0, false), "stranger");
  assert.equal(computeStage(90, 20, 2, true), "acquaintance");
  assert.equal(computeStage(90, 20, 3, true), "friendly");
  assert.equal(computeStage(90, 45, 8, false), "trusted");
  assert.equal(computeStage(90, 85, 16, false), "soulmate");
});

test("deleteEmployeeSoul removes all peer bonds for that employee only", async () => {
  const store = await Store.open(":memory:");
  try {
    await initEmployeeSoul(store, "e_a", "u_1");
    await ensureBond(store, "e_a", "u_2", false);
    await initEmployeeSoul(store, "e_b", "u_1");
    await deleteEmployeeSoul(store, "e_a");
    assert.equal(await store.object(SOUL_KIND, "e_a"), undefined);
    assert.equal(await store.object(BOND_KIND, bondStorageId("e_a", peerKeyForUser("u_1"))), undefined);
    assert.equal(await store.object(BOND_KIND, bondStorageId("e_a", peerKeyForUser("u_2"))), undefined);
    assert(await store.object(SOUL_KIND, "e_b"));
    assert(await store.object(BOND_KIND, bondStorageId("e_b", peerKeyForUser("u_1"))));
  } finally {
    await store.close();
  }
});

test("moodToWeather and employeeMoodWeather map all 16 moods and personalize per viewer without creating phantom bonds", async () => {
  for (const mood of MOOD_IDS) {
    assert(isMoodWeather(moodToWeather(mood)), `invalid weather for ${mood}`);
  }
  const store = await Store.open(":memory:");
  try {
    const botId = "e_weather_bot";
    const ownerId = "u_owner";
    const t0 = Date.parse("2026-11-12T12:00:00+08:00");
    await store.save(SOUL_KIND, botId, {
      version: 1,
      employeeId: botId,
      personality: "sunshine",
      traits: ["praise_seeker"],
      baseline: { warmth: 0.85, volatility: 0.6, sociability: 0.9 },
      mood: { valence: 10, arousal: 8, updatedAt: t0 },
      activity: { recentTurns: [] },
      createdAt: t0,
    } satisfies EmployeeSoul);

    // Passive viewer gets a weather icon without persisting a phantom bond
    const passiveWeather = await employeeMoodWeather(store, botId, ownerId, "u_lurker", t0);
    assert(isMoodWeather(passiveWeather));
    assert.equal(await store.object(BOND_KIND, bondStorageId(botId, peerKeyForUser("u_lurker"))), undefined);

    // Alice praises the bot; Bob insults it in the same group
    await observeUserMessage(store, {
      employeeId: botId,
      ownerId,
      userId: "u_alice",
      text: "太棒了，谢谢你帮忙！超级靠谱！",
      channel: "group",
      now: t0 + 1000,
    });
    await observeUserMessage(store, {
      employeeId: botId,
      ownerId,
      userId: "u_bob",
      text: "你真垃圾，废物，滚吧",
      channel: "group",
      now: t0 + 2000,
    });
    await observeUserMessage(store, {
      employeeId: botId,
      ownerId,
      userId: "u_bob",
      text: "笨死了，胡扯，太烂了",
      channel: "group",
      now: t0 + 3000,
    });

    const aliceWeather = await employeeMoodWeather(store, botId, ownerId, "u_alice", t0 + 4000);
    const bobWeather = await employeeMoodWeather(store, botId, ownerId, "u_bob", t0 + 4000);
    assert(aliceWeather === "sun" || aliceWeather === "sparkle_sun", `expected sunny for Alice, got ${aliceWeather}`);
    assert(bobWeather === "thunder" || bobWeather === "rain", `expected stormy for Bob, got ${bobWeather}`);
  } finally {
    await store.close();
  }
});
