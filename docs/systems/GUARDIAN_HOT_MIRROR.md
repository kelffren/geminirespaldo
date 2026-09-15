# Kelo World — Guardian Hot Mirror V1

## Propósito

`KeloGuardianMirror` añade una capa de continuidad al Guardian Network ya existente. Mientras un dispositivo tiene la lease `master-host`, publica por el **DataChannel WebRTC de `KeloGuardian`** checkpoints pequeños del estado que ese cliente ha observado desde `KeloNetAuthority`. Los Guardian conectados conservan la copia más reciente y responden con ACK.

El objetivo de esta fase es que un segundo donador **ya tenga una semilla de recuperación antes de que el Master desaparezca**, en lugar de empezar a buscar estado después del fallo.

Esta fase no convierte el navegador en servidor autoritativo de PvP. Es una fundación de recuperación/control plane sobre el transporte Guardian existente.

## Owner y archivos

- Owner: `KeloGuardianMirror`.
- Source: `src/systems/guardian-hot-mirror.js`.
- Transporte consumido: `KeloGuardian` / DataChannel `kelo-guardian`.
- Estado observado: `KeloNetAuthority`, `window.keloNet` y `KELO_PVP_NET_AUDIT`.
- Boot actual: `src/ui/guardian-ui.js` carga el support module al iniciar el runtime Guardian. La UI no modifica el estado del mirror.
- UI consumidora: `src/ui/guardian-ui.js`.
- QA: `scripts/guardian-system-audit.mjs`.

## Estado que posee

`KeloGuardianMirror` posee únicamente estado efímero de continuidad:

- secuencia de checkpoint;
- último checkpoint aceptado;
- historial acotado de checkpoints recientes;
- ACKs recientes recibidos por el Primary;
- último Master observado;
- estado de candidatura/reintento de failover;
- `takeoverSeed` conservada después de obtener una nueva lease Master;
- diagnósticos/errores propios.

## Estado que NO posee

No posee ni puede mutar de forma autoritativa:

- HP o daño;
- inventario;
- KC/oro/monedas;
- mercado;
- propiedades;
- resultados PvP;
- identidad de cuenta;
- decisiones de `server/pvp-authority.js`;
- persistencia económica.

El checkpoint es **recovery data no confiable para autoridad gameplay**, aunque se construya a partir de datos previamente observados desde el servidor.

## Contrato del checkpoint

Mensaje P2P:

```text
guardian:mirror_checkpoint
```

Incluye de forma acotada:

- `schema`;
- `seq`;
- `epoch` y `masterNodeId`;
- `generatedAt`;
- `serverTick` observado;
- `lastPvpAck` observado;
- modo `world` / `pvp`;
- actor local público;
- peers AOI observados, con límite;
- proyectiles observados, con límite.

El payload se limita a menos del límite del DataChannel Guardian (`MAX_CHECKPOINT_BYTES = 56 KiB`). Si crece demasiado, primero se eliminan proyectiles y después peers hasta volver al límite.

No se copian tokens, JWT, secretos, inventarios completos ni datos privados de cuenta.

## Flujo Primary → Mirrors

1. `KeloGuardian` mantiene el DataChannel P2P existente.
2. Si el nodo actual es `master-host`, `KeloGuardianMirror` genera como máximo un checkpoint cada 750 ms.
3. Usa `KeloGuardian.broadcast(...)`; no crea socket, canal ni transporte nuevo.
4. Un nodo receptor solo acepta el checkpoint cuando:
   - el remitente coincide con el Master vigente;
   - el `epoch` coincide;
   - la secuencia avanza;
   - el payload está dentro del límite.
5. El mirror guarda la copia y responde:

```text
guardian:mirror_ack
```

6. El Primary mantiene una lista efímera de backups que están confirmando checkpoints. ACKs viejos expiran.

## Failover de lease

Cuando un mirror autorizado deja de tener conexión P2P con el Master:

1. conserva el último checkpoint durante una ventana de recuperación acotada;
2. espera un pequeño margen para evitar reaccionar a microcortes;
3. únicamente si `KeloGuardian.state().masterEligible === true` y la app está visible, intenta `KeloGuardian.startMasterHost()`;
4. la autoridad remota de Guardian decide si la lease puede cambiar;
5. mientras el Master anterior siga siendo válido, el intento puede devolver `GUARDIAN_MASTER_BUSY` y se reintenta de forma limitada;
6. cuando obtiene la lease, conserva el checkpoint como `takeoverSeed` y emite `kelo:guardian-mirror-takeover`;
7. publica `guardian:mirror_takeover` a los peers que estén disponibles.

La elección final **nunca** se decide solamente en JavaScript local. El cliente solo solicita la lease que ya protege `KeloGuardianAuthority`.

### Tiempo de relevo actual

El P2P puede detectar la pérdida antes, pero la lease remota actual tiene su propia expiración/heartbeat. Por eso esta V1 prepara y solicita el relevo, pero todavía no garantiza un cambio imperceptible en pocos cientos de milisegundos.

Reducir el tiempo de promoción exige una política remota de fast-failover validada contra falsos positivos/split-brain.

## API pública

`KeloGuardianMirror` expone:

- `state()` — diagnóstico inmutable;
- `latestCheckpoint()` — último checkpoint recibido;
- `history()` — historial acotado;
- `takeoverSeed()` — semilla conservada si este nodo consiguió la nueva lease.

`state()` informa, entre otros:

- `mode`: `off | standby | hot-mirror | primary`;
- `latestSeq`;
- `latestServerTick`;
- `checkpointAgeMs`;
- `checkpointFresh`;
- `backupCount`;
- `failoverCandidate`;
- `claimInFlight`;
- `takeoverSeedAvailable`;
- `authoritativeGameplay: false`.

## Eventos/hooks

Consume:

- `kelo:guardian-data`;
- `kelo:guardian-state`;
- `KeloSimulation.after('guardian:hot-mirror', ...)`.

Emite:

- `kelo:guardian-mirror-state`;
- `kelo:guardian-mirror-takeover`.

No usa `setInterval`. Reutiliza el owner de simulación para throttling, igual que Guardian V2.

## Dependencias permitidas

```text
KeloSimulation
     ↓
KeloGuardianMirror
     ↓
KeloGuardian → WebRTC DataChannel

KeloNetAuthority / keloNet
     ↓ lectura observada
checkpoint de recuperación
```

La dependencia es de lectura. `KeloGuardianMirror` no llama funciones internas de `engine-net.js` para modificar gameplay.

## Persistencia

No hay persistencia durable del checkpoint en V1. El historial vive en memoria del navegador.

Esto es intencional: el contenido todavía no se considera un snapshot autoritativo apto para restaurar economía/PvP después de reiniciar una aplicación.

## Invariantes

1. No hay segundo WebSocket.
2. No hay segundo DataChannel owner: usa `KeloGuardian`.
3. No hay segundo simulation loop.
4. Checkpoint nunca acuña KC.
5. Checkpoint nunca escribe HP/inventario/PvP en el runtime.
6. `epoch` debe coincidir con el Master vigente al recibir.
7. Solo un usuario server-eligible puede intentar promoción automática.
8. Obtener lease Master no equivale a obtener autoridad gameplay.
9. iOS background continuo sigue sin estar garantizado.

## Ejemplo correcto

```text
Kelo iPhone = PRIMARY Guardian
Andrea PC   = mirror conectado

KeloGuardianMirror(Kelo)
  → checkpoint #204 / observed serverTick 9120
  → KeloGuardian.broadcast

Andrea
  → valida Master + epoch
  → guarda #204
  → guardian:mirror_ack #204

Kelo pierde conexión
  → Andrea conserva #204
  → solicita nueva lease cuando es elegible
  → si authority remota aprueba: Andrea = nuevo Guardian Master
  → #204 queda como takeoverSeed
```

En esta fase el gameplay online central todavía continúa dependiendo del servidor Node; el ejemplo describe continuidad de la red Guardian, no una migración completa del PvP.

## Anti-patrones

No hacer:

- aplicar `checkpoint.self.hp` directamente a `localPlayer.hp` como verdad;
- restaurar oro/KC/inventario desde un checkpoint;
- permitir que cualquier donador se autoproclame Master;
- iniciar otro `RTCPeerConnection` dentro del mirror;
- crear otro `setInterval` para replicación;
- enviar el mundo entero sin límites;
- describir `takeoverSeed` como savegame autoritativo.

## Observabilidad

`KeloGuardianUI` muestra:

- peers P2P abiertos;
- RTT Guardian;
- `PRIMARY / HOT MIRROR / STANDBY`;
- cantidad de mirrors con ACK;
- estado de failover;
- checkpoint/tick observado cuando está fresco.

`KELO_GUARDIAN_MIRROR_AUDIT` declara explícitamente:

```text
automaticMasterClaim = true
authoritativeGameplay = false
clientGameplayAuthority = false
economyAuthority = false
secondLoop = false
```

## Tests / CI

`npm run audit:guardian` valida estáticamente:

- mensajes checkpoint/ACK/takeover;
- uso del DataChannel Guardian existente;
- hook de `KeloSimulation`;
- ausencia de `setInterval`;
- promoción mediante `startMasterHost()`;
- ausencia de escrituras de KC/HP desde el checkpoint;
- UI en modo read-only para mirror;
- `authoritativeGameplay:false`.

El mismo audit conserva las pruebas del scheduler, regiones, workloads, Proof of Useful Service, ranks ×2/×3 y signaling WebRTC V2.

## Deuda conocida / siguiente frontera

Pendiente para convertir el relevo en **servidor gameplay real**:

1. extraer de `server/pvp-authority.js` un core determinista browser/runtime-compatible;
2. definir `exportSnapshot()/importSnapshot()` autoritativos con schema/version/hash;
3. replicar input log además del snapshot observado;
4. exigir lease de workload `hot-mirror`/`primary-host` del coordinator;
5. añadir witness/quorum para proteger contra split-brain;
6. implementar fast-failover remoto con umbral de heartbeat probado;
7. validar TURN/relay para NAT donde P2P directo falle;
8. validar takeover real con dos dispositivos y pérdida forzada del Primary.

Hasta completar esos puntos, Guardian Hot Mirror mejora la **preparación de continuidad**, no reemplaza el servidor autoritativo Node.

## Checklist para extender

Antes de añadir otra capacidad Guardian:

- ¿se reutiliza `KeloGuardian` para transporte?
- ¿el nuevo estado tiene owner único?
- ¿la autoridad remota sigue decidiendo lease/permiso?
- ¿los datos del cliente son tratados como no confiables?
- ¿hay límites de tamaño/frecuencia?
- ¿evita `setInterval`/loops paralelos?
- ¿economía/PvP siguen fail-closed?
- ¿el audit distingue claramente implementado vs pendiente?
