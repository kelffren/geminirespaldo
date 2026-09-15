/* KELO-INDEX
 * area: STUDIO / INPUT
 * owns: editor input contexts and routing priority
 * does-not-own: gameplay movement, DOM binding, tool behavior
 * public-api: createInputRouter()
 * online: no
 */

export function createInputRouter() {
  const contexts = new Map();
  const stack = [];

  function register(id, handlers = {}, priority = 0) {
    id = String(id);
    contexts.set(id, { id, handlers, priority: Number(priority) || 0 });
    return () => { contexts.delete(id); const i = stack.lastIndexOf(id); if (i >= 0) stack.splice(i, 1); };
  }

  function push(id) {
    if (!contexts.has(id)) throw new Error(`STUDIO_INPUT_CONTEXT_UNKNOWN:${id}`);
    const i = stack.indexOf(id); if (i >= 0) stack.splice(i, 1);
    stack.push(id);
  }

  function pop(id) {
    if (id == null) return stack.pop() || null;
    const i = stack.lastIndexOf(String(id));
    if (i < 0) return null;
    return stack.splice(i, 1)[0];
  }

  function ordered() {
    return stack.map(id => contexts.get(id)).filter(Boolean).sort((a, b) => b.priority - a.priority || stack.lastIndexOf(b.id) - stack.lastIndexOf(a.id));
  }

  function route(kind, event) {
    for (const ctx of ordered()) {
      const handler = ctx.handlers?.[kind];
      if (typeof handler !== 'function') continue;
      const result = handler(event);
      if (result === true || result?.handled === true) return { handled: true, contextId: ctx.id, result };
    }
    return { handled: false, contextId: null };
  }

  return Object.freeze({
    register, push, pop, route,
    has: id => contexts.has(String(id)),
    active: () => stack.slice(),
    clear: () => { stack.length = 0; }
  });
}
