# Connact.ai

A runnable Phase 1 MVP built with Next.js, React, TypeScript, Tiptap, FastAPI, SQLAlchemy, Alembic, and PostgreSQL.

Implemented: resume parsing or manually created persona → people search → evidence-based recommendations → save contact → generate and edit email → auto-save → final variable preview → copy content.

Does not include Gmail login, sending, auto-follow-up, sending queue, or scheduler. Future modules only have a clear Coming Soon page.

## Launch

### Docker Compose (Standard Way)

Requires Docker Engine / Docker Desktop and Compose v2. In the project root directory:

```bash
cp .env.example .env
docker compose up --build -d
# Optional: Import mock demo data; only allowed in Mock mode
docker compose exec backend python -m app.seed
```

Open <http://127.0.0.1:3100>, API documentation at <http://127.0.0.1:8000/docs>.

```bash
docker compose logs -f backend frontend
docker compose down
```

Database and uploaded files are stored in persistent volumes `postgres_data` and `uploads`. `down` retains data; do not run `down -v` when data retention is needed.

### Local Development (Without Docker)

Requires Node.js 22+, Python 3.12 (can specify interpreter with `PYTHON`), and internet for initial dependency installation. This repository includes an embedded-postgres launcher for development purposes, which starts a **real PostgreSQL service**, not an in-memory database or SQLite alternative.

```bash
chmod +x scripts/dev.sh
SEED_DEMO=1 ./scripts/dev.sh
```

Run `./scripts/dev.sh` afterward. Data persistence is in `data/postgres`, files in `data/uploads`; press Ctrl+C to stop the process started by the current script. Ports are 3100 / 8000 / 54329.

If PostgreSQL already exists, set `DATABASE_URL` in `.env` and run:

```bash
LOCAL_POSTGRES=0 ./scripts/dev.sh
```

Manual launch is also possible:

```bash
# Terminal 1: PostgreSQL inside the project
cd frontend
npm ci
node local-postgres.mjs

# Terminal 2: Backend, start from the project root directory
python3.12 -m venv backend/.venv
backend/.venv/bin/pip install -r backend/requirements.txt
cd backend
.venv/bin/alembic upgrade head
.venv/bin/python -m app.seed
.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000

# Terminal 3: Frontend
cd frontend
npm run dev
```

This development mode is only for local personal workspaces: no full authentication, session, or multi-user permission system. Compose only maps to `127.0.0.1`; the backend also validates Host and Origin. **Do not use this as a public deployment authentication scheme, and do not expose it via a public reverse proxy.**

## Demo and Usage

The seed command creates 1 fictional persona, 3 saved fictional contacts, and 2 drafts; running it again will not create new ones. Mock search includes 16 fictional people, with email addresses using the reserved `.example` domain. There are no real people, and no fabricated public-profile evidence links.

1. **Personas**: Create or select a persona, upload `demo/sample-resume.pdf` / `demo/sample-resume.docx`, check fields, edit, and save; you can also fill in everything manually.
2. **People Search**: Search by job title, company, region, keyword, or financial field. After selecting a persona, click **Recommend first 5**; you can also recommend one person individually in the details.
3. **Contact Details**: View information, source, acquisition date, persona version, and recommendation rationale; save, or trigger email enrichment or public-profile evidence separately. Re-saving an existing contact will prompt that it already exists.
4. **Email Studio**: Start writing an email from a contact or create a blank draft independently. Choose the contact purpose and writing starting point, then generate, shorten, or adjust the tone. You can also manually edit directly.
5. Drafts are automatically saved to the server approximately 650 ms after stopping input; page navigation will wait for the save first. You can click **Save draft**. If the save fails, the local edit is retained and a prompt is shown, but the save success is not displayed.
6. **Preview & copy**: Replace variables, check for missing items, and copy subject/body/entire content. Missing variables cannot be marked as Reviewed & ready. Missing email addresses do not prevent draft creation; Reviewed only indicates content review, not sending, email verification, or actual deliverability.

The language switcher in the top right corner toggles between English / Simplified Chinese; the language of emails in the editor is independently controlled and does not change with the interface language. The interface language is stored in the browser; all business data is stored on the server side.

Variables: `{{name}}` (contact full name), `{{company}}`, `{{title}}`, `{{school}}` (contact school), `{{sender_name}}` (persona name). Unknown, incomplete, or missing variables are clearly marked.

## API Configuration

All keys are only placed in the root directory `.env`, not in the browser or Git. Restart the backend after modification. Three modes are independent and explicitly set, not dynamically switched based on request success:

| Service | Mock | Live Mode Settings |
| --- | --- | --- |
| People Search / Email Enrichment | `PEOPLE_MODE=mock` | `PEOPLE_MODE=live` + `APOLLO_API_KEY` |
| Public-Profile Evidence | `PUBLIC_SEARCH_MODE=mock` | `PUBLIC_SEARCH_MODE=live` + `SERPAPI_API_KEY` |
| Persona Extraction / Recommendations / Writing | `AI_MODE=mock` | `AI_MODE=live` + `AI_API_KEY`, `AI_BASE_URL`, `AI_MODEL` |

AI interfaces use a configurable Chat Completions-compatible format, requiring support for `response_format: json_object` and `max_completion_tokens`. The default configuration example points to OpenAI; the model name can be modified according to the models available on your account. Missing keys return 503, upstream permission/request errors return explicit 502/429; no mock responses are returned secretly.

- Apollo Search: `POST /api/v1/mixed_people/api_search`. Job title → `person_titles`, region → `person_locations`, company domain → `q_organization_domains_list`, company name/financial field/keyword → `q_keywords`. **Company name and financial field are keyword matches, not exact industry classifications.** If a name or region is hidden by the provider, it will retain its restricted status and not be inferred or filled in.
- Apollo Email Enrichment: Separate `POST /api/v1/people/match`; no request for private emails or phone numbers. Whether an email is returned depends on real data and account permissions, and may consume Apollo quota.
- SerpAPI: `GET /search.json`, save up to 3 public search results; retain links, summaries, and acquisition dates, and mark unverified evidence. Do not automatically merge schools or shared experiences based on this.
- Max 10 people per page; max 5 recommendations per request. Emails and public-profile evidence are supplemented by users clicking individually. Recommendations for the same persona version/contact snapshot reuse cache; email enrichment cache is reused. Each real service has a default maximum of 20 calls per minute, with limits enforced on the server side, single-process operation.
- Mock AI is a reproducible rule-based generator with clear markings, not a call to a real large model. Mock resume extraction extracts based on Chinese and English section titles; if the layout is not standard, it may only extract partial fields, requiring manual input from the original text. It does not fabricate missing professional information.

Official documentation (as of 2026-09-06): [Apollo Search](https://docs.apollo.io/reference/people-api-search), [Apollo Enrichment](https://docs.apollo.io/reference/people-enrichment), [SerpAPI](https://serpapi.com/search-api), [Chat Completions](https://developers.openai.com/api/reference/cli/resources/chat/subresources/completions). Interface permissions, costs, and returned fields for real accounts are determined by the provider.

## Collaboration Design Between Apollo and LinkedIn Public-Profile Evidence

Apollo provides structured people search and on-demand email enrichment; SerpAPI retrieves LinkedIn public-profile evidence through Google search, supplementing professional background clues. Apollo's name, organization, or profile URL is used to locate LinkedIn; verified LinkedIn information is used to assist Apollo matching and enrichment. Results from both sources are associated with the same Contact, with sources, timestamps, and conflicts preserved separately. Search summaries can only be marked as unverified evidence and cannot automatically confirm the same person, overwrite fields, or be used for alumni statements. This is the target design of dual-source collaboration: the current MVP still uses a general Google query and has not yet implemented LinkedIn-targeted search, reverse matching, or automatic cross-verification.

SerpAPI is a search interface, and LinkedIn is the source of public-profile evidence. Target query examples are `site:linkedin.com/in/ "name" "organization"`, executed through SerpAPI's Google Search API, without using LinkedIn login or direct LinkedIn API calls. Coverage of the search depends on whether the public page is indexed; search hits, identity verification, and fact confirmation are recorded separately.

## Code Boundaries and Data Relationships

```text
frontend/components/       six usable pages, shared UI, contact drawer, Tiptap editor
frontend/lib/              types, request client, language context, serial auto-save
frontend/app/api/          same-origin server proxy; vendor calls not exposed to client
backend/app/models.py      Shared Core persistent models
backend/app/db.py          WorkspaceRepository: unified workspace data access
backend/app/routers/       Personas / Contacts / Finance / Drafts
backend/app/services/      file parsing, variable preview, contact evidence and matching logic
backend/app/providers/     four types of Provider protocol with Mock / Live implementations
backend/alembic/           generated upgradable/rollback migrations
backend/tests/             business, isolated, exception, adapter contract tests
frontend/tests/            browser end-to-end tests
demo/                     uploadable fictional resumes and textless PDFs
```

```mermaid
erDiagram
  Workspace ||--o{ Persona : scopes
  Persona ||--o{ PersonaRevision : versions
  Workspace ||--o{ UploadedDocument : protects
  Persona ||--o{ UploadedDocument : imports
  Workspace ||--o{ Contact : scopes
  Contact ||--o{ ContactDomainProfile : domains
  Contact ||--o{ SourceEvidence : cites
  Contact ||--o{ MatchAssessment : matches
  PersonaRevision ||--o{ MatchAssessment : evaluates
  Contact ||--o{ Draft : recipient
  Persona ||--o{ Draft : sender
```

All business tables have `workspace_id`, and client-specified workspaces are not accepted. The current workspace is determined by backend configuration, and queries and writes go through `WorkspaceRepository`; foreign key references also first look up through the current workspace. Contact provider IDs are unique within the workspace, and the save action updates the `saved` flag. Contacts found but not saved are retained as backend candidate records for associating sources and matches, and only `saved=true` contacts are displayed in Contacts.

Finance extensions are stored in `ContactDomainProfile(domain="finance")`; Academic only retains the location of page/field extensions. Persona modifications generate immutable `PersonaRevision`; `MatchAssessment` references persona version, contact snapshot fingerprint, and source ID. AI only selects comparison dimensions from existing data, and recommendation text is constructed by the server using exact field values, avoiding generating unverified shared experiences. Old version recommendations are not used for new personas.

Drafts associate contacts and personas, recording persona version and optimistic lock `revision`. Writes are validated through database row locks, not silently overwriting changes from other tabs. After modifying a persona or contact, associated drafts are returned to Draft and require rechecking. The server cleans up rich text and link protocols; during preview replacement, fields are escaped to prevent external data from being treated as HTML.

Uploads are only allowed for PDF/DOCX, 8 MB, PDF with 30 pages, and extracted text with 50,000 characters; encrypted/damaged/empty-text PDFs will fail, and no OCR is performed currently. Storage uses random filenames, private directories, and file permissions, with no public static file routing. Downloads must be through document IDs within the workspace scope.

Future Gmail, Inbox, and Campaign modules can reference the existing Contacts and Drafts directly. This phase does not include placeholder sending queues, Redis, schedulers, or fake account-connection logic.

## Verification

```bash
# Default uses an explicit isolated temporary SQLite test database; never clears the application database
cd backend
.venv/bin/python -m pytest -q

# When verifying real PostgreSQL, must pass a dedicated test database, which will rebuild business tables in it
TEST_DATABASE_URL=postgresql+psycopg://meridian:meridian@127.0.0.1:54329/meridian_test .venv/bin/python -m pytest -q

cd ../frontend
npm run typecheck
npm run build
npx playwright install chromium
# Start backend first; browser tests will create UI test / Uploaded demo record
npm run test:e2e
```

See [docs/verification.md](docs/verification.md) for the exact verification scope and results. The Apollo, SerpAPI, and AI live adapters have contract tests, but no live API keys were provided, so live-provider end-to-end verification is not claimed. Docker was unavailable on the verification machine, so Compose containers were not tested; the local PostgreSQL, FastAPI, and Next.js stack was started and verified.

## Project Naming and Design Documents

Product name is uniformly **Connact.ai**. See [Naming Guidelines](docs/naming.md); the latest [Design Delivery Package](outputs/connact-ai-design-package/README.md) includes Word, Demo, feature list, and four-phase Prompts.
