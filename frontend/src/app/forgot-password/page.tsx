'use client';

import { useState } from 'react';
import Link from 'next/link';
import { authService } from '@/services/api.service';
import { getErrorMessage } from '@/lib/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      await authService.forgotPassword(email);
      setDone(true);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="auth-page">
        <div className="auth-card" style={{ textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(37, 99, 235, 0.1)', color: 'var(--color-brand)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
            </div>
          </div>
          <h1 style={{ fontSize: '1.5rem', marginBottom: '8px' }}>Check your email</h1>
          <p style={{ color: 'var(--color-text-secondary)', marginBottom: '24px' }}>
            If an account with that email exists, a password reset link has been sent.
          </p>
          <Link href="/login" className="btn btn--secondary btn--full">Back to Login</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={handleSubmit}>
        <div className="auth-card__logo">
          <div className="auth-card__logo-mark" style={{ fontSize: '0.8125rem', fontWeight: 800, letterSpacing: '0.05em' }}>CTF</div>
        </div>
        <h1 className="auth-card__title">Forgot password?</h1>
        <p className="auth-card__subtitle">Enter your email and we&apos;ll send a reset link</p>

        {error && <div className="alert alert--error" style={{ marginBottom: '20px' }}>{error}</div>}

        <div className="form-group" style={{ marginBottom: '24px' }}>
          <label className="form-label" htmlFor="email">Email address</label>
          <input id="email" className="form-input" type="email" placeholder="you@example.com"
            value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>

        <button type="submit" className="btn btn--primary btn--full btn--lg" disabled={loading}>
          {loading ? <><span className="spinner spinner--sm" /> Sending...</> : 'Send Reset Link'}
        </button>

        <div style={{ textAlign: 'center', marginTop: '20px' }}>
          <Link href="/login" style={{ fontSize: '0.875rem', color: 'var(--color-brand)' }}>← Back to login</Link>
        </div>
      </form>
    </div>
  );
}
