from pathlib import Path


def replace_once(path, old, new):
    p=Path(path)
    text=p.read_text()
    if old not in text:
        raise SystemExit(f'MISSING MARKER in {path}: {old[:100]!r}')
    p.write_text(text.replace(old,new,1))

# Property editor: world authoring is gated by Admin Key capability, not URL alone.
replace_once('src/ui/property-editor.js',
"  const params=new URLSearchParams(location.search),developer=params.get('mapEditor')==='1'||params.get('editor')==='1';\n  let open=false,mode=developer?'world':'parcel',parcelId=null,selectedAsset=null,selectedPlacement=null,movePlacementId=null,ghost=null;",
"  const params=new URLSearchParams(location.search);\n  const developer=!!window.KELO_ADMIN_KEYS?.can?.('world.edit',S.playerId());\n  const localPrototype=params.get('mapEditor')==='1'&&window.KELO_ADMIN_KEYS?.authoritySource?.()==='local-prototype';\n  let open=false,mode=developer?'world':'parcel',parcelId=null,selectedAsset=null,selectedPlacement=null,movePlacementId=null,ghost=null;"
)
replace_once('src/ui/property-editor.js',
"${developer&&!isWorld()?'<span class=\"pe-test\">TEST +1</span>':''}",
"${localPrototype&&!isWorld()?'<span class=\"pe-test\">TEST +1</span>':''}"
)
replace_once('src/ui/property-editor.js',
"  function currentParcel(){return S.parcel(parcelId);}\n  function isWorld(){return currentParcel()?.kind==='world_editor';}",
"  function currentParcel(){return S.parcel(parcelId);}\n  function isWorld(){return currentParcel()?.kind==='world_editor';}\n  function worldScope(scope){if(!isWorld())return true;try{window.KELO_ADMIN_KEYS?.assert?.(scope,S.playerId());return true;}catch(e){toast('Tu Llave Admin no tiene permiso para esta acción');return false;}}"
)
replace_once('src/ui/property-editor.js',
"el('pe-mode').textContent=mode==='world'?'AUTOR · ILIMITADO':'PARCELA · UNIDADES';",
"el('pe-mode').textContent=mode==='world'?'LLAVE ADMIN · MUNDO':'PARCELA · UNIDADES';"
)
replace_once('src/ui/property-editor.js',
"  el('pe-export').onclick=()=>{const data=S.exportLayout(parcelId),blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),a=document.createElement('a');",
"  el('pe-export').onclick=()=>{if(!worldScope('world.export'))return;const data=S.exportLayout(parcelId),blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),a=document.createElement('a');"
)
replace_once('src/ui/property-editor.js',
"  el('pe-import').onclick=()=>{if(!isWorld()){toast('Importar layouts completos solo está disponible en modo autor');return;}el('pe-file').click();};",
"  el('pe-import').onclick=()=>{if(!isWorld()){toast('Importar layouts completos solo está disponible en modo autor');return;}if(!worldScope('world.import'))return;el('pe-file').click();};"
)
replace_once('src/ui/property-editor.js',
"version:'property-editor-v1.1.0',developer",
"version:'property-editor-v1.2.0',developer"
)
replace_once('src/ui/property-editor.js',
"version:'property-editor-v1.1.0',developerGate:'query-mapEditor-1'",
"version:'property-editor-v1.2.0',developerGate:'admin-key-world.edit'"
)

# Boot Admin Key authority after Property and Backpack, before editor UI.
replace_once('index.html',
'<script src="src/property/property-system.js?v=2"></script>\n<script src="src/instances/instance-system.js?v=1"></script>',
'<script src="src/property/property-system.js?v=2"></script>\n<script src="src/systems/admin-key-system.js?v=1"></script>\n<script src="src/instances/instance-system.js?v=1"></script>'
)

# Document ownership without disturbing existing maps.
with Path('docs/CODE_INDEX.md').open('a') as f:
    f.write("\n\n## ADMIN KEY / WORLD CREATOR V1\n- `src/systems/admin-key-system.js`: objeto/entitlement Llave Admin, scopes y autoridad reemplazable.\n- `src/ui/property-editor.js`: modo MUNDO visible únicamente con `world.edit`.\n- Parcela de jugador conserva unidades/ownership; Llave Admin no altera esa economía.\n")
with Path('ENGINE_MAP.md').open('a') as f:
    f.write("\n\n## Admin Key / World Creator V1\n`KELO_ADMIN_KEYS` decide quién puede abrir el modo de autor del mundo. Scopes iniciales: `world.edit`, `world.export`, `world.import`, `world.publish`, `admin.issue`, `admin.revoke`. El backend futuro sustituye la autoridad local sin cambiar el editor.\n")
