import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import confetti from 'canvas-confetti'
import { ArrowLeft, ArrowRight, CalendarX, Check, CheckCircle2, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Avatar, EmptyState, ErrorNote, Spinner } from '../components/ui'
import { api } from '../lib/api'
import { criterionColor, formatDateTime } from '../lib/format'
import type { Criterion, CurrentCampaign, MyVote, UserBrief as CandidateOut } from '../lib/types'

const RATING_LABELS = ['Needs significant improvement', 'Below expectations', 'Meets expectations', 'Very good', 'Exceptional']
const STEPS = ['Select colleague', 'Rate performance', 'Review & submit']

export default function VotePage() {
  const current = useQuery({ queryKey: ['current'], queryFn: () => api.get<CurrentCampaign>('/api/campaigns/current') })
  const criteria = useQuery({ queryKey: ['criteria'], queryFn: () => api.get<Criterion[]>('/api/criteria') })
  // Kept here: after submitting, the refetched campaign reports my_vote, which would otherwise swap the success screen out
  const [votedFor, setVotedFor] = useState<string | null>(null)

  if (votedFor) return <VoteSuccess name={votedFor} />
  if (current.isLoading || criteria.isLoading) return <Spinner />
  const { campaign, my_vote } = current.data!
  if (!campaign || !campaign.is_voting_open) {
    return (
      <EmptyState icon={CalendarX} title="Voting is not open right now">
        {campaign ? `${campaign.name} is ${campaign.effective_status === 'scheduled' ? 'not open yet' : 'closed'}.` : 'No campaign has been opened yet.'}{' '}
        <Link to="/winners" className="font-semibold text-brand-600">See previous winners</Link>
      </EmptyState>
    )
  }
  if (my_vote) return <AlreadyVoted vote={my_vote} criteria={criteria.data!} />
  return <Wizard campaignId={campaign.id} campaignName={campaign.name} criteria={criteria.data!} onDone={setVotedFor} />
}

function VoteSuccess({ name }: { name: string }) {
  return (
    <div className="card mx-auto max-w-lg animate-rise p-10 text-center">
      <CheckCircle2 className="mx-auto mb-4 size-14 text-emerald-500" />
      <h1 className="text-2xl font-extrabold">Your vote has been successfully submitted.</h1>
      <p className="mt-2 text-slate-500">Thank you for recognizing {name}. Your individual vote stays confidential.</p>
      <Link to="/" className="btn-primary mt-6">Back to dashboard</Link>
    </div>
  )
}

function Wizard({ campaignId, campaignName, criteria, onDone }: { campaignId: number; campaignName: string; criteria: Criterion[]; onDone: (name: string) => void }) {
  const qc = useQueryClient()
  const [step, setStep] = useState(0)
  const [candidate, setCandidate] = useState<CandidateOut | null>(null)
  const [ratings, setRatings] = useState<Record<number, number>>({})
  const [comment, setComment] = useState('')

  const submit = useMutation({
    mutationFn: () =>
      api.post<MyVote>('/api/votes', { campaign_id: campaignId, candidate_id: candidate!.id, ratings, comment: comment || null }),
    onSuccess: () => {
      onDone(candidate!.full_name)
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      if (!reduce) confetti({ particleCount: 140, spread: 80, origin: { y: 0.6 }, colors: ['#fbbf24', '#6d261e', '#818384', '#ebc4be'] })
      qc.invalidateQueries({ queryKey: ['current'] })
    },
  })

  const allRated = criteria.every((c) => ratings[c.id])
  const preview = criteria.reduce((sum, c) => sum + ((ratings[c.id] ?? 0) / 5) * c.weight, 0)

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <p className="text-sm font-semibold text-brand-600">{campaignName}</p>
        <h1 className="text-2xl font-extrabold sm:text-3xl">Recognize a colleague</h1>
      </div>

      <ol className="mb-8 flex items-center gap-2" aria-label="Progress">
        {STEPS.map((label, i) => (
          <li key={label} className="flex flex-1 items-center gap-2">
            <span
              className={`flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold transition ${
                i < step ? 'bg-emerald-500 text-white' : i === step ? 'bg-brand-600 text-white ring-4 ring-brand-100' : 'bg-slate-200 text-slate-500'
              }`}
              aria-current={i === step ? 'step' : undefined}
            >
              {i < step ? <Check className="size-4" /> : i + 1}
            </span>
            <span className={`hidden text-sm font-medium sm:block ${i === step ? 'text-slate-900' : 'text-slate-500'}`}>{label}</span>
            {i < STEPS.length - 1 && <span className="h-px flex-1 bg-slate-200" />}
          </li>
        ))}
      </ol>

      {step === 0 && (
        <SelectStep
          campaignId={campaignId}
          selected={candidate}
          onSelect={(c) => {
            setCandidate(c)
            setStep(1)
            window.scrollTo({ top: 0 })
          }}
        />
      )}

      {step === 1 && candidate && (
        <div className="space-y-4 animate-rise">
          <CandidateBanner candidate={candidate} onChange={() => setStep(0)} />
          {criteria.map((c) => (
            <fieldset key={c.id} className="card p-5">
              <legend className="sr-only">{c.name}</legend>
              <div className="mb-1 flex items-center gap-2">
                <span className="size-2.5 rounded-full" style={{ background: criterionColor(c.key) }} />
                <span className="font-bold">{c.name}</span>
                <span className="pill bg-slate-100 text-slate-600">{c.weight}% of score</span>
              </div>
              <p className="mb-1 text-sm font-medium text-slate-700">{c.question.replace('{name}', candidate.full_name.split(' ')[0])}</p>
              <p className="mb-4 text-xs text-slate-500">{c.description}</p>
              <div className="grid grid-cols-5 gap-2">
                {[1, 2, 3, 4, 5].map((n) => {
                  const active = ratings[c.id] === n
                  return (
                    <button
                      key={n}
                      type="button"
                      aria-pressed={active}
                      aria-label={`${n} – ${RATING_LABELS[n - 1]}`}
                      onClick={() => setRatings((r) => ({ ...r, [c.id]: n }))}
                      className={`rounded-xl border-2 py-3 text-lg font-extrabold transition ${
                        active ? 'border-transparent text-white shadow-md' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                      }`}
                      style={active ? { background: criterionColor(c.key) } : undefined}
                    >
                      {n}
                    </button>
                  )
                })}
              </div>
              <div className="mt-2 h-4 text-center text-xs font-medium text-slate-500">{ratings[c.id] ? RATING_LABELS[ratings[c.id] - 1] : ''}</div>
            </fieldset>
          ))}
          <div className="sticky bottom-20 z-10 flex items-center justify-between gap-3 rounded-2xl bg-white/95 p-3 shadow-lg ring-1 ring-slate-200 backdrop-blur lg:bottom-4">
            <button className="btn-ghost" onClick={() => setStep(0)}>
              <ArrowLeft className="size-4" /> Back
            </button>
            <span className="text-sm text-slate-500">
              Score from your ratings: <b className="tabular-nums text-slate-900">{preview.toFixed(1)}</b>
            </span>
            <button className="btn-primary" disabled={!allRated} onClick={() => setStep(2)}>
              Review <ArrowRight className="size-4" />
            </button>
          </div>
        </div>
      )}

      {step === 2 && candidate && (
        <div className="space-y-4 animate-rise">
          <CandidateBanner candidate={candidate} onChange={() => setStep(0)} />
          <div className="card divide-y divide-slate-100">
            {criteria.map((c) => (
              <div key={c.id} className="flex items-center justify-between px-5 py-3">
                <span className="text-sm font-medium">{c.name}</span>
                <span className="text-sm">
                  <b className="text-base">{ratings[c.id]}</b>/5 <span className="text-slate-400">· {RATING_LABELS[ratings[c.id] - 1]}</span>
                </span>
              </div>
            ))}
            <div className="flex items-center justify-between bg-slate-50 px-5 py-3">
              <span className="text-sm font-bold">Weighted score from your vote</span>
              <span className="text-lg font-extrabold tabular-nums">{preview.toFixed(1)} / 100</span>
            </div>
          </div>
          <div className="card p-5">
            <label htmlFor="comment" className="label">
              What makes {candidate.full_name.split(' ')[0]} deserving of recognition? <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <textarea
              id="comment"
              className="input min-h-28"
              maxLength={1000}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="e.g. Always steps in to help the team resolve difficult issues…"
            />
            <p className="mt-1.5 text-xs text-slate-500">Comments may be shown on the winner's spotlight after HR review. Your name is never shown.</p>
          </div>
          <ErrorNote error={submit.error} />
          <div className="flex items-center justify-between gap-3">
            <button className="btn-ghost" onClick={() => setStep(1)}>
              <ArrowLeft className="size-4" /> Edit ratings
            </button>
            <button className="btn-gold px-6 py-3 text-base" disabled={submit.isPending} onClick={() => submit.mutate()}>
              {submit.isPending ? 'Submitting…' : 'Submit vote'}
            </button>
          </div>
          <p className="text-center text-xs text-slate-500">You can vote once per month and cannot change your vote after submitting.</p>
        </div>
      )}
    </div>
  )
}

function SelectStep({ campaignId, selected, onSelect }: { campaignId: number; selected: CandidateOut | null; onSelect: (c: CandidateOut) => void }) {
  const [q, setQ] = useState('')
  const [dept, setDept] = useState('')
  const candidates = useQuery({
    queryKey: ['candidates', campaignId],
    queryFn: () => api.get<CandidateOut[]>(`/api/campaigns/${campaignId}/candidates`),
  })
  const departments = useMemo(
    () => [...new Set((candidates.data ?? []).map((c) => c.department).filter(Boolean) as string[])].sort(),
    [candidates.data],
  )
  const list = (candidates.data ?? []).filter(
    (c) => (!dept || c.department === dept) && (c.full_name + ' ' + (c.job_title ?? '')).toLowerCase().includes(q.toLowerCase()),
  )

  if (candidates.isLoading) return <Spinner />
  return (
    <div className="animate-rise">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <label className="relative flex-1">
          <span className="sr-only">Search colleagues</span>
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-slate-400" />
          <input className="input pl-10" placeholder="Search by name or role…" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
        </label>
        <label>
          <span className="sr-only">Department</span>
          <select className="input sm:w-56" value={dept} onChange={(e) => setDept(e.target.value)}>
            <option value="">All departments</option>
            {departments.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((c) => (
          <button
            key={c.id}
            onClick={() => onSelect(c)}
            className={`card flex items-center gap-3 p-4 text-left transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md ${
              selected?.id === c.id ? 'border-brand-500 ring-2 ring-brand-200' : ''
            }`}
          >
            <Avatar user={c} size={48} />
            <div className="min-w-0">
              <div className="truncate font-semibold">{c.full_name}</div>
              <div className="truncate text-xs text-slate-500">{c.job_title}</div>
              <div className="truncate text-xs text-slate-400">{c.department}</div>
            </div>
          </button>
        ))}
      </div>
      {list.length === 0 && <p className="py-10 text-center text-sm text-slate-500">No colleagues match your search.</p>}
    </div>
  )
}

function CandidateBanner({ candidate, onChange }: { candidate: CandidateOut; onChange: () => void }) {
  return (
    <div className="card flex items-center gap-4 bg-gradient-to-r from-brand-50 to-white p-4">
      <Avatar user={candidate} size={52} />
      <div className="min-w-0 flex-1">
        <div className="text-xs font-semibold uppercase tracking-wide text-brand-600">You are voting for</div>
        <div className="truncate text-lg font-bold">{candidate.full_name}</div>
        <div className="truncate text-sm text-slate-500">
          {candidate.job_title} · {candidate.department}
        </div>
      </div>
      <button className="btn-ghost text-brand-600" onClick={onChange}>
        Change
      </button>
    </div>
  )
}

function AlreadyVoted({ vote, criteria }: { vote: MyVote; criteria: Criterion[] }) {
  return (
    <div className="card mx-auto max-w-lg p-8 text-center">
      <CheckCircle2 className="mx-auto mb-3 size-12 text-emerald-500" />
      <h1 className="text-xl font-extrabold">You've already voted this month</h1>
      <p className="mt-1 text-sm text-slate-500">Submitted {formatDateTime(vote.submitted_at)}</p>
      <div className="mt-6 flex items-center justify-center gap-3">
        <Avatar user={vote.candidate} size={44} />
        <div className="text-left">
          <div className="font-bold">{vote.candidate.full_name}</div>
          <div className="text-sm text-slate-500">{vote.candidate.department}</div>
        </div>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-2 text-sm">
        {criteria.map((c) => (
          <div key={c.id} className="rounded-xl bg-slate-50 px-3 py-2">
            <div className="text-xs text-slate-500">{c.name}</div>
            <div className="font-bold">{vote.ratings[c.id]}/5</div>
          </div>
        ))}
      </div>
      <Link to="/" className="btn-primary mt-6">Back to dashboard</Link>
    </div>
  )
}
