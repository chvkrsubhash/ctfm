// CTF Platform — API Service Layer
// All API calls go through this service. Components never call api.* directly.

import { api } from '@/lib/api';
import type {
  Event, EventDetail, PaginatedResponse, Challenge, Category,
  Team, TeamDetail, Leaderboard, Notification,
  Announcement, AdminStats, AuditLog, Certificate, SubmissionResponse,
} from '@/types';

// ── Events ────────────────────────────────────────────────────────────────
export const eventService = {
  list: async (page = 1, perPage = 20, status?: string) => {
    const params: Record<string, unknown> = { page, per_page: perPage };
    if (status) params.status = status;
    const { data } = await api.get<PaginatedResponse<Event>>('/events', { params });
    return data;
  },

  get: async (slug: string): Promise<EventDetail> => {
    const { data } = await api.get<EventDetail>(`/events/${slug}`);
    return data;
  },

  create: async (payload: Partial<Event>) => {
    const { data } = await api.post<EventDetail>('/events', payload);
    return data;
  },

  update: async (id: string, payload: Partial<Event>) => {
    const { data } = await api.patch<EventDetail>(`/events/${id}`, payload);
    return data;
  },

  delete: async (id: string) => {
    await api.delete(`/events/${id}`);
  },

  register: async (eventId: string) => {
    const { data } = await api.post(`/events/${eventId}/register`);
    return data;
  },
};

// ── Challenges ────────────────────────────────────────────────────────────
export const challengeService = {
  list: async (eventId: string, filters?: {
    category?: number;
    difficulty?: string;
    search?: string;
    all_statuses?: boolean;
  }): Promise<Challenge[]> => {
    const { data } = await api.get<Challenge[]>(`/events/${eventId}/challenges`, {
      params: filters,
    });
    return data;
  },

  listAdmin: async (eventId?: string, search?: string): Promise<any[]> => {
    const { data } = await api.get<any[]>('/admin/challenges', {
      params: { event_id: eventId, search },
    });
    return data;
  },

  get: async (challengeId: string): Promise<Challenge> => {
    const { data } = await api.get<Challenge>(`/challenges/${challengeId}`);
    return data;
  },

  create: async (eventId: string, payload: {
    name: string;
    description?: string;
    points: number;
    difficulty: string;
    category_id?: number | null;
    status?: string;
    flag?: string;
    is_case_sensitive?: boolean;
  }) => {
    const { data } = await api.post(`/events/${eventId}/challenges`, payload);
    return data;
  },

  update: async (challengeId: string, payload: Partial<{
    name: string;
    description: string;
    points: number;
    difficulty: string;
    category_id: number | null;
    status: string;
    flag?: string;
    is_case_sensitive?: boolean;
  }>) => {
    const { data } = await api.patch(`/challenges/${challengeId}`, payload);
    return data;
  },

  delete: async (challengeId: string) => {
    const { data } = await api.delete(`/challenges/${challengeId}`);
    return data;
  },

  listFlags: async (challengeId: string) => {
    const { data } = await api.get(`/challenges/${challengeId}/flags`);
    return data;
  },

  addFlag: async (challengeId: string, payload: { flag_value: string; flag_type?: string; is_case_sensitive?: boolean }) => {
    const { data } = await api.post(`/challenges/${challengeId}/flags`, payload);
    return data;
  },

  deleteFlag: async (challengeId: string, flagId: number) => {
    const { data } = await api.delete(`/challenges/${challengeId}/flags/${flagId}`);
    return data;
  },

  addHint: async (challengeId: string, payload: { content: string; cost: number; order_index?: number }) => {
    const { data } = await api.post(`/challenges/${challengeId}/hints`, payload);
    return data;
  },

  deleteHint: async (challengeId: string, hintId: number) => {
    const { data } = await api.delete(`/challenges/${challengeId}/hints/${hintId}`);
    return data;
  },

  submit: async (challengeId: string, flag: string): Promise<SubmissionResponse> => {
    const { data } = await api.post<SubmissionResponse>(`/challenges/${challengeId}/submit`, { flag });
    return data;
  },

  unlockHint: async (challengeId: string, hintId: number) => {
    const { data } = await api.post(`/challenges/${challengeId}/hints/${hintId}/unlock`);
    return data;
  },

  uploadFile: async (challengeId: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    const { data } = await api.post(`/challenges/${challengeId}/files`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },

  deleteFile: async (challengeId: string, fileId: string) => {
    const { data } = await api.delete(`/challenges/${challengeId}/files/${fileId}`);
    return data;
  },
};

// ── Categories ────────────────────────────────────────────────────────────
export const categoryService = {
  list: async (eventId: string): Promise<Category[]> => {
    const { data } = await api.get<Category[]>(`/events/${eventId}/categories`);
    return data;
  },

  create: async (eventId: string, payload: { name: string; color?: string; icon?: string }) => {
    const { data } = await api.post(`/events/${eventId}/categories`, payload);
    return data;
  },
};

// ── Teams ─────────────────────────────────────────────────────────────────
export const teamService = {
  list: async (eventId: string): Promise<Team[]> => {
    const { data } = await api.get<Team[]>(`/events/${eventId}/teams`);
    return data;
  },

  create: async (eventId: string, payload: { name: string; description?: string; is_private?: boolean }): Promise<Team> => {
    const { data } = await api.post<Team>(`/events/${eventId}/teams`, payload);
    return data;
  },

  invite: async (eventId: string, teamId: string, username: string) => {
    const { data } = await api.post(`/events/${eventId}/teams/${teamId}/invite`, { username });
    return data;
  },

  acceptInvitation: async (eventId: string, token: string) => {
    const { data } = await api.post(`/events/${eventId}/teams/invitations/${token}/accept`);
    return data;
  },
};

// ── Leaderboard ───────────────────────────────────────────────────────────
export const leaderboardService = {
  get: async (eventId: string, page = 1, perPage = 50): Promise<Leaderboard> => {
    const { data } = await api.get<Leaderboard>(`/events/${eventId}/leaderboard`, {
      params: { page, per_page: perPage },
    });
    return data;
  },
};

// ── Announcements ─────────────────────────────────────────────────────────
export const announcementService = {
  list: async (eventId: string): Promise<Announcement[]> => {
    const { data } = await api.get<Announcement[]>(`/events/${eventId}/announcements`);
    return data;
  },

  create: async (eventId: string, payload: { title: string; content: string; visibility?: string; is_pinned?: boolean }) => {
    const { data } = await api.post(`/events/${eventId}/announcements`, payload);
    return data;
  },
};

// ── Notifications ──────────────────────────────────────────────────────────
export const notificationService = {
  list: async (unreadOnly = false): Promise<{ notifications: Notification[]; unread_count: number }> => {
    const { data } = await api.get('/notifications', { params: { unread_only: unreadOnly } });
    return data;
  },

  markRead: async (id: string) => {
    await api.post(`/notifications/${id}/read`);
  },

  markAllRead: async () => {
    await api.post('/notifications/read-all');
  },
};

// ── Admin ──────────────────────────────────────────────────────────────────
export const adminService = {
  getStats: async (): Promise<AdminStats> => {
    const { data } = await api.get<AdminStats>('/admin/stats');
    return data;
  },

  getAuditLogs: async (page = 1, action?: string): Promise<PaginatedResponse<AuditLog>> => {
    const { data } = await api.get<PaginatedResponse<AuditLog>>('/admin/audit-logs', {
      params: { page, action },
    });
    return data;
  },

  getSubmissions: async (page = 1, result?: string, eventId?: string) => {
    const { data } = await api.get('/admin/submissions', {
      params: { page, result, event_id: eventId },
    });
    return data;
  },

  getUsers: async (page = 1, search?: string) => {
    const { data } = await api.get('/admin/users', {
      params: { page, search },
    });
    return data;
  },

  toggleUserStatus: async (userId: string, isActive: boolean) => {
    const { data } = await api.patch(`/admin/users/${userId}`, { is_active: isActive });
    return data;
  },

  getSettings: async () => {
    const { data } = await api.get('/admin/settings');
    return data;
  },

  updateSettings: async (settings: Record<string, any>) => {
    const { data } = await api.patch('/admin/settings', settings);
    return data;
  },
};

// ── Certificates ───────────────────────────────────────────────────────────
export const certificateService = {
  verify: async (uid: string): Promise<Certificate> => {
    const { data } = await api.get<Certificate>(`/certificates/${uid}`);
    return data;
  },

  generate: async (eventId: string) => {
    const { data } = await api.post(`/certificates/events/${eventId}/generate`);
    return data;
  },
};

// ── Auth (2FA) ─────────────────────────────────────────────────────────────
export const authService = {
  setup2FA: async (): Promise<{ secret: string; qr_code: string }> => {
    const { data } = await api.post('/auth/2fa/setup');
    return data;
  },

  confirm2FA: async (code: string): Promise<{ backup_codes: string[]; message: string }> => {
    const { data } = await api.post('/auth/2fa/confirm', { code });
    return data;
  },

  disable2FA: async (password: string) => {
    const { data } = await api.post('/auth/2fa/disable', { password });
    return data;
  },

  forgotPassword: async (email: string) => {
    const { data } = await api.post('/auth/forgot-password', { email });
    return data;
  },

  resetPassword: async (token: string, newPassword: string) => {
    const { data } = await api.post('/auth/reset-password', { token, new_password: newPassword });
    return data;
  },

  verifyEmail: async (token: string) => {
    const { data } = await api.post('/auth/verify-email', { token });
    return data;
  },

  changePassword: async (currentPassword: string, newPassword: string) => {
    const { data } = await api.post('/auth/change-password', {
      current_password: currentPassword,
      new_password: newPassword,
    });
    return data;
  },
};
