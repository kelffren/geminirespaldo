# LEY DEL REPO — LÉE ESTO ANTES DE TOCAR CÓDIGO

**Todo lo que se cree o se cambie en Kelo World debe nacer listo para enchufarse al online.**
No es opcional. No es “luego lo vemos”. Es la primera regla del proyecto.

Pages es la cara. El servidor (`server/` + futuro Supabase) es la verdad de lo que importa.

---

## La pregunta que cierra cualquier PR / tarea

> ¿Puedo conectar esto al online cambiando solo la capa de autoridad/persistencia, sin rehacer la lógica, los IDs, las reglas de dueño ni el flujo que ve el jugador?

Si la respuesta es **NO**, el trabajo no está terminado.

---

## Qué sí puede ser 100% cliente

- Arte, tiles, Luxe, cámara, joy, VFX, HUD.
- Predicción local para que se sienta rápido en el teléfono.

## Qué NUNCA puede quedar atrapado en el navegador

Cualquier cosa que cree, borre, mueva, gaste, gane, equipe, venda o cambie estado valioso o compartido:

oro, KC, piedras, inventario, equipo, forja, mercado, daño PvP, HP real, cooldowns competitivos, nobleza, propiedades, trades.

Eso hoy puede vivir en `localStorage` **solo si** el cliente pide la operación por una API estable (`keloNet.request` / `KeloNetAuthority`) y pinta el resultado. Mañana el server responde lo mismo.

---

## Cómo se escribe un sistema nuevo

```
UI / input
  → pide operación (id + payload)
    → authority (hoy: local-fallback | mañana: server)
      → resultado
        → UI / VFX / predicción
```

Prohibido:
- `castFireball()` como única verdad.
- Reglas de juego metidas en el DOM.
- IDs = índice de array.
- Economía que solo existe en `localStorage` sin frontera documentada.

Obligatorio:
- IDs estables (`playerKey`, `stoneUid`, `abilityId`).
- Data-driven cuando haya 10 o 300 (abilities, items).
- Si el otro jugador tiene que **verlo**, el evento tiene nombre (`pose`, `cast`, `equip`, …) aunque todavía no viaje por el cable.

---

## Offline ahora, online después — misma boca

```js
// bien
KeloNetAuthority.cast({ abilityId, x, y, dir, seed })

// mal
localPlayer.gold += 999
localStorage.setItem('oro', ...)
```

Sin `ws`: fallback local con **la misma función**. Con `ws`: el server decide.

---

Archivos hermanos: `AGENTS.md` (reglas completas) · `ENGINE_MAP.md` (quién manda hoy) · `engine-net.js` (puente).
