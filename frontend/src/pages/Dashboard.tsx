import { useQuery } from '@tanstack/react-query'
import { ArrowRight, Award, CheckCircle2, Clock, Medal, Sparkles, Star, Trophy } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Avatar, Breakdown, ScoreRing, Spinner, StatCard, StatusPill } from '../components/ui'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { formatDate, monthName, score, timeLeft } from '../lib/format'
import type { AnnualRow, CurrentCampaign, Stats, Winner } from '../lib/types'

export default function Dashboard() {
  const { user } = useAuth()
  const year = new Date().getFullYear()
  const current = useQuery({ queryKey: ['current'], queryFn: () => api.get<CurrentCampaign>('/api/campaigns/current') })
  const stats = useQuery({ queryKey: ['stats', user!.id, year], queryFn: () => api.get<Stats>(`/api/employees/${user!.id}/stats?year=${year}`) })
  const winners = useQuery({ queryKey: ['winners'], queryFn: () => api.get<Winner[]>('/api/winners') })
  const annual = useQuery({ queryKey: ['annual', year], queryFn: () => api.get<AnnualRow[]>(`/api/leaderboard/annual?year=${year}`) })

  if (current.isLoading) return <Spinner />
  const latest = winners.data?.[0]
  const firstName = user!.full_name.split(' ')[0]

  return (
    <div className="space-y-8">
      <div className="animate-rise">
        <h1 className="text-2xl font-extrabold sm:text-3xl">Welcome, {firstName} 👋</h1>
        <p className="mt-1 text-slate-500">Who made your work better this month?</p>
      </div>

      <CampaignHero data={current.data!} />

      <section aria-labelledby="mine">
        <h2 id="mine" className="mb-3 text-lg font-bold">Your recognition in {year}</h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard icon={Sparkles} label="Nominations" value={stats.data?.nominations ?? '—'} hint="Evaluations from colleagues" />
          <StatCard icon={Trophy} tone="gold" label="Monthly wins" value={stats.data?.monthly_wins ?? '—'} />
          <StatCard icon={Star} tone="emerald" label="Annual score" value={score(stats.data?.annual_score)} hint="Average across the year" />
          <StatCard icon={Medal} tone="sky" label="Annual rank" value={stats.data?.annual_rank ? `#${stats.data.annual_rank}` : '—'} />
        </div>
        {stats.data && stats.data.badges.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {stats.data.badges.map((b) => (
              <span key={b} className="pill bg-gold-100 py-1 text-gold-600">
                <Award className="size-3.5" /> {b}
              </span>
            ))}
          </div>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-5">
        {latest && (
          <section className="card overflow-hidden lg:col-span-3" aria-labelledby="spot">
            <div className="flex items-center justify-between bg-gradient-to-r from-brand-900 to-brand-700 px-6 py-3">
              <h2 id="spot" className="text-sm font-bold text-white">
                🏆 {monthName(latest.month)} {latest.year} Employee of the Month
              </h2>
              <Link to={`/winners/${latest.campaign_id}`} className="text-xs font-semibold text-gold-300 hover:text-gold-100">
                Spotlight →
              </Link>
            </div>
            <div className="flex flex-col gap-6 p-6 sm:flex-row sm:items-center">
              <div className="flex items-center gap-4 sm:flex-col sm:text-center">
                <Avatar user={latest.user} size={80} ring />
                <div>
                  <div className="text-lg font-bold">{latest.user.full_name}</div>
                  <div className="text-sm text-slate-500">{latest.user.department}</div>
                </div>
              </div>
              <div className="flex-1">
                <Breakdown items={latest.breakdown} compact />
              </div>
              <ScoreRing value={latest.final_score} size={96} stroke={8} />
            </div>
          </section>
        )}

        <section className={`card p-6 ${latest ? 'lg:col-span-2' : 'lg:col-span-5'}`} aria-labelledby="top">
          <div className="mb-4 flex items-center justify-between">
            <h2 id="top" className="font-bold">Top performers {year}</h2>
            <Link to="/leaderboard" className="text-sm font-semibold text-brand-600 hover:text-brand-700">
              Full leaderboard
            </Link>
          </div>
          {annual.data?.length ? (
            <ol className="space-y-3">
              {annual.data.slice(0, 5).map((r) => (
                <li key={r.user.id} className="flex items-center gap-3">
                  <span className={`w-6 text-center text-sm font-bold ${r.rank <= 3 ? 'text-gold-600' : 'text-slate-400'}`}>{r.rank}</span>
                  <Avatar user={r.user} size={34} />
                  <Link to={`/people/${r.user.id}`} className="min-w-0 flex-1 truncate text-sm font-semibold hover:text-brand-600">
                    {r.user.full_name}
                  </Link>
                  <span className="text-sm font-bold tabular-nums">{score(r.annual_score)}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-slate-500">Rankings appear once the first winner is announced.</p>
          )}
        </section>
      </div>
    </div>
  )
}

function CampaignHero({ data }: { data: CurrentCampaign }) {
  const { campaign, my_vote, votes_cast, eligible_voters } = data
  if (!campaign) {
    return (
      <div className="card p-8 text-center text-slate-500">
        No campaign is running yet. HR will open voting soon.
      </div>
    )
  }
  const pct = eligible_voters ? Math.round((votes_cast / eligible_voters) * 100) : 0
  return (
    <section className="relative animate-rise overflow-hidden rounded-3xl bg-brand-950 p-6 text-white shadow-xl sm:p-8">
      <div aria-hidden className="pointer-events-none absolute -right-16 -top-24 size-80 rounded-full bg-brand-600/40 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-24 left-10 size-64 rounded-full bg-gold-500/20 blur-3xl" />
      <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="mb-3">
            <StatusPill status={campaign.effective_status} />
          </div>
          <h2 className="text-2xl font-extrabold text-white sm:text-3xl">{campaign.name}</h2>
          <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-brand-200">
            {campaign.is_voting_open ? (
              <span className="flex items-center gap-1.5 font-semibold text-gold-300">
                <Clock className="size-4" /> {timeLeft(campaign.end_at)}
              </span>
            ) : null}
            <span>Closes {formatDate(campaign.end_at)}</span>
          </div>
          <div className="mt-5 max-w-sm">
            <div className="mb-1.5 flex justify-between text-xs text-brand-200">
              <span>Team participation</span>
              <span className="font-semibold text-white">
                {votes_cast} of {eligible_voters} voted
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-gold-400" style={{ width: `${pct}%` }} />
            </div>
          </div>
        </div>

        <div className="shrink-0">
          {my_vote ? (
            <div className="flex items-center gap-3 rounded-2xl bg-white/10 p-4 backdrop-blur">
              <CheckCircle2 className="size-6 text-emerald-400" />
              <div>
                <div className="text-sm font-semibold">Your vote is in</div>
                <div className="text-sm text-brand-200">You recognized {my_vote.candidate.full_name}</div>
              </div>
            </div>
          ) : campaign.is_voting_open ? (
            <Link to="/vote" className="btn-gold px-7 py-3.5 text-base">
              Vote now <ArrowRight className="size-5" />
            </Link>
          ) : campaign.effective_status === 'published' ? (
            <Link to={`/winners/${campaign.id}`} className="btn-gold px-7 py-3.5 text-base">
              See the winner <Trophy className="size-5" />
            </Link>
          ) : (
            <div className="rounded-2xl bg-white/10 px-5 py-4 text-sm text-brand-100">Results will be announced soon.</div>
          )}
        </div>
      </div>
    </section>
  )
}
