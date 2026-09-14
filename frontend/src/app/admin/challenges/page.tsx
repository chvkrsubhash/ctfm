'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { challengeService, eventService, categoryService } from '@/services/api.service';
import type { Event, Category } from '@/types';
import { getErrorMessage } from '@/lib/api';

interface AdminChallenge {
  id: string;
  event_id: string;
  event_name?: string;
  category_id?: number | null;
  category?: { id: number; name: string; color?: string } | null;
  name: string;
  slug: string;
  description?: string;
  points: number;
  current_points: number;
  difficulty: string;
  status: string;
  solve_count: number;
  flags_count?: number;
  hints_count?: number;
  files_count?: number;
  created_at?: string;
}

export default function AdminChallengesPage() {
  const [challenges, setChallenges] = useState<AdminChallenge[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Modals state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingChallenge, setEditingChallenge] = useState<AdminChallenge | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Add Form State
  const [addForm, setAddForm] = useState({
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

  // Edit Form State
  const [editForm, setEditForm] = useState({
    name: '',
    description: '',
    points: 100,
    difficulty: 'medium',
    status: 'published',
    category_id: '',
    new_flag: '',
    is_case_sensitive: true,
  });

  // Sub-features in edit: hints & files
  const [newHint, setNewHint] = useState({ content: '', cost: 0 });
  const [uploadingFile, setUploadingFile] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [evts, chs] = await Promise.all([
        eventService.list(1, 100),
        challengeService.listAdmin(selectedEventId || undefined, search || undefined),
      ]);
      setEvents(evts.items);
      setChallenges(chs);
      if (evts.items.length > 0 && !addForm.event_id) {
        setAddForm((prev) => ({ ...prev, event_id: evts.items[0].id }));
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [selectedEventId, search]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Load categories when event changes for create modal
  useEffect(() => {
    const targetEventId = isAddOpen ? addForm.event_id : (editingChallenge?.event_id || selectedEventId);
    if (targetEventId) {
      categoryService.list(targetEventId)
        .then(setCategories)
        .catch(() => setCategories([]));
    }
  }, [isAddOpen, addForm.event_id, editingChallenge, selectedEventId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.event_id) {
      setError('Please select an event for this challenge.');
      return;
    }
    if (!addForm.name.trim()) {
      setError('Challenge name is required.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await challengeService.create(addForm.event_id, {
        name: addForm.name.trim(),
        description: addForm.description.trim(),
        points: Number(addForm.points) || 100,
        difficulty: addForm.difficulty,
        category_id: addForm.category_id ? Number(addForm.category_id) : null,
        status: addForm.status,
        flag: addForm.flag.trim() || undefined,
        is_case_sensitive: addForm.is_case_sensitive,
      });
      setSuccessMsg(`Challenge "${addForm.name}" created successfully!`);
      setIsAddOpen(false);
      setAddForm({
        event_id: events[0]?.id || '',
        category_id: '',
        name: '',
        description: '',
        points: 100,
        difficulty: 'medium',
        status: 'published',
        flag: '',
        is_case_sensitive: true,
      });
      loadData();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const openEdit = (ch: AdminChallenge) => {
    setEditingChallenge(ch);
    setEditForm({
      name: ch.name,
      description: ch.description || '',
      points: ch.points,
      difficulty: ch.difficulty,
      status: ch.status,
      category_id: ch.category_id ? String(ch.category_id) : '',
      new_flag: '',
      is_case_sensitive: true,
    });
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingChallenge) return;
    setSubmitting(true);
    setError('');
    try {
      await challengeService.update(editingChallenge.id, {
        name: editForm.name.trim(),
        description: editForm.description.trim(),
        points: Number(editForm.points),
        difficulty: editForm.difficulty,
        status: editForm.status,
        category_id: editForm.category_id ? Number(editForm.category_id) : null,
        flag: editForm.new_flag.trim() || undefined,
        is_case_sensitive: editForm.is_case_sensitive,
      });
      setSuccessMsg(`Challenge "${editForm.name}" updated successfully!`);
      setEditingChallenge(null);
      loadData();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete challenge "${name}"? This action cannot be undone.`)) {
      return;
    }
    try {
      await challengeService.delete(id);
      setSuccessMsg(`Challenge "${name}" was deleted.`);
      if (editingChallenge?.id === id) setEditingChallenge(null);
      loadData();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const handleAddHint = async () => {
    if (!editingChallenge || !newHint.content.trim()) return;
    try {
      await challengeService.addHint(editingChallenge.id, {
        content: newHint.content.trim(),
        cost: Number(newHint.cost) || 0,
      });
      setNewHint({ content: '', cost: 0 });
      setSuccessMsg('Hint added successfully!');
      loadData();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingChallenge) return;
    setUploadingFile(true);
    try {
      await challengeService.uploadFile(editingChallenge.id, file);
      setSuccessMsg(`File "${file.name}" uploaded!`);
      loadData();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setUploadingFile(false);
    }
  };

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', padding: 'var(--space-8)' }}>
      {/* Header */}
      <div className="page-header">
        <div>
          <div style={{ marginBottom: 'var(--space-2)' }}>
            <Link href="/admin" style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
              ← Admin Command Center
            </Link>
          </div>
          <h1 className="page-header__title">Manage Challenges</h1>
          <p className="page-header__subtitle">Add, edit, test flags, and manage files for your CTF challenges</p>
        </div>
        <button
          className="btn btn--primary"
          onClick={() => { setIsAddOpen(true); setError(''); }}
        >
          + Add Challenge
        </button>
      </div>

      {error && <div className="alert alert--error" style={{ marginBottom: 'var(--space-4)' }}>{error}</div>}
      {successMsg && (
        <div className="alert alert--success" style={{ marginBottom: 'var(--space-4)', display: 'flex', justifyContent: 'space-between' }}>
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg('')} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>&times;</button>
        </div>
      )}

      {/* Filter Bar */}
      <div className="card" style={{ marginBottom: 'var(--space-6)', padding: 'var(--space-4)' }}>
        <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ flex: '1', minWidth: '220px' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', display: 'block', marginBottom: '4px' }}>
              Filter by Event
            </label>
            <select
              className="form-control"
              value={selectedEventId}
              onChange={(e) => setSelectedEventId(e.target.value)}
            >
              <option value="">All Events</option>
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>{ev.name} ({ev.status})</option>
              ))}
            </select>
          </div>

          <div style={{ flex: '2', minWidth: '250px' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', display: 'block', marginBottom: '4px' }}>
              Search Name or Slug
            </label>
            <input
              type="text"
              className="form-control"
              placeholder="Search challenges..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Challenges Table */}
      {loading ? (
        <div className="loading-screen">
          <div className="spinner" />
          <p className="text-muted">Loading challenges...</p>
        </div>
      ) : challenges.length === 0 ? (
        <div className="empty-state card">
          <div className="empty-state__title">No challenges found</div>
          <p>Get started by creating your first challenge for an event.</p>
          <button className="btn btn--primary" style={{ marginTop: 'var(--space-4)' }} onClick={() => setIsAddOpen(true)}>
            + Create First Challenge
          </button>
        </div>
      ) : (
        <div className="card" style={{ overflowX: 'auto', padding: 0 }}>
          <table className="leaderboard-table">
            <thead>
              <tr>
                <th>Challenge</th>
                <th>Event</th>
                <th>Category</th>
                <th>Difficulty</th>
                <th>Points</th>
                <th>Status</th>
                <th>Solves</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {challenges.map((ch) => (
                <tr key={ch.id}>
                  <td>
                    <div style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{ch.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                      {ch.slug}
                    </div>
                  </td>
                  <td>
                    <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
                      {ch.event_name || '—'}
                    </span>
                  </td>
                  <td>
                    {ch.category ? (
                      <span className="badge badge--blue" style={{ fontSize: '0.75rem' }}>
                        {ch.category.name}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>None</span>
                    )}
                  </td>
                  <td>
                    <span className={`badge diff-${ch.difficulty}`} style={{ fontSize: '0.75rem' }}>
                      {ch.difficulty.toUpperCase()}
                    </span>
                  </td>
                  <td style={{ fontWeight: 700, color: 'var(--color-brand)' }}>
                    {ch.points} pts
                  </td>
                  <td>
                    <span className={`badge ${ch.status === 'published' ? 'status-live' : 'badge--gray'}`} style={{ fontSize: '0.75rem' }}>
                      {ch.status.toUpperCase()}
                    </span>
                  </td>
                  <td>
                    <span style={{ fontWeight: 600 }}>{ch.solve_count}</span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: 'var(--space-2)' }}>
                      <button
                        className="btn btn--secondary btn--sm"
                        onClick={() => openEdit(ch)}
                      >
                        Edit
                      </button>
                      <button
                        className="btn btn--danger btn--sm"
                        onClick={() => handleDelete(ch.id, ch.name)}
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

      {/* ── CREATE CHALLENGE MODAL ────────────────────────────────────── */}
      {isAddOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.45)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 'var(--space-4)',
        }}>
          <div className="card" style={{ maxWidth: '650px', width: '100%', maxHeight: '90vh', overflowY: 'auto', position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
              <h2>Add New Challenge</h2>
              <button onClick={() => setIsAddOpen(false)} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer' }}>&times;</button>
            </div>

            <form onSubmit={handleCreate}>
              <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
                <label className="form-label">Event *</label>
                <select
                  className="form-control"
                  value={addForm.event_id}
                  onChange={(e) => setAddForm({ ...addForm, event_id: e.target.value })}
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
                  <label className="form-label">Challenge Name *</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. SQLi 101"
                    value={addForm.name}
                    onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Category</label>
                  <select
                    className="form-control"
                    value={addForm.category_id}
                    onChange={(e) => setAddForm({ ...addForm, category_id: e.target.value })}
                  >
                    <option value="">No Category</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
                <label className="form-label">Description / Instructions</label>
                <textarea
                  className="form-control"
                  rows={4}
                  placeholder="Provide instructions, hints, ports, or narrative..."
                  value={addForm.description}
                  onChange={(e) => setAddForm({ ...addForm, description: e.target.value })}
                />
              </div>

              <div className="grid grid-3" style={{ gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
                <div className="form-group">
                  <label className="form-label">Points</label>
                  <input
                    type="number"
                    className="form-control"
                    value={addForm.points}
                    onChange={(e) => setAddForm({ ...addForm, points: Number(e.target.value) })}
                    min={0}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Difficulty</label>
                  <select
                    className="form-control"
                    value={addForm.difficulty}
                    onChange={(e) => setAddForm({ ...addForm, difficulty: e.target.value })}
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
                    value={addForm.status}
                    onChange={(e) => setAddForm({ ...addForm, status: e.target.value })}
                  >
                    <option value="published">Published (Visible)</option>
                    <option value="draft">Draft (Hidden)</option>
                  </select>
                </div>
              </div>

              <div className="card" style={{ background: 'var(--color-bg-secondary)', marginBottom: 'var(--space-6)', padding: 'var(--space-4)' }}>
                <div className="form-group" style={{ marginBottom: 'var(--space-2)' }}>
                  <label className="form-label">Initial Flag (Optional)</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. CTF{sample_flag_here}"
                    value={addForm.flag}
                    onChange={(e) => setAddForm({ ...addForm, flag: e.target.value })}
                  />
                </div>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '0.8125rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={addForm.is_case_sensitive}
                    onChange={(e) => setAddForm({ ...addForm, is_case_sensitive: e.target.checked })}
                  />
                  Case-sensitive flag check
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)' }}>
                <button type="button" className="btn btn--secondary" onClick={() => setIsAddOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn--primary" disabled={submitting}>
                  {submitting ? 'Creating...' : 'Create Challenge'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── EDIT CHALLENGE MODAL ──────────────────────────────────────── */}
      {editingChallenge && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.45)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 'var(--space-4)',
        }}>
          <div className="card" style={{ maxWidth: '700px', width: '100%', maxHeight: '92vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
              <div>
                <h2>Edit Challenge</h2>
                <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                  ID: {editingChallenge.id}
                </span>
              </div>
              <button onClick={() => setEditingChallenge(null)} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer' }}>&times;</button>
            </div>

            <form onSubmit={handleUpdate}>
              <div className="grid grid-2" style={{ gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
                <div className="form-group">
                  <label className="form-label">Name *</label>
                  <input
                    type="text"
                    className="form-control"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Category</label>
                  <select
                    className="form-control"
                    value={editForm.category_id}
                    onChange={(e) => setEditForm({ ...editForm, category_id: e.target.value })}
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
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                />
              </div>

              <div className="grid grid-3" style={{ gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
                <div className="form-group">
                  <label className="form-label">Points</label>
                  <input
                    type="number"
                    className="form-control"
                    value={editForm.points}
                    onChange={(e) => setEditForm({ ...editForm, points: Number(e.target.value) })}
                    min={0}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Difficulty</label>
                  <select
                    className="form-control"
                    value={editForm.difficulty}
                    onChange={(e) => setEditForm({ ...editForm, difficulty: e.target.value })}
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
                    value={editForm.status}
                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                  >
                    <option value="published">Published</option>
                    <option value="draft">Draft</option>
                    <option value="hidden">Hidden</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
              </div>

              {/* Add Flag section */}
              <div className="card" style={{ background: 'var(--color-bg-secondary)', marginBottom: 'var(--space-4)', padding: 'var(--space-4)' }}>
                <h3 style={{ fontSize: '0.9375rem', marginBottom: 'var(--space-2)' }}>Add New Flag</h3>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Enter new flag e.g. CTF{updated_flag_value}"
                  value={editForm.new_flag}
                  onChange={(e) => setEditForm({ ...editForm, new_flag: e.target.value })}
                />
              </div>

              {/* Add Hint section */}
              <div className="card" style={{ background: 'var(--color-bg-secondary)', marginBottom: 'var(--space-4)', padding: 'var(--space-4)' }}>
                <h3 style={{ fontSize: '0.9375rem', marginBottom: 'var(--space-2)' }}>Add Hint</h3>
                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Hint text..."
                    value={newHint.content}
                    onChange={(e) => setNewHint({ ...newHint, content: e.target.value })}
                    style={{ flex: 3 }}
                  />
                  <input
                    type="number"
                    className="form-control"
                    placeholder="Cost (pts)"
                    value={newHint.cost}
                    onChange={(e) => setNewHint({ ...newHint, cost: Number(e.target.value) })}
                    style={{ flex: 1 }}
                    min={0}
                  />
                  <button type="button" className="btn btn--secondary btn--sm" onClick={handleAddHint}>
                    Add Hint
                  </button>
                </div>
              </div>

              {/* Upload Attachment */}
              <div className="card" style={{ background: 'var(--color-bg-secondary)', marginBottom: 'var(--space-6)', padding: 'var(--space-4)' }}>
                <h3 style={{ fontSize: '0.9375rem', marginBottom: 'var(--space-2)' }}>Attach Challenge File</h3>
                <input
                  type="file"
                  onChange={handleFileUpload}
                  disabled={uploadingFile}
                />
                {uploadingFile && <span className="spinner spinner--sm" style={{ marginLeft: 'var(--space-2)' }} />}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button
                  type="button"
                  className="btn btn--danger btn--sm"
                  onClick={() => handleDelete(editingChallenge.id, editingChallenge.name)}
                >
                  Delete Challenge
                </button>
                <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                  <button type="button" className="btn btn--secondary" onClick={() => setEditingChallenge(null)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn--primary" disabled={submitting}>
                    {submitting ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
