/* KELO-INDEX
 * area: STUDIO / DOCUMENT COMMANDS
 * owns: generic entity authoring mutations with reversible deltas
 * does-not-own: gameplay-specific object behavior
 * public-api: createPlaceEntityCommand(), createMoveEntityCommand(), createRemoveEntityCommand(), createPatchEntityCommand(), createCompositeCommand()
 * online: serialize() includes enough before/after state for authority undo/redo
 */

const copy = value => value == null ? value : (typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value)));
const scaleOf = value => { const n=Number(value); return Math.max(.1,Math.min(8,Number.isFinite(n)?Math.round(n*100)/100:1)); };
const rectFor = entity => { const s=scaleOf(entity?.transform?.scale); return { x: Number(entity?.transform?.x) || 0, y: Number(entity?.transform?.y) || 0, w: Math.max(1, (Number(entity?.bounds?.w) || 1)*s), h: Math.max(1, (Number(entity?.bounds?.h) || 1)*s) }; };
const findIndex = (document, id) => document.entities.findIndex(e => e.id === id);
const normalizePatch = patch => {
  const next = copy(patch || {});
  if (next?.transform && next.transform.rotation != null) next.transform.rotation = Math.round((Number(next.transform.rotation) || 0) / 90) * 90;
  if (next?.transform && next.transform.scale != null) next.transform.scale = scaleOf(next.transform.scale);
  return next;
};

export function createCompositeCommand(commands,{label='Composite edit',type='composite'}={}){
  const children=(commands||[]).filter(Boolean);
  if(!children.length)throw new Error('STUDIO_COMPOSITE_EMPTY');
  return {type,label,
    async execute(context){let done=0;try{for(const command of children){await command.execute(context);done++;}}catch(error){for(let i=done-1;i>=0;i--){try{await children[i].undo(context);}catch{}}throw error;}},
    async undo(context){for(let i=children.length-1;i>=0;i--)await children[i].undo(context);},
    async redo(context){for(const command of children){if(typeof command.redo==='function')await command.redo(context);else await command.execute(context);}},
    serialize:()=>({type,commands:children.map(command=>typeof command.serialize==='function'?command.serialize():{type:command.type||'anonymous'})}),
    affectedRects:context=>children.flatMap(command=>typeof command.affectedRects==='function'?(command.affectedRects(context)||[]):[])
  };
}

export function createPlaceEntityCommand(entity) {
  const row = copy(entity);
  return { type: 'entity.place', label: `Place ${row.prefabId || row.id}`,
    execute({ document }) { if (findIndex(document, row.id) >= 0) throw new Error('STUDIO_ENTITY_ALREADY_EXISTS'); document.entities.push(copy(row)); },
    undo({ document }) { const i = findIndex(document, row.id); if (i >= 0) document.entities.splice(i, 1); },
    serialize: () => ({ type: 'entity.place', entity: copy(row) }), affectedRects: () => [rectFor(row)] };
}

export function createMoveEntityCommand(id, to) {
  id = String(id); const target = { x: Number(to?.x) || 0, y: Number(to?.y) || 0 }; let from = null;
  return { type: 'entity.move', label: `Move ${id}`,
    execute({ document }) { const e = document.entities[findIndex(document, id)]; if (!e) throw new Error('STUDIO_ENTITY_NOT_FOUND'); if (!from) from = { x: Number(e.transform?.x) || 0, y: Number(e.transform?.y) || 0 }; e.transform = { ...(e.transform || {}), ...target }; },
    undo({ document }) { const e = document.entities[findIndex(document, id)]; if (e && from) e.transform = { ...(e.transform || {}), ...from }; },
    serialize: () => ({ type: 'entity.move', id, from: copy(from), to: copy(target) }),
    affectedRects({ document }) { const e = document.entities[findIndex(document, id)]; const now = e ? rectFor(e) : { x: target.x, y: target.y, w: 1, h: 1 }; return [now, { ...now, x: from?.x ?? now.x, y: from?.y ?? now.y }]; } };
}

export function createRemoveEntityCommand(id) {
  id = String(id); let removed = null; let index = -1;
  return { type: 'entity.remove', label: `Remove ${id}`,
    execute({ document }) { index = findIndex(document, id); if (index < 0) throw new Error('STUDIO_ENTITY_NOT_FOUND'); removed = copy(document.entities[index]); document.entities.splice(index, 1); },
    undo({ document }) { if (removed) document.entities.splice(Math.max(0, index), 0, copy(removed)); },
    serialize: () => ({ type: 'entity.remove', id, entity: copy(removed) }), affectedRects: () => removed ? [rectFor(removed)] : [] };
}

export function createPatchEntityCommand(id, patch) {
  id = String(id); const next = normalizePatch(patch); let previous = null;
  return { type: 'entity.patch', label: `Edit ${id}`,
    execute({ document }) { const i = findIndex(document, id); if (i < 0) throw new Error('STUDIO_ENTITY_NOT_FOUND'); if (!previous) previous = copy(document.entities[i]); document.entities[i] = { ...document.entities[i], ...copy(next) }; },
    undo({ document }) { const i = findIndex(document, id); if (i >= 0 && previous) document.entities[i] = copy(previous); },
    serialize: () => ({ type: 'entity.patch', id, previous: copy(previous), patch: copy(next) }),
    affectedRects({ document }) { const i = findIndex(document, id); return [previous && rectFor(previous), i >= 0 && rectFor(document.entities[i])].filter(Boolean); } };
}
