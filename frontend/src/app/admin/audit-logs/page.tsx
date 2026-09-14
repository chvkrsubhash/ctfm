'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { adminService } from '@/services/api.service';
import type { AuditLog } from '@/types';
import { formatDate } from '@/lib/api';

export default function AdminAuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    setLoading(true);
    adminService.getAuditLogs(page)
      .then((res) => {
        setLogs(res.items);
        setTotalPages(res.pages || 1);
      })
      .catch((err) => setError(err?.message || 'Failed to load audit logs'))
      .finally(() => setLoading(false));
  }, [page]);

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', padding: 'var(--space-8)' }}>
      <div className="page-header">
        <div>
          <div style={{ marginBottom: 'var(--space-2)' }}>
            <Link href="/dashboard" style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
              ← Dashboard
            </Link>
          </div>
          <h1 className="page-header__title">Audit Logs</h1>
          <p className="page-header__subtitle">Immutable security audit trail for all sensitive platform operations</p>
        </div>
      </div>

      {error && <div className="alert alert--error" style={{ marginBottom: 'var(--space-6)' }}>{error}</div>}

      {loading ? (
        <div className="loading-screen">
          <div className="spinner" />
          <p className="text-muted">Loading audit trail...</p>
        </div>
      ) : logs.length === 0 ? (
        <div className="empty-state card">
          <div className="empty-state__title">No audit records found</div>
          <p>Security events will automatically appear here as users interact with the platform.</p>
        </div>
      ) : (
        <div className="card" style={{ overflowX: 'auto', padding: 0 }}>
          <table className="leaderboard-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Action</th>
                <th>Actor ID</th>
                <th>Resource</th>
                <th>IP Address</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                    {formatDate(log.created_at)}
                  </td>
                  <td>
                    <span className="badge badge--blue font-mono">{log.action}</span>
                  </td>
                  <td style={{ fontSize: '0.8125rem', fontFamily: 'var(--font-mono)' }}>
                    {log.actor_id || <span style={{ color: 'var(--color-text-muted)' }}>System</span>}
                  </td>
                  <td style={{ fontSize: '0.875rem' }}>
                    {log.resource_type ? `${log.resource_type}: ${log.resource_id || '—'}` : '—'}
                  </td>
                  <td style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                    {log.ip_address || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--space-3)', padding: 'var(--space-4)' }}>
              <button
                className="btn btn--secondary btn--sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </button>
              <span style={{ fontSize: '0.875rem', alignSelf: 'center', color: 'var(--color-text-muted)' }}>
                Page {page} of {totalPages}
              </span>
              <button
                className="btn btn--secondary btn--sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
