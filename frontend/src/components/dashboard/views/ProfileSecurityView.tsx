'use client';

import { useState } from 'react';
import type { User } from '@/types';
import { authService } from '@/services/api.service';
import api from '@/lib/api';
import { getErrorMessage } from '@/lib/api';

interface ProfileSecurityViewProps {
  user: User;
  onUserUpdated: () => void;
}

export default function ProfileSecurityView({ user, onUserUpdated }: ProfileSecurityViewProps) {
  // Profile Form
  const [displayName, setDisplayName] = useState(user.display_name || '');
  const [bio, setBio] = useState(user.bio || '');
  const [country, setCountry] = useState(user.country || '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState('');
  const [profileError, setProfileError] = useState('');

  // Password Form
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPass, setChangingPass] = useState(false);
  const [passMsg, setPassMsg] = useState('');
  const [passError, setPassError] = useState('');

  // 2FA State
  const [twoFAStep, setTwoFAStep] = useState<'idle' | 'setup' | 'backup_codes'>('idle');
  const [twoFASecret, setTwoFASecret] = useState('');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [twoFAMsg, setTwoFAMsg] = useState('');
  const [twoFAError, setTwoFAError] = useState('');
  const [loading2FA, setLoading2FA] = useState(false);

  // Handle Profile Update
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileMsg('');
    setProfileError('');
    try {
      await api.patch('/users/me', {
        display_name: displayName.trim() || null,
        bio: bio.trim() || null,
        country: country.trim() || null,
      });
      setProfileMsg('Profile updated successfully!');
      onUserUpdated();
    } catch (err) {
      setProfileError(getErrorMessage(err));
    } finally {
      setSavingProfile(false);
    }
  };

  // Handle Change Password
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setPassError('New passwords do not match');
      return;
    }
    setChangingPass(true);
    setPassMsg('');
    setPassError('');
    try {
      await authService.changePassword(currentPassword, newPassword);
      setPassMsg('Password changed successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPassError(getErrorMessage(err));
    } finally {
      setChangingPass(false);
    }
  };

  // 2FA Handlers
  const handleStart2FA = async () => {
    setLoading2FA(true);
    setTwoFAError('');
    try {
      const res = await authService.setup2FA();
      setTwoFASecret(res.secret);
      setQrCodeUrl(res.qr_code);
      setTwoFAStep('setup');
    } catch (err) {
      setTwoFAError(getErrorMessage(err));
    } finally {
      setLoading2FA(false);
    }
  };

  const handleConfirm2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading2FA(true);
    setTwoFAError('');
    try {
      const res = await authService.confirm2FA(verificationCode.trim());
      setBackupCodes(res.backup_codes);
      setTwoFAStep('backup_codes');
      setTwoFAMsg('2FA has been successfully activated!');
      onUserUpdated();
    } catch (err) {
      setTwoFAError(getErrorMessage(err));
    } finally {
      setLoading2FA(false);
    }
  };

  const handleDisable2FA = async () => {
    const pass = prompt('Enter your current account password to disable 2FA:');
    if (!pass) return;
    try {
      await authService.disable2FA(pass);
      setTwoFAMsg('Two-Factor Authentication disabled.');
      onUserUpdated();
    } catch (err) {
      alert(getErrorMessage(err));
    }
  };

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: 'var(--space-8)' }}>
      <div className="page-header" style={{ marginBottom: 'var(--space-6)' }}>
        <div>
          <h1 className="page-header__title">Profile & Security</h1>
          <p className="page-header__subtitle">Manage personal account details, credentials, and Two-Factor Authentication</p>
        </div>
      </div>

      {/* Profile Details Card */}
      <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
        <h2 style={{ fontSize: '1.25rem', marginBottom: 'var(--space-4)' }}>Account Information</h2>
        {profileMsg && <div className="alert alert--success" style={{ marginBottom: 'var(--space-4)' }}>{profileMsg}</div>}
        {profileError && <div className="alert alert--error" style={{ marginBottom: 'var(--space-4)' }}>{profileError}</div>}

        <form onSubmit={handleUpdateProfile}>
          <div className="grid grid-2" style={{ gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
            <div className="form-group">
              <label className="form-label">Username</label>
              <input type="text" className="form-control" value={user.username} disabled />
            </div>
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input type="email" className="form-control" value={user.email} disabled />
            </div>
          </div>

          <div className="grid grid-2" style={{ gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
            <div className="form-group">
              <label className="form-label">Display Name</label>
              <input
                type="text"
                className="form-control"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Country</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. United States"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 'var(--space-6)' }}>
            <label className="form-label">Bio / Profile Description</label>
            <textarea
              className="form-control"
              rows={3}
              placeholder="Tell others about yourself..."
              value={bio}
              onChange={(e) => setBio(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="submit" className="btn btn--primary" disabled={savingProfile}>
              {savingProfile ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </form>
      </div>

      {/* Password Card */}
      <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
        <h2 style={{ fontSize: '1.25rem', marginBottom: 'var(--space-4)' }}>Change Password</h2>
        {passMsg && <div className="alert alert--success" style={{ marginBottom: 'var(--space-4)' }}>{passMsg}</div>}
        {passError && <div className="alert alert--error" style={{ marginBottom: 'var(--space-4)' }}>{passError}</div>}

        <form onSubmit={handleChangePassword}>
          <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
            <label className="form-label">Current Password</label>
            <input
              type="password"
              className="form-control"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-2" style={{ gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
            <div className="form-group">
              <label className="form-label">New Password</label>
              <input
                type="password"
                className="form-control"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Confirm New Password</label>
              <input
                type="password"
                className="form-control"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="submit" className="btn btn--primary" disabled={changingPass}>
              {changingPass ? 'Updating...' : 'Update Password'}
            </button>
          </div>
        </form>
      </div>

      {/* Two-Factor Authentication Card */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem' }}>Two-Factor Authentication (TOTP 2FA)</h2>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
              Protect your account using Google Authenticator, Authy, or 1Password.
            </p>
          </div>
          <span className={`badge ${user.totp_enabled ? 'badge--green' : 'badge--gray'}`}>
            {user.totp_enabled ? 'ENABLED' : 'DISABLED'}
          </span>
        </div>

        {twoFAMsg && <div className="alert alert--success" style={{ marginBottom: 'var(--space-4)' }}>{twoFAMsg}</div>}
        {twoFAError && <div className="alert alert--error" style={{ marginBottom: 'var(--space-4)' }}>{twoFAError}</div>}

        {user.totp_enabled ? (
          <div>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-success)', marginBottom: 'var(--space-4)' }}>
              Your account is protected with Two-Factor Authentication.
            </p>
            <button className="btn btn--danger btn--sm" onClick={handleDisable2FA}>
              Disable 2FA
            </button>
          </div>
        ) : (
          <div>
            {twoFAStep === 'idle' && (
              <button className="btn btn--primary" onClick={handleStart2FA} disabled={loading2FA}>
                {loading2FA ? 'Setting up...' : 'Setup Two-Factor Authentication'}
              </button>
            )}

            {twoFAStep === 'setup' && (
              <div style={{ background: 'var(--color-bg-secondary)', padding: 'var(--space-6)', borderRadius: 'var(--radius-lg)' }}>
                <h3 style={{ fontSize: '1.0625rem', marginBottom: 'var(--space-2)' }}>1. Scan QR Code or Enter Secret Key</h3>
                <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-4)' }}>
                  Scan the QR code with your authenticator app, or manually enter the key below:
                </p>

                {qrCodeUrl && (
                  <div style={{ marginBottom: 'var(--space-4)', display: 'inline-block', background: '#fff', padding: '12px', borderRadius: '8px' }}>
                    <img src={qrCodeUrl} alt="2FA QR Code" style={{ width: '180px', height: '180px' }} />
                  </div>
                )}

                <div style={{ marginBottom: 'var(--space-6)' }}>
                  <code style={{ fontSize: '1rem', letterSpacing: '0.1em' }}>{twoFASecret}</code>
                </div>

                <h3 style={{ fontSize: '1.0625rem', marginBottom: 'var(--space-2)' }}>2. Verify 6-Digit Code</h3>
                <form onSubmit={handleConfirm2FA} style={{ display: 'flex', gap: 'var(--space-3)', maxWidth: '350px' }}>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="000000"
                    maxLength={6}
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value)}
                    required
                  />
                  <button type="submit" className="btn btn--primary" disabled={loading2FA}>
                    {loading2FA ? 'Verifying...' : 'Confirm'}
                  </button>
                </form>
              </div>
            )}

            {twoFAStep === 'backup_codes' && (
              <div style={{ background: 'var(--color-bg-secondary)', padding: 'var(--space-6)', borderRadius: 'var(--radius-lg)' }}>
                <h3 style={{ fontSize: '1.0625rem', color: 'var(--color-success)', marginBottom: 'var(--space-2)' }}>
                  2FA Activated — Save Your Backup Codes!
                </h3>
                <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-4)' }}>
                  Store these single-use recovery codes in a safe place. If you lose your phone, they are the only way to access your account:
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', marginBottom: 'var(--space-6)' }}>
                  {backupCodes.map((code, idx) => (
                    <code key={idx} style={{ padding: '6px 12px', background: '#fff', border: '1px solid var(--color-border)' }}>
                      {code}
                    </code>
                  ))}
                </div>
                <button className="btn btn--secondary btn--sm" onClick={() => setTwoFAStep('idle')}>
                  Done
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
