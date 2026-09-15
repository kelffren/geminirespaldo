# PROPERTY / MAP EDITOR — memoria operativa V1

## Objetivo
Un mismo sistema sirve para dos casos sin duplicar lógica:

1. **Autor del mundo**: coloca assets registrados libremente sobre el mundo y exporta/importa un layout JSON.
2. **Jugador propietario**: coloca únicamente assets que posee, dentro de una parcela que le pertenece y consumiendo disponibilidad por unidad.

## Modelo de datos
Hay tres conceptos separados y no deben mezclarse:

- `asset template`: definición inmutable del catálogo (`assetId`, render parts, tamaño, colisión, distritos).
- `owned units`: saldo por jugador y `assetId`. Comprar 5 árboles significa `owned = 5`, no cinco objetos DOM ni cinco copias de imagen.
- `placement`: una instancia desplegada con `placementId`, `parcelId`, `ownerId`, `assetId`, `x`, `y`, `rotation`.

Disponibilidad: `availableUnits = ownedUnits - deployedUnits`.
Quitar un asset de la parcela elimina la colocación pero no destruye la unidad comprada.

## Autoridad / online-first
La UI nunca escribe balances ni placements por su cuenta. Toda mutación entra por:

`KELO_PROPERTY_SYSTEM.request(operation, payload)`

V1 usa `localStorage` (`kelo_property_state_v1`) como fallback de prototipo. Esto **NO es autoridad segura** para economía real. Antes de vender parcelas/assets con dinero real o moneda valiosa, instalar un adaptador servidor mediante `installRemoteAdapter()` y hacer autoritativos en backend:

- propiedad y estado de parcelas;
- compras/entitlements y balances de unidades;
- creación, movimiento, rotación y retirada de placements;
- validación de límites de parcela y permisos;
- snapshot/revisión para sincronización multiusuario.

El cliente debe poder ingerir el snapshot autoritativo mediante `ingestAuthoritySnapshot()` sin cambiar el editor.

## Parcelas V1
- `parcel:legacy:104`: puente con `STATE.plot`, para no romper el prototipo existente.
- `parcel:world:editor`: parcela virtual de desarrollo que cubre el mundo completo y tiene unidades ilimitadas. Nunca debe venderse ni otorgarse a jugadores.

## Catálogo
`property-asset-catalog.js` genera templates a partir de los contratos ya existentes de props y prefabs. No duplica archivos de imagen. Un asset nuevo se vuelve compatible al registrarse en el pipeline y/o mediante `KELO_PROPERTY_CATALOG.registerTemplate()`.

## Render
Las colocaciones se renderizan en `props_back` / `props_front` mediante `KELO_ENVIRONMENT_LAYERS`, prioridad 35. Las guías del editor se dibujan en `vfx_weather_lighting`.

## Entrada al editor
- Jugador: MENÚ → **Propiedades** abre su parcela.
- Desarrollo: `?mapEditor=1` (o `?editor=1`) habilita el botón **MAP EDITOR** y el modo MUNDO.

## Exportación
El layout de autor usa contrato `kelo-property-layout-v1`. La importación completa está restringida al modo de desarrollo.

## Próxima capa servidor recomendada
Tablas/colecciones conceptuales:
- `property_parcels(parcel_id, owner_id, bounds, district, status, revision)`
- `property_asset_balances(owner_id, asset_id, owned_units, revision)`
- `property_placements(placement_id, parcel_id, owner_id, asset_id, x, y, rotation, revision)`
- ledger de compra separado que sea la fuente que aumenta `owned_units`.

No convertir una compra en placement automáticamente: comprar y desplegar son operaciones distintas.