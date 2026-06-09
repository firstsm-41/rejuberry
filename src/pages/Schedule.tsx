import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../store/useAuth'
import type { Employee, Schedule as SchRow } from '../types/database'
import PageHeader from '../components/PageHeader'

const DEPTS = ['대표원장','부원장','총괄실장','실장','코디','간호','피부1(시술)','피부2(관리)','마케팅','미분류']
const DEPT_COLORS: Record<string, string> = {
  '대표원장':'#1e40af','부원장':'#1d4ed8','총괄실장':'#6d28d9',
  '실장':'#7c3aed','코디':'#0369a1','간호':'#047857',
  '피부1(시술)':'#9d174d','피부2(관리)':'#92400e',
  '마케팅':'#0f766e','미분류':'#6b7280',
}
const DAYS_KR = ['일','월','화','수','목','금','토']
type WorkStatus = 'D' | 'S' | 'H' | 'Y' | 'OFF' | ''
const STATUS_ORDER: WorkStatus[] = ['D','S','H','Y','OFF','']
const STATUS_CFG: Record<string, { label:string; bg:string; color:string }> = {
  D:   { label:'근무',  bg:'#eff6ff', color:'#2563eb' },
  S:   { label:'추가',  bg:'#f5f3ff', color:'#7c3aed' },
  H:   { label:'반차',  bg:'#fffbeb', color:'#d97706' },
  Y:   { label:'연차',  bg:'#f0fdf4', color:'#16a34a' },
  OFF: { label:'휴무',  bg:'#f1f5f9', color:'#94a3b8' },
  '':  { label:'공백',  bg:'#ffffff', color:'transparent' },
}

type SchMap = Record<string, Record<number, WorkStatus>>  // empId -> day -> status

export default function Schedule() {
  const { profile } = useAuth()
  const canEdit = (profile?.level ?? 2) <= 1

  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [schMap, setSchMap] = useState<SchMap>({})
  const [loading, setLoading] = useState(true)

  // Status picker state
  const [picker, setPicker] = useState<{ x:number; y:number; empId:string; day:number } | null>(null)
  const pickerRef = useRef<HTMLDivElement>(null)

  const dim = new Date(year, month, 0).getDate()
  const dow = (d: number) => new Date(year, month - 1, d).getDay()

  const load = useCallback(async () => {
    const [empsRes, schRes] = await Promise.all([
      supabase.from('employees').select('*').eq('status', 'active').order('id'),
      supabase.from('schedules').select('*').eq('year', year).eq('month', month),
    ])
    setEmployees(empsRes.data || [])
    const map: SchMap = {}
    ;(schRes.data || []).forEach((r: SchRow) => {
      if (!map[r.employee_id]) map[r.employee_id] = {}
      map[r.employee_id][r.day] = r.status as WorkStatus
    })
    setSchMap(map)
    setLoading(false)
  }, [year, month])

  useEffect(() => { load() }, [load])

  // Close picker on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPicker(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleCellClick = (e: React.MouseEvent, empId: string, day: number) => {
    if (!canEdit) return
    e.stopPropagation()
    const rect = (e.target as HTMLElement).getBoundingClientRect()
    setPicker({ x: Math.min(rect.left, window.innerWidth - 280), y: rect.bottom + 4, empId, day })
  }

  const setStatus = async (status: WorkStatus) => {
    if (!picker) return
    const { empId, day } = picker
    setPicker(null)

    // Optimistic update
    setSchMap(prev => {
      const next = { ...prev, [empId]: { ...(prev[empId] || {}) } }
      if (status === '') delete next[empId][day]
      else next[empId][day] = status
      return next
    })

    // Persist to Supabase
    if (status === '') {
      await supabase.from('schedules').delete()
        .eq('employee_id', empId).eq('year', year).eq('month', month).eq('day', day)
    } else {
      await supabase.from('schedules').upsert(
        [{ employee_id: empId, year, month, day, status }],
        { onConflict: 'employee_id,year,month,day' }
      )
    }
  }

  // Group employees by dept
  const grouped: Record<string, Employee[]> = {}
  DEPTS.forEach(d => { grouped[d] = [] })
  employees.forEach(e => { if (grouped[e.dept]) grouped[e.dept].push(e) })

  // Per-dept daily work count (H = 0.5)
  const deptDayWork: Record<string, Record<number, number>> = {}
  DEPTS.forEach(dept => {
    deptDayWork[dept] = {}
    for (let d = 1; d <= dim; d++) deptDayWork[dept][d] = 0
    grouped[dept].forEach(e => {
      const sch = schMap[e.id] || {}
      for (let d = 1; d <= dim; d++) {
        const st = sch[d] || ''
        if (st === 'D' || st === 'S') deptDayWork[dept][d] += 1
        else if (st === 'H') deptDayWork[dept][d] += 0.5
      }
    })
  })

  // Total daily work count
  const totalDayWork: Record<number, number> = {}
  for (let d = 1; d <= dim; d++) {
    totalDayWork[d] = DEPTS.reduce((s, dept) => s + (deptDayWork[dept][d] || 0), 0)
  }

  // Today
  const todayM = now.getMonth() + 1, todayD = now.getDate(), todayY = now.getFullYear()
  const isCurrentMonth = year === todayY && month === todayM

  const fmt = (v: number) => v === 0 ? '' : (v % 1 === 0 ? String(v) : v.toFixed(1))

  const calcEmpSummary = (empId: string) => {
    const sch = schMap[empId] || {}
    let D = 0, S = 0, H = 0, Y = 0, OFF = 0
    for (let d = 1; d <= dim; d++) {
      const st = sch[d]
      if (st === 'D') D++
      else if (st === 'S') S++
      else if (st === 'H') H++
      else if (st === 'Y') Y++
      else if (st === 'OFF') OFF++
    }
    return { D, S, H, Y, OFF }
  }

  if (loading) return <div className="flex h-full items-center justify-center text-slate-400">로딩 중...</div>

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader title={`근무표 — ${year}년 ${month}월`} />
      <div className="flex-1 overflow-auto p-4 space-y-3">

        {/* Controls */}
        <div className="bg-white rounded-2xl border border-slate-200 p-3 flex items-center gap-3 flex-wrap">
          <button onClick={() => { let m=month-1, y=year; if(m<1){m=12;y--} setMonth(m);setYear(y) }}
            className="bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg text-sm font-semibold">◀</button>
          <span className="font-bold text-slate-700">{year}년 {month}월</span>
          <button onClick={() => { let m=month+1, y=year; if(m>12){m=1;y++} setMonth(m);setYear(y) }}
            className="bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg text-sm font-semibold">▶</button>
          <div className="flex gap-2.5 ml-3 text-xs flex-wrap">
            {Object.entries(STATUS_CFG).filter(([k]) => k !== '').map(([k, v]) => (
              <span key={k} className="flex items-center gap-1">
                <span className="px-1.5 py-0.5 rounded font-bold text-xs" style={{ background: v.bg, color: v.color }}>{k}</span>
                <span className="text-slate-500">{v.label}</span>
              </span>
            ))}
          </div>
          {canEdit && <span className="text-xs text-slate-400 ml-auto">셀 클릭 → 변경</span>}
        </div>

        {/* Team summary bar */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <div className="text-xs font-bold text-slate-500 mb-3">
            팀별 인원 현황 <span className="font-normal text-slate-400">— H 반차 = 0.5명 환산{isCurrentMonth && ` · 오늘(${todayD}일) 근무인원 표시`}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {DEPTS.filter(d => grouped[d].length > 0).map(dept => {
              const col = DEPT_COLORS[dept] || '#64748b'
              const total = grouped[dept].length
              const todayCnt = isCurrentMonth ? (deptDayWork[dept][todayD] || 0) : null
              return (
                <div key={dept} className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: col + '12', border: `1px solid ${col}30` }}>
                  <div className="w-2 h-2 rounded-full" style={{ background: col }} />
                  <span className="text-xs font-bold" style={{ color: col }}>{dept}</span>
                  <span className="text-xs text-slate-400">{total}명</span>
                  {todayCnt !== null && todayCnt > 0 && (
                    <span className="text-xs font-semibold px-1.5 py-0.5 rounded-md text-white" style={{ background: col }}>
                      오늘 {fmt(todayCnt)}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Schedule grid */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="overflow-auto" style={{ maxHeight: '55vh' }}>
            <table style={{ borderCollapse: 'separate', borderSpacing: 0, minWidth: 'max-content' }}>
              <thead>
                <tr>
                  <th className="px-2 text-xs text-slate-500 bg-white sticky top-0 z-10 whitespace-nowrap" style={{ minWidth: 40 }}>사번</th>
                  <th className="px-2 text-xs text-slate-500 bg-white sticky top-0 z-10 whitespace-nowrap" style={{ minWidth: 48 }}>이름</th>
                  <th className="px-2 text-xs text-slate-500 bg-white sticky top-0 z-10 whitespace-nowrap" style={{ minWidth: 60 }}>직급</th>
                  {Array.from({ length: dim }, (_, i) => i + 1).map(d => {
                    const w = dow(d)
                    const isSat = w === 6, isSun = w === 0, isToday = isCurrentMonth && d === todayD
                    return (
                      <th key={d} className="sch-cell bg-slate-50 sticky top-0 z-10 text-center p-0"
                        style={{ borderBottom: isToday ? '2px solid #2563eb' : '1px solid #e2e8f0', minWidth: 32 }}>
                        <div className={`text-xs font-bold ${isSat ? 'text-blue-500' : isSun ? 'text-red-500' : 'text-slate-600'}${isToday ? ' underline' : ''}`}>{d}</div>
                        <div className={`text-xs opacity-60 ${isSat ? 'text-blue-400' : isSun ? 'text-red-400' : 'text-slate-400'}`}>{DAYS_KR[w]}</div>
                      </th>
                    )
                  })}
                  {['근무','추가','반차','OFF','연차'].map((h, i) => (
                    <th key={h} className="text-xs text-center sticky top-0 z-10 px-1 whitespace-nowrap"
                      style={{ background: ['#eff6ff','#f5f3ff','#fffbeb','#f1f5f9','#f0fdf4'][i], color: ['#2563eb','#7c3aed','#d97706','#94a3b8','#16a34a'][i], minWidth: 28 }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DEPTS.map(dept => {
                  const emps = grouped[dept]
                  if (!emps.length) return null
                  const col = DEPT_COLORS[dept] || '#64748b'
                  return [
                    <tr key={`dept-${dept}`}>
                      <td colSpan={dim + 8} style={{ background: col + '10', padding: '4px 12px', fontSize: 11, fontWeight: 700, color: col, borderBottom: '1px solid #e2e8f0' }}>
                        ▸ {dept}
                      </td>
                    </tr>,
                    ...emps.map(e => {
                      const sch = schMap[e.id] || {}
                      const sum = calcEmpSummary(e.id)
                      return (
                        <tr key={e.id} className="hover:bg-slate-50/50">
                          <td className="px-2 font-mono text-xs text-slate-400 whitespace-nowrap">{e.id}</td>
                          <td className="px-2 text-xs font-semibold text-slate-700 whitespace-nowrap">{e.name}</td>
                          <td className="px-2 text-xs text-slate-400 whitespace-nowrap">{e.position}</td>
                          {Array.from({ length: dim }, (_, i) => i + 1).map(d => {
                            const st = sch[d] || ''
                            const cfg = STATUS_CFG[st] || STATUS_CFG['']
                            const w = dow(d)
                            const isSat = w === 6, isSun = w === 0
                            const borderR = isSat ? '2px solid #bfdbfe' : isSun ? '2px solid #fecaca' : undefined
                            return (
                              <td key={d} className="sch-cell"
                                style={{ background: cfg.bg, color: cfg.color, borderRight: borderR }}
                                onClick={e2 => handleCellClick(e2, e.id, d)}>
                                {st}
                              </td>
                            )
                          })}
                          <td className="text-center text-xs font-bold px-1" style={{ background: '#eff6ff', color: '#2563eb', minWidth: 28 }}>{sum.D || ''}</td>
                          <td className="text-center text-xs font-bold px-1" style={{ background: '#f5f3ff', color: '#7c3aed', minWidth: 28 }}>{sum.S || ''}</td>
                          <td className="text-center text-xs font-bold px-1" style={{ background: '#fffbeb', color: '#d97706', minWidth: 28 }}>{sum.H || ''}</td>
                          <td className="text-center text-xs px-1" style={{ background: '#f1f5f9', color: '#94a3b8', minWidth: 28 }}>{sum.OFF || ''}</td>
                          <td className="text-center text-xs font-bold px-1" style={{ background: '#f0fdf4', color: '#16a34a', minWidth: 28 }}>{sum.Y || ''}</td>
                        </tr>
                      )
                    }),
                  ]
                })}
              </tbody>
              <tfoot>
                {DEPTS.filter(d => grouped[d].length > 0).map(dept => {
                  const col = DEPT_COLORS[dept] || '#64748b'
                  return (
                    <tr key={`sum-${dept}`}>
                      <td colSpan={3} className="text-right pr-2 text-xs font-bold whitespace-nowrap" style={{ background: col + '12', color: col }}>{dept}</td>
                      {Array.from({ length: dim }, (_, i) => i + 1).map(d => {
                        const v = deptDayWork[dept][d] || 0
                        const w = dow(d)
                        return (
                          <td key={d} className="text-center text-xs font-semibold"
                            style={{ background: col + '12', color: col, borderRight: w===6?'2px solid #bfdbfe':w===0?'2px solid #fecaca':undefined }}>
                            {fmt(v)}
                          </td>
                        )
                      })}
                      <td colSpan={5} style={{ background: col + '12' }} />
                    </tr>
                  )
                })}
                <tr>
                  <td colSpan={3} className="text-right pr-2 text-xs font-bold text-blue-900 whitespace-nowrap" style={{ background: '#dbeafe' }}>합계 근무</td>
                  {Array.from({ length: dim }, (_, i) => i + 1).map(d => {
                    const v = totalDayWork[d] || 0
                    const w = dow(d)
                    return (
                      <td key={d} className="text-center text-xs font-bold text-blue-900"
                        style={{ background: '#dbeafe', borderRight: w===6?'2px solid #bfdbfe':w===0?'2px solid #fecaca':undefined }}>
                        {fmt(v)}
                      </td>
                    )
                  })}
                  <td colSpan={5} style={{ background: '#dbeafe' }} />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>

      {/* Status Picker Popup */}
      {picker && (
        <div ref={pickerRef}
          style={{ position: 'fixed', left: picker.x, top: picker.y, zIndex: 300 }}
          className="bg-white rounded-xl shadow-2xl p-1.5 flex gap-1 border border-slate-200">
          {STATUS_ORDER.map(s => {
            const cfg = STATUS_CFG[s]
            const cur = (schMap[picker.empId] || {})[picker.day] || ''
            return (
              <button key={s} onClick={() => setStatus(s)}
                className={`w-9 h-9 rounded-lg text-xs font-bold transition-transform hover:scale-110 ${cur === s ? 'ring-2 ring-blue-600' : ''}`}
                style={{ background: cfg.bg, color: cfg.color === 'transparent' ? '#94a3b8' : cfg.color }}>
                {s || '—'}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
