'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { certificateService } from '@/services/api.service';
import type { Certificate } from '@/types';

export default function CertificatePage() {
  const params = useParams();
  const uid = params?.uid as string;
  const [cert, setCert] = useState<Certificate | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!uid) return;
    certificateService.verify(uid)
      .then(setCert)
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [uid]);

  if (loading) return <div className="loading-screen"><div className="spinner spinner--lg" /></div>;

  if (notFound || !cert) {
    return (
      <div className="loading-screen">
        <div style={{ textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
            </div>
          </div>
          <h1 style={{ fontSize: '1.5rem', marginBottom: '8px' }}>Certificate Not Found</h1>
          <p style={{ color: 'var(--color-text-muted)' }}>This certificate ID is invalid or does not exist.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--color-bg-primary)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 'var(--space-6)',
    }}>
      <div style={{ maxWidth: '700px', width: '100%' }}>
        {/* Certificate Card */}
        <div style={{
          background: 'linear-gradient(135deg, #1c1917, #292524)',
          border: '1px solid #a16207',
          borderRadius: '24px',
          padding: '48px',
          textAlign: 'center',
          position: 'relative',
          overflow: 'hidden',
          boxShadow: '0 0 60px rgba(161,98,7,0.2)',
        }}>
          {/* Decorative corners */}
          {['topLeft', 'topRight', 'bottomLeft', 'bottomRight'].map((pos) => (
            <div key={pos} style={{
              position: 'absolute',
              width: '40px', height: '40px',
              border: '2px solid rgba(161,98,7,0.5)',
              ...(pos.includes('top') ? { top: '16px' } : { bottom: '16px' }),
              ...(pos.includes('Left') ? { left: '16px', borderRight: 'none', borderBottom: 'none' } : { right: '16px', borderLeft: 'none', borderBottom: 'none' }),
              ...(pos.includes('bottom') ? { borderTop: 'none' } : {}),
            }} />
          ))}

          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(245, 158, 11, 0.1)', color: '#fbbf24', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.45 1-1 1H7v4h10v-4h-2c-.55 0-1-.45-1-1v-2.34c3-.5 5-3.04 5-6.66V4H5v4c0 3.62 2 6.16 5 6.66z"/></svg>
            </div>
          </div>
          <div style={{ fontSize: '0.8125rem', color: '#a16207', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '8px' }}>
            Certificate of Achievement
          </div>
          <div style={{ fontSize: '0.9375rem', color: '#78716c', marginBottom: '32px' }}>
            This certifies that
          </div>

          <div style={{ fontSize: '2.5rem', fontWeight: '800', color: '#fef3c7', marginBottom: '8px' }}>
            {cert.participant}
          </div>
          {cert.team && (
            <div style={{ fontSize: '1.125rem', color: '#a16207', marginBottom: '32px' }}>
              representing <strong style={{ color: '#fbbf24' }}>{cert.team}</strong>
            </div>
          )}

          <div style={{ fontSize: '1rem', color: '#78716c', marginBottom: '8px' }}>
            successfully competed in
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#fef3c7', marginBottom: '40px' }}>
            {cert.event}
          </div>

          {/* Stats */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '48px', marginBottom: '40px' }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: '#78716c', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>Rank</div>
              <div style={{ fontSize: '2rem', fontWeight: '800', color: '#fbbf24' }}>
                {cert.rank ? `#${cert.rank}` : '—'}
              </div>
            </div>
            <div style={{ width: '1px', background: 'rgba(161,98,7,0.3)' }} />
            <div>
              <div style={{ fontSize: '0.75rem', color: '#78716c', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>Score</div>
              <div style={{ fontSize: '2rem', fontWeight: '800', color: '#fbbf24' }}>
                {cert.score.toLocaleString()}
              </div>
            </div>
            <div style={{ width: '1px', background: 'rgba(161,98,7,0.3)' }} />
            <div>
              <div style={{ fontSize: '0.75rem', color: '#78716c', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>Solves</div>
              <div style={{ fontSize: '2rem', fontWeight: '800', color: '#fbbf24' }}>
                {cert.solve_count}
              </div>
            </div>
          </div>

          {/* Verification */}
          <div style={{
            background: 'rgba(0,0,0,0.3)', borderRadius: '12px', padding: '16px',
            display: 'inline-block',
          }}>
            <div style={{ fontSize: '0.75rem', color: '#78716c', marginBottom: '4px' }}>
              Certificate ID
            </div>
            <code style={{ fontSize: '0.8125rem', color: '#a16207', fontFamily: 'monospace' }}>
              {cert.certificate_uid}
            </code>
          </div>

          <div style={{ marginTop: '24px', fontSize: '0.8125rem', color: '#78716c' }}>
            Issued {new Date(cert.generated_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </div>
        </div>

        {/* Valid indicator */}
        <div style={{
          marginTop: '24px', textAlign: 'center',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
        }}>
          <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 8px #10b981' }} />
          <span style={{ color: '#10b981', fontWeight: '600' }}>Certificate Verified</span>
        </div>

        <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.875rem', marginTop: '8px' }}>
          This certificate was issued by CTF Platform and can be verified at this URL
        </p>
      </div>
    </div>
  );
}
