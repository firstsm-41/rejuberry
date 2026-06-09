import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../store/useAuth'
import type { Employee } from '../types/database'
import PageHeader from '../components/PageHeader'
import Modal from '../components/Modal'

const DEPTS = ['대표원장','부원장','총괄실장','실장','코디','간호','피부1(시술)','피부2(관리)','마케팅','미분류']
const POSITIONS = ['대표원장','부원장','총괄실장','상담실장','VIP실장','코디네이터','간호팀장','간호조무사','간호사','피부1팀 팀장','피부2팀 팀장','피부관리사','마케팅팀 이사','마케팅팀 실장','마케팅팀 디자이너','청소','기타']
const DEPT_COLORS: Record<string, string> = {
  '대표원장':'#1e40af','부원장':'#1d4ed8','총괄실장':'#6d28d9',
  '실장':'#7c3aed','코디':'#0369a1','간호':'#047857',
  '피부1(시술)':'#9d174d','피부2(관리)':'#92400e',
  '마케팅':'#0f766e','미분류':'#6b7280',
}

const EMPTY_EMP: Partial<Employee> = {
  id:'', name:'', ssn:'', birth_date:'', phone:'', email:'',
  dept:'실장', position:'', note:'', salary:'', prev_company:'',
  start_date: new Date().toISOString().slice(0,10), end_date:'', status:'active'
}

export default function Employees() {
  const { profile } = useAuth()
  const canEdit = (profile?.level ?? 2) <= 1
  const canViewSensitive = (profile?.level ?? 2) <= 1  // 급여·주민번호: 운영자+만

  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<{ open: boolean; emp: Partial<Employee>; isEdit: boolean }>({
    open: false, emp: EMPTY_EMP, isEdit: false
  })
  const [filter, setFilter] = useState({ search: '', dept: 'all', status: 'active' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = async () => {
    const { data } = await supabase.from('employees').select('*').order('id')
    setEmployees(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const filtered = employees.filter(e => {
    if (filter.status !== 'all' && e.status !== filter.status) return false
    if (filter.dept !== 'all' && e.dept !== filter.dept) return false
    if (filter.search && !e.name.includes(filter.search) && !e.id.includes(filter.search) && !e.position.includes(filter.search)) return false
    return true
  })

  const openAdd = () => setModal({ open: true, emp: { ...EMPTY_EMP }, isEdit: false })
  const openEdit = (emp: Employee) => setModal({ open: true, emp: { ...emp }, isEdit: true })
  const closeModal = () => { setModal(m => ({ ...m, open: false })); setError('') }

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const { emp, isEdit } = modal
    if (!emp.id || !emp.name || !emp.dept || !emp.position || !emp.start_date) {
      return setError('필수 항목을 모두 입력하세요')
    }
    setSaving(true); setError('')
    try {
      if (isEdit) {
        const { error } = await supabase.from('employees').update(emp).eq('id', emp.id!)
        if (error) throw error
      } else {
        const existing = employees.find(x => x.id === emp.id)
        if (existing) { setError('이미 존재하는 사번입니다'); setSaving(false); return }
        const { error } = await supabase.from('employees').insert([emp as Employee])
        if (error) throw error
        // Auto-add HR change
        await supabase.from('hr_changes').insert([{ employee_id: emp.id!, type: 'join', date: emp.start_date! }])
        // Init leave data
        await supabase.from('leave_data').upsert([{ employee_id: emp.id!, year: new Date().getFullYear(), total_days: 15 }])
      }
      await load(); closeModal()
    } catch (err: any) {
      setError(err.message || '저장 실패')
    }
    setSaving(false)
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`${name} 직원을 삭제할까요?`)) return
    await supabase.from('employees').delete().eq('id', id)
    await load()
  }

  const setField = (k: keyof Employee, v: string) =>
    setModal(m => ({ ...m, emp: { ...m.emp, [k]: v } }))

  if (loading) return <div className="flex h-full items-center justify-center text-slate-400">로딩 중...</div>

  return (
    <div className="flex flex-col h-full overflow-auto">
      <PageHeader
        title="직원 명단"
        action={canEdit && (
          <button onClick={openAdd} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold">
            + 직원 추가
          </button>
        )}
      />
      <div className="p-6 space-y-4">
        {/* Filter */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center gap-3 flex-wrap">
          <input
            value={filter.search}
            onChange={e => setFilter(f => ({ ...f, search: e.target.value }))}
            placeholder="이름, 사번, 직급 검색"
            className="border-1.5 border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500 w-52"
          />
          <select value={filter.dept} onChange={e => setFilter(f => ({ ...f, dept: e.target.value }))}
            className="border-1.5 border-slate-200 rounded-lg px-3 py-2 text-sm outline-none w-36">
            <option value="all">전체 부서</option>
            {DEPTS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <select value={filter.status} onChange={e => setFilter(f => ({ ...f, status: e.target.value }))}
            className="border-1.5 border-slate-200 rounded-lg px-3 py-2 text-sm outline-none w-28">
            <option value="active">재직 중</option>
            <option value="retired">퇴사</option>
            <option value="all">전체</option>
          </select>
          <span className="text-sm text-slate-400 ml-auto">{filtered.length}명</span>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  {['사번','이름','소속','직급','전화번호','이메일','입사일', canViewSensitive ? '급여(계약)' : null,'상태',canEdit?'관리':''].filter(Boolean).map(h => (
                    <th key={h} className="bg-slate-50 px-4 py-3 text-left text-xs font-bold text-slate-500 border-b border-slate-200 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={9} className="text-center text-slate-400 py-12 text-sm">직원이 없습니다</td></tr>
                ) : filtered.map(e => {
                  const col = DEPT_COLORS[e.dept] || '#64748b'
                  return (
                    <tr key={e.id} className="hover:bg-slate-50 border-b border-slate-100 last:border-0">
                      <td className="px-4 py-3 font-mono text-xs text-slate-400">{e.id}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ background: col }}>{e.name[0]}</div>
                          <span className="font-semibold text-sm text-slate-800">{e.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-semibold px-2 py-1 rounded-md" style={{ background: col + '18', color: col }}>{e.dept}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">{e.position}</td>
                      <td className="px-4 py-3 text-sm text-slate-500">{e.phone || '-'}</td>
                      <td className="px-4 py-3 text-sm text-slate-500">{e.email || '-'}</td>
                      <td className="px-4 py-3 text-sm text-slate-500">{e.start_date}</td>
                      {canViewSensitive && (
                        <td className="px-4 py-3 text-sm text-slate-600 font-medium">{e.salary || '-'}</td>
                      )}
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${e.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {e.status === 'active' ? '재직' : '퇴사'}
                        </span>
                      </td>
                      {canEdit && (
                        <td className="px-4 py-3">
                          <div className="flex gap-1.5">
                            <button onClick={() => openEdit(e)} className="text-xs text-blue-600 hover:text-blue-800 font-medium px-2 py-1 rounded hover:bg-blue-50">수정</button>
                            <button onClick={() => handleDelete(e.id, e.name)} className="text-xs text-red-500 hover:text-red-700 font-medium px-2 py-1 rounded hover:bg-red-50">삭제</button>
                          </div>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal */}
      <Modal open={modal.open} onClose={closeModal} title={modal.isEdit ? '직원 정보 수정' : '신규 직원 등록'}>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="사번 *">
              <input value={modal.emp.id || ''} onChange={e => setField('id', e.target.value)}
                readOnly={modal.isEdit} required
                className={`w-full border-1.5 border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500 ${modal.isEdit ? 'bg-slate-50' : ''}`} />
            </Field>
            <Field label="성명 *">
              <input value={modal.emp.name || ''} onChange={e => setField('name', e.target.value)} required
                className="w-full border-1.5 border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500" />
            </Field>
            {canViewSensitive ? (
              <Field label="주민등록번호">
                <input value={modal.emp.ssn || ''} onChange={e => setField('ssn', e.target.value)} placeholder="000000-0000000"
                  className="w-full border-1.5 border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500" />
              </Field>
            ) : (
              <Field label="주민등록번호">
                <div className="w-full border-1.5 border-slate-100 rounded-lg px-3 py-2 text-sm bg-slate-50 text-slate-400">열람 권한 없음</div>
              </Field>
            )}
            <Field label="생년월일">
              <input type="date" value={modal.emp.birth_date || ''} onChange={e => setField('birth_date', e.target.value)}
                readOnly={!canViewSensitive}
                className={`w-full border-1.5 border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500 ${!canViewSensitive ? 'bg-slate-50' : ''}`} />
            </Field>
            <Field label="전화번호">
              <input value={modal.emp.phone || ''} onChange={e => setField('phone', e.target.value)} placeholder="010-0000-0000"
                className="w-full border-1.5 border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500" />
            </Field>
            <Field label="이메일">
              <input type="email" value={modal.emp.email || ''} onChange={e => setField('email', e.target.value)}
                className="w-full border-1.5 border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500" />
            </Field>
            <Field label="소속 *">
              <select value={modal.emp.dept || ''} onChange={e => setField('dept', e.target.value)} required
                className="w-full border-1.5 border-slate-200 rounded-lg px-3 py-2 text-sm outline-none">
                {DEPTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </Field>
            <Field label="직급 *">
              <input list="pos-list" value={modal.emp.position || ''} onChange={e => setField('position', e.target.value)} required
                className="w-full border-1.5 border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500" />
              <datalist id="pos-list">{POSITIONS.map(p => <option key={p} value={p} />)}</datalist>
            </Field>
            {canViewSensitive ? (
              <Field label="급여(계약)">
                <input value={modal.emp.salary || ''} onChange={e => setField('salary', e.target.value)}
                  className="w-full border-1.5 border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500" />
              </Field>
            ) : (
              <Field label="급여(계약)">
                <div className="w-full border-1.5 border-slate-100 rounded-lg px-3 py-2 text-sm bg-slate-50 text-slate-400">열람 권한 없음</div>
              </Field>
            )}
            <Field label="이전 직장">
              <input value={modal.emp.prev_company || ''} onChange={e => setField('prev_company', e.target.value)}
                className="w-full border-1.5 border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500" />
            </Field>
            <Field label="입사일 *">
              <input type="date" value={modal.emp.start_date || ''} onChange={e => setField('start_date', e.target.value)} required
                className="w-full border-1.5 border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500" />
            </Field>
            <Field label="퇴사일">
              <input type="date" value={modal.emp.end_date || ''} onChange={e => setField('end_date', e.target.value)}
                className="w-full border-1.5 border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500" />
            </Field>
            <Field label="재직 상태">
              <select value={modal.emp.status || 'active'} onChange={e => setField('status', e.target.value as 'active' | 'retired')}
                className="w-full border-1.5 border-slate-200 rounded-lg px-3 py-2 text-sm outline-none">
                <option value="active">재직 중</option>
                <option value="retired">퇴사</option>
              </select>
            </Field>
            <Field label="비고" className="col-span-2">
              <input value={modal.emp.note || ''} onChange={e => setField('note', e.target.value)}
                className="w-full border-1.5 border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500" />
            </Field>
          </div>
          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-2">{error}</p>}
          <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
            <button type="button" onClick={closeModal} className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-4 py-2 rounded-lg text-sm font-semibold">취소</button>
            <button type="submit" disabled={saving} className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-2 rounded-lg text-sm font-semibold">
              {saving ? '저장 중...' : modal.isEdit ? '저장' : '등록'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

function Field({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="block text-xs font-semibold text-slate-500 mb-1.5">{label}</label>
      {children}
    </div>
  )
}
