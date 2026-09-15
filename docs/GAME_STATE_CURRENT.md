# Kelo World — Current Game State

**Snapshot:** 2026-09-14  
**Runtime:** V6.54.2

## Producto

Kelo World es un juego web 2D top-down mobile-first con mundo social, PvP/Arena, habilidades, equipo, monturas, economía, propiedad/instancias y una plataforma interna de creación.

## Runtime

- Auth/Guest pinta antes del boot pesado.
- Canvas principal: `#game-canvas`.
- Boot de engine declarado en `index.html` mediante `#kelo-engine-boot`.
- Foundation owners conviven con módulos legacy `engine-*.js`; la estrategia es extracción incremental, no rewrite.
- PWA/update foundation existe para evitar reinstalar manualmente cada cambio cuando la versión publicada cambia.

## World

- mundo principal data-driven en `src/environment/world-map.js`;
- terrain/surface/props/layers separados;
- colliders bajo `KELO_COLLISION`;
- cámara bajo `KeloCamera`;
- render extensions bajo `KeloRender`;
- placements/editor bajo `KELO_WORLD_EDIT` + Studio command model.

## Forest Plaza

El pipeline generado durante el sprint actual ya llegó a runtime:

- `assets/world/plaza/forest-plaza-tileset-v2.png`;
- manifest irregular cargado en boot;
- 146 piezas;
- nombres semánticos `fp_*`;
- 7 categorías funcionales;
- catálogo placeable integrado;
- carpetas visuales disponibles en Studio Assets.

Las categorías actuales son Plaza, Arquitectura, Jardines, Agua, Caminos, Mercado y Bosque.

## Studio / Creators

World reutiliza el Studio existente. No existe un segundo editor autorizado.

Studio tiene:

- select/move/placement/terrain/path/collision;
- undo/redo/rotate/scale/duplicate/delete;
- asset previews y búsqueda;
- palette móvil;
- carpetas/categorías de assets;
- Property Catalog como fuente de templates;
- Map Forge como compositor/generador, no como renderer paralelo.

El flujo móvil se carga por etapas. iPhone debe validarse en dispositivo real antes de cerrar bugs de World.

## Assets

El flujo recomendado es:

`fuente → limpieza/detección → compiler → manifest → atlas contract → property catalog → editor → placement → publicación`

El bridge ChatGPT/Dropbox/GitHub es transporte explícito de bytes; el compiler y la clasificación son capacidades internas separadas.

## Gameplay activo

- Abilities/Stone + equipment/mount ability channels.
- PvP world + Arena.
- Titles/stats/nobility.
- Character customization/appearance.
- Equipment, backpack, containers.
- Market/commerce/regional economy/caravans/factions.
- Property + instances/house.
- Guardian/admin/tuning foundations.

## Riesgos actuales

- el runtime sigue siendo grande y conserva deuda legacy;
- World/iPhone es sensible a presupuesto de memoria/boot y requiere QA real;
- varios sistemas online-ready todavía tienen autoridad local temporal;
- assets generados necesitan revisión semántica/colisión antes de declararlos producción gameplay.

## Regla de trabajo

No medir progreso por cantidad de archivos/features. Medir por capacidad usable y verificable: abre, renderiza, coloca, guarda, recompila, publica y vuelve a abrir sin romper owners existentes.
