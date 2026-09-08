# People discovery and enrichment

Verified on 2026-09-08. These are independent actions and may be used without a persona or an email draft.

- **Discover:** SerpAPI Google search targets `site:linkedin.com/in/`. Google titles/snippets are discovery evidence, not full profiles or proof that every filter matches. Canonical LinkedIn URLs identify results; repeated searches preserve saved edits and enrichment.
- **Professional profile:** Apify `harvestapi/linkedin-profile-scraper`, using `queries: [one public LinkedIn URL]` and `Profile details no email ($4 per 1k)`. Only returned professional fields are stored: summary, headline, location, work experience, education and skills. Missing fields remain missing. No LinkedIn cookies or browser login are supplied.
- **Email:** The user selects Apollo or Apify. Apollo `people/match` requires API-plan access and confirms the same canonical profile. Apify's separate `Profile details + email search ($10 per 1k)` mode is an explicit paid action. An Apollo denial never automatically starts Apify. Personal-typed emails and common consumer-mail domains are excluded from Apify candidate selection. Missing email type is disclosed as unknown. Empty results preserve an existing contact address.
- **Phone:** Phone lookup is not enabled. Contacts explicitly report `phone_status: not_requested`; empty phone data is listed as missing. Neither the public-profile task nor email task asks Apollo to reveal a phone number.
- **Verification:** No address is considered verified merely because a LinkedIn profile has a verified badge, the Actor's marketing mentions SMTP checks, or an email exists. Apollo's explicit email status is retained as a provider claim. Apify's result status is retained in the job/source evidence, while the address stays unverified by this application.

## Observed live checks

| Check | Observed outcome |
|---|---|
| SerpAPI, one finance query | HTTP 200, 10 LinkedIn results |
| Apify, one discovered public profile | SUCCEEDED; 5 work entries, 3 education entries, 0 skills; one profile event, USD 0.004 |
| Apollo, same canonical profile | HTTP 403 / API_INACCESSIBLE; current account has no `people/match` access |
| Apify email search, same finance profile | SUCCEEDED; `emails: []`; one profile-with-email event, USD 0.010 |
| Apify email search, Tim Zheng public business profile | SUCCEEDED; one non-free-domain address returned; provider reported `valid`, `deliverable=true`, `catchAllDomain=false`, `validEmailServer=true`, `qualityScore=80`; USD 0.010 |

Total observed Apify charge for these three probes: **USD 0.024**. The first two submissions set `maxTotalChargeUsd=0.05`; the additional business-email probe set `maxTotalChargeUsd=0.01`. Each used `timeout=180`, `memory=256`, and a single URL. The additional profile URL was verified from [Tim Zheng’s public LinkedIn profile](https://www.linkedin.com/in/tim-zheng) before the run. These checks demonstrate real discovery, professional-profile extraction, and email retrieval. The application still labels the returned email unverified and preserves the provider’s check results separately. A two-person email sample is not a coverage estimate or a guarantee of delivery; no email was sent. Provider coverage and prices may change.

Actor input schema was read from the official Apify build API for build `0.0.135`, then exercised with the account's server-side credentials. References: [Actor documentation](https://apify.com/harvestapi/linkedin-profile-scraper), [Actor API](https://apify.com/harvestapi/linkedin-profile-scraper/api), [Apify run API](https://docs.apify.com/api/v2/actors-runs-post).

## Durable API contract

- `POST /api/finance/search/jobs` accepts the existing search filters and returns HTTP 202 `{job, cached}`.
- `GET /api/finance/search/jobs` lists the most recent 20 searches in the authenticated workspace. `GET /api/people/jobs/{id}` returns a job and, after success, its current contacts/results.
- `POST /api/contacts/{id}/jobs` accepts `{kind: "profile" | "email" | "email_apify", force?: false}`. `email` means Apollo in live mode. A request contains one contact.
- `POST /api/people/jobs/{id}/retry` resumes an explicitly retryable failure; submitted Apify jobs keep the original upstream run ID.
- Contact responses include `professional`, `missing_fields`, and recent `jobs`, alongside existing `sources`, `domains`, and `assessments`.
- Statuses: `queued`, `running`, `waiting`, `succeeded`, `failed`. Searches cache for one hour; successful profile/email jobs cache for `PEOPLE_CACHE_HOURS` (168 by default). Manual contact identity/context edits invalidate related caches and reject stale in-flight results.
- Navigating away does not cancel a job. Search history and contact task status restore from the database. On server restart, known Apify run IDs resume polling; an uncertain paid submission is surfaced for provider-console review instead of automatically submitted again. Transient run/dataset reads retry with bounded backoff.

The worker is intended for the current **single API process** deployment. Use one Uvicorn worker. A multi-process deployment needs a shared lease/queue strategy for startup recovery and account-wide rate/billing controls. Provider keys stay on the backend; never add them to public frontend environment variables.

Migration `c216770d1002` adds the durable people jobs table after writing migration `9c3b2f1a7001`. Public professional details use the existing `ContactDomainProfile` JSON storage; no destructive contact migration is required.
