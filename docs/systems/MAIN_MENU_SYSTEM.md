# Main Menu / Luxe Shell System

## Status

**Foundation active UI shell + collapsible quick-actions rail.** `src/ui/luxe-shell.js` remains the single visible main-menu/HUD presentation owner used by the current runtime. `src/ui/luxe-player-hud.js` is a presentation subcomponent of that same owner and now groups the existing right-side controls behind one retractable launcher without creating a second menu, route, gameplay owner or duplicated handler.

## Purpose and problem solved

Luxe gives the player one main navigation surface while keeping the world readable on a phone. The quick-actions rail specifically solves permanent right-edge HUD obstruction: when collapsed, only one touch target remains; when expanded, the same existing Boutique, Menú, PvP, Guía and Pantalla Completa controls become available.

The change is presentation-only. It does not alter the destination or authority behind any action.

## Owner and files

- **Presentation owner:** `KELO_LUXE` / `src/ui/luxe-shell.js`
- **Player HUD + quick-actions presentation subcomponent:** `src/ui/luxe-player-hud.js` / `KELO_LUXE_PLAYER_HUD`
- **Fullscreen/orientation owner:** `KELO_ORIENTATION` / `src/ui/mobile-orientation.js`
- **Boutique owner:** `KELO_BOUTIQUE` / `src/ui/luxe-boutique.js`
- **Input-lock owner:** `KeloInputLocks`
- **Domain owners:** each destination and player datum keeps its own state and operations.

Luxe owns only UI presentation state and route dispatch. It does **not** own inventory, abilities, character appearance, market data, properties, nobility, titles, HP, gold, clan membership, emotes, PvP authority, fullscreen authority or creator permissions.

## State owned / not owned

Owned presentation state:

- main-menu open/closed;
- chat drawer open/closed;
- Luxe input-lock tokens;
- quick-actions rail expanded/collapsed;
- last rendered combat HUD snapshot cache.

Not owned:

- Boutique state or purchase rules;
- PvP state/authority;
- fullscreen/orientation state;
- profile or economy values;
- gameplay movement/combat;
- destination panel state.

The quick-actions expanded flag is ephemeral. It is not persisted, networked or written to gameplay state.

## Quick-actions rail contract

Default state is **collapsed**.

Collapsed:

```text
☰
```

Expanded:

```text
×
Boutique
Menú
PvP
Guía
Pantalla completa
```

Implementation rules:

1. `src/ui/luxe-player-hud.js` obtains the existing nodes `#lx-shop`, `#lx-side-menu`, `#lx-side-pvp` and `#kelo-orientation-btn`.
2. It creates only the `GUÍA` link if that existing Luxe presentation has not already created it.
3. Those exact nodes are moved into `#kw-quick-actions-options`; their existing listeners/owners are preserved.
4. `#kw-quick-actions-toggle` owns only expanded/collapsed presentation state.
5. Boutique, Menú, PvP and Guía auto-collapse the rail after activation. Fullscreen remains visible while toggling so the same existing control can immediately expose its updated SALIR/PANTALLA state.
6. Collapsed options use `visibility:hidden` plus `pointer-events:none`; the rail root is pointer-transparent and only the launcher keeps `pointer-events:auto`. The old right-side area therefore does not remain as an invisible touch blocker.
7. Open/close motion uses only `opacity` and `transform` for the visible transition, about 210 ms, and respects `prefers-reduced-motion`.
8. The toggle exposes `aria-expanded`, `aria-controls` and a changing accessible label.

No destination handler is copied into `luxe-player-hud.js`.

## Mobile layout contract

The quick-actions launcher is mobile-first:

- anchored with `safe-area-inset-top` and `safe-area-inset-right`;
- minimum interactive size is 44×44 px, including compact landscape;
- 390×844, 393×852 and 430×932 are explicit target viewports;
- low-height landscape compacts action height and spacing;
- the expanded list has an internal `max-height` and `overflow-y:auto`, so it cannot force document scrolling;
- `100dvh` is used when supported, with `100vh` fallback;
- no horizontal document overflow;
- the main world remains touchable wherever the collapsed list used to occupy space.

The Luxe shell keeps its existing z-index hierarchy. The quick rail stays inside `#kelo-luxe`; it does not use an arbitrary global maximum z-index and does not supersede critical modal/help overlays.

## Player combat HUD

The persistent profile-heavy HUD was retired from normal social exploration. In social mode the compact combat HUD is hidden. When the runtime enters PvP/combat mode, the top-left combat card exposes only real Vida and Maná resources already owned by gameplay/runtime state.

- Vida reads `localPlayer.hp / maxHp`.
- Maná reads a real player/profile mana source when available and otherwise renders `— / —`.
- The HUD does not mutate either resource.
- It does not poll with `setInterval`.
- Semantic events plus lightweight refresh hooks keep the presentation current.

## Current player-facing main-menu routes

| Entry | Destination owner / route | Status |
|---|---|---|
| Mochila | `KeloBackpackUI.open()` | LIVE |
| Habilidades | `KeloAbilities.openStonePanel()` | LIVE |
| Apariencia | `KeloCharacterCustomizer.open()` | DYNAMIC LIVE |
| Monturas | `KeloMountPanel.open()` | LIVE when owner ready |
| Perfil | legacy LIVE `inspectPlayer(localPlayer, true)` adapter | LIVE / LEGACY UI |
| Mercado | `KeloMarketUI.open()` | LIVE |
| Chat | Luxe chat drawer | LIVE presentation |
| Propiedades | `KELO_HOUSE_UI.show()` | LIVE |
| Nobleza | `KeloNobility.open()` | LIVE |
| Libro de títulos | `KeloTitles.openBook()` | LIVE |
| Burlas | `KeloSelfInteractionUI.openEmotes()` | LIVE |
| Creators | authorized lazy launcher | LIVE when authorized |

Misiones and Ajustes remain owner-gated and do not render until a real public UI owner exists.

## Input-lock contract

Opening the main Luxe menu claims:

```text
owner: luxe-main-menu
```

The chat drawer uses:

```text
owner: luxe-chat
```

The quick-actions launcher itself does not acquire a gameplay input lock because it is a small non-modal HUD affordance. Pointer isolation is local to the controls: pointer events from the Luxe rail are prevented from leaking to the world by the existing Luxe shell listener, while collapsed options cannot intercept taps at all.

## Fullscreen / orientation integration

`src/ui/mobile-orientation.js` remains the sole owner of `#kelo-orientation-btn` behavior. The quick-actions layer only relocates that DOM node after the orientation module has mounted it. `KELO_ORIENTATION` continues to update:

- `aria-pressed`;
- `aria-label`;
- fullscreen mode dataset;
- PANTALLA/COMPLETA versus SALIR/PANTALLA copy;
- iOS immersive fallback/help.

No fullscreen logic is reimplemented in Luxe HUD.

## Boutique integration

`src/ui/luxe-boutique.js` continues to attach the existing `#lx-shop` handler. Moving the same node preserves that handler. The quick-actions layer never writes `shop.onclick`.

## Main menu integration

`#lx-side-menu` keeps the `KELO_LUXE.toggleMenu` handler created by `luxe-shell.js`. Expanding/collapsing quick actions is independent of opening/closing the main menu.

## PvP integration

`#lx-side-pvp` keeps the existing Luxe PvP handler and delegates to the existing `enterPvPWorld()` path. The rail does not own combat state.

## Online-first model

The feature is client-only presentation and requires no server authority or persistence. All valuable/gameplay operations still flow through their existing owners. Connecting or changing online authority later does not require changing quick-actions IDs, handler ownership or flow.

## Extension points

To add a future quick action:

1. identify an existing owner and real control/route;
2. reuse that control or create it in the owner that owns the behavior;
3. add only presentation placement to the quick-actions list;
4. preserve stable IDs/handlers;
5. add static and browser coverage;
6. update this document and the player guide when the visible flow changes.

Do not place fake destinations in the quick rail.

## Invariants

- one Luxe navigation owner;
- one right-edge quick-actions launcher;
- no duplicated Boutique/Menu/PvP/Fullscreen handlers;
- closed options cannot capture pointer/touch;
- minimum touch target remains 44 px;
- world/gameplay state is never mutated by the rail;
- no timer/watchdog/polling for rail state;
- same control IDs remain available to existing code/tests;
- fullscreen owner remains `KELO_ORIENTATION`;
- Guide remains `guide.html`.

## Anti-patterns

Do not:

- create a second main menu;
- clone the five action buttons;
- copy destination `onclick` handlers into the HUD;
- hide the list only with opacity while leaving it touchable;
- add a giant z-index;
- add a framework/library for this interaction;
- use a timer to keep the rail synchronized;
- store expanded/collapsed state in gameplay/profile persistence.

## Tests and CI

Static contract audit:

```text
node scripts/luxe-menu-audit.mjs
```

Live/browser audit:

```text
node scripts/live-luxe-menu-audit.mjs
```

The browser audit verifies:

- closed-by-default launcher;
- pointer isolation while collapsed;
- expanded five-control order;
- Boutique and main-menu routing;
- fullscreen enter/exit label/state through the existing owner;
- PvP first-use route and combat HUD;
- portrait targets including 390×844, 393×852 and 430×932;
- compact 844×390 landscape;
- no horizontal overflow;
- screenshot evidence for closed/open states;
- console/page errors.

## Observability

`KELO_LUXE_PLAYER_HUD` advertises its version, layout, visibility mode, rail mode, owner and polling policy for deterministic browser inspection. `KELO_LUXE_AUDIT` and `KELO_ORIENTATION_AUDIT` remain the corresponding owner-level metadata surfaces.

## Known debt

- Some main-menu destinations still use explicitly documented legacy adapters while their final owner UIs are migrated.
- Guide copy may lag older HUD wording and must remain synchronized whenever the public menu flow changes.
- The combat HUD is deliberately minimal; additional player data must come from real domain owners rather than a new HUD state store.

## Checklist for future changes

- [ ] Reuse `KELO_LUXE` rather than create another navigation surface.
- [ ] Reuse action nodes/owner APIs instead of cloning handlers.
- [ ] Preserve collapsed pointer isolation.
- [ ] Check safe areas and 44 px minimum targets.
- [ ] Check portrait and low-height landscape.
- [ ] Keep fullscreen/orientation in `KELO_ORIENTATION`.
- [ ] Keep domain authority outside UI.
- [ ] Run static audit.
- [ ] Run browser/live audit.
- [ ] Update docs/guide for player-visible flow changes.
