import { Loader2, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { criterionColor, initials } from '../lib/format'
import type { BreakdownItem, UserBrief } from '../lib/types'

const AVATAR_TONES = [
  'bg-brand-100 text-brand-800',
  'bg-amber-100 text-amber-800',
  'bg-emerald-100 text-emerald-800',
  'bg-sky-100 text-sky-800',
  'bg-rose-100 text-rose-800',
  'bg-violet-100 text-violet-800',
]

export function Avatar({ user, size = 40, ring = false }: { user: Pick<UserBrief, 'id' | 'full_name' | 'photo_url'>; size?: number; ring?: boolean }) {
  const cls = `shrink-0 rounded-full ${ring ? 'ring-4 ring-gold-400 ring-offset-2 ring-offset-white' : ''}`
  if (user.photo_url) {
    return <img src={user.photo_url} alt="" width={size} height={size} className={`${cls} object-cover`} style={{ width: size, height: size }} />
  }
  return (
    <span
      aria-hidden
      className={`${cls} ${AVATAR_TONES[user.id % AVATAR_TONES.length]} inline-flex items-center justify-center font-bold`}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {initials(user.full_name)}
    </span>
  )
}

export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-slate-500" role="status">
      <Loader2 className="size-5 animate-spin" /> {label}
    </div>
  )
}

export function EmptyState({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center px-6 py-14 text-center">
      <div className="mb-4 rounded-2xl bg-brand-50 p-3 text-brand-600">
        <Icon className="size-7" />
      </div>
      <h3 className="text-lg font-semibold">{title}</h3>
      {children && <div className="mt-1 max-w-md text-sm text-slate-500">{children}</div>}
    </div>
  )
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-extrabold sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

export function StatCard({ label, value, hint, icon: Icon, tone = 'brand' }: { label: string; value: ReactNode; hint?: ReactNode; icon: LucideIcon; tone?: 'brand' | 'gold' | 'emerald' | 'sky' }) {
  const tones = {
    brand: 'bg-brand-50 text-brand-600',
    gold: 'bg-gold-100 text-gold-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    sky: 'bg-sky-50 text-sky-600',
  }
  return (
    <div className="card p-5">
      <div className="flex items-center gap-3">
        <span className={`rounded-xl p-2 ${tones[tone]}`}>
          <Icon className="size-5" />
        </span>
        <span className="text-sm font-medium text-slate-500">{label}</span>
      </div>
      <div className="mt-3 text-3xl font-extrabold text-slate-900 tabular-nums">{value}</div>
      {hint && <div className="mt-1 text-xs text-slate-500">{hint}</div>}
    </div>
  )
}

/** Circular score gauge out of 100 */
export function ScoreRing({ value, size = 120, stroke = 10, label = 'score' }: { value: number; size?: number; stroke?: number; label?: string }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const pct = Math.max(0, Math.min(100, value)) / 100
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={stroke} className="text-slate-200" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          stroke="url(#ringGrad)"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          style={{ transition: 'stroke-dashoffset 0.8s ease-out' }}
        />
        <defs>
          <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--color-gold-400)" />
            <stop offset="100%" stopColor="var(--color-gold-600)" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute text-center">
        <div className="font-extrabold text-slate-900 tabular-nums" style={{ fontSize: size * 0.24 }}>
          {value.toFixed(1)}
        </div>
        <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</div>
      </div>
    </div>
  )
}

/** Per-criterion bars: what share of the max rating they earned, with the weight shown */
export function Breakdown({ items, compact = false }: { items: BreakdownItem[]; compact?: boolean }) {
  return (
    <ul className={compact ? 'space-y-2' : 'space-y-3.5'}>
      {items.map((b) => (
        <li key={b.key}>
          <div className="mb-1 flex items-baseline justify-between text-sm">
            <span className="font-medium text-slate-700">
              {b.name} <span className="text-xs font-normal text-slate-400">· {b.weight}%</span>
            </span>
            <span className="font-semibold tabular-nums text-slate-900">{b.percent.toFixed(0)}%</span>
          </div>
          <div className={`overflow-hidden rounded-full bg-slate-100 ${compact ? 'h-1.5' : 'h-2.5'}`}>
            <div className="h-full rounded-full" style={{ width: `${b.percent}%`, background: criterionColor(b.key), transition: 'width 0.8s ease-out' }} />
          </div>
        </li>
      ))}
    </ul>
  )
}

export function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    draft: 'bg-slate-100 text-slate-600',
    scheduled: 'bg-sky-50 text-sky-700',
    open: 'bg-emerald-50 text-emerald-700',
    closed: 'bg-amber-50 text-amber-700',
    published: 'bg-brand-50 text-brand-700',
  }
  const text: Record<string, string> = {
    draft: 'Draft',
    scheduled: 'Opens soon',
    open: 'Voting open',
    closed: 'Voting closed',
    published: 'Winner announced',
  }
  return (
    <span className={`pill ${map[status] ?? map.draft}`}>
      {status === 'open' && <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" />}
      {text[status] ?? status}
    </span>
  )
}

export function ErrorNote({ error }: { error: unknown }) {
  if (!error) return null
  return (
    <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
      {error instanceof Error ? error.message : 'Something went wrong.'}
    </div>
  )
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-4 sm:items-center" onClick={onClose}>
      <div role="dialog" aria-modal aria-label={title} className="card w-full max-w-lg animate-rise p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-4 text-lg font-bold">{title}</h2>
        {children}
      </div>
    </div>
  )
}
