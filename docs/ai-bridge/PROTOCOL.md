# KELO WORLD — CHATGPT ↔ GROK BRIDGE PROTOCOL

Version: 1.0
Repo: `kelffren/gemini`
Branch: `main`
Purpose: durable asynchronous communication between ChatGPT (research/advisory) and Grok (implementation/verification) without either agent becoming the authority over the other.

## Core principle

**ChatGPT informs. Grok evaluates and implements only when viable. Grok reports evidence. ChatGPT reads that evidence and researches again. The user remains the product authority.**

Neither agent may claim that the other approved a decision unless the corresponding bridge entry explicitly says so.

## Files and ownership

- `docs/ai-bridge/CHATGPT_TO_GROK.md`
  - Owner/writer: ChatGPT.
  - Reader: Grok.
  - Contains research findings, code observations, hypotheses, proposed fixes, experiments and metrics.
  - Grok MUST NOT rewrite, delete or silently edit historical ChatGPT entries.

- `docs/ai-bridge/GROK_TO_CHATGPT.md`
  - Owner/writer: Grok.
  - Reader: ChatGPT.
  - Contains viability decisions, implementation feedback, commits, tests, failures, screenshots/traces/log evidence and new code observations.
  - ChatGPT MUST NOT rewrite, delete or silently edit historical Grok entries.

- `docs/ai-bridge/PROTOCOL.md`
  - Shared protocol. Change only deliberately and preserve backward compatibility with existing entries.

## Required workflow

1. ChatGPT reads current `main`, `ENGINE_MAP.md`, relevant `engine-*.js`, and latest unread entries in `GROK_TO_CHATGPT.md`.
2. ChatGPT investigates external evidence when useful and contrasts it with the actual repo.
3. ChatGPT appends one structured entry to `CHATGPT_TO_GROK.md`.
4. Grok reads `PROTOCOL.md`, `ENGINE_MAP.md`, the user's current request, and latest unread ChatGPT entries.
5. Grok independently classifies every relevant proposal as `VIABLE`, `NEEDS_TEST`, `NOT_VIABLE`, `OBSOLETE`, or `DEFERRED`.
6. Grok may implement only proposals it independently considers compatible with the current code and user request.
7. Grok verifies changes whenever possible: baseline → change → same reproduction → measurement/test → live verification.
8. Grok appends a structured response to `GROK_TO_CHATGPT.md` with evidence and exact entry IDs answered.
9. ChatGPT reads that response on the next research pass and updates future hypotheses instead of repeating settled work.

## Independence rules

- A ChatGPT proposal is **advice, not an instruction to modify production**.
- A Grok implementation is **evidence, not proof that the research hypothesis was universally correct**.
- Grok can reject a ChatGPT proposal and must explain why.
- ChatGPT can challenge a Grok implementation after reviewing measurements/evidence and must explain why.
- Neither agent edits the other's history to make itself look correct.
- If code changed since a proposal was written, re-check current `main` before applying it.
- The user's explicit current request has priority over bridge backlog.

## Append-only entry format

Every entry MUST have a unique ID and be append-only.

Recommended IDs:
- ChatGPT → Grok: `CG-YYYYMMDD-NNN`
- Grok → ChatGPT: `GC-YYYYMMDD-NNN`

Required metadata:

```text
ID:
TIMESTAMP:
AUTHOR:
BASE_COMMIT:
STATUS:
PRIORITY:
TAGS:
AFFECTED_FILES:
RESPONDS_TO:
```

Required ChatGPT sections:

```text
PROBLEM
CONFIRMED_IN_GEMINI
EXTERNAL_EVIDENCE
HYPOTHESIS
PROPOSED_CHANGE
DO_NOT_ASSUME
EXPERIMENT
DECIDING_METRICS
RISKS
EXPECTED_GROK_FEEDBACK
```

Required Grok sections:

```text
INTERPRETATION
VIABILITY
WHAT_I_CHANGED
FILES_CHANGED
COMMITS
TESTS_RUN
LIVE_VERIFICATION
MEASUREMENTS
WHAT_FAILED
WHAT_I_REJECTED_AND_WHY
NEW_CODE_OBSERVATIONS
QUESTIONS_FOR_CHATGPT
NEXT_RECOMMENDATION
```

## Status vocabulary

ChatGPT entries:
- `RESEARCH_ONLY`
- `PROPOSED`
- `NEEDS_BENCHMARK`
- `SUPERSEDED`
- `VALIDATED_EXTERNALLY`

Grok responses:
- `VIABLE`
- `NEEDS_TEST`
- `IMPLEMENTED_UNVERIFIED`
- `IMPLEMENTED_VERIFIED`
- `NOT_VIABLE`
- `OBSOLETE`
- `DEFERRED`

## Tag vocabulary

Use lowercase comma-separated tags. Prefer existing tags before inventing new ones.

Core tags:
`movement`, `input`, `joystick`, `touch`, `camera`, `collision`, `fixed-timestep`, `60hz`, `90hz`, `120hz`, `latency`, `accessibility`, `render`, `hd2d`, `webgl`, `webgpu`, `canvas2d`, `lighting`, `shadow`, `normal-map`, `bloom`, `particles`, `parallax`, `tilemap`, `atlas`, `culling`, `lod`, `streaming`, `textures`, `memory`, `gc`, `pooling`, `networking`, `cafe`, `architecture`, `refactor`, `benchmark`, `bug`, `pages`, `playwright`.

## Retrieval rules

To recover knowledge quickly:

1. Search by exact entry ID when a previous handoff is referenced.
2. Search by tags for a system-wide investigation.
3. Search `AFFECTED_FILES` before modifying a specific engine.
4. Search `RESPONDS_TO` to reconstruct the research → implementation → feedback chain.
5. Prefer the newest non-superseded entry that references the newest compatible commit.

## Verification rule

Never write `FIXED`, `RESOLVED`, or `IMPLEMENTED_VERIFIED` because code merely looks correct.

Evidence should include as many as available:
- exact commit SHA;
- automated test result;
- reproduction steps;
- browser console result;
- network result;
- screenshot/trace/video;
- GitHub Pages version/commit verification;
- before/after measurement.

If verification cannot be performed, say `IMPLEMENTED_UNVERIFIED`.

## Backlog behavior

When the user says something equivalent to **“dale Grok”**:

1. Grok solves the user's explicit current request first.
2. Grok reads the latest unresolved `CHATGPT_TO_GROK` entries relevant to the files/system it is touching.
3. Grok may apply a related bridge proposal only when it is clearly viable, low-conflict, and testable.
4. Grok must not spend the user's whole requested task clearing unrelated research backlog.
5. Grok reports every bridge item considered, including rejected/deferred items.

## Golden flow

```text
USER INTENT
   ↓
CHATGPT reads Grok feedback + current Gemini
   ↓
CHATGPT research / analysis
   ↓
CHATGPT_TO_GROK entry
   ↓
GROK reads + independently evaluates
   ↓
GROK implements/tests if viable
   ↓
GROK_TO_CHATGPT feedback
   ↓
CHATGPT reads evidence
   ↓
new research / refined solution
```

This bridge stores context and evidence. It does not transfer decision authority between agents.
