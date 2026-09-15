/* KELO-INDEX
 * area: STUDIO / TOOLS
 * owns: reusable editor tool registration and activation
 * does-not-own: input transport, world persistence
 * public-api: createToolRegistry()
 * online: no
 */

export function createToolRegistry({ kernel } = {}) {
  const tools = new Map();
  let activeId = null;

  function register(definition) {
    if (!definition?.id) throw new Error('STUDIO_TOOL_ID_REQUIRED');
    const id = String(definition.id);
    if (tools.has(id)) throw new Error(`STUDIO_TOOL_DUPLICATE:${id}`);
    const tool = Object.freeze({ ...definition, id });
    tools.set(id, tool);
    return tool;
  }

  async function activate(id, options = {}) {
    id = String(id);
    const next = tools.get(id);
    if (!next) throw new Error(`STUDIO_TOOL_UNKNOWN:${id}`);
    if (activeId === id) return next;
    const current = tools.get(activeId);
    if (current?.deactivate) await current.deactivate({ kernel, options });
    activeId = id;
    if (next.activate) await next.activate({ kernel, options });
    return next;
  }

  async function deactivate() {
    const current = tools.get(activeId);
    if (current?.deactivate) await current.deactivate({ kernel });
    activeId = null;
  }

  return Object.freeze({ register, activate, deactivate, get: id => tools.get(String(id)) || null, list: () => [...tools.values()], get activeId() { return activeId; } });
}
