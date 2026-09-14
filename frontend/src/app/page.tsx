'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '@/store/authStore';

/* ── Count-up hook ──────────────────────────────────────────── */
function useCountUp(target: number, duration = 1800, start = false) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!start) return;
    let startTime: number | null = null;
    const step = (ts: number) => {
      if (!startTime) startTime = ts;
      const progress = Math.min((ts - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(eased * target));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target, duration, start]);
  return count;
}

const FEATURES = [
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>
      </svg>
    ),
    title: 'Challenge Engine',
    desc: 'Static & dynamic flags, file attachments, hints, and category organization across Web, Crypto, Pwn, Rev, and more.',
    color: '#a855f7',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
      </svg>
    ),
    title: 'Live Leaderboards',
    desc: 'WebSocket-powered real-time standings with freeze support, multiple views, and disqualification controls.',
    color: '#06b6d4',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
      </svg>
    ),
    title: 'Enterprise Security',
    desc: 'Argon2 hashing, JWT rotation, TOTP 2FA, rate limiting, audit logs, and full OWASP protections.',
    color: '#f59e0b',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
    title: 'Team Management',
    desc: 'Create teams, invite members, accept invitations, transfer ownership, and track team scores seamlessly.',
    color: '#10b981',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
        <polyline points="22,6 12,13 2,6"/>
      </svg>
    ),
    title: 'Email Notifications',
    desc: 'Professional transactional emails for verification, password reset, event notifications, and certificates.',
    color: '#f472b6',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="18" height="18" rx="2"/>
        <line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/>
      </svg>
    ),
    title: 'Admin Dashboard',
    desc: 'Comprehensive stats, submission review, audit log viewer, CSV exports, and full event management.',
    color: '#818cf8',
  },
];

const STATS = [
  { value: 500, suffix: '+', label: 'Challenges Supported' },
  { value: 99, suffix: '.9%', label: 'Platform Uptime' },
  { value: 2, suffix: 'FA', label: 'Security Built-in' },
  { value: 24, suffix: '/7', label: 'Real-Time Events' },
];

export default function HomePage() {
  const { isAuthenticated } = useAuthStore();
  const router = useRouter();
  const statsRef = useRef<HTMLDivElement>(null);
  const [statsVisible, setStatsVisible] = useState(false);

  useEffect(() => {
    if (isAuthenticated) router.push('/dashboard');
  }, [isAuthenticated, router]);

  // Intersection observer for count-up trigger
  useEffect(() => {
    const el = statsRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setStatsVisible(true); obs.disconnect(); }
    }, { threshold: 0.3 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const c0 = useCountUp(STATS[0].value, 1600, statsVisible);
  const c1 = useCountUp(STATS[1].value, 1400, statsVisible);
  const c2 = useCountUp(STATS[2].value, 1000, statsVisible);
  const c3 = useCountUp(STATS[3].value, 1200, statsVisible);
  const counts = [c0, c1, c2, c3];

  return (
    <main style={{ minHeight: '100vh', background: 'var(--color-bg-primary)', position: 'relative', overflowX: 'hidden' }}>

      {/* ── Animated grid background ── */}
      <div style={{
        position: 'fixed', inset: 0,
        backgroundImage: `
          linear-gradient(rgba(168,85,247,0.025) 1px, transparent 1px),
          linear-gradient(90deg, rgba(168,85,247,0.025) 1px, transparent 1px)
        `,
        backgroundSize: '60px 60px',
        pointerEvents: 'none', zIndex: 0,
      }} />
      <div style={{
        position: 'fixed', top: '-30%', left: '50%', transform: 'translateX(-50%)',
        width: '80vw', height: '80vh',
        background: 'radial-gradient(ellipse at center, rgba(124,58,237,0.08) 0%, rgba(6,182,212,0.04) 40%, transparent 70%)',
        pointerEvents: 'none', zIndex: 0,
        animation: 'orb-drift 8s ease-in-out infinite alternate',
      }} />

      {/* ── Navbar ── */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        background: 'rgba(8,11,20,0.85)', backdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--color-border)',
        padding: '0 var(--space-8)', height: '64px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <div style={{
            width: '36px', height: '36px',
            background: 'var(--gradient-brand)',
            borderRadius: 'var(--radius-md)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--font-heading)', fontSize: '0.8125rem', fontWeight: 700, color: '#fff',
            boxShadow: '0 0 16px rgba(168,85,247,0.5)',
          }}>CTF</div>
          <span style={{ fontFamily: 'var(--font-heading)', fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-text-primary)', letterSpacing: '0.03em' }}>
            CTF<span style={{ background: 'var(--gradient-brand)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Platform</span>
          </span>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
          <Link href="/events" className="btn btn--ghost btn--sm">Events</Link>
          <Link href="/login" className="btn btn--secondary btn--sm">Sign In</Link>
          <Link href="/register" className="btn btn--primary btn--sm">Get Started</Link>
        </div>
      </nav>

      {/* ── Hero Section ── */}
      <section style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        textAlign: 'center', padding: 'var(--space-16) var(--space-6)',
        paddingTop: 'calc(var(--space-16) + 64px)', position: 'relative', zIndex: 1,
      }}>
        <div style={{ maxWidth: '880px' }}>
          {/* Terminal badge */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)',
            background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.25)',
            borderRadius: 'var(--radius-full)', padding: '6px 16px',
            fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-brand)',
            marginBottom: 'var(--space-8)', letterSpacing: '0.08em',
            fontFamily: 'var(--font-mono)',
          }}>
            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--color-success)', animation: 'pulse 1.5s ease infinite', display: 'inline-block' }} />
            {'>'} PLATFORM_STATUS: ONLINE
          </div>

          <h1 style={{
            fontFamily: 'var(--font-heading)',
            fontSize: 'clamp(2.75rem, 8vw, 5.5rem)',
            fontWeight: 700, lineHeight: 1.05,
            marginBottom: 'var(--space-6)', letterSpacing: '-0.01em',
          }}>
            Compete. Hack.{' '}
            <span style={{
              display: 'block',
              background: 'var(--gradient-brand)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            }}>Conquer.</span>
          </h1>

          <p style={{
            fontSize: '1.1875rem', color: 'var(--color-text-secondary)',
            maxWidth: '600px', margin: '0 auto var(--space-10)', lineHeight: 1.75,
          }}>
            The ultimate CTF event management platform. Register for competitions, form teams,
            and solve challenges across Web, Crypto, Pwn, Forensics — all in one place.
          </p>

          <div style={{ display: 'flex', gap: 'var(--space-4)', justifyContent: 'center', flexWrap: 'wrap', marginBottom: 'var(--space-16)' }}>
            <Link href="/register" className="btn btn--primary btn--lg">
              Start Competing →
            </Link>
            <Link href="/events" className="btn btn--secondary btn--lg">
              Browse Events
            </Link>
          </div>

          {/* Stats row */}
          <div ref={statsRef} style={{
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 'var(--space-4)', maxWidth: '700px', margin: '0 auto',
          }}>
            {STATS.map((stat, i) => (
              <div key={stat.label} style={{
                background: 'rgba(13,17,35,0.7)', border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-lg)', padding: 'var(--space-5)',
                backdropFilter: 'blur(10px)', textAlign: 'center',
              }}>
                <div style={{
                  fontFamily: 'var(--font-heading)', fontSize: '2rem', fontWeight: 700,
                  background: 'var(--gradient-brand)',
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
                  lineHeight: 1,
                }}>
                  {counts[i]}{stat.suffix}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '6px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features Section ── */}
      <section style={{ padding: 'var(--space-16) var(--space-6)', maxWidth: '1280px', margin: '0 auto', position: 'relative', zIndex: 1 }}>
        {/* Section header */}
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-12)' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)',
            background: 'rgba(6,182,212,0.08)', border: '1px solid rgba(6,182,212,0.2)',
            borderRadius: 'var(--radius-full)', padding: '5px 14px',
            fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-accent)',
            marginBottom: 'var(--space-5)', letterSpacing: '0.1em', textTransform: 'uppercase',
          }}>
            Platform Features
          </div>
          <h2 style={{ fontFamily: 'var(--font-heading)', marginBottom: 'var(--space-3)', fontSize: 'clamp(1.75rem, 3vw, 2.5rem)' }}>
            Everything you need to run a{' '}
            <span style={{ background: 'var(--gradient-brand)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              world-class CTF
            </span>
          </h2>
          <p style={{ color: 'var(--color-text-secondary)', maxWidth: '500px', margin: '0 auto' }}>
            From event creation to certificate generation — a complete, production-ready toolkit.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-6)' }}
          className="feature-grid">
          {FEATURES.map((f) => (
            <div key={f.title} className="card" style={{ cursor: 'default' }}>
              {/* Icon box */}
              <div style={{
                width: '48px', height: '48px', borderRadius: 'var(--radius-md)',
                background: `${f.color}14`,
                border: `1px solid ${f.color}28`,
                color: f.color,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 'var(--space-5)',
                boxShadow: `0 0 20px ${f.color}18`,
              }}>
                {f.icon}
              </div>
              <h3 style={{ fontFamily: 'var(--font-heading)', marginBottom: 'var(--space-3)', fontSize: '1.25rem', letterSpacing: '0.02em' }}>
                {f.title}
              </h3>
              <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', lineHeight: 1.7 }}>
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA Section ── */}
      <section style={{
        padding: 'var(--space-16) var(--space-6)', textAlign: 'center',
        position: 'relative', zIndex: 1, margin: 'var(--space-8) 0',
      }}>
        {/* Glow backdrop */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(135deg, rgba(124,58,237,0.06) 0%, rgba(6,182,212,0.04) 100%)',
          borderTop: '1px solid var(--color-border)', borderBottom: '1px solid var(--color-border)',
        }} />
        <div style={{ position: 'relative', zIndex: 1, maxWidth: '600px', margin: '0 auto' }}>
          <h2 style={{ fontFamily: 'var(--font-heading)', marginBottom: 'var(--space-4)', fontSize: 'clamp(1.75rem, 3vw, 2.5rem)' }}>
            Ready to{' '}
            <span style={{ background: 'var(--gradient-brand)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              hack?
            </span>
          </h2>
          <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-8)', fontSize: '1.0625rem' }}>
            Create your account in seconds and start competing in the next live event.
          </p>
          <div style={{ display: 'flex', gap: 'var(--space-4)', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/register" className="btn btn--primary btn--lg">
              Create Free Account
            </Link>
            <Link href="/events" className="btn btn--outline btn--lg">
              View Events
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={{
        padding: 'var(--space-8) var(--space-6)',
        borderTop: '1px solid var(--color-border)',
        position: 'relative', zIndex: 1,
      }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <div style={{
              width: '28px', height: '28px', background: 'var(--gradient-brand)',
              borderRadius: 'var(--radius-sm)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--font-heading)', fontSize: '0.7rem', fontWeight: 700, color: '#fff',
            }}>CTF</div>
            <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, color: 'var(--color-text-secondary)', letterSpacing: '0.03em' }}>
              CTF Platform
            </span>
          </div>
          <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', margin: 0 }}>
            Production-ready CTF event management. Built for hackers, by hackers.
          </p>
          <div style={{ display: 'flex', gap: 'var(--space-4)' }}>
            <Link href="/events" style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>Events</Link>
            <Link href="/login" style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>Login</Link>
            <Link href="/register" style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>Register</Link>
          </div>
        </div>
      </footer>

      {/* ── Responsive feature grid ── */}
      <style>{`
        @media (max-width: 1024px) { .feature-grid { grid-template-columns: repeat(2, 1fr) !important; } }
        @media (max-width: 640px)  { .feature-grid { grid-template-columns: 1fr !important; } }
        @keyframes orb-drift {
          from { transform: translateX(-50%) translateY(0); }
          to   { transform: translateX(-50%) translateY(40px); }
        }
      `}</style>
    </main>
  );
}
