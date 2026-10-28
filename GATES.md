# Gates

A phase starts only after the previous phase's gate is reviewed. Reviewer: Jinx (build brief, section 9, item 10). Record the verdict as given; never infer a pass.

| Phase | Gate | Status |
|---|---|---|
| 0 | Build brief with decisions answered | Passed 2026-10-26 (decisions recorded in brief section 9) |
| 1 | `pnpm check` and CI green; the stack deployed to Cherry AS; `https://community.pocket.network/health/live` names the deployed commit over TLS | Passed 2026-10-28 (Jinx) |
| 2 | Schema and migrations (up/down/up clean in CI); core rules with unit, integration and adversarial tests | Passed 2026-10-28 (Jinx) |
| 3 | Discord sign-in with guild check; database sessions; admin bootstrap; adversarial authz suite | Built and deployed 2026-10-28, awaiting review (first live sign-in made Jinx admin) |
| 4 | Ambassador flows 1–7 | Built 2026-10-28, awaiting review (smoke-tested locally on demo data; not deployed) |
| 5 | Admin flows 8–12 | Not started |
| 6 | Discord worker, outbox, role sync against a test guild | Not started |
| 7 | Off-host backups with a restore drill; 60-day proof retention verified; launch | Not started |
