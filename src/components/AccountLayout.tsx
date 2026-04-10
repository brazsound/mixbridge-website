import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface SidebarLink {
  to: string;
  label: string;
  icon: React.ReactNode;
}

const sectionClass = 'mb-5';
const headingClass = 'text-[10px] font-semibold uppercase tracking-widest text-text-muted px-3 mb-2';

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${
    isActive
      ? 'bg-accent/10 text-accent'
      : 'text-text-muted hover:bg-white/[0.04] hover:text-text-secondary'
  }`;

const iconProps = { width: 15, height: 15, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '1.75', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true as const };

const overviewLinks: SidebarLink[] = [
  {
    to: '/account',
    label: 'Dashboard',
    icon: <svg {...iconProps}><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>,
  },
];

const resourceLinks: SidebarLink[] = [
  {
    to: '/account/download',
    label: 'Download',
    icon: <svg {...iconProps}><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>,
  },
  {
    to: '/account/feedback',
    label: 'Feedback',
    icon: <svg {...iconProps}><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg>,
  },
];

const planLinks: SidebarLink[] = [
  {
    to: '/account/subscription',
    label: 'Subscription',
    icon: <svg {...iconProps}><rect x="1" y="4" width="22" height="16" rx="2" /><line x1="1" y1="10" x2="23" y2="10" /></svg>,
  },
  {
    to: '/account/devices',
    label: 'Devices',
    icon: <svg {...iconProps}><rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" /></svg>,
  },
];

const settingsLinks: SidebarLink[] = [
  {
    to: '/account/settings',
    label: 'Account',
    icon: <svg {...iconProps}><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>,
  },
];

function SidebarSection({ heading, links }: { heading: string; links: SidebarLink[] }) {
  return (
    <div className={sectionClass}>
      <p className={headingClass}>{heading}</p>
      <nav className="space-y-0.5">
        {links.map((link) => (
          <NavLink key={link.to} to={link.to} end={link.to === '/account'} className={linkClass}>
            {link.icon}
            {link.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

export function AccountLayout() {
  const { user, signOut } = useAuth();

  return (
    <div className="pt-[56px] flex min-h-screen">
      <aside className="hidden md:flex flex-col w-56 shrink-0 border-r px-3 py-5 sticky top-[56px] h-[calc(100vh-56px)] overflow-y-auto" style={{ borderColor: 'var(--border)', background: 'rgba(255,255,255,0.015)' }}>
        <div className="flex items-center gap-2.5 px-3 mb-5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-medium shrink-0" style={{ background: 'var(--accent-subtle)', color: 'var(--accent)' }}>
            {(user?.email?.[0] ?? 'U').toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-text truncate">
              {(user?.user_metadata as { full_name?: string })?.full_name || user?.email || 'User'}
            </p>
          </div>
        </div>

        <SidebarSection heading="Overview" links={overviewLinks} />
        <SidebarSection heading="Resources" links={resourceLinks} />
        <SidebarSection heading="Plan" links={planLinks} />
        <SidebarSection heading="Settings" links={settingsLinks} />

        <div className="mt-auto pt-4" style={{ borderTop: '1px solid var(--border)' }}>
          <button
            type="button"
            onClick={() => void signOut()}
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium text-red-400/80 hover:bg-red-500/8 hover:text-red-400 transition-colors w-full"
          >
            <svg {...iconProps} stroke="currentColor">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Sign out
          </button>
        </div>
      </aside>

      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t px-2 py-1.5 flex justify-around" style={{ borderColor: 'var(--border)', background: 'rgba(10,10,15,0.92)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}>
        {[...overviewLinks, ...resourceLinks.slice(0, 1), ...planLinks, ...settingsLinks].map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.to === '/account'}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg text-[10px] transition-colors ${isActive ? 'text-accent' : 'text-text-muted'}`
            }
          >
            {link.icon}
            {link.label}
          </NavLink>
        ))}
      </div>

      <main className="flex-1 px-6 py-8 pb-24 md:pb-8 max-w-3xl">
        <Outlet />
      </main>
    </div>
  );
}
