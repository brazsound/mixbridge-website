import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

const iconProps = {
  width: 15, height: 15, viewBox: '0 0 24 24', fill: 'none',
  stroke: 'currentColor', strokeWidth: '1.75',
  strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
  'aria-hidden': true as const,
};

const navItems = [
  {
    to: '/account',
    label: 'Dashboard',
    icon: <svg {...iconProps}><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>,
  },
  {
    to: '/account/download',
    label: 'Download',
    icon: <svg {...iconProps}><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>,
  },
  {
    to: '/account/settings',
    label: 'Account',
    icon: <svg {...iconProps}><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>,
  },
  {
    to: '/account/feedback',
    label: 'Feedback',
    icon: <svg {...iconProps}><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg>,
  },
];

export function AccountLayout() {
  const { user, signOut } = useAuth();

  return (
    <div className="min-h-screen pt-[56px]">
      {/* Page header */}
      <div style={{ borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.015)' }}>
        <div className="max-w-4xl mx-auto px-6">
          {/* User info row */}
          <div className="flex items-center justify-between pt-7 pb-5">
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-semibold shrink-0"
                style={{ background: 'var(--accent-subtle)', color: 'var(--accent)' }}
              >
                {(user?.email?.[0] ?? 'U').toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
                  {(user?.user_metadata as { full_name?: string })?.full_name || 'My Account'}
                </p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{user?.email}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void signOut()}
              className="text-xs font-medium transition-colors px-3 py-1.5 rounded-lg"
              style={{ color: 'var(--text-muted)', background: 'transparent' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)'; (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.05)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)'; (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
            >
              Sign out
            </button>
          </div>

          {/* Tab nav */}
          <nav className="flex gap-0.5 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/account'}
                className={({ isActive }) =>
                  `flex items-center gap-1.5 px-3 py-2.5 text-[13px] font-medium whitespace-nowrap border-b-2 transition-colors -mb-px ${
                    isActive
                      ? 'border-accent text-accent'
                      : 'border-transparent text-text-muted hover:text-text-secondary hover:border-white/20'
                  }`
                }
              >
                {item.icon}
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </div>

      {/* Page content */}
      <main className="max-w-4xl mx-auto px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
