// Grok Bot UI Bridge for Vega WebView2 Desktop Client
(function () {
  console.log("[Vega Grok Bridge] Starting initialization...");

  const basePrefix = window.location.pathname.replace(/\/?$/, "/");
  const apiPath = (endpoint) => `${basePrefix}api/${endpoint}`;
  const subscriptions = new Set();
  const emit = (event, value) => {
    for (const handlers of subscriptions) handlers[event]?.(value);
  };
  const systemTheme = window.matchMedia?.("(prefers-color-scheme: dark)");
  const readTheme = () => {
    const stored = localStorage.getItem("vega-theme-preference");
    const preference = ["light", "dark"].includes(stored) ? stored : "system";
    return { preference, resolved: preference === "system" ? (systemTheme?.matches ? "dark" : "light") : preference };
  };
  const nativeWindow = (action) => window.chrome?.webview?.postMessage(`vega-window:${action}`);
  const zoomFactor = () => (window.devicePixelRatio || 1) / (window.vegaPanelDpiScale || window.devicePixelRatio || 1);
  const languages = ["en", "hi", "zh-CN", "zh-TW", "pl", "es", "pt", "ja", "fr", "ko", "de", "ru", "tr", "ar", "it", "sv", "uk", "nl", "el", "af", "he", "vi", "id", "ur", "th", "bn", "cs", "hu", "nb", "da", "fi", "mr", "te", "sw", "ha", "ta", "pt-PT", "sl"];
  const readLanguage = () => {
    const stored = localStorage.getItem("vega-language-preference");
    const preference = stored === "system" || languages.includes(stored) ? stored : "zh-CN";
    const system = window.navigator?.language || "zh-CN";
    const resolved = preference === "system" ? (languages.find((tag) => tag.toLowerCase() === system.toLowerCase()) || languages.find((tag) => tag === system.split("-")[0]) || "en") : preference;
    return { preference, resolved };
  };
  let windowState = { isFullscreen: false, isMaximized: false };

  // Grok wraps an explicit resend in a new nonce; it is still the same Vega message.
  const messageId = (nonce) => {
    if (typeof nonce !== "string") return;
    if (/^[\w-]{16,80}$/.test(nonce)) return nonce;
    const retry = /^sand-resend-v1:(\d{2}):([\w-]{16,80}):[\w-]{16,80}$/.exec(nonce);
    if (retry && Number(retry[1]) === retry[2].length) return retry[2];
  };
  let currentSelectedAgentId = null;
  const retiredJournalPrefix = "vega:previous-send-journal:";
  const journalKey = /^sand_client_p_sand\.client\.slice\.account\.[^.]+\.send-journal$/;
  const records = (key) => {
    try {
      const rows = JSON.parse(localStorage.getItem(key))?.value?.records;
      return Array.isArray(rows) ? rows : [];
    } catch { return []; }
  };
  let recoveredSends = [], recoveredPanel;
  // A reopened renderer must not turn old, possibly delivered sends back into chat bubbles.
  // Keep their text outside the transcript; the server history is never edited.
  for (const key of Object.keys(localStorage).filter((key) => journalKey.test(key))) {
    const previous = records(retiredJournalPrefix + key), pending = records(key);
    if (!pending.length) continue;
    const merged = new Map([...previous, ...pending].filter((row) => row?.nonce).map((row) => [messageId(row.nonce) || row.nonce, row]));
    try {
      localStorage.setItem(retiredJournalPrefix + key, JSON.stringify({ value: { records: [...merged.values()] } }));
      localStorage.removeItem(key);
    } catch { /* If backup failed, keep the original journal. */ }
  }
  function updateRecoveredSends() {
    if (!recoveredPanel) return;
    const rows = recoveredSends.filter((row) => row.input?.agentId === currentSelectedAgentId && typeof row.input.prompt === "string");
    recoveredPanel.hidden = !rows.length;
    if (!rows.length) recoveredPanel.open = false;
    recoveredPanel.firstElementChild.textContent = `待核对的旧发送（${rows.length}）`;
    recoveredPanel.lastElementChild.textContent = rows.map((row) => row.input.prompt).join("\n\n——\n\n");
  }
  // 1. 本地存储代理 (模拟 Electron 主进程的 ClientPersistence)
  const persistenceKey = (k) => `sand_client_p_${k}`;

  // 2. 双向通信 MessageChannel (模拟 CoordinatorPort)
  let coordinatorPortHandler = null;
  const channel = new MessageChannel();
  const clientPort = channel.port1;
  const serverPort = channel.port2;

  serverPort.onmessage = async function (e) {
    const data = e.data;
    if (!data) return;
    // console.log("[Grok Bridge Port Server Recv]", data);

    if (data.kind === "lifecycle") {
      if (data.phase === "hello") {
        serverPort.postMessage({
          kind: "lifecycle",
          phase: "ready",
          protocolVersion: 3,
        });
      }
      return;
    }

    if (data.kind === "request") {
      const { requestId, method, args } = data;
      try {
        const result = await dispatchCoordinatorRequest(method, args);
        serverPort.postMessage({
          kind: "reply",
          requestId,
          outcome: { status: "ok", value: result },
        });
      } catch (err) {
        console.error(`[Grok Bridge] Request ${method} failed:`, err);
        serverPort.postMessage({
          kind: "reply",
          requestId,
          outcome: { status: "failed", failure: { code: err.code || "internal", message: String(err.message || err),
            ...(err.code === "capability-unavailable" ? { failureCode: "gateway/unknown-method" } : {}) } },
        });
      }
      return;
    }
  };

  async function api(endpoint, body = {}, signal) {
    let response;
    try {
      response = await fetch(apiPath(endpoint), {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal,
      });
    } catch (error) {
      if (endpoint === "send") throw Object.assign(new Error("连接中断，消息是否发送成功未知；请先查看对话，不要重复发送"), { deliveryUnknown: true });
      throw error;
    }
    const result = await response.json().catch(() => null);
    if (endpoint === "send" && (response.status >= 500 || (response.ok && result?.ok !== true)))
      throw Object.assign(new Error("消息是否发送成功未知；请先查看对话，不要重复发送"), { deliveryUnknown: true });
    if (!response.ok || !result) throw new Error(result?.statusMessage || result?.error || `Vega 请求失败 (${response.status})`);
    return result;
  }
  function unavailable(method) {
    return Object.assign(new Error(`Vega 暂未接入此功能：${method}`), { code: "capability-unavailable" });
  }
  const postEvent = (family, payload) => serverPort.postMessage({ kind: "event", family, payload });
  const nativeShapes = { round: "pebble", tile: "squircle", chonk: "tablet", drop: "teardrop", triangle: "wedge", cog: "flower", hexagon: "hex", apple: "pumpkin", ghost: "dome" };
  const nativeColors = { amber: "yellow", teal: "cyan", purple: "violet", pink: "magenta", sky: "cyan" };
  const agentRow = (employee) => ({
    id: employee.id, name: employee.name, description: employee.instruction || "", title: "Vega",
    avatarShape: nativeShapes[employee.avatar?.split(":")[1]] || "sparkle",
    avatarColor: nativeColors[employee.avatar?.split(":")[2]] || "blue",
    harness: "temporal", origin: "user", viewerIsOwner: employee.mine !== false,
    createdAt: employee.lastAt || 0, updatedAt: employee.lastAt || 0, lastActivityAt: employee.lastAt || 0,
    lastViewedAt: employee.lastViewedAt ?? (employee.unread ? 0 : employee.lastAt || 0),
    lastMessagePreview: employee.lastText || "", lastEntry: employee.lastText ? { kind: "text", text: employee.lastText } : null,
    lastMessageId: employee.lastMessageId || null,
    hasUnread: !!employee.unread, isUnread: !!employee.unread, unreadCount: employee.unread || 0,
    isGroup: false, memberIds: [], isRunning: !!employee.running, isRunningTurn: !!employee.running,
    isComposingMessage: !!employee.running, attentionCount: employee.attention || 0, threadId: employee.thread,
  });
  const textOnlyAccess = { state: "granted", speechUiHidden: true };
  let groupIds;
  const rosterRows = ({ employees = [], groups = [] }) => {
    groupIds = groups.map((group) => group.thread);
    return [
      ...employees.map(agentRow),
      ...groups.map((group) => ({
        ...agentRow({ ...group, id: group.thread, avatar: "bot:hexagon:teal" }),
        isGroup: true, title: "群聊",
      })),
    ];
  };
  const sidebarSections = () => groupIds.length ? [
    { id: "__agents__", name: "Bot", agentIds: [] },
    { id: "vega-groups", name: "群聊", agentIds: groupIds },
  ] : [];
  const botPins = (ids) => ids.filter((id) => !id.startsWith("group:"));
  const entryId = (seq) => `entry-${seq}`;
  let account;
  const identity = () => account ??= api("metadata").then((user) => {
    const slot = encodeURIComponent(user.id).replaceAll(".", "%2E");
    recoveredSends = records(retiredJournalPrefix + persistenceKey(`sand.client.slice.account.${slot}.send-journal`));
    updateRecoveredSends();
    return user;
  }).catch((error) => { account = undefined; throw error; });

  // The imported renderer must never boot into its own sign-in screen.
  document.addEventListener("DOMContentLoaded", () => {
    const welcome = document.getElementById("vega-welcome");
    if (!welcome) return;
    const actions = document.getElementById("vega-welcome-actions");
    const status = document.getElementById("vega-welcome-status");
    const authorize = document.getElementById("vega-authorize");
    welcome.dataset.theme = desktop.boot.theme.resolved;
    let checking = false;
    async function check() {
      if (checking) return;
      checking = true;
      try {
        const user = await identity();
        if (!user?.id) { account = undefined; throw new Error("缺少本站账号"); }
      } catch {
        status.textContent = "请用本站账号登录，并在浏览器中确认这台电脑的设备授权。";
        actions.hidden = false;
        checking = false;
        return;
      }
      window.removeEventListener("focus", check);
      actions.hidden = true;
      status.textContent = "正在打开对话…";
      try {
        await import(document.getElementById("root").dataset.vegaEntry);
        welcome.remove();
      } catch {
        status.textContent = "无法打开对话界面，请退出牵牛星后重新启动。";
      }
    }
    authorize.addEventListener("click", async () => {
      authorize.disabled = true;
      try {
        await api("authorize");
        status.textContent = "请在系统浏览器完成授权，再回到牵牛星。";
      } catch (error) {
        status.textContent = error.message;
      } finally {
        authorize.disabled = false;
      }
    });
    document.getElementById("vega-recheck").addEventListener("click", check);
    window.addEventListener("focus", check);
    void check();
  }, { once: true });

  const entryRows = (messages, groupViewer) => messages.filter((message) =>
    Number.isSafeInteger(message.seq) && ["user", "assistant"].includes(message.role) &&
    (!message.runtime || message.runtime === "steer" && !!message.clientMessageId) &&
    (message.displayText ?? message.text)?.trim()
  ).map((message) => {
    const mine = groupViewer === undefined ? message.role === "user" :
      message.author?.kind === "user" && message.author.id === groupViewer;
    const label = groupViewer !== undefined && !mine ? (message.author?.name || (message.notice ? "系统" : "群成员")) : "";
    const text = message.displayText ?? message.text;
    const content = label ? `${label}：\n${text}` : text;
    return {
      id: entryId(message.seq), seq: message.seq, timestampMs: message.at || 0,
      ...(mine
        ? { kind: "message", role: "user", content, isStreaming: false }
        : { kind: "send-message", message: { type: "text", content }, streaming: false }),
      tasks: message.tasks || [], ...(mine && message.clientMessageId ? { clientNonce: message.clientMessageId } : {}),
    };
  });
  const threadOf = (id) => {
    if (typeof id !== "string" || !id) throw new Error("请选择对话");
    return id.startsWith("group:") ? id : `employee:${id}`;
  };
  // shortcut: master exposes the last 200 messages and an append cursor, not older-page or token-stream APIs.
  const historyLimit = 200;
  const recent = (thread, signal) => api("messages", { thread, limit: historyLimit }, signal);
  const sends = new Map();
  function noteConfirmed(thread, entries) {
    if (!recoveredSends.length) return;
    const ids = new Set(entries.map((entry) => entry.clientNonce).filter(Boolean));
    const remaining = recoveredSends.filter((row) => !(row.input?.agentId && threadOf(row.input.agentId) === thread && ids.has(messageId(row.nonce))));
    if (remaining.length !== recoveredSends.length) {
      recoveredSends = remaining;
      updateRecoveredSends();
    }
  }
  function dedupeEntries(entries) {
    const seen = new Set();
    return entries.filter(({ id, clientNonce }) => {
      const key = clientNonce ? `own:${clientNonce}` : id;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
  const findReceipt = async (thread, nonce) => {
    const data = await api("messages", { thread, receiptFor: nonce, limit: historyLimit });
    if (data.receiptFor === nonce) return data.receipt?.seq;
    // Older backends ignore receiptFor. Only an exact own-message ID in history is proof.
    const { id } = await identity();
    return data.messages?.find((row) => row.role === "user" && row.actorId === id && row.clientMessageId === nonce)?.seq;
  };
  let pollController, pollTimer, resumePoll, rosterTimer, rosterRequest = 0;
  let hostVisible = true;
  const visible = () => hostVisible && !document.hidden;
  let wasVisible = visible();
  const foreground = () => visible() && document.hasFocus?.() === true;
  let transcriptEpoch = 0, transcriptSequence = 1;
  const transcriptStamp = (id) => ({ replicaKey: `transcript:${id}`, epoch: `vega-${transcriptEpoch}`, sequence: transcriptSequence });
  async function refreshRoster(signal) {
    const request = ++rosterRequest;
    const data = await api("threads", {}, signal);
    if (!visible() || signal?.aborted || request !== rosterRequest) return;
    const agents = rosterRows(data);
    postEvent("agents", { agents, activeAgentId: currentSelectedAgentId });
    postEvent("server-roster-changed", { kind: "resync" });
  }
  const refreshVisibleRoster = () => {
    if (rosterTimer !== undefined && visible()) void refreshRoster().catch((error) => console.error("[Vega] 会话列表刷新失败", error));
  };
  function visibilityChanged() {
    const shown = visible();
    if (shown !== wasVisible) {
      wasVisible = shown;
      emit("window-visibility", { visible: shown });
    }
    if (!shown) {
      clearTimeout(pollTimer);
      return;
    }
    refreshVisibleRoster();
    resumePoll?.();
  }
  function stopFollowing() {
    pollController?.abort();
    pollController = resumePoll = undefined;
    currentSelectedAgentId = null;
    updateRecoveredSends();
    clearTimeout(pollTimer);
  }
  function follow(id) {
    if (id === currentSelectedAgentId && pollController) return;
    stopFollowing();
    if (!id) return;
    currentSelectedAgentId = id;
    updateRecoveredSends();
    transcriptEpoch++;
    transcriptSequence = 1;
    const thread = threadOf(id);
    const { signal } = pollController = new AbortController();
    let entries = [], lastSeq, running, inFlight = false;
    const schedule = (delay) => {
      if (!visible() || inFlight || signal.aborted) return;
      clearTimeout(pollTimer);
      pollTimer = setTimeout(poll, delay);
    };
    const poll = async () => {
      if (!visible() || signal.aborted) return;
      inFlight = true;
      try {
        let page = lastSeq === undefined ? await recent(thread, signal) : await api("messages", { thread, after: lastSeq }, signal);
        if (!visible() || signal.aborted) return;
        const reset = lastSeq !== undefined && page.lastSeq < lastSeq;
        if (reset) page = await recent(thread, signal);
        if (!visible() || signal.aborted) return;
        if (lastSeq === undefined || reset || page.messages.length) {
          const viewer = thread.startsWith("group:") ? (await identity()).id : undefined;
          if (!visible() || signal.aborted) return;
          const received = entryRows(page.messages, viewer);
          noteConfirmed(thread, received);
          entries = dedupeEntries([...(reset ? [] : entries), ...received]).slice(-historyLimit);
          // Advance only through rows returned by this response, not a concurrently queried MAX(seq).
          lastSeq = page.messages.at(-1)?.seq ?? 0;
          transcriptSequence++;
          postEvent("transcript", { type: "snapshot", activeAgentId: id, ordered: transcriptStamp(id),
            coverage: { kind: "transcript-live-range", fromSequence: reset ? 1 : transcriptSequence, throughSequence: transcriptSequence }, entries });
        }
        const needsRead = Number.isSafeInteger(page.readSeq) && lastSeq > page.readSeq && foreground();
        if (needsRead) await api("read", { thread, through: lastSeq }, signal);
        if ((needsRead || running !== page.running) && !signal.aborted) {
          await refreshRoster(signal);
          running = page.running;
        }
      } catch (error) {
        if (!signal.aborted) console.error("[Vega] 对话刷新失败（未重发消息）", error);
      } finally {
        inFlight = false;
        schedule(1500);
      }
    };
    resumePoll = () => schedule(0);
    schedule(1500);
  }
  function stopBackground() {
    stopFollowing();
    clearInterval(rosterTimer);
    rosterTimer = undefined;
    rosterRequest++;
  }
  window.addEventListener?.("focus", visibilityChanged);
  document.addEventListener("visibilitychange", visibilityChanged);
  window.addEventListener?.("pagehide", stopBackground);

  // Keep protocol adaptation here; release bundles and styles remain unchanged.
  async function dispatchCoordinatorRequest(method, args = {}) {
    if (["listAgents", "getTrays", "getAsyncTasks", "getSubagents", "takeTeachLearningPrompts", "getAgentAutomations", "getAgentTasks"].includes(method)) return [];
    if (method === "getForeverBoxStatus" || method === "getBotTemplateForSourceAgent") return null;
    if (method === "getTeachRecordingStatus") return { state: "idle" };
    if (method === "isEgressTunnelAvailable") return false;
    if (method === "getHostStatus") return { hostVersion: null, latestHostVersion: null, hostUpdateAvailable: false, isBusy: false, capabilities: [] };
    if (["restoreTemporalAgentRouting", "clearLocalToolPermissions"].includes(method)) return;
    // Only the foreground polling path marks the exact received history as read.
    if (method === "noteTranscriptOpened") return;
    if (method === "resolveAgentCreation") return { kind: "temporal", scope: "vega" };
    if (method === "noteMountedAgent") { follow(args.id); return; }
    if (method === "countAgents") return rosterRows(await api("threads")).length;
    if (["getMainAgent", "ensureDefaultMainAgent"].includes(method)) {
      const agents = (await api("threads")).employees;
      const stored = localStorage.getItem("vega-main-agent");
      return { agentId: agents.find((agent) => agent.id === stored)?.id || agents[0]?.id || null,
        ...(method === "ensureDefaultMainAgent" ? { outcome: "present" } : {}) };
    }
    if (method === "setMainAgent") {
      const id = args.agentId || args.id;
      if (!(await api("threads")).employees.some((agent) => agent.id === id)) throw new Error("Bot 不存在");
      localStorage.setItem("vega-main-agent", id);
      postEvent("server-roster-changed", { kind: "settings", fields: ["mainAgent"], explicit: true });
      return { agentId: id };
    }
    if (method === "getServerAgentRoster" || method === "listTeamAgents") {
      rosterTimer ??= setInterval(refreshVisibleRoster, 5000);
      return { agents: rosterRows(await api("threads")) };
    }
    if (method === "openAgentTail" || method === "getAgentTranscriptTail") {
      if (args.sessionId || args.taskId) throw unavailable("分支或任务线程历史");
      const id = args.id || args.agentId;
      if (method === "openAgentTail") follow(id);
      const thread = threadOf(id), ordered = id === currentSelectedAgentId ? transcriptStamp(id) : null;
      const page = await recent(thread);
      const viewer = thread.startsWith("group:") ? (await identity()).id : undefined;
      const received = dedupeEntries(entryRows(page.messages, viewer));
      noteConfirmed(thread, received);
      const available = received.filter((entry) => args.beforeSeq == null || entry.seq < args.beforeSeq);
      const limit = Math.max(1, Math.min(historyLimit, Number(args.limit) || 100));
      const entries = available.slice(-limit);
      return { entries, nextBeforeSeq: available.length > limit ? entries[0].seq : null, ...(ordered ? { ordered } : {}) };
    }
    if (method === "sendPrompt") {
      if (args.attachmentPaths?.length || args.attachments?.length || args.sessionId || args.taskId || args.isFork || args.replyToId)
        throw unavailable("带附件、分支或任务线程的发送");
      const thread = threadOf(args.agentId), text = String(args.prompt || args.text || "").trim();
      if (!text) throw new Error("请输入消息");
      const nonce = messageId(args.clientNonce);
      if (!nonce) throw new Error("消息编号无效，请重新打开对话");
      const key = JSON.stringify([thread, nonce]);
      if (sends.has(key)) {
        const previous = sends.get(key);
        if (previous.text !== text) throw new Error("消息编号已使用");
        return previous.result;
      }
      const result = (async () => {
        if (nonce !== args.clientNonce) {
          const seq = await findReceipt(thread, nonce).catch(() => undefined);
          if (seq) return { accepted: true };
          throw new Error("无法确认原消息是否送达，请核对聊天记录；未再次发送");
        }
        try { await api("send", { thread, text, clientMessageId: nonce }); }
        catch (error) {
          // A dropped HTTP reply is not a failed send if this exact message was already stored.
          if (!error.deliveryUnknown || !await findReceipt(thread, nonce).catch(() => undefined)) throw error;
        }
        return { accepted: true };
      })();
      if (sends.size >= 32) sends.delete(sends.keys().next().value);
      sends.set(key, { text, result });
      return result;
    }
    if (method === "promptAcceptanceStatus") {
      const nonce = messageId(args.clientNonce);
      if (!args.agentId || !nonce) return { outcome: "unknown-durability" };
      const seq = await findReceipt(threadOf(args.agentId), nonce);
      return seq ? { outcome: "found", record: { status: "accepted", echoEntryId: entryId(seq) } } : { outcome: "unknown-durability" };
    }
    if (method === "createAgent" || method === "updateAgent") throw unavailable("Bot 创建和编辑，请到 Vega 网页操作");
    if (method === "setAgentUnread") {
      if (args.isUnread) throw unavailable("标为未读");
      const thread = threadOf(args.id);
      if (foreground()) {
        const { messages } = await recent(thread);
        if (foreground() && messages.length) await api("read", { thread, through: messages.at(-1).seq });
        refreshVisibleRoster();
      }
      return;
    }
    if (method === "interruptAgentRun") throw unavailable("停止当前回复，请到 Vega 网页操作");
    if (method === "seedConversationName") return { outcome: "unchanged" };
    if (method === "kickstartAgent") return null;
    throw unavailable(method);
  }

  // 4. 构建 window.desktop (Electron 兼容层)
  const desktop = {
    boot: {
      theme: readTheme(),
      language: readLanguage(),
      isAssistiveTechEnabled: false,
      isEgressTunnelEnabled: false,
      isWebauthnProxyEnabled: false,
      isBotColorInChatEnabled: localStorage.getItem("vega-bot-color") !== "false",
      egressTunnelStatus: "inactive",
      mainEdge: "served",
      rosterPhotos: null,
      computerUseHelperName: null,
      // Match the original renderer's typography and chat-layout release, not unrelated product gates.
      experiments: {
        isInitialized: true,
        featureGates: {
          sand_xvf_typeface: true,
          sand_chat_prose_15px: true,
          grok_bot_page_stage_chat: true,
          grok_bot_all_bots_color_theming: true,
          grok_bot_group_chats: true,
          grok_bot_full_view_stage: false,
          grok_bot_stage_inset_modal: false,
          grok_bot_files_stage: true,
          grok_bot_library_pages: true,
          grok_bot_pages_search: true,
          sand_chat_popout: true,
          sand_grok_main_agent: true,
        },
      },
    },
    environment: {
      platform: "win32",
      isDev: false,
      isWaylandClient: false,
      usesProductionBackend: false,
    },
    local: {
      getZoomFactor: zoomFactor,
      noteRendererAlive: () => {},
      noteBootGateLanded: () => {},
      noteBootGateOpened: () => {},
      stageAttachmentFile: async () => { throw unavailable("附件上传"); },
    },
    main: new Proxy(
      {},
      {
        get: function (target, prop) {
          if (prop === "subscribe") return (handlers) => {
            subscriptions.add(handlers);
            return () => subscriptions.delete(handlers);
          };
          return async function (args) {
            if (prop === "hasMigratedClientPersistence") return true;
            if (prop === "readManyClientPersistence") {
              const matches = (key, prefixes) => Math.max(-1, ...prefixes.filter((prefix) => key.startsWith(prefix)).map((prefix) => prefix.length));
              return Object.fromEntries(Object.keys(localStorage)
                .filter((key) => key.startsWith(persistenceKey("")))
                .map((key) => [key.slice(persistenceKey("").length), localStorage.getItem(key)])
                .filter(([key]) => matches(key, args.include) >= 0 && matches(key, args.include) >= matches(key, args.exclude)));
            }
            if (prop === "readClientPersistence") {
              return localStorage.getItem(persistenceKey(args?.key));
            }
            if (prop === "writeClientPersistence") {
              localStorage.setItem(persistenceKey(args?.key), args?.value || "");
              return;
            }
            if (prop === "removeClientPersistence") {
              localStorage.removeItem(persistenceKey(args?.key));
              return;
            }
            if (prop === "listClientPersistenceKeys") {
              const prefix = args?.prefix || "";
              const keys = [];
              for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (k.startsWith("sand_client_p_" + prefix)) {
                  keys.push(k.replace("sand_client_p_", ""));
                }
              }
              return keys;
            }
            if (prop === "getThemeState") return desktop.boot.theme;
            if (prop === "setThemePreference") {
              if (!["system", "light", "dark"].includes(args?.preference)) throw new Error("Invalid theme preference");
              localStorage.setItem("vega-theme-preference", args.preference);
              updateTheme();
              return desktop.boot.theme;
            }
            if (prop === "getExperimentsSnapshot") return desktop.boot.experiments;
            if (prop === "minimizeWindow") return nativeWindow("minimize");
            if (prop === "toggleMaximizeWindow") return nativeWindow("toggle-maximize");
            if (prop === "closeWindow") return nativeWindow("close");
            if (prop === "getLanguageState") return desktop.boot.language;
            if (prop === "setLanguagePreference") {
              if (args?.preference !== "system" && !languages.includes(args?.preference)) throw new Error("Invalid language preference");
              localStorage.setItem("vega-language-preference", args.preference);
              desktop.boot.language = readLanguage();
              emit("language-changed", desktop.boot.language);
              return desktop.boot.language;
            }
            if (prop === "getBotColorInChatEnabled") return localStorage.getItem("vega-bot-color") !== "false";
            if (prop === "setBotColorInChatEnabled") {
              if (typeof args?.enabled !== "boolean") throw new Error("Invalid bot color preference");
              localStorage.setItem("vega-bot-color", String(args.enabled));
              desktop.boot.isBotColorInChatEnabled = args.enabled;
              return;
            }
            if (prop === "setTitleBarOverlayTone") {
              if (typeof args?.isOverlayTone !== "boolean") throw new Error("Invalid overlay tone");
              const controls = document.getElementById("vega-window-controls");
              if (controls) controls.dataset.overlayTone = String(args.isOverlayTone);
              return;
            }
            if (prop === "getEgressTunnelStatus") return "inactive";
            if (prop === "getEgressTunnelEnabled" || prop === "getEgressTunnelForcedByAdmin" || prop === "getWebauthnProxyEnabled") return false;
            if (prop === "getWindowState") return windowState;
            if (prop === "isWindowShown") return visible();
            if (prop === "getCursorAuthStatus") {
              const user = await identity();
              return { kind: "logged-in", authId: user.id, displayName: user.name, profileReady: true };
            }
            if (prop === "getCursorLoginFlight") return { kind: "idle" };
            if (prop === "getOnboardingSeen") return true;
            if (prop === "getSandAccess" || prop === "getSandAccessFresh") return textOnlyAccess;
            if (prop === "getGrokBotTermsRecord") return { seenAtMs: 0 };
            if (prop === "getCursorSelectedTeam") return { selectedTeamId: null, fallback: null };
            if (prop === "getHostSidebarSections") {
              if (!groupIds) rosterRows(await api("threads"));
              return sidebarSections();
            }
            if (prop === "listSecrets") return { keys: [] };
            if (prop === "getBoxHostPhase") return "settled";
            if (prop === "getLocalPitmanState") return { isRecorderReady: false, session: null };
            if (prop === "getCursorTrainingSetting") return "disallowed";
            if (prop === "getGrokBotUserProfile") {
              const user = await identity();
              return { id: user.id, username: user.name, name: user.name, avatarUrl: null };
            }
            if (prop === "updateGrokBotAgent") throw unavailable("Bot 编辑，请到 Vega 网页操作");
            if (prop === "getHostPinnedAgents" || prop === "getServerPinnedAgents") {
              const stored = localStorage.getItem("vega-pinned-agents");
              if (stored !== null) return botPins(JSON.parse(stored));
              const roster = await dispatchCoordinatorRequest("getServerAgentRoster", {});
              const firstBot = roster.agents.find((row) => !row.isGroup);
              return firstBot ? [firstBot.id] : [];
            }
            if (prop === "setHostPinnedAgents") {
              if (!Array.isArray(args?.pinnedAgentIds) || args.pinnedAgentIds.some((id) => typeof id !== "string" || !id.trim() || id.length > 64)) throw new Error("Invalid pinned agents");
              const ids = [...new Set(botPins(args.pinnedAgentIds))];
              localStorage.setItem("vega-pinned-agents", JSON.stringify(ids));
              return ids;
            }
            if (prop === "listGrokBotTeamAgents") return [];
            if (prop === "getCredentialsState") {
              return { hasValidCredentials: true };
            }
            if (prop === "getMcpState") {
              return { servers: [] };
            }
            if (prop === "getUpdateStatus") {
              return {
                state: { type: "disabled", reason: "not-packaged" },
                delivery: "in-app", currentVersion: "Vega", currentTrack: "stable",
                trackOverride: null, buildDefaultTrack: null, availableTracks: ["stable"],
                isTrackManagedByPolicy: false, isBelowMinimumVersion: false, autoUpdateWhenIdle: false,
              };
            }
            if (/^(get|list|read|is|has)/.test(String(prop))) return null;
            if (/^(note|report|log)/.test(String(prop))) return;
            throw unavailable(String(prop));
          };
        },
      }
    ),
  };

  // 5. 构建 window.coordinatorPort
  const coordinatorPort = {
    claim: function (handler) {
      coordinatorPortHandler = handler;
      setTimeout(() => {
        if (coordinatorPortHandler && coordinatorPortHandler.onPort) {
          coordinatorPortHandler.onPort({
            accountSlot: "vega-local",
            postMessage: (msg) => clientPort.postMessage(msg),
            close: () => clientPort.close(),
            start: () => clientPort.start(),
            addEventListener: (type, listener) => clientPort.addEventListener(type, listener),
          });
        }
      }, 0);
      return {
        request: () => {},
        release: stopBackground,
      };
    },
  };

  function updateTheme() {
    desktop.boot.theme = readTheme();
    nativeWindow(`theme-${desktop.boot.theme.resolved}`);
    document.documentElement?.style.setProperty("--vega-caption-symbol", desktop.boot.theme.resolved === "dark" ? "#fff" : "#000");
    emit("theme-changed", desktop.boot.theme);
  }
  systemTheme?.addEventListener("change", updateTheme);
  let lastZoom = zoomFactor();
  const updateZoom = () => {
    const factor = zoomFactor();
    if (factor !== lastZoom) {
      lastZoom = factor;
      emit("zoom-factor-changed", { factor });
    }
  };
  window.addEventListener?.("resize", updateZoom);
  window.addEventListener?.("vega-window-state", ({ detail }) => {
    windowState = { isFullscreen: false, isMaximized: detail.isMaximized };
    emit("window-state", windowState);
    updateZoom();
    const button = document.getElementById("vega-window-maximize");
    if (button) {
      button.setAttribute("aria-label", detail.isMaximized ? "还原窗口" : "最大化");
      button.dataset.maximized = String(detail.isMaximized);
    }
    if (typeof detail.visible === "boolean" && hostVisible !== detail.visible) {
      hostVisible = detail.visible;
      visibilityChanged();
    }
  });

  document.addEventListener("DOMContentLoaded", () => {
    const style = document.createElement("style");
    // Grok does not expose a reaction switch. These are the localized values of its reaction label (9OEgyT).
    const labels = "Add reaction|Adicionar reação|Aggiungi reazione|Agregar reacción|Ajouter une réaction|Dodaj odziv|Dodaj reakcję|Legg til reaksjon|Lisää reaktio|Lägg till reaktion|Ongeza itikio|Přidat reakci|Reactie toevoegen|Reakció hozzáadása|Reaktion hinzufügen|Tambahkan reaksi|Tepki ekle|Thêm phản ứng|Tilføj reaktion|Voeg reaksie by|Ƙara martani|Προσθήκη αντίδρασης|Добавить реакцию|Додати реакцію|הוספת תגובה|إضافة تفاعل|ردعمل شامل کریں|प्रतिक्रिया जोड़ें|प्रतिक्रिया जोडा|রিঅ্যাকশন যোগ করুন|எதிர்வினையைச் சேர்|రియాక్షన్‌ను జోడించండి|เพิ่มรีแอคชัน|リアクションを追加|新增表情回應|添加回应|반응 추가";
    const reactions = labels.split("|").map(label => `[aria-label=${JSON.stringify(label)}]`).join(",");
    // Keep the server-derived sidebar badge and read boundary, not Grok's separate scroll-count pill.
    style.textContent = `button.sand-message-hover-actions__button:is(${reactions}), .sand-new-messages-pill { display:none !important }
      #vega-recovered-sends { position:fixed; right:16px; bottom:68px; z-index:100; max-width:min(340px,80vw); padding:4px 10px; border:1px solid var(--sand-border-secondary, #8886); border-radius:8px; background:var(--sand-bg-chrome, Canvas); color:var(--sand-fg-primary, CanvasText); font:12px system-ui; }
      #vega-recovered-sends summary { cursor:pointer; }
      #vega-recovered-sends pre { max-height:24vh; overflow:auto; white-space:pre-wrap; overflow-wrap:anywhere; font:inherit; }`;
    document.head.append(style);
    recoveredPanel = document.createElement("details");
    recoveredPanel.id = "vega-recovered-sends";
    const hint = document.createElement("p");
    hint.textContent = "这些是本机上次留下的文字，不能确认是否送达。请先核对聊天记录，不会自动重发。";
    recoveredPanel.append(document.createElement("summary"), hint, document.createElement("pre"));
    document.body.append(recoveredPanel);
    updateRecoveredSends();
  }, { once: true });

  // WebView2 has no Electron titlebar overlay or draggable-region handling.
  if (window.chrome?.webview) {
    nativeWindow("chat-ready");
    nativeWindow(`theme-${desktop.boot.theme.resolved}`);
    document.addEventListener("DOMContentLoaded", () => {
      const style = document.createElement("style");
      style.textContent = `
        #vega-window-controls{position:fixed;z-index:2147483647;right:0;top:0;display:flex;width:calc(140px / var(--sand-zoom-factor,1));height:calc(51px / var(--sand-zoom-factor,1));color:var(--vega-caption-symbol,#000);background:var(--sand-bg-chrome)}
        #vega-window-controls[data-overlay-tone=true]{height:calc(43px / var(--sand-zoom-factor,1));background:#141414;color:#fff}
        #vega-window-controls button{all:unset;box-sizing:border-box;display:grid;place-content:center;flex:1;cursor:default}
        #vega-window-controls button:hover{background:color-mix(in srgb,currentColor 10%,transparent)}
        #vega-window-controls button:focus-visible{outline:2px solid currentColor;outline-offset:-3px}
        #vega-window-controls button:last-child:hover{background:#c42b1c;color:#fff}
        #vega-window-controls svg{width:calc(10px / var(--sand-zoom-factor,1));height:calc(10px / var(--sand-zoom-factor,1));fill:none;stroke:currentColor;stroke-width:1}
        #vega-window-maximize .restore{display:none}
        #vega-window-maximize[data-maximized=true] .maximize{display:none}
        #vega-window-maximize[data-maximized=true] .restore{display:block}
      `;
      const controls = document.createElement("div");
      controls.id = "vega-window-controls";
      controls.setAttribute("role", "group");
      controls.setAttribute("aria-label", "窗口控制");
      for (const [action, label, shape] of [
        ["minimize", "最小化", '<path d="M0 5h10"/>'],
        ["toggle-maximize", "最大化", '<rect class="maximize" x=".5" y=".5" width="9" height="9" rx=".8"/><g class="restore"><path d="M2.5 2.5v-2h7v7h-2"/><rect x=".5" y="2.5" width="7" height="7" rx=".8"/></g>'],
        ["close", "关闭窗口", '<path d="m.5.5 9 9m0-9-9 9"/>'],
      ]) {
        const button = document.createElement("button");
        button.type = "button";
        button.setAttribute("aria-label", label);
        if (action === "toggle-maximize") button.id = "vega-window-maximize";
        button.innerHTML = `<svg viewBox="0 0 10 10" aria-hidden="true">${shape}</svg>`;
        button.addEventListener("click", () => nativeWindow(action));
        controls.append(button);
      }
      document.head.append(style);
      document.body.append(controls);
      document.documentElement.style.setProperty("--vega-caption-symbol", desktop.boot.theme.resolved === "dark" ? "#fff" : "#000");
    }, { once: true });
    document.addEventListener("mousedown", (event) => {
      if (event.button !== 0) return;
      if (event.target.closest("button,input,textarea,select,a,[contenteditable=true]")) return;
      for (let element = event.target; element; element = element.parentElement) {
        const css = getComputedStyle(element);
        const appRegion = css.getPropertyValue("app-region") || css.getPropertyValue("-webkit-app-region");
        // WebView2 reports "none" for Electron drag regions, so resolve the original classes too.
        const region = ["drag", "no-drag"].includes(appRegion) ? appRegion :
          element.matches("#vega-welcome-drag,.sand-avu8j0,.sand-1wfn6di,.ui-avu8j0") ? "drag" :
            element.matches(".sand-lvsv26,.sand-482pwi,.ui-lvsv26") ? "no-drag" :
              element.matches(".sand-1a4o4su,.sand-17v0fby") ? css.getPropertyValue("--sand-app-region").trim() : "";
        if (!region) continue;
        if (region === "drag") {
          event.preventDefault();
          nativeWindow(event.detail === 2 ? "toggle-maximize" : "drag");
        }
        break;
      }
    });
  }

  // 注入全局对象
  window.desktop = desktop;
  window.coordinatorPort = coordinatorPort;
  window.sandPopout = { agentId: null };
  window.sandSpotlight = { isSpotlight: false };
  // 未实现的可选 Electron 能力不要声明，渲染器会据此跳过它们。

  console.log("[Vega Grok Bridge] Injected successfully.");
})();
