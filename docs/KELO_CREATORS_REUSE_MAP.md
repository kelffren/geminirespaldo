# Kelo Creators — Reuse Map

PR A begins by preserving current owners. “New” means a missing cross-workspace contract/envelope, not a replacement runtime. This map was revalidated after Foundation V3 and Kelo Studio Creator V1 landed on `main`.

| Responsibility | Current owner | Reuse method | New owner? |
|---|---|---|---|
| Editor kernel | `src/studio/core/studio-kernel.mjs` | direct composition | No |
| Commands | Studio `CommandBus` | all persistent workspace mutations route through it | No |
| History | Studio `HistoryManager` | shared history per Studio session | No |
| Input | Studio `InputRouter` + pointer adapter | context registration / input locks | No |
| Selection | Studio `SelectionManager` | shared | No |
| Tools | Studio `ToolRegistry` | register domain tools later | No |
| Components | Studio `ComponentRegistry` | schema extensions | No |
| Prefabs | Studio `PrefabRegistry` + Property catalog seeder + Creator V1 prefab library | registry/adapter | No |
| Preview rendering | Studio overlay renderer/canvas + Creator V1 asset preview service | compose | No |
| Camera / viewport / screen↔world | Foundation `KeloCamera` + Studio camera controller | adapter/controller reuse; never create another global camera owner | No |
| Compiler | Studio compiler + worker client | reuse per supported document | No |
| Spatial/dirty chunks | `SpatialChunkIndex` / `DirtyChunkManager` | direct | No |
| Crash recovery | `indexeddb-studio-store.mjs` | checkpoint/journal only | No |
| Permissions | `KELO_ADMIN_KEYS` | `CreatorPermissionAdapter` | Adapter only |
| World authority | `KELO_WORLD_EDIT` | World compatibility adapter | No |
| World authority readiness | `KELO_WORLD_EDIT.whenReady()` | World adapter/workspace waits for existing owner | No |
| World draft persistence | `KELO_WORLD_DRAFT_STORE` behind World authority | delegate; never reuse as generic DB | No |
| Collisions | existing collision/runtime + World authority ops | commands/adapters | No |
| Terrain | existing World Builder/World authority terrain ops | commands/adapters | No |
| Placements/Property | `KELO_PROPERTY_SYSTEM` / PropertySystem | existing runtime adapter | No |
| Global navigation | Luxe menu | evolve tiny Studio launcher to CREATORS | No |
| World Draft lifecycle | `KELO_WORLD_EDIT` | status mapping only | No |
| World revisions/review/publish/audit | existing World authority/revision system | future generic adapters delegate | No |
| Asset catalog | Property/Studio asset adapter | filter/context later | No |
| Validation | Studio Foundation + Creator V1 gates; domain validators later | compose, do not centralize prematurely | No new engine |
| Performance | Studio profiler, workers, chunks, virtual list | reuse | No |
| Mobile input | pointer adapter + `KeloInputLocks` + `KeloCamera` | reuse | No |
| Project envelope/lifecycle | Missing cross-workspace concept | pure model | **Yes** |
| Revision envelope | Missing cross-workspace metadata | adapter-friendly immutable model | **Yes** |
| Asset metadata | Missing cross-workspace envelope | metadata only | **Yes** |
| Instance envelope | Missing project-independent session identity | pure model | **Yes** |
| Workspace discovery | Missing | `CreatorWorkspaceRegistry` | **Yes** |
| Project persistence boundary | Missing | repository contract + local composition | **Yes** |
| Cross-project dependencies | Missing | metadata graph; does not replace registries | **Yes** |
| Future session transport boundary | Missing | Loopback contract implementation only | **Yes** |
| Creator Hub | Missing | lazy UI behind existing Luxe launcher | **Yes** |

## Non-goals for PR A

No Animation, VFX, Ability, Timeline, Graph, TestLab, WebRTC, WebSocket, remote backend, InviteService, ProjectLockService, second World editor, second collision system, second PropertySystem, second camera owner, or legacy Builder deletion.
