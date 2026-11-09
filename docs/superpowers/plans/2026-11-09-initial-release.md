# Brain Training Web Implementation Plan
> For agentic workers: implement assigned independent files against fixed contracts, then review full integration.
**Goal:** Windows LAN40-game app with browser-device accounts, age/numeracy and repeatable deployment.
**Architecture:** React/TS + single ASP.NET Core/SQLite host.
**Tech Stack:** SDK10.0.403, Node24.22.1, React/Vite, SQLite, browser tests.
**Spec:** docs/superpowers/specs/2026-11-09-brain-training-design.md

## Global Constraints
Windows, port8787, server-side persistent browser/account/run isolation,40 playable games, all age/numeracy metadata, original/permitted code/assets, no runtime data inGit, existing checkout preserved, no Actions/Artifact.

## Review Focus
- IP change/cookie reset and cross-device enumeration.
- Wrong-device login, CSRF, unauthorized record access.
- Hardest levels remain solvable; sorting/OR/multiple answers/directed routes.
- Deploy failure or unrelated port occupation preserves current app/data.
- Touch cancel, backgrounding, session switch and repeated saves.

### Task1 Backend
Own server/** and tests/BrainTraining.Server.Tests/**. Consume/produce exactHTTP contract.
- [ ] Write/run failing integration tests: device separation, multiple accounts, passwords, CSRF, idempotent save/restart.
- [ ] Implement Identity hash/cookie, EF SQLite, API/static host, loopback inventory.
- [ ] Run full backend tests and commit.

### Task2 GamesA1..14
Own groupA.tsx/groupA/** with tests.
- [ ] Failing tests: ordered/unordered, counting filters, arithmetic precedence, rotation.
- [ ] Implement actual seeded level-scaled interactions.
- [ ] Run tests/commit.

### Task3 GamesB15..27
Own groupB.tsx/groupB/** with tests.
- [ ] Failing tests: numeric sort, OR, semantics, n-back once, valid inventory slips.
- [ ] Implement13 views/engines; run tests/commit.

### Task4 GamesC28..40
Own groupC.tsx/groupC/** with tests.
- [ ] Failing tests: circle validity, folds/cubes, multiple solutions, directed weighted checkpoints/Hanoi legality.
- [ ] Implement13 touch/puzzle games; run tests/commit.

### Task5 Windows deployment
Own bootstrap.ps1/scripts/**/docs/windows-deployment.md.
- [ ] Failing tests: fresh/existing checkout, port conflict, build/health failure data safety.
- [ ] Implement verified tools, staging publish/start/stop/rollback/fixed8787.
- [ ] Parse/test underPowerShell, document actualWindows gaps; commit.

### Task6 Shell/integration
Own shared contracts/catalog/App/styles/config/docs.
- [ ] Test40 metadata/filters, then implement responsive catalog/account picker/3-roundhost/records/device pages.
- [ ] Build full client/server; test40 games simple/mid/hard, auth and phone/tablet layout, restart data.
- [ ] Independent review/fix, record evidence and publish main after pass.
