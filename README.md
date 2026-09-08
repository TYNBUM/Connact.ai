# Connact.ai

A runnable networking and AI email-writing workspace with persistent background jobs, optional invitation accounts, and Next.js, React, TypeScript, Tiptap, FastAPI, SQLAlchemy, Alembic, and PostgreSQL.

Implemented: resume parsing or manually created persona → people search → evidence-based recommendations → save contact → generate and edit email → auto-save → final variable preview → copy content.

Includes live SerpAPI discovery, Apify professional profiles and optional work-email lookup, Bailian multi-model writing, independent saved personas/contacts/drafts, asynchronous suggestions, and `.eml` export. Gmail OAuth, in-app sending and automated sequences are not implemented.

See [September 8 delivery and validation](docs/customer-ready-2026-09-08.md), [customer trial setup](docs/customer-trial.md), and [Apollo Sequence design observations](docs/apollo-sequence-writing.md).

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

Default `AUTH_MODE=local` is a personal development workspace and must stay bound to localhost. Optional `AUTH_MODE=invite` adds invitation registration, password login, expiring/revocable HttpOnly sessions, and a separate server-derived workspace for every customer. Use the [invitation trial deployment guide](docs/customer-trial.md) for HTTPS hosting. Run one backend process; workers and rate limits are not distributed.

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
| People Search / Email Enrichment | `PEOPLE_MODE=mock` | `PEOPLE_MODE=live` + `SERPAPI_API_KEY` (search), `APIFY_API_KEY` (profiles/work email), `APOLLO_API_KEY` (optional Apollo email) |
| Public-Profile Evidence | `PUBLIC_SEARCH_MODE=mock` | `PUBLIC_SEARCH_MODE=live` + `SERPAPI_API_KEY` |
| Persona Extraction / Recommendations / Writing | `AI_MODE=mock` | `AI_MODE=live` + per-vendor API keys; legacy `AI_API_KEY` / `AI_BASE_URL` also supported |

AI interfaces use a configurable Chat Completions-compatible format, requiring support for `response_format: json_object` and `max_completion_tokens`. The default configuration example points to Bailian; the model name can be modified according to the models available on your account. Missing keys return 503, upstream permission/request errors return explicit 502/429; no mock responses are returned secretly.

- People Search: SerpAPI `GET /search.json`, `engine=google`, query `site:linkedin.com/in/` plus title/company/location/finance area/keywords. Returns up to 10 Google hits per page, filters out non-person URLs and duplicates, and saves each person's canonical LinkedIn URL. Google total is an estimate, not a count of verified people; pagination follows Google's next-page signal.
- Apollo Email Matching: Select a person and click **Match with Apollo & get email**. The backend sends their LinkedIn URL to `POST /api/v1/people/match`. No Apollo People Search call precedes discovery. Existing Apollo-origin contacts can still enrich by Apollo ID. No request for personal emails or phone numbers. A different/missing returned LinkedIn URL or low/none match confidence is rejected without changing contact data. No match and matched-but-no-email have distinct states.
- Evidence: Google title/snippet/link remain unverified SerpAPI evidence; search filters are never copied into company/location/sector facts. Apollo adds separate enrichment evidence on the same Contact. Identity or email edits invalidate the enrichment cache. Additional public-source lookup remains available through `PUBLIC_SEARCH_MODE`, with up to 3 results per request.
- Max 10 people per page; max 5 recommendations per request. Emails and public-profile evidence are supplemented by users clicking individually. Recommendations for the same persona version/contact snapshot reuse cache; email enrichment cache is reused. Each real service has a default maximum of 20 calls per minute, with limits enforced on the server side, single-process operation.
- Mock AI is a reproducible rule-based generator with clear markings, not a call to a real large model. Mock resume extraction extracts based on Chinese and English section titles; if the layout is not standard, it may only extract partial fields, requiring manual input from the original text. It does not fabricate missing professional information.

Official documentation (as of 2026-09-06): [Apollo Search](https://docs.apollo.io/reference/people-api-search), [Apollo Enrichment](https://docs.apollo.io/reference/people-enrichment), [SerpAPI](https://serpapi.com/search-api), [Chat Completions](https://developers.openai.com/api/reference/cli/resources/chat/subresources/completions). Interface permissions, costs, and returned fields for real accounts are determined by the provider.

## Collaboration Design Between Apollo and LinkedIn Public-Profile Evidence

The implemented sequence is **SerpAPI Google discovery → canonical LinkedIn URL → saved Contact**, with separate optional **Apify profile retrieval**, **Apollo/Apify work-email retrieval**, and **AI drafting** actions. Search does not automatically enrich every result; open the desired person and request their email. The canonical LinkedIn URL is the identity key, and returning to the same search reuses the Contact without discarding a previously enriched email.

SerpAPI searches Google-indexed public pages; it is not a direct LinkedIn API integration. The headline and snippet can be incomplete or stale. Apollo's returned profile URL must match before structured name, title, employer, location and email are attached. A URL match is identity consistency, not independent verification of every biographical claim or email deliverability.

On 2026-09-07, live Google discovery returned 9 unique profiles for Goldman Sachs / Investment Banking / New York. Apollo was called with a discovered profile but returned HTTP 403 `API_INACCESSIBLE`: this account's Free plan excludes `people/match`. The app preserves search results and displays the permission error; real email retrieval remains blocked by account access. See [verification details](docs/verification.md).

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

Future Gmail, Inbox, and Campaign modules can reference existing Contacts and Drafts directly. PostgreSQL stores background people tasks, writing suggestions and resume parsing results; single-process workers execute them. No email-send queue or automatic sequences exist.

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

See [docs/verification.md](docs/verification.md) for the exact verification scope and results. The adapters have contract tests. Live Google discovery has been verified; Apollo email retrieval is blocked by the account plan (HTTP 403). On 2026-09-08, Bailian Qwen Plus/Turbo/Max calls and the asynchronous generation-to-acceptance flow were verified. See the dated delivery report for details. Frontend/backend Docker images and isolated containers were subsequently verified; the complete Compose stack and public hosting remain unverified. See [customer trial verification](docs/customer-trial.md). The local PostgreSQL, FastAPI, and Next.js stack was started and verified.

## Project Naming and Design Documents

Product name is uniformly **Connact.ai**. See [Naming Guidelines](docs/naming.md); the latest [Design Delivery Package](outputs/connact-ai-design-package/README.md) includes Word, a bilingual offline Demo, the feature roadmap, and four phased prompts. A complete Chinese-language snapshot is retained at `outputs/connact-ai-design-package-zh-CN.zip`.

### Multi-provider AI model selection

The writing selector separates the API service from the model author. **One existing
Bailian MaaS key supports Qwen, DeepSeek, Kimi, GLM, and MiniMax through the same
Bailian endpoint**; separate original-vendor keys are needed only for direct routes.
The `Bailian MaaS` group reuses the configured Bailian `AI_API_KEY` when the official
endpoint matches exactly, or uses `DASHSCOPE_API_KEY`. MiniMax retains its required
thinking mode. Mock mode remains explicitly simulated for every model choice.

The default list contains only Bailian models and the existing Qwen Plus/Turbo/Max
options. Earlier direct-provider presets and duplicate Qwen entries were removed;
other endpoints require explicit `AI_PROVIDERS` configuration. Set
`AI_DEFAULT_MODEL=bailian/deepseek-v4-flash`
to use Bailian DeepSeek as the workspace default, or choose a model per draft.
`AI_PROVIDERS` overrides model lists and endpoints. Existing drafts remain supported.
On 2026-09-08 the existing Bailian key returned 249 catalog entries; small JSON calls
succeeded for Qwen3.8-Flash, DeepSeek V4 Flash, Kimi K3, GLM 5.2 and MiniMax-M2.5.
Catalog visibility alone does not mean every model or third-party service is enabled.
See [configuration and verification](docs/ai-model-providers.md).
