'use client';

import { useEffect, useState } from 'react';
import { useUser } from '@/store/authStore';
import { api } from '@/lib/api';
import { notificationService, authService } from '@/services/api.service';
import type { User, Notification } from '@/types';
import { getErrorMessage } from '@/lib/api';

type Section = 'profile' | 'security' | 'notifications' | '2fa';

export default function ProfilePage() {
  const user = useUser();
  const [section, setSection] = useState<Section>('profile');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Profile form
  const [profileForm, setProfileForm] = useState({ display_name: '', bio: '', website: '', country: '' });
  const [profileMsg, setProfileMsg] = useState('');
  const [profileLoading, setProfileLoading] = useState(false);

  // Password form
  const [pwForm, setPwForm] = useState({ current: '', new: '', confirm: '' });
  const [pwMsg, setPwMsg] = useState('');
  const [pwLoading, setPwLoading] = useState(false);

  // 2FA
  const [qrCode, setQrCode] = useState('');
  const [totpSecret, setTotpSecret] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [twofaMsg, setTwofaMsg] = useState('');

  useEffect(() => {
    if (user) {
      setProfileForm({
        display_name: user.display_name || '',
        bio: user.bio || '',
        website: user.website || '',
        country: user.country || '',
      });
    }
  }, [user]);

  useEffect(() => {
    if (section === 'notifications') {
      notificationService.list().then((res) => {
        setNotifications(res.notifications);
        setUnreadCount(res.unread_count);
      }).catch(() => {});
    }
  }, [section]);

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileLoading(true);
    setProfileMsg('');
    try {
      await api.patch('/users/me', profileForm);
      setProfileMsg('Profile updated successfully!');
    } catch (err) {
      setProfileMsg(getErrorMessage(err));
    } finally {
      setProfileLoading(false);
    }
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwForm.new !== pwForm.confirm) { setPwMsg('Passwords do not match'); return; }
    setPwLoading(true); setPwMsg('');
    try {
      await authService.changePassword(pwForm.current, pwForm.new);
      setPwMsg('Password changed successfully!');
      setPwForm({ current: '', new: '', confirm: '' });
    } catch (err) {
      setPwMsg(getErrorMessage(err));
    } finally {
      setPwLoading(false);
    }
  };

  const setup2FA = async () => {
    try {
      const res = await authService.setup2FA();
      setQrCode(res.qr_code);
      setTotpSecret(res.secret);
    } catch (err) {
      setTwofaMsg(getErrorMessage(err));
    }
  };

  const confirm2FA = async () => {
    try {
      const res = await authService.confirm2FA(totpCode);
      setBackupCodes(res.backup_codes);
      setQrCode('');
      setTwofaMsg('2FA enabled! Save your backup codes below.');
    } catch (err) {
      setTwofaMsg(getErrorMessage(err));
    }
  };

  if (!user) return <div className="loading-screen"><div className="spinner" /></div>;

  const navItems: { key: Section; label: string }[] = [
    { key: 'profile', label: 'Profile' },
    { key: 'security', label: 'Security' },
    { key: '2fa', label: 'Two-Factor Auth' },
    { key: 'notifications', label: 'Notifications' },
  ];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg-primary)', padding: 'var(--space-8)' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        <div className="page-header">
          <div>
            <h1 className="page-header__title">Account Settings</h1>
            <p className="page-header__subtitle">Manage your profile and security</p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 'var(--space-8)' }}>
          {/* Sidebar nav */}
          <div className="card" style={{ height: 'fit-content', padding: 'var(--space-4)' }}>
            {/* Avatar */}
            <div style={{ textAlign: 'center', padding: 'var(--space-4) 0 var(--space-5)', borderBottom: '1px solid var(--color-border)', marginBottom: 'var(--space-4)' }}>
              <div style={{
                width: '72px', height: '72px', borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--color-brand-start), var(--color-brand-end))',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1.25rem', fontWeight: 700, color: '#fff', margin: '0 auto var(--space-3)',
              }}>
                {user.avatar_url ? <img src={user.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} /> : (user.display_name || user.username).slice(0, 2).toUpperCase()}
              </div>
              <div style={{ fontWeight: '700' }}>{user.display_name || user.username}</div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>@{user.username}</div>
              {user.roles.map((r) => <span key={r.id} className="badge badge--blue" style={{ margin: '4px 2px' }}>{r.name}</span>)}
            </div>
            {navItems.map((item) => (
              <button
                key={item.key}
                className={`btn btn--full ${section === item.key ? 'btn--primary' : 'btn--ghost'}`}
                style={{ justifyContent: 'flex-start', marginBottom: 'var(--space-1)' }}
                onClick={() => setSection(item.key)}
              >
                {item.label}
                {item.key === 'notifications' && unreadCount > 0 && (
                  <span className="badge badge--blue" style={{ marginLeft: 'auto' }}>{unreadCount}</span>
                )}
              </button>
            ))}
          </div>

          {/* Content */}
          <div>
            {section === 'profile' && (
              <div className="card">
                <h3 style={{ marginBottom: 'var(--space-6)' }}>Profile Information</h3>
                <form onSubmit={saveProfile} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                  <div className="form-group">
                    <label className="form-label">Email</label>
                    <input className="form-input" value={user.email} disabled style={{ opacity: 0.6 }} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Username</label>
                    <input className="form-input" value={user.username} disabled style={{ opacity: 0.6 }} />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="display_name">Display Name</label>
                    <input id="display_name" className="form-input" maxLength={100}
                      value={profileForm.display_name} onChange={(e) => setProfileForm({ ...profileForm, display_name: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="bio">Bio</label>
                    <textarea id="bio" className="form-input form-textarea" maxLength={500}
                      value={profileForm.bio} onChange={(e) => setProfileForm({ ...profileForm, bio: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="website">Website</label>
                    <input id="website" className="form-input" type="url" maxLength={255}
                      value={profileForm.website} onChange={(e) => setProfileForm({ ...profileForm, website: e.target.value })} />
                  </div>
                  {profileMsg && <div className={`alert ${profileMsg.includes('success') ? 'alert--success' : 'alert--error'}`}>{profileMsg}</div>}
                  <button type="submit" className="btn btn--primary" disabled={profileLoading}>
                    {profileLoading ? <><span className="spinner spinner--sm" /> Saving...</> : 'Save Changes'}
                  </button>
                </form>
              </div>
            )}

            {section === 'security' && (
              <div className="card">
                <h3 style={{ marginBottom: 'var(--space-6)' }}>Change Password</h3>
                <form onSubmit={changePassword} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                  <div className="form-group">
                    <label className="form-label" htmlFor="current-pw">Current Password</label>
                    <input id="current-pw" className="form-input" type="password" required
                      value={pwForm.current} onChange={(e) => setPwForm({ ...pwForm, current: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="new-pw">New Password</label>
                    <input id="new-pw" className="form-input" type="password" minLength={8} required
                      value={pwForm.new} onChange={(e) => setPwForm({ ...pwForm, new: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="confirm-pw">Confirm New Password</label>
                    <input id="confirm-pw" className="form-input" type="password" required
                      value={pwForm.confirm} onChange={(e) => setPwForm({ ...pwForm, confirm: e.target.value })} />
                  </div>
                  {pwMsg && <div className={`alert ${pwMsg.includes('success') ? 'alert--success' : 'alert--error'}`}>{pwMsg}</div>}
                  <button type="submit" className="btn btn--primary" disabled={pwLoading}>
                    {pwLoading ? <><span className="spinner spinner--sm" /> Updating...</> : 'Change Password'}
                  </button>
                </form>
              </div>
            )}

            {section === '2fa' && (
              <div className="card">
                <h3 style={{ marginBottom: 'var(--space-4)' }}>Two-Factor Authentication</h3>
                <p style={{ marginBottom: 'var(--space-6)' }}>
                  {user.totp_enabled ? '2FA is enabled on your account.' : 'Add an extra layer of security with TOTP 2FA.'}
                </p>
                {twofaMsg && <div className={`alert ${twofaMsg.includes('enabled') || twofaMsg.includes('disabled') ? 'alert--success' : 'alert--error'}`} style={{ marginBottom: 'var(--space-5)' }}>{twofaMsg}</div>}

                {!user.totp_enabled && !qrCode && !backupCodes.length && (
                  <button className="btn btn--primary" onClick={setup2FA}>Set Up 2FA</button>
                )}

                {qrCode && !backupCodes.length && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
                    <div style={{ textAlign: 'center' }}>
                      <img src={`data:image/png;base64,${qrCode}`} alt="QR Code" style={{ width: '200px', height: '200px', borderRadius: 'var(--radius-md)' }} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Secret Key (manual entry)</label>
                      <input className="form-input form-input--mono" value={totpSecret} readOnly />
                    </div>
                    <div className="form-group">
                      <label className="form-label" htmlFor="totp-verify">Verification Code</label>
                      <input id="totp-verify" className="form-input form-input--mono" placeholder="000000" maxLength={6}
                        value={totpCode} onChange={(e) => setTotpCode(e.target.value)} />
                    </div>
                    <button className="btn btn--primary" onClick={confirm2FA}>Verify & Enable 2FA</button>
                  </div>
                )}

                {backupCodes.length > 0 && (
                  <div>
                    <div className="alert alert--warning" style={{ marginBottom: 'var(--space-5)' }}>
                      Save these backup codes somewhere safe. They will not be shown again.
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--space-2)' }}>
                      {backupCodes.map((code, i) => (
                        <code key={i} style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', padding: 'var(--space-3)', fontFamily: 'var(--font-mono)', fontSize: '0.9rem', textAlign: 'center' }}>{code}</code>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {section === 'notifications' && (
              <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-5)' }}>
                  <h3>Notifications</h3>
                  {unreadCount > 0 && (
                    <button className="btn btn--secondary btn--sm" onClick={async () => {
                      await notificationService.markAllRead();
                      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
                      setUnreadCount(0);
                    }}>
                      Mark all read
                    </button>
                  )}
                </div>
                {notifications.length === 0 ? (
                  <div className="empty-state"><div className="empty-state__title">No notifications</div></div>
                ) : notifications.map((notif) => (
                  <div key={notif.id} style={{
                    padding: 'var(--space-4)', borderBottom: '1px solid var(--color-border)',
                    display: 'flex', gap: 'var(--space-4)', alignItems: 'flex-start',
                    background: notif.is_read ? 'transparent' : 'rgba(56,189,248,0.04)',
                    cursor: 'pointer', borderRadius: 'var(--radius-sm)',
                  }} onClick={async () => {
                    if (!notif.is_read) {
                      await notificationService.markRead(notif.id);
                      setNotifications((prev) => prev.map((n) => n.id === notif.id ? { ...n, is_read: true } : n));
                      setUnreadCount((c) => Math.max(0, c - 1));
                    }
                  }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: notif.is_read ? 'transparent' : 'var(--color-brand)', marginTop: '7px', flexShrink: 0 }} />
                    <div>
                      <div style={{ fontWeight: notif.is_read ? '500' : '700', marginBottom: '4px' }}>{notif.title}</div>
                      <div style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>{notif.message}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                        {new Date(notif.created_at).toLocaleString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
