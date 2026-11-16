import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { taskLabel } from "../web/src/task-status.js";

const source = readFileSync("web/src/ChatMessage.vue", "utf8");

test("task cards use current status, mark confirmed missing tasks deleted, and do not mark unloaded lists", () => {
  const code = source.match(/const statusOf = .*;/)![0];
  const props: any = { taskStatus: {}, tasks: undefined };
  const statusOf = vm.runInNewContext(code + "\nstatusOf", { props });
  const task = { id: "t1", status: "waiting" };
  assert.equal(statusOf(task), "waiting", "the task list has not loaded yet");
  props.tasks = [{ id: "t1", status: "running" }];
  props.taskStatus = { t1: "running" };
  assert.equal(statusOf(task), "running");
  props.tasks = [];
  props.taskStatus = {};
  assert.equal(statusOf(task), "deleted");
  props.tasks = undefined;
  props.taskStatus = { t1: "deleted" };
  assert.equal(statusOf(task), "deleted", "group status is supplied by the server");
  assert.equal(taskLabel("deleted"), "已删除");
  assert.match(source, /:disabled="statusOf\(task\) === 'deleted'"/);
  assert.match(source, /任务已删除：/);
  assert.match(readFileSync("web/src/App.vue", "utf8"), /canManage: false, tasks: undefined/, "a placeholder is not a loaded empty list");
});
