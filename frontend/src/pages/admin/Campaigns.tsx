import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, CalendarPlus, Download, Lock, Play, RotateCcw, Trash2, Trophy, UserMinus } from 'lucide-react'
import { useState } from 'react'
import { Avatar, Breakdown, ErrorNote, Modal, PageHeader, Spinner, StatusPill } from '../../components/ui'
import { api } from '../../lib/api'
import { isAdmin, useAuth } from '../../lib/auth'
import { formatDateTime, MONTHS, score, toLocalInput } from '../../lib/format'
import type { Campaign, CampaignResults, User } from '../../lib/types'

export default function Campaigns() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const list = useQuery({ queryKey: ['admin-campaigns'], queryFn: () => api.get<Campaign[]>('/api/admin/campaigns') })
  const [creating, setCreating] = useState(false)
  const [selected, setSelected] = useState<number | null>(null)
  const [reopen, setReopen] = useState<Campaign | null>(null)
  const [resetFor, setResetFor] = useState<Campaign | null>(null)

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['admin-campaigns'] })
    qc.invalidateQueries({ queryKey: ['current'] })
    qc.invalidateQueries({ queryKey: ['admin-results'] })
  }
  const action = useMutation({
    mutationFn: ({ c, op }: { c: Campaign; op: 'open' | 'close' | 'delete' }) =>
      op === 'delete' ? api.del(`/api/admin/campaigns/${c.id}`) : api.post(`/api/admin/campaigns/${c.id}/${op}`),
    onSuccess: refresh,
  })

  return (
    <div className="space-y-6">
      <PageHeader
        title="Campaigns"
        subtitle="Create a monthly vote, open it, then publish the winner after it closes."
        actions={
          <button className="btn-primary" onClick={() => setCreating(true)}>
            <CalendarPlus className="size-4" /> New campaign
          </button>
        }
      />
      <ErrorNote error={action.error} />

      {list.isLoading ? (
        <Spinner />
      ) : (
        <div className="card overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>Campaign</th>
                <th>Status</th>
                <th>Voting window</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {list.data?.map((c) => {
                const st = c.effective_status
                return (
                  <tr key={c.id} className={selected === c.id ? 'bg-brand-50/50' : ''}>
                    <td className="font-semibold">{c.name}</td>
                    <td>
                      <StatusPill status={st} />
                    </td>
                    <td className="text-sm whitespace-nowrap text-slate-500">
                      {formatDateTime(c.start_at)} – {formatDateTime(c.end_at)}
                    </td>
                    <td>
                      <div className="flex flex-wrap justify-end gap-1.5">
                        {c.status === 'draft' && (
                          <>
                            <button className="btn-primary px-3 py-1.5 text-xs" onClick={() => action.mutate({ c, op: 'open' })}>
                              <Play className="size-3.5" /> Open
                            </button>
                            <button
                              className="btn-ghost px-2 py-1.5 text-xs text-rose-600"
                              aria-label="Delete draft"
                              onClick={() => confirm(`Delete ${c.name}?`) && action.mutate({ c, op: 'delete' })}
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </>
                        )}
                        {(st === 'open' || st === 'scheduled') && (
                          <button
                            className="btn-outline px-3 py-1.5 text-xs"
                            onClick={() => confirm('Close voting now? Employees will no longer be able to vote.') && action.mutate({ c, op: 'close' })}
                          >
                            <Lock className="size-3.5" /> Close now
                          </button>
                        )}
                        {st === 'open' && isAdmin(user) && (
                          <button className="btn-ghost px-3 py-1.5 text-xs" onClick={() => setResetFor(c)}>
                            <UserMinus className="size-3.5" /> Reset a vote
                          </button>
                        )}
                        {st === 'closed' && isAdmin(user) && (
                          <button className="btn-ghost px-3 py-1.5 text-xs" onClick={() => setReopen(c)}>
                            <RotateCcw className="size-3.5" /> Reopen
                          </button>
                        )}
                        {c.status !== 'draft' && (
                          <button
                            className={`px-3 py-1.5 text-xs ${st === 'closed' ? 'btn-gold' : 'btn-outline'}`}
                            onClick={() => setSelected(selected === c.id ? null : c.id)}
                          >
                            <Trophy className="size-3.5" /> {st === 'closed' ? 'Review & publish' : 'Results'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {selected && <ResultsPanel key={selected} campaignId={selected} onPublished={refresh} />}
      {creating && <CreateModal onClose={() => setCreating(false)} onCreated={refresh} />}
      {reopen && <ReopenModal campaign={reopen} onClose={() => setReopen(null)} onDone={refresh} />}
      {resetFor && <ResetVoteModal campaign={resetFor} onClose={() => setResetFor(null)} onDone={refresh} />}
    </div>
  )
}

function ResultsPanel({ campaignId, onPublished }: { campaignId: number; onPublished: () => void }) {
  const q = useQuery({ queryKey: ['admin-results', campaignId], queryFn: () => api.get<CampaignResults>(`/api/admin/campaigns/${campaignId}/results`) })
  const [choice, setChoice] = useState<number | null>(null)
  const [citation, setCitation] = useState('')
  const [reason, setReason] = useState('')
  const publish = useMutation({
    mutationFn: () =>
      api.post(`/api/admin/campaigns/${campaignId}/publish`, { user_id: choice, citation: citation || null, override_reason: reason || null }),
    onSuccess: onPublished,
  })

  if (q.isLoading || !q.data) return <Spinner />
  const r = q.data
  const st = r.campaign.effective_status
  const top = r.results.find((x) => x.rank === 1)
  const chosenId = choice ?? top?.user.id
  const isOverride = !!top && chosenId !== top.user.id
  const hasTie = r.results.some((x) => x.rank === 1 && x.tied_with_next)

  return (
    <section className="card animate-rise p-5" aria-labelledby="res">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="res" className="text-lg font-bold">{r.campaign.name} results</h2>
          <p className="text-sm text-slate-500">
            {r.votes_cast} of {r.eligible_voters} voted ({r.participation}%) · min. {r.min_evaluations} evaluations to qualify
          </p>
        </div>
        <a className="btn-outline text-sm" href={`/api/admin/reports/campaign/${campaignId}.csv`}>
          <Download className="size-4" /> CSV
        </a>
      </div>

      {hasTie && (
        <div className="mb-4 flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          The top candidates are tied even after tie-breakers. Review and choose the winner.
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="table-base">
          <thead>
            <tr>
              {st === 'closed' && <th className="w-8" />}
              <th>#</th>
              <th>Employee</th>
              <th className="text-right">Score</th>
              <th className="text-right">Evaluations</th>
              <th className="hidden w-64 lg:table-cell">Breakdown</th>
            </tr>
          </thead>
          <tbody>
            {r.results.map((row) => (
              <tr key={row.user.id} className={!row.qualified ? 'opacity-55' : row.user.id === r.winner_user_id ? 'bg-gold-50' : ''}>
                {st === 'closed' && (
                  <td>
                    {row.qualified && (
                      <input
                        type="radio"
                        name="winner"
                        aria-label={`Choose ${row.user.full_name}`}
                        checked={chosenId === row.user.id}
                        onChange={() => setChoice(row.user.id)}
                        className="size-4 accent-brand-600"
                      />
                    )}
                  </td>
                )}
                <td className="font-bold text-slate-500">
                  {row.rank ?? '—'}
                  {row.tied_with_next && <span className="pill ml-1 bg-amber-100 text-amber-700">tie</span>}
                </td>
                <td>
                  <div className="flex items-center gap-2.5">
                    <Avatar user={row.user} size={30} />
                    <div>
                      <div className="font-semibold">{row.user.full_name}</div>
                      <div className="text-xs text-slate-500">
                        {row.user.department}
                        {!row.qualified && ' · not enough evaluations'}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="text-right font-bold tabular-nums">{score(row.final_score)}</td>
                <td className="text-right tabular-nums">{row.evaluations}</td>
                <td className="hidden lg:table-cell">
                  <Breakdown items={row.breakdown} compact />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {r.results.length === 0 && <p className="py-8 text-center text-sm text-slate-500">No votes yet.</p>}
      </div>

      {st === 'closed' && top && (
        <div className="mt-6 space-y-4 border-t border-slate-100 pt-5">
          <div>
            <label className="label" htmlFor="citation">Citation shown on the winner spotlight (optional)</label>
            <textarea id="citation" className="input min-h-20" maxLength={1000} value={citation} onChange={(e) => setCitation(e.target.value)} placeholder="Recognized for exceptional support to the team during…" />
          </div>
          {isOverride && (
            <div>
              <label className="label" htmlFor="reason">Reason for choosing someone other than rank #1 (required, audited)</label>
              <textarea id="reason" className="input min-h-20" value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
          )}
          <ErrorNote error={publish.error} />
          <button
            className="btn-gold"
            disabled={publish.isPending || (isOverride && reason.trim().length < 3)}
            onClick={() => confirm('Publish this result? Everyone will see the winner.') && publish.mutate()}
          >
            <Trophy className="size-4" /> Publish winner
          </button>
        </div>
      )}
    </section>
  )
}

function CreateModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [start, setStart] = useState(toLocalInput(now))
  const [end, setEnd] = useState(toLocalInput(new Date(now.getFullYear(), now.getMonth() + 1, 0, 17, 0)))
  const create = useMutation({
    mutationFn: () =>
      api.post('/api/admin/campaigns', { month, year, start_at: new Date(start).toISOString(), end_at: new Date(end).toISOString() }),
    onSuccess: () => {
      onCreated()
      onClose()
    },
  })
  return (
    <Modal title="New monthly campaign" onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          create.mutate()
        }}
      >
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="m">Month</label>
            <select id="m" className="input" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>{m}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="y">Year</label>
            <input id="y" type="number" className="input" value={year} onChange={(e) => setYear(Number(e.target.value))} />
          </div>
          <div>
            <label className="label" htmlFor="s">Voting opens</label>
            <input id="s" type="datetime-local" className="input" value={start} onChange={(e) => setStart(e.target.value)} required />
          </div>
          <div>
            <label className="label" htmlFor="e">Voting closes</label>
            <input id="e" type="datetime-local" className="input" value={end} onChange={(e) => setEnd(e.target.value)} required />
          </div>
        </div>
        <p className="text-xs text-slate-500">The campaign starts as a draft. Open it to freeze the current scoring weights and let employees vote.</p>
        <ErrorNote error={create.error} />
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={create.isPending}>Create draft</button>
        </div>
      </form>
    </Modal>
  )
}

function ReopenModal({ campaign, onClose, onDone }: { campaign: Campaign; onClose: () => void; onDone: () => void }) {
  const [end, setEnd] = useState(() => toLocalInput(new Date(Date.now() + 2 * 86_400_000)))
  const [reason, setReason] = useState('')
  const m = useMutation({
    mutationFn: () => api.post(`/api/admin/campaigns/${campaign.id}/reopen`, { end_at: new Date(end).toISOString(), reason }),
    onSuccess: () => {
      onDone()
      onClose()
    },
  })
  return (
    <Modal title={`Reopen ${campaign.name}`} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="label" htmlFor="ne">New closing time</label>
          <input id="ne" type="datetime-local" className="input" value={end} onChange={(e) => setEnd(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="rr">Reason (audited)</label>
          <textarea id="rr" className="input" value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
        <ErrorNote error={m.error} />
        <div className="flex justify-end gap-2">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={m.isPending || reason.trim().length < 3} onClick={() => m.mutate()}>Reopen voting</button>
        </div>
      </div>
    </Modal>
  )
}

function ResetVoteModal({ campaign, onClose, onDone }: { campaign: Campaign; onClose: () => void; onDone: () => void }) {
  const people = useQuery({ queryKey: ['admin-employees'], queryFn: () => api.get<User[]>('/api/admin/employees') })
  const [voter, setVoter] = useState('')
  const [reason, setReason] = useState('')
  const m = useMutation({
    mutationFn: () => api.post(`/api/admin/campaigns/${campaign.id}/reset-vote`, { voter_id: Number(voter), reason }),
    onSuccess: () => {
      onDone()
      onClose()
    },
  })
  return (
    <Modal title="Reset an employee's vote" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-slate-500">The employee's vote for {campaign.name} is deleted so they can vote again. This is recorded in the audit log.</p>
        <div>
          <label className="label" htmlFor="voter">Employee</label>
          <select id="voter" className="input" value={voter} onChange={(e) => setVoter(e.target.value)}>
            <option value="">Select…</option>
            {people.data?.filter((p) => p.is_active).map((p) => (
              <option key={p.id} value={p.id}>{p.full_name} — {p.email}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="why">Reason (audited)</label>
          <textarea id="why" className="input" value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
        <ErrorNote error={m.error} />
        <div className="flex justify-end gap-2">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-danger" disabled={m.isPending || !voter || reason.trim().length < 3} onClick={() => m.mutate()}>Reset vote</button>
        </div>
      </div>
    </Modal>
  )
}
