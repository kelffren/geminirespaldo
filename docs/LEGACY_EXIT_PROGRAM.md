# Kelo World — Legacy Exit Program

## Goal
Retire legacy ownership safely without rewriting the game. Legacy code may remain as compatibility while authority is moved one domain at a time.

## Non-negotiable rule
**One owner, one writer, one source of truth.**

No domain can move to `NEW` while static evidence shows a legacy writer or multiple writers for one of that domain's protected contracts.

## Migration states

### LEGACY
Legacy remains authoritative. New implementation may exist but does not control gameplay.

### SHADOW
Legacy remains authoritative. New implementation may execute in parallel and its result can be compared. Divergence is evidence, not something to hide.

### NEW
New owner is authoritative. This mode is blocked by CI until static ownership gates pass. Runtime/characterization parity must also be satisfied before changing the manifest.

## Phase -1 — Observatory
Run:

```bash
node scripts/legacy-observatory.mjs
```

Outputs:
- `artifacts/legacy-observatory/report.json`
- `artifacts/legacy-observatory/report.md`

The report inventories legacy engine files, imports, global reads/writes, critical state writers, listeners, timers and authority conflicts.

## Phase 0 — Safety gate
Run:

```bash
node scripts/legacy-migration-gate.mjs
```

The gate reads `config/legacy-migration-manifest.json`, regenerates the observatory report and blocks unsafe `NEW` activation.

GitHub Actions workflow: `.github/workflows/legacy-observatory.yml`.

## Runtime switchboard
`src/core/migration-switchboard.js` supplies reusable primitives for `LEGACY`, `SHADOW` and `NEW` execution. It has no automatic boot side effect and must only be connected deliberately during a domain migration.

The switchboard supports:
- mode lookup;
- authority selection;
- shadow execution decisions;
- numeric tolerance comparison;
- divergence reporting;
- migration snapshots.

## Domain protocol
For each domain:

1. Establish current behavior/characterization baseline.
2. Read Observatory evidence.
3. Identify all writers and readers.
4. Define the modern owner and contract.
5. Remove or adapt duplicate writers.
6. Move `LEGACY -> SHADOW`.
7. Compare behavior under normal and edge cases.
8. Investigate every meaningful divergence.
9. Require relevant live/mobile checks.
10. Move `SHADOW -> NEW` only when static + runtime gates pass.
11. Keep rollback path until confidence window is complete.
12. Convert remaining legacy access to read-only adapter, then delete when unused.

## Initial domains
- input → `InputSystem`
- movement → `MovementSystem`
- camera → `KeloCamera`
- player state → `PlayerState`
- collision → `KELO_COLLISION`
- render → `KeloRender`
- simulation → `SimulationSystem`
- world → `WorldSystem`

The first migrated domain must be selected from evidence, not preference. Prefer a domain with clear ownership, fewer dependents and reliable characterization tests.

## World Editor freeze rule
The World/Editor path is high priority for observability but must not be refactored blindly. Before changing its authority, capture a staged load trace for:

`editor open -> shell visible -> module load -> world load -> map build -> asset resolve -> collision build -> render ready -> first interactive frame`.

Every stage should eventually expose timestamp, duration, owner and success/failure. A freeze should leave a last successful stage and expected next stage.

## Forbidden migration behavior
- no engine-v2 parallel rewrite;
- no big-bang replacement;
- no two authority migrations in the same change unless inseparable and explicitly justified;
- no timer-based repair to mask lifecycle ownership;
- no UI/Studio direct mutation of gameplay authority;
- no new feature ownership inside legacy engine files;
- no deleting rollback before parity evidence exists.

## Exit condition
A legacy engine file is considered retired only when it owns no gameplay state, writes no protected authority contract and remains at most a compatibility adapter. Deletion is optional until consumers reach zero; loss of authority is the real milestone.
