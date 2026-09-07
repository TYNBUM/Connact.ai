"use client";
import { useState } from "react";
import {
  Plus,
  Upload,
  FileText,
  Check,
  ArrowRight,
  ShieldCheck,
  UserRound,
  Save,
} from "lucide-react";
import { useApp } from "@/lib/context";
import { api, post, put, errorText } from "@/lib/api";
import type { Persona, PersonaData } from "@/lib/types";
import { Heading, Field, Avatar, Badge, Busy, DateLabel, Nav } from "./ui";
const blank: PersonaData = {
  name: "",
  education: "",
  experience: "",
  skills: "",
  sectors: "",
  career_goals: "",
  target_regions: "",
  target_roles: "",
  contact_purpose: "",
};
const fields: [keyof PersonaData, string, string, string][] = [
  ["name", "Full name", "姓名", "Alex Morgan"],
  ["education", "Education", "教育经历", "School, degree, dates"],
  [
    "experience",
    "Work experience",
    "工作经历",
    "Role, organization, responsibilities",
  ],
  ["skills", "Skills", "技能", "Financial modeling, valuation, Python"],
  [
    "sectors",
    "Finance focus",
    "金融细分领域",
    "Investment Banking, Private Equity",
  ],
  [
    "career_goals",
    "Career goals",
    "职业目标",
    "The next step you are working toward",
  ],
  [
    "target_regions",
    "Target regions",
    "目标地区",
    "New York, London, Hong Kong",
  ],
  [
    "target_roles",
    "Target organizations or roles",
    "目标机构或职位",
    "Investment Banking Analyst",
  ],
  [
    "contact_purpose",
    "Default contact purpose",
    "默认联系目的",
    "Learn about career paths in investment banking",
  ],
];
export default function Personas() {
  const { t, personas, refresh, notify, config } = useApp();
  const [selected, setSelected] = useState<Persona | null>(personas[0] || null),
    [data, setData] = useState<PersonaData>(personas[0]?.data || blank),
    [label, setLabel] = useState(personas[0]?.label || ""),
    [documentId, setDocumentId] = useState<string | null>(null),
    [raw, setRaw] = useState(""),
    [uploading, setUploading] = useState(false),
    [saving, setSaving] = useState(false),
    [error, setError] = useState(""),
    [dirty, setDirty] = useState(false);
  const choose = (p: Persona | null) => {
    if (
      dirty &&
      !window.confirm(
        t("Discard unsaved persona edits?", "放弃尚未保存的画像修改？"),
      )
    )
      return;
    setSelected(p);
    setData(p?.data || blank);
    setLabel(p?.label || "");
    setDocumentId(null);
    setRaw("");
    setError("");
    setDirty(false);
  };
  async function upload(file: File) {
    setUploading(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      const result = await api<{
        status: string;
        document_id: string;
        data: PersonaData;
        extracted_text: string;
        error: string;
      }>("/documents", { method: "POST", body: form });
      setDocumentId(result.document_id);
      if (result.status === "failed") {
        setError(result.error);
        return;
      }
      setData(result.data);
      setRaw(result.extracted_text);
      setLabel(label || file.name.replace(/\.[^.]+$/, ""));
      setDirty(true);
      notify(
        t(
          "Resume parsed. Review the fields below, then save.",
          "简历已解析。请检查下方字段后保存。",
        ),
      );
    } catch (e) {
      setError(errorText(e));
    } finally {
      setUploading(false);
    }
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const body = {
        label,
        data,
        document_id: documentId,
        version: selected?.version,
      };
      const p = selected
        ? await put<Persona>("/personas/" + selected.id, body)
        : await post<Persona>("/personas", body);
      setSelected(p);
      setDirty(false);
      await refresh();
      notify(
        t(
          "Persona saved. A versioned snapshot is ready for personalization.",
          "画像已保存，可用于个性化推荐和写信。",
        ),
      );
    } catch (e) {
      setError(errorText(e));
    } finally {
      setSaving(false);
    }
  }
  return (
    <>
      <Heading
        title={t("Personas", "职业画像")}
      >
        <button className="button primary" onClick={() => choose(null)}>
          <Plus size={16} />
          {t("New persona", "新建画像")}
        </button>
      </Heading>
      <div className="persona-layout">
        <aside className="persona-list">
          <div className="list-label">
            {t("YOUR PERSONAS", "您的画像")}
            <Badge>{personas.length}</Badge>
          </div>
          {personas.map((p) => (
            <button
              key={p.id}
              className={`persona-tile ${selected?.id === p.id ? "selected" : ""}`}
              onClick={() => choose(p)}
            >
              <Avatar name={p.data.name || p.label} />
              <span>
                <strong>{p.label}</strong>
                <small>
                  {p.data.sectors || t("Finance persona", "金融画像")}
                </small>
                <small>
                  v{p.version} · <DateLabel value={p.updated_at} />
                </small>
              </span>
              {selected?.id === p.id && <Check size={16} />}
            </button>
          ))}
          {!personas.length && (
            <p className="muted">
              {t(
                "Your saved personas will appear here.",
                "保存后的画像将在此显示。",
              )}
            </p>
          )}
          <div className="sidebar-tip">
            <ShieldCheck size={20} />
            <h4>{t("Your background stays yours", "职业背景由您掌控")}</h4>
            <p>
              {t(
                "Files are stored privately on this local workspace. Review extracted details before using them.",
                "文件受控存储在本地工作区。使用前请检查解析内容。",
              )}
            </p>
          </div>
        </aside>
        <section className="panel persona-form">
          <div className="section-head">
            <h2>
              {selected
                ? t("Edit persona", "编辑画像")
                : t("Create your persona", "创建职业画像")}
            </h2>
            <Badge tone={dirty ? "amber" : "green"}>
              {dirty
                ? t("Unsaved changes", "尚未保存")
                : selected
                  ? `Version ${selected.version}`
                  : t("New", "新建")}
            </Badge>
          </div>
          <div className="upload-zone">
            <span className="upload-icon">
              <Upload size={23} />
            </span>
            <div>
              <strong>{t("Start with your resume", "从简历开始")}</strong>
              <p>
                {t(
                  "Text-based PDF or DOCX · Up to 8 MB · No scanned documents",
                  "文本型 PDF 或 DOCX · 不超过 8 MB · 不支持扫描件",
                )}
              </p>
              <small>
                {config?.ai_mode === "mock"
                  ? t(
                      "Mock extraction uses section headings. Review unmapped text below.",
                      "模拟解析按章节标题提取，请检查原文中未映射的内容。",
                    )
                  : t(
                      "Resume text is sent to your configured AI provider for extraction.",
                      "简历文本将发送至已配置的 AI 服务进行提取。",
                    )}
              </small>
            </div>
            <label className={`button ${uploading ? "disabled" : ""}`}>
              {uploading ? <Busy /> : <Upload size={15} />}{" "}
              {uploading
                ? t("Parsing…", "解析中…")
                : t("Upload resume", "上传简历")}
              <input
                aria-label="Upload resume"
                type="file"
                accept=".pdf,.docx"
                disabled={uploading}
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void upload(f);
                  e.target.value = "";
                }}
              />
            </label>
          </div>
          {error && (
            <div className="error-panel" role="alert">
              {error}
              <p>
                {t(
                  "You can continue with manual entry below.",
                  "您可以继续使用下方表单手动填写。",
                )}
              </p>
            </div>
          )}
          {raw && (
            <details className="raw-text">
              <summary>
                {t("Review extracted source text", "检查提取的简历原文")}
              </summary>
              <pre>{raw}</pre>
              {documentId && (
                <a href={"/api/documents/" + documentId + "/download"}>
                  {t("Download original resume", "下载原始简历")}
                </a>
              )}
            </details>
          )}
          <div className="form-intro">
            <UserRound size={17} />
            <span>
              {t(
                "Or tell your story in your own words",
                "也可以直接手动填写职业背景",
              )}
            </span>
          </div>
          <form onSubmit={save}>
            <div className="form-grid">
              <Field label={t("Persona name", "画像名称")} className="full">
                <input
                  required
                  value={label}
                  maxLength={150}
                  placeholder={t(
                    "e.g. Investment banking opportunities",
                    "例如：投资银行求职",
                  )}
                  onChange={(e) => {
                    setLabel(e.target.value);
                    setDirty(true);
                  }}
                />
              </Field>
              {fields.map(([key, en, zh, placeholder]) => (
                <Field
                  label={t(en, zh)}
                  key={key}
                  className={
                    ["experience", "career_goals", "contact_purpose"].includes(
                      key,
                    )
                      ? "full"
                      : ""
                  }
                >
                  {["name", "sectors", "target_regions", "skills"].includes(
                    key,
                  ) ? (
                    <input
                      value={data[key]}
                      placeholder={placeholder}
                      onChange={(e) => {
                        setData({ ...data, [key]: e.target.value });
                        setDirty(true);
                      }}
                    />
                  ) : (
                    <textarea
                      rows={key === "experience" ? 3 : 2}
                      value={data[key]}
                      placeholder={placeholder}
                      onChange={(e) => {
                        setData({ ...data, [key]: e.target.value });
                        setDirty(true);
                      }}
                    />
                  )}
                </Field>
              ))}
            </div>
            <div className="form-footer">
              <span>
                {t(
                  "Only saved details are used for recommendations.",
                  "只有已保存的资料会用于推荐。",
                )}
              </span>
              <button className="button primary" disabled={saving || uploading}>
                {saving ? <Busy /> : <Save size={16} />}{" "}
                {t("Save persona", "保存画像")}
              </button>
            </div>
          </form>
        </section>
      </div>
    </>
  );
}
