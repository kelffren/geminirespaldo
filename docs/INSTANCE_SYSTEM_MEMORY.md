# Kelo World — Instance System Memory V1

## Estado
House Instance V1 es offline-first y online-ready. Una casa no es una coordenada del world: es un runtime lógico con `instanceId`, lifecycle, participantes, permisos y snapshot persistente.

## Contratos estables
- `KELO_INSTANCES`: manager genérico (`create/getOrCreate/join/leave/destroy/current`).
- `KELO_SCENE_CONTEXT`: `world` o `instance` + tipo/resourceId.
- `KELO_HOUSE_AUTHORITY.request(op,payload)`: autoridad reemplazable.
- Persistencia House: adapter `load/save`; local usa `kelo_house_snapshots_v1`.
- Property sigue siendo owner único de templates, owned units y placements. House NO crea otro sistema de muebles.

## House snapshot
Schema 1: `houseId`, `ownerId`, `revision`, `layoutRevision`, `instanceConfig`, `placements`, `permissions`, `updatedAt`. Al crear/recrear una instancia se rehidrata el parcel House desde ese snapshot.

## Lifecycle
`CREATING -> LOADING -> ACTIVE -> IDLE -> SHUTTING_DOWN -> DESTROYED`. Destruir runtime no borra snapshot. Reentrar crea runtime nuevo y restaura placements.

## Permisos
Roles: owner/editor/visitor/blocked. Owner edita; visitor entra pero no puede mutar placements.

## Online futuro
Cambiar `LocalHouseAuthority`/persistencia local por adapters de servidor/DB. UI y Property continúan llamando los mismos contratos. El servidor validará ownership, unidades, bounds, permisos, revisiones y capacidad.

## No hacer
- No guardar economía nueva dentro de House.
- No crear un segundo editor de muebles.
- No hacer que UI escriba localStorage directamente.
- No convertir casas en coordenadas permanentes del mapa principal.
