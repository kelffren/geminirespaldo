/* KELO-INDEX
 * area: STUDIO / INSPECTOR MODEL
 * owns: schema-driven inspector field descriptions
 * does-not-own: DOM widgets or gameplay
 * public-api: buildInspectorModel()
 * online: no
 */

export function buildInspectorModel({ entity, componentRegistry } = {}) {
  if (!entity || !componentRegistry) return { entityId: entity?.id || null, sections: [] };
  const sections = [];
  for (const [componentId, value] of Object.entries(entity.components || {})) {
    const definition = componentRegistry.get(componentId);
    const fields = [];
    for (const [key, schema] of Object.entries(definition?.schema || {})) fields.push({ key, label: schema.label || key, type: schema.type || 'string', schema, value: value?.[key] ?? definition?.defaults?.[key] ?? null });
    sections.push({ id: componentId, label: definition?.label || componentId, category: definition?.category || 'unknown', registered: !!definition, fields });
  }
  return { entityId: entity.id, prefabId: entity.prefabId || null, transform: { ...(entity.transform || {}) }, sections };
}
