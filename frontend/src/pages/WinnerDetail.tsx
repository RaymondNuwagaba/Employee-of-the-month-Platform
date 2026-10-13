import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Quote, Trophy } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { Avatar, Breakdown, EmptyState, ScoreRing, Spinner } from '../components/ui'
import { api } from '../lib/api'
import { formatDate, monthName } from '../lib/format'
import type { Winner } from '../lib/types'

export default function WinnerDetail() {
  const { campaignId } = useParams()
  const q = useQuery({ queryKey: ['winner', campaignId], queryFn: () => api.get<Winner>(`/api/winners/${campaignId}`), retry: false })

  if (q.isLoading) return <Spinner />
  if (!q.data) {
    return (
      <EmptyState icon={Trophy} title="No winner announced yet">
        {q.error instanceof Error ? q.error.message : ''}
      </EmptyState>
    )
  }
  const w = q.data
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link to="/winners" className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-brand-600">
        <ArrowLeft className="size-4" /> All winners
      </Link>

      <section className="relative animate-rise overflow-hidden rounded-3xl bg-brand-950 px-6 py-10 text-center text-white shadow-xl sm:px-10">
        <div aria-hidden className="pointer-events-none absolute -top-24 left-1/2 size-96 -translate-x-1/2 rounded-full bg-gold-500/25 blur-3xl" />
        <div className="relative">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-sm font-semibold text-gold-300">
            <Trophy className="size-4" /> Employee of the Month · {monthName(w.month)} {w.year}
          </div>
          <div className="flex justify-center">
            <Avatar user={w.user} size={128} ring />
          </div>
          <h1 className="mt-5 text-3xl font-extrabold text-white sm:text-4xl">{w.user.full_name}</h1>
          <p className="mt-1 text-brand-200">
            {w.user.job_title} · {w.user.department}
          </p>
          {w.citation && <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-brand-50">“{w.citation}”</p>}
        </div>
      </section>

      <div className="grid gap-6 md:grid-cols-3">
        <section className="card flex flex-col items-center justify-center p-6 text-center">
          <ScoreRing value={w.final_score} size={150} />
          <p className="mt-3 text-sm text-slate-500">
            From <b className="text-slate-800">{w.evaluations}</b> colleague evaluations
          </p>
          <p className="text-xs text-slate-400">Announced {formatDate(w.published_at)}</p>
        </section>
        <section className="card p-6 md:col-span-2" aria-labelledby="bd">
          <h2 id="bd" className="mb-5 font-bold">Score breakdown</h2>
          <Breakdown items={w.breakdown} />
          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {w.breakdown.map((b) => (
              <div key={b.key} className="rounded-xl bg-slate-50 px-3 py-2 text-center">
                <div className="text-xs text-slate-500">{b.name}</div>
                <div className="font-bold tabular-nums">+{b.contribution.toFixed(1)}</div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {w.comments.length > 0 && (
        <section aria-labelledby="said">
          <h2 id="said" className="mb-3 text-lg font-bold">What colleagues said</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {w.comments.map((c, i) => (
              <blockquote key={i} className="card relative p-5 pl-12 text-sm leading-relaxed text-slate-700">
                <Quote className="absolute top-5 left-4 size-5 text-gold-400" />
                {c}
              </blockquote>
            ))}
          </div>
        </section>
      )}

      <div className="text-center">
        <Link to={`/people/${w.user.id}`} className="btn-outline">
          View {w.user.full_name.split(' ')[0]}'s recognition
        </Link>
      </div>
    </div>
  )
}
