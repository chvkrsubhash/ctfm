'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore, isAdmin } from '@/store/authStore';
import type { Event, Notification } from '@/types';
import { eventService, notificationService } from '@/services/api.service';

// Import Views
import OverviewView from './views/OverviewView';
import ArenaView from './views/ArenaView';
import LeaderboardView from './views/LeaderboardView';
import CompetitionsView from './views/CompetitionsView';
import TeamsView from './views/TeamsView';
import AdminStudioView from './views/AdminStudioView';
import ProfileSecurityView from './views/ProfileSecurityView';

export type DashboardView =
  | 'overview'
  | 'arena'
  | 'leaderboard'
  | 'competitions'
  | 'teams'
  | 'admin'
  | 'profile';

export default function DashboardShell() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isAuthenticated, isLoading: authLoading, logout, refreshUser } = useAuthStore();

  // Active view state
  const initialView = (searchParams.get('view') as DashboardView) || 'overview';
  const [currentView, setCurrentView] = useState<DashboardView>(initialView);
  const [adminSubTab, setAdminSubTab] = useState<'challenges' | 'events' | 'submissions' | 'users' | 'audit' | 'settings'>('challenges');

  // Active event state
  const [events, setEvents] = useState<Event[]>([]);
  const [activeEvent, setActiveEvent] = useState<Event | null>(null);

  // Notifications State
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isNotifOpen, setIsNotifOpen] = useState<boolean>(false);

  // Mobile sidebar toggle
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Sync URL parameter with view state
  const navigateTo = useCallback((view: DashboardView, adminTab?: typeof adminSubTab) => {
    setCurrentView(view);
    if (adminTab) setAdminSubTab(adminTab);
    const params = new URLSearchParams(window.location.search);
    params.set('view', view);
    router.replace(`/dashboard?${params.toString()}`, { scroll: false });
    setIsSidebarOpen(false);
  }, [router]);

  // Check auth
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, authLoading, router]);

  // Load events & default active event
  useEffect(() => {
    eventService.list(1, 100).then((res) => {
      setEvents(res.items);
      if (res.items.length > 0 && !activeEvent) {
        // Pick first live event or first event
        const liveEvent = res.items.find((e) => e.status === 'live') || res.items[0];
        setActiveEvent(liveEvent);
      }
    }).catch(() => {});
  }, [activeEvent]);

  // Load notifications
  const loadNotifications = useCallback(() => {
    notificationService.list().then((res) => {
      setNotifications(res.notifications);
      setUnreadCount(res.unread_count);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (isAuthenticated) loadNotifications();
  }, [isAuthenticated, loadNotifications]);

  const handleMarkAllRead = async () => {
    try {
      await notificationService.markAllRead();
      setUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch { /* ignore */ }
  };

  if (!user) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <p className="text-muted">Loading CTF workspace...</p>
      </div>
    );
  }

  const userIsAdmin = isAdmin(user);

  return (
    <div className="dash-shell">
      {/* ── PERSISTENT SIDEBAR NAVIGATION ───────────────────────────── */}
      <aside className={`dash-sidebar ${isSidebarOpen ? 'sidebar--open' : ''}`}>
        {/* Brand Logo */}
        <div style={{
          padding: 'var(--space-5) var(--space-6)',
          borderBottom: '1px solid var(--color-border)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-3)',
        }}>
          <div style={{
            width: '36px', height: '36px',
            background: 'linear-gradient(135deg, var(--color-brand-start), var(--color-brand-end))',
            borderRadius: 'var(--radius-md)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '0.875rem', color: '#fff', fontWeight: 800,
            letterSpacing: '0.05em',
          }}>
            CTF
          </div>
          <div>
            <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--color-text-primary)', lineHeight: 1.2 }}>
              CTF<span style={{ color: 'var(--color-brand)' }}>Platform</span>
            </div>
            <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>
              ALL-IN-ONE PORTAL
            </div>
          </div>
        </div>

        {/* Active Context Banner */}
        {activeEvent && (
          <div style={{
            padding: 'var(--space-3) var(--space-6)',
            background: 'rgba(37, 99, 235, 0.04)',
            borderBottom: '1px solid var(--color-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                Active Arena
              </div>
              <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-brand)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {activeEvent.name}
              </div>
            </div>
            <span className={`badge ${activeEvent.status === 'live' ? 'status-live' : 'badge--gray'}`} style={{ fontSize: '0.625rem', padding: '2px 6px' }}>
              {activeEvent.status.toUpperCase()}
            </span>
          </div>
        )}

        {/* Navigation Items */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-4) var(--space-3)' }}>
          {/* Main Module */}
          <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', padding: 'var(--space-2) var(--space-3)' }}>
            Workspace
          </div>

          <button
            className={`dash-nav-btn ${currentView === 'overview' ? 'dash-nav-btn--active' : ''}`}
            onClick={() => navigateTo('overview')}
          >
            <span>Overview</span>
          </button>

          <button
            className={`dash-nav-btn ${currentView === 'arena' ? 'dash-nav-btn--active' : ''}`}
            onClick={() => navigateTo('arena')}
          >
            <span style={{ flex: 1 }}>Challenge Arena</span>
            {activeEvent && (
              <span className="badge badge--blue" style={{ fontSize: '0.6875rem' }}>Arena</span>
            )}
          </button>

          <button
            className={`dash-nav-btn ${currentView === 'leaderboard' ? 'dash-nav-btn--active' : ''}`}
            onClick={() => navigateTo('leaderboard')}
          >
            <span>Leaderboard</span>
          </button>

          <button
            className={`dash-nav-btn ${currentView === 'teams' ? 'dash-nav-btn--active' : ''}`}
            onClick={() => navigateTo('teams')}
          >
            <span>Team Roster</span>
          </button>

          <button
            className={`dash-nav-btn ${currentView === 'competitions' ? 'dash-nav-btn--active' : ''}`}
            onClick={() => navigateTo('competitions')}
          >
            <span>Competitions</span>
          </button>

          {/* Admin Section (Only for Admins/Authors) */}
          {userIsAdmin && (
            <div style={{ marginTop: 'var(--space-4)' }}>
              <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--color-brand)', textTransform: 'uppercase', letterSpacing: '0.05em', padding: 'var(--space-2) var(--space-3)' }}>
                Admin Studio
              </div>

              <button
                className={`dash-nav-btn ${currentView === 'admin' && adminSubTab === 'challenges' ? 'dash-nav-btn--active' : ''}`}
                onClick={() => navigateTo('admin', 'challenges')}
              >
                <span>Manage Challenges</span>
              </button>

              <button
                className={`dash-nav-btn ${currentView === 'admin' && adminSubTab === 'events' ? 'dash-nav-btn--active' : ''}`}
                onClick={() => navigateTo('admin', 'events')}
              >
                <span>Manage Events</span>
              </button>

              <button
                className={`dash-nav-btn ${currentView === 'admin' && adminSubTab === 'submissions' ? 'dash-nav-btn--active' : ''}`}
                onClick={() => navigateTo('admin', 'submissions')}
              >
                <span>Live Submissions</span>
              </button>

              <button
                className={`dash-nav-btn ${currentView === 'admin' && adminSubTab === 'users' ? 'dash-nav-btn--active' : ''}`}
                onClick={() => navigateTo('admin', 'users')}
              >
                <span>User Accounts</span>
              </button>

              <button
                className={`dash-nav-btn ${currentView === 'admin' && adminSubTab === 'settings' ? 'dash-nav-btn--active' : ''}`}
                onClick={() => navigateTo('admin', 'settings')}
              >
                <span>Platform Settings</span>
              </button>
            </div>
          )}

          {/* Account Section */}
          <div style={{ marginTop: 'var(--space-4)' }}>
            <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', padding: 'var(--space-2) var(--space-3)' }}>
              Settings
            </div>

            <button
              className={`dash-nav-btn ${currentView === 'profile' ? 'dash-nav-btn--active' : ''}`}
              onClick={() => navigateTo('profile')}
            >
              <span>Profile & 2FA</span>
            </button>
          </div>
        </div>

        {/* Sidebar Footer User Card */}
        <div style={{
          padding: 'var(--space-4) var(--space-4)',
          borderTop: '1px solid var(--color-border)',
          background: 'var(--color-bg-secondary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', minWidth: 0 }}>
            <div style={{
              width: '34px', height: '34px', borderRadius: '50%',
              background: 'var(--color-brand)', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 700, fontSize: '0.875rem', flexShrink: 0,
            }}>
              {user.username[0].toUpperCase()}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user.display_name || user.username}
              </div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)' }}>
                {userIsAdmin ? 'Administrator' : 'Competitor'}
              </div>
            </div>
          </div>

          <button
            onClick={() => logout()}
            title="Sign out"
            style={{
              background: 'none', border: '1px solid var(--color-border)',
              cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)',
              padding: '5px 10px', borderRadius: '4px',
            }}
          >
            Sign Out
          </button>
        </div>
      </aside>

      {/* ── MAIN DASHBOARD CONTAINER ────────────────────────────────── */}
      <div className="dash-main">
        {/* ── DASHBOARD TOPBAR ───────────────────────────────────────── */}
        <header className="dash-topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              style={{ display: 'none', background: 'none', border: 'none', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer' }}
            >
              Menu
            </button>

            {/* Breadcrumb Title */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <span style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>Dashboard</span>
              <span style={{ color: 'var(--color-text-muted)' }}>/</span>
              <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text-primary)', textTransform: 'capitalize' }}>
                {currentView}
              </span>
            </div>
          </div>

          {/* Topbar Right Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
            {/* Competition Selector Dropdown */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>
                EVENT:
              </span>
              <select
                className="form-control"
                value={activeEvent?.id || ''}
                onChange={(e) => {
                  const ev = events.find((item) => item.id === e.target.value);
                  if (ev) setActiveEvent(ev);
                }}
                style={{
                  height: '34px',
                  padding: '0 var(--space-3)',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  maxWidth: '220px',
                }}
              >
                {events.map((ev) => (
                  <option key={ev.id} value={ev.id}>{ev.name} ({ev.status})</option>
                ))}
              </select>
            </div>

            {/* Notification Bell */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setIsNotifOpen(!isNotifOpen)}
                style={{
                  position: 'relative', background: 'none', border: 'none',
                  cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text-secondary)',
                  padding: '6px 10px',
                }}
                title="Notifications"
              >
                Alerts
                {unreadCount > 0 && (
                  <span style={{
                    position: 'absolute', top: 0, right: 0,
                    width: '18px', height: '18px', borderRadius: '50%',
                    background: '#dc2626', color: '#fff', fontSize: '0.625rem',
                    fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* Notification Popover */}
              {isNotifOpen && (
                <div style={{
                  position: 'absolute', right: 0, top: '44px', width: '340px',
                  background: '#ffffff', border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)',
                  zIndex: 200, padding: 'var(--space-4)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
                    <strong style={{ fontSize: '0.875rem' }}>Notifications</strong>
                    {unreadCount > 0 && (
                      <button
                        onClick={handleMarkAllRead}
                        style={{ background: 'none', border: 'none', color: 'var(--color-brand)', fontSize: '0.75rem', cursor: 'pointer' }}
                      >
                        Mark all read
                      </button>
                    )}
                  </div>

                  {notifications.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 'var(--space-4) 0', color: 'var(--color-text-muted)', fontSize: '0.8125rem' }}>
                      No notifications
                    </div>
                  ) : (
                    <div style={{ maxHeight: '280px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                      {notifications.map((n) => (
                        <div key={n.id} style={{
                          padding: 'var(--space-2) var(--space-3)',
                          background: n.is_read ? 'transparent' : 'rgba(37, 99, 235, 0.05)',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '0.8125rem',
                        }}>
                          <div style={{ fontWeight: 600 }}>{n.title}</div>
                          <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.75rem' }}>{n.message}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </header>

        {/* ── ACTIVE VIEW CONTENT RENDERER ──────────────────────────── */}
        <main style={{ flex: 1 }}>
          {currentView === 'overview' && (
            <OverviewView
              user={user}
              activeEvent={activeEvent}
              onNavigate={(v) => navigateTo(v as DashboardView)}
            />
          )}

          {currentView === 'arena' && (
            <ArenaView activeEvent={activeEvent} />
          )}

          {currentView === 'leaderboard' && (
            <LeaderboardView activeEvent={activeEvent} />
          )}

          {currentView === 'competitions' && (
            <CompetitionsView
              onSelectEvent={(ev) => {
                setActiveEvent(ev);
                navigateTo('arena');
              }}
              activeEventId={activeEvent?.id}
            />
          )}

          {currentView === 'teams' && (
            <TeamsView activeEvent={activeEvent} user={user} />
          )}

          {currentView === 'admin' && (
            <AdminStudioView initialSubTab={adminSubTab} />
          )}

          {currentView === 'profile' && (
            <ProfileSecurityView user={user} onUserUpdated={refreshUser} />
          )}
        </main>
      </div>
    </div>
  );
}
