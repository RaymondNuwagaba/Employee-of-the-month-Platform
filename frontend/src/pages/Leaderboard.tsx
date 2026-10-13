import { useQuery } from '@tanstack/react-query'
import { BarChart3, Crown, Info } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Avatar, EmptyState, PageHeader, Spinner } from '../components/ui'
import { api } from '../lib/api'
import { monthShort, score } from '../lib/format'
import type { AnnualRow } from '../lib/types'

export default function Leaderboard() {
  const thisYear = new Date().getFullYear()
  const [year, setYear] = useState(thisYear)
  const q = useQuery({ queryKey: ['annual', year], queryFn: () => api.get<AnnualRow[]>(`/api/leaderboard/annual?year=${year}`) })
  const rows = q.data ?? []
  const [first, second, third] = rows

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Employee of the Year ${year}`}
        subtitle="Annual ranking based on monthly scores across the year."
        actions={
          <select className="input w-32" value={year} onChange={(e) => setYear(Number(e.target.value))} aria-label="Year">
            {[thisYear, thisYear - 1, thisYear - 2].map((y) => (
              <option key={y}>{y}</option>
            ))}
          </select>
        }
      />

      {q.isLoading ? (
        <Spinner />
      ) : rows.length === 0 ? (
        <EmptyState icon={BarChart3} title="No results for this year yet">The leaderboard fills in as monthly winners are announced.</EmptyState>
      ) : (
        <>
          <div className="grid grid-cols-3 items-end gap-3 sm:gap-6">
            {[second, first, third].map((r, i) =>
              r ? <Podium key={r.user.id} row={r} place={[2, 1, 3][i]} /> : <div key={i} />,
            )}
          </div>

          <section className="card p-5" aria-labelledby="chart">
            <h2 id="chart" className="mb-4 font-bold">Top 10 annual scores</h2>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rows.slice(0, 10).map((r) => ({ name: r.user.full_name.split(' ')[0], score: r.annual_score }))}>
                  <CartesianGrid vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} />
                  <YAxis tickLine={false} axisLine={false} fontSize={12} width={32} />
                  <Tooltip cursor={{ fill: '#f1f5f9' }} formatter={(v) => [Number(v).toFixed(1), 'Annual score']} />
                  <Bar dataKey="score" fill="var(--color-brand-500)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="card overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Employee</th>
                  <th className="text-right">Annual score</th>
                  <th className="text-right">Wins</th>
                  <th className="text-right">Months recognized</th>
                  <th className="text-right">Best month</th>
                  <th className="hidden md:table-cell">Monthly</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.user.id}>
                    <td className={`font-bold ${r.rank <= 3 ? 'text-gold-600' : 'text-slate-400'}`}>{r.rank}</td>
                    <td>
                      <Link to={`/people/${r.user.id}`} className="flex items-center gap-3 hover:text-brand-600">
                        <Avatar user={r.user} size={32} />
                        <span className="min-w-0">
                          <span className="block truncate font-semibold">{r.user.full_name}</span>
                          <span className="block truncate text-xs text-slate-500">{r.user.department}</span>
                        </span>
                      </Link>
                    </td>
                    <td className="text-right font-bold tabular-nums">{score(r.annual_score)}</td>
                    <td className="text-right tabular-nums">{r.monthly_wins || '—'}</td>
                    <td className="text-right tabular-nums">
                      {r.months_recognized}/{r.months_counted}
                    </td>
                    <td className="text-right tabular-nums">{score(r.best_score)}</td>
                    <td className="hidden md:table-cell">
                      <Sparkline row={r} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <p className="flex items-start gap-2 text-xs text-slate-500">
            <Info className="mt-0.5 size-3.5 shrink-0" />
            Annual score is the average monthly score over the published months the employee was eligible for. Months without enough
            evaluations count as zero, so consistency matters. Ties go to more monthly wins, then a higher average when nominated.
          </p>
        </>
      )}
    </div>
  )
}

function Podium({ row, place }: { row: AnnualRow; place: number }) {
  const heights = { 1: 'h-28 sm:h-36', 2: 'h-20 sm:h-24', 3: 'h-14 sm:h-16' } as Record<number, string>
  const colors = { 1: 'from-gold-400 to-gold-600', 2: 'from-slate-300 to-slate-400', 3: 'from-amber-600 to-amber-800' } as Record<number, string>
  return (
    <Link to={`/people/${row.user.id}`} className="flex animate-rise flex-col items-center text-center">
      {place === 1 && <Crown className="mb-1 size-7 fill-gold-400 text-gold-500" />}
      <Avatar user={row.user} size={place === 1 ? 84 : 64} ring={place === 1} />
      <div className="mt-2 w-full truncate text-sm font-bold sm:text-base">{row.user.full_name}</div>
      <div className="text-xs text-slate-500 tabular-nums">{score(row.annual_score)} pts</div>
      <div className={`mt-3 flex w-full items-start justify-center rounded-t-2xl bg-gradient-to-b pt-2 text-2xl font-extrabold text-white ${heights[place]} ${colors[place]}`}>
        {place}
      </div>
    </Link>
  )
}

function Sparkline({ row }: { row: AnnualRow }) {
  return (
    <div className="flex h-8 items-end gap-0.5" aria-hidden>
      {row.monthly.map((m) => (
        <span
          key={m.campaign_id}
          title={`${monthShort(m.month)}: ${m.score.toFixed(1)}${m.won ? ' (winner)' : ''}`}
          className={`w-2 rounded-sm ${m.won ? 'bg-gold-500' : m.qualified ? 'bg-brand-400' : 'bg-slate-200'}`}
          style={{ height: `${Math.max(8, m.score)}%` }}
        />
      ))}
    </div>
  )
}
