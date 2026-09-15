# updates_2026
Kelo World — registro de implementaciones (repo kelffren/gemini, GitHub Pages).
Horas en EDT. Fechas aproximadas según sesiones reales.

## 2026-08-28
- Arranque del proto social 2D en browser (Phaser descartado para V0 canvas).
- Spec: jerarquía (Rey → Caballero), slots de equipo, rarezas, KC, plaza móvil.
- Stack fijo: HTML5 Canvas + JS, sin Unity/3D.

## 2026-08-29
- Combate estilo Mobile Legends: apuntado hold+drag, dash direccional.
- Melee en tap del lado derecho.
- Colyseus aparcado: Pages es estático; no rehacer la base por red todavía.
- Bloques de trabajo (Bloque 1…7) y docs en Drive.

## 2026-08-30 ~ noche
- Repo gemini + Pages: index.html modular.
- Motores engine-a … engine-t: movimiento, cámara, bots, chat, colisiones NPC/bot, HUD, farm/forja (proto).
- Plaza grid 32px (engine-u), escala avatar (engine-v).
- Cache-bust `?v=` porque Safari no soltaba el JS viejo.

## 2026-08-31 02:00–09:00
- Decisión: no más sistemas. Prioridad look del vertical slice.
- Hero procedural 4 direcciones (engine-w) ~09:25.
- HUD flaco: oro + Menu, skills más chicos (engine-x) ~09:41.

## 2026-08-31 12:06–12:30
- Fachadas Mercado / Banco / Atelier / Café (engine-y).
- Cámara móvil ~11 tiles de ancho (engine-z) ~12:08.
- Ambiente: faroles, árboles, agua de fuente (engine-aa) ~12:23.
- Cargador opcional `assets/hero.png` (engine-ab) ~12:30.

## 2026-08-31 15:25–16:10
- Primer hero subido mal: `hero.png.JPG` (iPhone).
- Carpeta `assets/` borrada por error ~15:39; restaurada con README.
- Tileset subido como `tileset .PNG` (espacio + mayúsculas) ~15:41.
  - 1531×1027 = mapa entero, no atlas 32px. Se usa como suelo de plaza (engine-u).
- Luego el tileset desaparece otra vez; queda `hero.JPG` ~15:48.
- Se aclara: JPG sirve; PNG solo aporta transparencia.

## 2026-08-31 15:57–16:07
- Subida correcta de lámina: `assets/hero.PNG` 1024×1536, rejilla 4×4.
- En Pages el hero SÍ pinta (abrigo teal/oro) — auditado en `?v=44`.
- Usuario seguía en favorito `/gemini/` cache V4.3.
- Recuadros blancos: el sheet tenía fondo gris/blanco. Knockout de blanco/negro en engine-ab ~16:03 (`?v=45`, título V4.4).

## 2026-08-31 16:07–16:14
- Walk/run según empuje del joy izquierdo (engine-ac).
  - Stick corto = andar ~130 px/s.
  - Stick a fondo = correr ~300+ px/s.
- Sincronía de frames por **distancia recorrida**, no por `Date.now`.
  - Zancada andar 22 px / correr 14 px.
  - Idle = frame 0.
- Versión viva auditada: **V4.6** — `https://kelffren.github.io/gemini/?v=47`

## Estado al cierre 2026-08-31 ~16:15
Funciona en Pages:
- Plaza canvas, bots, chat, skills, colisiones.
- Hero spritesheet real (hero.PNG).
- Caminar/correr + frames atados al suelo.
- HUD reducido.

Pendiente (no rehacer):
- `tileset.png` 512 atlas de verdad (el mapa grande se perdió al borrar assets).
- Renombrar `hero.PNG` → `hero.png` desde PC, no desde Fotos.
- Phaser / Colyseus / cuentas reales: después del slice visual.
- No seguir sumando engine-ad salvo bug.

## Cómo abrir siempre la build nueva
Pegar el URL con `?v=NN` completo. Si Safari sugiere “Kelo World — V4.3”, ignorarlo.
