/* KELO-INDEX
 * area: STUDIO / HISTORY
 * owns: undo/redo journal and memory budget
 * does-not-own: document mutation, persistence, networking
 * public-api: createHistoryManager()
 * online: no
 */

const DEFAULT_BUDGET_BYTES = 8 * 1024 * 1024;

function byteSize(value) {
  try { return new TextEncoder().encode(JSON.stringify(value ?? null)).byteLength; }
  catch { return 1024; }
}

export function createHistoryManager({ budgetBytes = DEFAULT_BUDGET_BYTES } = {}) {
  const undoStack = [];
  const redoStack = [];
  let usedBytes = 0;

  function trim() {
    while (usedBytes > budgetBytes && undoStack.length > 1) {
      const removed = undoStack.shift();
      usedBytes -= removed.__bytes || 0;
    }
  }

  function push(entry) {
    if (!entry || typeof entry.undo !== 'function' || typeof entry.redo !== 'function') {
      throw new Error('STUDIO_HISTORY_INVALID_ENTRY');
    }
    const wrapped = { ...entry, __bytes: Math.max(64, Number(entry.bytes) || byteSize(entry.serialized)) };
    undoStack.push(wrapped);
    usedBytes += wrapped.__bytes;
    redoStack.length = 0;
    trim();
    return wrapped;
  }

  async function undo() {
    const entry = undoStack.pop();
    if (!entry) return null;
    await entry.undo();
    usedBytes -= entry.__bytes || 0;
    redoStack.push(entry);
    return entry;
  }

  async function redo() {
    const entry = redoStack.pop();
    if (!entry) return null;
    await entry.redo();
    undoStack.push(entry);
    usedBytes += entry.__bytes || 0;
    trim();
    return entry;
  }

  function clear() {
    undoStack.length = 0;
    redoStack.length = 0;
    usedBytes = 0;
  }

  return Object.freeze({
    push, undo, redo, clear,
    get canUndo() { return undoStack.length > 0; },
    get canRedo() { return redoStack.length > 0; },
    get undoDepth() { return undoStack.length; },
    get redoDepth() { return redoStack.length; },
    get usedBytes() { return usedBytes; },
    get budgetBytes() { return budgetBytes; },
    inspect: () => ({
      undo: undoStack.map(x => x.label || x.type || 'command'),
      redo: redoStack.map(x => x.label || x.type || 'command'),
      usedBytes,
      budgetBytes
    })
  });
}
