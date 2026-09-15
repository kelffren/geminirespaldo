/* KELO-INDEX
 * area: STUDIO / STORAGE
 * owns: local checkpoints, command journal and creator prefab library for crash/reuse UX
 * does-not-own: canonical online world state or publish authority
 * public-api: createStudioStore()
 * online: local recovery/prefab cache only; server remains canonical
 */

const copy = value => value == null ? value : (typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value)));

export function createStudioStore({
  indexedDBFactory = globalThis.indexedDB,
  dbName = 'kelo-studio-v1',
  openTimeoutMs = 1200,
  transactionTimeoutMs = 1200,
} = {}) {
  const memoryCheckpoints = new Map(), memoryJournal = new Map(), memoryPrefabs = new Map();
  let dbPromise = null, activeDb = null, persistenceDisabled = !indexedDBFactory, seq = 1;

  const boundedMs = (value, fallback) => Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : fallback;
  const openWaitMs = boundedMs(openTimeoutMs, 1200);
  const transactionWaitMs = boundedMs(transactionTimeoutMs, 1200);

  function disablePersistence(db = activeDb) {
    persistenceDisabled = true;
    try { db?.close?.(); } catch {}
    if (db === activeDb) activeDb = null;
  }

  function openDb() {
    if (persistenceDisabled || !indexedDBFactory) return Promise.resolve(null);
    if (activeDb) return Promise.resolve(activeDb);
    if (dbPromise) return dbPromise;

    dbPromise = new Promise(resolve => {
      let request = null, settled = false;
      const finish = db => {
        if (settled) {
          if (db) try { db.close?.(); } catch {}
          return;
        }
        settled = true;
        clearTimeout(timer);
        if (db) {
          activeDb = db;
          db.onversionchange = () => {
            try { db.close?.(); } catch {}
            if (activeDb === db) activeDb = null;
          };
        }
        resolve(db || null);
      };
      const failOpen = () => {
        disablePersistence(null);
        finish(null);
      };
      const timer = setTimeout(failOpen, openWaitMs);

      try {
        request = indexedDBFactory.open(dbName, 2);
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains('checkpoints')) db.createObjectStore('checkpoints', { keyPath: 'key' });
          if (!db.objectStoreNames.contains('journal')) db.createObjectStore('journal', { keyPath: 'key' });
          if (!db.objectStoreNames.contains('creatorPrefabs')) db.createObjectStore('creatorPrefabs', { keyPath: 'key' });
        };
        request.onsuccess = () => finish(request.result);
        request.onerror = failOpen;
        request.onblocked = failOpen;
      } catch {
        failOpen();
      }
    });
    return dbPromise;
  }

  function runTransaction(db, store, mode, start, fallback) {
    if (!db || persistenceDisabled) return Promise.resolve(fallback);
    return new Promise(resolve => {
      let tx = null, request = null, settled = false, result = fallback;
      const finish = (value = result, disable = false) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (disable) disablePersistence(db);
        resolve(value);
      };
      const fail = () => finish(fallback, true);
      const timer = setTimeout(() => {
        try { tx?.abort?.(); } catch {}
        fail();
      }, transactionWaitMs);

      try {
        tx = db.transaction(store, mode);
        request = start(tx.objectStore(store));
        if (request) {
          request.onsuccess = () => { result = request.result; };
          request.onerror = fail;
        }
        tx.oncomplete = () => finish(result);
        tx.onerror = fail;
        tx.onabort = fail;
      } catch {
        fail();
      }
    });
  }

  function put(db, store, value) {
    return runTransaction(db, store, 'readwrite', objectStore => objectStore.put(value), false).then(result => result !== false);
  }
  function del(db, store, key) {
    return runTransaction(db, store, 'readwrite', objectStore => objectStore.delete(key), false).then(result => result !== false);
  }
  function getAll(db, store) {
    return runTransaction(db, store, 'readonly', objectStore => objectStore.getAll(), null)
      .then(rows => Array.isArray(rows) ? rows : null);
  }

  async function saveCheckpoint(documentId, document) {
    documentId = String(documentId); const createdAt = Date.now();
    const row = { key: documentId, documentId, createdAt, document: copy(document) };
    memoryCheckpoints.set(documentId, row);
    const db = await openDb(); await put(db, 'checkpoints', row); return copy(row);
  }

  async function appendCommand(documentId, command) {
    documentId = String(documentId); const createdAt = Date.now(), key = `${documentId}:${createdAt}:${seq++}`;
    const row = { key, documentId, createdAt, command: copy(command) };
    if (!memoryJournal.has(documentId)) memoryJournal.set(documentId, []);
    memoryJournal.get(documentId).push(row);
    const db = await openDb(); await put(db, 'journal', row); return copy(row);
  }

  async function loadRecovery(documentId) {
    documentId = String(documentId);
    let checkpoint = memoryCheckpoints.get(documentId) || null, journal = memoryJournal.get(documentId)?.slice() || [];
    const db = await openDb();
    if (db) {
      const checkpoints = await getAll(db, 'checkpoints');
      const persistedJournal = checkpoints === null ? null : await getAll(db, 'journal');
      if (checkpoints !== null && persistedJournal !== null) {
        checkpoint = checkpoints.find(row => row.documentId === documentId) || checkpoint;
        journal = persistedJournal.filter(row => row.documentId === documentId);
      }
    }
    const since = Number(checkpoint?.createdAt) || 0;
    return { checkpoint: checkpoint ? copy(checkpoint) : null, commands: journal.filter(row => row.createdAt >= since).sort((a,b) => a.createdAt - b.createdAt || a.key.localeCompare(b.key)).map(row => copy(row)) };
  }

  async function saveCreatorPrefab(ownerId, prefab) {
    ownerId = String(ownerId || 'local');
    if (!prefab?.id) throw new Error('STUDIO_CREATOR_PREFAB_ID_REQUIRED');
    const row = { key: `${ownerId}:${String(prefab.id)}`, ownerId, updatedAt: Date.now(), prefab: copy(prefab) };
    memoryPrefabs.set(row.key, row);
    const db = await openDb(); await put(db, 'creatorPrefabs', row); return copy(row.prefab);
  }

  async function listCreatorPrefabs(ownerId) {
    ownerId = String(ownerId || 'local');
    const db = await openDb();
    const persistedRows = db ? await getAll(db, 'creatorPrefabs') : null;
    if (persistedRows !== null) for (const row of persistedRows) memoryPrefabs.set(row.key, row);
    return [...memoryPrefabs.values()].filter(row => row.ownerId === ownerId).sort((a,b) => Number(b.updatedAt)-Number(a.updatedAt)).map(row => copy(row.prefab));
  }

  async function deleteCreatorPrefab(ownerId, prefabId) {
    const key = `${String(ownerId || 'local')}:${String(prefabId)}`;
    memoryPrefabs.delete(key);
    const db = await openDb(); await del(db, 'creatorPrefabs', key);
  }

  async function clearDocument(documentId) {
    documentId = String(documentId); memoryCheckpoints.delete(documentId); memoryJournal.delete(documentId);
    const db = await openDb(); if (!db) return;
    for (const store of ['checkpoints','journal']) {
      const rows = await getAll(db, store);
      if (rows === null) return;
      for (const row of rows) if (row.documentId === documentId) {
        const deleted = await del(db, store, row.key);
        if (!deleted) return;
      }
    }
  }

  return Object.freeze({
    saveCheckpoint,
    appendCommand,
    loadRecovery,
    clearDocument,
    saveCreatorPrefab,
    listCreatorPrefabs,
    deleteCreatorPrefab,
    close: async () => {
      const db = activeDb;
      try { db?.close?.(); } catch {}
      activeDb = null;
      dbPromise = null;
      persistenceDisabled = !indexedDBFactory;
    },
  });
}
