import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { PageHeader, Spinner } from '../../components/ui'
import { api } from '../../lib/api'
import { formatDateTime } from '../../lib/format'
import type { AuditEntry } from '../../lib/types'

const ACTIONS = [
  'login',
  'employee_created',
  'employee_updated',
  'employee_disabled',
  'role_changed',
  'campaign_created',
  'campaign_updated',
  'campaign_opened',
  'campaign_closed',
  'campaign_deleted',
  'vote_submitted',
  'result_published',
  'administrator_override',
  'scoring_parameters_changed',
  'settings_changed',
  'comment_moderated',
  'department_created',
  'department_updated',
]

const fmt = (v: unknown) => (v == null ? '' : typeof v === 'string' ? v : JSON.stringify(v))

export default function Audit() {
  const [action, setAction] = useState('')
  const q = useQuery({
    queryKey: ['admin-audit', action],
    queryFn: () => api.get<AuditEntry[]>(`/api/admin/audit${action ? `?action=${action}` : ''}`),
  })
  return (
    <div>
      <PageHeader
        title="Audit log"
        subtitle="Every administrative action is recorded. Individual votes are never linked to voters here."
        actions={
          <select className="input w-60" value={action} onChange={(e) => setAction(e.target.value)} aria-label="Filter by action">
            <option value="">All actions</option>
            {ACTIONS.map((a) => (
              <option key={a} value={a}>{a.replaceAll('_', ' ')}</option>
            ))}
          </select>
        }
      />
      {q.isLoading ? (
        <Spinner />
      ) : (
        <div className="card overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>When</th>
                <th>Who</th>
                <th>Action</th>
                <th>Target</th>
                <th>Change</th>
                <th>IP</th>
              </tr>
            </thead>
            <tbody>
              {q.data?.map((a) => (
                <tr key={a.id}>
                  <td className="text-sm whitespace-nowrap">{formatDateTime(a.created_at)}</td>
                  <td className="text-sm">{a.user ?? 'System'}</td>
                  <td>
                    <span className={`pill ${a.action === 'administrator_override' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-700'}`}>
                      {a.action.replaceAll('_', ' ')}
                    </span>
                  </td>
                  <td className="text-sm text-slate-500">{a.entity ? `${a.entity} ${a.entity_id ?? ''}` : '—'}</td>
                  <td className="max-w-md text-xs text-slate-600">
                    {a.old_value != null && <div className="truncate text-rose-600" title={fmt(a.old_value)}>− {fmt(a.old_value)}</div>}
                    {a.new_value != null && <div className="truncate text-emerald-700" title={fmt(a.new_value)}>+ {fmt(a.new_value)}</div>}
                  </td>
                  <td className="text-xs text-slate-400">{a.ip_address}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {q.data?.length === 0 && <p className="py-8 text-center text-sm text-slate-500">No entries.</p>}
        </div>
      )}
    </div>
  )
}
