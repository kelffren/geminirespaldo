/* KELO-INDEX
 * area: STUDIO / COMPONENTS
 * owns: component definitions, metadata and validation contracts
 * does-not-own: gameplay implementation or Inspector DOM
 * public-api: createComponentRegistry()
 * online: definitions are trusted code; creator values still require authority validation
 */

const copy = value => value == null ? value : (typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value)));

export function createComponentRegistry() {
  const definitions = new Map();

  function register(raw) {
    if (!raw?.id) throw new Error('STUDIO_COMPONENT_ID_REQUIRED');
    const id = String(raw.id);
    if (definitions.has(id)) throw new Error(`STUDIO_COMPONENT_DUPLICATE:${id}`);
    const definition = Object.freeze({
      id,
      label: String(raw.label || id),
      category: String(raw.category || 'general'),
      icon: raw.icon ? String(raw.icon) : null,
      schema: Object.freeze(copy(raw.schema || {})),
      defaults: Object.freeze(copy(raw.defaults || {})),
      runtimeSystem: raw.runtimeSystem ? String(raw.runtimeSystem) : null,
      creatorVisible: raw.creatorVisible !== false,
      validate: typeof raw.validate === 'function' ? raw.validate : null
    });
    definitions.set(id, definition);
    return definition;
  }

  function validate(id, value) {
    const definition = definitions.get(String(id));
    if (!definition) return { valid: false, errors: ['COMPONENT_NOT_REGISTERED'] };
    if (!definition.validate) return { valid: true, errors: [] };
    const result = definition.validate(copy(value));
    if (result === true || result == null) return { valid: true, errors: [] };
    if (result === false) return { valid: false, errors: ['COMPONENT_INVALID'] };
    return { valid: result.valid !== false, errors: Array.isArray(result.errors) ? result.errors.slice() : [] };
  }

  return Object.freeze({
    register,
    get: id => definitions.get(String(id)) || null,
    has: id => definitions.has(String(id)),
    list: ({ category, creatorVisible } = {}) => [...definitions.values()].filter(d => (!category || d.category === category) && (creatorVisible == null || d.creatorVisible === creatorVisible)),
    validate,
    size: () => definitions.size
  });
}
