import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, MessageSquareQuote, X } from 'lucide-react'
import { useState } from 'react'
import { Avatar, EmptyState, ErrorNote, PageHeader, Spinner } from '../../components/ui'
import { api } from '../../lib/api'
import { formatDateTime } from '../../lib/format'
import type { CommentItem } from '../../lib/types'

export default function Comments() {
  const qc = useQueryClient()
  const [pendingOnly, setPendingOnly] = useState(true)
  const q = useQuery({
    queryKey: ['admin-comments', pendingOnly],
    queryFn: () => api.get<CommentItem[]>(`/api/admin/comments?pending_only=${pendingOnly}`),
  })
  const moderate = useMutation({
    mutationFn: ({ id, approved }: { id: number; approved: boolean }) => api.post(`/api/admin/comments/${id}`, { approved }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-comments'] }),
  })

  return (
    <div>
      <PageHeader
        title="Comment moderation"
        subtitle="Approved comments appear anonymously on the winner's spotlight."
        actions={
          <div className="flex rounded-xl bg-slate-100 p-1 text-sm font-semibold">
            {[true, false].map((p) => (
              <button
                key={String(p)}
                onClick={() => setPendingOnly(p)}
                className={`rounded-lg px-3 py-1.5 ${pendingOnly === p ? 'bg-white shadow-sm' : 'text-slate-500'}`}
              >
                {p ? 'Pending' : 'All'}
              </button>
            ))}
          </div>
        }
      />
      <ErrorNote error={moderate.error} />
      {q.isLoading ? (
        <Spinner />
      ) : !q.data?.length ? (
        <EmptyState icon={MessageSquareQuote} title="Nothing to review">New comments appear here as employees vote.</EmptyState>
      ) : (
        <div className="space-y-3">
          {q.data.map((c) => (
            <article key={c.vote_id} className="card flex flex-col gap-4 p-5 sm:flex-row sm:items-start">
              <div className="flex-1">
                <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
                  <span className="text-slate-500">About</span>
                  <Avatar user={c.candidate} size={22} />
                  <b>{c.candidate.full_name}</b>
                  <span className="text-slate-400">· {c.campaign_name} · {formatDateTime(c.submitted_at)}</span>
                  {c.approved === true && <span className="pill bg-emerald-50 text-emerald-700">Approved</span>}
                  {c.approved === false && <span className="pill bg-rose-50 text-rose-700">Hidden</span>}
                </div>
                <p className="text-slate-700">{c.comment}</p>
              </div>
              <div className="flex gap-2">
                <button
                  className="btn-outline px-3 py-1.5 text-sm"
                  disabled={moderate.isPending || c.approved === true}
                  onClick={() => moderate.mutate({ id: c.vote_id, approved: true })}
                >
                  <Check className="size-4 text-emerald-600" /> Approve
                </button>
                <button
                  className="btn-outline px-3 py-1.5 text-sm"
                  disabled={moderate.isPending || c.approved === false}
                  onClick={() => moderate.mutate({ id: c.vote_id, approved: false })}
                >
                  <X className="size-4 text-rose-600" /> Hide
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
