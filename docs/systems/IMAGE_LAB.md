# Kelo Image Lab

## Propósito

Image Lab es una herramienta de authoring para preparar imágenes antes de pasarlas al Sprite Compiler, Asset Sheet Studio o al generador de mundo. Su regla principal es **no destructiva**: el archivo original se guarda una vez y nunca se sobreescribe; toda edición se expresa como una lista de operaciones que se vuelve a aplicar desde el original.

La primera versión resuelve un problema práctico del pipeline de arte: convertir JPG/PNG/WebP, limpiar alpha, recortar transparencia, reescalar pixel-perfect, rotar/voltear y exportar derivados sin destruir la fuente.

## OWNER y archivos

Owner: `CREATORS / ASSETS / IMAGE LAB`.

- `image-lab.html`: entrada standalone ligera.
- `src/creators/ui/image-lab-workspace.mjs`: UI móvil/desktop.
- `src/creators/assets/image-lab-project.mjs`: modelo no destructivo y revisiones.
- `src/creators/assets/image-format-converter.mjs`: renderer/encoder de derivados.
- `src/creators/assets/image-lab-source-store.mjs`: persistencia local del original y manifests.
- `scripts/image-lab-audit.mjs`: invariantes deterministas.

Image Lab no crea otro runtime de juego y no sustituye Sprite Compiler, Asset Sheet Studio, Property, Map Forge ni publicación de assets.

## Estado que posee

Image Lab posee solamente authoring local:

- descriptor del original;
- lista de operaciones de la working copy;
- revisiones inmutables de esas operaciones;
- preferencias de export;
- Blob original local guardado bajo `sourceId`.

No posee:

- colliders de runtime;
- placements;
- catálogo publicado;
- URLs públicas de assets;
- gameplay state;
- autoridad de publicación.

## Contrato no destructivo

El flujo siempre es:

`ORIGINAL INMUTABLE → replay operations → WORKING COPY → EXPORT DERIVADO`

El original nunca se modifica en sitio.

`resetImageLabWorkingCopy()` borra solamente las operaciones activas. No borra el original ni las revisiones guardadas.

`renderImageLabProject()` siempre decodifica de nuevo el Blob fuente y reaplica el stack. No encadena exports previos, evitando degradación acumulativa por generaciones sucesivas.

## JPG → PNG

Convertir JPG a PNG evita añadir una nueva etapa de compresión con pérdida al resultado decodificado. **No recupera detalle que el JPG ya perdió**. El UI lo explica explícitamente y `imageExportPolicy('png')` declara la política como no-lossy sobre los píxeles de trabajo, no como restauración.

Exportar de nuevo a JPG sí es con pérdida y además elimina transparencia.

WebP depende del encoder del navegador y del parámetro de calidad.

## Operaciones V1

- `trim-alpha`: recorta canvas transparente con padding configurable.
- `alpha-snap`: convierte alpha casi cero a 0 y casi opaco a 255 sin tocar la franja intermedia.
- `resize`: escala por tamaño o factor; `mode:'pixel-perfect'` desactiva smoothing.
- `rotate`: giros de 90°.
- `flip`: espejo horizontal/vertical.

El cambio de formato es una política de export, no una mutación de la fuente.

## Revisiones

`createImageLabRevision()` guarda una **copia completa del stack de operaciones**. Cambiar una operación después no altera revisiones previas.

Esto permite:

1. limpiar una imagen;
2. guardar `Revision 1`;
3. experimentar con otros parámetros;
4. volver a renderizar la revisión anterior desde el mismo original.

## Persistencia local

`image-lab-source-store.mjs` usa IndexedDB cuando está disponible y memoria como fallback.

Dos stores locales:

- `sources`: Blob original inmutable por `sourceId`;
- `projects`: manifest del proyecto.

`saveOriginal()` falla si intenta escribir otra vez el mismo `sourceId`. Esta es una defensa deliberada contra sobrescritura accidental.

La eliminación del original solo ocurre mediante una acción explícita `deleteProject(..., {deleteOriginal:true})`; nunca durante reset/export.

## UI

La página directa es:

`/image-lab.html`

Controles V1:

- SUBIR IMAGEN
- ORIGINAL / WORKING
- RESET ORIGINAL
- GUARDAR REVISIÓN
- TRIM ALPHA
- LIMPIAR ALPHA
- 2× PIXEL / ½× PIXEL
- ROTAR 90°
- FLIP
- exportar PNG / WebP / JPG
- restaurar proyectos recientes desde su original local

La UI es mobile-first y reclama `KeloInputLocks` solo cuando ese owner existe; la página standalone funciona sin cargar el runtime del juego.

## Online-first

Hoy la herramienta es authoring local. El contrato ya separa:

- identidad estable: `projectId`, `sourceId`;
- source original;
- manifest;
- revisiones;
- derivados.

Una versión online puede reemplazar `image-lab-source-store` por storage privado/versionado y mantener sin cambios el modelo de proyecto y el converter. El cliente no obtiene autoridad de publicación por ejecutar Image Lab.

## Invariantes

1. El original no se sobreescribe.
2. Working se reconstruye desde original, no desde el último export.
3. Reset no elimina original ni revisiones.
4. Una revisión no cambia cuando se edita posteriormente el working stack.
5. PNG no se describe como restauración de JPEG.
6. JPG export se marca como lossy.
7. Pixel-perfect resize desactiva smoothing.
8. Nada del Image Lab escribe directamente runtime world/collision.

## Tests

Ejecutar:

```bash
npm run audit:image-lab
```

El audit verifica:

- source inmutable;
- revisión snapshot real;
- reset preservando source/revisiones;
- políticas PNG/JPG;
- nombres de export;
- persistencia fallback;
- rechazo de sobrescritura del original.

## Deuda / siguiente fase

- Registrar Image Lab dentro del Creator Hub después de validar la página standalone en móvil.
- Añadir preview visual de alpha/bounds y comparación before/after.
- Conectar salida con `sprite-world-asset-compiler` para pivot/footprint/portal en un solo flujo.
- Añadir batch processing.
- Añadir compresión PNG verdaderamente optimizada por encoder especializado si se decide incorporar una dependencia; V1 usa el encoder nativo del navegador.
