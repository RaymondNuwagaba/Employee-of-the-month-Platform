export type Role = 'employee' | 'hr' | 'admin'

export interface UserBrief {
  id: number
  full_name: string
  department: string | null
  job_title: string | null
  photo_url: string | null
}

export interface User extends UserBrief {
  email: string
  employee_id: string | null
  department_id: number | null
  role: Role
  is_active: boolean
  is_eligible: boolean
  hire_date: string | null
  last_login_at: string | null
}

export interface Criterion {
  id: number
  key: string
  name: string
  description: string
  question: string
  weight: number
  sort_order: number
}

export type CampaignStatus = 'draft' | 'open' | 'closed' | 'published' | 'scheduled'

export interface Campaign {
  id: number
  name: string
  month: number
  year: number
  start_at: string
  end_at: string
  status: Exclude<CampaignStatus, 'scheduled'>
  effective_status: CampaignStatus
  is_voting_open: boolean
}

export interface MyVote {
  campaign_id: number
  candidate: UserBrief
  ratings: Record<string, number>
  comment: string | null
  submitted_at: string
}

export interface CurrentCampaign {
  campaign: Campaign | null
  my_vote: MyVote | null
  votes_cast: number
  eligible_voters: number
}

export interface BreakdownItem {
  criterion_id: number
  key: string
  name: string
  weight: number
  average_rating: number
  percent: number
  contribution: number
}

export interface Winner {
  campaign_id: number
  campaign_name: string
  month: number
  year: number
  user: UserBrief
  final_score: number
  evaluations: number
  breakdown: BreakdownItem[]
  citation: string | null
  comments: string[]
  published_at: string
}

export interface ResultRow {
  rank: number | null
  user: UserBrief
  final_score: number
  evaluations: number
  qualified: boolean
  tied_with_next: boolean
  breakdown: BreakdownItem[]
}

export interface CampaignResults {
  campaign: Campaign
  eligible_voters: number
  votes_cast: number
  participation: number
  min_evaluations: number
  results: ResultRow[]
  winner_user_id: number | null
}

export interface MonthlyEntry {
  campaign_id: number
  month: number
  score: number
  raw_score: number
  evaluations: number
  qualified: boolean
  rank: number | null
  won: boolean
}

export interface AnnualRow {
  rank: number
  user: UserBrief
  annual_score: number
  months_counted: number
  months_recognized: number
  monthly_wins: number
  nominations: number
  best_score: number
  average_when_nominated: number
  monthly: MonthlyEntry[]
}

export interface Stats {
  year: number
  nominations: number
  monthly_wins: number
  annual_score: number | null
  annual_rank: number | null
  best_score: number | null
  badges: string[]
  history: { campaign_id: number; month: number; year: number; score: number; evaluations: number; rank: number | null; won: boolean }[]
}

export interface Department {
  id: number
  name: string
  description: string | null
  is_active: boolean
  employee_count: number
}

export interface Overview {
  current_campaign: Campaign | null
  total_employees: number
  eligible_voters: number
  votes_submitted: number
  participation: number
  days_remaining: number | null
  leader: ResultRow | null
  department_participation: { department: string; employees: number; voted: number; participation: number }[]
  monthly_participation: { label: string; votes: number; participation: number }[]
}

export interface CommentItem {
  vote_id: number
  campaign_name: string
  candidate: UserBrief
  comment: string
  approved: boolean | null
  submitted_at: string
}

export interface AuditEntry {
  id: number
  user: string | null
  action: string
  entity: string | null
  entity_id: string | null
  old_value: unknown
  new_value: unknown
  ip_address: string | null
  created_at: string
}

export interface AppSettings {
  min_tenure_days: number
  min_evaluations: number
  comments_require_approval: boolean
  managers_eligible: boolean
}

export interface AuthConfig {
  sso_enabled: boolean
  tenant_id: string | null
  client_id: string | null
  dev_mode: boolean
}
