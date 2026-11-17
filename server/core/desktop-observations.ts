import { localAppuse, type Agent, type LocalAgents } from "./local-agent";
import { assert, type Obj } from "./util";

const TTL = 180_000;
type WindowInfo = { windowId: number; app: string; title: string; monitorId?: number };
type State = { clientId: string; at: number; windows: Map<number, WindowInfo>; snapshot?: WindowInfo & { id: string; at: number } };

/** Remember only client-reported windows and screenshots, never a model-supplied scope. */
export class DesktopObservations {
  private states = new Map<string, State>();

  record(owner: string, clientId: string, result: Obj) {
    const now = Date.now();
    for (const [key, state] of this.states) if (now - state.at > TTL) this.states.delete(key);
    const previous = this.states.get(owner);
    const state: State = previous?.clientId === clientId ? previous : { clientId, at: now, windows: new Map() };
    state.at = now;
    if (Array.isArray(result.windows)) {
      state.windows.clear();
      for (const row of result.windows) if (Number.isSafeInteger(row?.windowId) && typeof row.app === "string" && typeof row.title === "string" && row.minimized !== true)
        state.windows.set(row.windowId, { windowId: row.windowId, app: row.app.trim(), title: row.title.trim(), monitorId: row.monitorId });
    }
    if (result.historical === false && typeof result.snapshotId === "string" && result.snapshotId && Array.isArray(result.images) && result.images.length) {
      const targeted = Number.isSafeInteger(result.windowId);
      const window = state.windows.get(targeted ? result.windowId : result.foreground?.windowId);
      const visible = targeted || (window && Number.isSafeInteger(window.monitorId) && result.images.some((image: Obj) => image.monitorId === window.monitorId && !image.region));
      state.snapshot = window && visible ? { ...window, id: result.snapshotId, at: now } : undefined;
    }
    this.states.delete(owner);
    this.states.set(owner, state);
    if (this.states.size > 512) this.states.delete(this.states.keys().next().value!);
  }

  forget(owner: string) { this.states.delete(owner); }

  async verify(hub: LocalAgents, agent: Agent, owner: string, snapshotId: unknown, scope: unknown, signal: AbortSignal) {
    const state = this.states.get(owner), snapshot = state?.snapshot;
    assert(state?.clientId === agent.clientId && snapshot && Date.now() - snapshot.at <= TTL, "没有当前会话的目标窗口截图；先用 appuse_windows 查看窗口并观察它");
    assert(snapshotId === undefined || snapshotId === "" || snapshotId === snapshot.id, "snapshotId 不是当前会话最新的目标窗口截图");
    const actual = await localAppuse(hub, agent, { operation: "elements", owner, snapshotId: snapshot.id, windowId: snapshot.windowId }, signal);
    assert(actual.windowId === snapshot.windowId && String(actual.app || "").trim() === snapshot.app, "观察窗口已变化，请重新观察后保存经验");
    const wanted = typeof scope === "string" ? scope.trim() : "";
    assert(wanted && (wanted === snapshot.app || (wanted === snapshot.title && String(actual.title || "").trim() === snapshot.title)), "经验 scope 须与当前观察的应用名或窗口标题一致");
    return { id: snapshot.id, origin: wanted };
  }
}
