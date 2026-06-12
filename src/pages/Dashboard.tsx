import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Employee } from '../types/database'

const DEPT_COLORS: Record<string, string> = {
  '대표원장':'#1e40af','부원장':'#1d4ed8','총괄실장':'#6d28d9',
  '실장':'#7c3aed','코디':'#0369a1','간호':'#047857',
  '피부1(시술)':'#9d174d','피부2(관리)':'#92400e',
  '마케팅':'#0f766e','미분류':'#6b7280',
}
const DAYS_KR = ['일','월','화','수','목','금','토']
const STATUS_CFG: Record<string, { label:string; bg:string; color:string }> = {
  D:   { label:'근무', bg:'#bfdbfe', color:'#0f172a' },
  S:   { label:'추가', bg:'#ddd6fe', color:'#0f172a' },
  H:   { label:'반차', bg:'#bbf7d0', color:'#0f172a' },
  Y:   { label:'연차', bg:'#fed7aa', color:'#0f172a' },
  OFF: { label:'휴무', bg:'#fecaca', color:'#0f172a' },
}

const TEAM_GROUPS = [
  { label:'진료진',      depts:['대표원장','부원장'],   color:'#1d4ed8' },
  { label:'실장',        depts:['총괄실장','실장'],      color:'#7c3aed' },
  { label:'코디',        depts:['코디'],                 color:'#0369a1' },
  { label:'간호',        depts:['간호'],                 color:'#047857' },
  { label:'피부1(시술)', depts:['피부1(시술)'],          color:'#9d174d' },
  { label:'피부2(관리)', depts:['피부2(관리)'],          color:'#92400e' },
  { label:'마케팅',      depts:['마케팅'],               color:'#0f766e' },
]
const EXTRA_DEPTS = ['마케팅','미분류']

function HoverCard({
  label, count, unit, emps, colorClass, icon,
}: {
  label: string; count: number; unit: string; emps: Employee[];
  colorClass: string; icon: string;
}) {
  return (
    <div className="relative group cursor-default">
      <div className="bg-white rounded-2xl border border-slate-200 px-4 py-4 flex items-center gap-3 select-none">
        <span className="text-2xl">{icon}</span>
        <div>
          <div className="text-xs text-slate-400 mb-0.5">{label}</div>
          <div className={`text-2xl font-bold ${colorClass}`}>
            {count}<span className="text-sm font-normal text-slate-400 ml-0.5">{unit}</span>
          </div>
        </div>
        {emps.length > 0 && <span className="ml-auto text-slate-300 text-xs">▾</span>}
      </div>
      {emps.length > 0 && (
        <div className="invisible opacity-0 group-hover:visible group-hover:opacity-100
          absolute top-full left-0 mt-1.5 z-50 bg-white border border-slate-200
          shadow-xl rounded-2xl p-3 min-w-[140px] transition-all duration-150">
          <div className="text-xs font-bold text-slate-400 mb-2">{label} 명단</div>
          <div className="space-y-1">
            {emps.map(e => (
              <div key={e.id} className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ background: DEPT_COLORS[e.dept] || '#64748b' }} />
                <span className="text-xs text-slate-700 font-medium whitespace-nowrap">{e.name}</span>
                <span className="text-xs text-slate-400 whitespace-nowrap">{e.dept}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function Dashboard() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [todaySchedule, setTodaySchedule] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)

  const now    = new Date()
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

  const mainEmps  = employees.filter(e => !EXTRA_DEPTS.includes(e.dept))
  const extraEmps = employees.filter(e => EXTRA_DEPTS.includes(e.dept))
  const onDuty    = mainEmps.filter(e => ['D','S','H'].includes(todaySchedule[e.id] || ''))
  const onOff     = mainEmps.filter(e => todaySchedule[e.id] === 'OFF')
  const onLeave   = mainEmps.filter(e => todaySchedule[e.id] === 'Y')

  const todayMM = String(todayM).padStart(2,'0'), todayDD = String(todayD).padStart(2,'0')
  const birthdayEmps = employees.filter(e => {
    if (!e.birth_date) return false
    const p = e.birth_date.split('-')
    return p[1] === todayMM && p[2] === todayDD
  })

  if (loading) return <div className="flex h-full items-center justify-center text-slate-400">로딩 중...</div>

  const hasSchedule = Object.keys(todaySchedule).length > 0

  return (
    <div className="flex flex-col h-full overflow-auto">
      <div className="p-5 space-y-4">

        {/* 생일 배너 */}
        {birthdayEmps.length > 0 && (
          <div className="rounded-2xl border border-pink-200 bg-gradient-to-r from-pink-50 to-rose-50 px-5 py-3 flex items-center gap-3 flex-wrap">
            <span className="text-xl">🎂</span>
            <span className="font-bold text-pink-700 text-sm">오늘 생일</span>
            {birthdayEmps.map(e => (
              <span key={e.id} className="text-sm font-semibold text-pink-800 bg-white border border-pink-200 px-3 py-1 rounded-full">
                {e.name} <span className="text-xs text-pink-400">({e.dept})</span>
              </span>
            ))}
          </div>
        )}

        {/* 상단 요약 카드 */}
        <div className="grid grid-cols-5 gap-3">
          <div className="bg-white rounded-2xl border border-slate-200 px-4 py-4 flex items-center gap-3">
            <span className="text-2xl">👥</span>
            <div>
              <div className="text-xs text-slate-400 mb-0.5">총 재직 인원</div>
              <div className="text-2xl font-bold text-slate-800">
                {employees.length}<span className="text-sm font-normal text-slate-400 ml-0.5">명</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 px-4 py-4 flex items-center gap-3">
            <span className="text-2xl">💼</span>
            <div>
              <div className="text-xs text-slate-400 mb-0.5">오늘 근무·반차</div>
              <div className="text-2xl font-bold text-blue-600">
                {onDuty.length}<span className="text-sm font-normal text-slate-400 ml-0.5">명</span>
              </div>
            </div>
          </div>

          <HoverCard label="휴무" count={onOff.length} unit="명"
            emps={onOff} colorClass="text-red-500" icon="🔴" />

          <HoverCard label="연차" count={onLeave.length} unit="명"
            emps={onLeave} colorClass="text-amber-600" icon="📅" />

          <div className="bg-white rounded-2xl border border-slate-200 px-4 py-4 flex items-center gap-3">
            <span className="text-2xl">📌</span>
            <div>
              <div className="text-xs text-slate-400 mb-0.5">마케팅/기타</div>
              <div className="text-2xl font-bold text-teal-600">
                {extraEmps.length}<span className="text-sm font-normal text-slate-400 ml-0.5">명</span>
              </div>
            </div>
          </div>
        </div>

        {/* 오늘 근무표 — 리스트 형식 */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-3">
            <span className="font-bold text-slate-800">오늘 근무표</span>
            <span className="text-xs text-slate-400">{todayStr}</span>
            {!hasSchedule && (
              <span className="text-xs text-orange-500 bg-orange-50 px-2 py-0.5 rounded-full">근무표 미등록</span>
            )}
          </div>

          <div className="divide-y divide-slate-50">
            {TEAM_GROUPS.map(group => {
              const emps = employees.filter(e => group.depts.includes(e.dept))
              if (emps.length === 0) return null
              const col = group.color
              const workCnt = emps.filter(e => ['D','S'].includes(todaySchedule[e.id] || '')).length
              return (
                <div key={group.label}>
                  {/* 팀 헤더 */}
                  <div className="px-5 py-2 flex items-center gap-2" style={{ background: col + '0d' }}>
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: col }} />
                    <span className="text-xs font-bold" style={{ color: col }}>{group.label}</span>
                    <span className="text-xs text-slate-400 ml-auto">
                      근무 <span style={{ color: col }} className="font-bold">{workCnt}</span>/{emps.length}명
                    </span>
                  </div>
                  {/* 직원 행 */}
                  {emps.map(e => {
                    const st = todaySchedule[e.id] || ''
                    const cfg = STATUS_CFG[st]
                    return (
                      <div key={e.id} className="px-5 py-2.5 flex items-center gap-3 hover:bg-slate-50/70 transition-colors">
                        <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                          style={{ background: col + 'bb' }}>{e.name[0]}</div>
                        <span className="text-sm font-medium text-slate-700 w-16 flex-shrink-0">{e.name}</span>
                        <span className="text-xs text-slate-400 flex-1">{e.position}</span>
                        {st && cfg ? (
                          <span className="text-xs font-bold px-2.5 py-0.5 rounded-full" style={{ background: cfg.bg, color: cfg.color }}>
                            {cfg.label}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-300">—</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>

      </div>
    </div>
  )
}
