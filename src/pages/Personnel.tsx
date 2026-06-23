import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../store/useAuth'
import type { Employee } from '../types/database'
import Modal from '../components/Modal'
import { Navigate } from 'react-router-dom'
import { DEPTS, POSITIONS, DEPT_COLORS } from '../constants'

const EMPTY_EMP: Partial<Employee> = {
  id:'', name:'', ssn:'', birth_date:'', phone:'', email:'',
  dept:'실장', position:'', note:'', salary:'', prev_company:'',
  start_date: new Date().toISOString().slice(0,10), end_date:'', status:'active'
}

export default function Personnel() {
  const { profile } = useAuth()
  if ((profile?.level ?? 2) > 1) return <Navigate to="/" replace />

  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)

  // 신규 등록 모달
  const [addModal, setAddModal] = useState(false)
  const [addEmp, setAddEmp] = useState<Partial<Employee>>({ ...EMPTY_EMP })
  const [addError, setAddError] = useState('')
  const [addSaving, setAddSaving] = useState(false)

  // 인라인 편집
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editRow, setEditRow] = useState<Partial<Employee>>({})
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState('')

  const [filter, setFilter] = useState({ search: '', dept: 'all', status: 'active' })
  const [showSecret, setShowSecret] = useState(false)

  // 주민번호 마스킹: 앞 7자리(생년월일+성별)만 표시
  const maskSSN = (ssn?: string | null) => {
    if (!ssn) return '-'
    const p = ssn.split('-')
    if (p.length === 2) return `${p[0]}-${(p[1][0] || '')}${'●'.repeat(Math.max(0, p[1].length - 1))}`
    return ssn.slice(0, 8) + '●'.repeat(Math.max(0, ssn.length - 8))
  }

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

  const startEdit = (emp: Employee) => { setEditingId(emp.id); setEditRow({ ...emp }); setEditError('') }
  const cancelEdit = () => { setEditingId(null); setEditRow({}); setEditError('') }
  const setEF = (k: keyof Employee, v: string) => setEditRow(r => ({ ...r, [k]: v }))

  const saveEdit = async () => {
    if (!editRow.name || !editRow.dept || !editRow.position || !editRow.start_date) {
      setEditError('이름, 소속, 직급, 입사일은 필수입니다'); return
    }
    setEditSaving(true); setEditError('')
    const { error } = await supabase.from('employees').update(editRow).eq('id', editingId!)
    if (error) { setEditError(error.message); setEditSaving(false); return }
    await load(); setEditingId(null); setEditRow({}); setEditSaving(false)
  }

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!addEmp.id || !addEmp.name || !addEmp.dept || !addEmp.position || !addEmp.start_date) {
      setAddError('필수 항목을 모두 입력하세요'); return
    }
    if (employees.find(x => x.id === addEmp.id)) { setAddError('이미 존재하는 사번입니다'); return }
    setAddSaving(true); setAddError('')
    const { error } = await supabase.from('employees').insert([addEmp as Employee])
    if (error) { setAddError(error.message); setAddSaving(false); return }
    await supabase.from('hr_changes').insert([{ employee_id: addEmp.id!, type: 'join', date: addEmp.start_date! }])
    await supabase.from('leave_data').upsert([{ employee_id: addEmp.id!, year: new Date().getFullYear(), total_days: 15 }])
    await load(); setAddModal(false); setAddEmp({ ...EMPTY_EMP }); setAddSaving(false)
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`${name} 직원을 삭제할까요?`)) return
    await supabase.from('employees').delete().eq('id', id); await load()
  }

  const setAF = (k: keyof Employee, v: string) => setAddEmp(r => ({ ...r, [k]: v }))

  if (loading) return <div className="flex h-full items-center justify-center text-slate-400">로딩 중...</div>

  return (
    <div className="flex flex-col h-full overflow-auto">
      <div className="p-4 sm:p-6 space-y-4">
        {/* 필터 바 */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center gap-3 flex-wrap">
          <input
            value={filter.search}
            onChange={e => setFilter(f => ({ ...f, search: e.target.value }))}
            placeholder="이름, 사번, 직급 검색"
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500 w-52"
          />
          <select value={filter.dept} onChange={e => setFilter(f => ({ ...f, dept: e.target.value }))}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none w-36">
            <option value="all">전체 부서</option>
            {DEPTS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <select value={filter.status} onChange={e => setFilter(f => ({ ...f, status: e.target.value }))}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none w-28">
            <option value="active">재직 중</option>
            <option value="retired">퇴사</option>
            <option value="all">전체</option>
          </select>
          <div className="ml-auto flex items-center gap-3">
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <input type="checkbox" checked={showSecret} onChange={e => setShowSecret(e.target.checked)}
                className="w-4 h-4 accent-blue-600" />
              <span className="text-sm text-slate-600 font-medium">민감정보 보기</span>
              <span className="text-xs text-slate-400">(급여·주민번호)</span>
            </label>
            <span className="text-sm text-slate-400">{filtered.length}명</span>
            <button onClick={() => { setAddEmp({ ...EMPTY_EMP }); setAddError(''); setAddModal(true) }}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap">
              + 직원 추가
            </button>
          </div>
        </div>

        {/* 테이블 */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  {['사번','이름','소속','직급','전화번호','이메일','생년월일','주민번호','입사일',
                    '급여(계약)','상태','관리'
                  ].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-bold text-slate-500 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={12} className="text-center text-slate-400 py-12 text-sm">직원이 없습니다</td></tr>
                ) : filtered.map(emp => {
                  const isEditing = editingId === emp.id
                  const col = DEPT_COLORS[isEditing ? (editRow.dept || emp.dept) : emp.dept] || '#64748b'

                  if (isEditing) {
                    return (
                      <tr key={emp.id} className="border-b border-blue-100 bg-blue-50/40">
                        <td className="px-4 py-2 font-mono text-xs text-slate-400">{emp.id}</td>
                        <td className="px-2 py-2">
                          <input value={editRow.name||''} onChange={e=>setEF('name',e.target.value)}
                            className="w-20 border border-blue-300 rounded-lg px-2 py-1.5 text-sm outline-none" />
                        </td>
                        <td className="px-2 py-2">
                          <select value={editRow.dept||''} onChange={e=>setEF('dept',e.target.value)}
                            className="border border-blue-300 rounded-lg px-2 py-1.5 text-sm outline-none">
                            {DEPTS.map(d=><option key={d} value={d}>{d}</option>)}
                          </select>
                        </td>
                        <td className="px-2 py-2">
                          <input list="pos-edit" value={editRow.position||''} onChange={e=>setEF('position',e.target.value)}
                            className="w-28 border border-blue-300 rounded-lg px-2 py-1.5 text-sm outline-none" />
                          <datalist id="pos-edit">{POSITIONS.map(p=><option key={p} value={p}/>)}</datalist>
                        </td>
                        <td className="px-2 py-2">
                          <input value={editRow.phone||''} onChange={e=>setEF('phone',e.target.value)} placeholder="010-"
                            className="w-28 border border-blue-300 rounded-lg px-2 py-1.5 text-sm outline-none" />
                        </td>
                        <td className="px-2 py-2">
                          <input type="email" value={editRow.email||''} onChange={e=>setEF('email',e.target.value)}
                            className="w-32 border border-blue-300 rounded-lg px-2 py-1.5 text-sm outline-none" />
                        </td>
                        <td className="px-2 py-2">
                          <input type="date" value={editRow.birth_date||''} onChange={e=>setEF('birth_date',e.target.value)}
                            className="border border-blue-300 rounded-lg px-2 py-1.5 text-sm outline-none" />
                        </td>
                        <td className="px-2 py-2">
                          <input value={editRow.ssn||''} onChange={e=>setEF('ssn',e.target.value)} placeholder="000000-0000000"
                            className="w-32 border border-blue-300 rounded-lg px-2 py-1.5 text-sm outline-none" />
                        </td>
                        <td className="px-2 py-2">
                          <input type="date" value={editRow.start_date||''} onChange={e=>setEF('start_date',e.target.value)}
                            className="border border-blue-300 rounded-lg px-2 py-1.5 text-sm outline-none" />
                        </td>
                        <td className="px-2 py-2">
                          <input value={editRow.salary||''} onChange={e=>setEF('salary',e.target.value)}
                            className="w-24 border border-blue-300 rounded-lg px-2 py-1.5 text-sm outline-none" />
                        </td>
                        <td className="px-2 py-2">
                          <select value={editRow.status||'active'} onChange={e=>setEF('status',e.target.value)}
                            className="border border-blue-300 rounded-lg px-2 py-1.5 text-sm outline-none">
                            <option value="active">재직</option>
                            <option value="retired">퇴사</option>
                          </select>
                        </td>
                        <td className="px-2 py-2">
                          <div className="flex flex-col gap-1">
                            {editError && <span className="text-xs text-red-500">{editError}</span>}
                            <div className="flex gap-1">
                              <button onClick={saveEdit} disabled={editSaving}
                                className="text-xs bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold px-3 py-1.5 rounded-lg">
                                {editSaving ? '저장 중' : '저장'}
                              </button>
                              <button onClick={cancelEdit}
                                className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold px-3 py-1.5 rounded-lg">
                                취소
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )
                  }

                  return (
                    <tr key={emp.id} className="hover:bg-slate-50 border-b border-slate-100 last:border-0">
                      <td className="px-4 py-3 font-mono text-xs text-slate-400">{emp.id}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                            style={{background:col}}>{emp.name[0]}</div>
                          <span className="font-semibold text-sm text-slate-800">{emp.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-semibold px-2 py-1 rounded-md"
                          style={{background:col+'18',color:col}}>{emp.dept}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">{emp.position}</td>
                      <td className="px-4 py-3 text-sm text-slate-500">{emp.phone||'-'}</td>
                      <td className="px-4 py-3 text-sm text-slate-500">{emp.email||'-'}</td>
                      <td className="px-4 py-3 text-sm text-slate-500">{emp.birth_date||'-'}</td>
                      <td className="px-4 py-3 text-sm text-slate-500 font-mono whitespace-nowrap">
                        {showSecret ? (emp.ssn||'-') : maskSSN(emp.ssn)}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-500">{emp.start_date}</td>
                      <td className="px-4 py-3 text-sm font-medium">
                        {showSecret
                          ? <span className="text-slate-600">{emp.salary||'-'}</span>
                          : <span className="text-slate-400 tracking-widest">{emp.salary?'●●●●●':'-'}</span>
                        }
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${emp.status==='active'?'bg-green-100 text-green-700':'bg-red-100 text-red-700'}`}>
                          {emp.status==='active'?'재직':'퇴사'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1.5">
                          <button onClick={()=>startEdit(emp)}
                            className="text-xs text-blue-600 hover:text-blue-800 font-medium px-2 py-1 rounded hover:bg-blue-50">수정</button>
                          <button onClick={()=>handleDelete(emp.id,emp.name)}
                            className="text-xs text-red-500 hover:text-red-700 font-medium px-2 py-1 rounded hover:bg-red-50">삭제</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 신규 등록 모달 */}
      <Modal open={addModal} onClose={()=>{setAddModal(false);setAddError('')}} title="신규 직원 등록">
        <form onSubmit={handleAdd} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="사번 *">
              <input value={addEmp.id||''} onChange={e=>setAF('id',e.target.value)} required
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500" />
            </Field>
            <Field label="성명 *">
              <input value={addEmp.name||''} onChange={e=>setAF('name',e.target.value)} required
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500" />
            </Field>
            <Field label="주민등록번호">
              <input value={addEmp.ssn||''} onChange={e=>setAF('ssn',e.target.value)} placeholder="000000-0000000"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500" />
            </Field>
            <Field label="생년월일">
              <input type="date" value={addEmp.birth_date||''} onChange={e=>setAF('birth_date',e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500" />
            </Field>
            <Field label="전화번호">
              <input value={addEmp.phone||''} onChange={e=>setAF('phone',e.target.value)} placeholder="010-0000-0000"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500" />
            </Field>
            <Field label="이메일">
              <input type="email" value={addEmp.email||''} onChange={e=>setAF('email',e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500" />
            </Field>
            <Field label="소속 *">
              <select value={addEmp.dept||''} onChange={e=>setAF('dept',e.target.value)} required
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none">
                {DEPTS.map(d=><option key={d} value={d}>{d}</option>)}
              </select>
            </Field>
            <Field label="직급 *">
              <input list="pos-add" value={addEmp.position||''} onChange={e=>setAF('position',e.target.value)} required
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500" />
              <datalist id="pos-add">{POSITIONS.map(p=><option key={p} value={p}/>)}</datalist>
            </Field>
            <Field label="급여(계약)">
              <input value={addEmp.salary||''} onChange={e=>setAF('salary',e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500" />
            </Field>
            <Field label="이전 직장">
              <input value={addEmp.prev_company||''} onChange={e=>setAF('prev_company',e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500" />
            </Field>
            <Field label="입사일 *">
              <input type="date" value={addEmp.start_date||''} onChange={e=>setAF('start_date',e.target.value)} required
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500" />
            </Field>
            <Field label="퇴사일">
              <input type="date" value={addEmp.end_date||''} onChange={e=>setAF('end_date',e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500" />
            </Field>
            <Field label="재직 상태">
              <select value={addEmp.status||'active'} onChange={e=>setAF('status',e.target.value as 'active'|'retired')}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none">
                <option value="active">재직 중</option>
                <option value="retired">퇴사</option>
              </select>
            </Field>
            <Field label="비고" className="col-span-2">
              <input value={addEmp.note||''} onChange={e=>setAF('note',e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500" />
            </Field>
          </div>
          {addError && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-2">{addError}</p>}
          <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
            <button type="button" onClick={()=>{setAddModal(false);setAddError('')}}
              className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-4 py-2 rounded-lg text-sm font-semibold">취소</button>
            <button type="submit" disabled={addSaving}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-2 rounded-lg text-sm font-semibold">
              {addSaving?'저장 중...':'등록'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

function Field({ label, children, className='' }: { label:string; children:React.ReactNode; className?:string }) {
  return (
    <div className={className}>
      <label className="block text-xs font-semibold text-slate-500 mb-1.5">{label}</label>
      {children}
    </div>
  )
}
