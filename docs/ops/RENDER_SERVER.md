# Kelo World — Render Server Operations

## Propósito

Render ejecuta el único owner online de gameplay de Kelo World: `server/*`. Supabase aporta identidad y persistencia; no sustituye el fixed-step WebSocket ni crea otra autoridad de combate.

```text
GitHub Pages
  -> KeloNetAuthority / engine-net.js
       -> WSS Render / server/*
            -> PvP + movimiento + economía/progreso autoritativos
            -> Supabase Auth (JWT + RLS)
            -> kelo-server-state Edge Function
                 -> persistencia trusted-server en Postgres
```

## Runtime de producción

- Servicio: `kelo-world-server`
- Región: `virginia`
- Branch: `main`
- Root: `server`
- Node: `24.20.0`
- Health: `/healthz`
- Readiness: `/readyz`
- WebSocket: 64 KiB max payload, sin per-message compression, ping/pong 30 s.
- PvP: fixed step 60 Hz; snapshots 20 Hz.

Cliente HTTPS no-local usa por defecto:

```text
wss://kelo-world-server.onrender.com
```

`?net=` conserva override QA y `?offline=1` fuerza fallback local.

## Auth

El navegador usa únicamente la publishable key de Supabase. `src/auth/supabase-auth-runtime.js` mantiene la sesión, intenta identidad anónima cuando no existe sesión, resuelve/crea un `characters.id` propio mediante RLS/RPC y adjunta `accessToken + characterId` al mismo mensaje `hello` que ya envía `engine-net.js`.

`server/online-identity-store.js` valida el JWT contra Supabase Auth y consulta `characters` usando el mismo JWT + publishable key, por lo que RLS vuelve a verificar ownership. Render no necesita `SUPABASE_SECRET_KEY` para autenticar jugadores.

Mientras `KELO_REQUIRE_AUTH=0`, si Auth no está disponible el jugador puede entrar por el camino legacy de transición. Cuando el flujo real de Pages esté verificado end-to-end se puede cambiar a `1`.

## Persistencia privada sin service-role en Render

La Edge Function `kelo-server-state` vive en el proyecto Supabase y recibe las credenciales privilegiadas desde el runtime de Supabase. Render no almacena una Supabase secret/service-role key.

Render sí mantiene una credencial propia `KELO_SERVER_BRIDGE_KEY`, usada únicamente para autorizar llamadas server-to-server a esa Edge Function. Su valor nunca se versiona ni se envía al navegador.

Variables públicas/configurables:

- `SUPABASE_URL=https://iapxdbitjdwvtbpjghct.supabase.co`
- `SUPABASE_PUBLISHABLE_KEY=sb_publishable_...`
- `KELO_SERVER_STATE_URL=https://iapxdbitjdwvtbpjghct.supabase.co/functions/v1/kelo-server-state`
- `KELO_REQUIRE_AUTH=0` durante el rollout.

Secreto Render:

- `KELO_SERVER_BRIDGE_KEY` (`sync: false` en `render.yaml`).

No guardar `sb_secret`, `service_role`, `KELO_SERVER_BRIDGE_KEY`, access tokens ni refresh tokens en GitHub, Pages o logs.

## Stores

- `PlayerEconomyStore`: owner RAM activo durante la sesión + hidratación/flush durable en `character_state_snapshots.payload.economy`.
- Forge/Commerce: siguen reutilizando `PlayerEconomyStore`; no tienen un segundo saldo/inventario.
- Nobleza: usa la tabla/RPC especializada existente mediante la Edge Function; fallback RAM solo para identidad legacy/transición.
- Títulos: usa `character_state_snapshots.payload.titles` hasta promoverlo a una tabla especializada; kills continúan naciendo exclusivamente del combate confirmado por servidor.

El bridge serializa saves por `characterId` para que economía y títulos no se pisen al actualizar el mismo snapshot.

## Comandos y CI

```text
build: npm install --omit=dev
start: npm start
lifecycle smoke: npm run test:smoke
persistence smoke: npm run test:persistence
```

`Online Production Activation CI` valida sintaxis, lifecycle real del WebSocket, bridge de persistencia, Foundation y documentación.

## Operación y rollback

- Cada cambio pasa por Git + CI antes de `main`.
- Si el webhook de Render no dispara el deploy, usar el deploy API sobre el commit ya fusionado; no parchear producción fuera de Git.
- En shutdown se detienen timers, los clientes reciben 1012 y HTTP/WebSocket cierran limpiamente.
- En fallo temporal de Supabase, el rollout actual degrada a transición/RAM en vez de tumbar el PvP.
- `KELO_REQUIRE_AUTH=1` solo después de verificar Pages -> Auth -> character ownership -> WSS -> persistencia real.

## Escalado

El plan Free sirve para desarrollo y pruebas y puede dormir sin tráfico. El servidor actual sigue siendo una sola autoridad con `MAX=32`; rooms/shards se añaden detrás del mismo contrato cuando métricas reales lo requieran, sin introducir un segundo transporte ni otra autoridad gameplay.
