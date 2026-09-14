// CTF Platform — TypeScript Type Definitions

export type UserRole = 'super_admin' | 'event_admin' | 'challenge_author' | 'moderator' | 'participant';

export interface Role {
  id: number;
  name: UserRole;
}

export interface User {
  id: string;
  email: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  country: string | null;
  bio: string | null;
  website: string | null;
  is_active: boolean;
  is_verified: boolean;
  totp_enabled: boolean;
  last_login_at: string | null;
  created_at: string;
  roles: Role[];
}

export interface PublicUser {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  country: string | null;
  created_at: string;
}

// ── Auth ─────────────────────────────────────────────────────────────────
export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface LoginRequest {
  identifier: string;
  password: string;
  totp_code?: string;
}

export interface RegisterRequest {
  email: string;
  username: string;
  password: string;
  display_name?: string;
}

// ── Events ────────────────────────────────────────────────────────────────
export type EventStatus = 'draft' | 'registration_open' | 'upcoming' | 'live' | 'ended' | 'archived';
export type EventVisibility = 'public' | 'private' | 'invite_only';
export type ScoringType = 'static' | 'dynamic';
export type LeaderboardStatus = 'live' | 'frozen' | 'final';

export interface Event {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  banner_url: string | null;
  logo_url: string | null;
  start_date: string | null;
  end_date: string | null;
  registration_start: string | null;
  registration_end: string | null;
  timezone: string;
  status: EventStatus;
  visibility: EventVisibility;
  scoring_type: ScoringType;
  max_participants: number | null;
  max_teams: number | null;
  team_size: number;
  created_at: string;
}

export interface EventDetail extends Event {
  rules: string | null;
  require_approval: boolean;
  submission_rate_limit: number;
  leaderboard_status: LeaderboardStatus;
}

// ── Teams ─────────────────────────────────────────────────────────────────
export interface Team {
  id: string;
  event_id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  description: string | null;
  is_private: boolean;
  is_disqualified: boolean;
  country: string | null;
  created_at: string;
}

export interface TeamMember {
  user: PublicUser;
  role: 'owner' | 'member';
  joined_at: string;
}

export interface TeamDetail extends Team {
  members: TeamMember[];
}

// ── Challenges ────────────────────────────────────────────────────────────
export type Difficulty = 'beginner' | 'easy' | 'medium' | 'hard' | 'insane';
export type ChallengeStatus = 'draft' | 'published' | 'hidden' | 'archived';

export interface Category {
  id: number;
  name: string;
  slug: string;
  color: string | null;
  icon: string | null;
}

export interface ChallengeFile {
  id: string;
  original_filename: string;
  file_size: number;
  mime_type: string;
  download_url: string;
}

export interface ChallengeHint {
  id: number;
  cost: number;
  order_index: number;
  is_unlocked: boolean;
  content: string | null;
}

export interface Challenge {
  id: string;
  event_id: string;
  name: string;
  slug: string;
  description: string | null;
  points: number;
  current_points: number;
  difficulty: Difficulty;
  category: Category | null;
  status: ChallengeStatus;
  solve_count: number;
  is_solved: boolean;
  files: ChallengeFile[];
  hints: ChallengeHint[];
}

// ── Submissions ────────────────────────────────────────────────────────────
export type SubmissionResult = 'correct' | 'incorrect' | 'already_solved' | 'rate_limited' | 'challenge_not_active' | 'event_not_live';

export interface SubmissionResponse {
  result: SubmissionResult;
  message: string;
  points_awarded: number | null;
}

// ── Leaderboard ────────────────────────────────────────────────────────────
export interface LeaderboardEntry {
  rank: number;
  team_id: string;
  team_name: string;
  team_logo: string | null;
  country: string | null;
  total_points: number;
  solve_count: number;
  last_solve_at: string | null;
}

export interface Leaderboard {
  event_id: string;
  status: LeaderboardStatus;
  is_frozen: boolean;
  entries: LeaderboardEntry[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
  updated_at: string;
}

// ── Notifications ──────────────────────────────────────────────────────────
export type NotificationType =
  | 'event_started' | 'event_ending' | 'event_ended'
  | 'announcement' | 'team_invitation' | 'team_joined'
  | 'challenge_solved' | 'admin_message' | 'certificate_ready';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  metadata: Record<string, unknown> | null;
  is_read: boolean;
  created_at: string;
}

// ── Announcements ──────────────────────────────────────────────────────────
export interface Announcement {
  id: string;
  event_id: string | null;
  title: string;
  content: string;
  visibility: 'public' | 'event_only' | 'team_only';
  is_pinned: boolean;
  created_at: string;
  author: PublicUser | null;
}

// ── Admin ──────────────────────────────────────────────────────────────────
export interface AdminStats {
  total_events: number;
  active_events: number;
  total_participants: number;
  total_teams: number;
  total_challenges: number;
  total_submissions: number;
  total_solves: number;
}

export interface AuditLog {
  id: string;
  actor_id: string | null;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  ip_address: string | null;
  created_at: string;
}

// ── Pagination ─────────────────────────────────────────────────────────────
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

// ── API Error ──────────────────────────────────────────────────────────────
export interface ApiError {
  detail: string | { msg: string; loc: string[] }[];
}

// ── Certificate ────────────────────────────────────────────────────────────
export interface Certificate {
  valid: boolean;
  certificate_uid: string;
  participant: string;
  team: string | null;
  event: string;
  rank: number | null;
  score: number;
  solve_count: number;
  generated_at: string;
}
