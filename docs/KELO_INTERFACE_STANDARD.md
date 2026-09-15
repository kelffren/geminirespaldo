# Kelo Interface Standard

This is the UI contract for Kelo World software surfaces. The target is not to visually copy Apple products; the target is the same product discipline: calm hierarchy, predictable behavior, minimal cognitive load, excellent touch ergonomics and consistent interaction language.

## 1. Hierarchy

Every screen must answer these questions in under two seconds:

1. Where am I?
2. What is the main thing I can do here?
3. What is secondary?
4. How do I leave or go back?

A screen should normally have one primary action. Secondary actions use neutral surfaces. Destructive actions must never visually compete with the primary action.

## 2. Brand use

Kelo gold is an accent, not a border around everything.

Use gold for:
- brand marks;
- active selection when useful;
- the single primary action;
- rare prestige or status information.

Do not use gold simultaneously on every card, divider, button and title.

## 3. Type

Use the system UI stack:

`-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Segoe UI", sans-serif`

Recommended hierarchy:
- screen title: 28-42 px, 700-760;
- section title: 15-17 px, 650-720;
- body: 13-15 px, 400-550;
- secondary: 11-13 px, 400-550;
- metadata only: 10-11 px.

Avoid all-caps and wide letter spacing for normal controls. All-caps is reserved for tiny technical metadata only.

## 4. Touch and controls

- Primary mobile touch target: at least 44 × 44 CSS px.
- Desktop compact controls may render visually smaller only if the hit target remains comfortable.
- Same semantic action = same visual level everywhere.
- Buttons must expose hover/pressed/focus/disabled states.
- Focus must remain visible for keyboard users.
- Controls must never rely only on color to communicate state.

## 5. Surfaces

Use four levels only:

1. App background.
2. Main surface.
3. Raised control/card.
4. Selected/primary state.

Prefer neutral hairlines (`rgba(255,255,255,.10)`) instead of decorative outlines. Blur is allowed on floating chrome but should not reduce text contrast.

## 6. Radius and spacing

Canonical radii:
- 10 px: controls;
- 14 px: cards;
- 20 px: panels;
- 28 px: modal/sheet.

Canonical spacing scale: `4, 8, 12, 16, 20, 24, 32`.

Do not invent new spacing values without a layout reason.

## 7. Motion

Motion should explain state change, not decorate.

- press: 100-140 ms;
- selection/surface transition: 120-180 ms;
- modal/sheet: 160-240 ms;
- respect `prefers-reduced-motion`.

No continuous glow/pulse unless it communicates an active process.

## 8. Menus

Menus must be scannable before they are beautiful.

- group by user intent, not internal architecture;
- show short labels first and optional explanation second;
- avoid more than one level of persistent navigation when possible;
- keep Close/Back in a predictable top location;
- current selection is visually obvious;
- mobile menu rows default to one column when two columns make labels harder to scan.

## 9. Creator software

Creator tools should feel like one application.

Required order:
1. global/context header;
2. one clear workspace;
3. optional tool navigation;
4. optional inspector;
5. contextual footer/timeline only if needed.

For Asset Repairer specifically, the intended mental model is:

`Import → Review → Repair → Preview → Export`

The default experience must surface Auto Repair and Export. Advanced repair operations may remain available without competing with the default path.

## 10. Quality gate

New UI work should not introduce:
- tiny primary text under 11 px;
- primary mobile buttons under 44 px hit height;
- `outline:none` without an explicit `:focus-visible` replacement;
- a new serif font for software controls;
- a new independent gold/teal palette when shared tokens already cover the state;
- decorative infinite animation not tied to progress/state;
- a new modal without a clear close/back route.

## 11. Shared ownership

The interface hierarchy has three owners with different jobs:

- `src/ui/kelo-interface-system.css` — canonical tokens and presentation hierarchy for current surfaces.
- `src/ui/kelo-interface-compat.css` — migration bridge for legacy surfaces that still contain old tiny controls, ornamental chrome or focus resets. It may only reuse shared `--kui-*` tokens. It must not become a second design system.
- `src/ui/kelo-interface-runtime.js` — progressive disclosure, contextual action state, accessibility labels and interaction language for dynamic surfaces.

Feature styles still own their layout and domain-specific visuals. Fantasy content such as items, rarity, combat identity and world art may remain expressive. Software chrome—navigation, buttons, modal structure, typography, focus, close/back and action hierarchy—must converge through the shared owners above.

When a legacy module is rewritten cleanly, move its necessary rules into the feature/shared system and delete the corresponding compatibility rules. The compatibility bridge is a migration layer, not permanent permission to keep duplicating design languages.

## 12. Review rule

A UI improvement only counts when at least one of these becomes measurably better:
- fewer competing primary actions;
- fewer visual styles for the same semantic control;
- larger/safer touch targets;
- clearer navigation hierarchy;
- improved keyboard/focus behavior;
- lower visual density without losing capability;
- fewer inconsistent hard-coded design values;
- better mobile layout;
- verified reduction in UI-audit warnings.

The project-wide audit must evaluate effective shared overrides. A legacy declaration is only considered resolved when the loaded shared cascade contains a concrete selector that actually overrides the unsafe metric or restores focus behavior.
