# Kelo World — World Builder Memory

**Estado consolidado:** 2026-09-14

## Ley

El Builder/Studio debe reutilizar el mundo real, el Property Catalog, Atlas Contract, collision owner y command model. No crear otro mapa, renderer o persistence.

## Flujo de placement

`catalog template → preview → snap/transform → command → document draft → compile/apply → runtime owners`

## Capacidades actuales

- select/multi-select;
- move/transform;
- placement de templates;
- terrain/path/collision tools;
- undo/redo;
- copy/paste;
- save prefab;
- snap/grid;
- camera/zoom;
- map validation;
- asset search/previews/categories;
- mobile compact flow.

## Forest Plaza

El atlas nuevo ya está conectado al catálogo con 146 templates. La identidad estable sigue siendo `forest-plaza:asset-###`; el nombre humano vive como metadata `fp_*`.

Carpetas creator actuales:

1. Plaza
2. Arquitectura
3. Jardines
4. Agua
5. Caminos
6. Mercado
7. Bosque

El siguiente nivel de UX debe crear subgrupos sin duplicar templates: rectos/curvas/cruces, muros/escaleras/pilares, estanques/cascadas, árboles/rocas/arbustos.

## Construcción rápida

La dirección sigue siendo:

`seleccionar pieza → preview → mover → snap → tocar → seguir colocando`

Debe apoyarse en placement tool, snap, prefab y undo existentes. La velocidad de construcción no justifica un segundo sistema de placement.

## Colisiones

Decoración puede ser visual-only. Piezas estructurales requieren collider revisado. World Builder publica colliders mediante `KELO_COLLISION`; jamás `obstacles.push()` directo.

## Móvil

Prioridad: que el flujo completo funcione desde iPhone. La métrica no es que el botón World pinte; es poder colocar y editar una pieza real y reabrir el editor.
