# Kelo World — Equipment Item Catalog

## Propósito

`src/systems/equipment-item-catalog.js` convierte las familias de habilidades de arma en items reales y reutilizables sin crear otro inventario, otra tienda ni otro Equipment manager.

El catálogo es **contenido puro**. No posee estado y no puede mover oro, comprar, vender, equipar ni escribir en `STATE.inventory`.

## Ownership

- `KELO_EQUIPMENT_ITEM_CATALOG`: define templates, stats base, `weaponProfileId` y ofertas de contenido.
- `KeloCommerceAuthority`: único owner de la compra/venta valiosa. Materializa las ofertas del catálogo como fixtures offline y ejecuta la compra.
- `KeloContainers`: único owner del movimiento físico hacia Backpack y de rollback transaccional.
- `KeloBackpack`: presenta los items que ya están en Backpack.
- `KeloEquipment`: único owner de equipar/desequipar el arma.
- `KELO_EQUIPMENT_ABILITY_DATA`: resuelve `weaponProfileId` a Q/W/E.
- `KeloAbilities`: único runtime de cast/delivery/effects.

No existe `WeaponShop`, `WeaponInventory` ni `WeaponManager` paralelo.

## API pública

### `KELO_EQUIPMENT_ITEM_CATALOG`

- `templates`: seis templates de arma iniciales.
- `marketOffers`: ofertas de contenido para el arsenal offline.
- `get(templateId)`
- `list()`
- `listByFamily(family)`
- `createItem(templateId, overrides)`
- `validateTemplate(template, abilityData)`

`createItem()` devuelve una instancia nueva con identidad, stats, durabilidad y metadatos de combate, pero no la inserta en ningún contenedor.

## Catálogo inicial

| Item | templateId | Profile | Familia | Precio offline |
| --- | --- | --- | --- | ---: |
| Espada del Viajero | `starter_weapon` | `weapon.vanguard_blade` | sword | 90 |
| Bastón Arcano | `arcane_staff` | `weapon.arcane_staff` | staff | 135 |
| Arco Largo | `starter_bow` | `weapon.longbow` | bow | 120 |
| Dagas de Sombra | `starter_daggers` | `weapon.shadow_daggers` | dagger | 125 |
| Martillo de Guerra | `starter_hammer` | `weapon.war_hammer` | hammer | 130 |
| Bastón Glacial | `frost_staff` | `weapon.frost_staff` | frost_staff | 145 |

Todos son `kind:'equipment'`, `slot:'weapon'`, `maxStack:1` y llevan un `weaponProfileId` estable.

## Flujo LIVE de compra y equipamiento

1. `index.html` carga `equipment-item-catalog.js` antes de Equipment y Commerce.
2. `KeloCommerceAuthority` lee `marketOffers` y crea listados demo de Ron en `stall_05`.
3. La UI de Mercado consume `KeloCommerceAuthority.snapshot()`; no conoce la implementación del catálogo.
4. Al comprar, `KeloCommerceAuthority.buyListing()` valida precio/oro y abre un checkpoint transaccional.
5. Commerce clona la instancia del catálogo y cambia su `id` a una identidad de transacción única.
6. `KeloContainers.receiveItem('backpack', ...)` mueve el arma al Backpack existente.
7. Solo si la recepción funciona se descuenta el oro y el listing pasa a `sold`.
8. Si algo falla, `KeloContainers.restoreCheckpoint()` y Commerce restauran contenedores, oro y estado comercial.
9. `KeloBackpack` ve el item como equipment sin adaptación especial.
10. El botón Equipar llama al `KeloEquipment` existente.
11. `KeloEquipmentAbilityChannel` detecta el nuevo `weaponProfileId` y proyecta sus Q/W/E.

## Migración de partidas existentes

Los fixtures del mercado son recuperables por `listingId`.

En cada `ensureState()`, Commerce calcula los fixtures actuales y añade únicamente los `listingId` que no existen en `STATE.commerce.demoListings`.

Consecuencias:

- una partida antigua recibe las nuevas armas sin resetear Commerce;
- una oferta que ya fue comprada conserva su fila `sold` y **no reaparece**;
- no se reemplaza historial ni oro;
- no se borra contenido creado por jugadores.

## Escalabilidad

Para añadir cientos o miles de armas:

1. si el kit Q/W/E ya existe, reutilizar su `weaponProfileId`;
2. añadir un template al catálogo con stats/content metadata;
3. si debe venderse en el fixture offline, añadir/derivar su `marketOffer`;
4. no tocar `KeloEquipment`, `KeloBackpack`, `KeloContainers`, `KeloCommerceAuthority` ni `KeloAbilities`;
5. crear un profile nuevo solo si el kit de combate realmente es distinto;
6. usar `combatAbilityKeys` únicamente para una variante autorizada por `slotChoices`.

Quality, grade, skin, nombre comercial o tier no justifican otro engine ni otro profile por sí solos.

## Online-first

Los fixtures de Ron son contenido offline de desarrollo; no son autoridad compartida.

Cuando el servidor controle el mercado, debe publicar/validar al menos:

- `templateId` permitido;
- `weaponProfileId` permitido para ese template;
- precio y moneda;
- disponibilidad/stock;
- identidad de instancia resultante;
- quality/grade/stats permitidos;
- `combatAbilityKeys` si existen.

El cliente puede seguir usando el mismo catálogo para presentación, pero `KeloCommerceAuthority` ya impide fallback local cuando `KeloNetAuthority` está online.

## Anti-patrones

- No insertar directamente un item comprado en `STATE.inventory` desde UI.
- No descontar oro desde Market UI.
- No crear un `WeaponShop` paralelo.
- No duplicar stats/perfiles dentro de `commerce-authority.js`.
- No hardcodear `if (weaponId === ...)` en `KeloEquipment`.
- No reinsertar un fixture vendido solo porque cambió de versión.
- No confiar en `weaponProfileId` del cliente como autoridad competitiva final.

## Tests

`npm run audit:equipment-abilities` protege además el catálogo:

- seis templates únicos;
- seis profiles únicos;
- seis ofertas únicas;
- cada template resuelve una familia/profile válida;
- cada instancia materializada es equipment/weapon;
- orden de carga correcto en `index.html`;
- Commerce consume el catálogo;
- no vuelve a existir `shadow_blade_demo`;
- la migración usa `listingId` y no revive una fila vendida;
- siguen intactos 5 Stone + Q/W/E o M1/M2/M3.
