# Kelo World — Commerce System V1

## Propósito

Commerce unifica todo movimiento valioso de Oro, objetos y ownership comercial bajo una sola frontera. El mismo frontend funciona en dos modos:

- **offline:** adapter local para desarrollo y pruebas;
- **online:** servidor autoritativo mediante el WebSocket existente.

No existe un TradeEngine paralelo ni un segundo MarketEngine. Trade directo, puestos y compras terminan en el mismo owner de Commerce.

## OWNER y archivos principales

- **OWNER cliente / frontera de intents:** `window.KeloCommerceAuthority` — `src/systems/commerce-authority.js`.
- **OWNER server de comercio:** `CommerceService` — `server/commerce-store.js`.
- **Fuente económica server compartida:** `PlayerEconomyStore` — `server/player-economy-store.js`.
- **Forge consumidor del mismo saldo:** `server/forge-store.js`.
- **Movimiento físico offline:** `window.KeloContainers` — `src/systems/container-system.js`.
- **Escrow de publicaciones offline:** `window.KeloMarketEscrow` — `src/systems/market-escrow-system.js`.
- **Zona visual:** `window.KeloMarketWorld` — `src/instances/market-instance.js`.
- **UI:** `window.KeloCommerceUI` — `src/ui/commerce-ui.js`.
- **Transporte:** `window.KeloNetAuthority.requestCommerce()` — `engine-net.js` → `server/index.js`.

## Regla de autoridad

La UI jamás transfiere Oro u objetos directamente.

```text
UI
  ↓ intent
KeloCommerceAuthority
  ↓
local adapter  OR  KeloNetAuthority
                     ↓
               commerce:request
                     ↓
               CommerceService
                     ↓
             PlayerEconomyStore
```

Online, si `KeloNetAuthority.isOnline()` es verdadero, Commerce **no puede caer al adapter local**. El servidor decide saldo, ownership, reservas, sesiones, compras y commits.

## Estado que posee

### Offline

`KeloCommerceAuthority` conserva únicamente el estado necesario para la demo local: sesión de trade, claims/listings demo e historial acotado. Los objetos reservados usan contenedores explícitos.

### Online

`CommerceService` posee:

- sesiones de trade;
- estado `REQUESTED/OPEN/FINAL_REVIEW`;
- claims de puestos;
- listings y reservas;
- idempotencia de requests;
- coordinación del commit atómico.

`PlayerEconomyStore` es la única verdad server-side para:

- Oro;
- items/owner/container;
- reservas;
- historial económico.

Forge y Commerce consumen ese mismo store. No se permite otro ledger de Oro o inventario paralelo.

## API pública cliente

`KeloCommerceAuthority` mantiene:

- `request(op, payload)`;
- `snapshot()`;
- `getMode()`;
- `installAuthorityAdapter(adapter)`;
- helpers existentes de market/stall/trade.

`KeloCommerceUI` expone:

- `openTrade()`;
- `openTradeWithPlayer(peer)` — punto de integración para interacción con otro actor;
- `openMarket()` / `openStall()` / `openOwnStall()`;
- `enterMarket()` / `leaveMarket()`.

El contrato de `peer` para iniciar un trade online es estable y mínimo:

```js
KeloCommerceUI.openTradeWithPlayer({
  id: stablePlayerId,
  name: displayName
});
```

La UI no necesita conocer WebSocket, base de datos ni implementación del backend.

## Protocolo online

Mensajes existentes:

```text
client → commerce:request { requestId, op, payload }
server → commerce:result  { requestId, ...result, snapshot }
server → commerce:event   { reason, snapshot }
```

`engine-net.js` traduce estos mensajes al mismo `KeloCommerceAuthority`; no hay un transporte exclusivo de Trade.

## Flujo de trade jugador ↔ jugador

Online el handshake obligatorio es:

```text
A selecciona B
→ trade:request
→ REQUESTED
→ B recibe prompt
→ B trade:accept o trade:reject
→ OPEN
→ cada lado añade objetos/Oro
→ cada lado ready
→ FINAL_REVIEW
→ cada lado finalAccept
→ COMMIT ATÓMICO
```

### Seguridad de la solicitud

- Mientras el estado es `REQUESTED`, nadie puede editar la oferta.
- Solo el receptor puede `trade:accept` o `trade:reject`.
- La solicitud expira automáticamente.
- `trade:create` en el servidor es solo alias de compatibilidad de `trade:request`; **no abre un trade directamente** y no permite saltarse el consentimiento.
- El servidor puede inyectar `isPlayerOnline`, `listTradeCandidates` y `canTradePlayers` sin cambiar la UI ni el protocolo.

### Oferta y doble confirmación

- cada item queda reservado en `trade_escrow`;
- cada lado puede ofrecer Oro;
- cualquier mutación de objetos u Oro reinicia **ready y finalAccepted de ambos lados**;
- ambos deben llegar a `FINAL_REVIEW`;
- la primera aceptación final nunca ejecuta por sí sola;
- el commit ocurre únicamente cuando las dos aceptaciones finales están presentes.

## Commit atómico

El server usa `PlayerEconomyStore.transaction([playerA, playerB], ...)`.

Antes de transferir valida:

- ownership real;
- container `trade_escrow`;
- reservation + `tradeId`;
- saldo de ambos jugadores;
- sesión activa y doble aceptación.

Después mueve Oro y ownership en una sola transacción. Una excepción restaura el checkpoint de ambos jugadores. El cliente nunca intenta reconstruir un commit parcial.

## Idempotencia

`requestId` se cachea por jugador. Repetir la misma compra o comando por retry/doble tap devuelve el resultado anterior y no vuelve a debitar o duplicar assets.

Esto es obligatorio para móvil y redes inestables.

## Disconnect / cancel

Cancelar o desconectarse antes del commit:

- cancela la sesión;
- libera reservas;
- devuelve items de `trade_escrow` a `backpack`;
- notifica al otro participante mediante `commerce:event`.

Una vez comprometida la transacción, el snapshot server es la verdad y la UI solo refleja el resultado.

## Mercado y puestos

El Mercado conserva el mismo modelo:

1. entrar en `market:central-market`;
2. reclamar una alfombra/puesto;
3. activar modo vendedor si se desea;
4. publicar items desde la mochila;
5. comprador solicita `market:buy`;
6. server valida listing/saldo/reserva;
7. Oro + item se transfieren atómicamente.

La UI online obtiene los items publicables desde `snapshot.player.items`, nunca desde la mochila local. Offline reutiliza los contenedores actuales.

## Snapshot online

El snapshot de Commerce contiene, como mínimo:

```text
player.id / player.name / player.gold / player.items
activeTrade
tradeCandidates
marketListings
stalls
tradeHistory
transactionHistory
```

`activeTrade` siempre está normalizado desde la perspectiva del receptor del snapshot: `offers.local`, `offers.peer`, `participants.local`, `participants.peer`.

Durante una solicitud incluye además:

```text
requestDirection = incoming | outgoing
requestedBy
expiresAt
```

Esto permite que el mismo componente UI sirva a los dos jugadores.

## Plug-and-play de producción

La frontera ya está hecha. Para pasar de prototipo server a producción no se debe reescribir Trade ni Market UI.

Lo sustituible detrás del contrato es:

- autenticación real por cuenta/personaje;
- persistencia durable del `PlayerEconomyStore` (DB/Supabase/etc.);
- directorio de participantes/rango mediante `listTradeCandidates` + `canTradePlayers`;
- sharding/instancias;
- reconciliación/telemetría.

El `playerKey` actual del prototipo WebSocket **no debe considerarse autenticación de producción**. La autenticación final cambia la resolución de identidad server-side, no el contrato de Commerce.

## Invariantes

1. Una identidad de item vive en un solo owner/container.
2. `market_escrow` y `trade_escrow` tienen propósitos separados.
3. La UI no muta Oro, inventario ni ownership.
4. Online no tiene fallback local para operaciones valiosas.
5. Una solicitud debe aceptarse antes de editar ofertas.
6. Toda mutación reinicia las confirmaciones de ambos lados.
7. El trade requiere dos READY + dos final accepts.
8. Compra/trade son atómicos e idempotentes.
9. Forge y Commerce comparten una sola verdad económica.
10. Nuevas subastas/regalos deben reutilizar Commerce/PlayerEconomyStore, no crear otro ledger.

## Extension points

- `CommerceService({ isPlayerOnline, listTradeCandidates, canTradePlayers })` para presencia y política de distancia.
- `KeloCommerceAuthority.installAuthorityAdapter()` para reemplazar transporte sin tocar UI.
- nuevos `op` bajo Commerce para auction/gift/repair cuando realmente muevan ownership.
- nuevos mapas de mercado pueden consumir el mismo Commerce owner.

## Tests / CI

- `scripts/commerce-system-audit.js`: adapter offline, escrow, market, double confirmation y rollback.
- `scripts/server-commerce-audit.js`: economía compartida con Forge, compra idempotente, request/accept/reject, prevención de bypass por `trade:create`, policy hook de rango, ownership y disconnect cleanup.
- `scripts/live-commerce-audit.mjs`: recorrido móvil real en GitHub Pages del modo offline.
- `.github/workflows/market-ci.yml`: contrato de sintaxis/arquitectura/Commerce.

## Checklist para extender

1. ¿Mueve Oro/items/ownership? → Commerce.
2. ¿Necesita reserva? → escrow explícito.
3. ¿Puede fallar a mitad? → transacción/checkpoint.
4. ¿Es UI? → intent + snapshot solamente.
5. ¿Es online? → mismo `op`, autoridad server.
6. ¿Necesita seleccionar otro jugador? → `openTradeWithPlayer(peer)` + policy server; no otro panel.
7. Actualizar documentación y auditoría junto al cambio.
