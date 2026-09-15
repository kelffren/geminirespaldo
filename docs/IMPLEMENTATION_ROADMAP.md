# Kelo World — Implementation Roadmap

**Actualizado:** 2026-09-14

## NOW — estabilidad antes de expansión

1. **World Editor iPhone**: cerrar el ciclo con QA real — abrir, mantener tools, seleccionar asset, colocar, mover, guardar/draft y reabrir sin black tab/freeze.
2. **Forest Plaza**: usar las 146 piezas clasificadas para construir una composición real del mapa principal, no solo props de demostración.
3. **Asset collisions**: revisar colliders/footprints de piezas arquitectónicas y naturaleza antes de volverlas gameplay-solid.
4. **Studio asset UX**: categorías visuales, subgrupos funcionales y previews consistentes en móvil.
5. **Documentation/CI**: mantener este snapshot y los system docs sincronizados con cada cambio de owner/API.

## NEXT — construcción rápida

1. Reusar placement/preview/snap/undo para un flujo de construcción continua.
2. Subcategorías: caminos rectos/curvas/cruces/bordes; agua/bordes/cascadas; arquitectura/escaleras/muros/pilares; naturaleza/árboles/rocas/arbustos.
3. Prefabs de composición: entrada de plaza, esquina de jardín, fuente, puente, mercado, borde forestal.
4. Guardar/publish de layouts mediante la autoridad existente; nunca un persistence paralelo.
5. QA automatizable de asset catalog: sourceRect válido, preview, category, placeable, collision policy.

## LATER — online/MMO

1. Migrar progresivamente sistemas valiosos a autoridad server.
2. Instancias/property persistentes con conflictos/revisions.
3. Economía regional y caravanas con eventos server-confirmed.
4. Arena/PvP competitivo server-authoritative.
5. Creator publication con revisiones inmutables y aprobación.

## Foundation debt

- reducir responsabilidades de `engine-a.js` y `engine-c.js` sin cambiar feel;
- reducir boot monolítico y presupuesto de iPhone;
- eliminar adapters legacy solo cuando no tengan consumidores;
- convertir más contracts preparados en owners auditables, no duplicarlos.

## Regla de convergencia

No agregar features porque sí. Cada sprint debe cerrar una capacidad verificable del usuario o reducir deuda/ambigüedad de ownership.
