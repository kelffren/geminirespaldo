# Kelo World — Game Tuning System

## Propósito

`KeloGameTuning` permite que un administrador ajuste parámetros visuales globales desde el juego, los pruebe localmente y publique una revisión para todo KELO WORLD. La primera versión controla cámara y escala visual de avatares sin alterar colisiones, física ni autoridad gameplay.

El flujo separa explícitamente **preview**, **borrador** y **producción**. Mover un slider nunca publica por sí solo.

## OWNER y archivos

- Runtime/config owner: `KeloGameTuning` — `src/systems/game-tuning-system.js`.
- Frontera de autoridad cliente: `KeloGameTuningAuthority` — `src/systems/game-tuning-authority.js`.
- UI admin: `KeloGameTuningAdminUI` — `src/ui/game-tuning-admin-ui.js`.
- Config publicada: `game-tuning.json`.
- Publisher server-side: `server/game-tuning-publisher.js`.
- HTTP adapter: `server/game-tuning-http.js`, compuesto dentro del mismo servidor por `server/sprite-ai-bootstrap.js`.
- Actualización de clientes: owner existente `KeloUpdater`.
- Auditoría: `scripts/game-tuning-audit.mjs`.

No existe un segundo owner de cámara, render o updater.

## Controles V1

### Cámara

- `baseZoom`: profundidad/zoom base.
- `dampX`, `dampY`: suavizado de seguimiento.
- `deadXRatio`, `deadYRatio`: zona muerta.
- `lookAheadDist`, `lookAheadDecay`: anticipación y retorno.
- `dprCap`: límite de densidad de píxeles del viewport.

Todos se aplican mediante APIs públicas de `KeloCamera`: `setBaseZoom`, `setFollowTuning`, `configureViewport` y `scheduleViewportSync`.

### Sprites

- `localPlayerScale`: escala visual del jugador local.
- `remotePlayerScale`: escala visual de otros jugadores.

La escala entra por `KeloAvatar.use(...)` como middleware de presentación. Se escala el dibujo alrededor de la posición del actor; `radius`, collider, posición, velocidad y estado gameplay no se modifican.

## Flujo de preview

1. El administrador abre **GAME CONTROL**.
2. El panel adquiere un token de `KeloInputLocks`.
3. Cada slider llama `KeloGameTuning.preview(config)`.
4. El valor se aplica únicamente a esa sesión.
5. `DESCARTAR` restaura la configuración publicada.
6. `GUARDAR BORRADOR` persiste un draft local en `kelo.game.tuning.draft.v1`.

El draft local nunca es autoridad de producción.

## Flujo de publicación

1. El admin pulsa **PUBLICAR ACTUALIZACIÓN** y confirma la operación.
2. `KeloGameTuning` entrega el draft a `KeloGameTuningAuthority`.
3. El cliente llama `POST /api/game-tuning/publish` sobre el mismo host HTTP asociado al WSS de producción.
4. El request usa la sesión Supabase del usuario como `Bearer`.
5. El servidor valida la sesión y exige `game.tuning.publish`, `world.publish` o un rol administrativo permitido.
6. `KeloGameTuningPublisher` vuelve a sanear y limitar todos los números.
7. El publisher lee el `game-tuning.json` vigente, incrementa `revision` y escribe el archivo en la rama configurada mediante GitHub Contents API.
8. Ese commit genera una nueva build de GitHub Pages.
9. `version.json` expone el nuevo SHA cuando Pages termina de desplegar.
10. `KeloUpdater`, ya existente, detecta ese SHA, prepara la build y ofrece la actualización a los clientes sin reinstalar la PWA.

La respuesta HTTP de publicación confirma el commit, no finge que Pages ya terminó de desplegar.

## Seguridad

El navegador **nunca** recibe una credencial GitHub. El publisher solo lee:

- `KELO_GITHUB_TOKEN` o `GITHUB_TOKEN` en el proceso servidor;
- `KELO_GITHUB_REPO` opcional, default `kelffren/gemini`;
- `KELO_GITHUB_BRANCH` opcional, default `main`;
- `KELO_GAME_TUNING_PATH` opcional, default `game-tuning.json`.

Repo, branch y path no se aceptan desde el cliente. El token nunca se serializa en `audit()`, logs de éxito o respuestas HTTP.

Si no existe `KELO_GITHUB_TOKEN`, preview y lectura siguen funcionando, pero publicar responde `GAME_TUNING_PUBLISH_NOT_CONFIGURED` y no simula éxito.

## Acceso admin

La UI reutiliza permisos existentes de `KELO_ADMIN_KEYS` (`world.edit` / `world.publish`) y admite scopes futuros `game.tuning.edit` / `game.tuning.publish`. El endpoint servidor vuelve a verificar permisos; ocultar el botón no es la barrera de seguridad.

El modo de desarrollo existente `?mapEditor=1` puede mostrar el panel para pruebas locales, pero no evade la autorización server-side de publicación.

## API pública

```js
KeloGameTuning.loadPublished({ authority?: boolean })
KeloGameTuning.ingestPublished(config, source?)
KeloGameTuning.preview(config)
KeloGameTuning.saveDraft(config?)
KeloGameTuning.discard()
KeloGameTuning.publish(config?)
KeloGameTuning.getState()
KeloGameTuning.schema
```

Autoridad:

```js
KeloGameTuningAuthority.get()
KeloGameTuningAuthority.access()
KeloGameTuningAuthority.publish(config)
KeloGameTuningAuthority.status()
```

UI:

```js
KeloGameTuningAdminUI.open()
KeloGameTuningAdminUI.close()
KeloGameTuningAdminUI.toggle()
```

## Invariantes

- UI no escribe `CONFIG.zoom`, cámara ni renderer directamente.
- Preview no hace commits.
- Draft local no es autoridad.
- El servidor sanea nuevamente todos los valores.
- Escala visual no cambia collider/gameplay.
- GitHub token vive solo en servidor.
- Publicación genera un commit real; Pages/updater usan su flujo normal.
- No se crea segundo updater, Service Worker, transporte WebSocket ni servidor HTTP.

## QA

```bash
node scripts/game-tuning-audit.mjs
node --check src/systems/game-tuning-authority.js
node --check src/systems/game-tuning-system.js
node --check src/ui/game-tuning-admin-ui.js
node --check server/game-tuning-publisher.js
node --check server/game-tuning-http.js
node --check server/sprite-ai-bootstrap.js
npm run audit:foundation
npm run audit:docs
npm run audit:updater
```

Para QA manual móvil: abrir como administrador, mover zoom y escala, verificar preview inmediato, descartar/restaurar, guardar borrador, publicar con una cuenta autorizada y comprobar que el commit/Pages produce una nueva build detectable por `KeloUpdater`.
