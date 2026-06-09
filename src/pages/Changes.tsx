import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../store/useAuth'
import type { HrChange, Employee } from '../types/database'
import PageHeader from '../components/PageHeader'
import Modal from '../components/Modal'

const DEPT_COLORS: Record<string, string> = {
  '대표원장':'#1e40af','부원장':'#1d4ed8','총괄실장':'#6d28d9',
  '실장':'#7c3aed','코디':'#0369a1','간호':'#047857',
  '피부1(시술)':'#9d174d','피부2(관리)':'#92400e',
  '마케팅':'#0f766e','미분류':'#6b7280',
}
const DEPTS = ['대표원장','부원장','총괄실장','실장','코디','간호','피부1(시술)','피부2(관리)','마케팅','미분류']
const POSITIONS = ['대표원장','부원장','총괄실장','상담실장','VIP실장','코디네이터','간호팀장','간호조무사','간호사','피부1팀 팀장','피부2팀 팀장','피부관리사','마케팅팀 이사','마케팅팀 실장','마케팅팀 디자이너','청소','기타']

export default function Changes() {
  const { profile } = useAuth()
  const canEdit = (profile?.level ?? 2) <= 1

  const [changes, setChanges] = useState<HrChange[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({
    type: 'join' as 'join' | 'leave',
    date: new Date().toISOString().slice(0, 10),
    note: '',
    // join
    newName: '', newDept: '실장', newPos: '',
    // leave
    empId: '',
  })
  const [saving, setSaving] = useState(false)

  const load = async () => {
    const [chRes, emRes] = await Promise.all([
      supabase.from('hr_changes').select('*').order('date', { ascending: false }),
      supabase.from('employees').select('*').order('id'),
    ])
    setChanges(chRes.data || [])
    setEmployees(emRes.data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const joins = changes.filter(c => c.type === 'join')
  const leaves = changes.filter(c => c.type === 'leave')

  const nextId = () => {
    const ids = employees.map(e => parseInt(e.id) || 0)
    return String(Math.max(0, ...ids) + 1).padStart(4, '0')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      if (form.type === 'join') {
        if (!form.newName.trim()) { alert('이름을 입력하세요'); return }
        const id = nextId()
        await supabase.from('employees').insert([{
          id, name: form.newName.trim(), dept: form.newDept,
          position: form.newPos.trim() || form.newDept,
          start_date: form.date, status: 'active',
        }])
        await supabase.from('hr_changes').insert([{ employee_id: id, type: 'join', date: form.date, note: form.note || null }])
        await supabase.from('leave_data').insert([{ employee_id: id, year: new Date().getFullYear(), total_days: 15 }])
      } else {
        if (!form.empId) { alert('직원을 선택하세요'); return }
        await supabase.from('employees').update({ status: 'retired', end_date: form.date }).eq('id', form.empId)
        await supabase.from('hr_changes').insert([{ employee_id: form.empId, type: 'leave', date: form.date, note: form.note || null }])
      }
      setModal(false)
      await load()
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="flex h-full items-center justify-center text-slate-400">로딩 중...</div>

  return (
    <div className="flex flex-col h-full overflow-auto">
      <PageHeader title="입퇴사 관리" action={canEdit && (
        <button onClick={() => setModal(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold">+ 입퇴사 등록</button>
      )} />
      <div className="p-6 space-y-4">
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: '전체 기록', val: changes.length, color: 'text-slate-700' },
            { label: '입사', val: joins.length, color: 'text-blue-600' },
            { label: '퇴사', val: leaves.length, color: 'text-red-500' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-2xl border border-slate-200 p-5 text-center">
              <div className="text-xs text-slate-400 mb-1">{s.label}</div>
              <div className={`text-2xl font-bold ${s.color}`}>{s.val}건</div>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <table className="w-full border-collapse">
            <thead><tr>{['날짜','구분','사번','이름','소속','직급','메모'].map(h => (
              <th key={h} className="bg-slate-50 px-4 py-3 text-left text-xs font-bold text-slate-500 border-b border-slate-200">{h}</th>
            ))}</tr></thead>
            <tbody>
              {changes.length === 0 ? (
                <tr><td colSpan={7} className="text-center text-slate-400 py-10 text-sm">내역 없음</td></tr>
              ) : changes.map(c => {
                const emp = employees.find(e => e.id === c.employee_id)
                const col = DEPT_COLORS[emp?.dept || ''] || '#64748b'
                return (
                  <tr key={c.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm font-medium">{c.date}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${c.type === 'join' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {c.type === 'join' ? '입사' : '퇴사'}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-400">{c.employee_id}</td>
                    <td className="px-4 py-3 font-semibold text-sm">{emp?.name || '-'}</td>
                    <td className="px-4 py-3">
                      {emp && <span className="text-xs px-2 py-0.5 rounded" style={{ background: col + '15', color: col }}>{emp.dept}</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500">{emp?.position || '-'}</td>
                    <td className="px-4 py-3 text-sm text-slate-400">{c.note || '-'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title="입퇴사 등록" size="sm">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">구분</label>
            <div className="flex gap-2">
              {(['join','leave'] as const).map(t => (
                <button key={t} type="button" onClick={() => setForm(f => ({ ...f, type: t }))}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition-all ${form.type === t ? (t === 'join' ? 'bg-blue-600 border-blue-600 text-white' : 'bg-red-500 border-red-500 text-white') : 'border-slate-200 text-slate-500'}`}>
                  {t === 'join' ? '입사' : '퇴사'}
                </button>
              ))}
            </div>
          </div>

          {form.type === 'join' ? (
            <div className="space-y-3">
              <div className="bg-blue-50 rounded-xl p-3 text-xs text-blue-700">입사 등록 시 직원이 자동으로 생성됩니다.</div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">이름 *</label>
                <input value={form.newName} onChange={e => setForm(f => ({ ...f, newName: e.target.value }))} required
                  className="w-full border-1.5 border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">소속</label>
                  <select value={form.newDept} onChange={e => setForm(f => ({ ...f, newDept: e.target.value }))}
                    className="w-full border-1.5 border-slate-200 rounded-lg px-3 py-2 text-sm outline-none">
                    {DEPTS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">직급</label>
                  <input list="pos-list-ch" value={form.newPos} onChange={e => setForm(f => ({ ...f, newPos: e.target.value }))}
                    className="w-full border-1.5 border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500" />
                  <datalist id="pos-list-ch">{POSITIONS.map(p => <option key={p} value={p} />)}</datalist>
                </div>
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">직원 선택 *</label>
              <select value={form.empId} onChange={e => setForm(f => ({ ...f, empId: e.target.value }))} required
                className="w-full border-1.5 border-slate-200 rounded-lg px-3 py-2 text-sm outline-none">
                <option value="">선택</option>
                {employees.filter(e => e.status === 'active').map(e => (
                  <option key={e.id} value={e.id}>{e.name} ({e.dept})</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">날짜 *</label>
            <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required
              className="w-full border-1.5 border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">메모</label>
            <input value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
              className="w-full border-1.5 border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500" />
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
            <button type="button" onClick={() => setModal(false)} className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-4 py-2 rounded-lg text-sm font-semibold">취소</button>
            <button type="submit" disabled={saving} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold">
              {saving ? '처리 중...' : '등록'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
