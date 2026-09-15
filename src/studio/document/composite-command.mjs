/* KELO-INDEX
 * area: STUDIO / COMPOSITE COMMAND
 * owns: grouping many reversible Studio commands into one history action
 * does-not-own: UI, authority transport or gameplay behavior
 * public-api: createCompositeCommand()
 * online: serialized child commands are mirrored in deterministic order
 */

const copy = value => value == null ? value : (typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value)));

export function createCompositeCommand(commands = [], { type = 'command.batch', label = 'Batch edit' } = {}) {
  const rows = (Array.isArray(commands) ? commands : []).filter(Boolean);
  if (!rows.length) throw new Error('STUDIO_COMPOSITE_EMPTY');
  let completed = 0;
  return {
    type,
    label,
    async execute(context) {
      completed = 0;
      try {
        for (const command of rows) {
          if (typeof command.execute !== 'function' || typeof command.undo !== 'function') throw new Error('STUDIO_COMPOSITE_CHILD_INVALID');
          await command.execute(context);
          completed++;
        }
      } catch (error) {
        for (let i = completed - 1; i >= 0; i--) { try { await rows[i].undo(context); } catch {} }
        completed = 0;
        throw error;
      }
    },
    async undo(context) {
      for (let i = rows.length - 1; i >= 0; i--) await rows[i].undo(context);
    },
    serialize() {
      return { type, label, commands: rows.map(command => typeof command.serialize === 'function' ? copy(command.serialize()) : { type: command.type || 'anonymous' }) };
    },
    affectedRects(context) {
      return rows.flatMap(command => typeof command.affectedRects === 'function' ? (command.affectedRects(context) || []) : []).filter(Boolean);
    }
  };
}
