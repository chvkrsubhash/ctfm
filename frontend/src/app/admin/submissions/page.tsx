'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { adminService } from '@/services/api.service';
import { formatDate } from '@/lib/api';

interface SubmissionItem {
  id: string;
  challenge_name?: string;
  team_name?: string;
  user_name?: string;
  is_correct: boolean;
  points_awarded: number;
  created_at: string;
  ip_address?: string;
}

export default function AdminSubmissionsPage() {
  const [submissions, setSubmissions] = useState<SubmissionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    adminService.getSubmissions()
      .then((res) => {
        const items = res?.items || (Array.isArray(res) ? res : []);
        setSubmissions(items);
      })
      .catch((err) => setError(err?.message || 'Failed to load submissions'))
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
          <h1 className="page-header__title">Review Submissions</h1>
          <p className="page-header__subtitle">Real-time log of participant flag submissions across all events</p>
        </div>
      </div>

      {error && <div className="alert alert--error" style={{ marginBottom: 'var(--space-6)' }}>{error}</div>}

      {loading ? (
        <div className="loading-screen">
          <div className="spinner" />
          <p className="text-muted">Loading submissions...</p>
        </div>
      ) : submissions.length === 0 ? (
        <div className="empty-state card">
          <div className="empty-state__title">No submissions yet</div>
          <p>Submissions will appear here in real-time as participants solve challenges.</p>
        </div>
      ) : (
        <div className="card" style={{ overflowX: 'auto', padding: 0 }}>
          <table className="leaderboard-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Challenge</th>
                <th>Participant / Team</th>
                <th>Result</th>
                <th>Points</th>
                <th>IP</th>
              </tr>
            </thead>
            <tbody>
              {submissions.map((s) => (
                <tr key={s.id}>
                  <td style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                    {formatDate(s.created_at)}
                  </td>
                  <td style={{ fontWeight: '600' }}>
                    {s.challenge_name || s.id.slice(0, 8)}
                  </td>
                  <td style={{ fontSize: '0.875rem' }}>
                    {s.team_name || s.user_name || 'Participant'}
                  </td>
                  <td>
                    <span className={`badge ${s.is_correct ? 'diff-easy' : 'diff-hard'}`}>
                      {s.is_correct ? 'CORRECT' : 'INCORRECT'}
                    </span>
                  </td>
                  <td style={{ fontWeight: '700', color: s.is_correct ? 'var(--color-success)' : 'var(--color-text-muted)' }}>
                    +{s.points_awarded || 0}
                  </td>
                  <td style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                    {s.ip_address || '—'}
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
