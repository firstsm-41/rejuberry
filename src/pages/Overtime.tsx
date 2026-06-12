import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../store/useAuth'
import type { Employee, OvertimeEntry } from '../types/database'

import Modal from '../components/Modal'

// 오버타임 확인 표시 그룹 (대표원장/부원장 제외, 총괄실장/실장 묶음)
const MANAGER_OT_GROUPS = [
  { label: '실장팀', depts: ['총괄실장','실장'], color: '#7c3aed' },
  { label: '코디',   depts: ['코디'],             color: '#0369a1' },
  { label: '간호',   depts: ['간호'],              color: '#047857' },
  { label: '피부1(시술)', depts: ['피부1(시술)'],  color: '#9d174d' },
  { label: '피부2(관리)', depts: ['피부2(관리)'],  color: '#92400e' },
  { label: '마케팅', depts: ['마케팅'],            color: '#0f766e' },
  { label: '미분류', depts: ['미분류'],            color: '#6b7280' },
]

const fmtMin = (min: number) => {
  if (min === 0) return '0분'
  const sign = min < 0 ? '-' : ''
  const abs  = Math.abs(min)
  const h = Math.floor(abs / 60)
  const m = abs % 60
  if (h === 0) return `${sign}${m}분`
  if (m === 0) return `${sign}${h}시간`
  return `${sign}${h}시간 ${m}분`
}

const DEPT_COLORS: Record<string, string> = {
  '대표원장':'#1e40af','부원장':'#1d4ed8','총괄실장':'#6d28d9',
  '실장':'#7c3aed','코디':'#0369a1','간호':'#047857',
  '피부1(시술)':'#9d174d','피부2(관리)':'#92400e',
  '마케팅':'#0f766e','미분류':'#6b7280',
}

export default function Overtime() {
  const { profile } = useAuth()
  const isManager = (profile?.level ?? 2) <= 1
  return isManager
    ? <ManagerView selEmpDefault={profile?.employee_id ?? ''} />
    : <StaffView empId={profile?.employee_id ?? ''} />
}

// ─── Manager View ─────────────────────────────────────────────────────────────
function ManagerView({ selEmpDefault }: { selEmpDefault: string }) {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [entries, setEntries] = useState<OvertimeEntry[]>([])
  const [selEmpId, setSelEmpId] = useState('')
  const [addModal, setAddModal] = useState(false)
  const [detailModal, setDetailModal] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const [empsRes, entriesRes] = await Promise.all([
      supabase.from('employees').select('*').eq('status', 'active').order('id'),
      supabase.from('overtime').select('*').order('date', { ascending: false }),
    ])
    setEmployees(empsRes.data || [])
    setEntries(entriesRes.data || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => { setSelEmpId(selEmpDefault) }, [selEmpDefault])

  const getBalance = (empId: string) => {
    const es = entries.filter(e => e.employee_id === empId)
    const earned = es.filter(e => e.type === 'earn').reduce((s, e) => s + Number(e.hours), 0)
    const used   = es.filter(e => e.type === 'use').reduce((s, e) => s + Number(e.hours), 0)
    return { earned, used, remain: earned - used }
  }


  const openDetail = (empId: string) => { setSelEmpId(empId); setDetailModal(true) }

  if (loading) return <div className="flex h-full items-center justify-center text-slate-400">로딩 중...</div>

  const selEmp = employees.find(e => e.id === selEmpId)
  const selEntries = selEmpId ? entries.filter(e => e.employee_id === selEmpId) : []

  return (
    <div className="flex flex-col h-full overflow-auto">
      <div className="p-6 space-y-5">
        {/* 헤더 */}
        <div className="flex justify-end">
          <button onClick={() => setAddModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold">
            + 오버타임 추가
          </button>
        </div>
        {/* 팀별 카드 */}
        {MANAGER_OT_GROUPS.map(group => {
          const groupEmps = employees.filter(e => group.depts.includes(e.dept))
          if (groupEmps.length === 0) return null
          return (
            <div key={group.label}>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: group.color }} />
                <span className="text-xs font-bold" style={{ color: group.color }}>{group.label}</span>
                <span className="text-xs text-slate-400">{groupEmps.length}명</span>
              </div>
              <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}>
                {groupEmps.map(e => {
                  const col = DEPT_COLORS[e.dept] || '#64748b'
                  const bal = getBalance(e.id)
                  const usedPct = bal.earned > 0 ? Math.min(100, Math.round(bal.used / bal.earned * 100)) : 0
                  return (
                    <button key={e.id} onClick={() => openDetail(e.id)}
                      className="bg-white border border-slate-200 rounded-2xl p-4 text-left hover:shadow-md hover:border-slate-300 transition-all group">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                          style={{ background: col }}>{e.name[0]}</div>
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-slate-700 truncate">{e.name}</div>
                          <div className="text-xs text-slate-400 truncate">{e.position}</div>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs">
                          <span className="text-blue-500 font-semibold">+{fmtMin(bal.earned)}</span>
                          <span className="text-amber-500 font-semibold">-{fmtMin(bal.used)}</span>
                        </div>
                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-amber-400 transition-all" style={{ width: `${usedPct}%` }} />
                        </div>
                        <div className={`text-sm font-bold text-right ${bal.remain < 0 ? 'text-red-600' : bal.remain > 0 ? 'text-green-600' : 'text-slate-400'}`}>
                          잔여 {fmtMin(bal.remain)}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* Detail Modal */}
      <Modal open={detailModal} onClose={() => setDetailModal(false)}
        title={selEmp ? `${selEmp.name} 오버타임 내역` : '내역'} size="sm">
        {selEmp && (() => {
          const b = getBalance(selEmp.id)
          return (
            <div className="space-y-4">
              <div className="flex gap-4 text-sm">
                <span className="text-blue-600 font-semibold">적립 {fmtMin(b.earned)}</span>
                <span className="text-amber-600 font-semibold">사용 {fmtMin(b.used)}</span>
                <span className={`font-bold ${b.remain < 0 ? 'text-red-600' : 'text-green-600'}`}>잔여 {fmtMin(b.remain)}</span>
              </div>
              <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto rounded-xl border border-slate-100">
                {selEntries.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-8">내역 없음</p>
                ) : selEntries.map(en => (
                  <div key={en.id} className="flex items-center gap-3 px-4 py-3">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${en.type === 'earn' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                      {en.type === 'earn' ? '적립' : '사용'}
                    </span>
                    <span className="text-sm text-slate-500">{en.date}</span>
                    {en.note && <span className="text-xs text-slate-400 flex-1 truncate">{en.note}</span>}
                    <span className={`text-sm font-bold ml-auto ${en.type === 'earn' ? 'text-blue-600' : 'text-amber-600'}`}>
                      {en.type === 'earn' ? '+' : '-'}{fmtMin(en.hours)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex justify-end">
                <button onClick={() => { setDetailModal(false); setAddModal(true) }}
                  className="text-sm text-blue-600 hover:text-blue-800 font-semibold">+ 항목 추가</button>
              </div>
            </div>
          )
        })()}
      </Modal>

      <OvertimeAddModal
        open={addModal}
        onClose={() => setAddModal(false)}
        employees={employees}
        defaultEmpId={selEmpId}
        onSaved={() => { setAddModal(false); load() }}
      />
    </div>
  )
}

// ─── Staff View ───────────────────────────────────────────────────────────────
function StaffView({ empId }: { empId: string }) {
  const [entries, setEntries] = useState<OvertimeEntry[]>([])
  const [tab, setTab] = useState<'earn' | 'use'>('earn')
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0, 10), hours: '1', note: '' })
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!empId) return
    const { data } = await supabase.from('overtime').select('*')
      .eq('employee_id', empId).order('date', { ascending: false })
    setEntries(data || [])
    setLoading(false)
  }, [empId])

  useEffect(() => { load() }, [load])

  const earned = entries.filter(e => e.type === 'earn').reduce((s, e) => s + Number(e.hours), 0)
  const used   = entries.filter(e => e.type === 'use').reduce((s, e) => s + Number(e.hours), 0)
  const remain = earned - used

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!empId) return
    const hrs = parseFloat(form.hours)
    setSaving(true)
    await supabase.from('overtime').insert([{
      employee_id: empId, date: form.date,
      hours: hrs, type: tab, note: form.note || null,
    }])
    setSaving(false)
    setForm(f => ({ ...f, hours: '1', note: '' }))
    load()
  }

  if (loading) return <div className="flex h-full items-center justify-center text-slate-400">로딩 중...</div>

  return (
    <div className="flex flex-col h-full overflow-auto">
      <div className="p-6 space-y-5">
        {/* Balance */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: '총 적립', value: fmtMin(earned), unit:'', color:'text-blue-600' },
            { label: '총 사용', value: fmtMin(used),   unit:'', color:'text-amber-600' },
            { label: '잔여',    value: fmtMin(remain), unit:'', color: remain < 0 ? 'text-red-600' : remain === 0 ? 'text-slate-400' : 'text-green-600' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-2xl border border-slate-200 p-5 text-center">
              <div className="text-xs text-slate-400 mb-1">{s.label}</div>
              <div className={`text-3xl font-bold ${s.color}`}>
                {s.value}<span className="text-base font-normal text-slate-400 ml-1">{s.unit}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-5 gap-5">
          {/* Form */}
          <div className="col-span-2 bg-white rounded-2xl border border-slate-200 p-5">
            <div className="flex gap-1 bg-slate-100 p-1 rounded-xl mb-4">
              {(['earn', 'use'] as const).map(t => (
                <button key={t} onClick={() => setTab(t)}
                  className={`flex-1 py-1.5 rounded-lg text-sm font-semibold transition-all ${tab === t ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>
                  {t === 'earn' ? '오버타임 등록' : '오버타임 사용'}
                </button>
              ))}
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">날짜</label>
                <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">시간 (분)</label>
                <input type="number" step="1" min="1" value={form.hours}
                  onChange={e => setForm(f => ({ ...f, hours: e.target.value }))} required
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500" />
                {tab === 'use' && <p className="text-xs text-slate-400 mt-1">사용 가능: {fmtMin(remain)}</p>}
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">메모</label>
                <input type="text" value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                  placeholder="선택사항"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500" />
              </div>
              <button type="submit" disabled={saving}
                className={`w-full py-2.5 rounded-xl text-sm font-bold text-white transition-colors disabled:opacity-50 ${tab === 'earn' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-amber-500 hover:bg-amber-600'}`}>
                {saving ? '처리 중...' : tab === 'earn' ? '오버타임 등록' : '오버타임 사용 처리'}
              </button>
            </form>
          </div>

          {/* History */}
          <div className="col-span-3 bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 font-bold text-sm text-slate-700">내역</div>
            <div className="divide-y divide-slate-100 overflow-y-auto" style={{ maxHeight: 400 }}>
              {entries.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-10">내역 없음</p>
              ) : entries.map(en => (
                <div key={en.id} className="flex items-center gap-3 px-4 py-3">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${en.type === 'earn' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                    {en.type === 'earn' ? '적립' : '사용'}
                  </span>
                  <span className="text-sm text-slate-500">{en.date}</span>
                  {en.note && <span className="text-xs text-slate-400 flex-1 truncate">{en.note}</span>}
                  <span className={`text-sm font-bold ml-auto ${en.type === 'earn' ? 'text-blue-600' : 'text-amber-600'}`}>
                    {en.type === 'earn' ? '+' : '-'}{fmtMin(en.hours)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Add Modal (manager only) ─────────────────────────────────────────────────
function OvertimeAddModal({ open, onClose, employees, defaultEmpId, onSaved }:
  { open: boolean; onClose: () => void; employees: Employee[]; defaultEmpId: string; onSaved: () => void }) {
  const td = new Date().toISOString().slice(0, 10)
  const [form, setForm] = useState({ empId: defaultEmpId, date: td, hours: '1', type: 'earn', note: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => { setForm(f => ({ ...f, empId: defaultEmpId })) }, [defaultEmpId, open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.empId) return alert('직원을 선택하세요')
    setSaving(true)
    await supabase.from('overtime').insert([{
      employee_id: form.empId, date: form.date,
      hours: parseFloat(form.hours), type: form.type, note: form.note || null,
    }])
    setSaving(false)
    onSaved()
  }

  return (
    <Modal open={open} onClose={onClose} title="오버타임 추가" size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1.5">직원 *</label>
          <select value={form.empId} onChange={e => setForm(f => ({ ...f, empId: e.target.value }))} required
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none">
            <option value="">선택</option>
            {employees.map(e => <option key={e.id} value={e.id}>{e.name} ({e.dept})</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">날짜</label>
            <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">구분</label>
            <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none">
              <option value="earn">적립</option>
              <option value="use">사용</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">시간 (분)</label>
            <input type="number" step="1" min="1" value={form.hours}
              onChange={e => setForm(f => ({ ...f, hours: e.target.value }))} required
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">메모</label>
            <input type="text" value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
              placeholder="선택사항"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500" />
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
          <button type="button" onClick={onClose}
            className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-4 py-2 rounded-lg text-sm font-semibold">취소</button>
          <button type="submit" disabled={saving}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50">
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
