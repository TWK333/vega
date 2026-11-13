import { createHash } from "node:crypto";
import type { AgentEvent } from "./engine";
import type { Message } from "./store";
import type { Application } from "./application";
import { check } from "./auth";
import { chatHistory } from "./chat-page";
import { ATTACHMENT_BYTES } from "./attachments";
import { defaultBotAvatar, parseBotAvatar, isAvatarPreset } from "../../shared/employee-avatars";
import { assert, filterAsync, type Obj } from "./util";

type ChatApplication = Pick<Application, "engine" | "store" | "auth">;

// Desktop chat must not expose the model's thinking, tool results or runtime-only instructions.
export function clientChatMessage(message?: Message) {
  if (!message || (message.runtime && !(message.runtime === "steer" && message.clientMessageId)) || !["user", "assistant"].includes(message.role) || !(message.text?.trim() || message.images?.length || message.tasks?.length)) return null;
  return { seq: message.seq, role: message.role, text: message.displayText ?? message.text ?? "", at: message.at,
    clientMessageId: message.clientMessageId, tasks: message.tasks, images: message.images, files: message.files,
    ...(message.stepOutput ? { stepOutput: message.stepOutput } : {}) };
}

export async function clientChat(application: ChatApplication, op: string, a: Obj, userId: string) {
  const { engine, store, auth } = application, user = await auth.user(userId);
  check(user && !user.disabled, 403, "User not found");
  if (op === "metadata") return { id: user.id, name: user.username };
  if (!["threads", "messages", "read", "file", "acceptance"].includes(op))
    check(user.role !== "viewer", 403, "Execution permission required");
  if (op === "create") {
    assert(typeof a.clientNonce === "string" && /^[\w-]{16,80}$/.test(a.clientNonce), "Invalid creation ID");
    const key = user.id + "/" + a.clientNonce;
    const employee = await store.transaction(async () => {
      const previous = await store.object<{ id: string; hash: string }>("client-bot", key);
      const input = { name: a.name, instruction: a.instruction, avatar: a.avatar };
      const hash = createHash("sha256").update(JSON.stringify(input)).digest("hex");
      if (previous) {
        assert(previous.hash === hash, "Creation ID already used for different content");
        const employee = await engine.employee.for(previous.id);
        assert(await employee.accessible(user), "Employee not found");
        return employee;
      }
      const state = await engine.employee.create(input, user.id);
      await store.save("client-bot", key, { id: state.id, hash });
      return engine.employee.for(state.id);
    });
    return { id: employee.employeeId };
  }
  if (op === "file") {
    assert(typeof a.blobId === "string" && /^blob-[a-f\d]{32}$/.test(a.blobId) && await auth.canBlob(user, a.blobId), "File not found");
    const blob = await store.blobData(a.blobId);
    assert(blob && blob.data.length <= ATTACHMENT_BYTES, "File unavailable");
    return { data: Buffer.from(blob.data).toString("base64") };
  }
  if (op === "threads") {
    const employees = await Promise.all((await filterAsync(await engine.employee.all(), (employee) => employee.accessible(user))).map(async (employee) => {
      const s = await employee.state();
      const recent = s.chatSession ? (await store.messagePage(s.chatSession, { limit: 20 })).messages.map(clientChatMessage).filter(Boolean) : [];
      const last = recent.at(-1), reply = recent.filter((message) => message?.role === "assistant").at(-1);
      return {
        thread: "employee:" + s.id, kind: "employee", id: s.id, name: s.name, avatar: s.avatar || "", mine: s.ownerId === user.id,
        instruction: s.instruction, botAvatar: parseBotAvatar(s.avatar) || defaultBotAvatar(s.id),
        unread: s.chatSession ? await store.unread(user.id, s.chatSession) : 0,
        running: !!s.chatSession && engine.active.has(s.chatSession),
        runningTasks: s.tasks.filter((task) => task.status === "running").length,
        attention: s.tasks.filter((task) => ["waiting", "approval"].includes(task.status)).length,
        lastText: last?.text.slice(0, 60) || "", lastAt: last?.at || 0, lastMessageId: reply ? "entry-" + reply.seq : null,
      };
    }));
    const groups = (await engine.groups.list(user)).map((g) => ({
      thread: "group:" + g.id, kind: "group", id: g.id, name: g.name,
      users: g.users?.length || 0, employees: g.employees?.length || 0,
      unread: g.unread, running: Array.isArray(g.running) && g.running.length > 0,
      lastText: g.lastText || "", lastAt: g.lastAt || 0,
    }));
    return { employees, groups };
  }
  const thread = String(a.thread || ""), colon = thread.indexOf(":"), kind = thread.slice(0, colon), id = thread.slice(colon + 1);
  assert(colon > 0 && id && ["employee", "group"].includes(kind), "Invalid thread");
  if (op === "messages") {
    const query = new URLSearchParams();
    if (a.after !== undefined) {
      assert(a.before === undefined && a.limit === undefined, "after cannot be combined with before or limit");
      query.set("after", String(a.after));
    }
    else {
      query.set("limit", String(a.limit ?? 100));
      if (a.before !== undefined) query.set("before", String(a.before));
    }
    if (kind === "employee") {
      const employee = (await engine.employee.all()).find((e) => e.employeeId === id);
      assert(employee && await employee.accessible(user), "Employee not found");
      const session = await employee.chat(user.id);
      const page = await chatHistory(store, session.id, query);
      // 待确认气泡里的任务状态会随作答翻转：返回前把它刷成当前值，面板按它决定还能不能点。
      const live = new Map((await employee.state()).tasks.map((task) => [task.id, task.status]));
      for (const message of page.messages || [])
        for (const task of message.tasks || [])
          if (live.has(task.id)) task.status = live.get(task.id)!;
      const state = await employee.state();
      return { thread, title: state.name, avatar: state.avatar || "", running: engine.active.has(session.id), ...page,
        nextBeforeSeq: "hasMore" in page && page.hasMore ? page.messages[0]?.seq ?? null : null,
        messages: page.messages.map(clientChatMessage).filter(Boolean) };
    }
    const group = await engine.groups.mine(user, id);
    // 群聊作者头像是预设字符串（bot:shape:color），给面板解析成 BotAvatar；key 为 kind:id。
    const view = await engine.groups.view(group, user);
    const authors = Object.fromEntries([
      ...(view.employees || []).map((p) => ["employee:" + p.id, { avatar: p.avatar || "" }]),
      ...(view.users || []).map((p) => ["user:" + p.id, { avatar: p.avatar || "" }]),
    ]);
    const page = await chatHistory(store, group.session, query);
    return { thread, title: group.name, authors, running: Object.values(group.memberSessions || {}).some((s) => engine.active.has(String(s))), ...page,
      nextBeforeSeq: "hasMore" in page && page.hasMore ? page.messages[0]?.seq ?? null : null,
      messages: page.messages.map((message) => {
        const projected = clientChatMessage(message);
        return projected ? { ...projected, author: message.author } : null;
      }).filter(Boolean) };
  }
  if (op === "read") {
    if (kind === "employee") {
      const employee = (await engine.employee.all()).find((e) => e.employeeId === id);
      assert(employee && await employee.accessible(user), "Employee not found");
      const session = await employee.chat(user.id);
      return { seq: await store.markRead(user.id, session.id) };
    }
    const group = await engine.groups.mine(user, id);
    return { seq: await store.markRead(user.id, group.session) };
  }
  if (["update", "cancel", "acceptance"].includes(op)) {
    assert(kind === "employee", "Employee thread required");
    const employee = await engine.employee.for(id);
    assert(await employee.accessible(user), "Employee not found");
    const state = await employee.state();
    if (op === "cancel") {
      if (state.chatSession) engine.cancel(state.chatSession);
      return { ok: true };
    }
    if (op === "acceptance") {
      assert(typeof a.clientMessageId === "string" && /^[\w:.-]{16,200}$/.test(a.clientMessageId), "Invalid message ID");
      const message = state.chatSession ? await store.clientMessage(state.chatSession, user.id, a.clientMessageId) : undefined;
      return message ? { outcome: "found", record: { status: "accepted", echoEntryId: "entry-" + message.seq } } : { outcome: "unknown-durability" };
    }
    assert(await employee.manageable(user), "Only the owner may edit this bot");
    assert(a.avatar === undefined || isAvatarPreset(a.avatar), "Invalid employee avatar");
    assert(a.name !== undefined || a.instruction !== undefined || a.avatar !== undefined, "Profile required");
    await employee.control({ action: "settings", ...Object.fromEntries(["name", "instruction", "avatar"].filter((key) => a[key] !== undefined).map((key) => [key, a[key]])) });
    return { id };
  }
  if (op === "control") {
    // 面板上的待确认气泡：只允许对自己的牛马发 approve/answer（群聊任务不在这里控制）。
    assert(kind === "employee", "Panel control only applies to an employee thread");
    const employee = (await engine.employee.all()).find((e) => e.employeeId === id);
    assert(employee && await employee.accessible(user), "Employee not found");
    assert(["approve", "answer", "stop"].includes(String(a.action || "")), "Unsupported control action");
    return await employee.control({ id: a.id, action: a.action, approved: a.approved, text: a.text }, { token: "", name: user.username || "用户" });
  }
  if (op === "send") {
    assert(typeof a.text === "string", "Message required");
    const text = a.text.trim();
    assert(text && text.length <= 2 << 20, "Message required");
    if (kind === "employee") {
      const employee = (await engine.employee.all()).find((e) => e.employeeId === id);
      assert(employee && await employee.accessible(user), "Employee not found");
      const session = await employee.chat(user.id);
      check(!employee.deleting && !employee.resetting, 409, "Bot is being reset or deleted");
      assert(typeof a.clientMessageId === "string" && /^[\w:.-]{16,200}$/.test(a.clientMessageId), "Invalid message ID");
      await engine.submitChat(session.id, { role: "user", text, actorId: user.id, clientMessageId: a.clientMessageId,
        clientMessageHash: createHash("sha256").update(text).digest("hex") });
      return { ok: true };
    }
    await engine.groups.send(user, id, { text });
    return { ok: true };
  }
  check(false, 404, "Chat route not found");
}

/** One selected employee chat per stream; no task-session tokens or other users' events cross this boundary. */
export async function watchClientChat(application: ChatApplication, userId: string, thread: unknown, send: (event: Obj) => void) {
  const { engine, auth } = application, user = await auth.user(userId);
  check(user && !user.disabled, 403, "User not found");
  assert(typeof thread === "string" && thread.startsWith("employee:"), "Employee thread required");
  const employee = await engine.employee.for(thread.slice(9));
  check(await employee.accessible(user), 403, "Employee not found");
  const session = await employee.chat(user.id);
  const listener = (event: AgentEvent) => {
    if (event.type === "employee_changed") {
      if (event.data?.employeeId === employee.employeeId) send({ type: "roster-changed" });
      return;
    }
    if (event.session !== session.id) return;
    if (["message_start", "text_delta", "done", "started", "compacted"].includes(event.type))
      send({ type: event.type, ...(event.type === "text_delta" ? { data: event.data } : {}) });
    else if (["user", "steer", "message_end"].includes(event.type)) {
      const message = clientChatMessage(event.data);
      if (!event.data || (message && !message.seq)) send({ type: "history-changed" });
      else if (message) send({ type: "message", message });
    }
  };
  engine.events.on("event", listener);
  return () => { engine.events.off("event", listener); };
}

