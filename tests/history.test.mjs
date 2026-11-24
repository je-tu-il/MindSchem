import assert from 'node:assert/strict';
import { test } from 'node:test';
import { History } from '../src/history.js';
import { Storage } from '../src/storage.js';

test('nested groups undo in reverse order and redo in forward order', () => {
  const history = new History();
  const actions = [];
  const step = name => ({ undo: () => actions.push('-' + name), redo: () => actions.push('+' + name) });
  history.beginBatch('Move selection');
  history.push(step('a'));
  history.beginBatch('Move children');
  history.push(step('b'));
  history.endBatch();
  history.push(step('c'));
  history.endBatch();
  assert.equal(history.undo(), true);
  assert.equal(history.canUndo(), false);
  assert.equal(history.redo(), true);
  assert.deepEqual(actions, ['-c', '-b', '-a', '+a', '+b', '+c']);
});

test('clearing a document drops any pending history group', () => {
  const history = new History();
  history.beginBatch();
  history.push({ undo() { assert.fail(); }, redo() {} });
  history.clear();
  history.endBatch();
  assert.equal(history.canUndo(), false);
  assert.equal(history.canRedo(), false);
});

test('an undo that throws can be retried', () => {
  const history = new History();
  let shouldThrow = true;
  history.push({ undo() { if (shouldThrow) throw new Error('Retry'); }, redo() {} });
  assert.throws(() => history.undo(), /Retry/);
  assert.equal(history.canUndo(), true);
  assert.equal(history.canRedo(), false);
  shouldThrow = false;
  assert.equal(history.undo(), true);
});

test('an intentionally empty diagram reopens empty', () => {
  let delivered;
  globalThis.localStorage = { getItem: () => '{"nodes":[]}' };
  const storage = new Storage(null, { loadNodes(nodes) { delivered = nodes; } });
  assert.equal(storage.load(), true);
  assert.deepEqual(delivered, []);
});

test('invalid diagram data does not reach the canvas', () => {
  globalThis.localStorage = { getItem: () => '{"nodes":[{}]}' };
  const storage = new Storage(null, { loadNodes() { assert.fail('Invalid data'); } });
  assert.equal(storage.load(), false);
});
