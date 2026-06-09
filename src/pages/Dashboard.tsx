import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Employee } from '../types/database'
import PageHeader from '../components/PageHeader'

const DEPTS = ['대표원장','부원장','총괄실장','실장','코디','간호','피부1(시술)','피부2(관리)','마케팅','미분류']
const DEPT_COLORS: Record<string, string> = {
  '대표원장':'#1e40af','부원장':'#1d4ed8','총괄실장':'#6d28d9',
  '실장':'#7c3aed','코디':'#0369a1','간호':'#047857',
  '피부1(시술)':'#9d174d','피부2(관리)':'#92400e',
  '마케팅':'#0f766e','미분류':'#6b7280',
}
const DAYS_KR = ['일','월','화','수','목','금','토']
const STATUS_CFG: Record<string, { label:string; bg:string; color:string }> = {
  D:   { label:'근무',  bg:'#bfdbfe', color:'#0f172a' },
  S:   { label:'추가',  bg:'#ddd6fe', color:'#0f172a' },
  H:   { label:'반차',  bg:'#bbf7d0', color:'#0f172a' },
  Y:   { label:'연차',  bg:'#fed7aa', color:'#0f172a' },
  OFF: { label:'휴무',  bg:'#fecaca', color:'#0f172a' },
}

export default function Dashboard() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [todaySchedule, setTodaySchedule] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)

  const now = new Date()
  const todayY = now.getFullYear(), todayM = now.getMonth() + 1, todayD = now.getDate()
  const todayStr = `${todayY}년 ${todayM}월 ${todayD}일 (${DAYS_KR[now.getDay()]})`

  useEffect(() => {
    const load = async () => {
      const [empsRes, schedRes] = await Promise.all([
        supabase.from('employees').select('*').eq('status', 'active'),
        supabase.from('schedules').select('employee_id,status')
          .eq('year', todayY).eq('month', todayM).eq('day', todayD),
      ])
      setEmployees(empsRes.data || [])
      const map: Record<string, string> = {}
      ;(schedRes.data || []).forEach((r: { employee_id: string; status: string }) => {
        map[r.employee_id] = r.status
      })
      setTodaySchedule(map)
      setLoading(false)
    }
    load()
  }, [])

  // 팀별 직원 그룹핑
  const grouped: Record<string, Employee[]> = {}
  DEPTS.forEach(d => { grouped[d] = [] })
  employees.forEach(e => { if (grouped[e.dept]) grouped[e.dept].push(e) })

  const activeDepts = DEPTS.filter(d => grouped[d].length > 0)

  // 오늘 상태별 카운트
  const onDuty  = employees.filter(e => ['D','S'].includes(todaySchedule[e.id] || ''))
  const onOff   = employees.filter(e => todaySchedule[e.id] === 'OFF')
  const onLeave = employees.filter(e => ['Y','H'].includes(todaySchedule[e.id] || ''))
  const noData  = employees.filter(e => !todaySchedule[e.id])

  if (loading) return <div className="flex h-full items-center justify-center text-slate-400">로딩 중...</div>

  const hasSchedule = Object.keys(todaySchedule).length > 0

  return (
    <div className="flex flex-col h-full overflow-auto">
      <PageHeader title="대시보드" />
      <div className="p-5 space-y-4">

        {/* 오늘 요약 카드 */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label:'총 재직 인원', value: employees.length, unit:'명', color:'text-slate-800', icon:'👥' },
            { label:'오늘 근무',    value: onDuty.length,   unit:'명', color:'text-blue-600',  icon:'💼' },
            { label:'휴무',         value: onOff.length,    unit:'명', color:'text-red-500',   icon:'🔴' },
            { label:'연차/반차',    value: onLeave.length,  unit:'명', color:'text-amber-600', icon:'📅' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-2xl border border-slate-200 px-5 py-4 flex items-center gap-3">
              <span className="text-2xl">{s.icon}</span>
              <div>
                <div className="text-xs text-slate-400 mb-0.5">{s.label}</div>
                <div className={`text-2xl font-bold ${s.color}`}>
                  {s.value}<span className="text-sm font-normal text-slate-400 ml-0.5">{s.unit}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* 오늘 근무표 */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-3">
            <span className="font-bold text-slate-800">오늘 근무표</span>
            <span className="text-xs text-slate-400">{todayStr}</span>
            {!hasSchedule && (
              <span className="text-xs text-orange-500 bg-orange-50 px-2 py-0.5 rounded-full">근무표 미등록</span>
            )}
          </div>

          <div className="p-4 grid grid-cols-3 gap-3">
            {activeDepts.map(dept => {
              const col   = DEPT_COLORS[dept] || '#64748b'
              const emps  = grouped[dept]
              const duty  = emps.filter(e => ['D','S'].includes(todaySchedule[e.id] || ''))
              const off   = emps.filter(e => todaySchedule[e.id] === 'OFF')
              const leave = emps.filter(e => todaySchedule[e.id] === 'Y')
              const half  = emps.filter(e => todaySchedule[e.id] === 'H')
              const none  = emps.filter(e => !todaySchedule[e.id])

              const groups = [
                { emps: duty,  cfg: STATUS_CFG['D'] },
                { emps: off,   cfg: STATUS_CFG['OFF'] },
                { emps: leave, cfg: STATUS_CFG['Y'] },
                { emps: half,  cfg: STATUS_CFG['H'] },
              ].filter(g => g.emps.length > 0)

              return (
                <div key={dept} className="rounded-xl border p-3"
                  style={{ borderColor: col + '40', background: col + '08' }}>
                  {/* 팀 헤더 */}
                  <div className="flex items-center gap-2 mb-2.5">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: col }} />
                    <span className="text-xs font-bold" style={{ color: col }}>{dept}</span>
                    <span className="ml-auto text-xs text-slate-400 font-medium">{emps.length}명</span>
                    {/* 빠른 요약 */}
                    <div className="flex gap-1 ml-1">
                      {duty.length > 0  && <span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{ background:'#bfdbfe', color:'#0f172a' }}>{duty.length}</span>}
                      {off.length > 0   && <span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{ background:'#fecaca', color:'#0f172a' }}>{off.length}</span>}
                      {leave.length > 0 && <span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{ background:'#fed7aa', color:'#0f172a' }}>{leave.length}</span>}
                      {half.length > 0  && <span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{ background:'#bbf7d0', color:'#0f172a' }}>{half.length}</span>}
                    </div>
                  </div>

                  {/* 상태별 명단 */}
                  <div className="space-y-1.5">
                    {groups.map(({ emps: grpEmps, cfg }) => (
                      <div key={cfg.label} className="flex items-start gap-1.5">
                        <span className="text-xs font-semibold px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5"
                          style={{ background: cfg.bg, color: cfg.color }}>
                          {cfg.label}
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {grpEmps.map(e => (
                            <span key={e.id} className="text-xs text-slate-600 bg-white border border-slate-100 px-1.5 py-0.5 rounded font-medium">
                              {e.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                    {none.length > 0 && (
                      <div className="flex items-start gap-1.5">
                        <span className="text-xs text-slate-300 px-1.5 py-0.5 flex-shrink-0">미등록</span>
                        <div className="flex flex-wrap gap-1">
                          {none.map(e => (
                            <span key={e.id} className="text-xs text-slate-300 px-1.5 py-0.5">{e.name}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* 부서별 인원 현황 */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="font-bold text-slate-800 text-sm mb-4">부서별 인원 현황</div>
          <div className="grid grid-cols-5 gap-3">
            {activeDepts.map(dept => {
              const col  = DEPT_COLORS[dept] || '#64748b'
              const cnt  = grouped[dept].length
              const pct  = employees.length ? Math.round(cnt / employees.length * 100) : 0
              return (
                <div key={dept} className="rounded-xl p-3 text-center"
                  style={{ background: col + '10', border: `1px solid ${col}30` }}>
                  <div className="w-2 h-2 rounded-full mx-auto mb-1.5" style={{ background: col }} />
                  <div className="text-xs font-bold mb-1 leading-tight" style={{ color: col }}>{dept}</div>
                  <div className="text-xl font-bold text-slate-800">{cnt}</div>
                  <div className="text-xs text-slate-400">{pct}%</div>
                </div>
              )
            })}
          </div>
        </div>

        {/* 오늘 전체 근무 현황 요약 (근무 중 전체 명단) */}
        {noData.length < employees.length && (
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <div className="font-bold text-slate-800 text-sm mb-3">근무 현황 요약</div>
            <div className="flex flex-wrap gap-2">
              {employees.filter(e => todaySchedule[e.id]).map(e => {
                const st  = todaySchedule[e.id]
                const cfg = STATUS_CFG[st] || STATUS_CFG['D']
                const col = DEPT_COLORS[e.dept] || '#64748b'
                return (
                  <div key={e.id} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border"
                    style={{ background: cfg.bg + '88', borderColor: cfg.bg }}>
                    <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                      style={{ background: col }}>
                      {e.name[0]}
                    </div>
                    <span className="text-xs font-semibold text-slate-700">{e.name}</span>
                    <span className="text-xs font-bold" style={{ color: cfg.color, opacity: 0.8 }}>{cfg.label}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
