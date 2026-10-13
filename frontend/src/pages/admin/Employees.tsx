import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Search, UserPlus } from 'lucide-react'
import { useState } from 'react'
import { Avatar, ErrorNote, Modal, PageHeader, Spinner } from '../../components/ui'
import { api } from '../../lib/api'
import { isAdmin, useAuth } from '../../lib/auth'
import { formatDate } from '../../lib/format'
import type { Department, Role, User } from '../../lib/types'

const ROLE_LABEL: Record<Role, string> = { employee: 'Employee', hr: 'HR / Management', admin: 'Administrator' }

export default function Employees() {
  const { user: me } = useAuth()
  const admin = isAdmin(me)
  const people = useQuery({ queryKey: ['admin-employees'], queryFn: () => api.get<User[]>('/api/admin/employees') })
  const depts = useQuery({ queryKey: ['admin-departments'], queryFn: () => api.get<Department[]>('/api/admin/departments') })
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState<User | 'new' | null>(null)

  const list = (people.data ?? []).filter((p) => `${p.full_name} ${p.email} ${p.department ?? ''}`.toLowerCase().includes(q.toLowerCase()))

  return (
    <div>
      <PageHeader
        title="Employees"
        subtitle="Accounts are created automatically on first Microsoft sign-in. Adjust eligibility and roles here."
        actions={
          admin && (
            <button className="btn-primary" onClick={() => setEditing('new')}>
              <UserPlus className="size-4" /> Add employee
            </button>
          )
        }
      />
      <label className="relative mb-4 block max-w-sm">
        <span className="sr-only">Search employees</span>
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-slate-400" />
        <input className="input pl-10" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
      </label>
      {people.isLoading ? (
        <Spinner />
      ) : (
        <div className="card overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>Name</th>
                <th>Department</th>
                <th>Role</th>
                <th>Hired</th>
                <th>Status</th>
                {admin && <th />}
              </tr>
            </thead>
            <tbody>
              {list.map((p) => (
                <tr key={p.id} className={p.is_active ? '' : 'opacity-55'}>
                  <td>
                    <div className="flex items-center gap-2.5">
                      <Avatar user={p} size={32} />
                      <div className="min-w-0">
                        <div className="truncate font-semibold">{p.full_name}</div>
                        <div className="truncate text-xs text-slate-500">{p.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="text-sm">
                    {p.department ?? '—'}
                    <div className="text-xs text-slate-500">{p.job_title}</div>
                  </td>
                  <td className="text-sm">{ROLE_LABEL[p.role]}</td>
                  <td className="text-sm whitespace-nowrap">{p.hire_date ? formatDate(p.hire_date) : '—'}</td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      {p.is_active ? <span className="pill bg-emerald-50 text-emerald-700">Active</span> : <span className="pill bg-slate-100 text-slate-600">Disabled</span>}
                      {!p.is_eligible && <span className="pill bg-amber-50 text-amber-700">Not eligible</span>}
                    </div>
                  </td>
                  {admin && (
                    <td className="text-right">
                      <button className="btn-ghost px-3 py-1.5 text-sm" onClick={() => setEditing(p)}>Edit</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing && <EmployeeModal person={editing === 'new' ? null : editing} departments={depts.data ?? []} onClose={() => setEditing(null)} />}
    </div>
  )
}

function EmployeeModal({ person, departments, onClose }: { person: User | null; departments: Department[]; onClose: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    full_name: person?.full_name ?? '',
    email: person?.email ?? '',
    employee_id: person?.employee_id ?? '',
    job_title: person?.job_title ?? '',
    department_id: person?.department_id ? String(person.department_id) : '',
    role: person?.role ?? ('employee' as Role),
    hire_date: person?.hire_date ?? '',
    is_active: person?.is_active ?? true,
    is_eligible: person?.is_eligible ?? true,
  })
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }))

  const save = useMutation({
    mutationFn: () => {
      const body = {
        full_name: form.full_name,
        employee_id: form.employee_id || null,
        job_title: form.job_title || null,
        department_id: form.department_id ? Number(form.department_id) : null,
        role: form.role,
        hire_date: form.hire_date || null,
      }
      return person
        ? api.patch(`/api/admin/employees/${person.id}`, { ...body, is_active: form.is_active, is_eligible: form.is_eligible })
        : api.post('/api/admin/employees', { ...body, email: form.email })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-employees'] })
      onClose()
    },
  })

  return (
    <Modal title={person ? `Edit ${person.full_name}` : 'Add employee'} onClose={onClose}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault()
          save.mutate()
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label" htmlFor="fn">Full name</label>
            <input id="fn" className="input" required value={form.full_name} onChange={(e) => set('full_name', e.target.value)} />
          </div>
          {!person && (
            <div className="sm:col-span-2">
              <label className="label" htmlFor="em">Work email</label>
              <input id="em" type="email" className="input" required value={form.email} onChange={(e) => set('email', e.target.value)} />
            </div>
          )}
          <div>
            <label className="label" htmlFor="dp">Department</label>
            <select id="dp" className="input" value={form.department_id} onChange={(e) => set('department_id', e.target.value)}>
              <option value="">—</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="jt">Job title</label>
            <input id="jt" className="input" value={form.job_title} onChange={(e) => set('job_title', e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="eid">Employee ID</label>
            <input id="eid" className="input" value={form.employee_id} onChange={(e) => set('employee_id', e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="hd">Hire date</label>
            <input id="hd" type="date" className="input" value={form.hire_date} onChange={(e) => set('hire_date', e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="rl">Role</label>
            <select id="rl" className="input" value={form.role} onChange={(e) => set('role', e.target.value as Role)}>
              {Object.entries(ROLE_LABEL).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-500">If Entra ID groups are configured, roles are re-synced from groups on each sign-in.</p>
          </div>
        </div>
        {person && (
          <div className="flex flex-wrap gap-5 pt-1 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" className="size-4 accent-brand-600" checked={form.is_active} onChange={(e) => set('is_active', e.target.checked)} />
              Active (can sign in)
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" className="size-4 accent-brand-600" checked={form.is_eligible} onChange={(e) => set('is_eligible', e.target.checked)} />
              Eligible to be nominated
            </label>
          </div>
        )}
        <ErrorNote error={save.error} />
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={save.isPending}>Save</button>
        </div>
      </form>
    </Modal>
  )
}
