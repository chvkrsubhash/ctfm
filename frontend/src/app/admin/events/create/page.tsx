'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { eventService } from '@/services/api.service';

export default function CreateEventPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: '',
    description: '',
    start_date: '',
    end_date: '',
    max_teams: 50,
    team_size: 4,
    scoring_type: 'dynamic',
    visibility: 'public',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const created = await eventService.create({
        name: form.name,
        description: form.description,
        start_date: new Date(form.start_date).toISOString(),
        end_date: new Date(form.end_date).toISOString(),
        max_teams: Number(form.max_teams),
        team_size: Number(form.team_size),
        scoring_type: form.scoring_type as any,
        visibility: form.visibility as any,
      });
      router.push(`/events/${created.slug || ''}`);
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || 'Failed to create event');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '720px', margin: '0 auto', padding: 'var(--space-8)' }}>
      <div className="page-header">
        <div>
          <div style={{ marginBottom: 'var(--space-2)' }}>
            <Link href="/admin/events" style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
              ← Manage Events
            </Link>
          </div>
          <h1 className="page-header__title">Create New CTF Event</h1>
          <p className="page-header__subtitle">Configure competition rules, dates, and team limits</p>
        </div>
      </div>

      {error && <div className="alert alert--error" style={{ marginBottom: 'var(--space-6)' }}>{error}</div>}

      <div className="card">
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
          <div className="form-group">
            <label className="form-label">Event Name *</label>
            <input
              type="text"
              required
              className="form-input"
              placeholder="e.g. CyberDefense Invitational 2026"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea
              className="form-input form-textarea"
              placeholder="Provide a brief summary and event overview for competitors..."
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>

          <div className="grid grid-2">
            <div className="form-group">
              <label className="form-label">Start Time *</label>
              <input
                type="datetime-local"
                required
                className="form-input"
                value={form.start_date}
                onChange={(e) => setForm({ ...form, start_date: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">End Time *</label>
              <input
                type="datetime-local"
                required
                className="form-input"
                value={form.end_date}
                onChange={(e) => setForm({ ...form, end_date: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-2">
            <div className="form-group">
              <label className="form-label">Max Teams</label>
              <input
                type="number"
                min="1"
                max="1000"
                className="form-input"
                value={form.max_teams}
                onChange={(e) => setForm({ ...form, max_teams: Number(e.target.value) })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Team Size (Members)</label>
              <input
                type="number"
                min="1"
                max="20"
                className="form-input"
                value={form.team_size}
                onChange={(e) => setForm({ ...form, team_size: Number(e.target.value) })}
              />
            </div>
          </div>

          <div className="grid grid-2">
            <div className="form-group">
              <label className="form-label">Scoring System</label>
              <select
                className="form-input form-select"
                value={form.scoring_type}
                onChange={(e) => setForm({ ...form, scoring_type: e.target.value })}
              >
                <option value="dynamic">Dynamic Scoring (points decay with solves)</option>
                <option value="static">Static Scoring (fixed points)</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Visibility</label>
              <select
                className="form-input form-select"
                value={form.visibility}
                onChange={(e) => setForm({ ...form, visibility: e.target.value })}
              >
                <option value="public">Public (Open registration)</option>
                <option value="unlisted">Unlisted (Invite link only)</option>
                <option value="private">Private (Admin invite only)</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end', marginTop: 'var(--space-4)' }}>
            <Link href="/admin/events" className="btn btn--secondary">
              Cancel
            </Link>
            <button type="submit" disabled={loading} className="btn btn--primary">
              {loading ? 'Creating Event...' : 'Create Competition'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
