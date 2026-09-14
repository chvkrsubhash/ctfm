'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { adminService } from '@/services/api.service';
import { getErrorMessage } from '@/lib/api';

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState({
    platform_name: 'CTF Platform',
    registration_open: true,
    email_verification_required: false,
    maintenance_mode: false,
    max_teams_per_user: 5,
    default_theme: 'light',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    adminService.getSettings()
      .then((res) => {
        if (res) setSettings((prev) => ({ ...prev, ...res }));
      })
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setMsg('');
    try {
      await adminService.updateSettings(settings);
      setMsg('Platform settings saved successfully!');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: 'var(--space-8)' }}>
      <div className="page-header">
        <div>
          <div style={{ marginBottom: 'var(--space-2)' }}>
            <Link href="/admin" style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
              ← Admin Command Center
            </Link>
          </div>
          <h1 className="page-header__title">Platform Settings</h1>
          <p className="page-header__subtitle">Configure system-wide policies, registration controls, and branding</p>
        </div>
      </div>

      {error && <div className="alert alert--error" style={{ marginBottom: 'var(--space-4)' }}>{error}</div>}
      {msg && <div className="alert alert--success" style={{ marginBottom: 'var(--space-4)' }}>{msg}</div>}

      {loading ? (
        <div className="loading-screen">
          <div className="spinner" />
          <p className="text-muted">Loading settings...</p>
        </div>
      ) : (
        <form onSubmit={handleSave} className="card">
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
              max={50}
              required
            />
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid var(--color-border)', margin: 'var(--space-6) 0' }} />

          <h3 style={{ fontSize: '1.0625rem', marginBottom: 'var(--space-4)' }}>Security & Access Policies</h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', marginBottom: 'var(--space-8)' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={settings.registration_open}
                onChange={(e) => setSettings({ ...settings, registration_open: e.target.checked })}
              />
              <div>
                <div style={{ fontWeight: 600 }}>Public Registration Open</div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                  Allow new participants to register self-service accounts
                </div>
              </div>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={settings.email_verification_required}
                onChange={(e) => setSettings({ ...settings, email_verification_required: e.target.checked })}
              />
              <div>
                <div style={{ fontWeight: 600 }}>Require Email Verification</div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                  Users must verify email via Resend before submitting flags or joining teams
                </div>
              </div>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={settings.maintenance_mode}
                onChange={(e) => setSettings({ ...settings, maintenance_mode: e.target.checked })}
              />
              <div>
                <div style={{ fontWeight: 600 }}>Maintenance Mode</div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                  Temporarily pause flag submissions and team creations for system maintenance
                </div>
              </div>
            </label>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)' }}>
            <button type="submit" className="btn btn--primary" disabled={saving}>
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
