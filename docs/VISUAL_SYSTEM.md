# Kelo World — Visual System

**Actualizado:** 2026-09-14

## Objetivo

Mantener una dirección visual coherente sin acoplar arte a gameplay ni crear renderers por feature.

## Principios

- mundo top-down 2D legible en móvil;
- siluetas claras y contraste por capas;
- assets modulares/reutilizables sobre composiciones gigantes cuando el mundo necesita edición;
- azul real, oro, marfil y vegetación rica para la Plaza/zonas imperiales;
- bosque con bordes orgánicos para ocultar repetición y grid;
- UI separada del arte del mundo.

## Pipeline runtime

`asset registry / atlas contract → visual manifest/template → environment/avatar/FX owner → render phases`

## Forest Plaza visual language

El set actual define:

- marble/ivory plaza core;
- blue-gold compass/inlays;
- stairs, balustrades, columns, banners;
- fountains/waterfalls/ponds;
- garden planters/topiary/flowers;
- dirt/grass path transitions;
- market props;
- trees/rocks/root borders.

Estas piezas son el vocabulary visual, no una imagen de mapa fija. El compositor/Studio decide la escena.

## Depth

Props deben declarar back/front phase y footprint cuando corresponda. Árboles, banners, fuentes y arquitectura grande deben respetar actor base-Y/occlusion cuando se conviertan en collidable/occluding production props.

## Asset naming

Creator-facing names usan semántica (`fp_water_fountain_round_large`) y categorías. IDs legacy se mantienen solo para identidad/compatibilidad.

## Calidad

Un asset visual se considera listo cuando:

- fondo/transparencia correcta;
- bordes limpios;
- escala coherente;
- pivot/anchor razonable;
- sourceRect no corta arte vecino;
- preview legible;
- categoría/nombre útiles;
- no produce seam/grid accidental en composición.
