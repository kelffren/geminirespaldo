# Kelo World — Guardian Network V2

## Propósito

Guardian permite que un jugador autorice a Kelo World a usar **capacidad disponible de su dispositivo** cuando el runtime pueda hacerlo. El sistema está diseñado como una red coordinada: el jugador ofrece recursos, el coordinador decide qué trabajo es útil y el data plane WebRTC puede mover bytes directamente entre un nodo y el Master vigente.

La visión de producto/fundador completa está preservada en [`docs/GUARDIAN_NETWORK_VISION.md`](../GUARDIAN_NETWORK_VISION.md). Ese archivo mezcla intención y roadmap de forma explícita; este documento describe el contrato técnico actual.

## Estado actual

### V1 — implementado

- identidad estable de nodo;
- opt-in/opt-out;
- detección/saneamiento de capacidades;
- heartbeat y expiración;
- roles de disponibilidad;
- lease de host máster foreground para cuenta autorizada;
- autorización Supabase;
- mismo simulation loop, sin crear otro loop de gameplay.

### V2 — scheduler/proof foundation implementada

El `Kelo Guardian Coordinator` server-side posee contratos para:

- observaciones confiables de región/calidad;
- presión de demanda regional;
- scoring y selección de candidatos;
- leases de workloads;
- planner de apoyo por CPU/upload/loss/tick;
- Verified Service Units;
- rangos Guardian y multiplicadores;
- separación estricta entre Service Units y KC.

### V2 — control/data plane P2P implementado

Además, Guardian ya dispone de:

- persistencia de nodos y lease Master en Supabase;
- signaling efímero `offer/answer/ICE/bye` por RPC Supabase;
- `RTCPeerConnection` nodo ↔ Master;
- DataChannel `kelo-guardian` directo y cifrado por WebRTC/DTLS;
- handshake `hello/hello_ack`;
- `ping/pong`, RTT y contadores de bytes;
- invalidación por `masterEpoch`;
- API genérica no autoritativa `sendToMaster()` / `broadcast()`.

**Importante:** esto todavía no mueve la simulación autoritativa, economía, inventario o PvP al iPhone/Guardian. `KeloNetAuthority` y el servidor Node actual siguen siendo la autoridad de gameplay compartido hasta una migración explícita.

## Owners y archivos

- `src/systems/guardian-authority.js` — `KeloGuardianAuthority`: frontera autenticada. Supabase RPC es el control plane primario; el HTTP Guardian existente queda como fallback transitorio para operaciones V1.
- `src/systems/guardian-system.js` — `KeloGuardian`: único owner cliente de preferencia, node ID, capacidades, estado observado y conexiones WebRTC/DataChannel.
- `src/ui/guardian-ui.js` — `KeloGuardianUI`: consumidor visual; abre/cierra el panel y llama APIs públicas.
- `server/guardian-coordinator.js` — `Kelo Guardian Coordinator`: owner server-side de observaciones, scheduling foundation, workloads y ledger de servicio verificado; conserva también el fallback HTTP de nodos/lease.
- `supabase/migrations/20260914052544_guardian_webrtc_control_plane_v2.sql` — nodos persistentes, lease Master, signaling efímero y RPCs autenticados.
- `server/index.js` — sigue siendo owner del HTTP/WebSocket y autoridad multiplayer/PvP actual.
- `docs/GUARDIAN_NETWORK_VISION.md` — memoria de producto/arquitectura futura.

## Estado que posee

### Cliente

`KeloGuardian` posee:

- `nodeId` estable por instalación;
- preferencia local `enabled`;
- límites/preferencias de donación;
- última vista del control plane;
- peer connections y DataChannels efímeros;
- diagnósticos locales de RTT, bytes y signaling.

No posee autoridad sobre economía, inventario, PvP, HP, recompensas ni selección económica autoritativa.

### Supabase — control plane persistente

V2 usa:

- `guardian_nodes` — nodos autenticados y último heartbeat;
- `guardian_master_lease` — singleton de Master Guardian con `epoch` y expiración;
- `guardian_signals` — mailbox efímero de signaling WebRTC.

Los RPCs `guardian_*` derivan identidad de `auth.uid()`. Las tablas tienen RLS habilitado y no se exponen para escritura directa a `authenticated`; el cliente opera mediante RPCs `security definer` estrechos y validados.

### Kelo Guardian Coordinator — scheduler/proof

El coordinador mantiene en memoria:

- nodos activos de su fallback/observación;
- capacidades y preferencias saneadas;
- readiness roles;
- observaciones confiables de red/carga;
- demanda regional;
- workload leases activos;
- Verified Service Units y contadores de servicio por nodo.

La persistencia histórica del scheduler/reputation/rewards sigue pendiente. El control plane WebRTC sí tiene persistencia propia en Supabase.

## Readiness roles

`recommendedRoles(...)` puede declarar:

- `witness-ready`;
- `asset-seeder-ready`;
- `relay-ready`;
- `compute-candidate`;
- `host-ready` en el coordinator server-side.

Readiness **no significa asignación**. El scheduler debe elegir un workload y emitir una lease.

## Workload types V2

Contratos preparados:

- `primary-host`
- `hot-mirror`
- `relay`
- `asset-seeder`
- `compute-worker`
- `witness`

Cada assignment tiene `id`, `type`, `region`, `purpose`, `epoch`, `assignedAt`, `expiresAt` y costo de capacidad.

Weights actuales de scheduling:

```text
primary-host   1.00
hot-mirror     0.65
compute-worker 0.80
relay          0.40
asset-seeder   0.25
witness        0.15
```

Son pesos de admisión/scheduling, no porcentajes físicos exactos.

## Observaciones regionales confiables

`observe(ref, observation)` es server-internal. Puede registrar región, RTT, RTT por región, packet loss, upload observado, CPU load, tick Hz, conexiones, fuente y fecha. El cliente no convierte un dato autodeclarado en autoridad o recompensa.

`setRegionalDemand(region, pressure)` acepta presión `0..1` desde un proceso confiable. Foundation V2 usa un multiplicador de demanda `1.00 → 1.75`.

## Scheduler

APIs server-internal:

- `planWorkload(input)` — ranking sin mutar;
- `assignWorkload(input)` — asigna al mejor candidato elegible;
- `acknowledgeWorkload(ref, workloadId, observation?)` — renueva lease;
- `releaseWorkload(workloadId)` — libera y cuenta workload completado;
- `planSupport(input)` — recomienda ayuda según presión.

El score puede considerar frescura, readiness, carga asignada, foreground/charging/save-data, CPU/memory, región, RTT, packet loss, tick quality y upload.

El planner conceptual es:

```text
upload/loss alto → RELAY
CPU alto o tick bajo → PRIMARY spillover + HOT MIRROR
presión regional alta → PRIMARY regional
```

El planner no mueve gameplay por sí solo. El handoff autoritativo futuro debe consumir el plan de forma segura.

## Verified Service Units

Tipos foundation:

- `availability_seconds`;
- `host_seconds`;
- `mirror_seconds`;
- `relay_megabytes`;
- `asset_megabytes`;
- `compute_seconds`.

`recordVerifiedContribution(ref, proof)` es server-internal. No existe endpoint para que un cliente se autoasigne monedas.

Rates foundation:

```text
availability_seconds = 0.002 unit/s
host_seconds         = 0.200 unit/s
mirror_seconds       = 0.100 unit/s
relay_megabytes      = 0.500 unit/MB
asset_megabytes      = 0.250 unit/MB
compute_seconds      = 0.150 unit/s
```

Rangos:

| Rank | Verified units | Multiplicador |
|---|---:|---:|
| Helper | 0 | ×1 |
| Guardian | 1,000 | ×1.25 |
| Sentinel | 10,000 | ×1.5 |
| Warden | 50,000 | ×2 |
| Pillar of Kelo | 250,000 | ×3 |

El cálculo foundation es `raw verified units × regional demand × rank multiplier`.

### Invariante económica

`recordVerifiedContribution(...)` devuelve `kcMinted: 0`. Guardian **no acuña KC**. Cualquier settlement futuro debe entrar por la autoridad económica normal con caps, persistencia y anti-abuso.

## API pública cliente

`KeloGuardian`

- `state()`
- `activate()` / `deactivate()` / `toggle()`
- `refresh()` / `heartbeat()`
- `startMasterHost()` / `stopMasterHost()`
- `updatePreferences(next)`
- `capabilities()`
- `transport()` — estado del enlace P2P
- `sendToMaster(message)` — payload no autoritativo al Master si el DataChannel está abierto
- `broadcast(message)` — Master → peers abiertos

`KeloGuardianAuthority`

- `status(nodeId)`
- `enable(payload)` / `heartbeat(payload)` / `disable(payload)`
- `startMaster(payload)` / `stopMaster(payload)`
- `sendSignal(payload)`
- `pollSignals(nodeId)`

No se añaden endpoints públicos de reward/workload.

## Control plane Supabase

Flujo primario:

```text
KeloGuardian
  → KeloGuardianAuthority
    → Supabase Auth + RPC
      ├→ guardian_nodes
      ├→ guardian_master_lease
      └→ guardian_signals
```

El fallback HTTP del servidor actual se conserva únicamente para operaciones V1 cuando los RPCs no existen en otro entorno. El signaling WebRTC V2 usa Supabase y no necesita Render.

RPCs principales:

- `guardian_enable`
- `guardian_heartbeat`
- `guardian_disable`
- `guardian_status`
- `guardian_master_start`
- `guardian_master_stop`
- `guardian_signal_send`
- `guardian_signal_poll`

## Data plane WebRTC

Cuando existe un Master:

```text
Nodo Guardian
   │ offer/ICE vía Supabase
   ▼
Master Guardian
   │ answer/ICE vía Supabase
   ▼
WebRTC DTLS DataChannel directo
```

Reglas actuales:

1. Un nodo normal inicia conexión únicamente al Master vigente.
2. El Master acepta offers de nodos activos.
3. Supabase permite signaling solo si uno de los extremos es el Master de la lease vigente.
4. Signals expiran y se consumen una sola vez.
5. Cambio de `masterEpoch` invalida peers anteriores.
6. El canal usa `hello`, `hello_ack`, `ping` y `pong` para presencia/RTT.
7. Mensajes de extensión se emiten como `kelo:guardian-data` con `authoritative:false`.
8. No existe `setInterval` Guardian: heartbeat, polling, conexión y ping se throttlean desde `KeloSimulation.after('guardian:runtime', ...)`.

V2 usa STUN para conexión directa. **TURN/relay real todavía está pendiente**, así que ciertas combinaciones NAT/red móvil pueden no conectar directamente.

## Flujo de jugador

1. El jugador abre **🛡 GUARDIAN** y lo enciende.
2. `KeloGuardian` persiste la preferencia y registra el nodo por Supabase RPC.
3. Heartbeats mantienen disponibilidad y, si corresponde, la lease Master.
4. El nodo descubre el Master vigente.
5. Si WebRTC está disponible, negocia el DataChannel mediante el mailbox Supabase.
6. Si el runtime se suspende y deja de latir, la lease expira.
7. Al volver, Guardian puede registrarse/reconectarse automáticamente mientras el opt-in siga activo.

## Host máster e iPhone

El botón Master no se desbloquea con flags locales. Se exige rol `admin` o permiso `guardian.master_host` / `guardian.master-host`.

El botón **USAR ESTE IPHONE COMO SERVER** ahora puede convertir el iPhone en el extremo Master de conexiones WebRTC directas mientras Kelo World permanece activo. Eso **no** significa todavía que Safari ejecute el proceso Node ni la simulación autoritativa completa.

`backgroundContinuousGuaranteed = false`. Si iOS suspende Kelo World, cesa el heartbeat, expira la lease y los peers deben renegociar con el siguiente Master.

## Seguridad y autoridad

Invariantes:

1. UI no concede permisos Master.
2. `nodeId` no identifica cuenta; Auth/JWT lo hace.
3. Lease Master se decide en autoridad remota, nunca en localStorage.
4. Signaling conecta únicamente pares válidos alrededor del Master vigente.
5. WebRTC usa DTLS, pero un host comunitario sigue siendo no confiable para economía/PvP hasta implementar verificación/hot mirror.
6. Métricas declaradas por cliente no acuñan rewards.
7. Observaciones de scheduling/reward son server-internal.
8. Guardian no acuña KC.
9. `kelo:guardian-data` es explícitamente no autoritativo.
10. No existe segundo WebSocket de gameplay ni segundo simulation loop.

## Qué ya funciona sin Render

Mientras Supabase esté disponible, Guardian puede:

- registrar/desregistrar nodos;
- mantener heartbeats;
- elegir/renovar Master;
- descubrir Master/epoch;
- señalizar WebRTC;
- abrir DataChannels directos;
- intercambiar mensajes Guardian no autoritativos;
- medir RTT y bytes locales.

## Qué todavía depende del servidor Node actual

Antes de apagar Render para gameplay falta migrar:

- transporte de `KeloNetAuthority` al backend Guardian sin crear un segundo owner;
- `server/pvp-authority.js` / fixed-step competitivo;
- AOI y snapshots de jugadores;
- economía/forge/commerce/titles autoritativos que hoy resuelve Node;
- hot mirror + snapshot/input replication + takeover real;
- TURN/relay comunitario o fallback equivalente;
- persistencia histórica del scheduler/reputation;
- settlement Verified Service Units → KC por autoridad económica.

Por tanto, V2 **saca a Render del camino de coordinación P2P de Guardian**, pero todavía no sustituye Render para todo Kelo World.

## Siguiente frontera correcta

La próxima migración debe pasar por el owner existente `KeloNetAuthority`: extraer un contrato host/simulación transport-agnostic manteniendo el mismo protocolo de intents/snapshots. El mismo core autoritativo debe poder ejecutarse detrás de Node o de un runtime Guardian compatible; no se crea un segundo engine.

## QA

- `node scripts/guardian-system-audit.mjs`
- `npm run audit:docs`
- migración Supabase `20260914052544_guardian_webrtc_control_plane_v2` aplicada en el proyecto de Kelo World.

El audit cubre scheduler/proof/leases y además exige signaling RPC versionado, RLS, DataChannel WebRTC, ausencia de `setInterval` Guardian y ausencia explícita de autoridad gameplay cliente.
