# Kelo World — Feature Matrix

**Actualizado:** 2026-09-14 · V6.54.2

| Área | Estado | Owner principal | Nota |
|---|---|---|---|
| Auth / Guest | LIVE | Auth lifecycle | Gate antes del engine boot |
| Input locks | LIVE | KeloInputLocks | Foundation |
| Movement | LIVE | KeloMovement + legacy physics | Transitional |
| Camera | LIVE | KeloCamera | Foundation |
| Collision | LIVE | KELO_COLLISION | Buckets/owners |
| Render extensions | LIVE | KeloRender | Foundation |
| Avatar composition | LIVE | KeloAvatar | Foundation |
| Main world | LIVE | world-map + environment contracts | Data-driven |
| Forest Plaza atlas | LIVE | Atlas Contract + Property Catalog | 146 piezas |
| Forest Plaza semantic folders | LIVE code / deployment QA | Studio Asset Palette | 7 grupos |
| World Editor | LIVE, mobile QA sensitive | Studio + KELO_WORLD_EDIT | No rewrite |
| Asset Sheet Compiler | LIVE creator | Kelo Creator Asset Bridge | Irregular atlas |
| Map Forge | LIVE creator | KeloMapForge | Generator/composer |
| Abilities / Stone | LIVE | KeloAbilities | Data-driven |
| Equipment ability channel | LIVE | KeloAbilities + KeloEquipment | Shared cast path |
| Mounts | LIVE/candidate | KeloMounts | Online-ready |
| PvP World | LIVE | PvP systems | Server authority evolution |
| Arena | LIVE offline foundation | KeloArena | Competitive authority pending |
| Character customization | LIVE | KeloCharacterCustomization | Layered |
| Appearance | LIVE/candidate | KeloAppearance | Separate from stats |
| Backpack / containers | LIVE | dedicated systems | UI + state |
| Titles / stats | LIVE | KeloTitles / KeloPlayerStats | Nobleza separate |
| Market / commerce | LIVE offline-ready | KeloCommerceAuthority | Online authority path |
| Regional economy/logistics | API LIVE | KeloRegionalEconomy | Authority evolution |
| Property / instances | LIVE foundation | PropertySystem / InstanceSystem | Placeable catalog |
| Guardian | LIVE foundation | KeloGuardian | Online evolution |
| Game tuning admin | LIVE admin | KeloGameTuning | Controlled publication |
| App updater / PWA | LIVE client foundation | KeloUpdater | Version refresh path |
| Bug intelligence | ACTIVE internal | bug registry + KeloEvolution adapter | Holdout gated |

## Definición de DONE

Una feature no está terminada solo porque exista código. Para marcar LIVE estable debe tener owner, integration path, documentación, test/CI apropiado y evidencia de runtime cuando dependa de navegador/dispositivo.
