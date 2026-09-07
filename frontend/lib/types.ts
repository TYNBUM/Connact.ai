export type PersonaData = {
  name: string;
  education: string;
  experience: string;
  skills: string;
  sectors: string;
  career_goals: string;
  target_regions: string;
  target_roles: string;
  contact_purpose: string;
};
export type Persona = {
  id: string;
  label: string;
  version: number;
  data: PersonaData;
  updated_at: string;
};
export type Evidence = {
  id: string;
  provider: string;
  url: string;
  title: string;
  snippet: string;
  kind: string;
  retrieved_at: string;
};
export type Assessment = {
  id: string;
  contact_id: string;
  persona_id: string;
  persona_version: number;
  reason: string;
  provider: string;
  source_ids: string[];
  language: string;
};
export type Contact = {
  id: string;
  provider: string;
  provider_id: string | null;
  saved: boolean;
  name: string;
  title: string;
  company: string;
  location: string;
  school: string;
  profile_url: string;
  email: string;
  email_status: string;
  tags: string[];
  notes: string;
  domains: Record<string, { sector: string }>;
  sources: Evidence[];
  assessments: Assessment[];
  drafts?: Draft[];
};
export type Draft = {
  id: string;
  contact_id: string | null;
  persona_id: string | null;
  persona_version: number | null;
  language: "en" | "zh";
  purpose: string;
  starting_point: string;
  tone: string;
  subject: string;
  body_html: string;
  status: "draft" | "ready";
  revision: number;
  updated_at: string;
  generation_provider: string;
};
export type Preview = {
  subject: string;
  body_html: string;
  body_text: string;
  missing_variables: string[];
  can_mark_ready: boolean;
  persona_changed: boolean;
  recipient_email: string;
  variables: Record<string, string>;
};
export type Config = {
  people_mode: string;
  ai_mode: string;
  public_search_mode: string;
  providers: Record<string, boolean>;
};
