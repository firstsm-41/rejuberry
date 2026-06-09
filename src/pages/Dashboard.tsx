import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../store/useAuth'
import type { Employee, LeaveRequest, HrChange } from '../types/database'
import PageHeader from '../components/PageHeader'

const DEPT_COLORS: Record<string, string> = {
  '대표원장':'#1e40af','부원장':'#1d4ed8','총괄실장':'#6d28d9',
  '실장':'#7c3aed','코디':'#0369a1','간호':'#047857',
  '피부1(시술)':'#9d174d','피부2(관리)':'#92400e',
}

const STATUS_CFG: Record<string, { label: string; bg: string; color: string }> = {
  D:   { label:'근무',  bg:'#eff6ff', color:'#2563eb' },
  S:   { label:'추가',  bg:'#f5f3ff', color:'#7c3aed' },
  H:   { label:'반차',  bg:'#fffbeb', color:'#d97706' },
  Y:   { label:'연차',  bg:'#f0fdf4', color:'#16a34a' },
  OFF: { label:'휴무',  bg:'#f1f5f9', color:'#94a3b8' },
}

export default function Dashboard() {
  const { profile } = useAuth()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [todaySchedule, setTodaySchedule] = useState<Record<string, string>>({})
  const [pendingLeaves, setPendingLeaves] = useState<LeaveRequest[]>([])
  const [recentChanges, setRecentChanges] = useState<HrChange[]>([])
  const [loading, setLoading] = useState(true)

  const now = new Date()
  const todayY = now.getFullYear(), todayM = now.getMonth() + 1, todayD = now.getDate()

  useEffect(() => {
    const load = async () => {
      const [empsRes, schedRes, leavesRes, changesRes] = await Promise.all([
        supabase.from('employees').select('*').eq('status', 'active'),
        supabase.from('schedules').select('employee_id,status').eq('year', todayY).eq('month', todayM).eq('day', todayD),
        supabase.from('leave_requests').select('*').eq('status', 'pending').order('created_at', { ascending: false }).limit(5),
        supabase.from('hr_changes').select('*').order('created_at', { ascending: false }).limit(5),
      ])
      setEmployees(empsRes.data || [])
      const map: Record<string, string> = {}
      ;(schedRes.data || []).forEach(r => { map[r.employee_id] = r.status })
      setTodaySchedule(map)
      setPendingLeaves(leavesRes.data || [])
      setRecentChanges(changesRes.data || [])
      setLoading(false)
    }
    load()
  }, [])

  const onDuty = employees.filter(e => ['D','S'].includes(todaySchedule[e.id] || ''))
  const onLeave = employees.filter(e => todaySchedule[e.id] === 'Y')
  const onOff = employees.filter(e => todaySchedule[e.id] === 'OFF')

  const deptCount: Record<string, number> = {}
  employees.forEach(e => { deptCount[e.dept] = (deptCount[e.dept] || 0) + 1 })

  if (loading) return <div className="flex h-full items-center justify-center text-slate-400">로딩 중...</div>

  return (
    <div className="flex flex-col h-full overflow-auto">
      <PageHeader title="대시보드" />
      <div className="p-6 space-y-5">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: '총 재직 인원', value: employees.length, unit: '명', color: 'text-slate-800' },
            { label: '오늘 근무 중', value: onDuty.length, unit: '명', color: 'text-blue-600' },
            { label: '연차 중', value: onLeave.length, unit: '명', color: 'text-green-600' },
            { label: '연차 승인 대기', value: pendingLeaves.length, unit: '건', color: 'text-orange-500' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-2xl border border-slate-200 p-5">
              <div className="text-xs font-semibold text-slate-400 mb-2">{s.label}</div>
              <div className={`text-3xl font-bold ${s.color}`}>
                {s.value}<span className="text-base font-normal text-slate-400 ml-1">{s.unit}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-5">
          {/* 부서별 */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <div className="font-bold text-slate-700 text-sm mb-4">부서별 인원</div>
            <div className="space-y-2.5">
              {Object.entries(deptCount).map(([dept, cnt]) => {
                const col = DEPT_COLORS[dept] || '#64748b'
                const pct = employees.length ? Math.round(cnt / employees.length * 100) : 0
                return (
                  <div key={dept}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-medium text-slate-600">{dept}</span>
                      <span className="font-bold text-slate-700">{cnt}명</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: col }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* 오늘 근무자 */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <div className="font-bold text-slate-700 text-sm mb-4">
              오늘 근무자 <span className="text-blue-500 font-normal text-xs ml-1">{onDuty.length}명</span>
            </div>
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {onDuty.length === 0
                ? <p className="text-sm text-slate-400 text-center py-6">데이터 없음</p>
                : onDuty.map(e => {
                    const st = todaySchedule[e.id] || 'D'
                    const cfg = STATUS_CFG[st]
                    const col = DEPT_COLORS[e.dept] || '#64748b'
                    return (
                      <div key={e.id} className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-slate-50">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ background: col }}>
                          {e.name[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-slate-700">{e.name}</div>
                          <div className="text-xs text-slate-400">{e.position}</div>
                        </div>
                        <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ background: cfg?.bg, color: cfg?.color }}>
                          {cfg?.label}
                        </span>
                      </div>
                    )
                  })}
            </div>
          </div>

          {/* 연차 신청 대기 */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <div className="font-bold text-slate-700 text-sm mb-4">
              연차 승인 대기 <span className="text-orange-500 font-normal text-xs ml-1">{pendingLeaves.length}건</span>
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {pendingLeaves.length === 0
                ? <p className="text-sm text-slate-400 text-center py-6">대기 없음</p>
                : pendingLeaves.map(req => (
                    <div key={req.id} className="flex items-center gap-2 py-2 px-2 rounded-lg hover:bg-slate-50">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold">{req.employee_id}</div>
                        <div className="text-xs text-slate-400">{req.start_date} ~ {req.end_date} ({req.days}일)</div>
                      </div>
                      <span className="text-xs font-semibold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">대기</span>
                    </div>
                  ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
