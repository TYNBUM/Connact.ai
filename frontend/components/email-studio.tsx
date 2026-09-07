"use client";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Plus,
  Mail,
  FileText,
  Sparkles,
  Scissors,
  SlidersHorizontal,
  Eye,
  Copy,
  Check,
  Save,
  ArrowRight,
  AlertCircle,
  Braces,
  ArrowLeft,
} from "lucide-react";
import { useApp } from "@/lib/context";
import { api, post, put, errorText } from "@/lib/api";
import type { Draft, Contact, Preview } from "@/lib/types";
import { useDraft } from "@/lib/use-draft";
import {
  Heading,
  Field,
  Badge,
  Busy,
  Nav,
  Empty,
  Drawer,
  DateLabel,
} from "./ui";
import RichEditor from "./rich-editor";

export default function EmailStudio() {
  const { t, drafts, refresh, go, notify } = useApp(),
    query = useSearchParams();
  const id = query.get("draft"),
    contact = query.get("contact"),
    persona = query.get("persona");
  const creating = useRef("");
  const [busy, setBusy] = useState(false);
  async function create(cid: string | null = null, pid: string | null = null) {
    setBusy(true);
    try {
      const d = await post<Draft>("/drafts", {
        contact_id: cid,
        persona_id: pid,
      });
      await refresh();
      await go("/email?draft=" + d.id);
    } catch (e) {
      notify(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (contact && !id && creating.current !== contact) {
      creating.current = contact;
      void create(contact, persona);
    }
  }, [contact, id]);
  return (
    <>
      <Heading
        title={t("Email Studio", "邮件工作室")}
      >
        <button
          className="button primary"
          disabled={busy}
          onClick={() => void create()}
        >
          {busy ? <Busy /> : <Plus size={16} />} {t("New draft", "新建草稿")}
        </button>
      </Heading>
      <div className="studio-layout">
        <aside className="draft-list panel">
          <div className="section-head">
            <h2>{t("Drafts", "草稿")}</h2>
            <Badge>{drafts.length}</Badge>
          </div>
          {drafts.length ? (
            drafts.map((d) => (
              <Nav
                key={d.id}
                className={`draft-tile ${id === d.id ? "selected" : ""}`}
                href={"/email?draft=" + d.id}
              >
                <div>
                  <FileText size={15} />
                  <span>
                    {d.status === "ready"
                      ? t("Reviewed", "已审核")
                      : t("Draft", "草稿")}
                  </span>
                  <small>{d.language.toUpperCase()}</small>
                </div>
                <strong>
                  {d.subject || t("Untitled draft", "未命名草稿")}
                </strong>
                <p>{d.purpose || t("A new conversation", "一次新的交流")}</p>
                <small>
                  <DateLabel value={d.updated_at} />
                </small>
              </Nav>
            ))
          ) : (
            <div className="muted draft-empty">
              {t(
                "Your saved drafts will appear here.",
                "保存后的草稿将在此显示。",
              )}
            </div>
          )}
          <div className="draft-list-note">
            <Mail size={17} />
            {t(
              "A space to write. Sending is coming in a future phase.",
              "专注写作，邮件发送将在后续阶段提供。",
            )}
          </div>
        </aside>
        {id ? (
          <DraftEditor key={id} id={id} />
        ) : (
          <section className="panel editor-welcome">
            <span className="welcome-icon" aria-hidden="true">
              <Mail size={35} />
            </span>
            <h2>{t("No draft selected", "尚未选择草稿")}</h2>
            <p>
              {t(
                "Choose a saved draft, or open a blank page. Add a contact and persona when you want a personalized starting point.",
                "打开已有草稿或创建空白邮件。选择联系人和画像，即可获得个性化写作起点。",
              )}
            </p>
            <button
              className="button primary"
              disabled={busy}
              onClick={() => void create()}
            >
              <Plus size={16} />
              {t("Create a draft", "创建草稿")}
            </button>
            <div className="writing-points">
              <span>Networking</span>
              <span>Informational Interview</span>
              <span>Recruiting</span>
            </div>
          </section>
        )}
      </div>
    </>
  );
}

function DraftEditor({ id }: { id: string }) {
  const { t, personas, contacts, refresh, notify, config } = useApp();
  const { draft, saveState, error, edit, flush, accept, setError } =
    useDraft(id);
  const [busy, setBusy] = useState(false),
    [preview, setPreview] = useState<Preview | null>(null),
    [extra, setExtra] = useState<Contact | null>(null),
    [showVariables, setShowVariables] = useState(false);
  useEffect(() => {
    if (draft?.contact_id && !contacts.some((c) => c.id === draft.contact_id))
      api<Contact>("/contacts/" + draft.contact_id)
        .then(setExtra)
        .catch((e) => setError(errorText(e)));
  }, [draft?.contact_id, contacts]);
  async function generate(action = "generate") {
    setBusy(true);
    setError("");
    try {
      const saved = await flush();
      if (!saved) return;
      const d = await post<Draft>("/drafts/" + id + "/generate", {
        action,
        revision: saved.revision,
      });
      accept(d);
      await refresh();
      notify(
        config?.ai_mode === "mock"
          ? t(
              "Mock writing suggestion created. Review and make it your own.",
              "模拟写作建议已生成，请检查并按需修改。",
            )
          : t(
              "Writing suggestion created. Review all facts before use.",
              "写作建议已生成，请检查事实。",
            ),
      );
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function showPreview() {
    setBusy(true);
    try {
      await flush();
      setPreview(await api<Preview>("/drafts/" + id + "/preview"));
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    try {
      await flush();
      await refresh();
      notify(t("Draft saved on the server.", "草稿已保存到服务端。"));
    } catch (e) {
      setError(errorText(e));
    }
  }
  async function ready() {
    setBusy(true);
    try {
      const latest = await flush();
      if (!latest) return;
      accept(await put<Draft>("/drafts/" + id, { ...latest, status: "ready" }));
      await refresh();
      notify(
        t(
          "Marked as reviewed. No email was sent.",
          "已标记为审核完成，未发送邮件。",
        ),
      );
      setPreview(null);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function copy(kind: "subject" | "body" | "both", p: Preview) {
    const text =
      kind === "subject"
        ? p.subject
        : kind === "body"
          ? p.body_text
          : `Subject: ${p.subject}\n\n${p.body_text}`;
    try {
      await navigator.clipboard.writeText(text);
      notify(t("Copied to clipboard.", "已复制到剪贴板。"));
    } catch {
      setError(
        t(
          "Clipboard access was denied. Select the preview text and copy it manually.",
          "剪贴板访问被拒绝，请选择预览文字后手动复制。",
        ),
      );
    }
  }
  if (!draft)
    return (
      <div className="panel">
        <div className="empty">
          {error || t("Opening draft…", "正在打开草稿…")}
        </div>
      </div>
    );
  const allContacts =
    extra && !contacts.some((c) => c.id === extra.id)
      ? [extra, ...contacts]
      : contacts;
  return (
    <section className="editor-main">
      <div className="panel editor-context">
        <div className="section-head">
          <h2>
            <Sparkles size={17} />
            {t("Give your email some context", "为邮件补充背景")}
          </h2>
          <Badge tone={draft.generation_provider === "mock" ? "amber" : "gray"}>
            {draft.generation_provider === "mock"
              ? "MOCK WRITING"
              : draft.language === "en"
                ? "ENGLISH EMAIL"
                : "中文邮件"}
          </Badge>
        </div>
        <fieldset disabled={busy}>
          <div className="form-grid">
            <Field label={t("To · Contact", "收件人 · 联系人")}>
              <select
                value={draft.contact_id || ""}
                onChange={(e) => edit({ contact_id: e.target.value || null })}
              >
                <option value="">
                  {t("Select a contact (optional)", "选择联系人（可选）")}
                </option>
                {allContacts.map((c) => (
                  <option value={c.id} key={c.id}>
                    {c.name} · {c.company}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("From · Persona", "发件人 · 职业画像")}>
              <select
                value={draft.persona_id || ""}
                onChange={(e) => edit({ persona_id: e.target.value || null })}
              >
                <option value="">
                  {t("No persona · write manually", "无画像 · 自由写作")}
                </option>
                {personas.map((p) => (
                  <option value={p.id} key={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("Writing starting point", "写作起点")}>
              <select
                value={draft.starting_point}
                onChange={(e) => edit({ starting_point: e.target.value })}
              >
                <option>Networking</option>
                <option>Informational Interview</option>
                <option>Recruiting</option>
              </select>
            </Field>
            <Field label={t("Email language", "邮件语言")}>
              <select
                aria-label="Email language"
                value={draft.language}
                onChange={(e) =>
                  edit({ language: e.target.value as "en" | "zh" })
                }
              >
                <option value="en">English</option>
                <option value="zh">简体中文</option>
              </select>
            </Field>
            <Field
              label={t(
                "What would you like to connect about?",
                "您希望就什么目的联系？",
              )}
              className="full"
            >
              <textarea
                rows={2}
                value={draft.purpose}
                onChange={(e) => edit({ purpose: e.target.value })}
                placeholder={t(
                  "e.g. Learn about the transition from investment banking to private equity.",
                  "例如：了解如何从投资银行转向私募股权。",
                )}
              />
            </Field>
          </div>
          {!draft.persona_id && (
            <div className="notice small">
              <Sparkles size={14} />
              {t(
                "Add a persona for background-based personalization. You can still write or generate a neutral introduction.",
                "选择画像可获得基于背景的个性化内容。也可继续手动写作或生成中性介绍。",
              )}
              <Nav href="/personas">{t("Add background", "补充背景")}</Nav>
            </div>
          )}
          <div className="generate-row">
            <span>
              {t(
                "Email language is independent of interface language.",
                "邮件语言不受界面语言影响。",
              )}
            </span>
            <button
              className="button primary"
              disabled={busy || !draft.purpose.trim()}
              onClick={() => void generate()}
            >
              {busy ? <Busy /> : <Sparkles size={16} />}{" "}
              {t("Generate email", "生成邮件")}
            </button>
          </div>
        </fieldset>
      </div>
      {error && (
        <div className="error-panel" role="alert">
          {error}
          <button
            className="button small-button"
            disabled={busy}
            onClick={() => void save()}
          >
            {t("Retry save", "重试保存")}
          </button>
          <button
            className="button small-button"
            disabled={busy}
            onClick={() =>
              void api<Draft>("/drafts/" + id)
                .then(accept)
                .catch((e) => setError(errorText(e)))
            }
          >
            {t(
              "Load latest (discard local edits)",
              "加载最新版本（放弃本地修改）",
            )}
          </button>
        </div>
      )}
      <div className="panel composer">
        <div className="composer-head">
          <span>
            <FileText size={16} />
            {t("Your email", "邮件内容")}
          </span>
          <span
            className={`save-status ${saveState === "error" ? "bad" : ""}`}
            role="status"
          >
            {saveState === "saved" ? (
              <Check size={14} />
            ) : saveState === "saving" ? (
              <Busy />
            ) : (
              <span className="status-dot" />
            )}
            {saveState === "saved"
              ? t("All changes saved", "所有修改已保存")
              : saveState === "saving"
                ? t("Saving…", "保存中…")
                : saveState === "error"
                  ? t("Save failed", "保存失败")
                  : t("Unsaved changes", "尚未保存")}
          </span>
        </div>
        <div className="subject-line">
          <label htmlFor="subject">{t("Subject", "主题")}</label>
          <input
            id="subject"
            value={draft.subject}
            placeholder={t("A subject worth opening", "输入邮件主题")}
            disabled={busy}
            onChange={(e) => edit({ subject: e.target.value })}
          />
        </div>
        <RichEditor
          value={draft.body_html}
          disabled={busy}
          onChange={(body_html) => edit({ body_html })}
        />
        <div className="refine-bar">
          <button
            className="text-button"
            disabled={busy}
            onClick={() => void generate("shorten")}
          >
            <Scissors size={15} />
            {t("Shorten", "缩短")}
          </button>
          <select
            aria-label="Writing tone"
            disabled={busy}
            value={draft.tone}
            onChange={(e) => edit({ tone: e.target.value })}
          >
            <option value="professional">{t("Professional", "专业")}</option>
            <option value="warm">{t("Warm", "友好")}</option>
            <option value="concise">{t("Concise", "简洁")}</option>
          </select>
          <button
            className="text-button"
            disabled={busy}
            onClick={() => void generate("tone")}
          >
            <SlidersHorizontal size={15} />
            {t("Apply tone", "调整语气")}
          </button>
          <button
            className="text-button variables-toggle"
            onClick={() => setShowVariables(!showVariables)}
          >
            <Braces size={15} />
            {t("Variables", "变量")}
          </button>
        </div>
        {showVariables && (
          <div className="variable-help">
            <p>
              {t(
                "Type or paste these variables into the subject or body. School refers to the contact’s school. Preview resolves them using saved records.",
                "在主题或正文中输入以下变量。学校指联系人学校。预览使用已保存数据替换。",
              )}
            </p>
            <div>
              {["name", "company", "title", "school", "sender_name"].map(
                (v) => (
                  <code key={v}>{"{{" + v + "}}"}</code>
                ),
              )}
            </div>
          </div>
        )}
        <div className="composer-footer">
          <span>
            <Badge tone={draft.status === "ready" ? "green" : "gray"}>
              {draft.status === "ready"
                ? t("Reviewed", "已审核")
                : t("Draft", "草稿")}
            </Badge>
          </span>
          <div>
            <button
              className="button"
              disabled={busy}
              onClick={() => void save()}
            >
              <Save size={15} />
              {t("Save draft", "保存草稿")}
            </button>
            <button
              className="button dark"
              disabled={busy}
              onClick={() => void showPreview()}
            >
              <Eye size={16} />
              {t("Preview & copy", "预览与复制")}
            </button>
          </div>
        </div>
      </div>
      <div className="studio-footnote">
        <Check size={14} />
        {t(
          "Saved securely to your local workspace. No mailbox connection required.",
          "保存至本地工作区，无需连接邮箱。",
        )}
      </div>
      {preview && (
        <Drawer
          title={t("Final preview", "最终预览")}
          onClose={() => setPreview(null)}
        >
          <div className="preview-content">
            <div className="preview-label">
              <Badge tone="green">
                {t("RESOLVED PREVIEW", "真实数据预览")}
              </Badge>
              <span>{draft.language === "en" ? "English" : "简体中文"}</span>
            </div>
            {preview.missing_variables.length > 0 && (
              <div className="error-panel" role="alert">
                <strong>{t("Missing variables", "缺失变量")}</strong>
                <p>{preview.missing_variables.join(", ")}</p>
                <p>
                  {t(
                    "Complete the contact or persona before marking ready.",
                    "请先补齐联系人或画像字段，再标记为可用。",
                  )}
                </p>
              </div>
            )}
            {preview.persona_changed && (
              <div className="notice">
                {t(
                  "This persona changed. Review the new background and save the draft again.",
                  "画像已更新，请检查新背景并重新保存草稿。",
                )}
              </div>
            )}
            <div className="preview-recipient">
              <span>{t("To", "收件人")}</span>
              <strong>
                {preview.variables.name ||
                  t("No recipient selected", "尚未选择收件人")}
              </strong>
              <small>
                {preview.recipient_email ||
                  t("No email address · draft only", "暂无邮箱 · 可保存草稿")}
              </small>
            </div>
            <h2>{preview.subject || t("No subject", "暂无主题")}</h2>
            <div
              className="preview-body"
              dangerouslySetInnerHTML={{ __html: preview.body_html }}
            />
            <div className="copy-actions">
              <button
                className="button"
                onClick={() => void copy("subject", preview)}
              >
                <Copy size={15} />
                {t("Copy subject", "复制主题")}
              </button>
              <button
                className="button"
                onClick={() => void copy("body", preview)}
              >
                <Copy size={15} />
                {t("Copy body", "复制正文")}
              </button>
              <button
                className="button dark"
                onClick={() => void copy("both", preview)}
              >
                <Copy size={15} />
                {t("Copy all", "复制全部")}
              </button>
            </div>
            <div className="ready-section">
              <button
                className="button primary"
                disabled={!preview.can_mark_ready || busy}
                onClick={() => void ready()}
              >
                <Check size={16} />
                {t("Mark as reviewed & ready", "标记已审核且可用")}
              </button>
              <p>
                {t(
                  "Requires a recipient, subject, body and resolved variables. This marks the content only; no email is sent.",
                  "需选择收件人并补齐主题、正文和变量。这只标记内容状态，不会发送邮件。",
                )}
              </p>
            </div>
          </div>
        </Drawer>
      )}
    </section>
  );
}
