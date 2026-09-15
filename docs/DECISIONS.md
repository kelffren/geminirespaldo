# KELO WORLD — IMPLEMENTATION DECISIONS

Purpose: durable record of implementation decisions that have been tested and closed.

## Rules

- This file records **closed decisions**, not research hypotheses.
- Every decision must reference the roadmap item, exact commit(s), baseline/change/same-trace evidence, important metrics and rollback note.
- Never claim `VERIFIED` from code inspection alone.
- Reopening a decision creates a new entry that references the old one; preserve history.

## Template

```text
## DEC-<AREA>-NNN — <title>
DATE:
ROADMAP_ITEM:
STATUS: ACCEPTED | REJECTED | SUPERSEDED
BASELINE_COMMIT:
IMPLEMENTATION_COMMIT:
LIVE_AUDIT_COMMIT:
AFFECTED_FILES:

DECISION

EVIDENCE

ALTERNATIVES TESTED

NON-REGRESSION RESULT

KNOWN LIMITATIONS

ROLLBACK

NEXT
```

No implementation decision has been closed under this log yet. First expected candidate: `DEC-MOV-001` after MOV-001 passes its verification gates.
