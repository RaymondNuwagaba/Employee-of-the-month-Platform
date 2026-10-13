import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { ErrorNote, Modal, PageHeader, Spinner } from '../../components/ui'
import { api } from '../../lib/api'
import type { Department } from '../../lib/types'

export default function Departments() {
  const q = useQuery({ queryKey: ['admin-departments'], queryFn: () => api.get<Department[]>('/api/admin/departments') })
  const [editing, setEditing] = useState<Department | 'new' | null>(null)
  return (
    <div>
      <PageHeader
        title="Departments"
        subtitle="Departments from Microsoft Entra ID are added automatically."
        actions={
          <button className="btn-primary" onClick={() => setEditing('new')}>
            <Plus className="size-4" /> Add department
          </button>
        }
      />
      {q.isLoading ? (
        <Spinner />
      ) : (
        <div className="card overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>Name</th>
                <th>Description</th>
                <th className="text-right">Active employees</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {q.data?.map((d) => (
                <tr key={d.id}>
                  <td className="font-semibold">{d.name}</td>
                  <td className="text-sm text-slate-500">{d.description ?? '—'}</td>
                  <td className="text-right tabular-nums">{d.employee_count}</td>
                  <td>{d.is_active ? <span className="pill bg-emerald-50 text-emerald-700">Active</span> : <span className="pill bg-slate-100 text-slate-600">Inactive</span>}</td>
                  <td className="text-right">
                    <button className="btn-ghost px-3 py-1.5 text-sm" onClick={() => setEditing(d)}>Edit</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing && <DeptModal dept={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

function DeptModal({ dept, onClose }: { dept: Department | null; onClose: () => void }) {
  const qc = useQueryClient()
  const [name, setName] = useState(dept?.name ?? '')
  const [description, setDescription] = useState(dept?.description ?? '')
  const [active, setActive] = useState(dept?.is_active ?? true)
  const save = useMutation({
    mutationFn: () => {
      const body = { name, description: description || null, is_active: active }
      return dept ? api.put(`/api/admin/departments/${dept.id}`, body) : api.post('/api/admin/departments', body)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-departments'] })
      onClose()
    },
  })
  return (
    <Modal title={dept ? `Edit ${dept.name}` : 'Add department'} onClose={onClose}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault()
          save.mutate()
        }}
      >
        <div>
          <label className="label" htmlFor="dn">Name</label>
          <input id="dn" className="input" required value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="dd">Description</label>
          <textarea id="dd" className="input" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="size-4 accent-brand-600" checked={active} onChange={(e) => setActive(e.target.checked)} /> Active
        </label>
        <ErrorNote error={save.error} />
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={save.isPending}>Save</button>
        </div>
      </form>
    </Modal>
  )
}
