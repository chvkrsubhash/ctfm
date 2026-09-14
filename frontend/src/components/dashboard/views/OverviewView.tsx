'use client';

import { useEffect, useState } from 'react';
import type { User, Event, Announcement, LeaderboardEntry, Challenge } from '@/types';
import { announcementService, leaderboardService, challengeService } from '@/services/api.service';
import { formatDate } from '@/lib/api';

interface OverviewViewProps {
  user: User;
  activeEvent: Event | null;
  onNavigate: (view: string) => void;
}

export default function OverviewView({ user, activeEvent, onNavigate }: OverviewViewProps) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [myRank, setMyRank] = useState<number | null>(null);
  const [myScore, setMyScore] = useState<number>(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!activeEvent) return;
    setLoading(true);
    Promise.all([
      announcementService.list(activeEvent.id).catch(() => []),
      challengeService.list(activeEvent.id).catch(() => []),
      leaderboardService.get(activeEvent.id).catch(() => null),
    ]).then(([anns, chs, lb]) => {
      setAnnouncements(anns);
      setChallenges(chs);
      if (lb && lb.entries) {
        // Find user team in leaderboard
        const myEntry = lb.entries.find((e: LeaderboardEntry) =>
          e.team_name?.toLowerCase().includes(user.username.toLowerCase())
        );
        if (myEntry) {
          setMyRank(myEntry.rank);
          setMyScore(myEntry.total_points);
        }
      }
    }).finally(() => setLoading(false));
  }, [activeEvent, user]);

  const solvedCount = challenges.filter((c) => c.is_solved).length;
  const totalPointsAvailable = challenges.reduce((acc, c) => acc + c.points, 0);

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: 'var(--space-8)' }}>
      {/* Welcome Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #ffffff 0%, #f1f5f9 100%)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-xl)',
        padding: 'var(--space-8)',
        marginBottom: 'var(--space-8)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 'var(--space-6)',
        boxShadow: 'var(--shadow-sm)',
      }}>
        <div>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            background: 'rgba(37, 99, 235, 0.08)',
            border: '1px solid rgba(37, 99, 235, 0.2)',
            borderRadius: 'var(--radius-full)',
            padding: '4px 12px',
            fontSize: '0.75rem',
            fontWeight: 600,
            color: 'var(--color-brand)',
            marginBottom: 'var(--space-3)',
          }}>
            Welcome back, {user.display_name || user.username}
          </div>
          <h1 style={{ fontSize: 'clamp(1.5rem, 3vw, 2.25rem)', fontWeight: 800, marginBottom: 'var(--space-2)' }}>
            {activeEvent ? activeEvent.name : 'Select a CTF Event to Begin'}
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', maxWidth: '600px', fontSize: '0.9375rem' }}>
            {activeEvent?.description || 'Pick an active competition from the topbar menu to browse challenges, join teams, and submit flags.'}
          </p>
        </div>

        {activeEvent && (
          <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
            <button className="btn btn--primary" onClick={() => onNavigate('arena')}>
              Enter Challenge Arena
            </button>
            <button className="btn btn--secondary" onClick={() => onNavigate('leaderboard')}>
              View Scoreboard
            </button>
          </div>
        )}
      </div>

      {/* Metrics Row */}
      <div className="grid grid-4" style={{ marginBottom: 'var(--space-8)' }}>
        <div className="stat-card">
          <div className="stat-card__icon" style={{ background: 'rgba(37, 99, 235, 0.1)', color: 'var(--color-brand)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
          </div>
          <div className="stat-card__value">
            {solvedCount} <span style={{ fontSize: '1rem', color: 'var(--color-text-muted)' }}>/ {challenges.length}</span>
          </div>
          <div className="stat-card__label">Challenges Solved</div>
        </div>

        <div className="stat-card">
          <div className="stat-card__icon" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
          </div>
          <div className="stat-card__value">{myScore} pts</div>
          <div className="stat-card__label">Your Current Score</div>
        </div>

        <div className="stat-card">
          <div className="stat-card__icon" style={{ background: 'rgba(217, 119, 6, 0.1)', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.45 1-1 1H7v4h10v-4h-2c-.55 0-1-.45-1-1v-2.34c3-.5 5-3.04 5-6.66V4H5v4c0 3.62 2 6.16 5 6.66z"/></svg>
          </div>
          <div className="stat-card__value">{myRank ? `#${myRank}` : '—'}</div>
          <div className="stat-card__label">Global Rank</div>
        </div>

        <div className="stat-card">
          <div className="stat-card__icon" style={{ background: 'rgba(124, 58, 237, 0.1)', color: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>
          </div>
          <div className="stat-card__value">{totalPointsAvailable} pts</div>
          <div className="stat-card__label">Total Pool Points</div>
        </div>
      </div>

      {/* 2-Column Section: Announcements & Quick Navigation */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 'var(--space-6)' }}>
        {/* Announcements */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
            <h2 style={{ fontSize: '1.125rem' }}>Event Announcements</h2>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{announcements.length} updates</span>
          </div>

          {announcements.length === 0 ? (
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
              No announcements published yet for this event.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {announcements.map((a) => (
                <div key={a.id} style={{
                  padding: 'var(--space-3) var(--space-4)',
                  background: 'var(--color-bg-secondary)',
                  borderRadius: 'var(--radius-md)',
                  borderLeft: a.is_pinned ? '3px solid var(--color-brand)' : '3px solid var(--color-border)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <strong style={{ fontSize: '0.875rem', color: 'var(--color-text-primary)' }}>
                      {a.is_pinned && <span className="badge badge--blue" style={{ fontSize: '0.65rem', marginRight: '6px' }}>PINNED</span>}
                      {a.title}
                    </strong>
                    <span style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)' }}>{formatDate(a.created_at)}</span>
                  </div>
                  <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', margin: 0 }}>{a.content}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Launchpad */}
        <div className="card">
          <h2 style={{ fontSize: '1.125rem', marginBottom: 'var(--space-4)' }}>Quick Launchpad</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <button
              onClick={() => onNavigate('arena')}
              className="btn btn--secondary"
              style={{ justifyContent: 'flex-start', padding: 'var(--space-4)', width: '100%' }}
            >
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontWeight: 600 }}>Solve Challenges</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Browse Web, Crypto, Pwn, Forensics tasks</div>
              </div>
            </button>

            <button
              onClick={() => onNavigate('teams')}
              className="btn btn--secondary"
              style={{ justifyContent: 'flex-start', padding: 'var(--space-4)', width: '100%' }}
            >
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontWeight: 600 }}>Team Roster & Invites</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Join a team or invite teammates via token</div>
              </div>
            </button>

            <button
              onClick={() => onNavigate('leaderboard')}
              className="btn btn--secondary"
              style={{ justifyContent: 'flex-start', padding: 'var(--space-4)', width: '100%' }}
            >
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontWeight: 600 }}>Live Scoreboard</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Track team standings in real-time</div>
              </div>
            </button>

            <button
              onClick={() => onNavigate('competitions')}
              className="btn btn--secondary"
              style={{ justifyContent: 'flex-start', padding: 'var(--space-4)', width: '100%' }}
            >
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontWeight: 600 }}>All Competitions</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Register for other active or upcoming CTFs</div>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
