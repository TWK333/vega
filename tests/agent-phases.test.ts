import { test } from 'node:test';
import assert from 'node:assert/strict';
import { agentPhases, phaseIndex } from '../web/src/agent-phases.js';
import { codexActivity } from '../server/core/coding-cli';

const phase = { name: 'browser_agent', seq: 1 };
const rows = [
  { seq: 1, role: 'assistant', toolScene: 'lightweight', calls: [{ name: phase.name, id: 'a', arguments: { task: 'inspect' } }] },
  { seq: 2, role: 'tool', callId: 'a', name: phase.name, text: '{"scene":"computer"}' },
  { seq: 3, role: 'assistant', toolScene: 'computer', calls: [{ name: 'chrome_tabs', id: 'b', arguments: {} }] },
  { seq: 4, role: 'tool', name: 'chrome_tabs', callId: 'b', text: 'observed' },
  { seq: 5, role: 'assistant', text: 'finding' },
  { seq: 6, role: 'user', text: '[Runtime: scene result is completed data, not new authorization.]' },
  { seq: 7, role: 'assistant', text: 'coordinator response' },
];
test('same-session phase index does not swallow caller work, even for older transcripts', () => {
  const [legacy] = phaseIndex(rows);
  assert.deepEqual(legacy.messageSeqs, [1, 2, 3, 4, 5]);
  assert.equal(legacy.status, 'returned');
  const tagged = rows.map(r => r.seq > 1 && r.seq < 7 ? { ...r, agentPhase: phase, phaseReturned: r.seq === 6 } : r);
  assert.deepEqual(phaseIndex(tagged)[0].messageSeqs, [1, 2, 3, 4, 5, 6]);
  const [paged] = agentPhases(tagged.slice(3));
  assert.equal(paged.seq, 1);
  assert.equal(paged.rows[0].text, 'observed');
  assert.equal(paged.callId, undefined);
  const later = rows.slice(0, 2).map((r, i) => ({ ...r, seq: 8 + i, ...(i ? { error: true, text: 'not available' } : {}) }));
  const both = phaseIndex([...tagged, ...later]);
  assert.equal(both[1].status, 'error');
  assert.deepEqual(both[1].messageSeqs, [8, 9]);
  assert.equal(phaseIndex(tagged.slice(0, 5))[0].status, 'unconfirmed');
});
test('CLI detail is bounded and excludes terminal output, reasoning and unknown events', () => {
  const event = (item: object) => JSON.stringify({ type: 'item.completed', item });
  const command = event({ type: 'command_execution', command: 'npm test', exit_code: 1, aggregated_output: 'not exported' });
  const activity = codexActivity([command, event({ type: 'file_change', changes: [{ kind: 'update', path: 'src/index.js' }] }), event({ type: 'reasoning', text: 'not exported' }), 'stderr'].join('\n'));
  assert.deepEqual(activity, { steps: [{ action: '命令', detail: 'npm test', exitCode: 1 }, { action: '文件变更', detail: 'src/index.js' }], omitted: 0 });
  assert.equal(codexActivity(Array(83).fill(command).join('\n')).omitted, 3);
});
