# ChatGPT Asset Upload Bridge — MEMORIA OPERATIVA

> **Leer este archivo antes de intentar subir un PNG generado por ChatGPT a Kelo World.**
>
> Objetivo: permitir que ChatGPT genere/reciba un PNG y lo coloque rápidamente en `kelffren/gemini` → `main` → `assets/...` sin que Kelo tenga que descargar, abrir GitHub ni arrastrar archivos manualmente.

## Estado

**FUNCIONA y fue probado en producción del repo.**

Prueba validada:

- origen: sprite sheet generado en ChatGPT;
- archivo puente: `/kelo-hero-spritesheet.png` en Dropbox;
- destino final: `assets/hero-spartan-spritesheet.png`;
- workflow: `.github/workflows/dropbox-asset-import.yml`;
- resultado: PNG presente en `main`.

## Arquitectura rápida

```text
ChatGPT / image_gen
        ↓
archivo PNG de la conversación
        ↓
Dropbox temporal
        ↓
enlace temporal directo de descarga
        ↓
asset-import-requests/<id>.json
        ↓ push a main
GitHub Action: dropbox-asset-import.yml
        ↓
descarga + valida PNG
        ↓
assets/<ruta>.png
        ↓
commit automático + push main
```

## Herramientas usadas

1. `image_gen` o un PNG adjunto en la conversación.
2. Plugin/conector Dropbox: subir el archivo de la conversación.
3. Dropbox `download_link`: crear URL temporal de descarga.
4. GitHub connector: crear un pequeño JSON en `asset-import-requests/`.
5. GitHub Actions: `.github/workflows/dropbox-asset-import.yml`.
6. GitHub connector: verificar que el PNG final existe en `assets/`.

## Procedimiento exacto

### 1. Tener el PNG como archivo de conversación

Después de `image_gen`, conservar el `file_id` / archivo generado. No pedir al usuario que lo descargue si el archivo ya está disponible en la conversación.

### 2. Subirlo temporalmente a Dropbox

Usar la herramienta de Dropbox para guardar el archivo de la conversación, por ejemplo:

```text
/kelo-hero-spritesheet.png
```

Esperar a que la subida indique `status=completed` antes de continuar.

Dropbox es solo el puente de bytes; no es el almacenamiento final del juego.

### 3. Crear un enlace temporal directo

Usar Dropbox `download_link` sobre el archivo recién subido.

IMPORTANTE:

- el enlace es temporal;
- es de un solo uso para descarga;
- NO abrirlo, previsualizarlo, hacer HEAD ni consumirlo antes de que GitHub Action lo descargue;
- crear inmediatamente la solicitud de importación en GitHub.

### 4. Crear la solicitud en GitHub

Crear un archivo nuevo dentro de:

```text
asset-import-requests/
```

Ejemplo:

```text
asset-import-requests/hero-spartan-spritesheet.json
```

Contenido:

```json
{
  "url": "URL_TEMPORAL_DIRECTA_DE_DROPBOX",
  "destination": "assets/hero-spartan-spritesheet.png"
}
```

Reglas:

- `url` debe empezar por `https://`;
- `destination` debe empezar por `assets/`;
- `destination` debe terminar en `.png`;
- usar nombres claros, estables y sin rutas innecesarias;
- si el usuario no especifica carpeta, preferir `assets/inbox/<nombre>.png`;
- si la categoría es conocida, usar una ruta semántica como `assets/world/trees/`, `assets/fx/`, etc.

El commit que crea el JSON dispara automáticamente el workflow.

### 5. Qué hace el workflow

Archivo owner:

```text
.github/workflows/dropbox-asset-import.yml
```

El workflow:

1. se activa al hacer push a `main` de `asset-import-requests/*.json`;
2. hace checkout con historial completo;
3. lee cada JSON pendiente;
4. valida URL HTTPS;
5. valida que el destino sea `assets/**/*.png`;
6. descarga con `curl --fail --location`;
7. comprueba la firma PNG `89 50 4E 47 0D 0A 1A 0A`;
8. comprueba que el archivo no esté vacío;
9. mueve el archivo al destino final;
10. elimina el JSON de solicitud;
11. hace commit como `kelo-asset-bot`;
12. ejecuta `git pull --rebase origin main` para convivir con otros bots/agentes;
13. hace push a `main`.

La concurrencia usa el grupo `kelo-asset-import` con `cancel-in-progress: false`, así que no se deben cancelar importaciones anteriores al llegar otra.

## Verificación obligatoria

No decir al usuario que "ya está subido" solo porque se creó la solicitud.

Esperar/verificar una de estas dos cosas:

1. el workflow terminó con éxito; y/o
2. `GitHub.fetch_file` puede resolver el destino final en `main`.

Ejemplo validado:

```text
assets/hero-spartan-spritesheet.png
```

Solo después de esa comprobación afirmar que el asset está en GitHub.

## Comando mental para futuras sesiones

Cuando Kelo diga algo como:

> "sube esta imagen a assets"

interpretar como:

```text
PNG conversación
→ Dropbox upload
→ esperar completed
→ Dropbox download_link
→ crear asset-import-requests/<nombre>.json
→ esperar Action
→ verificar assets/<destino>.png
```

No pedir pasos manuales si estas herramientas siguen conectadas.

## Caso: imagen generada por ChatGPT

Si acaba de generarse con `image_gen`, usar directamente el archivo generado por la herramienta. No volver a pedir al usuario que adjunte la misma imagen.

## Caso: PNG adjunto por Kelo

Usar el archivo adjunto como `source_file` de Dropbox y seguir exactamente el mismo puente.

## Errores frecuentes

### Dropbox upload queda `in_progress`

Usar `check_upload_file_status` con el `operation_id` hasta `completed`.

### Enlace Dropbox expiró o fue consumido

Crear un **nuevo** `download_link` y actualizar/crear una nueva solicitud. No reutilizar el enlace consumido.

### Workflow falla diciendo que no es PNG

El enlace no devolvió bytes PNG reales, expiró o fue consumido. Generar un download link nuevo y reintentar.

### El destino ya existe

Decidir conscientemente si se quiere reemplazar. El workflow actual usa escritura del checkout y commit; un destino existente puede ser reemplazado por la descarga. Verificar que el usuario realmente pidió sustituirlo cuando el nombre corresponde a un asset importante.

### Hay muchos commits simultáneos en `main`

No quitar el `git pull --rebase origin main`; existe precisamente porque Kelo World tiene varios bots/agentes escribiendo concurrentemente.

## Seguridad / límites

- El JSON contiene una URL temporal; el workflow borra el JSON después de importar.
- No guardar tokens, contraseñas ni claves en los JSON.
- El puente actual está diseñado para PNG.
- Para otros tipos de archivo, ampliar y validar explícitamente el workflow en vez de saltarse las comprobaciones.

## Fuente de verdad

Si esta documentación contradice el código actual, manda el workflow LIVE:

```text
.github/workflows/dropbox-asset-import.yml
```

Leer ese archivo antes de reparar o extender el puente.

## Regla final

**El usuario no debe tener que descargar y volver a subir un PNG que ChatGPT ya tiene como archivo.**

El flujo deseado es siempre el más corto posible:

```text
"genera esto y súbelo a assets"
→ generar
→ transferir
→ importar
→ verificar
→ confirmar
```

<!-- CREATOR-ASSET-SHEET-BRIDGE-V1:START -->
## Asset Sheet Studio V1 — puente natural de clasificación

Cuando ChatGPT entregue una sola imagen con varios árboles, edificios, plantas u objetos:

1. abre **CREATORS → Asset Sheet Studio**;
2. carga la imagen cruda y pulsa **ANALYZE SHEET**;
3. revisa la vista numerada;
4. descarga **REVIEW JSON** y copia **CHATGPT PROMPT**;
5. adjunta la imagen + JSON en la conversación;
6. importa el JSON devuelto para aplicar nombres/categorías;
7. usa **OPEN IN WORLD** para probar la galería como borrador de sesión;
8. exporta el atlas limpio + manifest y usa este puente Dropbox/GitHub para persistir los bytes.

Este flujo no llama una API de ChatGPT. El modelo solo revisa un archivo que el usuario adjunta explícitamente. ChatGPT puede corregir semántica; no puede mover los recuadros, pivotes ni colisiones calculados por Kelo.

Contrato técnico: `docs/systems/CREATOR_ASSET_BRIDGE.md`.
<!-- CREATOR-ASSET-SHEET-BRIDGE-V1:END -->
