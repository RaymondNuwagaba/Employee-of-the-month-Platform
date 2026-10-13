export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export const monthName = (m: number) => MONTHS[m - 1]
export const monthShort = (m: number) => MONTHS[m - 1].slice(0, 3)

export const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })

export const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

export const score = (n: number | null | undefined) => (n == null ? '—' : n.toFixed(1))

export function timeLeft(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now()
  if (ms <= 0) return 'Voting has closed'
  const days = Math.floor(ms / 86_400_000)
  const hours = Math.floor((ms % 86_400_000) / 3_600_000)
  if (days >= 2) return `${days} days left to vote`
  if (days === 1) return `1 day ${hours}h left to vote`
  if (hours >= 1) return `${hours} hours left to vote`
  return 'Less than an hour left!'
}

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('')

/** Datetime-local input value in the browser's timezone */
export function toLocalInput(iso: string | Date): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export const CRITERION_COLORS: Record<string, string> = {
  timeliness: 'var(--color-crit-timeliness)',
  supporting: 'var(--color-crit-supporting)',
  interpersonal: 'var(--color-crit-interpersonal)',
  innovation: 'var(--color-crit-innovation)',
}

export const criterionColor = (key: string) => CRITERION_COLORS[key] ?? 'var(--color-brand-500)'
