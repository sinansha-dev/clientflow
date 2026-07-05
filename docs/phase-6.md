# ClientFlow Phase 6

Phase 6 adds the client portal, collaboration APIs, and a richer file management foundation.

## Included

- Client portal dashboard at `/portal`
- Portal APIs under `/portal`, `/files`, `/folders`, `/approvals`, `/revisions`, and `/messages`
- Client-safe project access rules
- Foldered project files with visibility, version, deliverable status, download counts, and soft delete
- Approval and revision request workflow
- Project-specific portal messages
- Meeting and activity timeline visibility
- Download logging with short-lived signed download metadata

## Local Database

Run migrations after pulling this phase:

```bash
npm run prisma:migrate -w apps/api
npm run prisma:seed -w apps/api
```

The local API `.env` must point at the active PostgreSQL port. Docker Compose maps PostgreSQL to `localhost:5435` in this workspace.
