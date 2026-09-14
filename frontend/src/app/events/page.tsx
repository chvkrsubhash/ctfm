'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { eventService } from '@/services/api.service';
import type { Event, PaginatedResponse } from '@/types';

const STATUSES = [
  { value: '',                  label: 'All Events' },
  { value: 'live',              label: '🔴 Live Now' },
  { value: 'registration_open', label: 'Registration Open' },
  { value: 'upcoming',          label: 'Upcoming' },
  { value: 'ended',             label: 'Ended' },
];

const STATUS_COLORS: Record<string, string> = {
  live:              'status-live',
  registration_open: 'status-registration_open',
  upcoming:          'status-upcoming',
  ended:             'status-ended',
  draft:             'status-draft',
  archived:          'status-archived',
};

const STATUS_LABELS: Record<string, string> = {
  live:              'LIVE',
  registration_open: 'Registration Open',
  upcoming:          'Upcoming',
  ended:             'Ended',
  draft:             'Draft',
  archived:          'Archived',
};

const BANNER_GRADIENTS: Record<string, string> = {
  live:              'linear-gradient(135deg, rgba(16,185,129,0.2) 0%, rgba(6,182,212,0.15) 100%)',
  registration_open: 'linear-gradient(135deg, rgba(96,165,250,0.2) 0%, rgba(168,85,247,0.15) 100%)',
  upcoming:          'linear-gradient(135deg, rgba(167,139,250,0.2) 0%, rgba(124,58,237,0.15) 100%)',
  ended:             'linear-gradient(135deg, rgba(100,116,139,0.15) 0%, rgba(51,65,85,0.2) 100%)',
  default:           'linear-gradient(135deg, rgba(124,58,237,0.2) 0%, rgba(6,182,212,0.15) 100%)',
};

function formatDate(d: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function EventsPage() {
  const [data, setData] = useState<PaginatedResponse<Event> | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const result = await eventService.list(1, 20, statusFilter || undefined);
        setData(result);
      } catch { /* ignore */ }
      finally { setLoading(false); }
    })();
  }, [statusFilter]);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg-primary)', position: 'relative', overflowX: 'hidden' }}>

      {/* Grid background */}
      <div style={{
        position: 'fixed', inset: 0,
        backgroundImage: `
          linear-gradient(rgba(168,85,247,0.02) 1px, transparent 1px),
          linear-gradient(90deg, rgba(168,85,247,0.02) 1px, transparent 1px)
        `,
        backgroundSize: '60px 60px',
        pointerEvents: 'none', zIndex: 0,
      }} />
      <div style={{
        position: 'fixed', top: '-25%', left: '50%', transform: 'translateX(-50%)',
        width: '70vw', height: '60vh',
        background: 'radial-gradient(ellipse, rgba(124,58,237,0.07) 0%, transparent 70%)',
        pointerEvents: 'none', zIndex: 0,
      }} />

      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: 'var(--space-8) var(--space-6)', position: 'relative', zIndex: 1 }}>

        {/* Header */}
        <div style={{ paddingTop: 'var(--space-8)', marginBottom: 'var(--space-8)' }}>
          <div style={{ marginBottom: 'var(--space-6)' }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)',
              background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.2)',
              borderRadius: 'var(--radius-full)', padding: '4px 12px',
              fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-brand)',
              marginBottom: 'var(--space-4)', letterSpacing: '0.08em', textTransform: 'uppercase',
            }}>
              CTF Competitions
            </div>
            <h1 style={{
              fontFamily: 'var(--font-heading)', fontSize: 'clamp(1.875rem, 4vw, 2.75rem)',
              fontWeight: 700, marginBottom: 'var(--space-2)', letterSpacing: '0.01em',
            }}>
              Upcoming{' '}
              <span style={{ background: 'var(--gradient-brand)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                Events
              </span>
            </h1>
            <p style={{ color: 'var(--color-text-secondary)' }}>
              Discover and register for the latest CTF competitions
            </p>
          </div>

          {/* Pill filter bar */}
          <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            {STATUSES.map((s) => (
              <button
                key={s.value}
                className={`cat-pill ${statusFilter === s.value ? 'cat-pill--active' : ''}`}
                onClick={() => setStatusFilter(s.value)}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex-center" style={{ padding: 'var(--space-16)' }}>
            <div className="spinner spinner--lg" />
          </div>
        ) : !data?.items.length ? (
          <div className="empty-state">
            <div style={{ fontSize: '3rem', marginBottom: 'var(--space-4)', opacity: 0.3 }}>🏴</div>
            <div className="empty-state__title">No events found</div>
            <p>Check back soon for upcoming CTF competitions.</p>
          </div>
        ) : (
          <div className="grid grid-auto">
            {data.items.map((event) => (
              <Link key={event.id} href={`/events/${event.slug}`} style={{ textDecoration: 'none' }}>
                <div className="event-card">
                  {/* Banner */}
                  <div className="event-card__banner" style={{
                    background: BANNER_GRADIENTS[event.status] || BANNER_GRADIENTS.default,
                  }}>
                    {event.banner_url ? (
                      <img src={event.banner_url} alt={event.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <div className="event-card__banner-placeholder">CTF</div>
                    )}

                    {/* Decorative grid inside banner */}
                    <div style={{
                      position: 'absolute', inset: 0, opacity: 0.15,
                      backgroundImage: `linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)`,
                      backgroundSize: '20px 20px',
                    }} />

                    {/* Status badge */}
                    <div style={{ position: 'absolute', top: 'var(--space-3)', left: 'var(--space-3)' }}>
                      <span className={`badge ${STATUS_COLORS[event.status] || 'badge--gray'}`}>
                        {STATUS_LABELS[event.status] || event.status}
                      </span>
                    </div>

                    {/* Live pulse */}
                    {event.status === 'live' && (
                      <div style={{ position: 'absolute', top: 'var(--space-3)', right: 'var(--space-3)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <div style={{
                          width: '8px', height: '8px', borderRadius: '50%',
                          background: '#34d399', animation: 'pulse 1.5s ease infinite',
                          boxShadow: '0 0 8px rgba(52,211,153,0.6)',
                        }} />
                      </div>
                    )}
                  </div>

                  {/* Body */}
                  <div className="event-card__body">
                    <div className="event-card__name">{event.name}</div>
                    {event.description && (
                      <p style={{
                        fontSize: '0.875rem', color: 'var(--color-text-muted)',
                        marginBottom: 'var(--space-3)', lineHeight: 1.6,
                        display: '-webkit-box', WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical', overflow: 'hidden',
                      }}>
                        {event.description}
                      </p>
                    )}
                    <div className="event-card__meta">
                      <span className="badge badge--gray">
                        📅 {formatDate(event.start_date)}
                      </span>
                      {event.max_teams && (
                        <span className="badge badge--purple">
                          👥 Max {event.max_teams} teams
                        </span>
                      )}
                      <span className="badge badge--cyan">
                        {event.scoring_type === 'dynamic' ? '⚡ Dynamic' : '📌 Static'} Scoring
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
