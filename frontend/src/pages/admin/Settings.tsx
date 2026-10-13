import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Download, Save } from 'lucide-react'
import { useState } from 'react'
import { ErrorNote, PageHeader, Spinner } from '../../components/ui'
import { api } from '../../lib/api'
import { criterionColor } from '../../lib/format'
import type { AppSettings, Criterion } from '../../lib/types'

export default function Settings() {
  return (
    <div className="space-y-6">
      <PageHeader title="Scoring & rules" subtitle="Changes apply to campaigns opened after saving. Past results never change." />
      <WeightsCard />
      <RulesCard />
      <ReportsCard />
    </div>
  )
}

function WeightsCard() {
  const q = useQuery({ queryKey: ['criteria'], queryFn: () => api.get<Criterion[]>('/api/criteria') })
  if (!q.data) return <Spinner />
  return <WeightsForm initial={q.data} />
}

function WeightsForm({ initial }: { initial: Criterion[] }) {
  const qc = useQueryClient()
  const [draft, setDraft] = useState(initial)
  const save = useMutation({
    mutationFn: () =>
      api.put<Criterion[]>(
        '/api/admin/criteria',
        draft.map((c) => ({ id: c.id, weight: c.weight, name: c.name, description: c.description, question: c.question })),
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['criteria'] }),
  })
  const total = draft.reduce((s, c) => s + (Number(c.weight) || 0), 0)
  const update = (id: number, patch: Partial<Criterion>) => setDraft((d) => d.map((c) => (c.id === id ? { ...c, ...patch } : c)))

  return (
    <section className="card p-5" aria-labelledby="w">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 id="w" className="font-bold">Evaluation criteria</h2>
        <span className={`pill ${Math.abs(total - 100) < 0.001 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
          Total {total}% {Math.abs(total - 100) < 0.001 ? '✓' : '— must be 100%'}
        </span>
      </div>
      <div className="mb-5 flex h-3 overflow-hidden rounded-full bg-slate-100">
        {draft.map((c) => (
          <div key={c.id} style={{ width: `${Math.min(100, c.weight)}%`, background: criterionColor(c.key) }} title={`${c.name} ${c.weight}%`} />
        ))}
      </div>
      <div className="space-y-4">
        {draft.map((c) => (
          <div key={c.id} className="grid gap-3 rounded-xl border border-slate-200 p-4 md:grid-cols-[1fr_120px]">
            <div className="space-y-2">
              <input className="input font-semibold" aria-label="Criterion name" value={c.name} onChange={(e) => update(c.id, { name: e.target.value })} />
              <input className="input text-sm" aria-label="Description" value={c.description} onChange={(e) => update(c.id, { description: e.target.value })} />
              <input className="input text-sm" aria-label="Question" value={c.question} onChange={(e) => update(c.id, { question: e.target.value })} />
              <p className="text-xs text-slate-400">Use {'{name}'} in the question for the colleague's first name.</p>
            </div>
            <div>
              <label className="label" htmlFor={`w${c.id}`}>Weight %</label>
              <input
                id={`w${c.id}`}
                type="number"
                min={1}
                max={100}
                step="0.5"
                className="input text-lg font-bold"
                value={c.weight}
                onChange={(e) => update(c.id, { weight: Number(e.target.value) })}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button className="btn-primary" disabled={save.isPending || Math.abs(total - 100) > 0.001} onClick={() => save.mutate()}>
          <Save className="size-4" /> Save criteria
        </button>
        {save.isSuccess && <span className="text-sm text-emerald-600">Saved</span>}
      </div>
      <div className="mt-3">
        <ErrorNote error={save.error} />
      </div>
    </section>
  )
}

function RulesCard() {
  const q = useQuery({ queryKey: ['admin-settings'], queryFn: () => api.get<AppSettings>('/api/admin/settings') })
  if (!q.data) return <Spinner />
  return <RulesForm initial={q.data} />
}

function RulesForm({ initial }: { initial: AppSettings }) {
  const qc = useQueryClient()
  const [draft, setDraft] = useState(initial)
  const save = useMutation({
    mutationFn: () => api.put<AppSettings>('/api/admin/settings', draft),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-settings'] }),
  })
  return (
    <section className="card p-5" aria-labelledby="r">
      <h2 id="r" className="mb-4 font-bold">Eligibility & rules</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="tenure">Minimum tenure to be nominated (days)</label>
          <input id="tenure" type="number" min={0} className="input" value={draft.min_tenure_days} onChange={(e) => setDraft({ ...draft, min_tenure_days: Math.max(0, Math.trunc(Number(e.target.value))) })} />
        </div>
        <div>
          <label className="label" htmlFor="mine">Minimum evaluations to qualify</label>
          <input id="mine" type="number" min={0} className="input" value={draft.min_evaluations} onChange={(e) => setDraft({ ...draft, min_evaluations: Math.max(0, Math.trunc(Number(e.target.value))) })} />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="size-4 accent-brand-600" checked={draft.comments_require_approval} onChange={(e) => setDraft({ ...draft, comments_require_approval: e.target.checked })} />
          Comments require HR approval before display
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="size-4 accent-brand-600" checked={draft.managers_eligible} onChange={(e) => setDraft({ ...draft, managers_eligible: e.target.checked })} />
          HR / managers can be nominated
        </label>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button className="btn-primary" disabled={save.isPending} onClick={() => save.mutate()}>
          <Save className="size-4" /> Save rules
        </button>
        {save.isSuccess && <span className="text-sm text-emerald-600">Saved</span>}
      </div>
      <div className="mt-3">
        <ErrorNote error={save.error} />
      </div>
    </section>
  )
}

function ReportsCard() {
  const thisYear = new Date().getFullYear()
  const [year, setYear] = useState(thisYear)
  return (
    <section className="card p-5" aria-labelledby="rep">
      <h2 id="rep" className="mb-1 font-bold">Annual report</h2>
      <p className="mb-4 text-sm text-slate-500">Monthly campaign reports are on the Campaigns page.</p>
      <div className="flex gap-2">
        <select className="input w-32" value={year} onChange={(e) => setYear(Number(e.target.value))} aria-label="Year">
          {[thisYear, thisYear - 1, thisYear - 2].map((y) => (
            <option key={y}>{y}</option>
          ))}
        </select>
        <a className="btn-outline" href={`/api/admin/reports/annual/${year}.csv`}>
          <Download className="size-4" /> Download CSV
        </a>
      </div>
    </section>
  )
}
