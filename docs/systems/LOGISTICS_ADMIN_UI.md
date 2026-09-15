# Logistics Admin UI

## Propósito

`KeloLogisticsAdminUI` es una superficie interna de QA/Admin para observar y probar en móvil o escritorio la Foundation de economía regional, contratos, riesgo logístico, carretas, facciones y clanes sin usar la consola del navegador.

No crea una segunda economía ni una segunda autoridad. La UI delega toda mutación en `KeloLogisticsDevtools`, que a su vez delega en `KeloRegionalEconomy`, `KeloCaravans` y `KeloFactions`.

## Owner

- UI owner: `KeloLogisticsAdminUI`
- Archivo: `src/ui/logistics-admin-ui.js`
- Observabilidad/acciones: `KeloLogisticsDevtools`
- Economía: `KeloRegionalEconomy`
- Carretas: `KeloCaravans`
- Facciones/clanes: `KeloFactions`
- Permisos: `KELO_ADMIN_KEYS`
- Input modal: `KeloInputLocks`

## Estado que posee

Solo estado efímero de presentación:

- panel abierto/cerrado;
- pestaña activa;
- estado busy de una acción;
- token de input lock.

## Estado que NO posee

No posee ni escribe directamente:

- `STATE.regionalEconomy`;
- `STATE.caravans`;
- `STATE.socialGroups`;
- oro;
- inventarios;
- ownership de carretas;
- membresías o clanes.

## Acceso

La superficie está oculta salvo que el jugador tenga una `Llave Admin` con scope root existente `admin.issue`.

En el prototipo offline, el bootstrap de propietario existente puede obtenerse mediante el flujo de `?mapEditor=1` ya soportado por `KELO_ADMIN_KEYS`. No se añade una segunda puerta de permisos.

Online, la visibilidad del panel no constituye autoridad. Los owners de dominio siguen siendo responsables de validar o rechazar cada operación.

## API pública

```js
KeloLogisticsAdminUI.open()
KeloLogisticsAdminUI.close()
KeloLogisticsAdminUI.toggle()
KeloLogisticsAdminUI.refresh()
KeloLogisticsAdminUI.isOpen()
KeloLogisticsAdminUI.allowed()
```

## Pestañas

### Resumen

Muestra contadores de pueblos, contratos activos, eventos de ruta, riesgo medio, carretas, facciones y clanes.

Incluye escenarios rápidos delegados a `KeloLogisticsDevtools`:

- emergencia de manzanas en Ignis;
- banda de saqueadores en la ruta demo;
- liberar la carreta demo simulando la muerte del portador.

### Economía

Muestra por pueblo:

- stock real;
- capacidad;
- porcentaje de reserva;
- precio actual;
- contratos activos.

No calcula precios paralelos; consume `MarketQuote` del owner regional.

### Rutas

Muestra:

- Logistic Risk Score;
- distancia económica;
- eventos activos;
- activación/fin de bandas de saqueadores mediante comandos del owner.

### Carretas

Muestra:

- estado físico;
- owner;
- current controller;
- posición;
- visibilidad de carga según permisos.

Permite probar `attach`, `detach`, `claim` y muerte del portador. Las reglas de rango y propiedad permanecen en `KeloCaravans`.

### Facciones

Muestra facciones y clanes existentes y permite probar:

- JoinFaction;
- JoinClan;
- CreateClan.

Todas las restricciones de facción, membresía, identidad del clan y permisos permanecen en `KeloFactions`.

## Input / móvil

Al abrir, la UI adquiere un token mediante `KeloInputLocks.acquire('logistics-admin-ui')` y lo libera al cerrar. No escribe `KELO_MODAL_INPUT_LOCK` directamente.

El layout es responsive para portrait y landscape y no depende de hover.

## Online-first

Flujo actual:

```text
Logistics Admin UI
  → KeloLogisticsDevtools
    → owner.request(...)
      → local fallback
```

Flujo futuro:

```text
Logistics Admin UI
  → KeloLogisticsDevtools
    → owner.request(...)
      → ServerAuthority
```

La UI no necesita reescribirse cuando el server sea autoritativo.

## Invariantes

1. La UI no toca `STATE` directamente.
2. No crea precios, contratos, claims ni memberships por su cuenta.
3. No usa polling ni `setInterval` para mantener coherencia.
4. El cierre siempre libera el input lock.
5. Un usuario sin Llave Admin root no ve el FAB ni puede abrir el panel.
6. Las acciones pueden fallar y la UI debe mostrar el error del owner en vez de forzar el estado.

## Tests

- `node --check src/ui/logistics-admin-ui.js`
- `node scripts/logistics-admin-ui-audit.js`
- `npm run audit:logistics`
- `npm run audit:docs`

## Deuda pendiente

- Validación visual LIVE en Pages después del merge.
- Sustituir el dibujo placeholder de la carreta por arte final cuando exista asset aprobado.
- La UI de QA no sustituye las futuras interfaces de jugador para mercado, contratos, facciones o clanes.
