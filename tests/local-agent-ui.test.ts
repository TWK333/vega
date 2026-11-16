import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

test("desktop and mobile indicators describe all online clients rather than the current device", () => {
  const app = readFileSync("web/src/App.vue", "utf8");
  assert.match(app, /:client-status="clientStatus"/);
  const source = readFileSync("web/src/AppSidebar.vue", "utf8");
  const indicators = [...source.matchAll(/<span\b([^>]*:title="([^"]*clientStatus[^"\n]*)"[^>]*)>([^<]*)<\/span>/g)];
  assert.equal(indicators.length, 1);
  for (const [, attributes, title, text] of indicators) {
    assert.match(attributes, /role="status"/);
    const expression = text.match(/\{\{([\s\S]*?)\}\}/)![1];
    for (const clientStatus of ["无在线客户端", "客户端在线 · 2 台"]) {
      assert.equal(vm.runInNewContext(expression, { clientStatus }), clientStatus);
      assert(vm.runInNewContext(title, { clientStatus }).includes(clientStatus));
    }
  }
});

test("the webpage does not probe loopback; device authorization stays at the bound site", () => {
  const app = readFileSync("web/src/App.vue", "utf8"), view = readFileSync("web/src/ClientAuthorization.vue", "utf8");
  assert.doesNotMatch(app, /LocalAgentPairing|canBridgeLocal|127\.0\.0\.1:47673|startLocalPairing/);
  assert.match(app, /searchParams\.get\("client_authorization"\)/);
  assert.match(app, /if \(clientAuthorization\.value\) return;/, "the login flow preserves the authorization URL");
  assert.match(app, /<ClientAuthorization v-else-if="clientAuthorization"/);
  assert.match(view, /\/local-agent\/device\/request\?requestId=/);
  assert.match(view, /\/local-agent\/device\/decision/);
  assert.match(view, /允许此设备/);
  assert.match(view, /拒绝/);
  assert.match(view, /读取和写入文件、执行命令、操作浏览器及电脑/);
  assert.match(view, /只读账号不能授权/);
  assert.doesNotMatch(view, /127\.0\.0\.1|deviceToken|verifier/);
});

test("execution position follows the task, so the website keeps no session-level client switcher", () => {
  const app = readFileSync("web/src/App.vue", "utf8");
  assert.doesNotMatch(app, /executionLocal|executionClientId|executionBusy|executionUnavailable|executionHint|toggleExecution|switchingExecution|draftExecution|draftClientId|selectedClient/);
  assert.doesNotMatch(app, /\/execution/);
});
