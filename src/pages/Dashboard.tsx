import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Employee } from '../types/database'
import PageHeader from '../components/PageHeader'

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

// 표시할 팀 그룹 (마케팅/미분류 제외)
const TEAM_GROUPS = [
  { label:'진료진',     depts:['대표원장','부원장'],    color:'#1d4ed8' },
  { label:'실장',       depts:['총괄실장','실장'],       color:'#7c3aed' },
  { label:'코디',       depts:['코디'],                  color:'#0369a1' },
  { label:'간호',       depts:['간호'],                  color:'#047857' },
  { label:'피부1(시술)',depts:['피부1(시술)'],            color:'#9d174d' },
  { label:'피부2(관리)',depts:['피부2(관리)'],            color:'#92400e' },
]
const EXTRA_DEPTS = ['마케팅','미분류']

// 호버 툴팁 카드
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
        {emps.length > 0 && (
          <span className="ml-auto text-slate-300 text-xs">▾</span>
        )}
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

  const now   = new Date()
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

  // 오늘 상태별
  const mainEmps  = employees.filter(e => !EXTRA_DEPTS.includes(e.dept))
  const extraEmps = employees.filter(e => EXTRA_DEPTS.includes(e.dept))
  const onDuty    = mainEmps.filter(e => ['D','S'].includes(todaySchedule[e.id] || ''))
  const onOff     = mainEmps.filter(e => todaySchedule[e.id] === 'OFF')
  const onLeave   = mainEmps.filter(e => ['Y','H'].includes(todaySchedule[e.id] || ''))

  // 생일
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
      <PageHeader title="대시보드" />
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
          {/* 총 재직 인원 */}
          <div className="bg-white rounded-2xl border border-slate-200 px-4 py-4 flex items-center gap-3">
            <span className="text-2xl">👥</span>
            <div>
              <div className="text-xs text-slate-400 mb-0.5">총 재직 인원</div>
              <div className="text-2xl font-bold text-slate-800">
                {employees.length}<span className="text-sm font-normal text-slate-400 ml-0.5">명</span>
              </div>
            </div>
          </div>

          {/* 오늘 근무 */}
          <div className="bg-white rounded-2xl border border-slate-200 px-4 py-4 flex items-center gap-3">
            <span className="text-2xl">💼</span>
            <div>
              <div className="text-xs text-slate-400 mb-0.5">오늘 근무</div>
              <div className="text-2xl font-bold text-blue-600">
                {onDuty.length}<span className="text-sm font-normal text-slate-400 ml-0.5">명</span>
              </div>
            </div>
          </div>

          {/* 휴무 (hover 명단) */}
          <HoverCard label="휴무" count={onOff.length} unit="명"
            emps={onOff} colorClass="text-red-500" icon="🔴" />

          {/* 연차/반차 (hover 명단) */}
          <HoverCard label="연차/반차" count={onLeave.length} unit="명"
            emps={onLeave} colorClass="text-amber-600" icon="📅" />

          {/* 마케팅/미분류 (인원만, 근무표 무관) */}
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
            {TEAM_GROUPS.map(group => {
              const col  = group.color
              const emps = employees.filter(e => group.depts.includes(e.dept))
              if (emps.length === 0) return null

              // OFF 제외, 근무(D/S)/연차(Y)/반차(H)만
              const visible = emps.filter(e => todaySchedule[e.id] !== 'OFF')
              const workCount = emps.filter(e => ['D','S'].includes(todaySchedule[e.id] || '')).length

              // 상태별 그룹
              const byStatus: Record<string, Employee[]> = { D:[], S:[], Y:[], H:[], '':[] }
              visible.forEach(e => {
                const st = todaySchedule[e.id] || ''
                if (byStatus[st]) byStatus[st].push(e)
                else byStatus[''].push(e)
              })

              const rows = [
                { key:'D',  cfg: STATUS_CFG['D'],   list: byStatus['D'] },
                { key:'S',  cfg: STATUS_CFG['S'],   list: byStatus['S'] },
                { key:'Y',  cfg: STATUS_CFG['Y'],   list: byStatus['Y'] },
                { key:'H',  cfg: STATUS_CFG['H'],   list: byStatus['H'] },
                { key:'',   cfg: { label:'미등록', bg:'#f1f5f9', color:'#94a3b8' }, list: byStatus[''] },
              ].filter(r => r.list.length > 0)

              return (
                <div key={group.label} className="rounded-2xl border p-3.5"
                  style={{ borderColor: col + '40', background: col + '08' }}>
                  {/* 팀 헤더 */}
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: col }} />
                    <span className="text-sm font-bold" style={{ color: col }}>{group.label}</span>
                    <span className="ml-auto text-xs font-bold text-slate-500">
                      근무 <span style={{ color: col }}>{workCount}</span>/{emps.length}명
                    </span>
                  </div>

                  {/* 상태별 명단 */}
                  <div className="space-y-2">
                    {rows.map(({ key, cfg, list }) => (
                      <div key={key} className="flex items-start gap-2">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 mt-0.5"
                          style={{ background: cfg.bg, color: cfg.color }}>
                          {cfg.label}
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {list.map(e => (
                            <span key={e.id}
                              className="text-xs text-slate-600 bg-white border border-slate-100 px-2 py-0.5 rounded-full font-medium">
                              {e.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

      </div>
    </div>
  )
}
