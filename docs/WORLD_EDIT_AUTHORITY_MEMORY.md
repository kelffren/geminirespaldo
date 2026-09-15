# KELO WORLD — WORLD EDIT AUTHORITY MEMORY

## Estado

World Edit Authority V1 convierte el World Builder offline en un flujo versionado:

`WORLD BUILDER → DRAFT → REVIEW → PUBLISH → REVISION HISTORY → ROLLBACK`

Funciona sin servidor. La frontera pública obligatoria es:

```js
window.KELO_WORLD_EDIT.request(operation, payload)
```

La UI no conoce persistencia local ni transporte.

---

## Ownership

### World Builder UI

`src/ui/world-builder-ui.js`

Responsabilidad:

- interacción táctil/desktop;
- pintar suelo/caminos;
- seleccionar objetos;
- colisiones;
- botones Draft/Review/Publish;
- autosave visual;
- preview;
- historial/rollback.

No debe:

- escribir persistencia directamente;
- usar transporte de red;
- mutar Property directamente.

Toda mutación sale por `KELO_WORLD_EDIT.request()`.

### World Edit Authority facade

`src/world/world-edit-authority.js`

Única boca pública.

Responsabilidad:

- instalar autoridad;
- enviar operaciones;
- aplicar el snapshot de vista autorizado al runtime;
- proyectar placements del snapshot mediante Property;
- mantener la UI independiente de Local/Remote.

API:

- `request(op,payload)`
- `installAuthority(adapter)`
- `authoritySource()`
- `getCurrentDraft()`
- `getPublishedRevision()`
- `listRevisions()`
- `listDrafts()`

### LocalWorldEditAuthority

`src/world/authorities/local-world-edit-authority.js`

Simula offline las reglas que debe imponer el servidor mañana.

Responsabilidad:

- permisos;
- drafts;
- review;
- publish;
- rollback;
- snapshots;
- audit log;
- optimistic concurrency;
- versionado;
- delegación de placements a Property.

### RemoteWorldEditAuthority

`src/world/authorities/remote-world-edit-authority.js`

Placeholder de transporte.

Hoy, sin `transport.send`, responde:

`REMOTE_AUTHORITY_NOT_CONFIGURED`

Mañana el backend implementa el mismo contrato de operaciones.

### Draft Store

`src/world/world-draft-store.js`

Único módulo que conoce la persistencia local del World Edit.

Mientras el tamaño actual sea pequeño usa una persistencia local encapsulada. Puede reemplazarse por IndexedDB o desaparecer al usar autoridad remota sin cambiar la UI.

También puede leer el antiguo estado `kelo_world_builder_state_v1` únicamente para migración inicial.

### Revision System

`src/world/world-revision-system.js`

Utilidades puras:

- stable IDs;
- normalización de snapshot;
- revisión inmutable;
- comparación de snapshots;
- rollback como nueva revisión.

No contiene persistencia ni red.

### World Builder Runtime

`src/environment/world-builder-system.js`

Desde V2 es solamente runtime/render.

Posee en memoria:

- terrain/path overrides visibles;
- collision overrides visibles;
- view metadata.

No persiste.

Recibe la vista mediante:

`ingestViewSnapshot(snapshot, meta)`

---

# Modelo del mundo

Mundo principal:

`world:kelo-main`

Parcel Property mundial:

`parcel:world:editor`

Snapshot consolidado:

```text
worldId
cells
collisions
placements
generatedAt
```

El mapa base no se modifica.

Runtime final:

```text
BASE WORLD
+
PUBLISHED/DRAFT OVERRIDES
+
PROPERTY PLACEMENTS
=
VISIBLE WORLD
```

`REVELAR BASE` borra overrides del draft. Nunca destruye el mapa original.

---

# Draft

ID:

`draft:<stable-id>`

Campos:

- `draftId`
- `worldId`
- `baseRevisionId`
- `status`
- `revisionVersion`
- `createdBy`
- `createdAt`
- `updatedAt`
- `submittedAt`
- `approvedAt`
- `rejectedAt`
- `publishedAt`
- `discardedAt`
- `changeCount`
- `savedAt`
- `snapshot`

Estados:

- `DRAFT`
- `SUBMITTED`
- `APPROVED`
- `REJECTED`
- `PUBLISHED`
- `DISCARDED`

Solo `DRAFT` y `REJECTED` son editables.

---

# Review

Creator:

`world.edit`

Puede:

- crear draft;
- modificar;
- guardar;
- exportar/importar según scopes;
- submit.

No puede publicar.

Root/owner:

`world.publish`

Puede:

- approve;
- reject;
- publish;
- rollback.

No usar `isAdmin=true`.

La Llave Admin visible en Backpack es UX offline; la seguridad real futura pertenece al servidor.

---

# Publish

Cada publish crea una revisión NUEVA e INMUTABLE.

Ejemplo:

```text
v1 published
draft A
→ approve
→ publish
v2 published
```

Nunca modificar `v1` o `v2` después de crearla.

La referencia pública es:

`currentPublishedRevisionId`

---

# Rollback

Rollback no mueve un puntero hacia atrás y no borra historia.

Ejemplo:

```text
v1
v2
v3
rollback(v1)
→ v4 = contenido de v1
```

`v4.rolledBackFromRevisionId = v1.revisionId`

Esto conserva trazabilidad completa.

---

# Audit log

Toda mutación importante registra:

- `auditId`
- `timestamp`
- `actorId`
- `adminKeyId`
- `operation`
- `worldId`
- `draftId`
- `objectId`
- `before`
- `after`

El servidor futuro debe mantener el mismo contrato.

---

# Property relationship

Property continúa siendo la única autoridad activa de objetos/placements.

World Edit NO crea un renderer de objetos alternativo ni un segundo modelo activo.

El draft/revision contiene una copia serializada de placements únicamente como snapshot versionado.

Cuando una vista debe mostrarse:

```text
WorldEditAuthority
→ snapshot autorizado
→ Property.replaceLayout(...)
→ Property render/colliders
```

Cuando se modifica un objeto:

```text
World Builder UI
→ KELO_WORLD_EDIT.request(world:placement:*)
→ Local/Remote World Edit Authority
→ KELO_PROPERTY_SYSTEM.request(...)
→ snapshot del draft actualizado
```

Property conserva:

- template identity;
- asset catalog;
- placement behavior;
- rotation;
- bounds;
- render;
- object collision.

World Edit conserva:

- versión;
- draft;
- publicación;
- permisos;
- auditoría.

---

# Preview

`world:preview:enter`

Proyecta el snapshot del draft sin modificar la revisión publicada.

`world:preview:exit`

Restaura el snapshot publicado.

Preview no publica.

---

# Startup

Al iniciar:

1. se crea `LocalWorldEditAuthority`;
2. se lee la revisión publicada;
3. el facade proyecta SOLO el snapshot publicado;
4. gameplay normal nunca arranca accidentalmente mostrando un draft;
5. al abrir World Builder se reanuda/proyecta el draft del autor.

Esto evita que cerrar el navegador mientras se edita convierta el borrador en LIVE por accidente.

---

# Optimistic concurrency

Cada draft tiene `revisionVersion`.

Las mutaciones pueden enviar:

`expectedRevisionVersion`

Si no coincide:

`WORLD_REVISION_CONFLICT`

Offline normalmente no entra en conflicto, pero el contrato queda preparado para varios creadores online.

---

# Operaciones V1

Draft:

- `world:draft:create`
- `world:draft:get`
- `world:draft:list`
- `world:draft:current`
- `world:draft:save`
- `world:draft:discard`
- `world:draft:submit`
- `world:draft:approve`
- `world:draft:reject`
- `world:draft:export`
- `world:draft:import`
- `world:draft:clear-overrides`

Terrain/path:

- `world:tile:paint`
- `world:tile:clear`

Placements:

- `world:placement:create`
- `world:placement:move`
- `world:placement:rotate`
- `world:placement:remove`

Collision:

- `world:collision:create`
- `world:collision:update`
- `world:collision:remove`

Revision:

- `world:published:get`
- `world:published:meta`
- `world:revision:get`
- `world:revision:list`
- `world:publish`
- `world:rollback`

Preview:

- `world:preview:enter`
- `world:preview:exit`
- `world:view:published`

Audit:

- `world:audit:list`

---

# Server migration

No modificar:

- World Builder UI;
- Property System;
- operation names;
- snapshot format.

Implementar:

```js
const remote = new RemoteWorldEditAuthority(transport);
await KELO_WORLD_EDIT.installAuthority(remote);
```

El servidor debe validar:

- actor/session;
- Admin Key real;
- scope;
- revoked state;
- draft ownership/permission;
- base revision;
- revisionVersion;
- publish;
- rollback;
- persistence;
- audit;
- distribution of published snapshot.

El cliente no debe ser autoridad de seguridad online.

---

# Jugador normal

El jugador normal no necesita:

- drafts;
- audit log;
- review queue;
- admin controls;
- history completo.

Solo necesita el published snapshot.

Contrato:

`world:published:get`

Online este endpoint puede distribuirse por HTTP/WebSocket/cache/CDN.

---

# Regla de carga

El Admin Key loader carga World Builder.

World Builder V2 carga, en orden:

1. `world-draft-store.js`
2. `world-revision-system.js`
3. `local-world-edit-authority.js`
4. `remote-world-edit-authority.js`
5. `world-edit-authority.js`

La UI puede cargar antes de que la cadena termine porque su `boot()` espera `KELO_WORLD_EDIT.ready`.

---

# QA

Workflow:

`.github/workflows/world-edit-authority-v1.yml`

Audit:

`scripts/world-edit-authority-audit.mjs`

Debe cubrir:

- normal bloqueado;
- creator edita/persiste/submit;
- creator no publica;
- root approve/publish;
- v2/v3;
- rollback genera v4;
- preview vuelve a LIVE;
- reload conserva draft;
- portrait `390×844`;
- landscape `844×390`;
- desktop;
- cero page errors;
- Property sigue siendo source of truth.

---

# Regla permanente

Nunca añadir al World Builder UI una escritura directa a storage ni un transporte directo.

La frontera es:

`KELO_WORLD_EDIT.request()`

Si una feature nueva necesita romper esa frontera, la arquitectura debe revisarse antes de implementarla.
