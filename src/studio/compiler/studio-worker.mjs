/* KELO-INDEX
 * area: STUDIO / WORKER
 * owns: off-main-thread pure compilation entrypoint
 * does-not-own: DOM, gameplay globals, authority or storage
 * public-api: worker message {id,type:'compile',document,prefabs,options}
 * online: no
 */

import { createWorldCompiler } from './world-compiler.mjs';

self.onmessage = event => {
  const message = event.data || {};
  const id = message.id;
  try {
    if (message.type !== 'compile') throw new Error('STUDIO_WORKER_UNKNOWN_TASK');
    const prefabs = message.prefabs || {};
    const compiler = createWorldCompiler({ resolvePrefab: prefabId => prefabs[prefabId] || { id: prefabId } });
    const result = compiler.compile(message.document, message.options || {});
    self.postMessage({ id, ok: true, result });
  } catch (error) {
    self.postMessage({ id, ok: false, error: String(error?.message || error) });
  }
};
