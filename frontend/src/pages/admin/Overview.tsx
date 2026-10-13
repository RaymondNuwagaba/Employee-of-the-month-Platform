import { useQuery } from '@tanstack/react-query'
import { CalendarClock, Crown, Users, Vote } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Avatar, Breakdown, PageHeader, Spinner, StatCard, StatusPill } from '../../components/ui'
import { api } from '../../lib/api'
import { score } from '../../lib/format'
import type { Overview } from '../../lib/types'

export default function AdminOverview() {
  const q = useQuery({ queryKey: ['admin-overview'], queryFn: () => api.get<Overview>('/api/admin/overview') })
  if (q.isLoading || !q.data) return <Spinner />
  const o = q.data
  const c = o.current_campaign

  return (
    <div className="space-y-6">
      <PageHeader
        title="HR overview"
        subtitle={
          c ? (
            <span className="inline-flex items-center gap-2">
              {c.name} <StatusPill status={c.effective_status} />
            </span>
          ) : (
            'No campaign yet'
          )
        }
        actions={
          <Link to="/admin/campaigns" className="btn-primary">
            Manage campaigns
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={Users} label="Employees" value={o.total_employees} hint={`${o.eligible_voters} active voters`} />
        <StatCard icon={Vote} tone="emerald" label="Votes submitted" value={o.votes_submitted} />
        <StatCard icon={Users} tone="sky" label="Participation" value={`${o.participation}%`} />
        <StatCard icon={CalendarClock} tone="gold" label="Days remaining" value={o.days_remaining ?? '—'} />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <section className="card p-5 lg:col-span-2" aria-labelledby="leader">
          <h2 id="leader" className="mb-4 flex items-center gap-2 font-bold">
            <Crown className="size-4 text-gold-500" /> Current leader
          </h2>
          {o.leader ? (
            <>
              <div className="mb-4 flex items-center gap-3">
                <Avatar user={o.leader.user} size={48} />
                <div className="flex-1">
                  <div className="font-bold">{o.leader.user.full_name}</div>
                  <div className="text-sm text-slate-500">{o.leader.evaluations} evaluations</div>
                </div>
                <div className="text-2xl font-extrabold tabular-nums">{score(o.leader.final_score)}</div>
              </div>
              <Breakdown items={o.leader.breakdown} compact />
              <p className="mt-4 text-xs text-slate-500">Visible to HR only until results are published.</p>
            </>
          ) : (
            <p className="text-sm text-slate-500">No qualified candidate yet.</p>
          )}
        </section>

        <section className="card p-5 lg:col-span-3" aria-labelledby="dept">
          <h2 id="dept" className="mb-4 font-bold">Participation by department</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={o.department_participation} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid horizontal={false} stroke="#e2e8f0" />
                <XAxis type="number" domain={[0, 100]} unit="%" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="department" width={110} fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip formatter={(v, _n, p) => [`${v}% (${p.payload.voted}/${p.payload.employees})`, 'Participation']} />
                <Bar dataKey="participation" fill="var(--color-brand-500)" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      <section className="card p-5" aria-labelledby="trend">
        <h2 id="trend" className="mb-4 font-bold">Monthly participation</h2>
        <div className="h-60">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={o.monthly_participation}>
              <CartesianGrid vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="label" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis domain={[0, 100]} unit="%" fontSize={12} tickLine={false} axisLine={false} width={40} />
              <Tooltip formatter={(v, _n, p) => [`${v}% (${p.payload.votes} votes)`, 'Participation']} />
              <Line dataKey="participation" stroke="var(--color-gold-500)" strokeWidth={3} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  )
}
