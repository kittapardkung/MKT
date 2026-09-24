export type PostStatus = 'DRAFT' | 'REVIEW' | 'APPROVED' | 'PUBLISHED';
export type Format = 'ภาพ' | 'วิดีโอ';
export type Role = 'editor' | 'creative';
// PPS Content System: Push (Awareness) / Pull (Authority) / Sell (ปิดการขาย) / Event (Test Drive/กิจกรรม)
export type ContentType = 'Push' | 'Pull' | 'Sell' | 'Event';
export type AgentId = 'SCOUT' | 'COMPASS' | 'SPARK' | 'ALMANAC';

export type Post = {
  id: string;
  date: string; // yyyy-mm-dd
  time: string; // HH:mm
  channel: string;
  title: string;
  format: Format;
  status: PostStatus;
  owner: string;
  caption: string;
  tags: string;
  src_link: string;
  final_link: string;
  approved_by: string;
  approved_at: string | null;
  post_url: string;
  content_type: ContentType | null;
  is_viral: boolean;
};

export type Tag = {
  tag: string;
  active: boolean;
};

export type Idea = {
  id: string;
  title: string;
  category: string;
  note: string;
  score: number;
  promoted_post_id: string | null;
  agent: AgentId;
  suggested_date: string | null;
  suggested_channel: string | null;
  suggested_format: Format | null;
};

// บล็อกเนื้อหาในหน้าแดชบอร์ดของแต่ละ agent (SCOUT/COMPASS เป็นหลัก) — หนึ่งแถวต่อหนึ่งการ์ด
export type AgentReportData =
  | { kind: 'kpi'; items: { label: string; value: string; note?: string }[] }
  | { kind: 'scorecard'; rows: { label: string; value: string; highlight?: boolean }[] }
  | { kind: 'list'; items: string[] }
  | { kind: 'table'; columns: string[]; rows: string[][] }
  | { kind: 'table'; columns: string[]; groups: { label: string; rows: string[][] }[] }
  | { kind: 'bar'; items: { label: string; value: number; highlight?: boolean }[] };

export type AgentReport = {
  id: string;
  agent: AgentId;
  section: string;
  title: string;
  body: string;
  data: AgentReportData | null;
  sort_order: number;
  updated_at: string;
  updated_by: string | null;
};

export type EventRow = {
  date: string;
  name: string;
};

export type Target = {
  key: string;
  label: string;
  target: number;
  period: string;
};

export type Lead = {
  lead_id: string;
  created_date: string | null;
  phone_number: string;
  interested_model: string | null;
  source: string | null;
  lead_status: string | null;
};

export type Bootstrap = {
  posts: Post[];
  tags: Tag[];
  ideas: Idea[];
  events: EventRow[];
  targets: Target[];
  leads: Lead[];
  agentReports: AgentReport[];
  me: string;
  role: Role;
};
