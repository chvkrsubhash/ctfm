'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { getErrorMessage } from '@/lib/api';

const passwordStrength = (pw: string) => {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return score;
};

const strengthLabel = ['', 'Weak', 'Fair', 'Good', 'Strong', 'Excellent'];
const strengthColor = ['', '#f87171', '#f59e0b', '#34d399', '#10b981', '#06b6d4'];

export default function RegisterPage() {
  const router = useRouter();
  const { register, isLoading } = useAuthStore();

  const [form, setForm] = useState({ email: '', username: '', password: '', displayName: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const pwStrength = passwordStrength(form.password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      const msg = await register(form.email, form.username, form.password, form.displayName || undefined);
      setSuccess(msg);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  if (success) {
    return (
      <div className="auth-page">
        <div className="auth-card" style={{ textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 'var(--space-6)' }}>
            <div style={{
              width: '64px', height: '64px', borderRadius: '50%',
              background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.3)',
              color: '#34d399', display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 30px rgba(52,211,153,0.2)',
            }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                <polyline points="22,6 12,13 2,6"/>
              </svg>
            </div>
          </div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.75rem', marginBottom: 'var(--space-3)' }}>
            Check your inbox
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-8)' }}>{success}</p>
          <Link href="/login" className="btn btn--primary btn--full">Go to Login →</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={handleSubmit}>
        {/* Logo */}
        <div className="auth-card__logo">
          <div className="auth-card__logo-mark">CTF</div>
        </div>

        <h1 className="auth-card__title">Create account</h1>
        <p className="auth-card__subtitle">Join CTF Platform and start competing</p>

        {error && (
          <div className="alert alert--error" style={{ marginBottom: 'var(--space-5)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
          <div className="form-group">
            <label className="form-label" htmlFor="email">Email address</label>
            <input id="email" className="form-input" type="email" placeholder="you@example.com"
              value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
              autoComplete="email" required />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="username">Username</label>
            <input id="username" className="form-input" type="text" placeholder="hacker42"
              value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })}
              minLength={3} maxLength={50} autoComplete="username" required />
            <span className="text-xs text-muted">3–50 chars, letters / numbers / _ / -</span>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="display_name">Display name <span style={{ color: 'var(--color-text-muted)', fontWeight: 400 }}>(optional)</span></label>
            <input id="display_name" className="form-input" type="text" placeholder="H4ck3r"
              value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })}
              maxLength={100} />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="reg-password">Password</label>
            <input id="reg-password" className="form-input" type="password" placeholder="••••••••"
              value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
              minLength={8} autoComplete="new-password" required />
            {form.password && (
              <div style={{ marginTop: 'var(--space-2)' }}>
                <div className="progress">
                  <div className="progress__fill" style={{
                    width: `${(pwStrength / 5) * 100}%`,
                    background: strengthColor[pwStrength],
                    boxShadow: `0 0 8px ${strengthColor[pwStrength]}80`,
                  }} />
                </div>
                <span style={{ fontSize: '0.75rem', color: strengthColor[pwStrength], marginTop: '5px', display: 'block', fontWeight: 700 }}>
                  {strengthLabel[pwStrength]}
                </span>
              </div>
            )}
          </div>
        </div>

        <button id="register-submit" type="submit" className="btn btn--primary btn--full btn--lg" disabled={isLoading}>
          {isLoading ? <><span className="spinner spinner--sm" /> Creating account...</> : 'Create Account →'}
        </button>

        <div className="auth-divider">or</div>

        <p style={{ textAlign: 'center', fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
          Already have an account?{' '}
          <Link href="/login" style={{ color: 'var(--color-brand)', fontWeight: 700 }}>Sign in</Link>
        </p>

        <p style={{ marginTop: 'var(--space-5)', textAlign: 'center', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
          By creating an account you agree to our terms and privacy policy.
        </p>
      </form>
    </div>
  );
}
