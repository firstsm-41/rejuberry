import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../store/useAuth'
import type { Employee, LeaveData, LeaveEntry, LeaveRequest } from '../types/database'
import PageHeader from '../components/PageHeader'
import Modal from '../components/Modal'

const DEPT_COLORS: Record<string, string> = {
  '대표원장':'#1e40af','부원장':'#1d4ed8','총괄실장':'#6d28d9',
  '실장':'#7c3aed','코디':'#0369a1','간호':'#047857',
  '피부1(시술)':'#9d174d','피부2(관리)':'#92400e',
}

type Tab = 'summary' | 'requests'
type ReqFilter = 'all' | 'pending' | 'approved' | 'rejected'

export default function Leave() {
  const { profile } = useAuth()
  const canEdit = (profile?.level ?? 2) <= 1
  const curYear = new Date().getFullYear()

  const [tab, setTab] = useState<Tab>('summary')
  const [reqFilter, setReqFilter] = useState<ReqFilter>('all')
  const [employees, setEmployees] = useState<Employee[]>([])
  const [leaveData, setLeaveData] = useState<Record<string, LeaveData>>({})
  const [leaveEntries, setLeaveEntries] = useState<Record<string, LeaveEntry[]>>({})
  const [requests, setRequests] = useState<LeaveRequest[]>([])
  const [selEmpId, setSelEmpId] = useState('')
  const [year, setYear] = useState(curYear)
  const [loading, setLoading] = useState(true)
  const [reqModal, setReqModal] = useState(false)

  const load = useCallback(async () => {
    const [empsRes, ldRes, leRes, reqRes] = await Promise.all([
      supabase.from('employees').select('*').eq('status', 'active').order('id'),
      supabase.from('leave_data').select('*').eq('year', year),
      supabase.from('leave_entries').select('*').eq('year', year).order('start_date'),
      supabase.from('leave_requests').select('*, employees(name,dept,position)').order('created_at', { ascending: false }),
    ])
    setEmployees(empsRes.data || [])
    const ldMap: Record<string, LeaveData> = {}
    ;(ldRes.data as LeaveData[] || []).forEach(d => { ldMap[d.employee_id] = d })
    setLeaveData(ldMap)
    const leMap: Record<string, LeaveEntry[]> = {}
    ;(leRes.data as LeaveEntry[] || []).forEach(e => {
      if (!leMap[e.employee_id]) leMap[e.employee_id] = []
      leMap[e.employee_id].push(e)
    })
    setLeaveEntries(leMap)
    setRequests(reqRes.data || [])
    setLoading(false)
  }, [year])

  useEffect(() => { load() }, [load])

  const pendingCount = requests.filter(r => r.status === 'pending').length
  const shown = requests.filter(r => reqFilter === 'all' || r.status === reqFilter)

  const getLeaveInfo = (empId: string) => {
    const ld = leaveData[empId]
    const entries = leaveEntries[empId] || []
    const total = ld?.total_days ?? 15
    const used = entries.reduce((s, e) => s + e.days, 0)
    return { total, used, remain: total - used, entries }
  }

  const handleApprove = async (req: LeaveRequest) => {
    await supabase.from('leave_requests').update({ status: 'approved', approved_by: profile?.id }).eq('id', req.id)
    // Add to leave_entries
    const yr = new Date(req.start_date).getFullYear()
    await supabase.from('leave_entries').insert([{
      employee_id: req.employee_id, year: yr,
      start_date: req.start_date, end_date: req.end_date,
      days: req.days, type: req.type, note: req.note,
    }])
    // Update schedules
    const start = new Date(req.start_date), end = new Date(req.end_date)
    const scheduleInserts = []
    for (const dt = new Date(start); dt <= end; dt.setDate(dt.getDate() + 1)) {
      scheduleInserts.push({
        employee_id: req.employee_id,
        year: dt.getFullYear(), month: dt.getMonth() + 1, day: dt.getDate(),
        status: req.type,
      })
    }
    if (scheduleInserts.length > 0) {
      await supabase.from('schedules').upsert(scheduleInserts, { onConflict: 'employee_id,year,month,day' })
    }
    await load()
  }

  const handleReject = async (req: LeaveRequest) => {
    const reason = window.prompt('거절 사유를 입력하세요 (선택사항)', '')
    if (reason === null) return
    await supabase.from('leave_requests').update({ status: 'rejected', rejected_reason: reason }).eq('id', req.id)
    await load()
  }

  const selEmp = employees.find(e => e.id === selEmpId)
  const selInfo = selEmpId ? getLeaveInfo(selEmpId) : null

  if (loading) return <div className="flex h-full items-center justify-center text-slate-400">로딩 중...</div>

  return (
    <div className="flex flex-col h-full overflow-auto">
      <PageHeader title="연차 관리" action={
        <button onClick={() => setReqModal(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5">
          + 연차 신청
        </button>
      } />
      <div className="p-6 space-y-5">
        {/* Tabs */}
        <div className="flex items-center gap-4">
          <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
            <TabBtn active={tab === 'summary'} onClick={() => setTab('summary')}>연차 현황</TabBtn>
            <TabBtn active={tab === 'requests'} onClick={() => setTab('requests')}>
              신청 관리 {pendingCount > 0 && <span className="ml-1 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">{pendingCount}</span>}
            </TabBtn>
          </div>
        </div>

        {tab === 'summary' ? (
          <>
            {/* Controls */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center gap-3">
              <select value={selEmpId} onChange={e => setSelEmpId(e.target.value)}
                className="border-1.5 border-slate-200 rounded-lg px-3 py-2 text-sm outline-none w-44">
                <option value="">직원 선택</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.name} ({e.dept})</option>)}
              </select>
              <select value={year} onChange={e => setYear(parseInt(e.target.value))}
                className="border-1.5 border-slate-200 rounded-lg px-3 py-2 text-sm outline-none w-28">
                {[2024,2025,2026,2027].map(y => <option key={y} value={y}>{y}년</option>)}
              </select>
              {selEmpId && canEdit && (
                <button className="ml-auto bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-lg text-sm font-semibold">직접 추가</button>
              )}
            </div>

            {selEmp && selInfo ? (
              <>
                <div className="grid grid-cols-4 gap-4">
                  {[
                    { label: '총 연차', val: selInfo.total, unit:'일', color:'text-slate-800' },
                    { label: '사용', val: selInfo.used.toFixed(1), unit:'일', color:'text-amber-600' },
                    { label: '잔여', val: selInfo.remain.toFixed(1), unit:'일', color: selInfo.remain < 3 ? 'text-red-600' : 'text-green-600' },
                    { label: '사용률', val: selInfo.total ? Math.round(selInfo.used / selInfo.total * 100) : 0, unit:'%', color:'text-blue-600' },
                  ].map(s => (
                    <div key={s.label} className="bg-white rounded-2xl border border-slate-200 p-5 text-center">
                      <div className="text-xs text-slate-400 mb-1">{s.label}</div>
                      <div className={`text-2xl font-bold ${s.color}`}>{s.val}<span className="text-sm font-normal text-slate-400 ml-0.5">{s.unit}</span></div>
                    </div>
                  ))}
                </div>
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-100 font-bold text-sm">{selEmp.name} 연차 내역 ({year}년)</div>
                  <table className="w-full border-collapse">
                    <thead><tr>{['시작일','종료일','일수','구분','사유'].map(h => (
                      <th key={h} className="bg-slate-50 px-4 py-3 text-left text-xs font-bold text-slate-500 border-b border-slate-200">{h}</th>
                    ))}</tr></thead>
                    <tbody>
                      {selInfo.entries.length === 0 ? (
                        <tr><td colSpan={5} className="text-center text-slate-400 py-8 text-sm">연차 내역 없음</td></tr>
                      ) : selInfo.entries.map(en => (
                        <tr key={en.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                          <td className="px-4 py-3 text-sm">{en.start_date}</td>
                          <td className="px-4 py-3 text-sm">{en.end_date}</td>
                          <td className="px-4 py-3 text-sm font-bold text-amber-600">{en.days}일</td>
                          <td className="px-4 py-3"><span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${en.type === 'Y' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>{en.type === 'Y' ? '연차' : '반차'}</span></td>
                          <td className="px-4 py-3 text-sm text-slate-500">{en.note || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 font-bold text-sm">전체 연차 현황 ({year}년)</div>
                <table className="w-full border-collapse">
                  <thead><tr>{['이름','소속','총 연차','사용','잔여','사용률'].map(h => (
                    <th key={h} className="bg-slate-50 px-4 py-3 text-left text-xs font-bold text-slate-500 border-b border-slate-200">{h}</th>
                  ))}</tr></thead>
                  <tbody>
                    {employees.map(e => {
                      const info = getLeaveInfo(e.id)
                      const col = DEPT_COLORS[e.dept] || '#64748b'
                      const pct = info.total ? Math.min(100, Math.round(info.used / info.total * 100)) : 0
                      return (
                        <tr key={e.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 cursor-pointer" onClick={() => setSelEmpId(e.id)}>
                          <td className="px-4 py-3 font-semibold text-sm">{e.name}</td>
                          <td className="px-4 py-3"><span className="text-xs px-2 py-0.5 rounded" style={{ background: col + '15', color: col }}>{e.dept}</span></td>
                          <td className="px-4 py-3 font-bold text-sm">{info.total}일</td>
                          <td className="px-4 py-3 font-bold text-amber-600 text-sm">{info.used.toFixed(1)}일</td>
                          <td className={`px-4 py-3 font-bold text-sm ${info.remain < 3 ? 'text-red-600' : 'text-green-600'}`}>{info.remain.toFixed(1)}일</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden" style={{ minWidth: 60 }}>
                                <div className="h-full bg-blue-500 rounded-full" style={{ width: `${pct}%` }} />
                              </div>
                              <span className="text-xs text-slate-500">{pct}%</span>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : (
          // Requests tab
          <>
            <div className="grid grid-cols-4 gap-4">
              {(['all','pending','approved','rejected'] as ReqFilter[]).map(f => {
                const cnt = f === 'all' ? requests.length : requests.filter(r => r.status === f).length
                const colors: Record<ReqFilter, string> = { all:'text-slate-700', pending:'text-orange-500', approved:'text-green-600', rejected:'text-red-500' }
                const labels: Record<ReqFilter, string> = { all:'전체', pending:'대기 중', approved:'승인', rejected:'거절' }
                return (
                  <button key={f} onClick={() => setReqFilter(f)}
                    className={`bg-white rounded-2xl border p-5 text-center cursor-pointer transition-all ${reqFilter === f ? 'ring-2 ring-blue-400' : 'border-slate-200 hover:bg-slate-50'}`}>
                    <div className="text-xs text-slate-400 mb-1">{labels[f]}</div>
                    <div className={`text-2xl font-bold ${colors[f]}`}>{cnt}건</div>
                  </button>
                )
              })}
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <table className="w-full border-collapse">
                <thead><tr>{['신청일','직원','기간','일수','구분','사유','상태',canEdit?'관리':''].filter(Boolean).map(h => (
                  <th key={h} className="bg-slate-50 px-4 py-3 text-left text-xs font-bold text-slate-500 border-b border-slate-200">{h}</th>
                ))}</tr></thead>
                <tbody>
                  {shown.length === 0 ? (
                    <tr><td colSpan={8} className="text-center text-slate-400 py-10 text-sm">내역 없음</td></tr>
                  ) : shown.map(req => {
                    const emp = employees.find(e => e.id === req.employee_id)
                    const col = DEPT_COLORS[emp?.dept || ''] || '#64748b'
                    const statusCfg: Record<string, { label:string; bg:string; color:string; dot:string }> = {
                      pending:  { label:'대기 중', bg:'#fff7ed', color:'#c2410c', dot:'#f97316' },
                      approved: { label:'승인',    bg:'#f0fdf4', color:'#15803d', dot:'#22c55e' },
                      rejected: { label:'거절',    bg:'#fef2f2', color:'#b91c1c', dot:'#ef4444' },
                    }
                    const sc = statusCfg[req.status]
                    return (
                      <tr key={req.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                        <td className="px-4 py-3 text-xs text-slate-400">{req.created_at.slice(0,10)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ background: col }}>
                              {emp?.name?.[0] || '?'}
                            </div>
                            <div>
                              <div className="text-sm font-semibold">{emp?.name || req.employee_id}</div>
                              <div className="text-xs text-slate-400">{emp?.dept}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm">{req.start_date} ~ {req.end_date}</td>
                        <td className="px-4 py-3 font-bold text-amber-600 text-sm">{req.days}일</td>
                        <td className="px-4 py-3"><span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${req.type === 'Y' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>{req.type === 'Y' ? '연차' : '반차'}</span></td>
                        <td className="px-4 py-3 text-sm text-slate-500 max-w-48 truncate">{req.note || '-'}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full" style={{ background: sc.dot }} />
                            <span className="text-xs font-semibold" style={{ color: sc.color }}>{sc.label}</span>
                          </div>
                          {req.rejected_reason && <div className="text-xs text-red-400 mt-0.5">{req.rejected_reason}</div>}
                        </td>
                        {canEdit && (
                          <td className="px-4 py-3">
                            {req.status === 'pending' ? (
                              <div className="flex gap-1">
                                <button onClick={() => handleApprove(req)} className="text-xs font-semibold text-green-700 px-2 py-1 rounded bg-green-50 hover:bg-green-100">승인</button>
                                <button onClick={() => handleReject(req)} className="text-xs font-semibold text-red-600 px-2 py-1 rounded bg-red-50 hover:bg-red-100">거절</button>
                              </div>
                            ) : (
                              <button onClick={async () => {
                                if (confirm('삭제할까요?')) {
                                  await supabase.from('leave_requests').delete().eq('id', req.id)
                                  await load()
                                }
                              }} className="text-xs text-slate-400 hover:text-red-500 px-2 py-1 rounded">삭제</button>
                            )}
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Leave Request Modal */}
      <LeaveRequestModal
        open={reqModal}
        onClose={() => setReqModal(false)}
        employees={employees}
        defaultEmpId={selEmpId}
        onSaved={() => { setReqModal(false); setTab('requests'); setReqFilter('pending'); load() }}
      />
    </div>
  )
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all flex items-center ${active ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>
      {children}
    </button>
  )
}

function LeaveRequestModal({ open, onClose, employees, defaultEmpId, onSaved }:
  { open: boolean; onClose: () => void; employees: Employee[]; defaultEmpId: string; onSaved: () => void }) {
  const { profile } = useAuth()
  const td = new Date().toISOString().slice(0,10)
  const [form, setForm] = useState({ empId: defaultEmpId, start: td, end: td, days: '1', type: 'Y', note: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => { setForm(f => ({ ...f, empId: defaultEmpId })) }, [defaultEmpId, open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.empId) return alert('직원을 선택하세요')
    setSaving(true)
    await supabase.from('leave_requests').insert([{
      employee_id: form.empId,
      requester_id: profile?.id ?? null,
      start_date: form.start, end_date: form.end,
      days: parseFloat(form.days), type: form.type as 'Y' | 'H',
      note: form.note || null, status: 'pending',
    }])
    setSaving(false)
    onSaved()
  }

  return (
    <Modal open={open} onClose={onClose} title="연차 신청" size="sm">
      <div className="bg-blue-50 rounded-xl p-4 mb-5 text-sm text-blue-700">
        승인 시 근무표에 자동 반영됩니다.
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1.5">직원 *</label>
          <select value={form.empId} onChange={e => setForm(f => ({ ...f, empId: e.target.value }))} required
            className="w-full border-1.5 border-slate-200 rounded-lg px-3 py-2 text-sm outline-none">
            <option value="">선택</option>
            {employees.map(e => <option key={e.id} value={e.id}>{e.name} ({e.dept})</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">시작일 *</label>
            <input type="date" value={form.start} onChange={e => setForm(f => ({ ...f, start: e.target.value }))} required
              className="w-full border-1.5 border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">종료일 *</label>
            <input type="date" value={form.end} onChange={e => setForm(f => ({ ...f, end: e.target.value }))} required
              className="w-full border-1.5 border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">일수 *</label>
            <input type="number" step="0.5" min="0.5" value={form.days} onChange={e => setForm(f => ({ ...f, days: e.target.value }))} required
              className="w-full border-1.5 border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">구분</label>
            <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
              className="w-full border-1.5 border-slate-200 rounded-lg px-3 py-2 text-sm outline-none">
              <option value="Y">연차</option>
              <option value="H">반차</option>
            </select>
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1.5">사유</label>
          <textarea value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} rows={3}
            className="w-full border-1.5 border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500 resize-none" />
        </div>
        <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
          <button type="button" onClick={onClose} className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-4 py-2 rounded-lg text-sm font-semibold">취소</button>
          <button type="submit" disabled={saving} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold">
            {saving ? '신청 중...' : '신청'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
