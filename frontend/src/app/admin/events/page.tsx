'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { eventService } from '@/services/api.service';
import type { Event } from '@/types';
import { formatDate } from '@/lib/api';

export default function AdminEventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    eventService.list(1, 50)
      .then((res) => setEvents(res.items))
      .catch((err) => setError(err?.message || 'Failed to load events'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', padding: 'var(--space-8)' }}>
      <div className="page-header">
        <div>
          <div style={{ marginBottom: 'var(--space-2)' }}>
            <Link href="/dashboard" style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
              ← Dashboard
            </Link>
          </div>
          <h1 className="page-header__title">Manage Events</h1>
          <p className="page-header__subtitle">Create, monitor, and configure CTF competitions</p>
        </div>
        <Link href="/admin/events/create" className="btn btn--primary">
          + Create Event
        </Link>
      </div>

      {error && <div className="alert alert--error" style={{ marginBottom: 'var(--space-6)' }}>{error}</div>}

      {loading ? (
        <div className="loading-screen">
          <div className="spinner" />
          <p className="text-muted">Loading events...</p>
        </div>
      ) : events.length === 0 ? (
        <div className="empty-state card">
          <div className="empty-state__title">No events found</div>
          <p>Get started by creating your first CTF competition.</p>
          <Link href="/admin/events/create" className="btn btn--primary" style={{ marginTop: 'var(--space-4)' }}>
            Create First Event
          </Link>
        </div>
      ) : (
        <div className="card" style={{ overflowX: 'auto', padding: 0 }}>
          <table className="leaderboard-table">
            <thead>
              <tr>
                <th>Event</th>
                <th>Status</th>
                <th>Schedule</th>
                <th>Teams</th>
                <th>Scoring</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {events.map((ev) => (
                <tr key={ev.id}>
                  <td>
                    <div style={{ fontWeight: '700', color: 'var(--color-text-primary)' }}>{ev.name}</div>
                    <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>/{ev.slug}</div>
                  </td>
                  <td>
                    <span className={`badge ${ev.status === 'live' ? 'status-live' : 'badge--gray'}`}>
                      {ev.status.toUpperCase()}
                    </span>
                  </td>
                  <td style={{ fontSize: '0.875rem' }}>
                    <div>{formatDate(ev.start_date)}</div>
                    <div style={{ color: 'var(--color-text-muted)' }}>to {formatDate(ev.end_date)}</div>
                  </td>
                  <td style={{ fontSize: '0.875rem' }}>
                    {ev.max_teams ? `Max ${ev.max_teams} (${ev.team_size}/team)` : 'Unlimited'}
                  </td>
                  <td>
                    <span className="badge badge--purple">{ev.scoring_type}</span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <Link href={`/events/${ev.slug}`} className="btn btn--secondary btn--sm">
                      View Event →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
