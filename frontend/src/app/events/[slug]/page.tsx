'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { eventService, challengeService, categoryService, leaderboardService, announcementService } from '@/services/api.service';
import { useUser } from '@/store/authStore';
import type { EventDetail, Challenge, Category, LeaderboardEntry, Announcement } from '@/types';
import { getErrorMessage } from '@/lib/api';

type Tab = 'overview' | 'challenges' | 'leaderboard' | 'announcements';

const DIFF_COLORS: Record<string, string> = {
  beginner: 'diff-beginner',
  easy: 'diff-easy',
  medium: 'diff-medium',
  hard: 'diff-hard',
  insane: 'diff-insane',
};

function formatDate(d: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function EventPage() {
  const params = useParams();
  const slug = params?.slug as string;
  const user = useUser();

  const [event, setEvent] = useState<EventDetail | null>(null);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [tab, setTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [regMessage, setRegMessage] = useState('');

  // Challenge filters
  const [filterCategory, setFilterCategory] = useState<number | null>(null);
  const [filterDifficulty, setFilterDifficulty] = useState('');
  const [filterSearch, setFilterSearch] = useState('');
  const [showSolved, setShowSolved] = useState(true);
  const [showUnsolved, setShowUnsolved] = useState(true);

  // Active challenge for submission
  const [activeChallenge, setActiveChallenge] = useState<Challenge | null>(null);
  const [flagInput, setFlagInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{ result: string; message: string } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const e = await eventService.get(slug);
        setEvent(e);
        const [cats, ann] = await Promise.all([
          categoryService.list(e.id),
          announcementService.list(e.id),
        ]);
        setCategories(cats);
        setAnnouncements(ann);
      } catch { /* ignore */ }
      finally { setLoading(false); }
    })();
  }, [slug]);

  useEffect(() => {
    if (tab === 'challenges' && event) {
      challengeService.list(event.id, {
        category: filterCategory ?? undefined,
        difficulty: filterDifficulty || undefined,
        search: filterSearch || undefined,
      }).then(setChallenges).catch(() => {});
    }
    if (tab === 'leaderboard' && event) {
      leaderboardService.get(event.id).then((lb) => setLeaderboard(lb.entries)).catch(() => {});
    }
  }, [tab, event, filterCategory, filterDifficulty, filterSearch]);

  const handleRegister = async () => {
    if (!event) return;
    setRegistering(true);
    setRegMessage('');
    try {
      const res = await eventService.register(event.id);
      setRegMessage(res.message);
    } catch (err) {
      setRegMessage(getErrorMessage(err));
    } finally {
      setRegistering(false);
    }
  };

  const handleSubmitFlag = async () => {
    if (!activeChallenge || !flagInput.trim()) return;
    setSubmitting(true);
    setSubmitResult(null);
    try {
      const res = await challengeService.submit(activeChallenge.id, flagInput.trim());
      setSubmitResult({ result: res.result, message: res.message });
      if (res.result === 'correct') {
        // Update challenge in list
        setChallenges((prev) => prev.map((c) => c.id === activeChallenge.id ? { ...c, is_solved: true } : c));
      }
    } catch (err) {
      setSubmitResult({ result: 'error', message: getErrorMessage(err) });
    } finally {
      setSubmitting(false);
    }
  };

  const filteredChallenges = challenges.filter((c) => {
    if (!showSolved && c.is_solved) return false;
    if (!showUnsolved && !c.is_solved) return false;
    return true;
  });

  if (loading) {
    return <div className="loading-screen"><div className="spinner spinner--lg" /><p className="text-muted">Loading event...</p></div>;
  }

  if (!event) {
    return <div className="empty-state" style={{ paddingTop: 'var(--space-16)' }}><div className="empty-state__title">Event not found</div><Link href="/events" className="btn btn--secondary" style={{ marginTop: 'var(--space-4)' }}>Back to Events</Link></div>;
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg-primary)' }}>
      {/* Event Header */}
      <div style={{
        background: 'linear-gradient(135deg, var(--color-bg-card) 0%, var(--color-bg-secondary) 100%)',
        borderBottom: '1px solid var(--color-border)',
        padding: 'var(--space-12) var(--space-8) var(--space-8)',
      }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
          <Link href="/events" style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-6)' }}>
            ← All Events
          </Link>

          <div style={{ display: 'flex', gap: 'var(--space-6)', alignItems: 'flex-start', flexWrap: 'wrap', justifyContent: 'space-between' }}>
            <div>
              <span className={`badge ${event.status === 'live' ? 'status-live' : 'badge--gray'}`} style={{ marginBottom: 'var(--space-3)' }}>
                {event.status.replace('_', ' ').toUpperCase()}
              </span>
              <h1 style={{ fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', fontWeight: '900', marginBottom: 'var(--space-3)' }}>
                {event.name}
              </h1>
              {event.description && (
                <p style={{ color: 'var(--color-text-secondary)', maxWidth: '600px', lineHeight: '1.7' }}>
                  {event.description}
                </p>
              )}
              <div style={{ display: 'flex', gap: 'var(--space-4)', marginTop: 'var(--space-5)', flexWrap: 'wrap' }}>
                <span className="badge badge--gray">{formatDate(event.start_date)} — {formatDate(event.end_date)}</span>
                {event.max_teams && <span className="badge badge--blue">Max {event.max_teams} teams of {event.team_size}</span>}
                <span className="badge badge--purple">{event.scoring_type === 'dynamic' ? 'Dynamic' : 'Static'} Scoring</span>
              </div>
            </div>

            {/* Register Button */}
            {user && (event.status === 'registration_open' || event.status === 'upcoming') && (
              <div>
                <button
                  id="event-register-btn"
                  className="btn btn--primary btn--lg"
                  onClick={handleRegister}
                  disabled={registering}
                >
                  {registering ? <><span className="spinner spinner--sm" /> Registering...</> : 'Register for Event'}
                </button>
                {regMessage && <p style={{ marginTop: 'var(--space-3)', fontSize: '0.875rem', color: 'var(--color-brand)' }}>{regMessage}</p>}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div style={{ background: 'var(--color-bg-secondary)', borderBottom: '1px solid var(--color-border)', position: 'sticky', top: '0', zIndex: '80' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'flex', gap: '0', padding: '0 var(--space-8)' }}>
          {(['overview', 'challenges', 'leaderboard', 'announcements'] as Tab[]).map((t) => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: 'var(--space-4) var(--space-5)',
              background: 'transparent',
              border: 'none',
              borderBottom: tab === t ? '2px solid var(--color-brand)' : '2px solid transparent',
              color: tab === t ? 'var(--color-brand)' : 'var(--color-text-secondary)',
              fontWeight: tab === t ? '600' : '500',
              cursor: 'pointer',
              fontSize: '0.9375rem',
              textTransform: 'capitalize',
              transition: 'all var(--transition-fast)',
            }}>
              {t === 'overview' ? 'Overview' : t === 'challenges' ? 'Challenges' : t === 'leaderboard' ? 'Leaderboard' : 'Announcements'}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: 'var(--space-8)' }}>
        {/* OVERVIEW */}
        {tab === 'overview' && (
          <div className="grid grid-2" style={{ gap: 'var(--space-8)' }}>
            <div>
              {event.rules && (
                <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
                  <h3 style={{ marginBottom: 'var(--space-4)' }}>Rules</h3>
                  <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'var(--font-sans)', color: 'var(--color-text-secondary)', lineHeight: '1.7', fontSize: '0.9375rem' }}>
                    {event.rules}
                  </pre>
                </div>
              )}
            </div>
            <div>
              <div className="card">
                <h3 style={{ marginBottom: 'var(--space-5)' }}>Event Schedule</h3>
                {[
                  { label: 'Registration Opens', value: formatDate(event.registration_start) },
                  { label: 'Registration Closes', value: formatDate(event.registration_end) },
                  { label: 'Event Starts', value: formatDate(event.start_date) },
                  { label: 'Event Ends', value: formatDate(event.end_date) },
                ].map((item) => (
                  <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--space-3) 0', borderBottom: '1px solid var(--color-border)' }}>
                    <span style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>{item.label}</span>
                    <span style={{ fontSize: '0.875rem', fontWeight: '600' }}>{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* CHALLENGES */}
        {tab === 'challenges' && (
          <div>
            {/* Filters */}
            <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-6)', flexWrap: 'wrap' }}>
              <input
                className="form-input"
                style={{ maxWidth: '280px' }}
                placeholder="Search challenges..."
                value={filterSearch}
                onChange={(e) => setFilterSearch(e.target.value)}
              />
              <select className="form-input form-select" style={{ width: 'auto', minWidth: '150px' }}
                value={filterCategory ?? ''} onChange={(e) => setFilterCategory(e.target.value ? Number(e.target.value) : null)}>
                <option value="">All Categories</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <select className="form-input form-select" style={{ width: 'auto', minWidth: '150px' }}
                value={filterDifficulty} onChange={(e) => setFilterDifficulty(e.target.value)}>
                <option value="">All Difficulties</option>
                {['beginner', 'easy', 'medium', 'hard', 'insane'].map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
              <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', cursor: 'pointer', fontSize: '0.875rem' }}>
                <input type="checkbox" checked={showSolved} onChange={(e) => setShowSolved(e.target.checked)} />
                Solved
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', cursor: 'pointer', fontSize: '0.875rem' }}>
                <input type="checkbox" checked={showUnsolved} onChange={(e) => setShowUnsolved(e.target.checked)} />
                Unsolved
              </label>
            </div>

            {filteredChallenges.length === 0 ? (
              <div className="empty-state"><div className="empty-state__title">No challenges found</div></div>
            ) : (
              <div className="grid grid-auto">
                {filteredChallenges.map((ch) => (
                  <div key={ch.id} className={`challenge-card ${ch.is_solved ? 'challenge-card--solved' : ''}`}
                    onClick={() => { setActiveChallenge(ch); setFlagInput(''); setSubmitResult(null); }}>
                    <div className="challenge-card__category">
                      {ch.category && (
                        <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: ch.category.color || '#64748b', display: 'inline-block' }} />
                      )}
                      <span style={{ color: ch.category?.color || 'var(--color-text-muted)' }}>
                        {ch.category?.name || 'Misc'}
                      </span>
                    </div>
                    <div className="challenge-card__name">{ch.name}</div>
                    <div className="challenge-card__meta">
                      <div>
                        <span className="challenge-card__points">{ch.current_points} pts</span>
                        {event.scoring_type === 'dynamic' && ch.current_points !== ch.points && (
                          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginLeft: '6px' }}>/{ch.points}</span>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                        <span className={`badge ${DIFF_COLORS[ch.difficulty]}`}>{ch.difficulty}</span>
                        <span className="challenge-card__solves">{ch.solve_count} solves</span>
                      </div>
                    </div>
                    {ch.files.length > 0 && (
                      <div style={{ marginTop: 'var(--space-3)', display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                        {ch.files.map((f) => (
                          <span key={f.id} className="badge badge--gray">{f.original_filename}</span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* LEADERBOARD */}
        {tab === 'leaderboard' && (
          <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
            {event.leaderboard_status === 'frozen' && (
              <div className="alert alert--warning" style={{ borderRadius: '0', border: 'none', borderBottom: '1px solid var(--color-border)' }}>
                Leaderboard is frozen — showing scores at freeze time
              </div>
            )}
            <table className="leaderboard-table">
              <thead>
                <tr>
                  <th style={{ width: '60px' }}>Rank</th>
                  <th>Team</th>
                  <th>Country</th>
                  <th>Solves</th>
                  <th>Score</th>
                  <th>Last Solve</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((entry) => (
                  <tr key={entry.team_id}>
                    <td style={{ fontWeight: '700', fontSize: '1rem' }}>
                      #{entry.rank}
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                        {entry.team_logo && <img src={entry.team_logo} alt="" style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover' }} />}
                        <span style={{ fontWeight: '600' }}>{entry.team_name}</span>
                      </div>
                    </td>
                    <td style={{ color: 'var(--color-text-muted)' }}>{entry.country || '—'}</td>
                    <td>{entry.solve_count}</td>
                    <td style={{ fontWeight: '700', color: 'var(--color-brand)', fontFamily: 'var(--font-mono)' }}>
                      {entry.total_points.toLocaleString()}
                    </td>
                    <td style={{ color: 'var(--color-text-muted)', fontSize: '0.8125rem' }}>
                      {entry.last_solve_at ? new Date(entry.last_solve_at).toLocaleTimeString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {leaderboard.length === 0 && (
              <div className="empty-state"><div className="empty-state__title">No scores yet</div></div>
            )}
          </div>
        )}

        {/* ANNOUNCEMENTS */}
        {tab === 'announcements' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            {announcements.length === 0 ? (
              <div className="empty-state"><div className="empty-state__title">No announcements yet</div></div>
            ) : announcements.map((ann) => (
              <div key={ann.id} className={`announcement-card ${ann.is_pinned ? 'announcement-card--pinned' : ''}`}>
                {ann.is_pinned && <span className="badge badge--yellow" style={{ marginBottom: 'var(--space-2)' }}>Pinned</span>}
                <div className="announcement-card__title">{ann.title}</div>
                <div className="announcement-card__content">{ann.content}</div>
                <div className="announcement-card__meta">
                  {ann.author && <span>{ann.author.display_name || ann.author.username} · </span>}
                  {new Date(ann.created_at).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Challenge Detail Modal */}
      {activeChallenge && (
        <div className="modal-backdrop" onClick={() => setActiveChallenge(null)}>
          <div className="modal modal--wide" onClick={(e) => e.stopPropagation()}>
            <div className="modal__header">
              <h2 className="modal__title">{activeChallenge.name}</h2>
              <button className="modal__close" onClick={() => setActiveChallenge(null)}>&times;</button>
            </div>

            <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-5)', flexWrap: 'wrap' }}>
              {activeChallenge.category && <span className="badge badge--blue">{activeChallenge.category.name}</span>}
              <span className={`badge ${DIFF_COLORS[activeChallenge.difficulty]}`}>{activeChallenge.difficulty}</span>
              <span className="badge badge--purple">{activeChallenge.current_points} pts</span>
              <span className="badge badge--gray">{activeChallenge.solve_count} solves</span>
              {activeChallenge.is_solved && <span className="badge badge--green">Solved</span>}
            </div>

            {activeChallenge.description && (
              <div style={{ background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-md)', padding: 'var(--space-5)', marginBottom: 'var(--space-5)', whiteSpace: 'pre-wrap', color: 'var(--color-text-secondary)', lineHeight: '1.7' }}>
                {activeChallenge.description}
              </div>
            )}

            {/* Files */}
            {activeChallenge.files.length > 0 && (
              <div style={{ marginBottom: 'var(--space-5)' }}>
                <h4 style={{ marginBottom: 'var(--space-3)', fontSize: '0.875rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Attachments</h4>
                <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                  {activeChallenge.files.map((f) => (
                    <a key={f.id} href={f.download_url} download className="btn btn--secondary btn--sm">
                      {f.original_filename} <span style={{ color: 'var(--color-text-muted)' }}>({formatBytes(f.file_size)})</span>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Hints */}
            {activeChallenge.hints.length > 0 && (
              <div style={{ marginBottom: 'var(--space-5)' }}>
                <h4 style={{ marginBottom: 'var(--space-3)', fontSize: '0.875rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Hints</h4>
                {activeChallenge.hints.map((hint) => (
                  <div key={hint.id} style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: 'var(--space-4)', marginBottom: 'var(--space-3)' }}>
                    {hint.is_unlocked ? (
                      <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>{hint.content}</p>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--color-text-muted)' }}>Locked hint</span>
                        <button className="btn btn--secondary btn--sm" onClick={async () => {
                          try {
                            const res = await challengeService.unlockHint(activeChallenge.id, hint.id);
                            setActiveChallenge((prev) => prev ? {
                              ...prev,
                              hints: prev.hints.map((h) => h.id === hint.id ? { ...h, is_unlocked: true, content: res.content } : h)
                            } : null);
                          } catch (err) { alert(getErrorMessage(err)); }
                        }}>
                          Unlock {hint.cost > 0 ? `(-${hint.cost} pts)` : '(Free)'}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Submit Flag */}
            {!activeChallenge.is_solved && user && (
              <div className="flag-form">
                <h4 style={{ marginBottom: 'var(--space-4)', fontSize: '0.875rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Submit Flag</h4>
                <div className="flag-form__input-row">
                  <input
                    id="flag-input"
                    className="form-input flag-input form-input--mono"
                    placeholder="flag{...}"
                    value={flagInput}
                    onChange={(e) => setFlagInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSubmitFlag()}
                  />
                  <button id="flag-submit-btn" className="btn btn--primary" onClick={handleSubmitFlag} disabled={submitting || !flagInput.trim()}>
                    {submitting ? <span className="spinner spinner--sm" /> : 'Submit'}
                  </button>
                </div>
                {submitResult && (
                  <div className={`alert ${submitResult.result === 'correct' ? 'alert--success' : submitResult.result === 'already_solved' ? 'alert--info' : 'alert--error'}`} style={{ marginTop: 'var(--space-3)' }}>
                    {submitResult.message}
                  </div>
                )}
              </div>
            )}

            {activeChallenge.is_solved && (
              <div className="alert alert--success">Your team has already solved this challenge!</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
