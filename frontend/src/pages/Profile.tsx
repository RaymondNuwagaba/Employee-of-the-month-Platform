import { useQuery } from '@tanstack/react-query'
import { Award, Medal, Sparkles, Star, Trophy, UserX } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Avatar, EmptyState, Spinner, StatCard } from '../components/ui'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { monthName, monthShort, score } from '../lib/format'
import type { Stats, UserBrief } from '../lib/types'

export default function Profile() {
  const { id } = useParams()
  const { user: me } = useAuth()
  const userId = id ? Number(id) : me!.id
  const isMe = userId === me!.id
  const thisYear = new Date().getFullYear()
  const [year, setYear] = useState(thisYear)

  const person = useQuery({
    queryKey: ['person', userId],
    queryFn: () => api.get<UserBrief>(`/api/employees/${userId}`),
    enabled: !isMe,
    retry: false,
  })
  const stats = useQuery({ queryKey: ['stats', userId, year], queryFn: () => api.get<Stats>(`/api/employees/${userId}/stats?year=${year}`) })

  const profile: UserBrief | undefined = isMe ? me! : person.data
  if (!isMe && person.isLoading) return <Spinner />
  if (!profile) return <EmptyState icon={UserX} title="Employee not found" />
  const s = stats.data

  return (
    <div className="space-y-6">
      <section className="card flex flex-col items-center gap-5 p-6 text-center sm:flex-row sm:text-left">
        <Avatar user={profile} size={88} ring={!!s?.monthly_wins} />
        <div className="flex-1">
          <h1 className="text-2xl font-extrabold">{isMe ? 'My recognition' : profile.full_name}</h1>
          <p className="text-slate-500">
            {isMe && `${profile.full_name} · `}
            {profile.job_title} · {profile.department}
          </p>
          {s && s.badges.length > 0 && (
            <div className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">
              {s.badges.map((b) => (
                <span key={b} className="pill bg-gold-100 py-1 text-gold-600">
                  <Award className="size-3.5" /> {b}
                </span>
              ))}
            </div>
          )}
        </div>
        <select className="input w-32" value={year} onChange={(e) => setYear(Number(e.target.value))} aria-label="Year">
          {[thisYear, thisYear - 1, thisYear - 2].map((y) => (
            <option key={y}>{y}</option>
          ))}
        </select>
      </section>

      {!s ? (
        <Spinner />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard icon={Sparkles} label="Nominations" value={s.nominations} hint={`Evaluations received in ${year}`} />
            <StatCard icon={Trophy} tone="gold" label="Monthly wins" value={s.monthly_wins} />
            <StatCard icon={Star} tone="emerald" label="Annual score" value={score(s.annual_score)} hint={`Best month ${score(s.best_score)}`} />
            <StatCard icon={Medal} tone="sky" label="Annual rank" value={s.annual_rank ? `#${s.annual_rank}` : '—'} />
          </div>

          {s.history.length > 0 ? (
            <>
              <section className="card p-5" aria-labelledby="trend">
                <h2 id="trend" className="mb-4 font-bold">Monthly score trend</h2>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={s.history.map((h) => ({ month: monthShort(h.month), score: h.score }))}>
                      <defs>
                        <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--color-brand-500)" stopOpacity={0.35} />
                          <stop offset="100%" stopColor="var(--color-brand-500)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} />
                      <YAxis domain={[0, 100]} tickLine={false} axisLine={false} fontSize={12} width={32} />
                      <Tooltip formatter={(v) => [Number(v).toFixed(1), 'Score']} />
                      <Area dataKey="score" stroke="var(--color-brand-600)" strokeWidth={2.5} fill="url(#trendFill)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </section>

              <section className="card overflow-x-auto">
                <table className="table-base">
                  <thead>
                    <tr>
                      <th>Month</th>
                      <th className="text-right">Score</th>
                      <th className="text-right">Evaluations</th>
                      <th className="text-right">Rank</th>
                    </tr>
                  </thead>
                  <tbody>
                    {s.history.map((h) => (
                      <tr key={h.campaign_id}>
                        <td className="font-medium">
                          {monthName(h.month)} {h.year}
                          {h.won && (
                            <Link to={`/winners/${h.campaign_id}`} className="pill ml-2 bg-gold-100 text-gold-600">
                              <Trophy className="size-3" /> Winner
                            </Link>
                          )}
                        </td>
                        <td className="text-right font-bold tabular-nums">{score(h.score)}</td>
                        <td className="text-right tabular-nums">{h.evaluations}</td>
                        <td className="text-right tabular-nums">{h.rank ? `#${h.rank}` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            </>
          ) : (
            <EmptyState icon={Sparkles} title="No recognition yet this year">
              {isMe ? 'Keep supporting your team — your colleagues are watching!' : 'Nothing recorded for this year yet.'}
            </EmptyState>
          )}
        </>
      )}
    </div>
  )
}
