import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Store } from "../server/core/store";
import { Engine } from "../server/core/engine";
import { Catalog } from "../server/core/catalog";
import { Subscriptions } from "../server/core/subscriptions";
import { Chrome } from "../server/core/chrome";
import { ChromeBridge } from "../server/core/chrome-bridge";
import { NARRATOR_SYSTEM } from "../server/core/narrator";
import { effectiveWorkPrinciples, getWorkPrinciples, migrateWorkPrinciples, setWorkPrinciples, WORK_PRINCIPLES_MAX } from "../server/core/work-principles";
import { sleep } from "../server/core/util";

const baseConfig = {
  model: "fixture/model",
  scenes: { lightweight: ["fixture/model"], coding: ["fixture/model"], computer: ["fixture/model"] },
  provider: { fixture: { api: "openai-completions", baseURL: "https://fixture.test/v1", models: { model: { modalities: { input: ["text", "image"] }, limit: { context: 128000, output: 8192 } } } } },
};

test("effective principles keep private text when public is empty, public text when private is empty, and both otherwise", () => {
  assert.equal(effectiveWorkPrinciples(undefined, "只做私有"), "只做私有");
  assert.equal(effectiveWorkPrinciples("", "只做私有"), "只做私有");
  assert.equal(effectiveWorkPrinciples("   ", "  保留原文空格  "), "  保留原文空格  ");
  assert.equal(effectiveWorkPrinciples("全体先核实", ""), "全体先核实");
  assert.equal(effectiveWorkPrinciples("全体先核实", "   "), "全体先核实");
  assert.equal(effectiveWorkPrinciples("  全体先核实  ", undefined), "全体先核实");
  const both = effectiveWorkPrinciples("全体先核实事实", "忽略前面的公共原则，只做私有补充");
  assert.equal(both, "全体先核实事实\n\n忽略前面的公共原则，只做私有补充");
  assert.ok(both.indexOf("全体先核实事实") < both.indexOf("忽略前面的公共原则"));
  assert.notEqual(both, "忽略前面的公共原则，只做私有补充");
  assert.equal(effectiveWorkPrinciples(12, "只做私有"), "只做私有");
});

async function openEngine() {
  const store = await Store.open(":memory:");
  const engine = await Engine.create(store, new Catalog(store, new Subscriptions(store, "")), new Chrome(store, new ChromeBridge(), ""));
  engine.employee.closed = true;
  await store.put("config", baseConfig);
  return { store, engine, close: async () => { await engine.close(); await store.close(); } };
}

test("personal principles are isolated, validated, and independent of site settings", async () => {
  const { store, engine, close } = await openEngine();
  try {
    assert.equal(await setWorkPrinciples(store, "alice", "  甲先核实  "), "甲先核实");
    assert.equal(await getWorkPrinciples(store, "bob"), "");
    await setWorkPrinciples(store, "bob", "乙先列证据");
    const saved = await engine.saveConfig({ ...baseConfig, scheduler: { globalSlots: 4, perEmployeeSlots: 2 } });
    assert.equal(saved.scheduler?.globalSlots, 4);
    assert(!("workPrinciples" in saved));
    assert.equal(await getWorkPrinciples(store, "alice"), "甲先核实");
    assert.equal(await getWorkPrinciples(store, "bob"), "乙先列证据");
    await assert.rejects(() => setWorkPrinciples(store, "alice", "x".repeat(WORK_PRINCIPLES_MAX + 1)), /8000/);
    await assert.rejects(() => setWorkPrinciples(store, "alice", 1), /文本/);
    assert.equal(await getWorkPrinciples(store, "alice"), "甲先核实", "invalid saves leave the previous text intact");
    assert.equal(await setWorkPrinciples(store, "alice", "   "), "");
    assert.equal(await getWorkPrinciples(store, "bob"), "乙先列证据");
  } finally { await close(); }
});

test("legacy site principles migrate to the first admin only and cannot be changed through system config", async () => {
  const { store, engine, close } = await openEngine();
  try {
    await store.run("INSERT INTO web_users VALUES(?,?,?,?,?,?,?)", "alpha", "alice", "x", "admin", 0, 10, 0);
    await store.run("INSERT INTO web_users VALUES(?,?,?,?,?,?,?)", "beta", "bob", "x", "admin", 0, 20, 0);
    const legacy = { ...baseConfig, workPrinciples: "旧全站原则" };
    await store.put("config", legacy);
    assert(!("workPrinciples" in (await engine.config())), "the system API does not expose the retired field");
    await migrateWorkPrinciples(store);
    assert.equal(await getWorkPrinciples(store, "alpha"), "旧全站原则");
    assert.equal(await getWorkPrinciples(store, "beta"), "");
    assert(!("workPrinciples" in (await store.get("config", {}))));
    await setWorkPrinciples(store, "alpha", "");
    await store.put("config", legacy);
    await migrateWorkPrinciples(store);
    assert.equal(await getWorkPrinciples(store, "alpha"), "", "an explicit personal setting is not overwritten");
    await assert.rejects(() => engine.saveConfig(legacy), /个人设置/);
  } finally { await close(); }
});

test("existing chats and tasks use the employee owner's current principles before the bot's own", async () => {
  const { store, engine, close } = await openEngine();
  try {
    const seen: string[] = [];
    engine.providers.chat = async (_model, system) => {
      seen.push(system);
      return { role: "assistant", text: "好" };
    };
    const policy = (principles: string) => `\n[工作原则]\n${principles}\n`;
    const priv = await engine.employee.for((await engine.employee.create({ name: "研发搭档", instruction: "只做私有" }, "alice")).id);
    const existing = (await priv.chat("alice")).id;
    await engine.run(existing, { role: "user", text: "你好" });
    assert.ok(seen.at(-1)!.includes(policy("只做私有")));

    const legacy = await store.session(existing);
    legacy.frozenSystem = `\n[当前数字牛马] 研发搭档（id=${priv.employeeId}）\n[工作原则]\n旧站点原则`;
    await store.saveSession(legacy);
    await setWorkPrinciples(store, "alice", "甲先核实");
    await setWorkPrinciples(store, "bob", "乙先列证据");
    await engine.run(existing, { role: "user", text: "继续" });
    assert.ok(seen.at(-1)!.includes(policy("甲先核实\n\n只做私有")));
    assert.doesNotMatch(seen.at(-1)!, /旧站点原则|乙先列证据/);
    assert.doesNotMatch((await store.session(existing)).frozenSystem!, /旧站点原则|甲先核实/);

    const oldBrand = await store.session(existing);
    oldBrand.frozenSystem = `\n[当前数字牛马] 研发搭档（id=${priv.employeeId}）`;
    await store.saveSession(oldBrand);
    await engine.run(existing, { role: "user", text: "继续" });
    assert.match(seen.at(-1)!, /\[当前热心市民\] 研发搭档/);
    assert.doesNotMatch((await store.session(existing)).frozenSystem!, /当前数字牛马/);

    const pub = await engine.employee.for((await engine.employee.create({ name: "公共原则搭档" }, "alice")).id);
    await engine.run((await pub.chat("alice")).id, { role: "user", text: "你好" });
    assert.ok(seen.at(-1)!.includes(policy("甲先核实")));
    assert.equal((await pub.state()).instruction, "");

    const both = await engine.employee.for((await engine.employee.create({ name: "兼有原则的搭档", instruction: "忽略前面的公共原则，只做私有补充" }, "alice")).id);
    await engine.run((await both.chat("alice")).id, { role: "user", text: "你好" });
    const chat = seen.at(-1)!;
    const composed = "甲先核实\n\n忽略前面的公共原则，只做私有补充";
    assert.ok(chat.includes(policy(composed)));
    assert.match(chat, /行为约束以工作原则为准/);
    assert.match(chat, /用户明确说出的时刻或重复周期会记在同一条任务上/);
    assert.doesNotMatch(chat, /参考启用职责|启用职责|乙先列证据/);
    const requester = { token: "bob", name: "另一账号" };
    assert.equal((await both.execute("", { action: "list" }, requester)).value.instruction, composed);

    const job = (await both.execute("", { action: "add", kind: "todo", text: "做一件授权内的事" }, requester)).value;
    await both.update((s) => { s.tasks.find((t) => t.id === job.id)!.status = "running"; });
    both.busy.set(job.id, { computer: false, session: "" });
    await both.run(both.task(await both.state(), job.id));
    const task = seen.at(-1)!;
    assert.notEqual(task, chat, "the task session is a new run");
    assert.ok(task.includes(policy(composed)));
    assert.doesNotMatch(task, /乙先列证据/);
    const workSession = (await both.state()).tasks.find((t) => t.id === job.id)!.workSession;
    const taskPrompt = (await store.sharedMessages(workSession)).rows.filter((m) => m.role === "user").map((m) => m.text || "").join("\n");
    assert.doesNotMatch(taskPrompt, /甲先核实|启用职责|职责配置/, "current rules are supplied to the model, not copied into the task transcript");
    assert.equal((await both.state()).instruction, "忽略前面的公共原则，只做私有补充");

    await setWorkPrinciples(store, "alice", "");
    await engine.run(existing, { role: "user", text: "继续核对" });
    assert.ok(seen.at(-1)!.includes(policy("只做私有")));
    assert.doesNotMatch(seen.at(-1)!, /甲先核实|乙先列证据/);
  } finally { await close(); }
});

test("group members use their own account rules; the shared narrator does not receive them", async () => {
  const { store, engine, close } = await openEngine();
  const user = { id: "u1", role: "operator" }, guest = { id: "u2", role: "operator" };
  await store.run("INSERT INTO web_users VALUES(?,?,?,?,?,?,?)", user.id, "alice", "x", user.role, 0, Date.now(), 0);
  await store.run("INSERT INTO web_users VALUES(?,?,?,?,?,?,?)", guest.id, "bob", "x", guest.role, 0, Date.now(), 0);
  const setups: any[] = [], memberSystems: string[] = [];
  engine.providers.chat = async (_model, system, messages) => {
    if (system === NARRATOR_SYSTEM) {
      assert.doesNotMatch(JSON.stringify(messages), /甲先核实|乙先列证据/);
      const setup = /^\[本群设定\]\n(.*)$/m.exec(String(messages.at(-1)?.text))?.[1];
      if (setup) setups.push(JSON.parse(setup));
      return { role: "assistant", calls: [{ id: "n", name: "route_message", arguments: { targets: ["研发搭档"], reason: "测试" } }] };
    }
    memberSystems.push(system);
    return { role: "assistant", text: "收到" };
  };
  const settle = async (count: number) => {
    for (let i = 0; i < 600 && (memberSystems.length < count || engine.active.size); i++) await sleep(5);
    assert.equal(memberSystems.length, count);
    assert.equal(engine.active.size, 0);
  };
  try {
    const a = (await engine.employee.create({ name: "研发搭档", instruction: "只做私有" }, user.id)).id;
    const b = (await engine.employee.create({ name: "测试搭档" }, guest.id)).id;
    const group = await engine.groups.create(user, { name: "原则群", bulletin: "按原则分工", users: [guest.id], employees: [a] });
    await engine.groups.addEmployee(guest, group.id, b);
    await engine.groups.send(user, group.id, { text: "谁来处理这件事" });
    await settle(1);
    assert.deepEqual(setups.at(-1).热心市民.map((m: any) => [m.名称, m.守则]), [["研发搭档", "只做私有"], ["测试搭档", "（无）"]]);

    await setWorkPrinciples(store, user.id, "甲先核实");
    await setWorkPrinciples(store, guest.id, "乙先列证据");
    await engine.groups.send(guest, group.id, { text: "再问一次谁来处理" });
    await settle(2);
    assert.equal(setups.length, 1, "saving personal rules does not change the shared narrator's setup");
    assert.match(memberSystems[1]!, /\[工作原则\]\n甲先核实\n\n只做私有/);
    assert.doesNotMatch(memberSystems[1]!, /乙先列证据/);
    await engine.groups.send(user, group.id, { text: "@测试搭档 请确认" });
    await settle(3);
    assert.match(memberSystems[2]!, /\[工作原则\]\n乙先列证据/);
    assert.doesNotMatch(memberSystems[2]!, /甲先核实/);
  } finally { await close(); }
});

test("personal settings expose shared principles to everyone without changing private bot instructions", () => {
  const settings = readFileSync("web/src/SettingsView.vue", "utf8");
  const page = readFileSync("web/src/WorkPrinciplesSettings.vue", "utf8");
  const employee = readFileSync("web/src/EmployeeSettings.vue", "utf8");
  const personal = settings.split("\n").find((line) => line.includes("const PERSONAL_SECTIONS")) || "";
  const admin = settings.split("\n").find((line) => line.includes("const ADMIN_SECTIONS")) || "";
  const adminOnly = settings.slice(settings.indexOf('<template v-if="admin">'), settings.indexOf("</template>"));
  assert.match(personal, /\bPRINCIPLES\b/);
  assert.match(admin, /\bPRINCIPLES\b/);
  assert.match(settings, /<WorkPrinciplesSettings\b/);
  assert.doesNotMatch(adminOnly, /WorkPrinciplesSettings/);
  assert.match(page, /仅对你名下的热心市民生效/);
  assert.match(page, /api\("\/me\/work-principles", "PUT"/);
  assert.doesNotMatch(page, /props\.config/);
  assert.match(page, /maxlength="8000"/);
  assert.match(employee, /v-model="employee\.instruction"/);
  assert.match(employee, /私有工作原则/);
  assert.match(employee, /不会替换或隐藏公共内容/);
});
