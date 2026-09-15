# Kelo World — Regional Economy & Logistics Foundation V1

## Propósito

Esta foundation conecta economía regional, reservas reales, contratos de abastecimiento, riesgo logístico, carretas físicas, facciones y clanes sin crear sistemas paralelos. El ciclo central es:

`escasez → contrato → presión regional → distancia económica → riesgo → margen → transporte → PvP/PvE → entrega/robo → reservas → precio`.

El objetivo arquitectónico es que el riesgo del mapa se convierta automáticamente en oportunidad económica. No existe un `if (rutaPeligrosa) bonus += X`: el riesgo aumenta la **distancia económica**, eso atenúa la propagación de demanda hacia el mercado origen y deja un margen mayor entre origen y destino.

## REUSE MAP

### REUTILIZAR

- `KeloEvents` — bus semántico existente.
- `KeloContainers` — único owner de inventarios/contenedores físicos.
- `STATE/saveState` — persistencia local actual.
- `KeloMovement` — hook de seguimiento físico de carretas.
- `KeloRender` + `KeloCamera` — presentación física de carretas, sin otro render loop.
- `KeloCombatEngine` — validación de ataque; consulta la restricción pública de carretas.
- `KeloNetAuthority` — futura frontera de transporte server-authoritative.
- Backpack — permanece como `STATE.inventory` detrás de `KeloContainers`.
- Commerce existente — continúa siendo owner de trade jugador↔jugador, stalls y market escrow; la economía regional no lo reemplaza.

### EXTENDER

- `KeloContainers` se extiende con `dynamicContainers`, `registerContainer`, `removeContainer`, `getContainer` y extracción parcial. Una carreta referencia un container; no posee otro motor de inventario.
- `KeloCombatEngine` consulta `KeloCaravans.canActorAttack()` para bloquear el ataque básico/melee mientras una carreta está `ATTACHED`.
- Persistencia local incorpora `STATE.regionalEconomy`, `STATE.caravans`, `STATE.socialGroups` y `STATE.dynamicContainers`.

### CREAR

Solo se crean capacidades sin owner apropiado previo:

- `KeloRegionalEconomyMath` — matemática pura/determinista de riesgo, distancia económica y atenuación.
- `KeloRegionalEconomy` — reservas/producción/pricing/contracts/route events.
- `KeloCaravans` — lifecycle físico y posesión/control de carretas.
- `KeloFactions` — facciones, clanes, roles y permisos.
- `KeloLogisticsDevtools` — observabilidad y simulación delegando en los owners anteriores.

No se crean `EconomyManager2`, `InventoryV2`, otro EventBus, otro render loop ni otro combat engine.

---

## OWNER MAP

| Capacidad | Owner | Archivo |
|---|---|---|
| Matemática económica/riesgo | `KeloRegionalEconomyMath` | `src/systems/regional-economy-math.js` |
| Economía regional, stock, contratos, rutas | `KeloRegionalEconomy` | `src/systems/regional-economy-system.js` |
| Inventarios/contenedores | `KeloContainers` | `src/systems/container-system.js` |
| Carretas físicas | `KeloCaravans` | `src/systems/caravan-system.js` |
| Facciones/clanes | `KeloFactions` | `src/systems/faction-clan-system.js` |
| Debug de logística | `KeloLogisticsDevtools` | `src/systems/logistics-devtools.js` |
| Trade/stalls/market escrow | `KeloCommerceAuthority` | `src/systems/commerce-authority.js` |
| Ataque melee/basic | `KeloCombatEngine` | `src/systems/combat/combat-engine.js` |

**DO NOT CREATE PARALLEL SYSTEMS. EXTEND THE EXISTING OWNER.**

---

# 1. Recursos y pueblos

## ResourceDefinition

V1 registra cinco recursos demo: `apple`, `coal`, `wood`, `iron`, `stone`. Cada definición contiene:

- `id` estable;
- `category`;
- `baseValue`;
- `weight`;
- `stackSize`;
- `metadata`.

El tier no se hardcodea por resourceId. La foundation usa T1–T4 como tabla data-driven con multiplicadores de valor.

## SettlementDefinition

V1 incluye tres pueblos demo:

- `ignis` — especializado en carbón;
- `verdantia` — especializado en manzana/madera;
- `ferrum` — especializado en hierro/piedra.

Cada definición describe:

- `specializations`;
- `productionRates` por hora;
- `qualityDistribution` por recurso/default;
- `reserveCapacity`;
- `metadata`.

La especialización emerge de esos datos: mayor `productionRate`, mejor distribución de tiers y capacidad adecuada. No hay ramas `if(resource === 'coal')` en la lógica económica.

---

# 2. Reservas reales y producción lazy

Cada settlement mantiene en `STATE.regionalEconomy.settlements`:

- `stock[resourceId]`;
- `tierStock[resourceId][tier]`;
- `lastUpdatedAt`;
- `revision`.

La producción no usa timers por pueblo/recurso. Se calcula cuando el owner necesita refrescar el pueblo:

`produced = hourlyRate × elapsedHours`

Después se limita por `reserveCapacity`. El mismo cálculo puede ejecutarse más adelante en servidor.

Invariante:

`stock nuevo = stock anterior + producción + ventas/entregas - compras`.

No existe inventario infinito de NPC.

---

# 3. Scarcity pricing y MarketQuote

Las bandas configuradas en V1 son `ABUNDANT`, `NORMAL`, `SCARCE`, `CRITICAL` y `EMERGENCY`. Los thresholds y multiplicadores viven en configuración, no en condicionales por recurso.

`KeloRegionalEconomy.quote(settlementId, resourceId, tier)` devuelve:

- stock y capacidad;
- reserve ratio;
- scarcity band;
- precio unitario;
- breakdown:
  - `base`;
  - `scarcity`;
  - `regionalDemand`;
  - `tierMultiplier`;
  - `other`;
  - `total`;
- fuentes de presión regional y su distancia económica.

Esto hace explicable por qué un precio vale X.

---

# 4. Supply Contracts

Cuando un recurso atraviesa `emergencyThreshold`, el owner crea automáticamente un contrato persistente:

- `id`;
- `settlementId`;
- `resourceId`;
- `minimumTier`;
- `requestedQuantity`;
- `remainingQuantity`;
- `currentReward`;
- `status`;
- `createdAt` / `updatedAt`;
- `expiresAt` preparado;
- `revision`.

`DeliverSupplyContract` extrae el recurso real del Backpack mediante `KeloContainers`, aumenta la reserva real del settlement, reduce `remainingQuantity` y paga oro desde la autoridad local offline. Si algo falla, el container checkpoint permite rollback.

A medida que sube el reserve ratio, `currentReward` baja. Al recuperar `contractCloseRatio` o agotar la cantidad pendiente, el contrato pasa a `COMPLETED`.

---

# 5. Route Graph, Logistic Risk y Economic Distance

Cada `RouteEdge` V1 describe:

- `from`, `to`;
- `travelTime`, `distance`;
- `pvpExposure`;
- `terrainDanger`;
- `chokePointRisk`;
- `npcThreat`;
- `eventRisk`;
- `ambushNodes`.

`KeloRegionalEconomyMath.riskBreakdown()` normaliza esos factores con pesos configurables a un score 0..1.

El coste económico de una arista es:

`base travel cost × (1 + risk × riskMultiplier)`.

La ruta entre dos mercados se obtiene con Dijkstra sobre ese coste. Por tanto el sistema compara la relación económica entre mercados, no los pasos exactos que decidió caminar un jugador. Tomar deliberadamente un rodeo no crea recompensa.

---

# 6. Cómo riesgo se convierte en margen

Un contrato urgente crea presión de demanda en mercados de origen. Esa presión se atenúa exponencialmente con la distancia económica:

`propagatedPressure = destinationPressure × exp(-economicDistance / decay)`.

Consecuencia:

- ruta fácil → menor economic distance → más presión propagada → precio origen más alto → margen menor;
- ruta peligrosa → mayor economic distance → menos presión propagada → precio origen más bajo → margen mayor.

El destino no “regala” un bonus por haber sido atacado. El beneficio aparece porque el mercado remoto/peligroso queda económicamente más desconectado.

---

# 7. RaiderBand y AmbushNodes

Las rutas contienen IDs de `ambushNodes`. `ActivateRaiderBand` crea un route event persistente con:

- `routeId`;
- `ambushNodeId`;
- `npcThreat` modifier;
- `eventRisk` modifier;
- estado, timestamps y revision.

Mientras el evento está activo, `effectiveRoute()` suma esos modificadores y el score/routing económico cambia automáticamente. Al terminar el evento se restablece el riesgo base.

El hook de IA de carretas es `KeloCaravans.raiderShouldAggro(entity)`. Solo responde a la existencia de una carreta/transportista; no inspecciona contenido ni valor.

La spawning/AI visual de una banda completa debe entrar después por el owner NPC existente, usando estos `ambushNodeId`; no se crea un segundo NPC engine en esta foundation.

---

# 8. Carretas físicas

`KeloCaravans` mantiene entidades persistentes con:

- `id`;
- `typeId`;
- `inventoryId`;
- `worldId` / `zoneId`;
- `position`;
- `owner`;
- `currentControllerId`;
- `state`;
- `claim`;
- `metadata`;
- `revision`.

Estados V1: `PARKED`, `ATTACHED`, `DROPPED`, `CLAIMING`, `DESTROYED`.

La carga vive exclusivamente en un dynamic container de `KeloContainers`.

## ATTACHED

- sigue físicamente al controller mediante `KeloMovement.after`;
- permanece visible mediante `KeloRender.afterFrame`;
- no puede iniciar claim otro actor;
- `KeloCaravans.canActorAttack(controllerId) === false`;
- recibir daño no desengancha la carreta;
- `combat:entity_killed` abandona la carreta en el mundo.

## DROPPED / CLAIMING

- un actor puede empezar claim;
- `claimDurationMs` vive en CartType;
- el claim se interrumpe por eventos de daño;
- completarlo cambia `currentControllerId`, no `owner`.

Esto permite que una carreta propiedad de PLAYER/CLAN/FACTION esté controlada temporalmente por un enemigo.

---

# 9. Información oculta

`KeloCaravans.inspectCart(cartId, viewerId)` aplica autorización por owner:

- PLAYER → owner player;
- CLAN → miembro del clan;
- FACTION → miembro de la facción.

Un viewer no autorizado recibe `cargoVisible: false` y `cargo: 'UNKNOWN'`. No recibe items, cantidades ni valor.

`metadata` reserva hooks baratos para sealed cargo/scouting/decoys sin implementar esas mecánicas todavía.

---

# 10. Factions + Clans

`KeloFactions` usa definiciones data-driven. Por defecto hay dos facciones demo, pero el engine no asume `2`. Antes del script puede declararse `window.KELO_FACTION_DEFINITIONS = [...]` con cualquier N de definiciones válidas y la misma lógica funciona sin cambios.

Cada membership contiene `playerId`, `factionId`, `reputation`, `joinedAt`, `revision`.

Cada clan contiene:

- `id`;
- `factionId` obligatorio;
- `name`, `tag`;
- `leaderId`;
- roles;
- members;
- metadata;
- `createdAt`;
- `revision`.

Roles por defecto: `Leader`, `Officer`, `Member`.

Permisos preparados:

- `INVITE_MEMBER`;
- `KICK_MEMBER`;
- `MANAGE_ROLES`;
- `MANAGE_CARAVANS`;
- `MANAGE_TREASURY`;
- `DECLARE_WAR`;
- `MANAGE_TERRITORY`.

No se implementan todavía banking/war/territory/alliances. Solo existen hooks de identidad/permisos.

---

# 11. Ownership model

Formato compartido:

```js
{ type: 'PLAYER' | 'CLAN' | 'FACTION', id: 'stable-id' }
```

`owner` es distinto de `currentControllerId`. Nunca deducir ownership de quién está moviendo el objeto.

---

# 12. Commands y autoridad

UI futura debe enviar intenciones a los owners:

### Economy

- `BuyResource`
- `SellResource`
- `DeliverSupplyContract`
- `ActivateRaiderBand` / `EndWorldEvent` para world authority/dev

### Caravans

- `AttachCart`
- `DetachCart`
- `BeginClaimCart`
- `CompleteClaimCart`
- `LoadCart`
- `UnloadCart`

### Factions/Clans

- `JoinFaction`
- `LeaveFaction`
- `CreateClan`
- `JoinClan`
- `LeaveClan`
- `SetClanRole`

Hoy esas requests usan autoridad local. Cuando `KeloNetAuthority.isOnline()` es true, **no hay fallback local silencioso**: cada owner exige su server bridge o devuelve un error de bridge no disponible.

---

# 13. Eventos

Economy:

- `regional-economy:settlement-stock-changed`
- `regional-economy:market-price-changed`
- `regional-economy:supply-contract-created`
- `regional-economy:supply-contract-updated`
- `regional-economy:supply-contract-completed`
- `regional-economy:raider-ambush-started`
- `regional-economy:raider-ambush-ended`
- `regional-economy:route-risk-changed`

Caravans:

- `caravans:cart-attached`
- `caravans:cart-detached`
- `caravans:cart-claimed`
- `caravans:cart-abandoned`
- `caravans:cart-claim-started`
- `caravans:cart-claim-interrupted`
- `caravans:cart-cargo-changed`

Factions:

- `factions:membership-changed`
- `factions:clan-created`
- `factions:clan-member-joined`
- `factions:clan-member-left`
- `factions:clan-role-changed`

---

# 14. Persistencia

Offline usa el save existente. Nuevas ramas de estado:

- `STATE.regionalEconomy`;
- `STATE.caravans`;
- `STATE.socialGroups`;
- `STATE.dynamicContainers`.

Los objetos valiosos usan IDs estables y `revision` donde el sync futuro lo necesita.

---

# 15. Debug / Devtools

`KeloLogisticsDevtools.snapshot()` muestra:

- settlement stock;
- production profile;
- quote breakdown;
- contracts;
- route risk/economic distance;
- world events;
- carts/controller/owner/cargo autorizado;
- container identity audit;
- factions/clans/roles.

`KeloLogisticsDevtools.run(command, payload)` permite simular stock bajo, horas transcurridas, Raiders, compra/venta/entrega, attach/drop/claim/load/unload, faction y clan sin editar código.

---

# 16. Cómo extender

## Añadir recurso

Agregar una `ResourceDefinition` y datos de producción/capacidad para settlements. No añadir ramas por `resourceId` al engine.

## Añadir tier

Extender la tabla de tiers/multipliers y quality distributions. No duplicar pricing.

## Crear pueblo

Agregar `SettlementDefinition` con rates/quality/capacity y conectar el settlement al route graph.

## Cambiar especialización

Modificar únicamente `specializations`, `productionRates`, `qualityDistribution` y/o `reserveCapacity`.

## Añadir ruta/riesgo

Agregar `RouteEdge` con factores normalizados. El mismo graph alimenta economic distance y demand propagation.

## Crear AmbushNode

Registrar su ID en la route definition y hacer que el sistema de mundo/NPC existente conozca la posición física correspondiente.

## Crear CartType

Añadir una definición con slots, peso, claim duration y rango. La carga seguirá usando `KeloContainers`.

## Añadir facción

Declarar otra definición en `KELO_FACTION_DEFINITIONS`; no tocar lógica de membership/clans.

## Añadir permiso/rol

Extender las definiciones de permisos/roles del owner; los consumidores consultan `hasPermission()`.

---

# 17. Performance

- cero timers por recurso/settlement;
- producción por elapsed time;
- pricing bajo demanda;
- rutas calculadas sobre graph pequeño y solo cuando se consulta/afecta;
- eventos de ruta modifican únicamente aristas afectadas;
- no hay scans por frame de economía;
- movimiento/render de cart solo itera entidades cart actuales;
- `dynamicContainers` evita engines de inventario por tipo de entidad.

La siguiente optimización natural al crecer a muchos settlements es cachear shortest paths por `route graph revision` e invalidar por `routeRiskChanged`; el contrato API ya permite hacerlo sin cambiar consumidores.

---

# 18. Online Migration Contract

La UI futura debe permanecer idéntica:

`UI → owner.request(command) → LocalAuthority → Domain`

se convierte en:

`UI → owner.request(command) → KeloNetAuthority bridge → ServerAuthority → mismo Domain contract`.

El servidor debe ser autoridad final de:

- oro;
- stock y producción timestamps;
- contratos/rewards;
- route events/risk authoritative inputs;
- cart position/state/claim/controller/owner;
- cargo/inventory;
- faction membership;
- clan roster/roles.

El cliente nunca debe enviar como verdad el resultado económico, precio final, reward, cargo o ownership; solo intención + IDs + revision/idempotency key cuando se añada el transporte final.

---

# 19. Tests

`npm run audit:logistics` valida, entre otros:

- producción lazy;
- especialización/tier distribution;
- buy/sell stock del settlement;
- scarcity pricing y breakdown;
- contrato automático;
- entrega real y reward decreciente;
- cierre por recuperación;
- demand propagation;
- risk → economic distance → mayor margen;
- RaiderBand modifica/restaura riesgo;
- cart attach/drop/claim/death;
- carga oculta;
- owner/controller separados;
- persistencia serializable;
- faction + clan + permisos;
- combat melee bloqueado al carrier attached;
- identidad única entre containers.

Workflow: `.github/workflows/regional-logistics-ci.yml`.

---

# 20. Deuda técnica explícita

1. El NPC AI owner debe consumir `ambushNodes`/`raiderShouldAggro()` para materializar bandas de saqueadores reales; V1 ya conecta su efecto económico y contrato de aggro, pero no crea un segundo AI system.
2. `KeloCombatEngine` bloquea melee/basic mientras ATTACHED. El runtime de habilidades todavía necesita consumir el mismo `canActorAttack()` como policy antes de que habilidades ofensivas puedan declararse completamente bloqueadas bajo carreta.
3. No hay UI player-facing nueva para settlements/contracts/factions/clans; V1 es domain foundation + devtools. La futura UI debe ser consumidora de `request()/snapshot()`, nunca owner.
4. Al escalar a cientos de settlements/rutas conviene cachear shortest paths por graph revision.
5. El server bridge final (`requestRegionalEconomy`, `requestCaravan`, `requestFactionClan`) aún debe implementarse en transporte/backend; online no cae a local silenciosamente.

Estas deudas no justifican crear sistemas paralelos.
