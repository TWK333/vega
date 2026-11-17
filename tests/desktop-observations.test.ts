import assert from "node:assert/strict";
import test from "node:test";
import { DesktopObservations } from "../server/core/desktop-observations";

const agent = { clientId: "client" } as any;
const signal = new AbortController().signal;
const hub = { request: async (_agent: unknown, _op: string, args: any) => {
  assert.equal(args.operation, "elements");
  assert.equal(args.windowId, 42);
  return { windowId: 42, app: "Editor", title: "Document" };
} } as any;
const windows = [{ windowId: 42, app: "Editor", title: "Document", monitorId: 1 }];

test("desktop experience evidence may use a full screenshot containing the foreground window", async () => {
  const observed = new DesktopObservations();
  observed.record("session", "client", { windows, historical: false, snapshotId: "full", foreground: { windowId: 42 }, images: [{ monitorId: 1 }] });
  assert.deepEqual(await observed.verify(hub, agent, "session", "full", "Editor", signal), { id: "full", origin: "Editor" });
  observed.record("session", "client", { historical: false, snapshotId: "wrong-screen", foreground: { windowId: 42 }, images: [{ monitorId: 2 }] });
  await assert.rejects(observed.verify(hub, agent, "session", "wrong-screen", "Editor", signal), /目标窗口截图/);
  observed.record("session", "client", { historical: false, snapshotId: "cropped", foreground: { windowId: 42 }, images: [{ monitorId: 1, region: { x: 0, y: 0, width: 1, height: 1 } }] });
  await assert.rejects(observed.verify(hub, agent, "session", "cropped", "Editor", signal), /目标窗口截图/);
});
