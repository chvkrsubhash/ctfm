'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { getErrorMessage } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const { login, isLoading } = useAuthStore();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [need2FA, setNeed2FA] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await login(identifier, password, need2FA ? totpCode : undefined);
      router.push('/dashboard');
    } catch (err: unknown) {
      const msg = getErrorMessage(err);
      if (msg.includes('2FA') || (err as { response?: { headers?: { 'x-2fa-required'?: string } } })?.response?.headers?.['x-2fa-required']) {
        setNeed2FA(true);
      } else {
        setError(msg);
      }
    }
  };

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={handleSubmit}>
        {/* Logo */}
        <div className="auth-card__logo">
          <div className="auth-card__logo-mark">CTF</div>
        </div>

        <h1 className="auth-card__title">
          {need2FA ? 'Two-Factor Auth' : 'Welcome back'}
        </h1>
        <p className="auth-card__subtitle">
          {need2FA ? 'Enter your authenticator code to continue' : 'Sign in to your CTF Platform account'}
        </p>

        {error && (
          <div className="alert alert--error" style={{ marginBottom: 'var(--space-5)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            {error}
          </div>
        )}

        {!need2FA ? (
          <>
            <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
              <label className="form-label" htmlFor="identifier">Email or Username</label>
              <input
                id="identifier"
                className="form-input"
                type="text"
                placeholder="you@example.com"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                autoComplete="username"
                required
              />
            </div>

            <div className="form-group" style={{ marginBottom: 'var(--space-2)' }}>
              <label className="form-label" htmlFor="password">Password</label>
              <input
                id="password"
                className="form-input"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>

            <div style={{ textAlign: 'right', marginBottom: 'var(--space-6)' }}>
              <Link href="/forgot-password" style={{ fontSize: '0.8125rem', color: 'var(--color-brand)', fontWeight: 600 }}>
                Forgot password?
              </Link>
            </div>
          </>
        ) : (
          <div className="form-group" style={{ marginBottom: 'var(--space-6)' }}>
            <label className="form-label" htmlFor="totp">Authentication Code</label>
            <input
              id="totp"
              className="form-input form-input--mono"
              type="text"
              placeholder="000 000"
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value)}
              maxLength={10}
              autoFocus
              required
              style={{ textAlign: 'center', fontSize: '1.25rem', letterSpacing: '0.2em' }}
            />
            <p className="text-sm text-muted" style={{ marginTop: 'var(--space-2)', textAlign: 'center' }}>
              Enter your 6-digit TOTP code or a backup code
            </p>
          </div>
        )}

        <button
          id="login-submit"
          type="submit"
          className="btn btn--primary btn--full btn--lg"
          disabled={isLoading}
        >
          {isLoading ? (
            <><span className="spinner spinner--sm" /> Signing in...</>
          ) : need2FA ? 'Verify & Sign In' : 'Sign In →'}
        </button>

        {need2FA && (
          <button
            type="button"
            className="btn btn--ghost btn--full"
            style={{ marginTop: 'var(--space-3)' }}
            onClick={() => setNeed2FA(false)}
          >
            ← Back to login
          </button>
        )}

        <div className="auth-divider">or</div>

        <p style={{ textAlign: 'center', fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
          Don&apos;t have an account?{' '}
          <Link href="/register" style={{ color: 'var(--color-brand)', fontWeight: 700 }}>
            Create account
          </Link>
        </p>
      </form>
    </div>
  );
}
