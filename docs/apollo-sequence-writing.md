# Apollo Sequence writing observations — 2026-09-08

Observed in the user's signed-in Chrome session, in the existing `Yinba's Outbound AI Sequence 1` editor. No recipient was added and no send was performed. This describes visible product behavior, not Apollo's proprietary prompts or backend implementation.

Each email step exposes **Assisted / Prompt / Template**. Template mode contains a subject, rich body, recipient/sender variables, and a separate **Generate preview for contact** area. Contacts can be selected later. A follow-up step can use **Reply** and inherit the previous subject. Sequence-level editor, contacts, emails, activity and settings are separate views.

**Write with AI** opens an AI variable panel: AI snippet, AI subject line, and existing AI variable. The snippet editor offers a Context selector, snippet type, AI research, tone and optional guidelines, then **Submit & preview**. The Context menu opens a separately saved **AI context center**, with Company profile and Product profiles. Its visible company fields include offering, customer profile, pain points, value proposition, advantages, social proof, CTA and additional instructions.

Switching an existing template to Assisted displayed a warning that it might overwrite changes. That switch was cancelled. The visible configuration and [Apollo's writing documentation](https://knowledge.apollo.io/hc/en-us/articles/15396174946445-Use-the-Writing-Assistant-to-Compose-Emails) establish preview/insert, independent context and evidence selection as the useful behaviors to adapt.

## Mapping to Connact.ai

| Apollo behavior | Connact.ai implementation |
| --- | --- |
| Independent AI context library | Saved, versioned sender Personas; choosing one in a draft remains optional |
| Assisted / Prompt / Template | Saved `writing_mode`, structured brief, custom instructions or existing body |
| Research for personalization | Explicit evidence selection from the chosen Contact; source IDs and content snapshot saved with every generation |
| Goals, tone, guidelines | Purpose, CTA, length, language, tone and custom instructions saved per draft |
| Contact-specific preview | Contact can be chosen later; supported variables resolve in preview |
| Submit, preview, insert | Durable background suggestion; accept/discard; no automatic body replacement |
| Reusable template | Preserve body and variables in Template mode; generation adapts the saved template |
| Step changes while AI runs | Draft revision, persona version and evidence snapshot checks reject outdated acceptance with HTTP 409 |

The current scope does not implement multi-step sending, automatic follow-ups, A/B tests, dynamic AI variables at send time or Apollo's email score. The implementation adapts the writing interaction to professional networking; it does not claim to reproduce Apollo's internal model or copy its private code.
