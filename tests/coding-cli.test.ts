import { test } from 'node:test';
import assert from 'node:assert/strict';
import { codingCommand, codingResult } from '../server/core/coding-cli';
import { sceneAvailable, validateCodingExecutor } from '../server/core/config';

test('explicit CLI enables only coding without a model', () => {
  const cfg = { model: '', provider: {}, codingExecutor: 'antigravity' } as const;
  assert.equal(sceneAvailable(cfg, 'coding'), true);
  assert.equal(sceneAvailable(cfg, 'computer'), false);
  assert.equal(sceneAvailable({ ...cfg, codingExecutor: 'model' }, 'coding'), false);
  assert.throws(() => validateCodingExecutor('shell'));
});
test(' CLI prompts are data and cannot supply flags or commands', () => {
  const text = "中文\n'$(exit 42);`\"";
  const win = codingCommand('antigravity', text, true);
  assert(!win.includes(text));
  assert(Buffer.from(win.match(/FromBase64String\('([^']+)'\)/)![1], 'base64').toString().endsWith(text));
  assert.match(win, /agy\.exe --sandbox .*--print \$p/);
  assert.match(codingCommand('codex', text, false), /'\\''\$\(exit 42\)/);
  assert.throws(() => codingCommand('codex', 'a'.repeat(17000), true));
});
test('only completed Codex message is returned, not terminal logs', () => {
  const lines = ['stderr', '{"type":"item.completed","item":{"type":"command_execution","aggregated_output":"secret"}}', '{"type":"item.completed","item":{"type":"agent_message","text":"done"}}'];
  assert.throws(() => codingResult('codex', lines.join('\n')));
  assert.equal(codingResult('codex', [...lines, '{"type":"turn.completed"}'].join('\n')), 'done');
  assert.throws(() => codingResult('antigravity', ' '));
});
