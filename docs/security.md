# Security Notes

ClientFlow Phase 1 uses signed, HTTP-only cookies for access and refresh tokens. Access tokens are short-lived, refresh tokens are persisted as hashes, and refresh token rotation revokes the previous token whenever a session is refreshed.

The API applies Helmet, CORS with credentials for the configured web origin, request rate limiting, Zod validation, bcrypt password hashing, and response redaction in logs.

CSRF strategy: cookies use `SameSite=Lax` by default. Production deployments should keep API and web origins same-site where possible. For cross-site deployments, add a double-submit CSRF token on mutating requests before switching cookies to `SameSite=None`.
