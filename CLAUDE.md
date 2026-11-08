# Job Tracker: agent instructions

Personal job-search tracker (pnpm monorepo: `apps/api`, `apps/web`, `apps/worker`, `packages/shared`, `infra`).

## Keep the docs in sync with the code (mandatory)

The docs are the source of truth for *why* the system is the way it is. Code that drifts from them is a bug.

| If your change affects... | Update |
| --- | --- |
| Product behaviour, scope, rules, user-facing flows, what is Built/Planned | `docs/requirements/NN-*.md` and the status in `docs/PRD.md` |
| Architecture: layering, modules, auth, MCP, deployment, infra, testing, security, key decisions | `docs/ARCHITECTURE.md` |
| Data model: entities, fields, enums, keys, GSIs, markers, transactions, access patterns, derived data | `docs/DATA-MODEL.md` (ERD and physical tables) and the "Item types" section of `docs/ARCHITECTURE.md` |

### Rules

1. **Same change, same commit.** Update the affected docs in the same change as the code, not as a follow-up. Do not leave it for later.
2. **Check before you finish.** Before ending any turn that edited code, ask: did this touch product behaviour, architecture, or the data model? If yes, open the relevant doc and update it. If no, say nothing.
3. **Check before you start.** When a task changes behaviour, read the relevant doc first. If the request contradicts what the doc says, that is a **collision**.
4. **Collisions must be surfaced, never silently resolved.** Do not quietly overwrite the doc or quietly ignore it. Tell the user: what the doc says, what the request/code does instead, and ask whether the change is intentional. Once the user confirms, update the doc so it reflects the new decision (and record it under "Key decisions" in `ARCHITECTURE.md` if it is a real design change). If it is not confirmed, follow the doc.
5. **If the user said to skip docs**, or the change is internal-only (refactor with no behaviour, key, or structure change; formatting; tests), no doc update is needed.
6. **Prove it from the code.** Write docs from what the code does, not from memory (for example, read the repository and mapper files before editing `DATA-MODEL.md`).
7. In the final message of a turn that changed docs, list which doc files were updated and why, in one line.

### Pointers

- Entity or key change: also update the ERD (Mermaid `erDiagram`) and the key-layout table in `docs/DATA-MODEL.md`, plus the access-pattern and transaction tables if they are affected.
- New or changed requirement: keep `docs/PRD.md` status (Built / Planned) accurate.
- Docs index: `README.md` links to all three doc areas. Add a link there if you add a new doc file.
