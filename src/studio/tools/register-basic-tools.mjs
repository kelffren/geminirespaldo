/* KELO-INDEX
 * area: STUDIO / BASIC TOOLS
 * owns: registration of baseline reusable tools
 * does-not-own: UI
 * public-api: registerBasicTools()
 * online: no
 * mobile: World-open uses registerCoreTools() first; this full set still loads for audits and after chrome
 */

import { registerCoreTools } from './register-core-tools.mjs';
import { registerBuildTools } from './register-build-tools.mjs';

export function registerBasicTools(kernel) {
  const core=registerCoreTools(kernel);
  const build=registerBuildTools(kernel,core);
  return Object.freeze({...core,...build});
}
