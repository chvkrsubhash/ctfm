'use client';

import { useEffect, useState, useCallback } from 'react';
import type { Event, Category } from '@/types';
import { adminService, challengeService, eventService, categoryService } from '@/services/api.service';
import { formatDate, getErrorMessage } from '@/lib/api';

interface AdminStudioViewProps {
  initialSubTab?: 'challenges' | 'events' | 'submissions' | 'users' | 'audit' | 'settings';
}

export default function AdminStudioView({ initialSubTab = 'challenges' }: AdminStudioViewProps) {
  const [subTab, setSubTab] = useState<'challenges' | 'events' | 'submissions' | 'users' | 'audit' | 'settings'>(initialSubTab);
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // ── Challenges State ───────────────────────────────
  const [challenges, setChallenges] = useState<any[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [chSearch, setChSearch] = useState('');
  const [isAddChOpen, setIsAddChOpen] = useState(false);
  const [editingCh, setEditingCh] = useState<any | null>(null);
  const [chSubmitting, setChSubmitting] = useState(false);

  // Add Challenge Form
  const [addChForm, setAddChForm] = useState({
    event_id: '',
    category_id: '',
    name: '',
    description: '',
    points: 100,
    difficulty: 'medium',
    status: 'published',
    flag: '',
    is_case_sensitive: true,
  });

  // Edit Challenge Form
  const [editChForm, setEditChForm] = useState({
    name: '',
    description: '',
    points: 100,
    difficulty: 'medium',
    status: 'published',
    category_id: '',
    new_flag: '',
    is_case_sensitive: true,
  });

  // ── Events State ───────────────────────────────────
  const [isCreateEventOpen, setIsCreateEventOpen] = useState(false);
  const [createEventForm, setCreateEventForm] = useState({
    name: '',
    description: '',
    start_date: '',
    end_date: '',
    scoring_type: 'static',
    team_size: 4,
    status: 'upcoming',
  });

  // ── Submissions State ──────────────────────────────
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [subFilter, setSubFilter] = useState('');

  // ── Users State ────────────────────────────────────
  const [users, setUsers] = useState<any[]>([]);
  const [userSearch, setUserSearch] = useState('');

  // ── Audit Logs State ───────────────────────────────
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditFilter, setAuditFilter] = useState('');

  // ── Settings State ─────────────────────────────────
  const [settings, setSettings] = useState({
    platform_name: 'CTF Platform',
    registration_open: true,
    email_verification_required: false,
    maintenance_mode: false,
    max_teams_per_user: 5,
  });
  const [savingSettings, setSavingSettings] = useState(false);

  // Load common events
  const loadEvents = useCallback(async () => {
    try {
      const res = await eventService.list(1, 100);
      setEvents(res.items);
      if (res.items.length > 0 && !addChForm.event_id) {
        setAddChForm((prev) => ({ ...prev, event_id: res.items[0].id }));
      }
    } catch { /* ignore */ }
  }, [addChForm.event_id]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  // Load sub-tab data
  useEffect(() => {
    setError('');
    setLoading(true);

    if (subTab === 'challenges') {
      Promise.all([
        challengeService.listAdmin(selectedEventId || undefined, chSearch || undefined),
        selectedEventId ? categoryService.list(selectedEventId).catch(() => []) : Promise.resolve([]),
      ]).then(([chs, cats]) => {
        setChallenges(chs);
        setCategories(cats);
      }).catch((e) => setError(getErrorMessage(e)))
        .finally(() => setLoading(false));
    } else if (subTab === 'events') {
      eventService.list(1, 100)
        .then((res) => setEvents(res.items))
        .catch((e) => setError(getErrorMessage(e)))
        .finally(() => setLoading(false));
    } else if (subTab === 'submissions') {
      adminService.getSubmissions(1, subFilter || undefined, selectedEventId || undefined)
        .then((res) => setSubmissions(res.items))
        .catch((e) => setError(getErrorMessage(e)))
        .finally(() => setLoading(false));
    } else if (subTab === 'users') {
      adminService.getUsers(1, userSearch || undefined)
        .then((res) => setUsers(res.items))
        .catch((e) => setError(getErrorMessage(e)))
        .finally(() => setLoading(false));
    } else if (subTab === 'audit') {
      adminService.getAuditLogs(1, auditFilter || undefined)
        .then((res) => setAuditLogs(res.items))
        .catch((e) => setError(getErrorMessage(e)))
        .finally(() => setLoading(false));
    } else if (subTab === 'settings') {
      adminService.getSettings()
        .then((res) => { if (res) setSettings((prev) => ({ ...prev, ...res })); })
        .catch((e) => setError(getErrorMessage(e)))
        .finally(() => setLoading(false));
    }
  }, [subTab, selectedEventId, chSearch, subFilter, userSearch, auditFilter]);

  // ── Challenge Actions ──────────────────────────────
  const handleCreateChallenge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addChForm.event_id || !addChForm.name.trim()) return;
    setChSubmitting(true);
    try {
      await challengeService.create(addChForm.event_id, {
        name: addChForm.name.trim(),
        description: addChForm.description.trim(),
        points: Number(addChForm.points) || 100,
        difficulty: addChForm.difficulty,
        category_id: addChForm.category_id ? Number(addChForm.category_id) : null,
        status: addChForm.status,
        flag: addChForm.flag.trim() || undefined,
        is_case_sensitive: addChForm.is_case_sensitive,
      });
      setSuccessMsg(`Challenge "${addChForm.name}" created!`);
      setIsAddChOpen(false);
      setAddChForm((prev) => ({ ...prev, name: '', description: '', flag: '' }));
      // reload
      const chs = await challengeService.listAdmin(selectedEventId || undefined);
      setChallenges(chs);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setChSubmitting(false);
    }
  };

  const handleUpdateChallenge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCh) return;
    setChSubmitting(true);
    try {
      await challengeService.update(editingCh.id, {
        name: editChForm.name.trim(),
        description: editChForm.description.trim(),
        points: Number(editChForm.points),
        difficulty: editChForm.difficulty,
        status: editChForm.status,
        category_id: editChForm.category_id ? Number(editChForm.category_id) : null,
        flag: editChForm.new_flag.trim() || undefined,
        is_case_sensitive: editChForm.is_case_sensitive,
      });
      setSuccessMsg(`Challenge updated!`);
      setEditingCh(null);
      const chs = await challengeService.listAdmin(selectedEventId || undefined);
      setChallenges(chs);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setChSubmitting(false);
    }
  };

  const handleDeleteChallenge = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete challenge "${name}"?`)) return;
    try {
      await challengeService.delete(id);
      setSuccessMsg(`Challenge "${name}" removed.`);
      setChallenges((prev) => prev.filter((c) => c.id !== id));
      if (editingCh?.id === id) setEditingCh(null);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  // ── Event Actions ──────────────────────────────────
  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await eventService.create({
        name: createEventForm.name.trim(),
        description: createEventForm.description.trim() || undefined,
        scoring_type: createEventForm.scoring_type as any,
        team_size: Number(createEventForm.team_size),
        status: createEventForm.status as any,
      });
      setSuccessMsg(`Event "${createEventForm.name}" created!`);
      setIsCreateEventOpen(false);
      loadEvents();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  // ── User Actions ───────────────────────────────────
  const handleToggleUser = async (u: any) => {
    const nextState = !u.is_active;
    if (!confirm(`Are you sure you want to ${nextState ? 'activate' : 'suspend'} user @${u.username}?`)) return;
    try {
      await adminService.toggleUserStatus(u.id, nextState);
      setUsers((prev) => prev.map((item) => item.id === u.id ? { ...item, is_active: nextState } : item));
      setSuccessMsg(`User @${u.username} status updated.`);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  // ── Settings Actions ───────────────────────────────
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      await adminService.updateSettings(settings);
      setSuccessMsg('Platform settings updated successfully!');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSavingSettings(false);
    }
  };

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', padding: 'var(--space-8)' }}>
      {/* Header */}
      <div className="page-header" style={{ marginBottom: 'var(--space-4)' }}>
        <div>
          <h1 className="page-header__title">Admin Studio</h1>
          <p className="page-header__subtitle">Manage challenges, competitions, submissions, user accounts, and policies</p>
        </div>
      </div>

      {error && <div className="alert alert--error" style={{ marginBottom: 'var(--space-4)' }}>{error}</div>}
      {successMsg && (
        <div className="alert alert--success" style={{ marginBottom: 'var(--space-4)', display: 'flex', justifyContent: 'space-between' }}>
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg('')} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>&times;</button>
        </div>
      )}

      {/* Admin Tab Strip */}
      <div className="tab-strip">
        <button
          className={`tab-strip-btn ${subTab === 'challenges' ? 'tab-strip-btn--active' : ''}`}
          onClick={() => setSubTab('challenges')}
        >
          Challenges
        </button>
        <button
          className={`tab-strip-btn ${subTab === 'events' ? 'tab-strip-btn--active' : ''}`}
          onClick={() => setSubTab('events')}
        >
          Events
        </button>
        <button
          className={`tab-strip-btn ${subTab === 'submissions' ? 'tab-strip-btn--active' : ''}`}
          onClick={() => setSubTab('submissions')}
        >
          Live Submissions
        </button>
        <button
          className={`tab-strip-btn ${subTab === 'users' ? 'tab-strip-btn--active' : ''}`}
          onClick={() => setSubTab('users')}
        >
          User Accounts
        </button>
        <button
          className={`tab-strip-btn ${subTab === 'audit' ? 'tab-strip-btn--active' : ''}`}
          onClick={() => setSubTab('audit')}
        >
          Audit Logs
        </button>
        <button
          className={`tab-strip-btn ${subTab === 'settings' ? 'tab-strip-btn--active' : ''}`}
          onClick={() => setSubTab('settings')}
        >
          Settings
        </button>
      </div>

      {/* ── 1. CHALLENGES SUB-TAB ────────────────────────────────────── */}
      {subTab === 'challenges' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-4)', marginBottom: 'var(--space-6)', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 'var(--space-3)', flex: 1, minWidth: '300px' }}>
              <select
                className="form-control"
                value={selectedEventId}
                onChange={(e) => setSelectedEventId(e.target.value)}
                style={{ maxWidth: '220px' }}
              >
                <option value="">All Events</option>
                {events.map((ev) => (
                  <option key={ev.id} value={ev.id}>{ev.name}</option>
                ))}
              </select>

              <input
                type="text"
                className="form-control"
                placeholder="Search challenges..."
                value={chSearch}
                onChange={(e) => setChSearch(e.target.value)}
              />
            </div>

            <button className="btn btn--primary" onClick={() => setIsAddChOpen(true)}>
              + Add Challenge
            </button>
          </div>

          {loading ? (
            <div className="loading-screen"><div className="spinner" /></div>
          ) : challenges.length === 0 ? (
            <div className="empty-state card">
              <div className="empty-state__title">No challenges found</div>
              <button className="btn btn--primary" style={{ marginTop: 'var(--space-4)' }} onClick={() => setIsAddChOpen(true)}>
                + Create First Challenge
              </button>
            </div>
          ) : (
            <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
              <table className="leaderboard-table">
                <thead>
                  <tr>
                    <th>Challenge</th>
                    <th>Event</th>
                    <th>Category</th>
                    <th>Points</th>
                    <th>Difficulty</th>
                    <th>Status</th>
                    <th>Solves</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {challenges.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{c.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>{c.slug}</div>
                      </td>
                      <td><span style={{ fontSize: '0.8125rem' }}>{c.event_name || '—'}</span></td>
                      <td>{c.category ? <span className="badge badge--blue">{c.category.name}</span> : '—'}</td>
                      <td><strong style={{ color: 'var(--color-brand)' }}>{c.points} pts</strong></td>
                      <td><span className={`badge diff-${c.difficulty}`}>{c.difficulty.toUpperCase()}</span></td>
                      <td><span className={`badge ${c.status === 'published' ? 'status-live' : 'badge--gray'}`}>{c.status.toUpperCase()}</span></td>
                      <td>{c.solve_count}</td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: 'var(--space-2)' }}>
                          <button
                            className="btn btn--secondary btn--sm"
                            onClick={() => {
                              setEditingCh(c);
                              setEditChForm({
                                name: c.name,
                                description: c.description || '',
                                points: c.points,
                                difficulty: c.difficulty,
                                status: c.status,
                                category_id: c.category_id ? String(c.category_id) : '',
                                new_flag: '',
                                is_case_sensitive: true,
                              });
                            }}
                          >
                            Edit
                          </button>
                          <button
                            className="btn btn--danger btn--sm"
                            onClick={() => handleDeleteChallenge(c.id, c.name)}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── 2. EVENTS SUB-TAB ────────────────────────────────────────── */}
      {subTab === 'events' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 'var(--space-6)' }}>
            <button className="btn btn--primary" onClick={() => setIsCreateEventOpen(true)}>
              + Create Event
            </button>
          </div>

          <div className="grid grid-2">
            {events.map((ev) => (
              <div key={ev.id} className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
                  <span className={`badge ${ev.status === 'live' ? 'status-live' : 'badge--gray'}`}>{ev.status.toUpperCase()}</span>
                  <span className="badge badge--purple">{ev.scoring_type} scoring</span>
                </div>
                <h3 style={{ fontSize: '1.25rem', marginBottom: 'var(--space-2)' }}>{ev.name}</h3>
                <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-4)' }}>
                  {ev.description || 'No description'}
                </p>
                <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                  Team size: {ev.team_size} members
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 3. SUBMISSIONS SUB-TAB ────────────────────────────────────── */}
      {subTab === 'submissions' && (
        <div>
          <div style={{ display: 'flex', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
            <select
              className="form-control"
              value={subFilter}
              onChange={(e) => setSubFilter(e.target.value)}
              style={{ maxWidth: '200px' }}
            >
              <option value="">All Results</option>
              <option value="correct">Correct</option>
              <option value="incorrect">Incorrect</option>
              <option value="already_solved">Already Solved</option>
            </select>
          </div>

          <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
            <table className="leaderboard-table">
              <thead>
                <tr>
                  <th>Result</th>
                  <th>Challenge</th>
                  <th>User</th>
                  <th>Submitted Preview</th>
                  <th>IP Address</th>
                  <th style={{ textAlign: 'right' }}>Time</th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <span className={`badge ${s.result === 'correct' ? 'badge--green' : 'badge--red'}`}>
                        {s.result.toUpperCase()}
                      </span>
                    </td>
                    <td><strong>{s.challenge || '—'}</strong></td>
                    <td>@{s.user || '—'}</td>
                    <td><code>{s.submitted_flag_preview || '—'}</code></td>
                    <td style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{s.ip_address || '—'}</td>
                    <td style={{ textAlign: 'right', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{formatDate(s.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── 4. USERS SUB-TAB ─────────────────────────────────────────── */}
      {subTab === 'users' && (
        <div>
          <div style={{ marginBottom: 'var(--space-6)', maxWidth: '400px' }}>
            <input
              type="text"
              className="form-control"
              placeholder="Search user accounts..."
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
            />
          </div>

          <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
            <table className="leaderboard-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Email</th>
                  <th>Roles</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td><strong>{u.username}</strong></td>
                    <td>{u.email}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        {u.roles.map((r: string) => (
                          <span key={r} className="badge badge--blue" style={{ fontSize: '0.6875rem' }}>{r}</span>
                        ))}
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${u.is_active ? 'badge--green' : 'badge--red'}`}>
                        {u.is_active ? 'ACTIVE' : 'SUSPENDED'}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{formatDate(u.created_at)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        className={`btn ${u.is_active ? 'btn--danger' : 'btn--secondary'} btn--sm`}
                        onClick={() => handleToggleUser(u)}
                      >
                        {u.is_active ? 'Suspend' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── 5. AUDIT LOGS SUB-TAB ────────────────────────────────────── */}
      {subTab === 'audit' && (
        <div>
          <div style={{ marginBottom: 'var(--space-6)', maxWidth: '300px' }}>
            <input
              type="text"
              className="form-control"
              placeholder="Filter by action (e.g. challenge)..."
              value={auditFilter}
              onChange={(e) => setAuditFilter(e.target.value)}
            />
          </div>

          <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
            <table className="leaderboard-table">
              <thead>
                <tr>
                  <th>Action</th>
                  <th>Resource</th>
                  <th>Resource ID</th>
                  <th>IP Address</th>
                  <th style={{ textAlign: 'right' }}>Time</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map((l) => (
                  <tr key={l.id}>
                    <td><span className="badge badge--blue">{l.action}</span></td>
                    <td>{l.resource_type || '—'}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>{l.resource_id || '—'}</td>
                    <td style={{ fontSize: '0.75rem' }}>{l.ip_address || '—'}</td>
                    <td style={{ textAlign: 'right', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{formatDate(l.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── 6. SETTINGS SUB-TAB ──────────────────────────────────────── */}
      {subTab === 'settings' && (
        <form onSubmit={handleSaveSettings} className="card" style={{ maxWidth: '700px' }}>
          <div className="form-group" style={{ marginBottom: 'var(--space-6)' }}>
            <label className="form-label">Platform Name</label>
            <input
              type="text"
              className="form-control"
              value={settings.platform_name}
              onChange={(e) => setSettings({ ...settings, platform_name: e.target.value })}
              required
            />
          </div>

          <div className="form-group" style={{ marginBottom: 'var(--space-6)' }}>
            <label className="form-label">Max Teams per User</label>
            <input
              type="number"
              className="form-control"
              value={settings.max_teams_per_user}
              onChange={(e) => setSettings({ ...settings, max_teams_per_user: Number(e.target.value) })}
              min={1}
              required
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', marginBottom: 'var(--space-8)' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={settings.registration_open}
                onChange={(e) => setSettings({ ...settings, registration_open: e.target.checked })}
              />
              <div>
                <strong>Public Registration Open</strong>
                <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>Allow self-registration</div>
              </div>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={settings.email_verification_required}
                onChange={(e) => setSettings({ ...settings, email_verification_required: e.target.checked })}
              />
              <div>
                <strong>Require Email Verification</strong>
                <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>Must verify via Resend before flag submission</div>
              </div>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={settings.maintenance_mode}
                onChange={(e) => setSettings({ ...settings, maintenance_mode: e.target.checked })}
              />
              <div>
                <strong>Maintenance Mode</strong>
                <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>Pause flag submissions system-wide</div>
              </div>
            </label>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="submit" className="btn btn--primary" disabled={savingSettings}>
              {savingSettings ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </form>
      )}

      {/* ── CREATE CHALLENGE MODAL ────────────────────────────────────── */}
      {isAddChOpen && (
        <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) setIsAddChOpen(false); }}>
          <div className="modal-box">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
              <h2>Add Challenge</h2>
              <button onClick={() => setIsAddChOpen(false)} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer' }}>&times;</button>
            </div>

            <form onSubmit={handleCreateChallenge}>
              <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
                <label className="form-label">Event *</label>
                <select
                  className="form-control"
                  value={addChForm.event_id}
                  onChange={(e) => setAddChForm({ ...addChForm, event_id: e.target.value })}
                  required
                >
                  <option value="">Select Event</option>
                  {events.map((ev) => (
                    <option key={ev.id} value={ev.id}>{ev.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-2" style={{ gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
                <div className="form-group">
                  <label className="form-label">Name *</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. SQL Injection 101"
                    value={addChForm.name}
                    onChange={(e) => setAddChForm({ ...addChForm, name: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Category</label>
                  <select
                    className="form-control"
                    value={addChForm.category_id}
                    onChange={(e) => setAddChForm({ ...addChForm, category_id: e.target.value })}
                  >
                    <option value="">No Category</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
                <label className="form-label">Description</label>
                <textarea
                  className="form-control"
                  rows={3}
                  value={addChForm.description}
                  onChange={(e) => setAddChForm({ ...addChForm, description: e.target.value })}
                />
              </div>

              <div className="grid grid-3" style={{ gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
                <div className="form-group">
                  <label className="form-label">Points</label>
                  <input
                    type="number"
                    className="form-control"
                    value={addChForm.points}
                    onChange={(e) => setAddChForm({ ...addChForm, points: Number(e.target.value) })}
                    min={0}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Difficulty</label>
                  <select
                    className="form-control"
                    value={addChForm.difficulty}
                    onChange={(e) => setAddChForm({ ...addChForm, difficulty: e.target.value })}
                  >
                    <option value="beginner">Beginner</option>
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                    <option value="insane">Insane</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select
                    className="form-control"
                    value={addChForm.status}
                    onChange={(e) => setAddChForm({ ...addChForm, status: e.target.value })}
                  >
                    <option value="published">Published</option>
                    <option value="draft">Draft</option>
                  </select>
                </div>
              </div>

              <div className="card" style={{ background: 'var(--color-bg-secondary)', marginBottom: 'var(--space-6)', padding: 'var(--space-4)' }}>
                <label className="form-label">Initial Flag</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="CTF{sample_flag}"
                  value={addChForm.flag}
                  onChange={(e) => setAddChForm({ ...addChForm, flag: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)' }}>
                <button type="button" className="btn btn--secondary" onClick={() => setIsAddChOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn--primary" disabled={chSubmitting}>
                  {chSubmitting ? 'Creating...' : 'Create Challenge'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── EDIT CHALLENGE MODAL ──────────────────────────────────────── */}
      {editingCh && (
        <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) setEditingCh(null); }}>
          <div className="modal-box">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
              <h2>Edit Challenge</h2>
              <button onClick={() => setEditingCh(null)} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer' }}>&times;</button>
            </div>

            <form onSubmit={handleUpdateChallenge}>
              <div className="grid grid-2" style={{ gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
                <div className="form-group">
                  <label className="form-label">Name *</label>
                  <input
                    type="text"
                    className="form-control"
                    value={editChForm.name}
                    onChange={(e) => setEditChForm({ ...editChForm, name: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Category</label>
                  <select
                    className="form-control"
                    value={editChForm.category_id}
                    onChange={(e) => setEditChForm({ ...editChForm, category_id: e.target.value })}
                  >
                    <option value="">No Category</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
                <label className="form-label">Description</label>
                <textarea
                  className="form-control"
                  rows={3}
                  value={editChForm.description}
                  onChange={(e) => setEditChForm({ ...editChForm, description: e.target.value })}
                />
              </div>

              <div className="grid grid-3" style={{ gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
                <div className="form-group">
                  <label className="form-label">Points</label>
                  <input
                    type="number"
                    className="form-control"
                    value={editChForm.points}
                    onChange={(e) => setEditChForm({ ...editChForm, points: Number(e.target.value) })}
                    min={0}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Difficulty</label>
                  <select
                    className="form-control"
                    value={editChForm.difficulty}
                    onChange={(e) => setEditChForm({ ...editChForm, difficulty: e.target.value })}
                  >
                    <option value="beginner">Beginner</option>
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                    <option value="insane">Insane</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select
                    className="form-control"
                    value={editChForm.status}
                    onChange={(e) => setEditChForm({ ...editChForm, status: e.target.value })}
                  >
                    <option value="published">Published</option>
                    <option value="draft">Draft</option>
                    <option value="hidden">Hidden</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
              </div>

              <div className="card" style={{ background: 'var(--color-bg-secondary)', marginBottom: 'var(--space-6)', padding: 'var(--space-4)' }}>
                <label className="form-label">Add New Flag</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="CTF{new_flag_value}"
                  value={editChForm.new_flag}
                  onChange={(e) => setEditChForm({ ...editChForm, new_flag: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button
                  type="button"
                  className="btn btn--danger btn--sm"
                  onClick={() => handleDeleteChallenge(editingCh.id, editingCh.name)}
                >
                  Delete Challenge
                </button>
                <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                  <button type="button" className="btn btn--secondary" onClick={() => setEditingCh(null)}>Cancel</button>
                  <button type="submit" className="btn btn--primary" disabled={chSubmitting}>
                    {chSubmitting ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── CREATE EVENT MODAL ────────────────────────────────────────── */}
      {isCreateEventOpen && (
        <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) setIsCreateEventOpen(false); }}>
          <div className="modal-box" style={{ maxWidth: '550px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
              <h2>Create Event</h2>
              <button onClick={() => setIsCreateEventOpen(false)} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer' }}>&times;</button>
            </div>

            <form onSubmit={handleCreateEvent}>
              <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
                <label className="form-label">Event Name *</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. CyberSec Finals 2026"
                  value={createEventForm.name}
                  onChange={(e) => setCreateEventForm({ ...createEventForm, name: e.target.value })}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
                <label className="form-label">Description</label>
                <textarea
                  className="form-control"
                  rows={3}
                  value={createEventForm.description}
                  onChange={(e) => setCreateEventForm({ ...createEventForm, description: e.target.value })}
                />
              </div>

              <div className="grid grid-2" style={{ gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
                <div className="form-group">
                  <label className="form-label">Scoring Type</label>
                  <select
                    className="form-control"
                    value={createEventForm.scoring_type}
                    onChange={(e) => setCreateEventForm({ ...createEventForm, scoring_type: e.target.value })}
                  >
                    <option value="static">Static Points</option>
                    <option value="dynamic">Dynamic Decay</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Team Size</label>
                  <input
                    type="number"
                    className="form-control"
                    value={createEventForm.team_size}
                    onChange={(e) => setCreateEventForm({ ...createEventForm, team_size: Number(e.target.value) })}
                    min={1}
                    max={20}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)' }}>
                <button type="button" className="btn btn--secondary" onClick={() => setIsCreateEventOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn--primary">Create Event</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
