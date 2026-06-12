import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../store/useAuth'
import type { Employee, LeaveData, LeaveEntry } from '../types/database'
import Modal from '../components/Modal'

const DEPT_COLORS: Record<string, string> = {
  '대표원장':'#1e40af','부원장':'#1d4ed8','총괄실장':'#6d28d9',
  '실장':'#7c3aed','코디':'#0369a1','간호':'#047857',
  '피부1(시술)':'#9d174d','피부2(관리)':'#92400e',
}

// ─── 레벨별 라우팅 ───────────────────────────────────────────────────────────
export default function Leave() {
  const { profile } = useAuth()
  return (profile?.level ?? 2) <= 1 ? <ManagerView /> : <StaffView />
}

// ─── 직원 뷰 (레벨 2) ────────────────────────────────────────────────────────
function StaffView() {
  const { profile } = useAuth()
  const year = new Date().getFullYear()
  const myEmpId = profile?.employee_id ?? ''

  const [myEmp, setMyEmp]         = useState<Employee | null>(null)
  const [leaveData, setLeaveData] = useState<LeaveData | null>(null)
  const [entries, setEntries]     = useState<LeaveEntry[]>([])
  const [schedEntries, setSchedEntries] = useState<Array<{month:number; day:number; status:string}>>([])
  const [loading, setLoading]     = useState(true)
  const [reqModal, setReqModal]   = useState(false)

  const load = useCallback(async () => {
    if (!myEmpId) { setLoading(false); return }
    const [empRes, ldRes, leRes, schRes] = await Promise.all([
      supabase.from('employees').select('*').eq('id', myEmpId).single(),
      supabase.from('leave_data').select('*').eq('employee_id', myEmpId).eq('year', year).single(),
      supabase.from('leave_entries').select('*').eq('employee_id', myEmpId).eq('year', year).order('start_date'),
      supabase.from('schedules').select('month,day,status').eq('employee_id', myEmpId).eq('year', year).in('status', ['Y','H']),
    ])
    setMyEmp(empRes.data)
    setLeaveData(ldRes.data)
    setEntries((leRes.data as LeaveEntry[]) || [])
    setSchedEntries(schRes.data || [])
    setLoading(false)
  }, [myEmpId, year])

  useEffect(() => { load() }, [load])

  if (loading) return <div className="flex h-full items-center justify-center text-slate-400">로딩 중...</div>
  if (!myEmpId || !myEmp) return (
    <div className="flex h-full items-center justify-center text-slate-400 text-sm">
      직원 정보가 연결되지 않았습니다. 관리자에게 문의하세요.
    </div>
  )

  const total   = leaveData?.total_days ?? 15
  const usedY   = schedEntries.filter(s => s.status === 'Y').length
  const usedH   = schedEntries.filter(s => s.status === 'H').length
  const used    = usedY + usedH * 0.5
  const remain  = total - used

  return (
    <div className="flex flex-col h-full overflow-auto">
      <div className="p-6 space-y-5">
        <div className="flex items-center justify-between">
          <span className="text-base font-bold text-slate-800">내 연차 현황</span>
          <button onClick={() => setReqModal(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold">
            + 연차 신청
          </button>
        </div>

        {/* 잔여 현황 */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label:'총 연차',  val: total,            unit:'일', color:'text-slate-800' },
            { label:'사용',     val: used.toFixed(1),  unit:'일', color:'text-amber-600' },
            { label:'잔여',     val: remain.toFixed(1),unit:'일', color: remain < 3 ? 'text-red-600':'text-green-600' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-2xl border border-slate-200 p-5 text-center">
              <div className="text-xs text-slate-400 mb-1">{s.label}</div>
              <div className={`text-2xl font-bold ${s.color}`}>{s.val}<span className="text-sm font-normal text-slate-400 ml-0.5">{s.unit}</span></div>
            </div>
          ))}
        </div>

        {/* 연차 사용 내역 */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 font-bold text-sm">{year}년 연차 내역</div>
          <table className="w-full border-collapse">
            <thead><tr>{['시작일','종료일','일수','구분'].map(h => (
              <th key={h} className="bg-slate-50 px-4 py-3 text-left text-xs font-bold text-slate-500 border-b border-slate-200">{h}</th>
            ))}</tr></thead>
            <tbody>
              {entries.length === 0 ? (
                <tr><td colSpan={4} className="text-center text-slate-400 py-10 text-sm">연차 사용 내역 없음</td></tr>
              ) : entries.map(en => (
                <tr key={en.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  <td className="px-4 py-3 text-sm">{en.start_date}</td>
                  <td className="px-4 py-3 text-sm">{en.end_date}</td>
                  <td className="px-4 py-3 font-bold text-amber-600 text-sm">{en.days}일</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${en.type === 'Y' ? 'bg-green-100 text-green-700':'bg-amber-100 text-amber-700'}`}>
                      {en.type === 'Y' ? '연차':'반차'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <LeaveRequestModal
        open={reqModal} onClose={() => setReqModal(false)}
        employees={[myEmp]} defaultEmpId={myEmpId} lockEmpId
        onSaved={() => { setReqModal(false); load() }}
      />
    </div>
  )
}

// ─── 관리자 뷰 (레벨 0/1) ─────────────────────────────────────────────────────
function ManagerView() {
  const curYear = new Date().getFullYear()

  type Tab = 'summary' | 'history'

  const [tab, setTab]             = useState<Tab>('summary')
  const [employees, setEmployees] = useState<Employee[]>([])
  const [leaveData, setLeaveData] = useState<Record<string, LeaveData>>({})
  const [leaveEntries, setLeaveEntries] = useState<LeaveEntry[]>([])
  const [scheduleY, setScheduleY] = useState<Record<string, Array<{month:number; day:number; status:string}>>>({})
  const [selEmpId, setSelEmpId]   = useState('')
  const [year, setYear]           = useState(curYear)
  const [loading, setLoading]     = useState(true)
  const [reqModal, setReqModal]   = useState(false)
  // total_days 인라인 편집
  const [editingTotal, setEditingTotal] = useState<string | null>(null)
  const [editTotalVal, setEditTotalVal] = useState('')
  // 상세보기 모달
  const [detailEmpId, setDetailEmpId] = useState<string | null>(null)

  const load = useCallback(async () => {
    const [empsRes, ldRes, leRes, schRes] = await Promise.all([
      supabase.from('employees').select('*').eq('status', 'active').order('id'),
      supabase.from('leave_data').select('*').eq('year', year),
      supabase.from('leave_entries').select('*').eq('year', year).order('start_date', { ascending: false }),
      supabase.from('schedules').select('employee_id,month,day,status').eq('year', year).in('status', ['Y','H']),
    ])
    setEmployees(empsRes.data || [])
    const ldMap: Record<string, LeaveData> = {}
    ;(ldRes.data as LeaveData[] || []).forEach(d => { ldMap[d.employee_id] = d })
    setLeaveData(ldMap)
    setLeaveEntries((leRes.data as LeaveEntry[]) || [])
    // schedules Y/H per employee
    const schMap: Record<string, Array<{month:number; day:number; status:string}>> = {}
    ;(schRes.data || []).forEach((r: {employee_id:string; month:number; day:number; status:string}) => {
      if (!schMap[r.employee_id]) schMap[r.employee_id] = []
      schMap[r.employee_id].push({ month: r.month, day: r.day, status: r.status })
    })
    setScheduleY(schMap)
    setLoading(false)
  }, [year])

  useEffect(() => { load() }, [load])

  const getLeaveInfo = (empId: string) => {
    const ld = leaveData[empId]
    const total = ld?.total_days ?? 15
    const yDates = scheduleY[empId] || []
    const usedY = yDates.filter(d => d.status === 'Y').length
    const usedH = yDates.filter(d => d.status === 'H').length
    const used  = usedY + usedH * 0.5
    return { total, used, remain: total - used, yDates }
  }

  const selEmp  = employees.find(e => e.id === selEmpId)
  const selInfo = selEmpId ? getLeaveInfo(selEmpId) : null

  const startEditTotal = (empId: string, current: number) => {
    setEditingTotal(empId)
    setEditTotalVal(String(current))
  }

  const saveTotal = async (empId: string) => {
    const val = parseFloat(editTotalVal)
    if (isNaN(val) || val < 0) return
    await supabase.from('leave_data').upsert(
      { employee_id: empId, year, total_days: val },
      { onConflict: 'employee_id,year' }
    )
    setEditingTotal(null)
    await load()
  }

  const handleDeleteEntry = async (id: number) => {
    if (!confirm('삭제할까요?')) return
    const entry = leaveEntries.find(e => e.id === id)
    await supabase.from('leave_entries').delete().eq('id', id)
    if (entry) {
      const dates: Array<{y:number; m:number; d:number}> = []
      const s = new Date(entry.start_date), en = new Date(entry.end_date)
      for (const dt = new Date(s); dt <= en; dt.setDate(dt.getDate() + 1)) {
        dates.push({ y: dt.getFullYear(), m: dt.getMonth() + 1, d: dt.getDate() })
      }
      await Promise.all(dates.map(({ y, m, d }) =>
        supabase.from('schedules').delete()
          .eq('employee_id', entry.employee_id)
          .eq('year', y).eq('month', m).eq('day', d)
          .eq('status', entry.type)
      ))
    }
    await load()
  }

  const detailEmp = employees.find(e => e.id === detailEmpId)

  if (loading) return <div className="flex h-full items-center justify-center text-slate-400">로딩 중...</div>

  return (
    <div className="flex flex-col h-full overflow-auto">
      <div className="p-6 space-y-5">
        {/* Tabs + 연차 신청 버튼 */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
            <TabBtn active={tab === 'summary'} onClick={() => setTab('summary')}>연차 현황</TabBtn>
            <TabBtn active={tab === 'history'} onClick={() => setTab('history')}>연차 내역</TabBtn>
          </div>
          <button onClick={() => setReqModal(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold">
            + 연차 등록
          </button>
        </div>

        {tab === 'summary' ? (
          <>
            <div className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center gap-3">
              <select value={selEmpId} onChange={e => setSelEmpId(e.target.value)}
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none w-44">
                <option value="">전체 보기</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.name} ({e.dept})</option>)}
              </select>
              <select value={year} onChange={e => setYear(parseInt(e.target.value))}
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none w-28">
                {[2024,2025,2026,2027].map(y => <option key={y} value={y}>{y}년</option>)}
              </select>
            </div>

            {selEmp && selInfo ? (
              <>
                <div className="grid grid-cols-4 gap-4">
                  {[
                    { label:'총 연차',  val: selInfo.total,                 unit:'일', color:'text-slate-800' },
                    { label:'사용',     val: selInfo.used.toFixed(1),       unit:'일', color:'text-amber-600' },
                    { label:'잔여',     val: selInfo.remain.toFixed(1),     unit:'일', color: selInfo.remain < 3 ? 'text-red-600':'text-green-600' },
                    { label:'사용률',   val: selInfo.total ? Math.round(selInfo.used / selInfo.total * 100) : 0, unit:'%', color:'text-blue-600' },
                  ].map(s => (
                    <div key={s.label} className="bg-white rounded-2xl border border-slate-200 p-5 text-center">
                      <div className="text-xs text-slate-400 mb-1">{s.label}</div>
                      <div className={`text-2xl font-bold ${s.color}`}>{s.val}<span className="text-sm font-normal text-slate-400 ml-0.5">{s.unit}</span></div>
                    </div>
                  ))}
                </div>
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-100 font-bold text-sm">{selEmp.name} 연차 내역 ({year}년)</div>
                  <div className="divide-y divide-slate-100">
                    {selInfo.yDates.length === 0 ? (
                      <p className="text-center text-slate-400 py-8 text-sm">연차 사용 내역 없음</p>
                    ) : (() => {
                      const byMonth: Record<number, Array<{day:number; status:string}>> = {}
                      selInfo.yDates.forEach(d => {
                        if (!byMonth[d.month]) byMonth[d.month] = []
                        byMonth[d.month].push({ day: d.day, status: d.status })
                      })
                      return Object.keys(byMonth).map(Number).sort((a,b)=>a-b).map(m => (
                        <div key={m} className="px-5 py-3">
                          <div className="text-xs font-bold text-slate-500 mb-2">{m}월</div>
                          <div className="flex flex-wrap gap-1.5">
                            {byMonth[m].sort((a,b)=>a.day-b.day).map((d,i) => (
                              <span key={i} className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${d.status==='Y'?'bg-orange-100 text-orange-700':'bg-green-100 text-green-700'}`}>
                                {d.day}일 ({d.status==='Y'?'연차':'반차'})
                              </span>
                            ))}
                          </div>
                        </div>
                      ))
                    })()}
                  </div>
                </div>
              </>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 font-bold text-sm">전체 연차 현황 ({year}년)</div>
                <table className="w-full border-collapse">
                  <thead><tr>{['이름','소속','총 연차','사용','잔여','상세보기','사용률'].map(h => (
                    <th key={h} className="bg-slate-50 px-4 py-3 text-left text-xs font-bold text-slate-500 border-b border-slate-200">{h}</th>
                  ))}</tr></thead>
                  <tbody>
                    {employees.map(e => {
                      const info = getLeaveInfo(e.id)
                      const col  = DEPT_COLORS[e.dept] || '#64748b'
                      const pct  = info.total ? Math.min(100, Math.round(info.used / info.total * 100)) : 0
                      const isEditingThis = editingTotal === e.id
                      return (
                        <tr key={e.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                          <td className="px-4 py-3 font-semibold text-sm cursor-pointer" onClick={() => setSelEmpId(e.id)}>{e.name}</td>
                          <td className="px-4 py-3 cursor-pointer" onClick={() => setSelEmpId(e.id)}>
                            <span className="text-xs px-2 py-0.5 rounded" style={{ background: col+'15', color: col }}>{e.dept}</span>
                          </td>
                          {/* 총 연차 인라인 편집 */}
                          <td className="px-4 py-3">
                            {isEditingThis ? (
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="number" step="0.5" min="0"
                                  value={editTotalVal}
                                  onChange={ev => setEditTotalVal(ev.target.value)}
                                  onKeyDown={ev => { if (ev.key==='Enter') saveTotal(e.id); if (ev.key==='Escape') setEditingTotal(null) }}
                                  autoFocus
                                  className="w-16 border border-blue-400 rounded-lg px-2 py-1 text-sm font-bold outline-none"
                                />
                                <button onClick={() => saveTotal(e.id)} className="text-xs bg-blue-600 text-white px-2 py-1 rounded-lg font-semibold">저장</button>
                                <button onClick={() => setEditingTotal(null)} className="text-xs text-slate-500 px-1 py-1">✕</button>
                              </div>
                            ) : (
                              <button onClick={() => startEditTotal(e.id, info.total)}
                                className="font-bold text-sm text-slate-700 hover:text-blue-600 hover:underline">
                                {info.total}일 ✎
                              </button>
                            )}
                          </td>
                          <td className="px-4 py-3 font-bold text-amber-600 text-sm">{info.used.toFixed(1)}일</td>
                          <td className={`px-4 py-3 font-bold text-sm ${info.remain < 3 ? 'text-red-600':'text-green-600'}`}>{info.remain.toFixed(1)}일</td>
                          <td className="px-4 py-3">
                            <button onClick={() => setDetailEmpId(e.id)}
                              className="text-xs text-blue-600 hover:text-blue-800 font-semibold px-2 py-1 rounded hover:bg-blue-50">
                              상세보기
                            </button>
                          </td>
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
          /* 연차 내역 탭 (모든 직원의 leave_entries) */
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 font-bold text-sm flex items-center gap-2">
              전체 연차 내역 ({year}년)
              <span className="text-xs text-slate-400 font-normal">{leaveEntries.length}건</span>
            </div>
            <table className="w-full border-collapse">
              <thead><tr>{['등록일','직원','기간','일수','구분','관리'].map(h => (
                <th key={h} className="bg-slate-50 px-4 py-3 text-left text-xs font-bold text-slate-500 border-b border-slate-200">{h}</th>
              ))}</tr></thead>
              <tbody>
                {leaveEntries.length === 0 ? (
                  <tr><td colSpan={6} className="text-center text-slate-400 py-10 text-sm">내역 없음</td></tr>
                ) : leaveEntries.map(en => {
                  const emp = employees.find(e => e.id === en.employee_id)
                  const col = DEPT_COLORS[emp?.dept || ''] || '#64748b'
                  return (
                    <tr key={en.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                      <td className="px-4 py-3 text-xs text-slate-400">{(en as LeaveEntry & {created_at?:string}).created_at?.slice(0,10) || '-'}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ background: col }}>
                            {emp?.name?.[0] || '?'}
                          </div>
                          <div>
                            <div className="text-sm font-semibold">{emp?.name || en.employee_id}</div>
                            <div className="text-xs text-slate-400">{emp?.dept}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm">{en.start_date}{en.start_date !== en.end_date ? ` ~ ${en.end_date}` : ''}</td>
                      <td className="px-4 py-3 font-bold text-amber-600 text-sm">{en.days}일</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${en.type === 'Y' ? 'bg-green-100 text-green-700':'bg-amber-100 text-amber-700'}`}>
                          {en.type === 'Y' ? '연차':'반차'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => handleDeleteEntry(en.id)}
                          className="text-xs text-red-500 hover:text-red-700 font-medium px-2 py-1 rounded hover:bg-red-50">삭제</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 연차 등록 모달 */}
      <LeaveRequestModal
        open={reqModal} onClose={() => setReqModal(false)}
        employees={employees} defaultEmpId={selEmpId}
        onSaved={() => { setReqModal(false); load() }}
      />

      {/* 상세보기 모달 */}
      {detailEmpId && detailEmp && (
        <LeaveDetailModal
          emp={detailEmp}
          yDates={scheduleY[detailEmpId] || []}
          year={year}
          total={getLeaveInfo(detailEmpId).total}
          onClose={() => setDetailEmpId(null)}
        />
      )}
    </div>
  )
}

// ─── 공통 UI ─────────────────────────────────────────────────────────────────
function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all flex items-center ${active ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>
      {children}
    </button>
  )
}

// ─── 상세보기 모달 ─────────────────────────────────────────────────────────────
function LeaveDetailModal({ emp, yDates, year, total, onClose }: {
  emp: Employee;
  yDates: Array<{month:number; day:number; status:string}>;
  year: number;
  total: number;
  onClose: () => void;
}) {
  const byMonth: Record<number, Array<{day:number; status:string}>> = {}
  yDates.forEach(d => {
    if (!byMonth[d.month]) byMonth[d.month] = []
    byMonth[d.month].push({ day: d.day, status: d.status })
  })
  const months = Object.keys(byMonth).map(Number).sort((a,b)=>a-b)
  const totalY = yDates.filter(d => d.status === 'Y').length
  const totalH = yDates.filter(d => d.status === 'H').length
  const used   = totalY + totalH * 0.5

  return (
    <Modal open={true} onClose={onClose} title={`${emp.name} 연차 현황 (${year}년)`} size="sm">
      <div className="space-y-4">
        <div className="flex gap-4 text-sm bg-slate-50 rounded-xl p-3 flex-wrap">
          <span className="text-orange-600 font-semibold">연차 {totalY}일</span>
          <span className="text-green-600 font-semibold">반차 {totalH}회 ({totalH * 0.5}일)</span>
          <span className="font-bold text-slate-700">총 {used}일 사용 / {total}일</span>
          <span className="text-blue-600 font-semibold">잔여 {total - used}일</span>
        </div>
        <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
          {months.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">연차 사용 내역 없음</p>
          ) : months.map(m => {
            const days = byMonth[m].sort((a,b) => a.day - b.day)
            return (
              <div key={m} className="bg-white border border-slate-100 rounded-xl p-3">
                <div className="text-xs font-bold text-slate-500 mb-2">{m}월 ({days.length}일)</div>
                <div className="flex flex-wrap gap-1.5">
                  {days.map((d, i) => (
                    <span key={i} className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${d.status==='Y'?'bg-orange-100 text-orange-700':'bg-green-100 text-green-700'}`}>
                      {d.day}일 {d.status==='Y'?'연차':'반차'}
                    </span>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </Modal>
  )
}

// ─── 연차 신청/등록 모달 ──────────────────────────────────────────────────────
function LeaveRequestModal({ open, onClose, employees, defaultEmpId, lockEmpId = false, onSaved }:
  { open: boolean; onClose: () => void; employees: Employee[]; defaultEmpId: string; lockEmpId?: boolean; onSaved: () => void }) {
  const td = new Date().toISOString().slice(0,10)
  const [form, setForm] = useState({ empId: defaultEmpId, start: td, end: td, days: '1', type: 'Y' })
  const [saving, setSaving] = useState(false)

  useEffect(() => { setForm(f => ({ ...f, empId: defaultEmpId })) }, [defaultEmpId, open])

  // 날짜 변경 시 일수 자동 계산 + 시작일이 종료일보다 뒤면 종료일도 이동
  const handleDateChange = (field: 'start' | 'end', value: string) => {
    const updated = { ...form, [field]: value }
    if (field === 'start' && value > updated.end) {
      updated.end = value
    }
    const s = new Date(updated.start), e = new Date(updated.end)
    const diff = Math.max(1, Math.round((e.getTime() - s.getTime()) / 86400000) + 1)
    setForm({ ...updated, days: updated.type === 'H' ? '0.5' : String(diff) })
  }

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault()
    if (!form.empId) return alert('직원을 선택하세요')
    setSaving(true)
    const yr = new Date(form.start).getFullYear()
    // 바로 leave_entries에 등록 (승인 불필요)
    await supabase.from('leave_entries').insert([{
      employee_id: form.empId,
      year: yr,
      start_date: form.start, end_date: form.end,
      days: parseFloat(form.days), type: form.type as 'Y' | 'H',
      note: null,
    }])
    // 근무표에도 자동 반영
    const start = new Date(form.start), end = new Date(form.end)
    const inserts: Array<{employee_id:string; year:number; month:number; day:number; status:string}> = []
    for (const dt = new Date(start); dt <= end; dt.setDate(dt.getDate() + 1)) {
      inserts.push({ employee_id: form.empId, year: dt.getFullYear(), month: dt.getMonth() + 1, day: dt.getDate(), status: form.type })
    }
    if (inserts.length > 0) await supabase.from('schedules').upsert(inserts, { onConflict: 'employee_id,year,month,day' })
    setSaving(false)
    onSaved()
  }

  return (
    <Modal open={open} onClose={onClose} title="연차 등록" size="sm">
      <div className="bg-blue-50 rounded-xl p-3 mb-4 text-sm text-blue-700">
        신청 즉시 근무표에 자동 반영됩니다.
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        {!lockEmpId && (
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">직원 *</label>
            <select value={form.empId} onChange={e => setForm(f => ({ ...f, empId: e.target.value }))} required
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none">
              <option value="">선택</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.name} ({e.dept})</option>)}
            </select>
          </div>
        )}
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1.5">구분</label>
          <div className="flex gap-2">
            {[{v:'Y',l:'연차'},{v:'H',l:'반차'}].map(({v,l}) => (
              <button key={v} type="button"
                onClick={() => setForm(f => ({ ...f, type: v as 'H' | 'Y', days: v === 'H' ? '0.5' : f.days }))}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition-colors ${form.type === v ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
                {l}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">시작일 *</label>
            <input type="date" value={form.start} onChange={e => handleDateChange('start', e.target.value)} required
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">{form.type === 'H' ? '날짜' : '종료일'} *</label>
            <input type="date" value={form.end} min={form.start}
              onChange={e => handleDateChange('end', e.target.value)} required
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1.5">일수</label>
          <input type="number" step="0.5" min="0.5" value={form.days}
            onChange={e => setForm(f => ({ ...f, days: e.target.value }))}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500" />
        </div>
        <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
          <button type="button" onClick={onClose} className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-4 py-2 rounded-lg text-sm font-semibold">취소</button>
          <button type="submit" disabled={saving} className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white px-4 py-2 rounded-lg text-sm font-semibold">
            {saving ? '등록 중...' : '등록'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
