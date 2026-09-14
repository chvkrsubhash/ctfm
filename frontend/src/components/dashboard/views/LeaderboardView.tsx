'use client';

import { useEffect, useState, useCallback } from 'react';
import type { Event, Leaderboard, LeaderboardEntry } from '@/types';
import { leaderboardService } from '@/services/api.service';
import { formatDate, getErrorMessage } from '@/lib/api';

interface LeaderboardViewProps {
  activeEvent: Event | null;
}

export default function LeaderboardView({ activeEvent }: LeaderboardViewProps) {
  const [data, setData] = useState<Leaderboard | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);

  const loadLeaderboard = useCallback(async () => {
    if (!activeEvent) return;
    setLoading(true);
    setError('');
    try {
      const res = await leaderboardService.get(activeEvent.id, page, 50);
      setData(res);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [activeEvent, page]);

  useEffect(() => {
    loadLeaderboard();
  }, [loadLeaderboard]);

  if (!activeEvent) {
    return (
      <div style={{ maxWidth: '800px', margin: 'var(--space-12) auto', textAlign: 'center', padding: 'var(--space-8)' }}>
        <h2>Select an Event to View Leaderboard</h2>
        <p style={{ color: 'var(--color-text-secondary)', marginTop: 'var(--space-2)' }}>
          Choose a competition from the topbar menu to view real-time standings.
        </p>
      </div>
    );
  }

  const getRankBadge = (rank: number) => {
    if (rank === 1) return <span className="badge badge--yellow" style={{ fontWeight: 800 }}>#1</span>;
    if (rank === 2) return <span className="badge badge--gray" style={{ fontWeight: 800 }}>#2</span>;
    if (rank === 3) return <span className="badge badge--orange" style={{ fontWeight: 800, background: '#fef3c7', color: '#b45309' }}>#3</span>;
    return <span style={{ color: 'var(--color-text-secondary)', fontWeight: 600 }}>#{rank}</span>;
  };

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', padding: 'var(--space-8)' }}>
      <div className="page-header">
        <div>
          <h1 className="page-header__title">Leaderboard</h1>
          <p className="page-header__subtitle">
            Standings for {activeEvent.name} ({data?.is_frozen ? 'Scoreboard Frozen' : 'Live Real-Time'})
          </p>
        </div>
        <button className="btn btn--secondary" onClick={loadLeaderboard} disabled={loading}>
          {loading ? 'Refreshing...' : 'Refresh Scores'}
        </button>
      </div>

      {error && <div className="alert alert--error" style={{ marginBottom: 'var(--space-6)' }}>{error}</div>}

      {loading && !data ? (
        <div className="loading-screen">
          <div className="spinner" />
          <p className="text-muted">Loading scores...</p>
        </div>
      ) : !data || data.entries.length === 0 ? (
        <div className="empty-state card">
          <div className="empty-state__title">No solves recorded yet</div>
          <p>Be the first team to solve a challenge and claim the #1 spot!</p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
          <table className="leaderboard-table">
            <thead>
              <tr>
                <th style={{ width: '80px', textAlign: 'center' }}>Rank</th>
                <th>Team</th>
                <th>Solves</th>
                <th>Total Points</th>
                <th style={{ textAlign: 'right' }}>Last Solve</th>
              </tr>
            </thead>
            <tbody>
              {data.entries.map((entry: LeaderboardEntry) => (
                <tr key={entry.team_id} style={{ background: entry.rank <= 3 ? 'rgba(37, 99, 235, 0.02)' : 'transparent' }}>
                  <td style={{ textAlign: 'center', fontSize: '1.125rem', fontWeight: 700 }}>
                    {getRankBadge(entry.rank)}
                  </td>
                  <td>
                    <div style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>
                      {entry.team_name}
                    </div>
                    {entry.country && (
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                        {entry.country}
                      </span>
                    )}
                  </td>
                  <td>
                    <span className="badge badge--blue" style={{ fontSize: '0.75rem' }}>
                      {entry.solve_count} solved
                    </span>
                  </td>
                  <td>
                    <span style={{ fontSize: '1.125rem', fontWeight: 800, color: 'var(--color-brand)' }}>
                      {entry.total_points} pts
                    </span>
                  </td>
                  <td style={{ textAlign: 'right', fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                    {formatDate(entry.last_solve_at)}
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
