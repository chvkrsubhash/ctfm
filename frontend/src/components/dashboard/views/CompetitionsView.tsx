'use client';

import { useEffect, useState, useCallback } from 'react';
import type { Event } from '@/types';
import { eventService } from '@/services/api.service';
import { formatDate, getErrorMessage } from '@/lib/api';

interface CompetitionsViewProps {
  onSelectEvent: (event: Event) => void;
  activeEventId?: string;
}

export default function CompetitionsView({ onSelectEvent, activeEventId }: CompetitionsViewProps) {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [regMsg, setRegMsg] = useState<{ [id: string]: string }>({});
  const [registering, setRegistering] = useState<string | null>(null);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await eventService.list(1, 50);
      setEvents(res.items);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const handleRegister = async (eventId: string) => {
    setRegistering(eventId);
    try {
      const res = await eventService.register(eventId);
      setRegMsg((prev) => ({ ...prev, [eventId]: res.message || 'Successfully registered!' }));
    } catch (err) {
      setRegMsg((prev) => ({ ...prev, [eventId]: getErrorMessage(err) }));
    } finally {
      setRegistering(null);
    }
  };

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', padding: 'var(--space-8)' }}>
      <div className="page-header">
        <div>
          <h1 className="page-header__title">Competitions</h1>
          <p className="page-header__subtitle">Browse all CTF events, register, and set your active arena</p>
        </div>
      </div>

      {error && <div className="alert alert--error" style={{ marginBottom: 'var(--space-6)' }}>{error}</div>}

      {loading ? (
        <div className="loading-screen">
          <div className="spinner" />
          <p className="text-muted">Loading competitions...</p>
        </div>
      ) : events.length === 0 ? (
        <div className="empty-state card">
          <div className="empty-state__title">No competitions found</div>
          <p>Check back soon for upcoming CTF events.</p>
        </div>
      ) : (
        <div className="grid grid-2" style={{ gap: 'var(--space-6)' }}>
          {events.map((ev) => {
            const isCurrent = ev.id === activeEventId;
            return (
              <div
                key={ev.id}
                className="card"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  border: isCurrent ? '2px solid var(--color-brand)' : '1px solid var(--color-border)',
                  boxShadow: isCurrent ? 'var(--shadow-brand)' : 'var(--shadow-sm)',
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
                    <span className={`badge ${ev.status === 'live' ? 'status-live' : 'badge--gray'}`}>
                      {ev.status.toUpperCase()}
                    </span>
                    <span className="badge badge--purple">
                      {ev.scoring_type === 'dynamic' ? 'Dynamic' : 'Static'} Scoring
                    </span>
                  </div>

                  <h2 style={{ fontSize: '1.25rem', marginBottom: 'var(--space-2)' }}>{ev.name}</h2>
                  <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-4)', lineHeight: '1.6' }}>
                    {ev.description || 'No description provided.'}
                  </p>

                  <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', marginBottom: 'var(--space-4)', fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                    <span>{formatDate(ev.start_date)} — {formatDate(ev.end_date)}</span>
                    {ev.max_teams && <span>Max {ev.max_teams} teams (size {ev.team_size})</span>}
                  </div>

                  {regMsg[ev.id] && (
                    <div className="alert alert--info" style={{ padding: 'var(--space-3)', fontSize: '0.8125rem', marginBottom: 'var(--space-4)' }}>
                      {regMsg[ev.id]}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 'var(--space-3)', paddingTop: 'var(--space-4)', borderTop: '1px solid var(--color-border)' }}>
                  <button
                    className={`btn ${isCurrent ? 'btn--secondary' : 'btn--primary'} btn--sm`}
                    style={{ flex: 1 }}
                    onClick={() => onSelectEvent(ev)}
                  >
                    {isCurrent ? 'Active Arena' : 'Select Competition'}
                  </button>

                  <button
                    className="btn btn--secondary btn--sm"
                    disabled={registering === ev.id}
                    onClick={() => handleRegister(ev.id)}
                  >
                    {registering === ev.id ? 'Registering...' : 'Register'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
