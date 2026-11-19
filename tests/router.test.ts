import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { ref, computed, watch, nextTick } from "vue";
import { ADMIN_PAGES, ROUTE_ROOTS, parseRoute, formatRoute } from "../web/src/router.js";
import { SPA_ROOTS, spaPage } from "../server/core/spa";

test("router: paths round-trip through parse and format, tabs and selected items included", () => {
  const paths = [
    "/employees/e1", "/employees/e1/tasks", "/employees/e1/tasks/t1", "/employees/e1/sessions/s1", "/employees/e1/settings",
    "/employees/e1/memories", "/employees/new", "/groups/g1", "/groups/g1/tasks/e1/t1", "/groups/%E7%BE%A4/tasks/%E7%89%9B%2F1/t%201", "/groups/new",
    "/groups/new", "/chat", "/chat/s1", "/resources", "/settings", "/settings/scenes", "/settings/external-mcp", "/settings/principles", "/debug", "/debug/s9", "/experiences/r1", "/account",
    "/employees/%E7%89%9B%20%2F1",
  ];
  for (const path of paths) assert.equal(formatRoute(parseRoute(path)), path, path);
  assert.deepEqual(parseRoute("/employees/e1/tasks/t1"), { view: "employee", employee: "e1", tab: "tasks", task: "t1" });
  assert.deepEqual(parseRoute("/groups/g1/tasks/e1/t1"), { view: "group", group: "g1", groupTask: { employeeId: "e1", taskId: "t1" } });
  assert.deepEqual(parseRoute("/groups/g1/work"), { view: "group", group: "g1" }, "old panel links open the group without a panel");
  assert.deepEqual(parseRoute("/groups/g1/members"), { view: "group", group: "g1" });
  assert.equal(formatRoute({ view: "group", group: "g1", sub: "work" }), "/groups/g1");
  assert.deepEqual(parseRoute("/employees/%E7%89%9B%20%2F1"), { view: "employee", employee: "牛 /1" });
  assert.equal(formatRoute({ view: "employee", employee: "e1", tab: "chat" }), "/employees/e1", "chat is the default tab");
  assert.equal(formatRoute({ view: "settings", sub: "" }), "/settings");
});

test("router: unknown paths and tabs fall back to the page or the default view; old ?employee= links still open", () => {
  assert.deepEqual(parseRoute("/"), { view: "employee" });
  assert.deepEqual(parseRoute("/nope/x"), { view: "employee" });
  assert.deepEqual(parseRoute("/employees/e1/bogus"), { view: "employee", employee: "e1" });
  assert.deepEqual(parseRoute("/groups/g1/bogus"), { view: "group", group: "g1" });
  assert.deepEqual(parseRoute("/settings/bogus"), { view: "settings" });
  assert.deepEqual(parseRoute("/resources/x"), { view: "resources" });
  assert.deepEqual(parseRoute("/?employee=e1"), { view: "employee", employee: "e1" });
  assert.deepEqual(parseRoute("/employees/%E0%A4%A"), { view: "employee", employee: "%E0%A4%A" }, "bad escapes do not throw");
  assert.equal(formatRoute({ view: "employee" }), "/");
  assert.equal(formatRoute({ view: "whatever" }), "/");
});

test("server SPA fallback: app pages get index.html; API, assets, files and other paths keep their 404s", () => {
  assert.deepEqual([...SPA_ROOTS].sort(), [...ROUTE_ROOTS].sort(), "server and router agree on the page roots");
  for (const path of ["/employees/e1", "/employees/e1/tasks/t1", "/groups/g1/work", "/groups/g1/tasks/e1/t1", "/settings/scenes", "/debug/s1", "/account", "/chat"]) assert(spaPage("GET", path), path);
  assert(spaPage("HEAD", "/resources"));
  for (const path of ["/", "/api/x", "/api/events", "/assets/a.js", "/extension/x", "/clients/x.zip", "/employees/x.js", "/foo"]) assert(!spaPage("GET", path), path);
  assert(!spaPage("POST", "/employees/e1"));
  const route = readFileSync("server/routes/[...].ts", "utf8");
  assert(route.includes("spaPage(") && route.includes('"/index.html"') && route.includes("statusCode: 404"));
  assert(!readFileSync("web/vite.config.js", "utf8").includes("base:"), "absolute /assets URLs work from nested paths");
});

// The App.vue routing block, run against plain refs.
const source = readFileSync("web/src/App.vue", "utf8");
const block = source.slice(source.indexOf("function openGroup("), source.indexOf("async function groupClosed()")) + source.slice(source.indexOf("const pageTabs = ref("), source.indexOf("// Last, once all the state it reads exists."));
function app(href: string, { admin = false, employees = ["ea", "eb"], groups = ["g1"] } = {}) {
  const history: string[] = [], location = new URL(href);
  const window = { location, history: {
    pushState: (_s: any, _t: string, path: string) => { location.href = new URL(path, location).href; history.push("push " + path); },
    replaceState: (_s: any, _t: string, path: string) => { location.href = new URL(path, location).href; history.push("replace " + path); },
  } };
  const c: any = {
    ref, computed, watch, nextTick, window, ADMIN_PAGES, parseRoute, formatRoute,
    user: ref({ id: "alice" }), isAdmin: ref(admin), canExecute: ref(true), view: ref("employee"),
    clientAuthorization: ref(location.searchParams.get("client_authorization") || ""),
    selectedEmployee: ref("ea"), creatingEmployee: ref(false), employeeTab: ref("chat"), employeeTaskFocus: ref(""), employeeSession: ref(""),
    selectedGroup: ref(""), selectedGroupTask: ref(null), current: ref(null), sessions: ref([{ id: "s1" }]), employee: ref({ id: "ea" }),
    employees: ref(employees.map((id) => ({ id }))), groups: ref(groups.map((id) => ({ id }))),
    employeeTabs: ref([["chat"], ["tasks"], ["memories"], ["settings"]]),
    attempt: (fn: any) => fn(), selectSession: async (s: any) => { c.current.value = s; c.view.value = "chat"; },
    closeNavigation() {},
    chooseEmployee: async (id: string, taskId = "") => { c.selectedEmployee.value = id; c.employee.value = { id }; c.employeeTab.value = taskId ? "tasks" : "chat"; c.employeeSession.value = ""; c.employeeTaskFocus.value = taskId; c.creatingEmployee.value = false; c.view.value = "employee"; },
    openEmployee: (session = "") => { c.employeeSession.value = session; c.view.value = "employee"; },
    openEmployeeTask: async (id: string) => { if (id === "t1") { c.employeeTab.value = "tasks"; c.employeeTaskFocus.value = id; } },
  };
  Object.assign(c, vm.runInNewContext(block + "\n({ applyRoute, routeChanged, syncRoute, closeClientAuthorization, openGroup, setGroupTask, setPageTab, pageSub, routePath, start() { routeReady = true; } })", c));
  return { c, history, location };
}
async function boot(href: string, options?: any) {
  const s = app(href, options);
  await s.c.applyRoute(parseRoute(href));
  s.c.start(); s.c.syncRoute(true);
  return s;
}

test("App routing: refresh restores page and tab; tab and page switches push; back/forward reapplies without pushing", async () => {
  const s = await boot("https://vega.test/employees/eb/tasks/t1");
  assert.deepEqual([s.c.selectedEmployee.value, s.c.employeeTab.value, s.c.employeeTaskFocus.value], ["eb", "tasks", "t1"]);
  assert.deepEqual(s.history, [], "an exact path needs no rewrite");
  s.c.employeeTaskFocus.value = ""; s.c.employeeTab.value = "memories"; await nextTick();
  s.c.openGroup("g1"); await nextTick();
  s.c.setPageTab("work"); await nextTick();
  assert.deepEqual(s.history, ["push /employees/eb/memories", "push /groups/g1"], "group side panels do not push");
  assert.equal(s.location.pathname, "/groups/g1");
  s.location.href = "https://vega.test/employees/eb/memories";
  s.c.routeChanged(); await new Promise((r) => setTimeout(r, 0));
  assert.deepEqual([s.c.view.value, s.c.employeeTab.value], ["employee", "memories"]);
  assert.equal(parseRoute("https://vega.test/employees/eb/duties").tab, undefined);
  s.location.href = "https://vega.test/groups/g1/work";
  s.c.routeChanged(); await new Promise((r) => setTimeout(r, 0));
  assert.deepEqual([s.c.view.value, s.c.selectedGroup.value, s.location.pathname], ["group", "g1", "/groups/g1"], "old /work link opens the group and normalizes");
  assert.equal(s.history.length, 3, "popstate replace of the old panel path");
  const settings = await boot("https://vega.test/settings/scenes", { admin: true });
  assert.deepEqual([settings.c.view.value, settings.c.pageSub.value], ["settings", "scenes"]);
  settings.c.view.value = "resources"; await nextTick();
  settings.c.view.value = "settings"; await nextTick();
  assert.equal(settings.c.pageSub.value, "scenes", "each page keeps its own tab when you come back");
  assert.equal(settings.location.pathname, "/settings/scenes");
});

test("App routing: group task links restore in the group, follow history, and clear when the task closes", async () => {
  const base = "https://vega.test", first = "/groups/g1/tasks/e1/t-old", second = "/groups/g1/tasks/e2/t2";
  const s = await boot(base + first);
  assert.deepEqual([s.c.view.value, s.c.selectedGroup.value, s.c.selectedGroupTask.value], ["group", "g1", { employeeId: "e1", taskId: "t-old" }]);
  assert.equal(s.c.selectedEmployee.value, "ea", "the group route does not select an employee workspace");
  assert.deepEqual(s.history, []);
  s.c.setGroupTask({ employeeId: "e2", taskId: "t2", title: "not part of the URL" }); await nextTick();
  s.c.setGroupTask(null); await nextTick();
  assert.deepEqual(s.history, ["push " + second, "push /groups/g1"]);
  for (const path of [second, first, second]) {
    s.location.href = base + path; s.c.routeChanged(); await nextTick();
    assert.equal(s.c.routePath.value, path);
  }
  assert.equal(s.history.length, 2, "back and forward must not create new history entries");
  s.c.setGroupTask(null, true); await nextTick();
  assert.equal(s.history.at(-1), "replace /groups/g1", "an unavailable task is removed from this history entry");
  const blocked = await boot(base + first, { groups: [] });
  assert.equal(blocked.c.view.value, "employee");
  assert.equal(blocked.c.selectedGroupTask.value, null);
});

test("client authorization survives login route initialization until the user closes it", async () => {
  const id = "a".repeat(43), s = await boot("https://vega.test/?client_authorization=" + id);
  assert.equal(s.location.searchParams.get("client_authorization"), id);
  assert.deepEqual(s.history, [], "route normalization must not discard the pending request");
  s.c.closeClientAuthorization();
  assert.equal(s.location.search, "");
  assert.deepEqual(s.history, ["replace /employees/ea"]);
});

test("task deep links enter the task view before employee loading finishes", async () => {
  const s = app("https://vega.test/groups/g1");
  s.c.view.value = "group";
  let release!: () => void;
  s.c.chooseEmployee = async (id: string, taskId: string) => {
    assert.equal(taskId, "t1");
    s.c.selectedEmployee.value = id; s.c.employeeTab.value = "tasks"; s.c.employeeTaskFocus.value = taskId; s.c.view.value = "employee";
    await new Promise<void>((resolve) => release = resolve);
    s.c.employee.value = { id };
  };
  const opening = s.c.applyRoute({ view: "employee", employee: "eb", tab: "tasks", task: "t1" });
  assert.deepEqual([s.c.view.value, s.c.employeeTab.value, s.c.employeeTaskFocus.value], ["employee", "tasks", "t1"]);
  release(); await opening;
  s.c.view.value = "group";
  await s.c.applyRoute({ view: "employee", employee: "eb", tab: "tasks", task: "t1" });
  assert.deepEqual([s.c.view.value, s.c.employeeTab.value, s.c.employeeTaskFocus.value], ["employee", "tasks", "t1"]);
});

test("App routing: unknown or forbidden ids and pages fall back to the default view with replaceState; old links normalize", async () => {
  for (const [href, path] of [
    ["https://vega.test/groups/gone", "/employees/ea"], ["https://vega.test/settings/scenes", "/settings"],
    ["https://vega.test/employees/hidden/tasks", "/employees/ea/tasks"], ["https://vega.test/employees/ea/vault", "/employees/ea"],
    ["https://vega.test/?employee=eb", "/employees/eb"], ["https://vega.test/nope", "/employees/ea"], ["https://vega.test/", "/employees/ea"],
  ]) {
    const s = await boot(href);
    assert.deepEqual(s.history, ["replace " + path], href);
  }
  const own = await boot("https://vega.test/settings/external-mcp");
  assert.deepEqual([own.c.view.value, own.c.pageSub.value, own.location.pathname], ["settings", "external-mcp", "/settings/external-mcp"]);
  assert.deepEqual(own.history, [], "a non-admin keeps their own 对外 MCP settings address");
  const triggers = await boot("https://vega.test/settings/triggers");
  assert.deepEqual([triggers.c.view.value, triggers.c.pageSub.value, triggers.location.pathname], ["settings", "triggers", "/settings/triggers"]);
  const viewer = app("https://vega.test/settings/triggers");
  viewer.c.canExecute.value = false;
  await viewer.c.applyRoute(parseRoute(viewer.location.href));
  assert.equal(viewer.c.pageSub.value, "");
  for (const options of [{}, { admin: true }]) {
    const principles = await boot("https://vega.test/settings/principles", options);
    assert.deepEqual([principles.c.view.value, principles.c.pageSub.value, principles.location.pathname], ["settings", "principles", "/settings/principles"]);
    assert.deepEqual(principles.history, []);
  }
  await viewer.c.applyRoute(parseRoute("https://vega.test/settings/principles"));
  assert.equal(viewer.c.pageSub.value, "principles", "read-only accounts can configure their own principles");
});

test("personal experiences are accessible to every role outside the admin navigation", async () => {
  assert(!ADMIN_PAGES.includes("experiences"));
  for (const canExecute of [true, false]) {
    const s = app("https://vega.test/experiences/r1");
    s.c.canExecute.value = canExecute;
    await s.c.applyRoute(parseRoute(s.location.href));
    assert.deepEqual([s.c.view.value, s.c.pageSub.value], ["experiences", "r1"]);
  }
  const sidebar = readFileSync("web/src/AppSidebar.vue", "utf8");
  assert(sidebar.indexOf('title="经验图谱"') < sidebar.indexOf('<template v-if="isAdmin">'));
  assert(!source.includes("view === 'experiences' && isAdmin"));
});
