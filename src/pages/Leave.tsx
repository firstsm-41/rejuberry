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

const STATUS_CFG = {
  pending:  { label:'대기 중', bg:'#fff7ed', color:'#c2410c', dot:'#f97316' },
  approved: { label:'승인',    bg:'#f0fdf4', color:'#15803d', dot:'#22c55e' },
  rejected: { label:'거절',    bg:'#fef2f2', color:'#b91c1c', dot:'#ef4444' },
} as const

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
  const [requests, setRequests]   = useState<LeaveRequest[]>([])
  const [loading, setLoading]     = useState(true)
  const [reqModal, setReqModal]   = useState(false)
  const [editReq, setEditReq]     = useState<LeaveRequest | null>(null)

  const load = useCallback(async () => {
    if (!myEmpId) { setLoading(false); return }
    const [empRes, ldRes, leRes, reqRes] = await Promise.all([
      supabase.from('employees').select('*').eq('id', myEmpId).single(),
      supabase.from('leave_data').select('*').eq('employee_id', myEmpId).eq('year', year).single(),
      supabase.from('leave_entries').select('*').eq('employee_id', myEmpId).eq('year', year).order('start_date'),
      supabase.from('leave_requests').select('*').eq('employee_id', myEmpId).order('created_at', { ascending: false }),
    ])
    setMyEmp(empRes.data)
    setLeaveData(ldRes.data)
    setEntries((leRes.data as LeaveEntry[]) || [])
    setRequests((reqRes.data as LeaveRequest[]) || [])
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
  const used    = entries.reduce((s, e) => s + e.days, 0)
  const remain  = total - used
  const pending = requests.filter(r => r.status === 'pending').length

  const handleDelete = async (req: LeaveRequest) => {
    if (!confirm('신청을 취소할까요?')) return
    await supabase.from('leave_requests').delete().eq('id', req.id)
    await load()
  }

  return (
    <div className="flex flex-col h-full overflow-auto">
      <PageHeader title="연차 관리" action={
        <button onClick={() => setReqModal(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold">
          + 연차 신청
        </button>
      } />
      <div className="p-6 space-y-5">

        {/* 잔여 현황 */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label:'총 연차',  val: total,            unit:'일', color:'text-slate-800' },
            { label:'사용',     val: used.toFixed(1),  unit:'일', color:'text-amber-600' },
            { label:'잔여',     val: remain.toFixed(1),unit:'일', color: remain < 3 ? 'text-red-600':'text-green-600' },
            { label:'대기 중', val: pending,           unit:'건', color:'text-orange-500' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-2xl border border-slate-200 p-5 text-center">
              <div className="text-xs text-slate-400 mb-1">{s.label}</div>
              <div className={`text-2xl font-bold ${s.color}`}>{s.val}<span className="text-sm font-normal text-slate-400 ml-0.5">{s.unit}</span></div>
            </div>
          ))}
        </div>

        {/* 신청 내역 */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 font-bold text-sm flex items-center gap-2">
            신청 내역
            {pending > 0 && <span className="bg-orange-100 text-orange-600 text-xs font-bold px-2 py-0.5 rounded-full">대기 {pending}건</span>}
          </div>
          <table className="w-full border-collapse">
            <thead><tr>{['신청일','기간','일수','구분','상태','관리'].map(h => (
              <th key={h} className="bg-slate-50 px-4 py-3 text-left text-xs font-bold text-slate-500 border-b border-slate-200">{h}</th>
            ))}</tr></thead>
            <tbody>
              {requests.length === 0 ? (
                <tr><td colSpan={6} className="text-center text-slate-400 py-10 text-sm">신청 내역 없음</td></tr>
              ) : requests.map(req => {
                const sc = STATUS_CFG[req.status]
                const isPending = req.status === 'pending'
                return (
                  <tr key={req.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                    <td className="px-4 py-3 text-xs text-slate-400">{req.created_at.slice(0,10)}</td>
                    <td className="px-4 py-3 text-sm">{req.start_date}{req.start_date !== req.end_date ? ` ~ ${req.end_date}` : ''}</td>
                    <td className="px-4 py-3 font-bold text-amber-600 text-sm">{req.days}일</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${req.type === 'Y' ? 'bg-green-100 text-green-700':'bg-amber-100 text-amber-700'}`}>
                        {req.type === 'Y' ? '연차':'반차'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full" style={{ background: sc.dot }} />
                        <span className="text-xs font-semibold" style={{ color: sc.color }}>{sc.label}</span>
                      </div>
                      {req.rejected_reason && <div className="text-xs text-red-400 mt-0.5">{req.rejected_reason}</div>}
                    </td>
                    <td className="px-4 py-3">
                      {isPending && (
                        <div className="flex gap-1">
                          <button onClick={() => setEditReq(req)} className="text-xs text-blue-600 hover:text-blue-800 font-medium px-2 py-1 rounded hover:bg-blue-50">수정</button>
                          <button onClick={() => handleDelete(req)} className="text-xs text-red-500 hover:text-red-700 font-medium px-2 py-1 rounded hover:bg-red-50">취소</button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* 확정 연차 내역 */}
        {entries.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 font-bold text-sm">{year}년 확정 연차 내역</div>
            <table className="w-full border-collapse">
              <thead><tr>{['시작일','종료일','일수','구분'].map(h => (
                <th key={h} className="bg-slate-50 px-4 py-3 text-left text-xs font-bold text-slate-500 border-b border-slate-200">{h}</th>
              ))}</tr></thead>
              <tbody>
                {entries.map(en => (
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
        )}
      </div>

      <LeaveRequestModal
        open={reqModal} onClose={() => setReqModal(false)}
        employees={[myEmp]} defaultEmpId={myEmpId} lockEmpId
        onSaved={() => { setReqModal(false); load() }}
      />
      {editReq && (
        <EditLeaveRequestModal req={editReq} onClose={() => setEditReq(null)} onSaved={() => { setEditReq(null); load() }} />
      )}
    </div>
  )
}

// ─── 관리자 뷰 (레벨 0/1) ─────────────────────────────────────────────────────
function ManagerView() {
  const { profile } = useAuth()
  const curYear = new Date().getFullYear()

  type Tab = 'summary' | 'requests'
  type ReqFilter = 'all' | 'pending' | 'approved' | 'rejected'

  const [tab, setTab]             = useState<Tab>('summary')
  const [reqFilter, setReqFilter] = useState<ReqFilter>('all')
  const [employees, setEmployees] = useState<Employee[]>([])
  const [leaveData, setLeaveData] = useState<Record<string, LeaveData>>({})
  const [leaveEntries, setLeaveEntries] = useState<Record<string, LeaveEntry[]>>({})
  const [requests, setRequests]   = useState<LeaveRequest[]>([])
  const [selEmpId, setSelEmpId]   = useState('')
  const [year, setYear]           = useState(curYear)
  const [loading, setLoading]     = useState(true)
  const [reqModal, setReqModal]   = useState(false)

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
    const ents = leaveEntries[empId] || []
    const total = ld?.total_days ?? 15
    const used  = ents.reduce((s, e) => s + e.days, 0)
    return { total, used, remain: total - used, entries: ents }
  }

  const handleApprove = async (req: LeaveRequest) => {
    await supabase.from('leave_requests').update({ status: 'approved', approved_by: profile?.id }).eq('id', req.id)
    const yr = new Date(req.start_date).getFullYear()
    await supabase.from('leave_entries').insert([{
      employee_id: req.employee_id, year: yr,
      start_date: req.start_date, end_date: req.end_date,
      days: req.days, type: req.type, note: req.note,
    }])
    const start = new Date(req.start_date), end = new Date(req.end_date)
    const inserts = []
    for (const dt = new Date(start); dt <= end; dt.setDate(dt.getDate() + 1)) {
      inserts.push({ employee_id: req.employee_id, year: dt.getFullYear(), month: dt.getMonth() + 1, day: dt.getDate(), status: req.type })
    }
    if (inserts.length > 0) await supabase.from('schedules').upsert(inserts, { onConflict: 'employee_id,year,month,day' })
    await load()
  }

  const handleReject = async (req: LeaveRequest) => {
    const reason = window.prompt('거절 사유 (선택사항)', '') ?? null
    if (reason === null) return
    await supabase.from('leave_requests').update({ status: 'rejected', rejected_reason: reason || null }).eq('id', req.id)
    await load()
  }

  const handleDeleteReq = async (id: number) => {
    if (!confirm('삭제할까요?')) return
    await supabase.from('leave_requests').delete().eq('id', id)
    await load()
  }

  const selEmp  = employees.find(e => e.id === selEmpId)
  const selInfo = selEmpId ? getLeaveInfo(selEmpId) : null

  if (loading) return <div className="flex h-full items-center justify-center text-slate-400">로딩 중...</div>

  return (
    <div className="flex flex-col h-full overflow-auto">
      <PageHeader title="연차 관리" action={
        <button onClick={() => setReqModal(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold">
          + 연차 신청
        </button>
      } />
      <div className="p-6 space-y-5">
        {/* Tabs */}
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
          <TabBtn active={tab === 'summary'} onClick={() => setTab('summary')}>연차 현황</TabBtn>
          <TabBtn active={tab === 'requests'} onClick={() => setTab('requests')}>
            신청 관리 {pendingCount > 0 && <span className="ml-1 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">{pendingCount}</span>}
          </TabBtn>
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
                  <table className="w-full border-collapse">
                    <thead><tr>{['시작일','종료일','일수','구분'].map(h => (
                      <th key={h} className="bg-slate-50 px-4 py-3 text-left text-xs font-bold text-slate-500 border-b border-slate-200">{h}</th>
                    ))}</tr></thead>
                    <tbody>
                      {selInfo.entries.length === 0 ? (
                        <tr><td colSpan={4} className="text-center text-slate-400 py-8 text-sm">연차 내역 없음</td></tr>
                      ) : selInfo.entries.map(en => (
                        <tr key={en.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                          <td className="px-4 py-3 text-sm">{en.start_date}</td>
                          <td className="px-4 py-3 text-sm">{en.end_date}</td>
                          <td className="px-4 py-3 font-bold text-amber-600 text-sm">{en.days}일</td>
                          <td className="px-4 py-3"><span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${en.type === 'Y' ? 'bg-green-100 text-green-700':'bg-amber-100 text-amber-700'}`}>{en.type === 'Y' ? '연차':'반차'}</span></td>
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
                      const col  = DEPT_COLORS[e.dept] || '#64748b'
                      const pct  = info.total ? Math.min(100, Math.round(info.used / info.total * 100)) : 0
                      return (
                        <tr key={e.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 cursor-pointer" onClick={() => setSelEmpId(e.id)}>
                          <td className="px-4 py-3 font-semibold text-sm">{e.name}</td>
                          <td className="px-4 py-3"><span className="text-xs px-2 py-0.5 rounded" style={{ background: col+'15', color: col }}>{e.dept}</span></td>
                          <td className="px-4 py-3 font-bold text-sm">{info.total}일</td>
                          <td className="px-4 py-3 font-bold text-amber-600 text-sm">{info.used.toFixed(1)}일</td>
                          <td className={`px-4 py-3 font-bold text-sm ${info.remain < 3 ? 'text-red-600':'text-green-600'}`}>{info.remain.toFixed(1)}일</td>
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
          <>
            <div className="grid grid-cols-4 gap-4">
              {(['all','pending','approved','rejected'] as ReqFilter[]).map(f => {
                const cnt = f === 'all' ? requests.length : requests.filter(r => r.status === f).length
                const colors: Record<ReqFilter,string> = { all:'text-slate-700', pending:'text-orange-500', approved:'text-green-600', rejected:'text-red-500' }
                const labels: Record<ReqFilter,string> = { all:'전체', pending:'대기 중', approved:'승인', rejected:'거절' }
                return (
                  <button key={f} onClick={() => setReqFilter(f)}
                    className={`bg-white rounded-2xl border p-5 text-center transition-all ${reqFilter === f ? 'ring-2 ring-blue-400' : 'border-slate-200 hover:bg-slate-50'}`}>
                    <div className="text-xs text-slate-400 mb-1">{labels[f]}</div>
                    <div className={`text-2xl font-bold ${colors[f]}`}>{cnt}건</div>
                  </button>
                )
              })}
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <table className="w-full border-collapse">
                <thead><tr>{['신청일','직원','기간','일수','구분','상태','관리'].map(h => (
                  <th key={h} className="bg-slate-50 px-4 py-3 text-left text-xs font-bold text-slate-500 border-b border-slate-200">{h}</th>
                ))}</tr></thead>
                <tbody>
                  {shown.length === 0 ? (
                    <tr><td colSpan={7} className="text-center text-slate-400 py-10 text-sm">내역 없음</td></tr>
                  ) : shown.map(req => {
                    const emp = employees.find(e => e.id === req.employee_id)
                    const col = DEPT_COLORS[emp?.dept || ''] || '#64748b'
                    const sc  = STATUS_CFG[req.status]
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
                        <td className="px-4 py-3 text-sm">{req.start_date}{req.start_date !== req.end_date ? ` ~ ${req.end_date}` : ''}</td>
                        <td className="px-4 py-3 font-bold text-amber-600 text-sm">{req.days}일</td>
                        <td className="px-4 py-3"><span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${req.type === 'Y' ? 'bg-green-100 text-green-700':'bg-amber-100 text-amber-700'}`}>{req.type === 'Y' ? '연차':'반차'}</span></td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full" style={{ background: sc.dot }} />
                            <span className="text-xs font-semibold" style={{ color: sc.color }}>{sc.label}</span>
                          </div>
                          {req.rejected_reason && <div className="text-xs text-red-400 mt-0.5">{req.rejected_reason}</div>}
                        </td>
                        <td className="px-4 py-3">
                          {req.status === 'pending' ? (
                            <div className="flex gap-1">
                              <button onClick={() => handleApprove(req)} className="text-xs font-semibold text-green-700 px-2 py-1 rounded bg-green-50 hover:bg-green-100">승인</button>
                              <button onClick={() => handleReject(req)} className="text-xs font-semibold text-red-600 px-2 py-1 rounded bg-red-50 hover:bg-red-100">거절</button>
                            </div>
                          ) : (
                            <button onClick={() => handleDeleteReq(req.id)} className="text-xs text-slate-400 hover:text-red-500 px-2 py-1 rounded">삭제</button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <LeaveRequestModal
        open={reqModal} onClose={() => setReqModal(false)}
        employees={employees} defaultEmpId={selEmpId}
        onSaved={() => { setReqModal(false); setTab('requests'); setReqFilter('pending'); load() }}
      />
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

// ─── 연차 신청 모달 ───────────────────────────────────────────────────────────
function LeaveRequestModal({ open, onClose, employees, defaultEmpId, lockEmpId = false, onSaved }:
  { open: boolean; onClose: () => void; employees: Employee[]; defaultEmpId: string; lockEmpId?: boolean; onSaved: () => void }) {
  const { profile } = useAuth()
  const td = new Date().toISOString().slice(0,10)
  const [form, setForm] = useState({ empId: defaultEmpId, start: td, end: td, days: '1', type: 'Y' })
  const [saving, setSaving] = useState(false)

  useEffect(() => { setForm(f => ({ ...f, empId: defaultEmpId })) }, [defaultEmpId, open])

  // 날짜 변경 시 일수 자동 계산
  const handleDateChange = (field: 'start' | 'end', value: string) => {
    const updated = { ...form, [field]: value }
    const s = new Date(updated.start), e = new Date(updated.end)
    if (e >= s) {
      const diff = Math.round((e.getTime() - s.getTime()) / 86400000) + 1
      setForm({ ...updated, days: updated.type === 'H' ? '0.5' : String(diff) })
    } else {
      setForm(updated)
    }
  }

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault()
    if (!form.empId) return alert('직원을 선택하세요')
    setSaving(true)
    await supabase.from('leave_requests').insert([{
      employee_id: form.empId,
      requester_id: profile?.id ?? null,
      start_date: form.start, end_date: form.end,
      days: parseFloat(form.days), type: form.type as 'Y' | 'H',
      note: null, status: 'pending',
    }])
    setSaving(false)
    onSaved()
  }

  return (
    <Modal open={open} onClose={onClose} title="연차 신청" size="sm">
      <div className="bg-blue-50 rounded-xl p-3 mb-4 text-sm text-blue-700">
        승인 시 근무표에 자동 반영됩니다.
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
            {saving ? '신청 중...' : '신청'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ─── 연차 수정 모달 (직원용) ─────────────────────────────────────────────────
function EditLeaveRequestModal({ req, onClose, onSaved }:
  { req: LeaveRequest; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    start: req.start_date, end: req.end_date,
    days: String(req.days), type: req.type,
  })
  const [saving, setSaving] = useState(false)

  const handleDateChange = (field: 'start' | 'end', value: string) => {
    const updated = { ...form, [field]: value }
    const s = new Date(updated.start), e = new Date(updated.end)
    if (e >= s) {
      const diff = Math.round((e.getTime() - s.getTime()) / 86400000) + 1
      setForm({ ...updated, days: updated.type === 'H' ? '0.5' : String(diff) })
    } else {
      setForm(updated)
    }
  }

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault()
    setSaving(true)
    await supabase.from('leave_requests').update({
      start_date: form.start, end_date: form.end,
      days: parseFloat(form.days), type: form.type as 'Y' | 'H',
    }).eq('id', req.id)
    setSaving(false)
    onSaved()
  }

  return (
    <Modal open={true} onClose={onClose} title="연차 신청 수정" size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
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
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">시작일</label>
            <input type="date" value={form.start} onChange={e => handleDateChange('start', e.target.value)} required
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">종료일</label>
            <input type="date" value={form.end} min={form.start} onChange={e => handleDateChange('end', e.target.value)} required
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
            {saving ? '저장 중...' : '수정 완료'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
