'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { adminService } from '@/services/api.service';
import type { AdminStats } from '@/types';

const ADMIN_MODULES = [
  {
    title: 'Challenges',
    href: '/admin/challenges',
    desc: 'Add, update, and publish flags and hints',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>
      </svg>
    ),
    color: '#a855f7',
  },
  {
    title: 'Events',
    href: '/admin/events',
    desc: 'Create and configure CTF competitions',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
        <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
      </svg>
    ),
    color: '#06b6d4',
  },
  {
    title: 'User Management',
    href: '/admin/users',
    desc: 'View accounts, assign roles, and manage status',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
    color: '#10b981',
  },
  {
    title: 'Submissions',
    href: '/admin/submissions',
    desc: 'Live flag submission logs and audit trail',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
      </svg>
    ),
    color: '#f59e0b',
  },
  {
    title: 'Audit Logs',
    href: '/admin/audit-logs',
    desc: 'Security tracking and administrative history',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
      </svg>
    ),
    color: '#f87171',
  },
  {
    title: 'Platform Settings',
    href: '/admin/settings',
    desc: 'Registration, 2FA policy, and branding config',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
      </svg>
    ),
    color: '#818cf8',
  },
];

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    adminService.getStats()
      .then(setStats)
      .catch((err) => setError(err?.message || 'Failed to load platform statistics'))
      .finally(() => setLoading(false));
  }, []);

  const statCards = [
    {
      value: stats?.total_challenges,
      label: 'Total Challenges',
      icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>,
      color: '#a855f7',
    },
    {
      value: stats?.total_events,
      label: `Events  •  ${stats?.active_events ?? 0} Live`,
      icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
      color: '#10b981',
    },
    {
      value: stats?.total_participants,
      label: 'Registered Users',
      icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>,
      color: '#06b6d4',
    },
    {
      value: stats?.total_solves,
      label: `Solves  •  ${stats?.total_submissions ?? 0} Submissions`,
      icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
      color: '#f59e0b',
    },
  ];

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', padding: 'var(--space-8)' }}>
      {/* Header */}
      <div className="page-header">
        <div>
          <div style={{ marginBottom: 'var(--space-2)' }}>
            <Link href="/dashboard" style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>
              ← User Dashboard
            </Link>
          </div>
          <h1 className="page-header__title">Admin Command Center</h1>
          <p className="page-header__subtitle">Manage challenges, events, participants, and security settings</p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
          <Link href="/admin/challenges" className="btn btn--primary">
            Manage Challenges
          </Link>
          <Link href="/admin/events/create" className="btn btn--secondary">
            + Create Event
          </Link>
        </div>
      </div>

      {error && <div className="alert alert--error" style={{ marginBottom: 'var(--space-6)' }}>{error}</div>}

      {/* Stat Cards */}
      <div className="grid grid-4" style={{ marginBottom: 'var(--space-10)' }}>
        {statCards.map((s) => (
          <div key={s.label} className="stat-card">
            <div className="stat-card__icon" style={{
              background: `${s.color}14`,
              border: `1px solid ${s.color}28`,
              color: s.color,
            }}>
              {s.icon}
            </div>
            <div className="stat-card__value">
              {loading ? '—' : (s.value ?? '—')}
            </div>
            <div className="stat-card__label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Module cards */}
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)',
          background: 'rgba(6,182,212,0.08)', border: '1px solid rgba(6,182,212,0.2)',
          borderRadius: 'var(--radius-full)', padding: '4px 12px',
          fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-accent)',
          marginBottom: 'var(--space-4)', letterSpacing: '0.08em', textTransform: 'uppercase',
        }}>
          Administration
        </div>
        <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.5rem', marginBottom: 'var(--space-1)' }}>
          Modules
        </h2>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
          Navigate to any admin section below
        </p>
      </div>

      <div className="grid grid-3">
        {ADMIN_MODULES.map((mod) => (
          <Link
            key={mod.title}
            href={mod.href}
            className="card"
            style={{ textDecoration: 'none', color: 'inherit', display: 'flex', flexDirection: 'column' }}
          >
            <div style={{
              width: '44px', height: '44px', borderRadius: 'var(--radius-md)',
              background: `${mod.color}12`,
              border: `1px solid ${mod.color}25`,
              color: mod.color,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: 'var(--space-4)',
              boxShadow: `0 0 16px ${mod.color}15`,
            }}>
              {mod.icon}
            </div>
            <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.125rem', marginBottom: 'var(--space-2)', letterSpacing: '0.02em' }}>
              {mod.title}
            </h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', flex: 1 }}>
              {mod.desc}
            </p>
            <div style={{ marginTop: 'var(--space-4)', fontSize: '0.875rem', color: mod.color, fontWeight: 700 }}>
              Open module →
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
