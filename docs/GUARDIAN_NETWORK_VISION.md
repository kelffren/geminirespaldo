# KELO WORLD — Guardian Network Vision / Idea Memory

> Canonical product-memory document for the Guardian idea. This file preserves the founder intent so future agents do not reduce Guardian to “a second server button”.
>
> **Important:** this document contains both implemented foundations and future vision. Every section is marked **IMPLEMENTED**, **FOUNDATION**, or **VISION**. Never claim a VISION item is live until code + QA prove it.

## 1. Founder intent

Guardian should let players voluntarily contribute spare device/network capacity to KELO WORLD and receive rewards when that capacity is genuinely useful.

The goal is not “five players each run an isolated server”. The goal is a coordinated resource network where the central KELO authority can decide what each donor should do according to the current bottleneck.

Core mental model:

```text
MORE PLAYERS
   ↓
MORE DEMAND
   ↓
MORE POTENTIAL GUARDIANS
   ↓
MORE DISTRIBUTED CAPACITY
```

The system should grow toward a player-assisted cloud while preserving server-authoritative identity, economy and security.

## 2. Non-negotiable principles

1. **Useful work beats uptime farming.** A device being switched on is not enough to justify large rewards.
2. **KELO decides the role.** The donor offers capacity; the coordinator decides whether it is useful as host, relay, mirror, asset seeder, compute worker or standby.
3. **Do not pretend separate CPUs become one CPU.** Capacity is combined by partitioning useful work, not by magically merging devices.
4. **Region follows measured network quality.** Prefer observed RTT/loss/capacity over a country string supplied by the player.
5. **Economy remains server-authoritative.** Guardian nodes never mint KC and never self-report “I deserve X coins”.
6. **Competitive gameplay remains authoritative.** PvP outcomes, HP, inventory, ownership and valuable state cannot become trusted client declarations.
7. **Every workload has a lease/epoch.** A node is allowed to execute only explicitly assigned work, for a bounded time.
8. **Failover is designed before scale.** Hot mirror / standby nodes are part of the architecture, not an afterthought.
9. **iOS/browser limits are real.** Foreground browser participation can be useful, but continuous background server claims must never be made unless a native/runtime path proves them.
10. **No parallel engine.** Guardian must reuse KELO’s existing online authority, PvP simulation contracts, AOI, economy authority and update architecture.

## 3. What already exists

### IMPLEMENTED — Guardian V1 control plane

Current owners:

```text
KeloGuardianUI
    ↓
KeloGuardian
    ↓
KeloGuardianAuthority
    ↓
Kelo Guardian Coordinator
```

V1 already has:

- stable node identity per installation;
- opt-in / opt-out;
- sanitized capability declaration;
- heartbeat and stale-node expiry;
- recommended readiness roles;
- Supabase bearer authentication;
- foreground master-host lease gated by server permission;
- no second WebSocket;
- no second simulation loop;
- client cannot mint rewards.

### FOUNDATION — Guardian V2 useful-service control plane

This pass establishes server-side contracts for:

- trusted regional observations;
- regional demand pressure;
- scheduler candidates;
- workload leases;
- support planning from CPU/network/tick pressure;
- verified service units;
- Guardian ranks and multipliers;
- explicit `kcMinted: 0` in Guardian proof settlement so the economy authority remains separate.

This is the **control/scheduling foundation**, not the full P2P data plane.

## 4. Work roles

The network should eventually assign one or more of these roles according to need.

### PRIMARY HOST

Runs authoritative simulation for an explicitly assigned zone/instance/shard. This should only become active after the simulation core can run behind the same authority contract outside the current central process.

### HOT MIRROR

Receives enough deterministic state/input/snapshots to take over quickly if PRIMARY disappears. Its value exists even when failover never happens because it keeps recovery capacity warm.

### RELAY

Carries useful traffic for clients/Guardians when routing, fan-out, NAT traversal or bandwidth pressure makes it beneficial. Relay does **not** become gameplay authority merely because traffic passes through it.

### ASSET SEEDER

Serves content chunks/assets that are hash-addressed and verified by recipients. Wrong bytes are discarded and should damage reputation.

### COMPUTE WORKER

Runs bounded deterministic jobs that can be validated independently. Good examples are non-authoritative simulation batches, precomputation or other workloads where the server can verify the result.

### WITNESS / STANDBY

Maintains availability/readiness or validates selected events. Standby reward must remain very small compared with useful active work.

## 5. The five-donor example

The founder example must remain a canonical scheduling test.

Suppose five donors are available:

```text
Guardian A — USA — strong CPU — current PRIMARY
Guardian B — USA — excellent upload
Guardian C — USA — strong CPU — reliable
Guardian D — Europe — excellent EU latency
Guardian E — Europe — moderate CPU/upload
```

### Case A — PRIMARY upload is saturated

Observed:

```text
CPU       48%
Upload    91%
Tick      60 Hz
Loss       3%
```

Correct response:

```text
A stays PRIMARY
B becomes RELAY
C stays HOT MIRROR / standby
D/E remain available for EU demand
```

Do **not** move simulation merely because bandwidth is the bottleneck.

### Case B — PRIMARY CPU/tick is saturated

Observed:

```text
CPU       96%
Upload    42%
Tick      47 Hz
```

Correct response:

```text
A remains authority for current partition until handoff
C becomes HOT MIRROR
another capable Guardian becomes zone/instance host for spillover
```

Useful work is partitioned by zone/instance/shard. Separate computers do not become one processor.

### Case C — EU players arrive

If US authority gives Madrid ~90 ms but an EU Guardian gives ~20 ms, the system should prefer the EU Guardian for EU-local simulation where the game architecture permits it.

A relay can improve routing/reliability, but the large latency win requires the relevant authority/instance itself to be regional.

## 6. Regional architecture

Long-term target:

```text
                       KELO MASTER
          identity / economy / ownership / persistence
                            │
                  Guardian Coordinator
                            │
          ┌─────────────────┴─────────────────┐
          │                                   │
       US REGION                           EU REGION
          │                                   │
   PRIMARY + MIRROR                    PRIMARY + MIRROR
          │                                   │
   local relays/assets                 local relays/assets
```

The world can still be logically one world while realtime authority is partitioned.

### Global state

Remain under KELO master/server-authoritative persistence:

- account identity;
- KC and valuable currencies;
- inventory/ownership;
- market ownership;
- houses/land ownership;
- guild/clan durable state;
- bans/security;
- durable quest/progression state.

### Regional/instance realtime state

Can eventually be delegated behind leases:

- movement;
- local NPC simulation;
- projectiles;
- combat timeline;
- local physics;
- AOI snapshots;
- instance-local temporary state.

Cross-region traffic should send important events/state deltas, not the whole simulation 60 times per second when unnecessary.

## 7. Handoff model

When a player or zone changes authority, use a bounded authority handoff rather than simultaneous uncontrolled ownership.

Conceptual token:

```text
HANDOFF
playerId
sourceAuthority
nextAuthority
authorityEpoch
position
hp/mana
relevant cooldown/state
inventory/ownership hash or revision
timestamp
signature/server validation
```

Flow:

```text
OLD AUTHORITY
   ↓ prepare bounded snapshot
KELO MASTER / COORDINATOR validates epoch
   ↓
NEW AUTHORITY accepts
   ↓
old lease retires
```

Split-brain must fail closed.

## 8. Regional selection

Do not route primarily from self-declared country.

Selection should converge on measured values such as:

- RTT toward relevant player/region probes;
- packet loss;
- jitter when available;
- upload throughput;
- CPU headroom;
- achieved simulation tick rate;
- current assignments/load;
- device/runtime class;
- foreground/background state;
- charging/battery constraints;
- historical reliability.

The coordinator should form useful geographic clusters from actual network behavior.

Possible future clusters:

```text
US-East
US-South
US-West
EU-West
EU-Central
LATAM
etc.
```

The names are secondary. Measured connectivity is primary.

## 9. Reward philosophy — Proof of Useful Service

Bad model:

```text
Guardian ON for 1 hour = large KC payout
```

This invites phone farms, idle devices and fake self-reported work.

Target model:

```text
availability (small)
+
useful verified work (large)
×
regional demand multiplier
×
Guardian rank multiplier
=
verified reward units
```

Guardian itself does **not** mint KC. It produces server-verified service units. A future economy settlement path may convert eligible units to KC under economy rules/caps.

## 10. Availability vs useful service

Founder wanted a reward for leaving altruistic hosting enabled. Preserve that intent, but weight it safely.

### Availability

A tiny reward/reputation stream may exist when the coordinator can prove continuous eligible availability.

It must be:

- capped;
- server-measured;
- much smaller than useful work;
- ideally dependent on network demand;
- account/device abuse resistant.

### Useful work

The major reward source should be verified work such as:

- host seconds under active lease;
- mirror seconds under active mirror lease;
- relay bytes acknowledged by both sides/coordinator;
- asset chunks whose hashes validate;
- deterministic compute results that validate;
- verified failover recovery events.

## 11. Guardian ranks

Foundation rank ladder:

| Rank | Verified lifetime units | Multiplier |
|---|---:|---:|
| Helper | 0 | ×1 |
| Guardian | 1,000 | ×1.25 |
| Sentinel | 10,000 | ×1.5 |
| Warden | 50,000 | ×2 |
| Pillar of Kelo | 250,000 | ×3 |

These numeric thresholds are tuning values, not sacred game design. The invariant is that higher historical reliability/useful contribution can earn stronger multipliers, including the founder’s desired ×2 and ×3 tiers.

Rank must never be calculated from a client-provided “hours hosted” counter.

## 12. Regional demand bonus

If KELO has excessive capacity in one region and scarce capacity in another, reward useful work where the network needs it.

Example:

```text
US demand: 40%
EU demand: 92%
```

Conceptual result:

```text
US useful service: ×1.0-ish demand factor
EU useful service: up to ×1.75 foundation demand factor
```

Then rank applies after useful base units.

Example:

```text
500 base verified units
× 1.7 regional need
× 2 Warden
= 1,700 weighted service units
```

Again: weighted service units are not automatically KC.

## 13. Verification / anti-cheat

Never trust:

```text
"I transferred 80 TB"
"I hosted 1,000 players"
"My CPU was at 100%"
"Give me 50,000 KC"
```

Proof should come from server-issued workloads and independent observations/receipts.

Examples:

### Relay

```text
workload lease
+ sender receipt
+ receiver/coordinator receipt
+ byte/window accounting
= verified relay service
```

### Assets

```text
server-issued chunk/hash
+ recipient validates hash
+ coordinator confirms delivery
= verified asset service
```

### Host

```text
valid host lease/epoch
+ expected tick/snapshot cadence
+ server/peer observations
+ no split-brain
= verified host service
```

### Mirror

```text
mirror lease
+ snapshot/input sequence freshness
+ takeover readiness
= verified mirror service
```

### Compute

```text
server-issued deterministic job
+ result hash/validation/redundancy
= verified compute service
```

## 14. Scheduler behavior

The scheduler should answer **what is the actual bottleneck?** before assigning help.

Inputs:

```text
CPU pressure
simulation tick quality
upload pressure
packet loss
connections
regional player demand
RTT matrix
available Guardians
current Guardian load
historical reliability
```

Examples:

```text
high upload/loss → add RELAY
high CPU / low tick → add partition host + HOT MIRROR
high EU demand / bad transatlantic RTT → assign EU PRIMARY for EU-local workload
asset-download spike → add ASSET SEEDERS
```

A Guardian should change roles dynamically as network needs change.

## 15. Workload leases and capacity

Every active assignment must include:

- workload ID;
- type;
- region;
- purpose;
- epoch;
- assigned time;
- expiry;
- bounded resource cost.

Foundation scheduling models each role with a capacity cost so one donor is not assigned impossible combinations.

Conceptual costs currently used by V2 scheduler foundation:

```text
PRIMARY       1.00
HOT MIRROR    0.65
COMPUTE       0.80
RELAY         0.40
ASSET         0.25
WITNESS       0.15
```

These are scheduling weights, not CPU percentages.

## 16. Existing KELO code that should be reused

Guardian should converge on the existing architecture rather than replace it.

### PvP authority

Current server PvP already uses fixed-step server authority and filtered snapshots. Long-term distributed hosting should extract/reuse the same deterministic simulation contract instead of creating a new combat engine.

### AOI

Current server already limits relevance by zone/proximity. That naturally supports partitioning zones/instances across authorities later.

### Economy

Existing server economy stays the only place where KC/reward settlement can become authoritative.

### Identity

Supabase-authenticated account identity remains the trust root for Guardian ownership/permissions.

### KeloUpdater

Guardian changes deploy through the normal KELO update path; Guardian does not invent its own app updater.

## 17. Phased execution roadmap

### PHASE 1 — Control plane — IMPLEMENTED

- node identity;
- opt-in preferences;
- heartbeat/stale expiry;
- readiness classification;
- master-host lease;
- authenticated HTTP authority.

### PHASE 2 — Scheduler + proof contract — FOUNDATION NOW

- trusted observation API;
- regional demand map;
- role candidate scoring;
- workload leases;
- support planner;
- verified service ledger;
- ranks ×1 / ×1.25 / ×1.5 / ×2 / ×3;
- no KC mint inside Guardian.

### PHASE 3 — WebRTC data plane — VISION

- signaling;
- peer connection negotiation;
- DataChannels;
- NAT/TURN strategy;
- relay receipts;
- bandwidth/accounting telemetry;
- encrypted/authenticated workload channels.

### PHASE 4 — Asset seeding — VISION

- content-addressed chunks;
- hashes;
- peer cache;
- validation;
- abuse controls;
- useful-delivery proofs.

### PHASE 5 — Hot mirror — VISION

- deterministic snapshot/input feed;
- mirror freshness;
- takeover epoch;
- split-brain prevention;
- failover drill tests.

### PHASE 6 — Regional authority / partitioned simulation — VISION

- transport-agnostic simulation core;
- zone/instance authority leases;
- regional placement;
- authority handoff;
- cross-region durable-event sync.

### PHASE 7 — Economy settlement — VISION

- persisted Guardian reputation/history;
- anti-Sybil/account caps;
- verified-unit → KC policy;
- daily/weekly emission controls;
- demand/rank multipliers;
- fraud/reversal handling.

## 18. What must NOT happen

- Do not let browser/localStorage decide KC.
- Do not expose a public HTTP endpoint that simply accepts `earnedCoins` or `workDone`.
- Do not trust self-declared region for competitive placement or rewards.
- Do not treat relay as authority.
- Do not send secrets/GitHub/Supabase service keys to Guardian nodes.
- Do not allow simultaneous authorities for the same zone/epoch.
- Do not claim that five devices become one CPU.
- Do not destroy the current central server before distributed authority is proven.
- Do not require players to keep iPhones alive in background as a reliability assumption.

## 19. Product experience target

Future player-facing state should eventually communicate real impact, for example:

```text
GUARDIAN MODE
Status: Helping
Role: EU HOT MIRROR
Useful time: 03:48:11
Players protected: 128
Verified traffic: 6.8 GB
Service units: +742
Rank: WARDEN ×2
Regional demand: HIGH
```

If the network does not need the device:

```text
STANDBY
Thanks for being available.
Your device is not being heavily used right now.
```

The UI must distinguish **available**, **assigned**, **doing verified useful work**, and **reward settled**.

## 20. Canonical one-sentence vision

> **Guardian turns opted-in KELO WORLD players into a coordinated, verified, region-aware pool of hosting/network/compute capacity, assigning each donor the work the world actually needs and rewarding verified contribution without surrendering central authority over gameplay or economy.**
