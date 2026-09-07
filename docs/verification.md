# MVP Validation Record

Validation Date: 2026-09-06. This record distinguishes actual runtime results, contract testing, and unverified sections.

## Actual Runtime Environment

- macOS ARM64, Node.js 26.7.0, Python 3.12.14.
- Next.js 16.3.4 / React 19.2.4 / Tiptap 3.31.3.
- FastAPI 0.135.1, SQLAlchemy 2.0.48, Alembic 1.18.4.
- **Real PostgreSQL 18.4**, development instance within the project, bound to `127.0.0.1:54329`.
- Application workspace `local-personal`; server-side testing uses an independent `meridian_test` PostgreSQL database.
- All three third-party services are explicitly set to Mock; browser flow still proceeds through Next.js → FastAPI → PostgreSQL.

## Results

| Check | Result | Actual Coverage |
| --- | --- | --- |
| PostgreSQL Migration | Passed | Alembic initial migration upgrade succeeded, `alembic check` no structural drift; attached `schema.sql` |
| Server-side Testing | **15 passed** | Full business flow, independent workspace, persona version, duplicate save, pagination, limits, errors, draft lock, parsing and variables |
| Browser Testing | **4 passed** | Chromium executed full form, search, save, edit, preview, copy, and refresh operations |
| TypeScript / Production Build | Passed | `npm run typecheck` and `npm run build`; no type or compilation errors |
| Application Health | Passed | `/api/health` returns `status=ok, database=postgresql`; frontend HTTP 200 |
| Full-stack Restart and Persistence | Passed | After stopping Next.js, FastAPI, and PostgreSQL, restarted with `SEED_DEMO=1 ./scripts/dev.sh`; all record IDs of 1 persona / 3 contacts / 2 drafts were fully retained |
| Demo Data Idempotency | Passed | Re-executing seed on restart prompted existence, no duplicate data created |
| Desktop and Mobile Layout | Passed | 1440×1000 and 390×844 screenshots; mobile page has no horizontal overflow, tables scroll horizontally internally |

## Completion Criteria Mapping

1. **Persona**: Manually created and modified, then refreshed to read; DOCX uploaded in browser, text PDF extracted on server side; name, education, skills, etc., fields match the file. Scanned/No-text PDF, illegal types, and damaged PDF return clear failure.
2. **Search and Recommendations**: 16 fictional people filtered by job, company, region, keyword, and field with pagination. Recommendations are constructed from the selected persona's exact targets and known fields while retaining the source ID and persona version.
3. **Save Contact**: Still exists after refresh; saving again shows already saved. Re-search reuses provider ID, no new contact created.
4. **Email Editing**: Enter editor from contact drawer, generate email with variables, manually modify subject and body. Separate validation for Chinese generation, and bold content saved and re-opened.
5. **Preview and Copy**: Replace recipient name, organization, and sender name with real database fields. Test read browser clipboard, confirming it contains final contact name. When variables are missing or unknown, the review button is unavailable, and the server also rejects.
6. **Full Mock**: Interface navbar, search row, recommendations, and generated content show Mock; fictional emails use `.example`. The entire flow does not call third-party APIs.
7. **Real Adapter**: Apollo parameters, restricted name/email, HTTP 403; SerpAPI links and up to three results; AI JSON format and error responses have isolated contract testing. No real keys, no real provider requests executed.
8. **Future Entrypoints**: Academic, Templates, Mailboxes, Inbox, Campaigns, Analytics, Settings all have usage descriptions and Coming Soon. Academic has no mentor data generated; Gmail shows not connected, no send success status.

## Special Verified Save Behavior

- Two PostgreSQL requests using the same draft version saved simultaneously: one 200, one 409; no silent override.
- Simulated a slow network request, changed the subject and body before the first save completed, then navigated away: the latest content was queued for saving and fully retained when the draft was reopened.
- Browser network request interrupted: shows Save failed, edit buffer still retained; recover network, click Retry save, then successfully persisted.
- Modify persona or contact: associated draft exits Reviewed state, increases version, requires re-check.
- Fix issue where Tiptap switching to read-only state accidentally triggered update; switching to read-only state does not reset review state.

## Unverified and Edge Cases

- **Apollo / SerpAPI / Live AI: No end-to-end live-account verification was performed.** Contract tests use controlled HTTP responses and therefore cannot prove account permissions, live data coverage, or costs.
- **Docker Compose: Configuration provided, current machine has no Docker, no actual container build/run.** Compose uses PostgreSQL 16; current actual verified local PostgreSQL is 18.4. Migration uses standard JSON, foreign keys, unique indexes, and row locks, no PostgreSQL 18-specific syntax.
- Single-user mode locally does not provide authentication and authorization required for public deployment.
- Mock resume field extraction depends on section titles; scanned documents do not do OCR, complex layouts may require manual completion.
- Recommendation selection and external service calls are executed synchronously, with per-call and per-minute limits, no multi-user stress testing done.
- Third-party dependency test client produces 2 deprecation warnings; tests passed, no impact on current runtime.

## Preview Screenshots

![Dashboard](dashboard.png)

![People Search](people-search.png)

![Email Studio](email-studio.png)

Mobile screenshot see [mobile.png](mobile.png). Screenshot uses fictional seed data, not representing real financial professionals.
