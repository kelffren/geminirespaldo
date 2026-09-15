import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { createStudioStore } from '../src/studio/storage/indexeddb-studio-store.mjs';

async function completesWithin(label, action, maxMs = 300) {
  const started = performance.now();
  const result = await action();
  const elapsed = performance.now() - started;
  assert.ok(elapsed < maxMs, `${label} took ${elapsed.toFixed(1)}ms`);
  return result;
}

{
  const neverOpeningFactory = { open() { return {}; } };
  const store = createStudioStore({ indexedDBFactory: neverOpeningFactory, openTimeoutMs: 20, transactionTimeoutMs: 20 });
  const recovery = await completesWithin('never-opening IndexedDB fallback', () => store.loadRecovery('world:test'));
  assert.deepEqual(recovery, { checkpoint: null, commands: [] });

  await store.saveCheckpoint('world:test', { id: 'world:test', entities: [{ id: 'tree' }] });
  const memoryRecovery = await completesWithin('memory recovery after open timeout', () => store.loadRecovery('world:test'));
  assert.equal(memoryRecovery.checkpoint.document.entities[0].id, 'tree');
}

{
  let request;
  const blockedFactory = {
    open() {
      request = {};
      queueMicrotask(() => request.onblocked?.());
      return request;
    },
  };
  const store = createStudioStore({ indexedDBFactory: blockedFactory, openTimeoutMs: 200, transactionTimeoutMs: 20 });
  const recovery = await completesWithin('blocked IndexedDB fallback', () => store.loadRecovery('world:blocked'), 150);
  assert.deepEqual(recovery, { checkpoint: null, commands: [] });
}

{
  let openRequest;
  let aborted = false;
  const db = {
    close() {},
    transaction() {
      const request = {};
      const tx = {
        objectStore() { return { getAll() { return request; } }; },
        abort() { aborted = true; queueMicrotask(() => tx.onabort?.()); },
      };
      return tx;
    },
  };
  const factory = {
    open() {
      openRequest = { result: db };
      queueMicrotask(() => openRequest.onsuccess?.());
      return openRequest;
    },
  };
  const store = createStudioStore({ indexedDBFactory: factory, openTimeoutMs: 200, transactionTimeoutMs: 20 });
  const recovery = await completesWithin('hung transaction fallback', () => store.loadRecovery('world:hung'));
  assert.deepEqual(recovery, { checkpoint: null, commands: [] });
  assert.equal(aborted, true);

  await store.saveCreatorPrefab('tester', { id: 'tree-prefab', name: 'Tree' });
  const prefabs = await completesWithin('memory prefab after transaction timeout', () => store.listCreatorPrefabs('tester'));
  assert.equal(prefabs[0].id, 'tree-prefab');
}

console.log('PASS studio IndexedDB never blocks World recovery');
