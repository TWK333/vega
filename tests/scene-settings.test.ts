import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync("web/src/SceneSettings.vue", "utf8");

test("scene model search filters names, ids and variants without weakening the vision requirement", () => {
  const start = source.indexOf("function matchingEntries("), end = source.indexOf("const incomplete =", start);
  assert(start >= 0 && end > start);
  const entries = { value: [
    { id: "alpha/chat", name: "Alpha · alpha/chat", images: false },
    { id: "beta/vision", name: "Vision · beta/vision", images: true },
    { id: "beta/vision/variant/high", name: "Vision · high · beta/vision", images: true },
  ] };
  const { matchingEntries, selectedLabel } = vm.runInNewContext(source.slice(start, end) + "\n({ matchingEntries, selectedLabel })", { entries });
  const ids = (key: string, query: string) => Array.from(matchingEntries(key, query), (row: any) => row.id);
  assert.deepEqual(ids("coding", "  ALPHA "), ["alpha/chat"]);
  assert.deepEqual(ids("coding", "variant/high"), ["beta/vision/variant/high"]);
  assert.deepEqual(ids("computer", ""), ["beta/vision", "beta/vision/variant/high"]);
  assert.deepEqual(ids("computer", "alpha"), []);
  assert.deepEqual(ids("coding", "not found"), []);
  assert.equal(selectedLabel("coding", "alpha/chat"), "Alpha · alpha/chat");
  assert.equal(selectedLabel("computer", "alpha/chat"), "alpha/chat（暂不可用）");
  assert.equal(selectedLabel("coding", "gone"), "gone（暂不可用）");
  assert.match(source, /v-model="selection\.query"/);
  assert.match(source, /selection\.model && !matchingEntries\(key, selection\.query\)\.some/, "filtering must retain the selected value");
  assert.match(source, /没有匹配的模型/);
});
