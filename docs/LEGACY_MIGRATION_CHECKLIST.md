# Legacy Migration Checklist

Use this checklist for every authority migration.

- [ ] Current behavior captured by characterization tests
- [ ] Observatory report reviewed
- [ ] All known readers listed
- [ ] All known writers listed
- [ ] Modern owner named
- [ ] Protected contracts listed in migration manifest
- [ ] Duplicate writers removed or adapted
- [ ] Rollback path verified
- [ ] Domain switched to SHADOW
- [ ] Shadow divergences recorded and explained
- [ ] Mobile/LIVE checks pass where relevant
- [ ] Migration gate passes
- [ ] Domain switched to NEW
- [ ] Legacy access reduced to read-only/adapter
- [ ] Consumers of adapter counted
- [ ] Adapter deleted only when consumers reach zero

A checked box is evidence, not intention. If evidence is missing, the migration stays in LEGACY or SHADOW.
