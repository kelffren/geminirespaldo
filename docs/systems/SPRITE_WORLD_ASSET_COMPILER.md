# Sprite Compiler — World Asset Profile

## Propósito

Esta capacidad extiende el **Sprite Compiler existente** para que un PNG individual de prop/edificio/landmark generado o retocado externamente pueda convertirse en un asset de mundo con metadata determinista antes de entrar al generador de mapas.

Resuelve los fallos repetidos de authoring: alpha imperfecto, pivot indefinido, footprint/collision ausente, portales visualmente abiertos que quedarían bloqueados, escalas inconsistentes y repetición de una sola variante.

## OWNER y archivos

El OWNER sigue siendo `CREATORS / SPRITE COMPILER`; no se crea un runtime paralelo.

- `src/creators/sprite-compiler/sprite-world-asset-profile.mjs`: análisis puro de RGBA.
- `src/creators/sprite-compiler/sprite-world-asset-compiler.mjs`: adapter de compilación, collision cutout y canvas browser.
- `scripts/sprite-compiler-audit.mjs`: regresión determinista compartida con el compiler existente.

## Estado que posee

Ninguno. Es una transformación pura de authoring:

`RGBA + opciones → PNG/canvas limpio + metadata JSON-safe`

No muta Property, Map Forge, World Builder, `KELO_COLLISION`, runtime world state ni publicación de assets.

## API pública

### `buildWorldAssetProfile(data, width, height, options)`
Analiza píxeles y produce:

- `alphaCleanup`
- `pivot`
- `footprint`
- `portal`
- `scale` (`sizeClass`, `widthClass`, escala recomendada)
- `variant` (`variantGroup`, `variantId`, pesos y `widthScale` opcional)
- `placementRules`
- `styleValidation`

### `compileWorldAssetPixels(data, width, height, options)`
Promueve el análisis a contrato de compilación y genera collision metadata. Si existe un portal válido, el footprint se divide en segmentos sólidos izquierda/derecha y se emite `portalCutout`, evitando bloquear el hueco transitable.

### `compileWorldAssetImage(root, image, options)`
Adapter browser: lee un `Image`, ejecuta el compilador y devuelve un canvas con alpha saneado junto a metadata serializable.

### `serializeWorldAssetMetadata(profile)`
Elimina `cleanedPixels` y devuelve solo metadata apta para persistencia/export.

## Flujo

1. **Alpha cleanup**: alpha muy bajo → `0`; casi opaco → `255`; la franja intermedia se conserva y se mide.
2. **Bounds**: localiza el contenido visible sin inventar píxeles.
3. **Pivot**: estima el apoyo a partir del centroide ponderado de los píxeles inferiores.
4. **Footprint**: estima el área de suelo usando cuantiles del soporte inferior para ignorar outliers.
5. **Portal**: busca un corredor transparente central continuo con masa sólida a ambos lados.
6. **Collision profile**: un portal válido crea `footprint-with-portal-cutout`; un prop normal conserva footprint sólido.
7. **Scale**: normaliza por `nominalWidthTiles`/`tilePixels` sin deformar aspect ratio.
8. **Variants**: agrupa A/B/C bajo una familia y conserva pesos. `widthScale` es metadata no destructiva; no inventa una variante gráfica.
9. **Placement**: defaults por categoría + overrides explícitos.
10. **Style validation**: valida geometría medible (clipping, centrado, aspect, alpha, confianza). **No afirma inferir perspectiva artística**.

## Overrides manuales

Automático nunca tiene autoridad absoluta. `pivot`, `footprint`, `portal`, tamaño, variantes y `placementRules` aceptan override explícito. Un `landmark_gate` con portal desactivado queda `NEEDS_REVIEW` para impedir que una decisión dudosa pase silenciosamente.

## Invariantes

- No genera arte ni rellena partes faltantes.
- No deforma aspect ratio para “hacer caber” un asset.
- No convierte heurísticas en gameplay state.
- Un hueco visual transitable no puede compartir una única caja sólida que lo tape.
- Metadata usa IDs estables, no URLs como identidad.
- El compiler no publica; una futura revisión online/server puede persistir el mismo contrato sin rehacer el análisis.

## Online-first / persistencia

Hoy es authoring local y puro. Mañana `asset_revisions` puede almacenar el PNG compilado + metadata de este schema (`kelo-world-asset-profile-v1`). El server/publish authority decide qué revisión es válida; el cliente no gana autoridad por ejecutar el compilador.

## Uso correcto

```js
const compiled = compileWorldAssetPixels(rgba, width, height, {
  assetId: 'imperial_gate_A',
  category: 'landmark_gate',
  nominalWidthTiles: 3,
  variants: [
    {id:'A', spawnWeight:1},
    {id:'B', spawnWeight:.7, widthScale:.86}
  ],
  placementRules: {nearPath:true, minSpacing:10}
});
```

## Anti-patrones

- No usar `styleValidation` como sustituto de revisión visual de perspectiva/isometría.
- No generar B/C estirando destructivamente el PNG A; `widthScale` solo expresa una variante permitida/planeada.
- No escribir colliders directamente al runtime desde el compiler.
- No asumir que `USABLE` equivale a asset artísticamente aprobado.

## Tests

`npm run audit:sprite-compiler`

El audit cubre spritesheet legacy y además un portal imperial sintético con alpha fringe, pivot, footprint, escala, variantes, collision cutout, reglas de placement y overrides manuales.

## Deuda conocida

- Falta conectar esta metadata al flujo visual completo de import/preview del editor de mundo.
- La perspectiva/isometría sigue siendo review humano o una futura comparación contra referencia visual; no se falsea como inferencia automática.
- A/B/C reales requieren archivos/arte distintos si se desea variedad visual auténtica.
