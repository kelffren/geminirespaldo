# Kelo World — Backpack System Memory

## Purpose
Accumulated validated decisions for the Backpack/Inventory system. Record only behavior that has passed deterministic tests and/or LIVE mobile validation. Do not treat planned systems as implemented.

## Validated architecture — 2026-09-03

- `STATE.inventory` remains the legacy/source inventory used by existing systems. Backpack slot moves and sorting do not reorder that array.
- `STATE.backpack` schema version 2 owns portable slot ordering and capacity metadata.
- Base portable capacity is 20 slots arranged as 5 columns on mobile.
- Mobile Backpack interaction is tap-first. Current slot target is 52×52 CSS px. Drag and drop is deliberately not implemented yet.
- `equipment-v1.1.0` uses explicit `null` to represent an intentionally empty equipment slot. `Equipment.ensure()` initializes only slots whose property never existed and does not repopulate explicit empty slots.
- Backpack can equip and unequip equipment through the existing Equipment system without auto-refilling the empty slot.
- `backpack-v1.1.0` implements explicit stack signatures, max-stack-aware merging, splitting to a unique stack instance, Backpack-slot sorting, protected discard, and a capacity-expansion primitive.
- Moving a stack onto a compatible stack merges as much quantity as the target can accept. Remaining quantity stays in the source stack.
- Split requires an empty target slot and creates a new identity for the new stack.
- Equipment cannot be discarded through Backpack. Bound items cannot be discarded through Backpack.
- `backpack-ui-v1.2.0` exposes Equip/Unequip, Move/Merge, Split with a mobile stepper, Sort, and inline discard confirmation.
- Capacity expansion exists only as a technical primitive. No currency price, NPC, quest, premium purchase, or other economy rule has been validated for it.
- Warehouse/storage is not implemented yet.
- Market escrow / item transfer to Market is not implemented yet.
- GodsWar is used only as a functional reference for limited portable inventory, space pressure, expansion, and separation of carried inventory from external storage. No GodsWar art, UI, layout, assets, or code are copied.

## Validation — 2026-09-03

Runtime head certified: `9a192626e47a01360166cf23d135070aec2b5426`.

- Backpack CI run `33827267539`: SUCCESS.
- Kelo CI run `33827267637`: SUCCESS.
- GitHub Pages run `33827267183`: SUCCESS.
- Backpack LIVE mobile audit run `33827267588`: SUCCESS.
- LIVE viewport: 390×844 CSS px at DPR 2.
- LIVE slot target: 52×52 CSS px.
- LIVE initial state: 20 capacity, 12 used, 8 free.
- Equipment validation: unequip produced `null`; calling `getEquipped()` did not auto-refill; re-equip restored `eq_weapon` and survived reload.
- Stack merge validation: synthetic quantities 7 + 6 with `maxStack=10` became 3 + 10.
- Stack split validation: resulting quantities were 1, 2, and 10, with a unique identity for the split stack.
- Sort control was present and functional.
- Equipment discard returned `EQUIPMENT_PROTECTED`.
- Bound-item discard returned `BOUND_ITEM_PROTECTED`.
- Inline discard confirmation was visible and usable on mobile.
- Test-only synthetic inventory objects were removed before final reload.
- Final LIVE report: `consoleErrors=[]`, `failedRequests=[]`, `httpErrors=[]`.
- LIVE screenshot was inspected: Backpack fits the 390×844 viewport, the 5-column grid remains legible, quantities are readable, and the inline discard confirmation remains inside the panel without clipping.

## Known limitations / next bottleneck — 2026-09-03

- The next architectural bottleneck is container-to-container transfer. Before pricing Backpack expansion or connecting Market, define a Warehouse container with atomic `Backpack ↔ Warehouse` transfer rules, capacity checks, stable item identity, rollback on failure, and persistence.
- Do not connect Market until container transfer semantics are proven; Market should eventually hold items in an escrow-like container so one item cannot exist simultaneously in Backpack and a listing.
- Keep drag/drop deferred until the existing tap-first interactions remain reliable across real mobile testing.

## Validated Container System + Warehouse V1 — 2026-09-04

- `container-v1.0.0` is the first shared container contract for portable/stored inventory.
- The ownership invariant is: **one item → one identity → one container**.
- Backpack portable instances remain in `STATE.inventory` for compatibility with existing systems.
- Warehouse instances live in `STATE.warehouse.items`; one physical instance is never intentionally duplicated into both arrays.
- `STATE.warehouse` schema version 1 contains: `id`, `type`, `owner`, `capacity`, `slots`, `items`, and `permissions`.
- Warehouse V1 id is `warehouse_main`, owner is `local_pioneer`, and validated capacity is 30 slots.
- Warehouse slot ordering is independent and persistent.
- `transferItem(sourceContainer, destinationContainer, itemKey, quantity)` implements the validated transfer path: VALIDATE → PREPARE → EXECUTE → PERSIST; execution exceptions restore a pre-operation snapshot.
- Destination capacity is strict: if the complete requested amount cannot fit, the transfer returns `DESTINATION_FULL` and performs zero mutation.
- Full-instance transfer preserves the same item identity.
- Partial-stack transfer keeps the source identity for the remainder and creates a new identity for the moved split.
- Compatible destination stacks are filled in destination slot order and never exceed `maxStack`.
- Total quantity is invariant for pure transfers; tests compare totals before/after and also verify identity uniqueness across Backpack + Warehouse.
- `bound`, `rarity`, `metadata`, stack fields, and other item properties survive transfer.
- Equipped equipment cannot be stored and returns `EQUIPPED_ITEM_PROTECTED`.
- `equipment-v1.1.1` is Warehouse-aware when resolving starter equipment identities: `Equipment.ensure()` will not recreate a starter item that exists in Warehouse. Stored equipment is not equipable until it is transferred back into Backpack.
- `warehouse-ui-v1.0.1` is mobile-first and tap-first: 5 columns, 52×52 CSS px slots, separate MOCHILA / ALMACÉN tabs, capacity counter, item details, Transfer action, and quantity stepper.
- Warehouse selection defaults to transferring the complete stack. The stepper is used only when the player explicitly wants a partial amount.
- Drag and drop remains deliberately deferred.
- No Warehouse price, expansion price, NPC, quest, premium currency rule, subscription, or economy restriction has been introduced.
- Market Escrow, Trade, and House Storage remain unimplemented; the container contract is prepared for future container types but no fake functionality is exposed.

## Validation — Container System + Warehouse V1 — 2026-09-04

Certified runtime head: `13f37687511a9da2801c9e1fd2a1f1cba8d0a720`.

- Backpack CI run `33837308422`: SUCCESS. It validated legacy Backpack mechanics plus Container/Warehouse deterministic mechanics.
- Kelo CI run `33837308479`: SUCCESS.
- Forge CI run `33837308485`: SUCCESS after its version expectation was aligned to the Warehouse-aware `equipment-v1.1.1`; Forge mechanics were not changed.
- GitHub Pages run `33837307907`: SUCCESS on the certified runtime head.
- Warehouse LIVE mobile audit run `33837308460`: SUCCESS.
- Backpack LIVE regression audit was updated only for current title/version expectations and its functional audit step passed successfully in run `33837476191`.
- LIVE viewport: 390×844 CSS px at DPR 2.
- Warehouse LIVE slot target: 52×52 CSS px.
- Initial LIVE state: Backpack 12/20 used; Warehouse 0/30 used.
- Full Backpack → Warehouse transfer of synthetic x4 item preserved identity and preserved `bound=true`, `rarity='Epic'`, and `metadata.seal='keep'`; total quantity stayed 16.
- Warehouse → Backpack return restored the same full instance to portable inventory.
- Stack merge validation: source x6 into destination x7 with `maxStack=10` produced destination x10 plus overflow/source identity x3; total quantity remained 29 before and after.
- Full destination validation returned `DESTINATION_FULL` with byte-for-byte equivalent inventory/backpack/warehouse state before and after the rejected operation.
- Equipped `eq_weapon` transfer returned `EQUIPPED_ITEM_PROTECTED`.
- Warehouse item survived a page reload and remained stored, not duplicated in Backpack.
- LIVE screenshot was visually inspected: 30 Warehouse slots fit the mobile panel in 5 columns, quantities and tabs are legible, and the panel does not clip at 390×844.
- Final Warehouse LIVE report: `consoleErrors=[]`, `failedRequests=[]`, `httpErrors=[]`.

## Server-authority boundary — audited 2026-09-04

- Backpack, Warehouse and transfers are still client-authoritative and persist through the current client state/localStorage path. This is a functional prototype boundary, not anti-cheat/security authority.
- Before real multiplayer economy launch, the server should become authoritative for: container transfers, item creation/destruction, stack quantities, Market listings/escrow, currencies, crafting outputs/inputs, and drops/loot grants.
- Do not label the current client-side transfer layer as secure or authoritative.

## Next bottleneck

- The next logical inventory/economy bottleneck is **Market Escrow**, implemented as another real container using the now-validated transfer semantics.
- A future listing should move an item physically from Backpack to `market_escrow`; the same identity must not remain simultaneously portable and listed.
- Market work should also be the point where transfer/listing operations begin crossing an explicit server-authoritative transaction boundary instead of extending client-only ownership logic.
- Trade and House Storage should remain deferred until Market Escrow proves the generalized container contract under a third container type.

## Validated Market Escrow V1 — 2026-09-04

- `container-v1.1.0` extends the validated shared container contract with a third physical container: `market_escrow`.
- `STATE.marketEscrow` owns its own `items` and `slots`; an instance listed for sale is removed from Backpack and exists physically in Escrow instead.
- Escrow uses `permissions.merge=false`: separate listings never merge identical stacks. This preserves a strict 1:1 relationship between an active listing and its escrow item identity.
- Escrow capacity is elastic as an internal technical mechanism only; no expansion price, premium rule, listing limit, subscription, or other economy meaning is attached to it.
- `transferItem()` now supports deferred persistence and explicit merge policy so higher-level atomic operations can compose a container transfer without committing an intermediate state.
- `market-escrow-v1.0.0` owns real local listing/cancel transactions. The ownership invariant remains **one item → one identity → one container**.
- `createMarketListing(itemInstanceId, quantity, listingData)` follows VALIDATE → SNAPSHOT → Backpack→Escrow transfer with `persist:false` and `allowMerge:false` → listing creation → invariant audit → PERSIST. Any execution/invariant failure restores the snapshot.
- A full listing preserves the original item identity. A partial-stack listing keeps the original identity on the Backpack remainder and creates a new identity for the Escrow split.
- Active listing schema includes `listingId`, `owner`, `seller`, `escrowItemInstanceId`, `escrowItemKey`, `templateId`, `quantity`, `createdAt`, `status`, optional legacy-compatible `price`, and minimal `metadata`.
- `cancelMarketListing(listingId)` validates the active listing and Escrow item, snapshots state, transfers Escrow→Backpack, marks the listing cancelled, audits invariants, and persists. A failure restores/retains the listing and Escrow state.
- If Backpack cannot accept a cancelled item, cancellation returns `DESTINATION_FULL`; the item stays in Escrow and the active listing remains consistent.
- `auditInvariants()` checks identity uniqueness across Backpack/Warehouse/Escrow, active-listing→Escrow referential integrity, Escrow→active-listing ownership, no active listing pointing to Backpack, quantity agreement, and `maxStack` validity.
- `equipment-v1.1.2` is both Warehouse- and Market-Escrow-aware when resolving starter identities. `Equipment.ensure()` will not recreate a starter item that is stored or listed outside Backpack.
- `market-ui-v1.0.0` is mobile-first/tap-first. Backpack item details expose `Publicar`; stacks expose a quantity stepper. Successful publication removes the item from Backpack and opens Market. `MIS PUBLICACIONES` shows only real Escrow listings and allows cancellation.
- `EXPLORAR` remains read-only for the legacy market during this phase. Real purchase, buyer/seller settlement, taxes, fees, auctions, offers, history, Trade and House Storage are intentionally not implemented.
- The new Escrow listing route does not charge the legacy 15-Oro fee. A `price=150` field is retained only as compatibility metadata for the existing presentation; no new pricing economy was designed in this pass.
- Market remains client-authoritative/localStorage in V1. This is functional ownership plumbing, not anti-cheat or multiplayer economic authority.

## Validation — Market Escrow V1 — 2026-09-04

Certified runtime loading commit: `df7c2d7313ccc467e2fd7ad2741f7f545ee9f73e`.
LIVE audit workflow head: `ad4d892930afcfacd37841367575c333eaf90ad4`.

- Market Escrow deterministic CI run `33838582243`: SUCCESS.
- Kelo CI on the runtime integration run `33838582385`: SUCCESS.
- GitHub Pages deployment run `33838581455`: SUCCESS for the runtime integration.
- Market Escrow LIVE mobile audit run `33839012299`: SUCCESS.
- Kelo CI on the hardened LIVE audit head run `33839012330`: SUCCESS.
- Backpack CI regression run `33839074827`: SUCCESS after aligning inherited exact-version gates to `equipment-v1.1.2` / `container-v1.1.0` and including Market Escrow mechanics.
- Warehouse LIVE regression run `33839137874`: SUCCESS after aligning exact-version expectations; Warehouse behavior was not reimplemented.
- Kelo CI paired with that regression run `33839137873`: SUCCESS.
- LIVE viewport: 390×844 CSS px at DPR 2.
- Full-listing LIVE validation: `mkt_audit_full` left Backpack (`inBag=false`), entered Escrow (`inEscrow=true`) with the same identity, kept `bound=true`, `rarity='Epic'`, and `metadata.seal='keep'`; total quantity stayed 13.
- Reload validation: one active listing and its Escrow item survived reload; the item remained absent from Backpack and all invariants stayed green.
- Cancel validation: active listings returned to 0, the same item returned to Backpack, Escrow no longer contained it, and invariants stayed green.
- Partial-stack validation: source x5 listed x3 became Backpack x2 + Escrow x3 with a new Escrow identity and `splitFrom='mkt_audit_stack'`; total quantity remained 18 before and after.
- Backpack-full cancellation returned `DESTINATION_FULL`, state comparison remained unchanged, active listing remained 1, and Escrow retained the item.
- Final LIVE invariant report remained `ok=true` throughout each accepted state transition.
- Final LIVE report: `consoleErrors=[]`, `failedRequests=[]`, `httpErrors=[]`.
- LIVE screenshot was manually inspected: Market fits the 390×844 viewport; `EXPLORAR` / `MIS PUBLICACIONES (1)` are legible, the listing card clearly shows `EN ESCROW`, price presentation is readable, and the panel has no clipping.
- QA findings corrected during certification: a post-reload synthetic non-Stone Backpack fixture was removed by the legacy Stones migration, so the audit now creates that fixture after reload; the MutationObserver-injected `Publicar` control also required human-like inter-tap timing in the audit. These were audit-harness issues, not ownership/transfer failures.
- Inherited Backpack/Container/Forge/Warehouse exact-version gates were aligned to the validated Escrow-aware runtime instead of weakening functional checks.

## Server-authority boundary — Market audited 2026-09-04

- Market Escrow V1 is still client-authoritative and persisted through the current browser state/localStorage path. It must not be treated as secure multiplayer market infrastructure.
- Before enabling real player-to-player purchases, the server must become authoritative for: listing creation, listing cancellation, Escrow ownership, item quantities, accepted listing price, buyer/seller ownership, currencies, purchase execution, and settlement.
- The server transaction must eventually guarantee that item transfer and currency settlement succeed or fail together; client UI should only request operations and render the authoritative result.

## Next bottleneck — after Market Escrow V1

- The next inventory/economy bottleneck is **Market Authority V1**: move create/cancel/Escrow ownership across an explicit server-authoritative transaction boundary before implementing real purchases.
- Only after that boundary is proven should the next pass add buyer purchase + atomic currency/item settlement.
- Trade and House Storage remain deferred; they should reuse the same generalized container/ownership contracts rather than create parallel item-storage logic.
