/* KELO-INDEX
 * area: CREATORS / ASSET SHEET WORKSPACE
 * owner: Kelo Creator Asset Bridge workspace manifest only
 * owns: lazy route from Creator Hub into Asset Sheet Studio
 * does-not-own: compiler, UI behavior, storage, runtime catalog or publish authority
 */
export function createAssetSheetWorkspaceManifest({loader=()=>import('../ui/asset-sheet-workspace.mjs')}={}) {
  return Object.freeze({
    id:'asset-sheet', label:'Asset Sheet Studio', category:'visual', projectTypes:[], capability:null, availability:'active',
    async open(context={}) {
      const module = await loader();
      if (typeof module.openAssetSheetWorkspace !== 'function') throw new Error('CREATOR_ASSET_SHEET_ENTRY_MISSING');
      return module.openAssetSheetWorkspace(context);
    }
  });
}

export function registerAssetSheetWorkspace(registry, options={}) {
  return registry.register(createAssetSheetWorkspaceManifest(options));
}

