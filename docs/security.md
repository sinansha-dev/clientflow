# Security Notes

ClientFlow Phase 1 uses signed, HTTP-only cookies for access and refresh tokens. Access tokens are short-lived, refresh tokens are persisted as hashes, and refresh token rotation revokes the previous token whenever a session is refreshed.

The API applies Helmet, CORS with credentials for the configured web origin, request rate limiting, Zod validation, bcrypt password hashing, and response redaction in logs.

CSRF strategy: cookies use `SameSite=Lax` by default. Production deployments should keep API and web origins same-site where possible. For cross-site deployments, add a double-submit CSRF token on mutating requests before switching cookies to `SameSite=None`.

## Recurring Services (AMC) & Cron Security

When deploying automated invoicing for recurring service contracts, make sure the cron/scheduler configuration meets the following security guidelines:

1. **Strict Access Controls:** The cron trigger endpoint (`POST /recurring-services/trigger-cron`) must enforce strict authentication (`requireAuth`) and role authorization (`requireRole('ADMIN')`) to prevent unauthorized triggering of invoice cycles.
2. **Secure Token Storage:** If pings are scheduled via external cron tools (e.g., standard crontab, GCP Cloud Scheduler, GitHub Actions), the required administrator JWT token must be stored as a secure environment variable or vault secret. Access tokens must never be hardcoded in deployment scripts.
3. **Internal CLI Scripts:** Where feasible, trigger billing runs using an internal backend CLI script executing locally on the host. Bypassing public HTTP endpoints via a direct Prisma database transaction reduces the attack surface and prevents network exposure of administrative access tokens.
