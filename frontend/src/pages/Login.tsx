import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Avatar, ErrorNote } from '../components/ui'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import type { User } from '../lib/types'

function MicrosoftLogo() {
  return (
    <svg viewBox="0 0 21 21" className="size-5" aria-hidden>
      <rect x="1" y="1" width="9" height="9" fill="#f25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
      <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
      <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
    </svg>
  )
}

export default function Login() {
  const { user, config, signInWithMicrosoft, devSignIn } = useAuth()
  const [error, setError] = useState<unknown>(null)
  const [busy, setBusy] = useState(false)
  const devUsers = useQuery({
    queryKey: ['dev-users'],
    queryFn: () => api.get<User[]>('/api/auth/dev-users'),
    enabled: !!config?.dev_mode,
  })

  if (user) return <Navigate to="/" replace />

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    setError(null)
    try {
      await fn()
    } catch (e) {
      setError(e)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-brand-950 px-4 py-12">
      <div aria-hidden className="pointer-events-none absolute -top-40 left-1/2 size-[640px] -translate-x-1/2 rounded-full bg-brand-600/30 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-40 -right-20 size-[420px] rounded-full bg-gold-500/20 blur-3xl" />

      <div className="relative w-full max-w-md animate-rise">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-6 w-fit rounded-2xl bg-white px-6 py-4 shadow-xl shadow-black/30">
            <img src="/jms-logo.png" alt="JMS Joint Medical Store" className="h-16 w-auto sm:h-20" />
          </div>
          <h1 className="text-3xl font-extrabold text-white sm:text-4xl">Employee of the Month</h1>
          <p className="mt-2 text-brand-200">Recognizing excellence together</p>
        </div>

        <div className="card space-y-5 p-6 sm:p-8">
          <button className="btn w-full border border-slate-300 bg-white py-3 text-base text-slate-800 hover:bg-slate-50" disabled={busy} onClick={() => run(signInWithMicrosoft)}>
            <MicrosoftLogo /> Sign in with Microsoft 365
          </button>
          <p className="text-center text-xs text-slate-500">Use your organizational account. We never see or store your password.</p>
          <ErrorNote error={error} />

          {config?.dev_mode && (
            <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50 p-4">
              <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-amber-700">Development sign-in</div>
              <div className="max-h-64 space-y-1 overflow-y-auto">
                {devUsers.data?.map((u) => (
                  <button
                    key={u.id}
                    disabled={busy}
                    onClick={() => run(() => devSignIn(u.email))}
                    className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-amber-100"
                  >
                    <Avatar user={u} size={28} />
                    <span className="flex-1 truncate font-medium">{u.full_name}</span>
                    {u.role !== 'employee' && <span className="pill bg-white text-amber-700">{u.role === 'hr' ? 'HR' : 'Admin'}</span>}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
