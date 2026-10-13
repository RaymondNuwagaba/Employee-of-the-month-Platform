import { useQuery } from '@tanstack/react-query'
import { Trophy } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Avatar, EmptyState, PageHeader, Spinner } from '../components/ui'
import { api } from '../lib/api'
import { monthName, score } from '../lib/format'
import type { Winner } from '../lib/types'

export default function Winners() {
  const [year, setYear] = useState<number | ''>('')
  const winners = useQuery({
    queryKey: ['winners', year],
    queryFn: () => api.get<Winner[]>(`/api/winners${year ? `?year=${year}` : ''}`),
  })
  const thisYear = new Date().getFullYear()
  const years = [thisYear, thisYear - 1, thisYear - 2]

  return (
    <div>
      <PageHeader
        title="Wall of Fame"
        subtitle="Every Employee of the Month, as chosen by their colleagues."
        actions={
          <select className="input w-40" value={year} onChange={(e) => setYear(e.target.value ? Number(e.target.value) : '')} aria-label="Year">
            <option value="">All years</option>
            {years.map((y) => (
              <option key={y}>{y}</option>
            ))}
          </select>
        }
      />
      {winners.isLoading ? (
        <Spinner />
      ) : !winners.data?.length ? (
        <EmptyState icon={Trophy} title="No winners yet">Winners appear here once HR announces the results.</EmptyState>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {winners.data.map((w, i) => (
            <Link
              key={w.campaign_id}
              to={`/winners/${w.campaign_id}`}
              className="card group animate-rise overflow-hidden transition hover:-translate-y-1 hover:shadow-lg"
              style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
            >
              <div className="relative bg-gradient-to-br from-brand-900 via-brand-800 to-brand-700 px-5 pt-5 pb-12 text-white">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-gold-300">
                    {monthName(w.month)} {w.year}
                  </span>
                  <Trophy className="size-5 text-gold-400" />
                </div>
              </div>
              <div className="-mt-10 flex flex-col items-center px-5 pb-5 text-center">
                <Avatar user={w.user} size={80} ring />
                <div className="mt-3 text-lg font-bold group-hover:text-brand-700">{w.user.full_name}</div>
                <div className="text-sm text-slate-500">
                  {w.user.job_title} · {w.user.department}
                </div>
                <div className="mt-3 flex items-center gap-4 text-sm">
                  <span>
                    <b className="text-lg tabular-nums">{score(w.final_score)}</b>
                    <span className="text-slate-400"> / 100</span>
                  </span>
                  <span className="text-slate-400">{w.evaluations} evaluations</span>
                </div>
                {w.citation && <p className="mt-3 line-clamp-2 text-sm italic text-slate-600">“{w.citation}”</p>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
