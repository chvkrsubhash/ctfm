'use client';

import { useEffect, useState, useCallback } from 'react';
import type { Event, Team, TeamDetail, User } from '@/types';
import { teamService } from '@/services/api.service';
import { getErrorMessage } from '@/lib/api';

interface TeamsViewProps {
  activeEvent: Event | null;
  user: User;
}

export default function TeamsView({ activeEvent, user }: TeamsViewProps) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [myTeam, setMyTeam] = useState<TeamDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Create Team Form
  const [isCreating, setIsCreating] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamDesc, setNewTeamDesc] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [creatingTeam, setCreatingTeam] = useState(false);

  // Invite Token Form
  const [inviteUsername, setInviteUsername] = useState('');
  const [inviting, setInviting] = useState(false);

  // Join by Token Form
  const [joinToken, setJoinToken] = useState('');
  const [joining, setJoining] = useState(false);

  const loadTeams = useCallback(async () => {
    if (!activeEvent) return;
    setLoading(true);
    setError('');
    try {
      const list = await teamService.list(activeEvent.id);
      setTeams(list);

      // Check if user is in any team in this list
      const matched = list.find((t) => t.name.toLowerCase() === user.username.toLowerCase());
      if (matched) {
        setMyTeam({ ...matched, members: [{ user: { id: user.id, username: user.username, display_name: user.display_name, avatar_url: user.avatar_url, country: user.country, created_at: user.created_at }, role: 'owner', joined_at: new Date().toISOString() }] });
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [activeEvent, user]);

  useEffect(() => {
    loadTeams();
  }, [loadTeams]);

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeEvent || !newTeamName.trim()) return;
    setCreatingTeam(true);
    setError('');
    try {
      const created = await teamService.create(activeEvent.id, {
        name: newTeamName.trim(),
        description: newTeamDesc.trim() || undefined,
        is_private: isPrivate,
      });
      setSuccessMsg(`Team "${created.name}" formed successfully!`);
      setIsCreating(false);
      setNewTeamName('');
      setNewTeamDesc('');
      loadTeams();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setCreatingTeam(false);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeEvent || !myTeam || !inviteUsername.trim()) return;
    setInviting(true);
    setError('');
    try {
      const res = await teamService.invite(activeEvent.id, myTeam.id, inviteUsername.trim());
      setSuccessMsg(res.message || `Invitation sent to @${inviteUsername}!`);
      setInviteUsername('');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setInviting(false);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeEvent || !joinToken.trim()) return;
    setJoining(true);
    setError('');
    try {
      const res = await teamService.acceptInvitation(activeEvent.id, joinToken.trim());
      setSuccessMsg(res.message || 'Joined team successfully!');
      setJoinToken('');
      loadTeams();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setJoining(false);
    }
  };

  if (!activeEvent) {
    return (
      <div style={{ maxWidth: '800px', margin: 'var(--space-12) auto', textAlign: 'center', padding: 'var(--space-8)' }}>
        <h2>Select an Event to View Teams</h2>
        <p style={{ color: 'var(--color-text-secondary)', marginTop: 'var(--space-2)' }}>
          Please select an active competition from the topbar to manage your team and teammates.
        </p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', padding: 'var(--space-8)' }}>
      <div className="page-header">
        <div>
          <h1 className="page-header__title">Team Management</h1>
          <p className="page-header__subtitle">
            Teams competing in {activeEvent.name} (Max size: {activeEvent.team_size} members)
          </p>
        </div>
        {!myTeam && (
          <button className="btn btn--primary" onClick={() => setIsCreating(true)}>
            + Create a Team
          </button>
        )}
      </div>

      {error && <div className="alert alert--error" style={{ marginBottom: 'var(--space-4)' }}>{error}</div>}
      {successMsg && (
        <div className="alert alert--success" style={{ marginBottom: 'var(--space-4)', display: 'flex', justifyContent: 'space-between' }}>
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg('')} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>&times;</button>
        </div>
      )}

      {/* If user already has a team */}
      {myTeam ? (
        <div className="card" style={{ marginBottom: 'var(--space-8)', border: '2px solid var(--color-brand)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-4)' }}>
            <div>
              <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
                <span className="badge badge--green">YOUR TEAM</span>
                {myTeam.is_private && <span className="badge badge--gray">Private</span>}
              </div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>{myTeam.name}</h2>
              {myTeam.description && (
                <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9375rem', marginTop: 'var(--space-2)' }}>
                  {myTeam.description}
                </p>
              )}
            </div>
          </div>

          <h3 style={{ fontSize: '1rem', marginBottom: 'var(--space-3)' }}>Team Roster</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', marginBottom: 'var(--space-6)' }}>
            {myTeam.members?.map((m) => (
              <div key={m.user.id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: 'var(--space-3) var(--space-4)', background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-md)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--color-brand)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                    {m.user.username[0].toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600 }}>{m.user.display_name || m.user.username}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>@{m.user.username}</div>
                  </div>
                </div>
                <span className={`badge ${m.role === 'owner' ? 'badge--blue' : 'badge--gray'}`}>
                  {m.role.toUpperCase()}
                </span>
              </div>
            ))}
          </div>

          {/* Invite Teammate */}
          <div style={{ background: 'var(--color-bg-secondary)', padding: 'var(--space-4)', borderRadius: 'var(--radius-md)' }}>
            <h4 style={{ fontSize: '0.875rem', fontWeight: 700, marginBottom: 'var(--space-2)' }}>Invite Teammate</h4>
            <form onSubmit={handleInvite} style={{ display: 'flex', gap: 'var(--space-3)' }}>
              <input
                type="text"
                className="form-control"
                placeholder="Enter username to invite..."
                value={inviteUsername}
                onChange={(e) => setInviteUsername(e.target.value)}
                required
              />
              <button type="submit" className="btn btn--primary btn--sm" disabled={inviting}>
                {inviting ? 'Sending...' : 'Send Invite'}
              </button>
            </form>
          </div>
        </div>
      ) : (
        /* User has no team: Show Join by Code Box */
        <div className="card" style={{ marginBottom: 'var(--space-8)', background: 'var(--color-bg-secondary)', padding: 'var(--space-6)' }}>
          <h3 style={{ fontSize: '1.125rem', marginBottom: 'var(--space-2)' }}>Join an Existing Team</h3>
          <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-4)' }}>
            Received an invite token or team code from a teammate? Enter it below to join their roster.
          </p>
          <form onSubmit={handleJoin} style={{ display: 'flex', gap: 'var(--space-3)', maxWidth: '500px' }}>
            <input
              type="text"
              className="form-control"
              placeholder="Paste invitation token here..."
              value={joinToken}
              onChange={(e) => setJoinToken(e.target.value)}
              required
            />
            <button type="submit" className="btn btn--secondary" disabled={joining}>
              {joining ? 'Joining...' : 'Join Team'}
            </button>
          </form>
        </div>
      )}

      {/* ── CREATE TEAM MODAL ─────────────────────────────────────────── */}
      {isCreating && (
        <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) setIsCreating(false); }}>
          <div className="modal-box" style={{ maxWidth: '500px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
              <h2>Create a Team</h2>
              <button onClick={() => setIsCreating(false)} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer' }}>&times;</button>
            </div>

            <form onSubmit={handleCreateTeam}>
              <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
                <label className="form-label">Team Name *</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. CyberKnights"
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
                <label className="form-label">Description / Bio (Optional)</label>
                <textarea
                  className="form-control"
                  rows={3}
                  placeholder="Tell others about your team..."
                  value={newTeamDesc}
                  onChange={(e) => setNewTeamDesc(e.target.value)}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 'var(--space-6)' }}>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.875rem' }}>
                  <input
                    type="checkbox"
                    checked={isPrivate}
                    onChange={(e) => setIsPrivate(e.target.checked)}
                  />
                  Private team (Invite-only)
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)' }}>
                <button type="button" className="btn btn--secondary" onClick={() => setIsCreating(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn--primary" disabled={creatingTeam}>
                  {creatingTeam ? 'Creating...' : 'Form Team'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Directory of Teams in Event */}
      <h2 style={{ fontSize: '1.25rem', marginBottom: 'var(--space-4)' }}>All Teams in {activeEvent.name}</h2>
      {loading ? (
        <div className="loading-screen">
          <div className="spinner" />
          <p className="text-muted">Loading teams...</p>
        </div>
      ) : teams.length === 0 ? (
        <div className="empty-state card">
          <div className="empty-state__title">No teams registered yet</div>
          <p>Create the first team for this competition above!</p>
        </div>
      ) : (
        <div className="grid grid-3">
          {teams.map((t) => (
            <div key={t.id} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
                <h3 style={{ fontSize: '1.125rem' }}>{t.name}</h3>
                {t.is_private && <span className="badge badge--gray" style={{ fontSize: '0.6875rem' }}>Private</span>}
              </div>
              {t.description && (
                <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-3)' }}>
                  {t.description}
                </p>
              )}
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', borderTop: '1px solid var(--color-border)', paddingTop: 'var(--space-3)' }}>
                Country: {t.country || 'International'}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
