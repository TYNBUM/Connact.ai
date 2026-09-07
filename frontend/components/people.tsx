"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Search,
  Plus,
  MapPin,
  Sparkles,
  Bookmark,
  Check,
  Mail,
  ArrowRight,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  Link2,
  Save,
  PencilLine,
} from "lucide-react";
import { useApp } from "@/lib/context";
import { api, post, put, errorText } from "@/lib/api";
import type { Contact, Assessment, Draft } from "@/lib/types";
import {
  Heading,
  Field,
  Avatar,
  Badge,
  Busy,
  Drawer,
  External,
  Empty,
  DateLabel,
  Nav,
} from "./ui";
const sectors = [
  "Investment Banking",
  "Private Equity",
  "Asset Management",
  "Venture Capital",
  "Risk Management",
];
export function PeopleSearch() {
  const { t, locale, personas, refresh, notify, config } = useApp();
  const [filters, setFilters] = useState({
      title: "",
      company: "",
      location: "",
      keywords: "",
      sector: "",
    }),
    [personaId, setPersonaId] = useState(personas[0]?.id || ""),
    [results, setResults] = useState<Contact[]>([]),
    [total, setTotal] = useState(0),
    [page, setPage] = useState(1),
    [searched, setSearched] = useState(false),
    [busy, setBusy] = useState(false),
    [recommending, setRecommending] = useState(false),
    [error, setError] = useState(""),
    [detail, setDetail] = useState<Contact | null>(null);
  const [applied, setApplied] = useState(filters);
  async function recommend(rows = results) {
    if (!personaId || !rows.length) return;
    setRecommending(true);
    try {
      const assessments = await post<Assessment[]>("/finance/assess", {
        contact_ids: rows.slice(0, 5).map((c) => c.id),
        persona_id: personaId,
        language: locale,
      });
      setResults((prev) =>
        prev.map((c) => ({
          ...c,
          assessments: [
            ...c.assessments,
            ...assessments.filter((a) => a.contact_id === c.id),
          ],
        })),
      );
    } catch (e) {
      setError(errorText(e));
    } finally {
      setRecommending(false);
    }
  }
  async function search(n = 1, useFilters = filters) {
    setBusy(true);
    setError("");
    try {
      const r = await post<{ items: Contact[]; total: number }>(
        "/finance/search",
        { ...useFilters, page: n, per_page: 10 },
      );
      setResults(r.items);
      setTotal(r.total);
      setPage(n);
      setSearched(true);
      setApplied(useFilters);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  const update = (contact: Contact) => {
    setResults((old) => old.map((c) => (c.id === contact.id ? contact : c)));
    setDetail(contact);
    void refresh();
  };
  return (
    <>
      <Heading
        title={t("People Search", "人员搜索")}
      />
      <section className="panel search-panel">
        <div className="section-head">
          <h2>
            <SlidersHorizontal size={17} />
            {t("Find your people", "筛选人员")}
          </h2>
          <Badge tone={config?.people_mode === "mock" ? "amber" : "green"}>
            {config?.people_mode === "mock" ? "MOCK DATA" : "APOLLO"}
          </Badge>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void search();
          }}
        >
          <div className="search-grid">
            {[
              [
                "title",
                "Job title",
                "职位",
                "e.g. Investment Banking Associate",
              ],
              [
                "company",
                "Company / institution",
                "公司或机构",
                "Name or domain",
              ],
              ["location", "Location", "地区", "e.g. New York"],
              ["keywords", "Keywords", "关键词", "e.g. M&A"],
            ].map(([key, en, zh, ph]) => (
              <Field key={key} label={t(en, zh)}>
                <input
                  value={filters[key as keyof typeof filters]}
                  placeholder={ph}
                  onChange={(e) =>
                    setFilters({ ...filters, [key]: e.target.value })
                  }
                />
              </Field>
            ))}
          </div>
          <div className="search-bottom">
            <Field label={t("Finance focus", "金融领域")}>
              <select
                value={filters.sector}
                onChange={(e) =>
                  setFilters({ ...filters, sector: e.target.value })
                }
              >
                <option value="">
                  {t("All finance areas", "全部金融领域")}
                </option>
                {sectors.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </Field>
            <Field label={t("Recommend for persona", "推荐所用画像")}>
              <select
                value={personaId}
                onChange={(e) => setPersonaId(e.target.value)}
              >
                <option value="">
                  {t("No persona · search freely", "无画像 · 自由搜索")}
                </option>
                {personas.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </Field>
            <button className="button primary" disabled={busy || recommending}>
              {busy ? <Busy /> : <Search size={16} />}{" "}
              {t("Search people", "搜索人员")}
            </button>
          </div>
        </form>
        <p className="filter-note">
          {config?.people_mode === "live"
            ? t(
                "Company names and finance areas use Apollo keyword matching; use a company domain for precise organization filtering. Some names and locations may be limited until enrichment.",
                "机构名称和金融领域映射为 Apollo 关键词；机构域名用于精确筛选。补充前部分姓名与地区可能不完整。",
              )
            : t(
                "16 fictional profiles for testing. All filters work on this demo dataset.",
                "16 位虚构专业人士用于测试，所有筛选均对演示数据实际生效。",
              )}
        </p>
      </section>
      {error && (
        <div className="error-panel" role="alert">
          {error}
        </div>
      )}
      <div className="results-header">
        <div>
          <h2>
            {searched
              ? t("Search results", "搜索结果")
              : t("Ready to explore", "开始探索")}
          </h2>
          {searched && (
            <span className="muted">
              {total} {t("people found", "位符合条件的人员")}
            </span>
          )}
        </div>
        {searched && results.length > 0 && (
          <button
            className="button"
            disabled={!personaId || recommending || busy}
            onClick={() => void recommend()}
          >
            {recommending ? <Busy /> : <Sparkles size={15} />}{" "}
            {t("Recommend first 5", "推荐当前前 5 位")}
          </button>
        )}
      </div>
      {!personaId && (
        <div className="notice">
          <Sparkles size={15} />
          {t(
            "Search freely. Select or create a persona when you want personalized recommendations.",
            "可以直接搜索。需要个性化推荐时，再选择或创建画像。",
          )}
          <Nav href="/personas">{t("Add background", "补充背景")}</Nav>
        </div>
      )}
      {!searched ? (
        <Empty
          title={t("Who would you like to meet?", "您想认识什么样的人？")}
          detail={t(
            "Set a few filters or search all finance professionals to get started.",
            "设置筛选条件，或直接搜索全部金融领域专业人士。",
          )}
        />
      ) : results.length ? (
        <>
          <PeopleTable
            items={results}
            personaId={personaId}
            onDetail={setDetail}
            onSaved={(c) =>
              setResults((old) => old.map((x) => (x.id === c.id ? c : x)))
            }
          />
          <div className="pagination">
            <span>
              {(page - 1) * 10 + 1}–{Math.min(page * 10, total)} {t("of", "/")}{" "}
              {total}
            </span>
            <div>
              <button
                aria-label="Previous page"
                className="icon-button"
                disabled={page === 1 || busy}
                onClick={() => void search(page - 1, applied)}
              >
                <ChevronLeft size={17} />
              </button>
              <span>
                {t("Page", "第")} {page}
              </span>
              <button
                aria-label="Next page"
                className="icon-button"
                disabled={page * 10 >= total || page >= 500 || busy}
                onClick={() => void search(page + 1, applied)}
              >
                <ChevronRight size={17} />
              </button>
            </div>
          </div>
        </>
      ) : (
        <Empty
          title={t("No people found", "没有找到符合条件的人员")}
          detail={t(
            "Try a broader title, location, or finance area.",
            "请尝试更宽泛的职位、地区或领域条件。",
          )}
        />
      )}
      <div className="source-footnote">
        <Link2 size={14} />
        {t(
          "Email availability is a provider signal, not a verified address. Enrichment is a separate action.",
          "邮箱可用性只是数据源信号，并不等于已取得邮箱。信息补充需单独操作。",
        )}
      </div>
      {detail && (
        <ContactDrawer
          contact={detail}
          personaId={personaId}
          onClose={() => setDetail(null)}
          onUpdate={update}
        />
      )}
    </>
  );
}

export function PeopleTable({
  items,
  personaId,
  onDetail,
  onSaved,
}: {
  items: Contact[];
  personaId?: string;
  onDetail: (c: Contact) => void;
  onSaved?: (c: Contact) => void;
}) {
  const { t, personas, refresh, notify, go } = useApp();
  const [busy, setBusy] = useState("");
  async function save(c: Contact) {
    setBusy(c.id);
    try {
      const r = await post<{ contact: Contact; already_saved: boolean }>(
        "/contacts/" + c.id + "/save",
      );
      onSaved?.(r.contact);
      await refresh();
      notify(
        r.already_saved
          ? t(
              "Already saved. No duplicate created.",
              "已保存过该联系人，未创建重复记录。",
            )
          : t("Contact saved to your network.", "联系人已保存。"),
      );
    } catch (e) {
      notify(errorText(e));
    } finally {
      setBusy("");
    }
  }
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>{t("PERSON", "人员")}</th>
            <th>{t("COMPANY", "机构")}</th>
            <th>{t("LOCATION", "地区")}</th>
            <th>{t("EMAIL STATUS", "邮箱状态")}</th>
            <th className="match-column">
              <Sparkles size={13} />
              {t("WHY CONNECT", "推荐依据")}
            </th>
            <th>{t("ACTIONS", "操作")}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((c) => {
            const p = personas.find((p) => p.id === personaId);
            const a = [...c.assessments]
              .reverse()
              .find(
                (a) =>
                  (!personaId || a.persona_id === personaId) &&
                  (!p || a.persona_version === p.version),
              );
            return (
              <tr key={c.id}>
                <td>
                  <button className="person-cell" onClick={() => onDetail(c)}>
                    <Avatar name={c.name} />
                    <span>
                      <strong>{c.name}</strong>
                      <small>
                        {c.title || t("Title unavailable", "职位未知")}
                      </small>
                      <span className="source-label">
                        {c.provider === "mock"
                          ? "MOCK · FICTIONAL"
                          : c.provider.toUpperCase()}
                      </span>
                    </span>
                  </button>
                </td>
                <td>
                  <strong className="company-name">{c.company || "—"}</strong>
                  <small>
                    {c.domains.finance?.sector || t("Finance", "金融")}
                  </small>
                </td>
                <td>
                  <span className="location">
                    <MapPin size={13} />
                    {c.location || t("Not provided", "未提供")}
                  </span>
                  {c.profile_url && (
                    <External url={c.profile_url}>
                      {t("Profile", "资料链接")}
                    </External>
                  )}
                </td>
                <td>
                  <EmailStatus contact={c} />
                </td>
                <td className="match-column">
                  {a ? (
                    <div className="match-reason">
                      <span className="match-marker">
                        <Sparkles size={12} />
                        {a.provider === "mock"
                          ? t("Mock recommendation", "模拟推荐")
                          : t("AI recommendation", "AI 推荐")}
                      </span>
                      <p>{a.reason}</p>
                      <small>
                        {t("Persona", "画像")} v{a.persona_version} ·{" "}
                        {a.source_ids.length} {t("sources", "条来源")}
                      </small>
                    </div>
                  ) : (
                    <span className="muted small">
                      {t(
                        "Select a persona and request a recommendation.",
                        "选择画像并请求推荐。",
                      )}
                    </span>
                  )}
                </td>
                <td>
                  <div className="row-actions">
                    <button
                      aria-label={(c.saved ? "Saved " : "Save ") + c.name}
                      title={t("Save contact", "保存联系人")}
                      className={`icon-button ${c.saved ? "saved" : ""}`}
                      disabled={busy === c.id}
                      onClick={() => void save(c)}
                    >
                      {busy === c.id ? (
                        <Busy />
                      ) : c.saved ? (
                        <Check size={16} />
                      ) : (
                        <Bookmark size={16} />
                      )}
                    </button>
                    <button
                      aria-label={"Write to " + c.name}
                      title={t("Write email", "撰写邮件")}
                      className="icon-button"
                      onClick={() =>
                        void go(
                          "/email?contact=" +
                            c.id +
                            (personaId ? "&persona=" + personaId : ""),
                        )
                      }
                    >
                      <Mail size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
function EmailStatus({ contact: c }: { contact: Contact }) {
  const { t } = useApp();
  const label = c.email
    ? c.provider === "mock"
      ? t("Mock address", "模拟邮箱")
      : t("Address found", "已取得邮箱")
    : ["available", "mock_available"].includes(c.email_status)
      ? t("Available to enrich", "可尝试补充")
      : c.email_status === "unavailable"
        ? t("Unavailable", "暂无邮箱")
        : t("Not requested", "尚未补充");
  return (
    <Badge
      tone={
        c.email ? "green" : c.email_status === "available" ? "blue" : "gray"
      }
    >
      {label}
    </Badge>
  );
}

export function Contacts() {
  const { t, contacts } = useApp();
  const query = useSearchParams();
  const [term, setTerm] = useState(""),
    [tag, setTag] = useState(""),
    [detail, setDetail] = useState<Contact | null>(null),
    [manual, setManual] = useState(false);
  useEffect(() => {
    if (query.get("contact")) {
      const c = contacts.find((c) => c.id === query.get("contact"));
      if (c) setDetail(c);
    }
  }, [query, contacts]);
  const items = contacts.filter(
    (c) =>
      (!tag || c.tags.includes(tag)) &&
      [c.name, c.company, c.title, c.notes, ...c.tags]
        .join(" ")
        .toLowerCase()
        .includes(term.toLowerCase()),
  );
  return (
    <>
      <Heading
        title={t("Contacts", "联系人")}
      >
        <button className="button primary" onClick={() => setManual(true)}>
          <Plus size={16} />
          {t("Add contact", "添加联系人")}
        </button>
      </Heading>
      <div className="contacts-toolbar">
        <div className="search-input">
          <Search size={17} />
          <input
            aria-label="Search saved contacts"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder={t(
              "Search names, companies or notes…",
              "搜索姓名、机构或备注…",
            )}
          />
        </div>
        <select
          aria-label="Filter by tag"
          value={tag}
          onChange={(e) => setTag(e.target.value)}
        >
          <option value="">{t("All tags", "全部标签")}</option>
          {[...new Set(contacts.flatMap((c) => c.tags))].map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
        <span className="muted">
          {items.length} {t("contacts", "位联系人")}
        </span>
      </div>
      {items.length ? (
        <PeopleTable items={items} onDetail={setDetail} />
      ) : (
        <Empty
          title={
            contacts.length
              ? t("No matching contacts", "没有匹配的联系人")
              : t("Your network starts here", "从这里建立人脉")
          }
          detail={t(
            "Save someone from People Search or add a contact manually.",
            "从人员搜索保存联系人，或手动添加。",
          )}
        >
          <Nav href="/people" className="button">
            <Search size={16} />
            {t("Find people", "搜索人员")}
          </Nav>
        </Empty>
      )}
      {detail && (
        <ContactDrawer
          contact={detail}
          onClose={() => setDetail(null)}
          onUpdate={setDetail}
        />
      )}{" "}
      {manual && (
        <ContactForm
          onClose={() => setManual(false)}
          onDone={(c) => {
            setManual(false);
            setDetail(c);
          }}
        />
      )}
    </>
  );
}

export function ContactDrawer({
  contact,
  personaId = "",
  onClose,
  onUpdate,
}: {
  contact: Contact;
  personaId?: string;
  onClose: () => void;
  onUpdate: (c: Contact) => void;
}) {
  const { t, locale, personas, refresh, notify, go, config } = useApp();
  const [c, setC] = useState(contact),
    [editing, setEditing] = useState(false),
    [busy, setBusy] = useState(""),
    [error, setError] = useState(""),
    [pid, setPid] = useState(personaId || personas[0]?.id || "");
  useEffect(() => {
    let active = true;
    api<Contact>("/contacts/" + contact.id)
      .then((c) => {
        if (active) setC(c);
      })
      .catch((e) => setError(errorText(e)));
    return () => {
      active = false;
    };
  }, [contact.id]);
  async function action(name: string) {
    setBusy(name);
    setError("");
    try {
      if (name === "assess") {
        await post("/finance/assess", {
          contact_ids: [c.id],
          persona_id: pid,
          language: locale,
        });
      } else if (name === "save") {
        const r = await post<{ already_saved: boolean }>(
          "/contacts/" + c.id + "/save",
        );
        notify(
          r.already_saved
            ? t("Already saved. No duplicate created.", "已存在，未重复保存。")
            : t("Contact saved.", "联系人已保存。"),
        );
      } else await post("/contacts/" + c.id + "/" + name);
      const updated = await api<Contact>("/contacts/" + c.id);
      setC(updated);
      onUpdate(updated);
      await refresh();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy("");
    }
  }
  const selectedPersona = personas.find((p) => p.id === pid);
  const assessment = [...c.assessments]
    .reverse()
    .find(
      (a) =>
        a.persona_id === pid && a.persona_version === selectedPersona?.version,
    );
  if (editing)
    return (
      <ContactForm
        contact={c}
        onClose={() => setEditing(false)}
        onDone={(updated) => {
          setC(updated);
          onUpdate(updated);
          setEditing(false);
        }}
      />
    );
  return (
    <Drawer title={t("Contact details", "联系人详情")} onClose={onClose}>
      <div className="drawer-profile">
        <Avatar name={c.name} large />
        <Badge tone={c.provider === "mock" ? "amber" : "blue"}>
          {c.provider === "mock"
            ? t("Mock · Fictional person", "模拟 · 虚构人物")
            : c.provider}
        </Badge>
        <h2>{c.name}</h2>
        <p>{c.title}</p>
        <strong>{c.company}</strong>
        <span className="location">
          <MapPin size={14} />
          {c.location || t("Location not provided", "未提供地区")}
        </span>
      </div>
      <div className="drawer-actions">
        <button
          className="button primary"
          onClick={() =>
            void go("/email?contact=" + c.id + (pid ? "&persona=" + pid : ""))
          }
        >
          <Mail size={16} />
          {t("Write email", "撰写邮件")}
        </button>
        <button
          className="button"
          disabled={!!busy}
          onClick={() => void action("save")}
        >
          {c.saved ? <Check size={15} /> : <Bookmark size={15} />}{" "}
          {c.saved ? t("Saved", "已保存") : t("Save", "保存")}
        </button>
        <button
          className="icon-button"
          aria-label="Edit contact"
          onClick={() => setEditing(true)}
        >
          <PencilLine size={16} />
        </button>
      </div>
      {error && (
        <div className="error-panel" role="alert">
          {error}
        </div>
      )}
      <section className="drawer-section">
        <h3>{t("Contact information", "联系信息")}</h3>
        <dl>
          <dt>{t("Email", "邮箱")}</dt>
          <dd>
            {c.email || "—"} <EmailStatus contact={c} />
          </dd>
          <dt>{t("School", "学校")}</dt>
          <dd>{c.school || t("Not provided", "未提供")}</dd>
          <dt>{t("Profile", "资料链接")}</dt>
          <dd>
            {c.profile_url ? (
              <External url={c.profile_url}>
                {t("View public profile", "查看公开资料")}
              </External>
            ) : (
              t("No profile link provided", "暂无资料链接")
            )}
          </dd>
        </dl>
        {c.provider !== "manual" && (
          <button
            className="button small-button"
            disabled={!!busy}
            onClick={() => void action("enrich")}
          >
            {busy === "enrich" ? <Busy /> : <Plus size={14} />}{" "}
            {t("Enrich contact / email", "补充联系人或邮箱")}
          </button>
        )}
        <p className="muted small">
          {t(
            "One contact per request. Apollo enrichment may use provider credits; cached results are reused.",
            "每次仅补充一人。Apollo 可能消耗额度，已补充结果会复用。",
          )}
        </p>
      </section>
      <section className="drawer-section">
        <h3>
          <Sparkles size={16} />
          {t("Why connect", "推荐依据")}
        </h3>
        <div className="row">
          <select
            aria-label="Recommendation persona"
            value={pid}
            onChange={(e) => setPid(e.target.value)}
          >
            <option value="">{t("Select persona", "选择画像")}</option>
            {personas.map((p) => (
              <option value={p.id} key={p.id}>
                {p.label}
              </option>
            ))}
          </select>
          <button
            className="button small-button"
            disabled={!pid || !!busy}
            onClick={() => void action("assess")}
          >
            {busy === "assess" ? <Busy /> : <Sparkles size={14} />}
          </button>
        </div>
        {assessment ? (
          <div className="recommendation-box">
            <Badge>
              {assessment.provider === "mock" ? "MOCK AI" : "AI"} · v
              {assessment.persona_version}
            </Badge>
            <p>{assessment.reason}</p>
            <small>
              {assessment.source_ids.length}{" "}
              {t("cited sources below", "条引用来源见下方")}
            </small>
          </div>
        ) : (
          <p className="muted">
            {t(
              "Choose a persona and request an assessment. Older persona versions are not reused.",
              "选择画像后获取推荐，不会复用旧版本画像的推荐。",
            )}
          </p>
        )}
      </section>
      <section className="drawer-section">
        <h3>{t("Sources & evidence", "来源与证据")}</h3>
        {c.sources.map((s) => (
          <div className="evidence" key={s.id}>
            <External url={s.url}>{s.title}</External>
            <p>{s.snippet}</p>
            <small>
              {s.provider.toUpperCase()} · <DateLabel value={s.retrieved_at} />{" "}
              ·{" "}
              {s.kind === "unverified_lead"
                ? t("Unverified lead", "待核实线索")
                : t("Profile evidence", "资料依据")}
            </small>
          </div>
        ))}
        <button
          className="button small-button"
          disabled={!!busy}
          onClick={() => void action("public-sources")}
        >
          {busy === "public-sources" ? <Busy /> : <Search size={14} />}{" "}
          {t("Find public sources", "补充公开来源")} ·{" "}
          {config?.public_search_mode === "mock" ? "Mock" : "SerpAPI"}
        </button>
      </section>
      <section className="drawer-section">
        <h3>{t("Tags & notes", "标签与备注")}</h3>
        <div className="tags">
          {c.tags.map((s) => (
            <Badge key={s}>{s}</Badge>
          ))}
        </div>
        <p>
          {c.notes ||
            t(
              "No notes yet. Use Edit to add context.",
              "暂无备注。点击编辑补充背景。",
            )}
        </p>
      </section>
      <section className="drawer-section">
        <h3>{t("Related drafts", "关联草稿")}</h3>
        {c.drafts?.length ? (
          c.drafts.map((d) => (
            <Nav
              key={d.id}
              className="draft-link"
              href={"/email?draft=" + d.id}
            >
              {d.subject || t("Untitled draft", "未命名草稿")}
              <ArrowUpRight size={15} />
            </Nav>
          ))
        ) : (
          <p className="muted">
            {t("No drafts for this contact yet.", "尚未为该联系人建立草稿。")}
          </p>
        )}
      </section>
    </Drawer>
  );
}

function ContactForm({
  contact,
  onClose,
  onDone,
}: {
  contact?: Contact;
  onClose: () => void;
  onDone: (c: Contact) => void;
}) {
  const { t, refresh } = useApp();
  const [data, setData] = useState({
      name: contact?.name || "",
      title: contact?.title || "",
      company: contact?.company || "",
      location: contact?.location || "",
      school: contact?.school || "",
      profile_url: contact?.profile_url || "",
      email: contact?.email || "",
      notes: contact?.notes || "",
      sector: contact?.domains.finance?.sector || "",
      tags: contact?.tags.join(", ") || "",
    }),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const body = {
        ...data,
        tags: data.tags
          .split(/[,，]/)
          .map((x) => x.trim())
          .filter(Boolean),
      };
      const c = contact
        ? await put<Contact>("/contacts/" + contact.id, body)
        : await post<Contact>("/contacts", body);
      await refresh();
      onDone(c);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Drawer
      title={
        contact
          ? t("Edit contact", "编辑联系人")
          : t("Add a contact", "添加联系人")
      }
      onClose={onClose}
    >
      <form className="contact-form" onSubmit={save}>
        <p className="muted">
          {t(
            "Add only information you know. An email address is optional.",
            "仅填写已知资料。邮箱为可选项。",
          )}
        </p>
        {error && (
          <div className="error-panel" role="alert">
            {error}
          </div>
        )}
        <div className="form-grid">
          {[
            ["name", "Full name", "姓名"],
            ["title", "Job title", "职位"],
            ["company", "Company / institution", "公司或机构"],
            ["location", "Location", "地区"],
            ["school", "School", "学校"],
            ["email", "Email (optional)", "邮箱（可选）"],
            ["profile_url", "Profile URL", "资料链接"],
            ["sector", "Finance focus", "金融领域"],
            ["tags", "Tags (comma separated)", "标签（逗号分隔）"],
          ].map(([key, en, zh]) => (
            <Field key={key} label={t(en, zh)} className="full">
              <input
                required={key === "name"}
                type={
                  key === "email"
                    ? "email"
                    : key === "profile_url"
                      ? "url"
                      : "text"
                }
                value={data[key as keyof typeof data]}
                onChange={(e) => setData({ ...data, [key]: e.target.value })}
              />
            </Field>
          ))}
          <Field label={t("Notes", "备注")} className="full">
            <textarea
              rows={4}
              value={data.notes}
              onChange={(e) => setData({ ...data, notes: e.target.value })}
            />
          </Field>
        </div>
        <div className="form-footer">
          <button type="button" className="button" onClick={onClose}>
            {t("Cancel", "取消")}
          </button>
          <button className="button primary" disabled={busy}>
            {busy ? <Busy /> : <Save size={16} />}{" "}
            {t("Save contact", "保存联系人")}
          </button>
        </div>
      </form>
    </Drawer>
  );
}
