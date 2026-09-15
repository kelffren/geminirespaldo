# Kelo Online Foundation

- **Owner gameplay online:** `server/*`.
- **Owner identidad/persistencia:** Supabase `kelo-world` (`iapxdbitjdwvtbpjghct`).
- **Región DB:** `us-west-2`.
- **Runtime gameplay:** Render `kelo-world-server` en Virginia.
- **Transporte cliente:** `engine-net.js` / `KeloNetAuthority`.
- **Config:** `src/config/online-runtime-config.js`.
- **Auth browser:** `src/auth/supabase-auth-runtime.js`.
- **Continuidad auth:** `src/auth/online-auth-lifecycle-bridge.js`.
- **Identidad server:** `server/online-identity-store.js`.
- **Persistencia bridge:** `server/server-state-bridge.js` -> Edge Function `kelo-server-state`.
- **Migraciones:** `supabase/migrations/*`.

## 1. Propósito

Supabase aporta identidad, persistencia, catálogo y storage sin entrar en el game loop. `server/*` conserva movimiento, PvP, hits, daño, cooldowns, loot/forge/commerce valioso y estado vivo.

```text
GitHub Pages
  +--> Supabase Auth/API con publishable key + RLS
  |      cuenta, character, creator data propia
  |
  +--> KeloNetAuthority -> WSS Render / server/*
                           autoridad gameplay
                           |
                           +--> Edge Function kelo-server-state
                                  credenciales privileged viven en Supabase
                                  -> Postgres
```

No existe un segundo servidor multiplayer.

## 2. Identidad

- `auth.users.id` = cuenta.
- `profiles.user_id` = perfil público.
- `characters.id` = identidad canónica del personaje.
- Una cuenta puede crear hasta 3 personajes mediante `create_character`.
- `characters.legacy_player_key` solo sirve para migrar el UUID local anterior.
- El navegador nunca declara un `account_id` confiable.

`src/auth/supabase-auth-runtime.js` usa únicamente la publishable key. Mantiene sesión con `supabase-js`, no crea invitado salvo acción explícita, verifica al usuario, selecciona/crea un character propio y, cuando aplica, reclama el legacy player key mediante RPC validada por `auth.uid()`.

El mismo `hello` de `engine-net.js` recibe `accessToken + characterId`. No se crea otro WebSocket. `server/online-identity-store.js` verifica el JWT contra Auth y consulta `characters` con publishable key + el mismo JWT; RLS vuelve a validar ownership.

`src/auth/online-auth-lifecycle-bridge.js` conserva esa identidad durante sesiones largas: al recibir `TOKEN_REFRESHED` pide credenciales frescas al owner `KeloOnlineAuth`, que vuelve a sincronizar únicamente `accessToken + characterId` para el transporte existente. En `SIGNED_OUT` elimina inmediatamente las credenciales de red y repara cualquier estado local de auth que hubiese quedado stale. No copia refresh tokens ni abre sockets.

Producción opera con `KELO_REQUIRE_AUTH=1`: una conexión sin sesión Supabase válida no puede promoverse a identidad de juego online.

## 3. Roles y autorización

Roles base: `player`, `creator`, `moderator`, `admin`, `official`.

`account_roles` es server-managed. `kelo_private.has_role()` permanece fuera del schema expuesto. Las RPC `SECURITY DEFINER` accesibles a `authenticated` son intencionales únicamente cuando aplican reglas atómicas, fijan `search_path=''` y verifican `auth.uid()`/ownership.

## 4. Creator Asset Library

`asset_families` mantiene identidad/metadata editable; `asset_revisions` mantiene revisiones inmutables. Los mapas guardan `asset_id`/revision, nunca blob URLs o filenames como identidad.

```text
archivo
 -> creator-private/<auth.uid()>/...
 -> register_asset_revision()
 -> review
 -> moderación trusted-server
 -> creator-global/...
 -> asset_publications
```

`publish_asset_revision()` sigue siendo trusted-server only.

Buckets V1:

| Bucket | Público | Límite | Escritura |
|---|---:|---:|---|
| `creator-private` | no | 5 MiB | dueño autenticado |
| `creator-global` | sí | 5 MiB | backend/moderación |
| `avatars` | sí | 2 MiB | dueño autenticado |
| `map-previews` | sí | 5 MiB | dueño autenticado |

## 5. Mapas

`maps` es identidad estable; `map_versions` es cabecera inmutable; `map_version_chunks` divide payload; `map_asset_refs` fija dependencias exactas; `map_publications` publica una versión sin reescribir las anteriores.

## 6. Economía y progreso persistentes

La DB no sustituye a los owners del servidor; los hace durables.

- `PlayerEconomyStore` sigue siendo el único owner de saldo/inventario/equipment usado por Forge y Commerce.
- Al autenticar un `characters.id`, hidrata desde `character_state_snapshots.payload.economy` y hace flush durable detrás de la misma API.
- Forge espera hidratación antes de leer/mutar y hace flush antes de devolver operaciones de forja/combinación.
- Commerce sigue mutando el mismo `PlayerEconomyStore`; el proxy de persistencia captura mutaciones anidadas y las agrupa con debounce.
- Nobleza usa su tabla/RPC especializada existente mediante `kelo-server-state`.
- Títulos usan temporalmente `character_state_snapshots.payload.titles`; no existe todavía `title_players`, por lo que no se inventó una tabla paralela.
- El bridge serializa saves por character para evitar que economía y títulos se pisen al actualizar el mismo snapshot.

`character_wallets`, `wallet_ledger`, `item_instances` y `character_equipment` siguen siendo la dirección canónica de migración especializada. `character_state_snapshots` no debe convertirse en una bolsa infinita de JSON; cada dominio se promueve a tabla propia cuando su semántica lo exige.

Nunca aceptar del cliente resultados finales como `newBalance`, `damage`, `lootGranted`, `forgeSuccess` o `marketSettlement`.

## 7. Bridge privado y secretos

La Edge Function `kelo-server-state` recibe las credenciales privilegiadas desde el runtime administrado de Supabase. Render no necesita almacenar `sb_secret` ni `service_role` para esta ruta.

Render guarda `KELO_SERVER_BRIDGE_KEY`, una credencial propia server-to-server. La Edge Function solo acepta operaciones si su hash coincide. El valor real nunca entra al repo, al navegador ni a logs; `render.yaml` la declara `sync: false`.

La función:

- valida el character activo;
- opcionalmente valida un Bearer JWT contra el dueño del character;
- limita tamaño de body/state;
- load/save de snapshots con revisión creciente;
- accede a Nobleza/RPC mediante credenciales privilegiadas internas.

## 8. Confiabilidad

`server_idempotency`, `server_outbox` y `server_audit_events` permanecen disponibles para operaciones que requieran idempotencia, delivery confiable y auditoría.

Runtime Render:

- `/healthz` y `/readyz` en el mismo `http.Server` que recibe upgrades WebSocket;
- 64 KiB max WebSocket payload;
- sin per-message compression;
- ping/pong cada 30 s;
- SIGTERM/SIGINT cierra clientes con 1012 y detiene timers limpiamente.

## 9. Realtime

- movimiento/PvP/skills: `server/*` WebSocket;
- publicación pública de assets/mapas: Realtime Broadcast mínimo;
- economía/progreso privado: server authority + persistencia server-to-server.

Nunca usar Postgres Changes como game loop.

Producción usa `wss://kelo-world-server.onrender.com`; `?net=` es override QA y `?offline=1` fuerza local.

## 10. RLS y claves

- RLS activo en tablas públicas de la Foundation.
- Tablas service-only niegan `anon`/`authenticated` cuando corresponde.
- Browser: solo `sb_publishable_*`.
- Render: publishable key para verificar JWT/RLS + `KELO_SERVER_BRIDGE_KEY` para llamar a la Edge Function.
- Supabase privileged key: permanece dentro del runtime de Supabase Edge.
- Nunca guardar `sb_secret`, service-role, bridge key, access token o refresh token en Pages/repo/logs.

## 11. Estado legacy / degradación

`equipment_items`, `forge_history`, `nobility_players` y `nobility_history` no se eliminan de golpe. Las identidades legacy que todavía no correspondan a un `characters.id` usan RAM de transición en vez de fallar. Cuando el navegador consigue sesión + character válido, los adapters promueven automáticamente esa conexión al camino durable.

Esto permite rollout sin apagar jugadores y sin fingir que RAM es persistencia de producción.

## 12. APIs relevantes

Client-authenticated controladas:

- `create_character(name)`
- `claim_legacy_player_key(character_id, player_key)`
- creator/map RPCs ya documentadas.

Trusted-server only:

- `publish_asset_revision(...)`
- `publish_map_version(...)`
- `apply_wallet_delta(...)`
- `nobility_donate(...)`
- Edge Function `kelo-server-state` mediante bridge key privada.

## 13. Tests / auditoría

- `npm run audit:online-foundation`
- `npm run audit:foundation`
- `npm run audit:docs`
- `node scripts/audit-online-auth-lifecycle.mjs`
- `cd server && npm run test:smoke`
- `cd server && npm run test:persistence`
- Supabase Security Advisor después de DDL/RLS.
- Supabase Performance Advisor después de cambios de índices/queries.

El persistence smoke usa un backend local controlado para validar hydrate/flush, serialización del snapshot, Forge, Titles, Nobleza persistente y fallback legacy sin tocar producción.

## 14. Anti-patrones prohibidos

- segundo servidor/transport multiplayer;
- client-authoritative daño, saldo, forge o loot;
- posiciones PvP por frame en Postgres;
- `service_role`/`sb_secret` en Render o Pages para este flujo;
- `KELO_SERVER_BRIDGE_KEY` en GitHub/cliente;
- múltiples owners de saldo/inventario;
- convertir snapshot JSON en almacenamiento universal permanente;
- borrar índices nuevos solo porque todavía no registran uso;
- usar `user_metadata` como autorización.

## 15. Expansión sin ruptura

Esta base admite guilds, social graph, housing, mail, quests, market/order books, creator packs, moderation, shards/regions, CDN/R2 y workers de outbox manteniendo IDs actuales. Las áreas con semántica propia deben migrar a tablas especializadas sin cambiar la autoridad gameplay.
