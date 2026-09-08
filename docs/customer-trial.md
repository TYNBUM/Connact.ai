# Invitation-only customer trial

The app is runnable locally with live providers. This guide prepares a **small, single-server invitation trial**. A public server, domain and TLS certificate have not been supplied or deployed in this task. Gmail sending is not connected; users can copy reviewed messages or export an unsent `.eml` file for their email client.

## Local operation

Keep `AUTH_MODE=local` and run `./scripts/dev.sh`. Open `http://127.0.0.1:3100`. Existing personal data remains in its original workspace. Provider credentials live only in the server `.env`; do not put them in `NEXT_PUBLIC_*` variables. `AI_MODELS` is a comma-separated allowlist; every saved draft records its selected model.

## Trial hosting

Use one backend process and one PostgreSQL database. Copy `.env.example` to the server `.env` and configure its own database, upload storage, provider keys and live modes. Set:

```dotenv
AUTH_MODE=invite
PUBLIC_ORIGIN=https://your-customer-domain.example
PUBLIC_HOST=your-customer-domain.example
ALLOWED_HOSTS=backend,localhost,127.0.0.1,your-customer-domain.example
```

Replace the example host with a real domain. Both the frontend proxy and backend require the same exact `PUBLIC_ORIGIN`. Start with:

```bash
docker compose -f compose.yaml -f compose.invite.yaml config --quiet
docker compose -f compose.yaml -f compose.invite.yaml up --build -d
```

Use `config --quiet` for validation: printing the resolved Compose configuration would expose provider credentials from the server `.env`. The invitation override passes the same `PUBLIC_ORIGIN` to the frontend proxy and backend; `PUBLIC_HOST` must be the hostname from that URL, without a scheme or path.

Compose keeps database, API and frontend ports bound to loopback. Configure the server's HTTPS reverse proxy to forward the domain to `127.0.0.1:3100`; retain normal TLS validation and a request-body limit above 8 MB for resumes. Serve only the frontend publicly, with API access passing through its proxy. Do not run `AUTH_MODE=local` behind a public proxy.

The frontend image copies standalone code, static files and public brand assets with ownership assigned to its unprivileged `node` user. Build contexts exclude `.env*`, `.next*` (including Playwright build directories), dependencies and test artifacts. The backend image creates its upload directory for the unprivileged `meridian` user. Compose uses a named upload volume; if replacing it with a bind mount, prepare the host directory for that container user's UID/GID before starting the backend. Keep the existing database and upload volumes when rebuilding images.

The backend refuses a public origin in local mode and requires HTTPS for customer origins. Sessions use random opaque tokens; only their SHA-256 hashes are stored, with expiry and server-side revocation. Cookies are HttpOnly, SameSite=Strict and Secure on HTTPS. Passwords use salted scrypt. Workspace identity comes from the authenticated session, never a request's workspace header or body.

## Invite one customer

Inside the backend environment, after migrations:

```bash
python -m app.invite customer@example.com --output /app/data/uploads/customer-invitation.txt
```

The command creates a single-use, email-bound invitation valid for seven days and writes the code into a new file with mode `0600`. It does not email the customer or print the code to logs. Privately provide the customer their code and the site URL. They select **Have an invitation? Create account**, enter the invited email and choose a password. Their workspace starts empty; the local owner's data is not imported or shared.

For a local authentication smoke test, use `AUTH_MODE=invite` with `PUBLIC_ORIGIN=http://127.0.0.1:3100`, restart the server, then create a test invitation. Local HTTP omits the Secure cookie flag; real hosting must use HTTPS.

## Operation and practical limits

- Back up PostgreSQL and the upload directory together. Apply Alembic migrations before starting workers. Keep a tested restore procedure before collecting customer data.
- Single-process workers consume persistent jobs. Queued tasks resume; ambiguous interrupted chargeable calls become visible failures instead of silently being billed again. Apify jobs persist upstream run IDs and resume polling an existing run.
- Search cache: one hour. Profile/email cache: seven days by default. Manual identity edits invalidate contact-task cache. Explicit refresh can incur another provider charge.
- Apify calls are one profile at a time with a configurable per-run maximum charge (`APIFY_MAX_CHARGE_USD=0.05`). Its work-email lookup is an explicit alternative, never a hidden fallback after Apollo fails.
- Provider and sign-in rate limits are in one process. Multiple replicas, distributed quotas and per-customer billing are outside this trial deployment.
- There is no self-service password recovery, customer billing, email verification or administrative account-management UI yet. Account access problems need operator support. Public self-registration remains disabled.
- A provider's successful response is not a promise that every field or email exists. Third-party profile claims retain provenance. Delivery is not verified by this app, and phone numbers are not requested.

Before expanding beyond invited users, add the operational account-recovery process, per-customer quotas, monitoring and tested backups. This guide does not assert that a public deployment or Gmail OAuth has already been completed.

## Container verification on 2026-09-08

Docker Desktop Engine and CLI 29.7.2 were available through the installed application bundle. Both the base Compose file and invitation override passed `config --quiet`. An actual BuildKit export using `FROM scratch` confirmed the frontend context excluded `.env*`, `.next*` and `node_modules` (34 files, approximately 338 kB at verification).

Both `coldemail-backend` and `coldemail-frontend` images built successfully. The initial client configuration encountered a missing credential helper and then a base-image metadata timeout; a temporary, anonymous Docker client configuration succeeded without changing the existing Docker account or configuration.

Isolated containers ran without network access or published host ports. The frontend ran as UID 1000, served its homepage, JavaScript and both logo variants with HTTP 200, and wrote its Next.js cache successfully. The backend ran as UID 1000; a fresh anonymous upload volume inherited writable UID 1000 ownership. All migrations and `alembic check` passed against a temporary SQLite database inside the container, and health and draft creation returned HTTP 200. Invitation mode also started with the configured HTTPS origin, rejected a different origin with HTTP 403, and required authentication for workspace data.

The combined Compose stack, PostgreSQL 16 container, public DNS/TLS routing and customer traffic were not started or tested. No host ports were published, no existing volumes were mounted, and the running local database was unchanged. Validate those remaining deployment paths on the intended customer server before inviting users.
