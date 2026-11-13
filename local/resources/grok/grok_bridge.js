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

  let currentSelectedAgentId = null;

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
    const response = await fetch(apiPath(endpoint), {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal,
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || result.statusMessage || `Vega 请求失败 (${response.status})`);
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
    avatarShape: nativeShapes[employee.botAvatar?.shape] || employee.botAvatar?.shape || "sparkle",
    avatarColor: nativeColors[employee.botAvatar?.color] || employee.botAvatar?.color || "blue",
    harness: "temporal", origin: "user", viewerIsOwner: employee.mine !== false,
    createdAt: employee.lastAt || 0, updatedAt: employee.lastAt || 0, lastActivityAt: employee.lastAt || 0,
    lastMessagePreview: employee.lastText || "", lastEntry: employee.lastText ? { kind: "text", text: employee.lastText } : null,
    lastMessageId: employee.lastMessageId || null,
    hasUnread: !!employee.unread, isUnread: !!employee.unread, unreadCount: employee.unread || 0,
    isGroup: false, memberIds: [], isRunning: !!employee.running, isRunningTurn: !!employee.running,
    isComposingMessage: !!employee.running, attentionCount: employee.attention || 0, threadId: employee.thread,
  });
  const entryRow = (message) => ({
    id: `entry-${message.seq}`, seq: message.seq, timestampMs: message.at || 0,
    ...(message.role === "assistant"
      ? { kind: "send-message", message: { type: "text", content: message.text || "" }, streaming: false }
      : { kind: "message", role: "user", content: message.text || "", isStreaming: false }),
    tasks: message.tasks || [], ...(message.clientMessageId ? { clientNonce: message.clientMessageId } : {}),
  });
  const threadOf = (id) => {
    if (typeof id !== "string" || !id) throw new Error("请选择 Vega Bot");
    return `employee:${id}`;
  };
  let streamController = null, reconnectTimer = null, rosterTimer = null;
  let entries = new Map(), live = null, streamGeneration = 0, transcriptSequence = 1;
  const transcriptStamp = (id) => ({ replicaKey: `transcript:${id}`, epoch: `vega-${streamGeneration}`, sequence: transcriptSequence });
  function publishTranscript(id, complete = false) {
    transcriptSequence++;
    // A tail snapshot is not a complete history: preserve the renderer's older-page cursor.
    postEvent("transcript", { type: "snapshot", activeAgentId: id, ordered: transcriptStamp(id),
      coverage: { kind: "transcript-live-range", fromSequence: complete ? 1 : transcriptSequence, throughSequence: transcriptSequence },
      entries: [...[...entries.values()].sort((a, b) => a.seq - b.seq), ...(live ? [live] : [])] });
  }
  async function refreshRoster() {
    const data = await api("threads");
    const agents = data.employees.map(agentRow);
    postEvent("agents", { agents, activeAgentId: currentSelectedAgentId });
    postEvent("server-roster-changed", { kind: "resync" });
    return agents;
  }
  async function refreshTranscript(id, generation) {
    const data = await api("messages", { thread: threadOf(id), limit: 100 });
    if (generation !== streamGeneration) return;
    // Keep loaded older pages when the live tail is refreshed, but replace complete or reset histories.
    entries = new Map([...[...entries].filter(([seq]) => data.nextBeforeSeq != null && seq < data.nextBeforeSeq),
      ...data.messages.map((message) => [message.seq, entryRow(message)])]);
    live = null;
    publishTranscript(id, data.nextBeforeSeq == null);
  }
  function stopStream() {
    streamGeneration++;
    streamController?.abort();
    streamController = null;
    clearTimeout(reconnectTimer);
    clearInterval(rosterTimer);
  }
  function follow(id) {
    if (id === currentSelectedAgentId && streamController) return;
    stopStream();
    currentSelectedAgentId = id;
    entries = new Map();
    live = null;
    transcriptSequence = 1;
    if (!id) return;
    const generation = streamGeneration;
    const connect = async () => {
      if (generation !== streamGeneration) return;
      const controller = new AbortController();
      streamController = controller;
      let reader;
      try {
        const response = await fetch(apiPath("stream"), {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ thread: threadOf(id) }), signal: controller.signal,
        });
        if (!response.ok || !response.body) throw new Error("Vega 实时连接不可用");
        reader = response.body.getReader();
        await refreshTranscript(id, generation);
        const decoder = new TextDecoder();
        let pending = "";
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          pending += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");
          if (pending.length > 4 << 20) throw new Error("Vega 事件超出限制");
          for (let end; (end = pending.indexOf("\n\n")) >= 0;) {
            const block = pending.slice(0, end);
            pending = pending.slice(end + 2);
            const text = block.split("\n").filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trimStart()).join("\n");
            if (!text || generation !== streamGeneration) continue;
            const event = JSON.parse(text);
            if (event.type === "closed") throw new Error(event.reason || "实时连接已关闭");
            if (event.type === "message_start") live = null;
            if (event.type === "text_delta") {
              live ||= { kind: "send-message", id: `vega-live-${id}`, message: { type: "text", content: "" }, streaming: true, timestampMs: Date.now() };
              live.message.content += event.data;
              publishTranscript(id);
            } else if (event.type === "message") {
              const entry = entryRow(event.message);
              entries.set(entry.seq, entry);
              if (entry.kind === "send-message") live = null;
              publishTranscript(id);
            } else if (["done", "compacted", "history-changed"].includes(event.type)) {
              if (event.type === "compacted") entries.clear();
              await refreshTranscript(id, generation);
              if (generation === streamGeneration && document.hasFocus?.()) await api("read", { thread: threadOf(id) });
              await refreshRoster();
            } else if (event.type === "roster-changed" || event.type === "started") {
              await refreshRoster();
            }
          }
        }
      } catch (error) {
        if (!controller.signal.aborted) console.error("[Vega] 实时连接中断；只重连读取，不重发操作", error);
      } finally {
        await reader?.cancel().catch(() => {});
        if (!controller.signal.aborted && generation === streamGeneration) reconnectTimer = setTimeout(connect, 2000);
      }
    };
    void connect();
    rosterTimer = setInterval(() => { void refreshRoster().catch((error) => console.error("[Vega] 会话更新失败", error)); }, 15000);
  }
  window.addEventListener?.("pagehide", stopStream);

  // Keep protocol adaptation here; release bundles and styles remain unchanged.
  async function dispatchCoordinatorRequest(method, args = {}) {
    if (["listAgents", "getTrays", "getAsyncTasks", "getSubagents", "takeTeachLearningPrompts", "getAgentAutomations", "getAgentTasks"].includes(method)) return [];
    if (method === "getForeverBoxStatus" || method === "getBotTemplateForSourceAgent") return null;
    if (method === "getTeachRecordingStatus") return { state: "idle" };
    if (method === "isEgressTunnelAvailable") return false;
    if (method === "getHostStatus") return { hostVersion: null, latestHostVersion: null, hostUpdateAvailable: false, isBusy: false, capabilities: [] };
    if (["restoreTemporalAgentRouting", "clearLocalToolPermissions"].includes(method)) return;
    if (method === "noteTranscriptOpened") return api("read", { thread: threadOf(args.id) });
    if (method === "resolveAgentCreation") return { kind: "temporal", scope: "vega" };
    if (method === "noteMountedAgent") { follow(args.id); return; }
    if (method === "countAgents") return (await api("threads")).employees.length;
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
    if (method === "getServerAgentRoster" || method === "listTeamAgents") return { agents: (await api("threads")).employees.map(agentRow) };
    if (method === "openAgentTail" || method === "getAgentTranscriptTail") {
      if (args.sessionId || args.taskId) throw unavailable("分支或任务线程历史");
      const id = args.id || args.agentId;
      if (method === "openAgentTail") follow(id);
      const generation = streamGeneration, ordered = id === currentSelectedAgentId ? transcriptStamp(id) : null;
      const data = await api("messages", { thread: threadOf(id), limit: Math.min(500, args.limit || 100), ...(args.beforeSeq ? { before: args.beforeSeq } : {}) });
      if (method === "openAgentTail") await api("read", { thread: threadOf(id) });
      if (id === currentSelectedAgentId && generation === streamGeneration)
        for (const message of data.messages)
          if (args.beforeSeq || ordered.sequence === transcriptSequence) entries.set(message.seq, entryRow(message));
      return { entries: data.messages.map(entryRow), nextBeforeSeq: data.nextBeforeSeq ?? (data.hasMore ? data.messages[0]?.seq ?? null : null),
        ...(ordered ? { ordered } : {}) };
    }
    if (method === "sendPrompt") {
      if (args.attachmentPaths?.length || args.attachments?.length || args.sessionId || args.taskId || args.isFork || args.replyToId)
        throw unavailable("带附件、分支或任务线程的发送");
      await api("send", { thread: threadOf(args.agentId), text: args.prompt || args.text || "", clientMessageId: args.clientNonce });
      return { accepted: true };
    }
    if (method === "promptAcceptanceStatus") return api("acceptance", { thread: threadOf(args.agentId), clientMessageId: args.clientNonce });
    if (method === "createAgent") {
      if (args.harness === "box" || args.creationRoute?.kind === "box" || args.purpose || args.templateId || args.avatarPngBase64)
        throw unavailable("特殊宿主、模板或图片头像的 Bot 创建");
      const result = await api("create", { name: args.name || "新 Bot", instruction: args.description || "", clientNonce: args.clientNonce,
        ...(args.avatarShape && args.avatarColor ? { avatar: `bot:${args.avatarShape}:${args.avatarColor}` } : {}) });
      const agent = (await refreshRoster()).find((agent) => agent.id === result.id);
      if (!agent) throw new Error("Bot 已创建，但列表尚未确认，请刷新，不要重复创建");
      return { agent, transcript: [] };
    }
    if (method === "updateAgent") {
      const profile = args.profile || {};
      const fields = args.editedFields || Object.keys(profile);
      if (fields.some((field) => !["name", "description", "avatarShape", "avatarColor"].includes(field))) throw unavailable("此 Bot 资料字段");
      const current = (await api("threads")).employees.find((employee) => employee.id === args.id);
      if (!current) throw new Error("Bot 不存在");
      const shape = profile.avatarShape ?? current.botAvatar?.shape;
      const color = profile.avatarColor ?? current.botAvatar?.color;
      const result = await api("update", { thread: threadOf(args.id),
        ...(profile.name === undefined ? {} : { name: profile.name }),
        ...(profile.description === undefined ? {} : { instruction: profile.description }),
        ...(profile.avatarShape !== undefined || profile.avatarColor !== undefined ? { avatar: `bot:${shape}:${color}` } : {}) });
      return (await refreshRoster()).find((agent) => agent.id === result.id) || null;
    }
    if (method === "setAgentUnread") {
      if (args.isUnread) throw unavailable("标为未读");
      return api("read", { thread: threadOf(args.id) });
    }
    if (method === "interruptAgentRun") {
      if (args.sessionId) throw unavailable("停止分支或任务线程");
      return api("cancel", { thread: threadOf(args.id) });
    }
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
      devVoiceHarness: "package",
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
            if (prop === "isWindowShown") return true;
            if (prop === "getCursorAuthStatus") {
              const user = await api("metadata");
              return { kind: "logged-in", authId: user.id, displayName: user.name, profileReady: true };
            }
            if (prop === "getCursorLoginFlight") return { kind: "idle" };
            if (prop === "getOnboardingSeen") return true;
            if (prop === "getSandAccess" || prop === "getSandAccessFresh") return { state: "granted" };
            if (prop === "getGrokBotTermsRecord") return { seenAtMs: 0 };
            if (prop === "getCursorSelectedTeam") return { selectedTeamId: null, fallback: null };
            if (prop === "getHostSidebarSections") return [];
            if (prop === "listSecrets") return { keys: [] };
            if (prop === "getBoxHostPhase") return "settled";
            if (prop === "getLocalPitmanState") return { isRecorderReady: false, session: null };
            if (prop === "getCursorTrainingSetting") return "disallowed";
            if (prop === "getGrokBotUserProfile") {
              const user = await api("metadata");
              return { id: user.id, username: user.name, name: user.name, avatarUrl: null };
            }
            if (prop === "updateGrokBotAgent") {
              if (args.avatarPngBase64 !== undefined) throw unavailable("自定义图片头像");
              const result = await dispatchCoordinatorRequest("updateAgent", { id: args.serverId, profile: args.changed?.fields || args.changed || args });
              return { updatedAtMs: result?.updatedAt || 0 };
            }
            if (prop === "getHostPinnedAgents" || prop === "getServerPinnedAgents") {
              const stored = localStorage.getItem("vega-pinned-agents");
              if (stored !== null) return JSON.parse(stored);
              const roster = await dispatchCoordinatorRequest("getServerAgentRoster", {});
              return roster.agents.length ? [roster.agents[0].id] : [];
            }
            if (prop === "setHostPinnedAgents") {
              if (!Array.isArray(args?.pinnedAgentIds) || args.pinnedAgentIds.some((id) => typeof id !== "string" || !id.trim() || id.length > 64)) throw new Error("Invalid pinned agents");
              const ids = [...new Set(args.pinnedAgentIds)];
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
        release: stopStream,
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
  });

  // WebView2 has no Electron titlebar overlay or draggable-region handling.
  if (window.chrome?.webview) {
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
      if (!windowState.isMaximized) {
        const edge = 6 / zoomFactor();
        const horizontal = event.clientX < edge ? "left" : event.clientX >= window.innerWidth - edge ? "right" : "";
        const vertical = event.clientY < edge ? "top" : event.clientY >= window.innerHeight - edge ? "bottom" : "";
        if (vertical || horizontal) {
          event.preventDefault();
          nativeWindow(`resize-${vertical}${horizontal}`);
          return;
        }
      }
      if (event.target.closest("button,input,textarea,select,a,[contenteditable=true]")) return;
      for (let element = event.target; element; element = element.parentElement) {
        const css = getComputedStyle(element);
        const appRegion = css.getPropertyValue("app-region") || css.getPropertyValue("-webkit-app-region");
        // WebView2 reports "none" for Electron drag regions, so resolve the original classes too.
        const region = ["drag", "no-drag"].includes(appRegion) ? appRegion :
          element.matches(".sand-avu8j0,.sand-1wfn6di,.ui-avu8j0") ? "drag" :
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
