import {
  Award,
  BarChart3,
  Building2,
  CalendarCheck,
  ClipboardList,
  Home,
  LogOut,
  MessageSquareQuote,
  Settings,
  Trophy,
  User as UserIcon,
  Users,
  Vote,
  type LucideIcon,
} from 'lucide-react'
import { Suspense } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { isAdmin, isStaff, useAuth } from '../lib/auth'
import { Avatar, Spinner } from './ui'

interface Item {
  to: string
  label: string
  icon: LucideIcon
}

const MAIN: Item[] = [
  { to: '/', label: 'Dashboard', icon: Home },
  { to: '/vote', label: 'Vote', icon: Vote },
  { to: '/winners', label: 'Winners', icon: Trophy },
  { to: '/leaderboard', label: 'Leaderboard', icon: BarChart3 },
  { to: '/me', label: 'My recognition', icon: UserIcon },
]

const STAFF: Item[] = [
  { to: '/admin', label: 'Overview', icon: ClipboardList },
  { to: '/admin/campaigns', label: 'Campaigns', icon: CalendarCheck },
  { to: '/admin/comments', label: 'Comments', icon: MessageSquareQuote },
  { to: '/admin/employees', label: 'Employees', icon: Users },
]

const ADMIN: Item[] = [
  { to: '/admin/departments', label: 'Departments', icon: Building2 },
  { to: '/admin/settings', label: 'Scoring & rules', icon: Settings },
  { to: '/admin/audit', label: 'Audit log', icon: Award },
]

function SideLink({ item }: { item: Item }) {
  return (
    <NavLink
      to={item.to}
      end={item.to === '/' || item.to === '/admin'}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition ${
          isActive ? 'bg-white/10 text-white' : 'text-brand-200 hover:bg-white/5 hover:text-white'
        }`
      }
    >
      <item.icon className="size-4.5" />
      {item.label}
    </NavLink>
  )
}

export default function Layout() {
  const { user, signOut } = useAuth()
  if (!user) return null
  const manage = [...(isStaff(user) ? STAFF : []), ...(isAdmin(user) ? ADMIN : [])]

  return (
    <div className="min-h-dvh lg:pl-64">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col bg-brand-950 px-4 py-6 lg:flex">
        <Brand />
        <nav className="mt-8 flex-1 space-y-1 overflow-y-auto" aria-label="Main">
          {MAIN.map((i) => (
            <SideLink key={i.to} item={i} />
          ))}
          {manage.length > 0 && (
            <>
              <div className="px-3 pt-6 pb-2 text-[11px] font-semibold uppercase tracking-wider text-brand-200/60">Manage</div>
              {manage.map((i) => (
                <SideLink key={i.to} item={i} />
              ))}
            </>
          )}
        </nav>
        <div className="mt-4 flex items-center gap-3 rounded-xl bg-white/5 p-3">
          <Avatar user={user} size={36} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-white">{user.full_name}</div>
            <div className="truncate text-xs text-brand-200 capitalize">{user.role === 'hr' ? 'HR / Management' : user.role}</div>
          </div>
          <button onClick={signOut} className="rounded-lg p-1.5 text-brand-200 hover:bg-white/10 hover:text-white" title="Sign out" aria-label="Sign out">
            <LogOut className="size-4" />
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between bg-brand-950 px-4 py-3 lg:hidden">
        <Brand />
        <button onClick={signOut} className="rounded-lg p-2 text-brand-200 hover:bg-white/10" aria-label="Sign out">
          <LogOut className="size-5" />
        </button>
      </header>
      {manage.length > 0 && (
        <nav className="flex gap-1 overflow-x-auto border-b border-slate-200 bg-white px-3 py-2 lg:hidden" aria-label="Manage">
          {manage.map((i) => (
            <NavLink
              key={i.to}
              to={i.to}
              end={i.to === '/admin'}
              className={({ isActive }) =>
                `whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold ${isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600'}`
              }
            >
              {i.label}
            </NavLink>
          ))}
        </nav>
      )}

      <main className="mx-auto max-w-6xl px-4 pt-6 pb-28 sm:px-6 lg:px-10 lg:pt-10 lg:pb-12">
        <Suspense fallback={<Spinner />}>
          <Outlet />
        </Suspense>
      </main>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden" aria-label="Main">
        {MAIN.map((i) => (
          <NavLink
            key={i.to}
            to={i.to}
            end={i.to === '/'}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold ${isActive ? 'text-brand-600' : 'text-slate-500'}`
            }
          >
            <i.icon className="size-5" />
            {i.label.replace('My recognition', 'Me')}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

function Brand() {
  return (
    <div className="flex items-center gap-2.5 px-1">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white p-1 shadow-lg shadow-black/20">
        <img src="/jms-mark.png" alt="" className="size-full object-contain" />
      </span>
      <div className="leading-tight">
        <div className="text-sm font-extrabold text-white">Employee of the Month</div>
        <div className="text-[11px] text-brand-200">Joint Medical Store</div>
      </div>
    </div>
  )
}
