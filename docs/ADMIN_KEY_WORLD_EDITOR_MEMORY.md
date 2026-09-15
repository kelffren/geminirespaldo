# Kelo World — Llave Admin / World Creator V1

## Objetivo
Separar claramente dos formas de construir:

1. **Parcela del jugador**: limitada por ownership y unidades compradas. Sigue usando Property V1.
2. **Mundo principal**: editable únicamente por el propietario del juego o por creadores autorizados mediante una **Llave Admin**.

La Llave Admin NO convierte la parcela personal en ilimitada y NO crea un segundo sistema de placements. El mismo Property Editor y el mismo catálogo se reutilizan.

## Llave Admin
La llave es a la vez:
- un entitlement de autoridad;
- un objeto visible `bound` en la mochila;
- una identidad estable `admin-key:*`;
- un conjunto de permisos/scopes.

Scopes V1:
- `world.edit`: colocar, mover, rotar y borrar en el mundo.
- `world.export`: exportar layouts del mundo.
- `world.import`: importar layouts del mundo.
- `world.publish`: publicar una revisión global. Reservado para una fase posterior/propietario.
- `admin.issue`: emitir llaves a otros creadores.
- `admin.revoke`: revocar llaves.

La llave de creador por defecto recibe `world.edit`, `world.export`, `world.import`.
La llave raíz del propietario recibe todos los scopes.

## Offline-first
V1 usa `kelo_admin_keys_v1` detrás de `KELO_ADMIN_KEYS.request()`.
`?mapEditor=1` sirve únicamente como bootstrap local de prototipo para crear la llave raíz en ese navegador. El editor ya no debe considerar el query param como permiso por sí mismo.

## Online-ready
Antes de permitir edición compartida/real de producción:
- `KELO_ADMIN_KEYS.installRemoteAdapter()` debe apuntar a servidor.
- El servidor valida keyId, ownerId, active/revoked y scopes.
- Revocar una llave debe invalidar el permiso inmediatamente.
- Los cambios de mundo deben guardarse como revisiones/drafts autoritativos.
- Recomendado: creadores pueden editar drafts; solo `world.publish` publica al mundo LIVE.

## Regla de seguridad
La presencia visual del objeto en Backpack NO es la autoridad. La autoridad es el entitlement validado. El objeto solo representa ese permiso en UI.

## No hacer
- No dar `world.publish` automáticamente a todos los creadores.
- No usar un booleano `isAdmin=true` disperso por UI.
- No duplicar Property placements.
- No permitir que Llave Admin regale unidades de parcela.
- No confiar en localStorage cuando el mundo sea multiusuario real.
