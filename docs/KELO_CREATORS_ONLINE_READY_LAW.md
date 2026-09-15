# Kelo Creators Online-Ready Law

This law applies to every Creator workspace and extension.

1. No Workspace depends directly on networking.
2. No Workspace writes directly to localStorage, IndexedDB, HTTP, WebSocket, or WebRTC.
3. Every persistent authoring mutation uses Commands.
4. Project persistence uses repositories.
5. Permissions use authorities/adapters.
6. Project and Instance are separate concepts.
7. Private Creator Instances may eventually be host-authoritative.
8. Kelo World LIVE remains server-authoritative.
9. Saving never means publishing.
10. Only an immutable approved Revision may be published.
11. Unpublished projects remain available to their owner/collaborators/testers according to capability.
12. Every online service must have a local/mock adapter for development and tests.
13. Network messages are data, never executable creator code.
14. Persistent IDs are stable.
15. Dependencies are explicit and versioned.
16. Preview/Test never mutates LIVE progression or economy.
17. A player-hosted session is temporary compute, never canonical source of truth.
18. Adding server infrastructure must replace adapters, not Workspaces.
19. A new Creator never creates another editor core.
20. Before creating a system, the implementer must demonstrate that an existing owner cannot be reused or extended.

## Architecture test

The architecture is online-ready only if future `RemoteCreatorProjectRepository`, `RemoteRevisionRepository`, `RemotePermissionAuthority`, `WebRTCSessionTransport`, `ServerSignalingService`, `RemoteReviewAuthority`, and `RemotePublishAuthority` can be wired at composition boundaries without changing Workspace implementations.
