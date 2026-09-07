import re
from html import escape, unescape
import bleach
from ..models import Contact, Persona

TAGS = ["p", "br", "strong", "b", "em", "ul", "ol", "li", "a"]
VARIABLE = re.compile(r"\{\{\s*([^{}]+?)\s*\}\}")


def sanitize(body):
    return bleach.clean(
        body,
        tags=TAGS,
        attributes={"a": ["href", "title"]},
        protocols=["http", "https", "mailto"],
        strip=True,
    )


def plain_text(body):
    body = re.sub(r"<br\s*/?>", "\n", body, flags=re.I)
    body = re.sub(r"</(p|li)>", "\n\n", body, flags=re.I)
    return unescape(bleach.clean(body, tags=[], strip=True)).strip()


def preview(repo, draft):
    contact = repo.get(Contact, draft.contact_id) if draft.contact_id else None
    persona = repo.get(Persona, draft.persona_id) if draft.persona_id else None
    variables = {
        "name": contact.name if contact else "",
        "company": contact.company if contact else "",
        "title": contact.title if contact else "",
        "school": contact.school if contact else "",
        "sender_name": persona.data.get("name", "") if persona else "",
    }
    missing = set()

    def render(text, html=False):
        def replace(match):
            key = match.group(1).strip()
            value = variables.get(key)
            if not value:
                missing.add(key)
                return f"[MISSING: {escape(key)}]"
            return escape(value) if html else value

        return VARIABLE.sub(replace, text)

    subject = render(draft.subject)
    body = sanitize(render(draft.body_html, True))
    # Catch unfinished or malformed placeholder syntax too.
    if "{{" in subject + body or "}}" in subject + body:
        missing.add("malformed_variable")
    stale = bool(
        persona and draft.persona_version and persona.version != draft.persona_version
    )
    complete = bool(
        subject.strip() and plain_text(body) and contact and not missing and not stale
    )
    return {
        "subject": subject,
        "body_html": body,
        "body_text": plain_text(body),
        "missing_variables": sorted(missing),
        "variables": variables,
        "can_mark_ready": complete,
        "persona_changed": stale,
        "recipient_email": contact.email if contact else "",
        "note": "Ready means content reviewed locally. This application cannot send email.",
    }
