'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { adminService } from '@/services/api.service';
import { formatDate, getErrorMessage } from '@/lib/api';

interface AdminUser {
  id: string;
  username: string;
  email: string;
  display_name: string | null;
  is_active: boolean;
  is_verified: boolean;
  roles: string[];
  created_at: string | null;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await adminService.getUsers(page, search || undefined);
      setUsers(res.items);
      setTotalPages(res.pages || 1);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleToggleStatus = async (user: AdminUser) => {
    const nextStatus = !user.is_active;
    const actionName = nextStatus ? 'activate' : 'deactivate';
    if (!confirm(`Are you sure you want to ${actionName} user "${user.username}"?`)) return;

    try {
      await adminService.toggleUserStatus(user.id, nextStatus);
      setMsg(`User "${user.username}" status updated!`);
      setUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, is_active: nextStatus } : u));
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', padding: 'var(--space-8)' }}>
      <div className="page-header">
        <div>
          <div style={{ marginBottom: 'var(--space-2)' }}>
            <Link href="/admin" style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
              ← Admin Command Center
            </Link>
          </div>
          <h1 className="page-header__title">User Accounts</h1>
          <p className="page-header__subtitle">Review registered users, manage roles, and enforce moderation</p>
        </div>
      </div>

      {error && <div className="alert alert--error" style={{ marginBottom: 'var(--space-4)' }}>{error}</div>}
      {msg && (
        <div className="alert alert--success" style={{ marginBottom: 'var(--space-4)', display: 'flex', justifyContent: 'space-between' }}>
          <span>{msg}</span>
          <button onClick={() => setMsg('')} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>&times;</button>
        </div>
      )}

      {/* Search Bar */}
      <div className="card" style={{ marginBottom: 'var(--space-6)', padding: 'var(--space-4)' }}>
        <input
          type="text"
          className="form-control"
          placeholder="Search by username or email..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
      </div>

      {loading ? (
        <div className="loading-screen">
          <div className="spinner" />
          <p className="text-muted">Loading user accounts...</p>
        </div>
      ) : users.length === 0 ? (
        <div className="empty-state card">
          <div className="empty-state__title">No users found</div>
          <p>Try refining your search query.</p>
        </div>
      ) : (
        <div className="card" style={{ overflowX: 'auto', padding: 0 }}>
          <table className="leaderboard-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Email</th>
                <th>Roles</th>
                <th>Status</th>
                <th>Joined</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>
                      {u.display_name || u.username}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                      @{u.username}
                    </div>
                  </td>
                  <td>
                    <span style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>{u.email}</span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                      {u.roles.map((r) => (
                        <span key={r} className="badge badge--blue" style={{ fontSize: '0.6875rem' }}>
                          {r.replace('_', ' ')}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td>
                    <span className={`badge ${u.is_active ? 'badge--green' : 'badge--red'}`} style={{ fontSize: '0.75rem' }}>
                      {u.is_active ? 'ACTIVE' : 'SUSPENDED'}
                    </span>
                  </td>
                  <td style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                    {formatDate(u.created_at)}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      className={`btn ${u.is_active ? 'btn--danger' : 'btn--secondary'} btn--sm`}
                      onClick={() => handleToggleStatus(u)}
                    >
                      {u.is_active ? 'Suspend' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--space-2)', padding: 'var(--space-4)' }}>
              <button
                className="btn btn--secondary btn--sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </button>
              <span style={{ display: 'flex', alignItems: 'center', padding: '0 var(--space-3)', fontSize: '0.875rem' }}>
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
