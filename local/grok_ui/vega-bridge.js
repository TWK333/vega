// Only the Electron/Coordinator boundary is adapted. Grok's renderer owns every component and DOM node.
(() => {
  const base = new URL('./', location.href);
  const desktopListeners = new Set(), ports = new Set(), watched = new Map(), attempts = new Map(), staged = new Map();
  let roster = [], selected = null, host = null, polling = false;
  const key = name => 'vega.grok.' + base.pathname + ':' + name;
  const read = (name, fallback = null) => { try { const value = localStorage.getItem(key(name)); return value === null ? fallback : JSON.parse(value); } catch { return fallback; } };
  const write = (name, value) => localStorage.setItem(key(name), JSON.stringify(value));
  const theme = () => { const preference = read('theme', 'system'); return { preference, resolved: preference === 'system' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : preference }; };
  const language = () => ({ preference: 'en', resolved: 'en', systemLanguage: navigator.language });
  const experiments = { isInitialized: true, hasAuthenticatedBootstrap: true, featureGates: { grok_bot_multiplayer: false }, dynamicConfigs: {} };
  const unsupported = method => { const error = new Error('Vega 尚未接入此功能：' + method); error.code = 'source/capability-unavailable'; throw error; };
  async function api(op, body = {}) {
    const response = await fetch(new URL('api/' + op, base), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await response.json();
    if (!response.ok || data.error) throw new Error(data.error || ('HTTP ' + response.status));
    return data;
  }
  const boot = api('host').then(value => (host = value));
  const emitDesktop = (name, value) => { for (const listeners of desktopListeners) listeners[name]?.(value); };
  const event = (family, payload) => { for (const port of ports) port.postMessage({ kind: 'event', family, payload }); };
  function agentOf(item) {
    return { id: item.thread, name: item.name, description: '', title: '', harness: 'temporal', origin: 'server',
      avatarShape: 'sparkle', avatarColor: 'blue', isGroup: item.kind === 'group', memberIds: [],
      createdAt: item.lastAt || 0, updatedAt: item.lastAt || 0, lastActivityAt: item.lastAt || 0,
      isRunning: !!item.running, hasUnread: !!item.unread, unreadCount: item.unread || 0, awaitingUserResponse: null,
      viewerIsOwner: item.mine !== false, visibility: 'owner', isActive: item.thread === selected };
  }
  async function refreshRoster() {
    const data = await api('threads');
    roster = [...(data.employees || []), ...(data.groups || [])];
    return roster.map(agentOf);
  }
  const filePath = file => '/vega-blob/' + file.blobId + '/' + encodeURIComponent(file.name || 'image.png');
  function entriesOf(messages, agentId) {
    return messages.filter(m => m.role !== 'tool').flatMap(m => {
      const common = { seq: m.seq, timestampMs: m.at || 0, ...(m.clientMessageId ? { clientNonce: m.clientMessageId } : {}) };
      const content = [m.text || '', m.stepOutput?.text || ''].filter(Boolean).join('\n\n');
      const files = [...(m.images || []), ...(m.files || []), ...(m.stepOutput?.files || [])];
      return [
        ...files.filter(file => file.blobId).map((file, index) => ({ ...common, id: agentId + ':' + m.seq + ':file' + index, kind: 'user-attachment', file_path: filePath(file), file_name: file.name || 'image.png', ...(file.size === undefined ? {} : { byteSize: file.size }) })),
        ...(content ? [{ ...common, id: agentId + ':' + m.seq, kind: 'message', role: m.role === 'user' ? 'user' : 'assistant', isStreaming: false, content }] : []),
      ];
    });
  }
  const dataURL = file => new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(reader.error); reader.readAsDataURL(file); });
  async function attachment(path) {
    if (staged.has(path)) return staged.get(path);
    const match = /^\/vega-blob\/(blob-[a-f\d]{32})\/([^/]+)$/.exec(path);
    if (!match) throw new Error('Unknown attachment');
    const value = await api('file', { blobId: match[1] });
    return { name: decodeURIComponent(match[2]), file: new Blob([Uint8Array.from(atob(value.data), c => c.charCodeAt(0))], { type: value.mime || 'application/octet-stream' }) };
  }
  async function stage(filename, file) {
    if (!(file instanceof Blob) || file.size > 25 * 1024 * 1024) return { ok: false, reason: 'too-large' };
    if (staged.size >= 16 || [...staged.values()].reduce((sum, item) => sum + item.file.size, file.size) > 64 * 1024 * 1024) return { ok: false, reason: 'store-full' };
    const name = String(filename).split(/[\\/]/).pop().replace(/[<>:"|?*\u0000-\u001f]/g, '_').slice(0, 120) || 'file';
    const path = '/vega-staged/' + crypto.randomUUID() + '/' + encodeURIComponent(name);
    staged.set(path, { name, file });
    return { ok: true, path };
  }
  async function send(args) {
    const files = await Promise.all((args.attachmentPaths || []).map(async path => { const { name, file } = await attachment(path); return { name, mime: file.type, data: (await dataURL(file)).split(',')[1] }; }));
    const images = files.filter(file => /^image\/(png|jpeg|gif|webp|bmp)$/.test(file.mime));
    await api('send', { thread: args.agentId, text: args.prompt, clientMessageId: args.clientNonce, images, files: files.filter(file => !images.includes(file)) });
    return { accepted: true };
  }
  async function tail(args) {
    const id = args.id || args.agentId;
    if (!id || !/^(employee|group):.+/.test(id)) throw new Error('Invalid conversation');
    const data = await api('messages', { thread: id, limit: Math.min(200, args.limit || 100), ...(args.beforeSeq ? { before: args.beforeSeq } : {}) });
    const entries = entriesOf(data.messages || [], id);
    if (!args.beforeSeq) watched.set(id, { lastSeq: data.lastSeq ?? Math.max(0, ...(data.messages || []).map(message => message.seq)), entries });
    return { entries, nextBeforeSeq: data.hasMore && entries.length ? entries[0].seq : null, unreadBoundaryAt: null };
  }
  async function coordinator(method, args = {}) {
    switch (method) {
      case 'resolveAgentCreation': return { kind: 'box' };
      case 'getServerAgentRoster': return { status: 'ready', agents: await refreshRoster(), boxAgentCount: 0 };
      case 'listAgents': return [];
      case 'countAgents': return (await refreshRoster()).length;
      case 'getMainAgent': { if (!roster.length) await refreshRoster(); return { agentId: read('mainAgent', roster[0]?.thread || null) }; }
      case 'setMainAgent': write('mainAgent', args.agentId); return { agentId: args.agentId };
      case 'openAgentTail': case 'getAgentTranscriptTail': return tail(args);
      case 'noteMountedAgent': case 'noteTranscriptOpened': return;
      case 'clearGeneratedRoomNameStamps': return {};
      case 'getHostStatus': return { hostVersion: host?.version || null, latestHostVersion: null, hostUpdateAvailable: false, isBusy: false, capabilities: [] };
      case 'sendPrompt': {
        if (!args.clientNonce) throw new Error('Message nonce required');
        if (attempts.has(args.clientNonce)) return attempts.get(args.clientNonce);
        // A failed request may have reached the server: never automatically replay a send.
        const attempt = send(args);
        attempts.set(args.clientNonce, attempt);
        return attempt;
      }
      case 'promptAcceptanceStatus': return { outcome: 'unknown' };
      case 'createAgent': {
        const result = await api('create', { name: args.name || 'New Bot', instruction: args.description || '' });
        const agents = await refreshRoster(); event('server-roster-changed', { kind: 'resync' });
        return { agent: agents.find(agent => agent.id === 'employee:' + result.id), transcript: [] };
      }
      case 'setAgentUnread': if (!args.isUnread) await api('read', { thread: args.id }); else return unsupported(method); return null;
      case 'resolveAutoReviewApproval': case 'resolveLocalToolPermission':
        await api('control', { thread: args.agentId, id: args.taskId || args.id, action: 'approve', approved: args.approved }); return;
      case 'getAgentTasks': return { tasks: [], tags: [] };
      case 'getTrays': case 'getAsyncTasks': case 'getSubagents': case 'getAgentAutomations': case 'takeTeachLearningPrompts': case 'getWorkflows': return [];
      case 'getForeverBoxStatus': case 'getBotTemplateForSourceAgent': return null;
      case 'getTeachRecordingStatus': return { state: 'idle' };
      case 'isEgressTunnelAvailable': return false;
      default: return unsupported(method);
    }
  }
  async function native(action, value = {}) {
    if (window.chrome?.webview) { window.chrome.webview.postMessage(JSON.stringify({ action, ...value })); return; }
    return unsupported('native window: ' + action);
  }
  function captionColors() {
    if (!window.chrome?.webview) return;
    requestAnimationFrame(() => {
      let element = document.elementFromPoint(innerWidth - 150, 25), background = 'rgb(255, 255, 255)';
      const foreground = element ? getComputedStyle(element).color : 'rgb(32, 32, 32)';
      for (; element; element = element.parentElement) {
        const color = getComputedStyle(element).backgroundColor;
        if (color !== 'transparent' && color !== 'rgba(0, 0, 0, 0)') { background = color; break; }
      }
      const rgb = color => color.match(/[\d.]+/g).slice(0, 3).map(Number);
      void native('caption', { colors: { background: rgb(background), foreground: rgb(foreground) } });
    });
  }
  const updateStatus = { state: { type: 'disabled', reason: 'not-packaged' }, delivery: 'in-app', currentVersion: 'Vega', currentTrack: 'stable', trackOverride: null, buildDefaultTrack: null, availableTracks: ['stable'], isTrackManagedByPolicy: false, isBelowMinimumVersion: false, autoUpdateWhenIdle: false };
  const methods = {
    subscribe(listeners) { desktopListeners.add(listeners); return () => desktopListeners.delete(listeners); },
    async getCursorAuthStatus() { const value = await boot; return value.paired ? { kind: 'logged-in', authId: value.account, displayName: 'Vega', profileReady: true } : { kind: 'logged-out' }; },
    getCursorLoginFlight: async () => ({ kind: 'idle' }),
    async loginCursor() { const value = await boot; location.assign(value.configURL); },
    getCursorAvatar: async () => null,
    getOnboardingSeen: async () => true,
    getSandAccess: async () => ({ state: 'granted' }), getSandAccessFresh: async () => ({ state: 'granted' }),
    getGrokBotTermsRecord: async () => ({ seenAtMs: 0 }),
    getCursorSelectedTeam: async () => ({ selectedTeamId: null, fallback: null }), listCursorTeamMemberships: async () => [],
    getThemeState: async () => theme(), async setThemePreference({ preference }) { if (!['system','light','dark'].includes(preference)) throw new Error('Invalid theme'); write('theme', preference); emitDesktop('theme-changed', theme()); captionColors(); return theme(); },
    getLanguageState: async () => language(),
    getExperimentsSnapshot: async () => experiments,
    getBotColorInChatEnabled: async () => true,
    getEgressTunnelEnabled: async () => false, getEgressTunnelForcedByAdmin: async () => false, getEgressTunnelStatus: async () => 'inactive', getWebauthnProxyEnabled: async () => false,
    setTitleBarOverlayTone: async () => captionColors(),
    getWindowState: async () => window.__vegaWindowState || { isFullscreen: false, isMaximized: false }, isWindowShown: async () => document.visibilityState === 'visible',
    minimizeWindow: () => native('minimize'), toggleMaximizeWindow: () => native('maximize'), closeWindow: () => native('close'), focusWindow: () => native('focus'),
    getHostSidebarSections: async () => read('sections', []), async setHostSidebarSections(args) { write('sections', args.sections); return args.sections; },
    getHostPinnedAgents: async () => read('pins', []), getServerPinnedAgents: async () => [], async setHostPinnedAgents(args) { write('pins', args.pinnedAgentIds); return args.pinnedAgentIds; },
    listGrokBotTeamAgents: async () => [], listGrokBotAgentSessions: async () => [],
    listSecrets: async () => ({ keys: [] }), getBoxHostPhase: async () => 'settled', getCursorTrainingSetting: async () => 'disallowed',
    getCredentialsState: async () => ({ hasValidCredentials: false }), getMcpState: async () => ({ servers: [] }),
    getUpdateStatus: async () => ({ ...updateStatus, currentVersion: (await boot).version }),
    getLocalToolPermission: async () => null, getTeamMemberPolicy: async () => null, getPendingRestartToUpdate: async () => null,
    getHardwareAcceleration: async () => ({ enabled: true }), getSpellCheckEnabled: async () => true,
    getTimeZone: async () => ({ timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone, override: null }),
    getAutoReviewInstructions: async () => ({ isEnabled: false, allowInstructions: [], blockInstructions: [] }),
    hasMigratedClientPersistence: async () => true,
    readClientPersistence: async ({ key: name }) => read('persist:' + name),
    writeClientPersistence: async ({ key: name, value }) => write('persist:' + name, value),
    removeClientPersistence: async ({ key: name }) => localStorage.removeItem(key('persist:' + name)),
    listClientPersistenceKeys: async ({ prefix }) => Object.keys(localStorage).filter(name => name.startsWith(key('persist:' + prefix))).map(name => name.slice(key('persist:').length)),
    async readManyClientPersistence({ include, exclude }) {
      const length = (name, prefixes) => Math.max(-1, ...prefixes.filter(prefix => name.startsWith(prefix)).map(prefix => prefix.length));
      return Object.fromEntries(Object.keys(localStorage).filter(name => name.startsWith(key('persist:'))).map(name => [name.slice(key('persist:').length), JSON.parse(localStorage.getItem(name))]).filter(([name]) => length(name, include) >= 0 && length(name, include) >= length(name, exclude)));
    },
    stageAttachmentBytes: ({ filename, bytes }) => stage(filename, new Blob([bytes])),
    async commitStagedAttachments({ paths }) { if (!paths.every(path => staged.has(path))) throw new Error('附件已失效，请重新选择'); return paths; },
    async discardStagedAttachment({ path }) { staged.delete(path); },
    precaptionStagedAttachment: async () => null,
    async readAttachmentBytes({ path, maxBytes = 25 * 1024 * 1024 }) { const { name, file } = await attachment(path); return file.size > maxBytes ? { kind: 'too-large', size: file.size, resolvedName: name } : { kind: 'bytes', size: file.size, bytes: new Uint8Array(await file.arrayBuffer()), resolvedName: name }; },
    async readAttachmentText({ path }) { const { file } = await attachment(path); return file.type.startsWith('image/') ? { kind: 'binary', bytes: file.size } : { kind: 'text', text: await file.text(), bytes: file.size }; },
    async resolveAttachmentMedia({ source }) { const { file } = await attachment(source); return /^(image|video|audio)\//.test(file.type) ? { kind: file.type.split('/')[0], src: await dataURL(file), width: null, height: null } : null; },
    async downloadAttachment({ path, suggestedName }) { const { name, file } = await attachment(path); const url = URL.createObjectURL(file), link = document.createElement('a'); link.href = url; link.download = suggestedName || name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 60000); },
    async setViewingAgent({ agentId }) { selected = agentId; if (agentId) await api('read', { thread: agentId }); },
    async openExternal({ url }) { if (!/^https?:\/\//.test(url)) throw new Error('Only HTTP(S) links are allowed'); await api('external', { url }); },
  };
  // Populate enumerable methods from the bundled preload contract: the renderer deliberately ignores Proxy-only properties.
  const housekeeping = new Set(['setOnboardingSeen','setTitleBarOverlayTone','setComposingAgent','setComputerViewOpen','setUnreadFilterMenuChecked','signalBoxIntent','markDeepLinksReady','clearLocalToolApprovals','claimEgressTunnel']);
  for (const name of window.__vegaDesktopMethods || []) {
    if (!Object.hasOwn(methods, name)) methods[name] = (...args) => name.startsWith('report') || name.startsWith('note') || name.startsWith('expose') || name.startsWith('log') || housekeeping.has(name) ? Promise.resolve() : Promise.reject(Object.assign(new Error('Vega 尚未接入此功能：' + name), { code: 'source/capability-unavailable' }));
  }
  window.desktop = { main: methods, boot: { theme: theme(), language: language(), isAssistiveTechEnabled: false, isEgressTunnelEnabled: false, isWebauthnProxyEnabled: false, isBotColorInChatEnabled: true, egressTunnelStatus: 'inactive', rosterPhotos: null, computerUseHelperName: null, experiments },
    environment: { platform: 'win32', isDev: false, isWaylandClient: false, usesProductionBackend: false, devVoiceHarness: 'package' },
    local: { getZoomFactor: () => 1, noteRendererAlive() {}, noteBootGateLanded() {}, noteBootGateOpened() {}, stageAttachmentFile: stage } };
  window.coordinatorPort = { claim(handler) {
    let channel = null;
    const request = () => {
      if (channel) return;
      channel = new MessageChannel(); const server = channel.port2; ports.add(server);
      server.onmessage = async ({ data }) => {
        if (data.kind === 'lifecycle' && data.phase === 'hello') { server.postMessage({ kind: 'lifecycle', phase: 'ready', protocolVersion: 3 }); server.postMessage({ kind: 'event', family: 'coordinator-transport-state', payload: { state: 'connected' } }); return; }
        if (data.kind !== 'request') return;
        let outcome;
        try { outcome = { status: 'ok', value: await coordinator(data.method, data.args) }; }
        catch (error) { outcome = { status: 'failed', failure: { code: error.code || 'internal', message: error.message } }; }
        server.postMessage({ kind: 'reply', requestId: data.requestId, outcome });
      };
      boot.then(value => handler.onPort({ accountSlot: value.account, postMessage: message => channel?.port1.postMessage(message), start: () => channel?.port1.start(), close() { ports.delete(server); channel?.port1.close(); server.close(); channel = null; }, addEventListener: (name, callback) => channel?.port1.addEventListener(name, callback) }));
    };
    return { request, release() { if (channel) { ports.delete(channel.port2); channel.port1.close(); channel.port2.close(); channel = null; } } };
  } };
  window.sandPopout = { agentId: null }; window.sandSpotlight = { isSpotlight: false };
  async function poll() {
    if (polling || document.visibilityState === 'hidden' || !host?.paired) return;
    polling = true;
    try {
      const previous = JSON.stringify(roster); await refreshRoster();
      if (previous !== JSON.stringify(roster)) event('server-roster-changed', { kind: 'resync' });
      for (const [id, state] of watched) {
        if (id !== selected) continue;
        const data = await api('messages', { thread: id, after: state.lastSeq });
        if ((data.lastSeq || 0) < state.lastSeq) { watched.delete(id); event('transcript', { agentId: id, type: 'cleared' }); continue; }
        for (const entry of entriesOf(data.messages || [], id)) event('transcript', { agentId: id, type: state.entries.some(old => old.id === entry.id) ? 'updated' : 'appended', entry });
        state.lastSeq = data.lastSeq || 0;
      }
    } catch (error) { console.warn('[Vega bridge]', error.message); }
    finally { polling = false; }
  }
  window.__vegaWindowChanged = state => { window.__vegaWindowState = state; emitDesktop('window-state', state); };
  setInterval(poll, 1500);
  addEventListener('focus', () => { emitDesktop('window-focus', {}); void poll(); });
  document.addEventListener('visibilitychange', () => emitDesktop('window-visibility', { visible: document.visibilityState === 'visible' }));
  function resizeEdge(x, y, width, height) {
    if (window.__vegaWindowState?.isMaximized) return 0;
    const left = x < 6, right = x >= width - 6, top = y < 6, bottom = y >= height - 6;
    return top && left ? 13 : top && right ? 14 : bottom && left ? 16 : bottom && right ? 17 : left ? 10 : right ? 11 : top ? 12 : bottom ? 15 : 0;
  }
  document.addEventListener('pointermove', e => {
    if (!window.chrome?.webview) return;
    const cursor = { 10: 'ew-resize', 11: 'ew-resize', 12: 'ns-resize', 13: 'nwse-resize', 14: 'nesw-resize', 15: 'ns-resize', 16: 'nesw-resize', 17: 'nwse-resize' }[resizeEdge(e.clientX, e.clientY, innerWidth, innerHeight)];
    if (cursor) document.documentElement.style.cursor = cursor; else document.documentElement.style.removeProperty('cursor');
  });
  document.addEventListener('pointerdown', e => {
    if (e.button !== 0 || !window.chrome?.webview) return;
    const edge = resizeEdge(e.clientX, e.clientY, innerWidth, innerHeight);
    if (edge) { e.preventDefault(); e.stopPropagation(); void native('resize', { edge }); return; }
    for (let element = e.target; element instanceof Element; element = element.parentElement) {
      const region = getComputedStyle(element).getPropertyValue('-webkit-app-region');
      if (region === 'no-drag') return;
      if (region === 'drag') { void native(e.detail === 2 ? 'maximize' : 'drag'); return; }
    }
  }, true);
})();
