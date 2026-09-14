'use client';

import { useEffect, useState, useCallback } from 'react';
import type { Event, Challenge, Category, SubmissionResponse } from '@/types';
import { challengeService, categoryService } from '@/services/api.service';
import { getErrorMessage } from '@/lib/api';

interface ArenaViewProps {
  activeEvent: Event | null;
}

export default function ArenaView({ activeEvent }: ArenaViewProps) {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Filters
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  const [filterSolved, setFilterSolved] = useState<boolean>(true);
  const [filterUnsolved, setFilterUnsolved] = useState<boolean>(true);

  // Active Challenge Modal
  const [modalChallenge, setModalChallenge] = useState<Challenge | null>(null);
  const [flagInput, setFlagInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<SubmissionResponse | null>(null);
  const [submitError, setSubmitError] = useState('');

  // Hint unlocking state
  const [unlockingHintId, setUnlockingHintId] = useState<number | null>(null);

  const loadChallenges = useCallback(async () => {
    if (!activeEvent) return;
    setLoading(true);
    setError('');
    try {
      const [chs, cats] = await Promise.all([
        challengeService.list(activeEvent.id, {
          category: selectedCategory || undefined,
          difficulty: selectedDifficulty || undefined,
          search: search || undefined,
        }),
        categoryService.list(activeEvent.id).catch(() => []),
      ]);
      setChallenges(chs);
      setCategories(cats);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [activeEvent, selectedCategory, selectedDifficulty, search]);

  useEffect(() => {
    loadChallenges();
  }, [loadChallenges]);

  const handleOpenChallenge = (ch: Challenge) => {
    setModalChallenge(ch);
    setFlagInput('');
    setSubmitResult(null);
    setSubmitError('');
  };

  const handleSubmitFlag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalChallenge || !flagInput.trim()) return;
    setSubmitting(true);
    setSubmitResult(null);
    setSubmitError('');
    try {
      const res = await challengeService.submit(modalChallenge.id, flagInput.trim());
      setSubmitResult(res);
      if (res.result === 'correct') {
        // Mark solved locally
        setChallenges((prev) => prev.map((c) => c.id === modalChallenge.id ? { ...c, is_solved: true, solve_count: c.solve_count + 1 } : c));
        setModalChallenge((prev) => prev ? { ...prev, is_solved: true } : null);
      }
    } catch (err) {
      setSubmitError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnlockHint = async (hintId: number, cost: number) => {
    if (!modalChallenge) return;
    if (cost > 0 && !confirm(`Unlocking this hint will deduct ${cost} points from your team's score. Continue?`)) {
      return;
    }
    setUnlockingHintId(hintId);
    try {
      const res = await challengeService.unlockHint(modalChallenge.id, hintId);
      // Update local modal hints
      setModalChallenge((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          hints: prev.hints.map((h) => h.id === hintId ? { ...h, is_unlocked: true, content: res.content } : h),
        };
      });
    } catch (err) {
      alert(getErrorMessage(err));
    } finally {
      setUnlockingHintId(null);
    }
  };

  if (!activeEvent) {
    return (
      <div style={{ maxWidth: '800px', margin: 'var(--space-12) auto', textAlign: 'center', padding: 'var(--space-8)' }}>
        <h2>No Active Competition Selected</h2>
        <p style={{ color: 'var(--color-text-secondary)', marginTop: 'var(--space-2)' }}>
          Please select a competition from the dropdown in the topbar to view its challenge arena.
        </p>
      </div>
    );
  }

  // Filter client-side solved/unsolved
  const filteredChallenges = challenges.filter((c) => {
    if (!filterSolved && c.is_solved) return false;
    if (!filterUnsolved && !c.is_solved) return false;
    return true;
  });

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', padding: 'var(--space-8)' }}>
      {/* Arena Header */}
      <div className="page-header" style={{ marginBottom: 'var(--space-6)' }}>
        <div>
          <h1 className="page-header__title">Challenge Arena</h1>
          <p className="page-header__subtitle">
            Compete in {activeEvent.name} ({challenges.filter((c) => c.is_solved).length}/{challenges.length} solved)
          </p>
        </div>
      </div>

      {error && <div className="alert alert--error" style={{ marginBottom: 'var(--space-6)' }}>{error}</div>}

      {/* Filter and Category Bar */}
      <div className="card" style={{ marginBottom: 'var(--space-6)', padding: 'var(--space-5)' }}>
        {/* Category Pills */}
        <div style={{ display: 'flex', gap: 'var(--space-2)', overflowX: 'auto', paddingBottom: 'var(--space-3)', marginBottom: 'var(--space-4)', borderBottom: '1px solid var(--color-border)' }}>
          <button
            className={`cat-pill ${selectedCategory === null ? 'cat-pill--active' : ''}`}
            onClick={() => setSelectedCategory(null)}
          >
            All Categories ({challenges.length})
          </button>
          {categories.map((cat) => {
            const count = challenges.filter((c) => c.category?.id === cat.id).length;
            return (
              <button
                key={cat.id}
                className={`cat-pill ${selectedCategory === cat.id ? 'cat-pill--active' : ''}`}
                onClick={() => setSelectedCategory(selectedCategory === cat.id ? null : cat.id)}
              >
                {cat.name} ({count})
              </button>
            );
          })}
        </div>

        {/* Search & Difficulty & Status Filters */}
        <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 'var(--space-3)', flex: 1, minWidth: '280px' }}>
            <input
              type="text"
              className="form-control"
              placeholder="Search challenges..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ flex: 2 }}
            />

            <select
              className="form-control"
              value={selectedDifficulty}
              onChange={(e) => setSelectedDifficulty(e.target.value)}
              style={{ flex: 1, minWidth: '130px' }}
            >
              <option value="">All Difficulties</option>
              <option value="beginner">Beginner</option>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
              <option value="insane">Insane</option>
            </select>
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'center' }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.8125rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={filterUnsolved}
                onChange={(e) => setFilterUnsolved(e.target.checked)}
              />
              Unsolved
            </label>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.8125rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={filterSolved}
                onChange={(e) => setFilterSolved(e.target.checked)}
              />
              Solved
            </label>
          </div>
        </div>
      </div>

      {/* Challenge Grid */}
      {loading ? (
        <div className="loading-screen">
          <div className="spinner" />
          <p className="text-muted">Loading challenge arena...</p>
        </div>
      ) : filteredChallenges.length === 0 ? (
        <div className="empty-state card">
          <div className="empty-state__title">No challenges match your filters</div>
          <p>Try clearing your search query or category filters.</p>
        </div>
      ) : (
        <div className="grid grid-3">
          {filteredChallenges.map((ch) => (
            <div
              key={ch.id}
              className={`ch-card ${ch.is_solved ? 'ch-card--solved' : ''}`}
              onClick={() => handleOpenChallenge(ch)}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-3)' }}>
                  <span className={`badge diff-${ch.difficulty}`} style={{ fontSize: '0.75rem' }}>
                    {ch.difficulty.toUpperCase()}
                  </span>
                  <span style={{ fontWeight: 800, color: 'var(--color-brand)', fontSize: '1.125rem' }}>
                    {ch.current_points || ch.points} pts
                  </span>
                </div>

                <h3 style={{ fontSize: '1.0625rem', fontWeight: 700, marginBottom: 'var(--space-2)', color: 'var(--color-text-primary)' }}>
                  {ch.name}
                </h3>

                {ch.category && (
                  <span className="badge badge--blue" style={{ fontSize: '0.6875rem', marginBottom: 'var(--space-3)' }}>
                    {ch.category.name}
                  </span>
                )}
              </div>

              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                paddingTop: 'var(--space-4)', marginTop: 'var(--space-3)',
                borderTop: '1px solid var(--color-border)',
                fontSize: '0.8125rem', color: 'var(--color-text-muted)',
              }}>
                <span>{ch.solve_count} solves</span>
                <span style={{ color: 'var(--color-brand)', fontWeight: 600 }}>Solve →</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── IN-PLACE CHALLENGE MODAL ──────────────────────────────────── */}
      {modalChallenge && (
        <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) setModalChallenge(null); }}>
          <div className="modal-box">
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-4)' }}>
              <div>
                <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
                  <span className={`badge diff-${modalChallenge.difficulty}`}>
                    {modalChallenge.difficulty.toUpperCase()}
                  </span>
                  {modalChallenge.category && (
                    <span className="badge badge--blue">{modalChallenge.category.name}</span>
                  )}
                  {modalChallenge.is_solved && (
                    <span className="badge badge--green">SOLVED</span>
                  )}
                </div>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>{modalChallenge.name}</h2>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '1.375rem', fontWeight: 800, color: 'var(--color-brand)' }}>
                  {modalChallenge.current_points || modalChallenge.points} pts
                </div>
                <button
                  onClick={() => setModalChallenge(null)}
                  style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--color-text-muted)' }}
                >
                  &times;
                </button>
              </div>
            </div>

            {/* Description */}
            <div style={{
              background: 'var(--color-bg-secondary)',
              borderRadius: 'var(--radius-lg)',
              padding: 'var(--space-5)',
              marginBottom: 'var(--space-6)',
              fontSize: '0.9375rem',
              lineHeight: '1.7',
              whiteSpace: 'pre-wrap',
            }}>
              {modalChallenge.description}
            </div>

            {/* Attachments */}
            {modalChallenge.files && modalChallenge.files.length > 0 && (
              <div style={{ marginBottom: 'var(--space-6)' }}>
                <h4 style={{ fontSize: '0.875rem', fontWeight: 700, marginBottom: 'var(--space-2)', color: 'var(--color-text-muted)' }}>
                  ATTACHED FILES
                </h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                  {modalChallenge.files.map((f) => (
                    <a
                      key={f.id}
                      href={f.download_url}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn--secondary btn--sm"
                      style={{ textDecoration: 'none' }}
                    >
                      {f.original_filename} ({f.file_size ? `${(f.file_size / 1024).toFixed(1)} KB` : 'file'})
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Hints Accordion */}
            {modalChallenge.hints && modalChallenge.hints.length > 0 && (
              <div style={{ marginBottom: 'var(--space-6)' }}>
                <h4 style={{ fontSize: '0.875rem', fontWeight: 700, marginBottom: 'var(--space-2)', color: 'var(--color-text-muted)' }}>
                  HINTS
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                  {modalChallenge.hints.map((h, i) => (
                    <div key={h.id} style={{
                      padding: 'var(--space-3) var(--space-4)',
                      background: 'var(--color-bg-secondary)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border)',
                    }}>
                      {h.is_unlocked ? (
                        <div>
                          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-success)', marginBottom: '4px' }}>
                            HINT {i + 1} (UNLOCKED)
                          </div>
                          <div style={{ fontSize: '0.875rem' }}>{h.content}</div>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.8125rem' }}>
                            Hint {i + 1} ({h.cost > 0 ? `Cost: -${h.cost} pts` : 'Free'})
                          </span>
                          <button
                            className="btn btn--secondary btn--sm"
                            disabled={unlockingHintId === h.id}
                            onClick={() => handleUnlockHint(h.id, h.cost)}
                          >
                            {unlockingHintId === h.id ? 'Unlocking...' : 'Unlock Hint'}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Flag Submission Box */}
            <div className="card" style={{ background: '#ffffff', border: '2px solid var(--color-border)', padding: 'var(--space-5)' }}>
              <h4 style={{ fontSize: '0.875rem', fontWeight: 700, marginBottom: 'var(--space-3)' }}>
                SUBMIT FLAG
              </h4>

              {submitResult && (
                <div className={`alert ${submitResult.result === 'correct' ? 'alert--success' : 'alert--error'}`} style={{ marginBottom: 'var(--space-4)' }}>
                  {submitResult.message}
                </div>
              )}
              {submitError && (
                <div className="alert alert--error" style={{ marginBottom: 'var(--space-4)' }}>
                  {submitError}
                </div>
              )}

              <form onSubmit={handleSubmitFlag} style={{ display: 'flex', gap: 'var(--space-3)' }}>
                <input
                  type="text"
                  className="form-control"
                  placeholder="CTF{flag_goes_here}"
                  value={flagInput}
                  onChange={(e) => setFlagInput(e.target.value)}
                  disabled={submitting || modalChallenge.is_solved}
                  style={{ fontFamily: 'var(--font-mono)' }}
                  required
                />
                <button
                  type="submit"
                  className="btn btn--primary"
                  disabled={submitting || modalChallenge.is_solved}
                >
                  {submitting ? 'Checking...' : modalChallenge.is_solved ? 'Solved' : 'Submit Flag'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
