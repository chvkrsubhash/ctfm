// CTF Platform — Zustand Auth Store
'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '@/types';
import { api, setAccessToken, clearAccessToken, getErrorMessage } from '@/lib/api';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;

  // Actions
  login: (identifier: string, password: string, totpCode?: string) => Promise<void>;
  register: (email: string, username: string, password: string, displayName?: string) => Promise<string>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  setUser: (user: User | null) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isLoading: false,
      isAuthenticated: false,

      login: async (identifier, password, totpCode) => {
        set({ isLoading: true });
        try {
          const { data } = await api.post('/auth/login', {
            identifier,
            password,
            totp_code: totpCode,
          });
          setAccessToken(data.access_token);

          // Load user profile
          const { data: user } = await api.get('/users/me');
          set({ user, isAuthenticated: true });
        } finally {
          set({ isLoading: false });
        }
      },

      register: async (email, username, password, displayName) => {
        set({ isLoading: true });
        try {
          const { data } = await api.post('/auth/register', {
            email,
            username,
            password,
            display_name: displayName,
          });
          return data.message as string;
        } finally {
          set({ isLoading: false });
        }
      },

      logout: async () => {
        try {
          await api.post('/auth/logout', {});
        } catch {
          // Ignore errors on logout
        }
        clearAccessToken();
        set({ user: null, isAuthenticated: false });
      },

      refreshUser: async () => {
        try {
          const { data } = await api.get('/users/me');
          set({ user: data, isAuthenticated: true });
        } catch {
          clearAccessToken();
          set({ user: null, isAuthenticated: false });
        }
      },

      setUser: (user) => set({ user, isAuthenticated: !!user }),
    }),
    {
      name: 'ctf-auth',
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
    }
  )
);

// Convenience selector hooks
export const useUser = () => useAuthStore((s) => s.user);
export const useIsAuthenticated = () => useAuthStore((s) => s.isAuthenticated);

export function hasRole(user: User | null, ...roles: string[]): boolean {
  if (!user) return false;
  const userRoles = new Set<string>(user.roles.map((r) => r.name));
  return roles.some((r) => userRoles.has(r));
}

export function isAdmin(user: User | null): boolean {
  return hasRole(user, 'super_admin', 'event_admin');
}

export function isSuperAdmin(user: User | null): boolean {
  return hasRole(user, 'super_admin');
}
