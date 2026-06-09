import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../store/useAuth'
import type { Employee, Schedule as SchRow } from '../types/database'
import PageHeader from '../components/PageHeader'
import Modal from '../components/Modal'
import * as XLSX from 'xlsx'
import html2canvas from 'html2canvas'

const DEPTS = ['대표원장','부원장','총괄실장','실장','코디','간호','피부1(시술)','피부2(관리)','마케팅','미분류']
const STATS_DEPTS = DEPTS.filter(d => d !== '마케팅' && d !== '미분류')
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
  D:   { label:'근무',  bg:'#bfdbfe', color:'#0f172a' },  // 파랑
  S:   { label:'추가',  bg:'#ddd6fe', color:'#0f172a' },  // 보라
  H:   { label:'반차',  bg:'#bbf7d0', color:'#0f172a' },  // 초록
  Y:   { label:'연차',  bg:'#fed7aa', color:'#0f172a' },  // 주황
  OFF: { label:'휴무',  bg:'#fecaca', color:'#0f172a' },  // 빨강
  '':  { label:'공백',  bg:'transparent', color:'transparent' },
}

type SchMap = Record<string, Record<number, WorkStatus>>

export default function Schedule() {
  const { profile } = useAuth()
  const canEdit = (profile?.level ?? 2) <= 1

  const now = new Date()
  const [year, setYear]         = useState(now.getFullYear())
  const [month, setMonth]       = useState(now.getMonth() + 1)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [schMap, setSchMap]     = useState<SchMap>({})
  const [loading, setLoading]   = useState(true)
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const [picker, setPicker]       = useState<{ x:number; y:number; empId:string; day:number } | null>(null)
  const [swapModal, setSwapModal] = useState<{ empId:string; day:number } | null>(null)
  const [createModal, setCreateModal] = useState(false)
  const pickerRef = useRef<HTMLDivElement>(null)
  const tableContainerRef = useRef<HTMLDivElement>(null)

  const dim = new Date(year, month, 0).getDate()
  const dow = (d: number) => new Date(year, month - 1, d).getDay()
  const todayY = now.getFullYear(), todayM = now.getMonth() + 1, todayD = now.getDate()
  const isCurrentMonth = year === todayY && month === todayM
  const statsDay = selectedDay ?? (isCurrentMonth ? todayD : null)

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

  // Persist a status change
  const applyStatus = useCallback(async (empId: string, day: number, status: WorkStatus) => {
    setSchMap(prev => {
      const next = { ...prev, [empId]: { ...(prev[empId] || {}) } }
      if (status === '') delete next[empId][day]
      else next[empId][day] = status
      return next
    })
    if (status === '') {
      await supabase.from('schedules').delete()
        .eq('employee_id', empId).eq('year', year).eq('month', month).eq('day', day)
    } else {
      await supabase.from('schedules').upsert(
        [{ employee_id: empId, year, month, day, status }],
        { onConflict: 'employee_id,year,month,day' }
      )
    }
  }, [year, month])

  // Picker button click
  const setStatus = async (status: WorkStatus) => {
    if (!picker) return
    const { empId, day } = picker
    setPicker(null)
    await applyStatus(empId, day, status)
  }

  // Keyboard shortcuts + 상하좌우 셀 이동
  useEffect(() => {
    if (!picker || !canEdit) return
    const KEY_MAP: Record<string, WorkStatus> = { d:'D', s:'S', h:'H', y:'Y', o:'OFF' }
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setPicker(null); return }

      // 상하좌우 이동
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        setPicker(prev => prev ? { ...prev, day: Math.max(1, prev.day - 1) } : null)
        return
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        setPicker(prev => prev ? { ...prev, day: Math.min(dim, prev.day + 1) } : null)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setPicker(prev => {
          if (!prev) return null
          const idx = employees.findIndex(emp => emp.id === prev.empId)
          return { ...prev, empId: employees[Math.max(0, idx - 1)]?.id ?? prev.empId }
        })
        return
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setPicker(prev => {
          if (!prev) return null
          const idx = employees.findIndex(emp => emp.id === prev.empId)
          return { ...prev, empId: employees[Math.min(employees.length - 1, idx + 1)]?.id ?? prev.empId }
        })
        return
      }

      const k = e.key.toLowerCase()
      const isClear = k === 'backspace' || k === 'delete'
      const status = KEY_MAP[k] ?? (isClear ? '' : undefined)
      if (status === undefined) return
      e.preventDefault()
      const { empId, day } = picker
      // picker를 닫지 않고 상태만 적용 → 이후 화살표 이동 가능
      applyStatus(empId, day, status)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [picker, canEdit, applyStatus, employees, dim])

  // Cell click handler
  const handleCellClick = (e: React.MouseEvent, empId: string, day: number) => {
    e.stopPropagation()
    if (canEdit) {
      // Level 0/1: open picker (clicking another cell while picker is open moves the picker)
      const rect = (e.target as HTMLElement).getBoundingClientRect()
      setPicker({ x: Math.min(rect.left, window.innerWidth - 300), y: rect.bottom + 4, empId, day })
    } else if (profile?.employee_id === empId) {
      // Level 2: own cell → swap dialog
      setSwapModal({ empId, day })
    }
  }

  // Group employees by dept
  const grouped: Record<string, Employee[]> = {}
  DEPTS.forEach(d => { grouped[d] = [] })
  employees.forEach(e => { if (grouped[e.dept]) grouped[e.dept].push(e) })

  // Per-dept daily work (D/S=1, H=0.5)
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

  const totalDayWork: Record<number, number> = {}
  for (let d = 1; d <= dim; d++) {
    totalDayWork[d] = DEPTS.reduce((s, dept) => s + (deptDayWork[dept][d] || 0), 0)
  }

  const fmt = (v: number) => v === 0 ? '' : (v % 1 === 0 ? String(v) : v.toFixed(1))

  const calcSummary = (empId: string) => {
    const sch = schMap[empId] || {}
    let D=0, S=0, H=0, Y=0, OFF=0
    for (let d = 1; d <= dim; d++) {
      const st = sch[d]
      if (st==='D') D++; else if (st==='S') S++; else if (st==='H') H++
      else if (st==='Y') Y++; else if (st==='OFF') OFF++
    }
    return { D, S, H, Y, OFF }
  }

  // ── 내보내기 ──────────────────────────────────────────────────────────────
  const DAYS_EN = ['일','월','화','수','목','금','토']

  const exportExcel = () => {
    const headerRow1 = ['사번','소속','이름','직급',
      ...Array.from({ length: dim }, (_, i) => i + 1),
      '근무(D)','추가(S)','반차(H)','OFF','연차(Y)']
    const headerRow2 = ['','','','',
      ...Array.from({ length: dim }, (_, i) => DAYS_EN[new Date(year, month - 1, i + 1).getDay()]),
      '','','','','']
    const rows: (string | number)[][] = [headerRow1, headerRow2]

    for (const dept of DEPTS) {
      const emps = grouped[dept]
      if (!emps.length) continue
      rows.push([dept])
      for (const e of emps) {
        const sch = schMap[e.id] || {}
        const sum = calcSummary(e.id)
        rows.push([
          e.id, e.dept, e.name, e.position,
          ...Array.from({ length: dim }, (_, i) => sch[i + 1] || ''),
          sum.D, sum.S, sum.H, sum.OFF, sum.Y,
        ])
      }
    }

    const ws = XLSX.utils.aoa_to_sheet(rows)
    // 컬럼 너비 설정
    ws['!cols'] = [
      { wch: 6 }, { wch: 10 }, { wch: 8 }, { wch: 12 },
      ...Array.from({ length: dim }, () => ({ wch: 4 })),
      { wch: 6 }, { wch: 6 }, { wch: 6 }, { wch: 6 }, { wch: 6 },
    ]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, `${year}년${month}월`)
    XLSX.writeFile(wb, `근무표_${year}년${month}월.xlsx`)
  }

  const exportImage = async () => {
    const el = tableContainerRef.current
    if (!el) return
    const prev = { maxHeight: el.style.maxHeight, overflow: el.style.overflow }
    el.style.maxHeight = 'none'
    el.style.overflow = 'visible'
    await new Promise(r => requestAnimationFrame(r))
    try {
      const canvas = await html2canvas(el, { scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff' })
      const link = document.createElement('a')
      link.download = `근무표_${year}년${month}월.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
    } finally {
      el.style.maxHeight = prev.maxHeight
      el.style.overflow = prev.overflow
    }
  }

  const handlePrint = () => window.print()

  if (loading) return <div className="flex h-full items-center justify-center text-slate-400">로딩 중...</div>

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader title={`근무표 — ${year}년 ${month}월`} />
      <div className="flex-1 overflow-auto p-4 space-y-3">

        {/* Controls */}
        <div className="bg-white rounded-2xl border border-slate-200 p-3 flex items-center gap-3 flex-wrap">
          <button onClick={() => { let m=month-1,y=year; if(m<1){m=12;y--} setMonth(m);setYear(y) }}
            className="bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg text-sm font-semibold">◀</button>
          <span className="font-bold text-slate-700">{year}년 {month}월</span>
          <button onClick={() => { let m=month+1,y=year; if(m>12){m=1;y++} setMonth(m);setYear(y) }}
            className="bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg text-sm font-semibold">▶</button>
          <div className="flex gap-2.5 ml-3 text-xs flex-wrap">
            {Object.entries(STATUS_CFG).filter(([k]) => k !== '').map(([k, v]) => (
              <span key={k} className="flex items-center gap-1">
                <span className="px-1.5 py-0.5 rounded font-bold text-xs" style={{ background: v.bg, color: v.color }}>{k}</span>
                <span className="text-slate-500">{v.label}</span>
              </span>
            ))}
          </div>
          <div className="flex items-center gap-1.5 ml-auto no-print">
            <button onClick={exportExcel}
              className="flex items-center gap-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
              엑셀
            </button>
            <button onClick={exportImage}
              className="flex items-center gap-1 bg-violet-50 hover:bg-violet-100 text-violet-700 border border-violet-200 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
              이미지
            </button>
            <button onClick={handlePrint}
              className="flex items-center gap-1 bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
              인쇄
            </button>
          </div>
          {canEdit
            ? <span className="text-xs text-slate-400 no-print">클릭 후 D·S·H·Y·O 키 또는 팝업으로 입력</span>
            : <span className="text-xs text-slate-400 no-print">본인 셀 클릭 → 팀원과 교환 신청</span>
          }
        </div>

        {/* 근무표 없을 때 생성 배너 */}
        {!loading && canEdit && Object.keys(schMap).length === 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-4">
            <div className="text-2xl">📋</div>
            <div className="flex-1">
              <div className="font-bold text-amber-800 text-sm">{year}년 {month}월 근무표가 없습니다</div>
              <div className="text-xs text-amber-600 mt-0.5">승인된 연차/반차를 불러와 근무표를 생성할 수 있습니다</div>
            </div>
            <button onClick={() => setCreateModal(true)}
              className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap">
              근무표 생성하기
            </button>
          </div>
        )}

        {/* Team summary (클릭한 날짜 기준) */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <div className="text-xs font-bold text-slate-500 mb-3">
            팀별 인원 현황
            <span className="font-normal text-slate-400 ml-1">
              {statsDay
                ? `— ${statsDay}일 기준  풀근무(반차)  ·  마케팅·미분류 제외`
                : '— 날짜를 클릭하면 해당 일 현황이 표시됩니다'}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {STATS_DEPTS.filter(d => grouped[d].length > 0).map(dept => {
              const col = DEPT_COLORS[dept] || '#64748b'
              const total = grouped[dept].length
              const full = statsDay
                ? grouped[dept].filter(e => ['D','S'].includes(schMap[e.id]?.[statsDay] || '')).length
                : null
              const half = statsDay
                ? grouped[dept].filter(e => schMap[e.id]?.[statsDay] === 'H').length
                : null
              return (
                <div key={dept} className="flex items-center gap-2 px-3 py-2 rounded-xl"
                  style={{ background: col + '12', border: `1px solid ${col}30` }}>
                  <div className="w-2 h-2 rounded-full" style={{ background: col }} />
                  <span className="text-xs font-bold" style={{ color: col }}>{dept}</span>
                  <span className="text-xs text-slate-400">{total}명</span>
                  {full !== null && (full > 0 || (half ?? 0) > 0) && (
                    <span className="text-xs font-bold px-1.5 py-0.5 rounded-md text-white"
                      style={{ background: col }}>
                      {full}{(half ?? 0) > 0 ? `(${half})` : ''}
                    </span>
                  )}
                </div>
              )
            })}
            {statsDay && (() => {
              const totFull = STATS_DEPTS.reduce((s, d) =>
                s + grouped[d].filter(e => ['D','S'].includes(schMap[e.id]?.[statsDay] || '')).length, 0)
              const totHalf = STATS_DEPTS.reduce((s, d) =>
                s + grouped[d].filter(e => schMap[e.id]?.[statsDay] === 'H').length, 0)
              return (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
                  style={{ background: '#dbeafe', border: '1px solid #bfdbfe' }}>
                  <span className="text-xs font-bold text-blue-800">합계</span>
                  <span className="text-xs font-bold text-blue-700">
                    {totFull}{totHalf > 0 ? `(${totHalf})` : ''}
                  </span>
                </div>
              )
            })()}
          </div>
        </div>

        {/* Schedule grid */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div ref={tableContainerRef} className="overflow-auto" style={{ maxHeight: 'calc(100vh - 240px)' }}>
            <table style={{ borderCollapse: 'separate', borderSpacing: 0, minWidth: 'max-content' }}>
              <thead>
                <tr>
                  <th className="px-2 py-2 text-xs text-slate-500 bg-white sticky top-0 z-10 whitespace-nowrap" style={{ minWidth: 40 }}>사번</th>
                  <th className="px-2 py-2 text-xs text-slate-500 bg-white sticky top-0 z-10 whitespace-nowrap" style={{ minWidth: 52 }}>이름</th>
                  <th className="px-2 py-2 text-xs text-slate-500 bg-white sticky top-0 z-10 whitespace-nowrap" style={{ minWidth: 72 }}>직급</th>
                  {Array.from({ length: dim }, (_, i) => i + 1).map(d => {
                    const w = dow(d)
                    const isSat = w === 6, isSun = w === 0
                    const isToday = isCurrentMonth && d === todayD
                    const isSel = selectedDay === d
                    return (
                      <th key={d}
                        onClick={() => setSelectedDay(prev => prev === d ? null : d)}
                        className="sticky top-0 z-10 text-center p-0 cursor-pointer select-none"
                        style={{
                          minWidth: 40,
                          background: isSel ? '#dbeafe' : '#f8fafc',
                          borderBottom: isToday ? '2px solid #2563eb' : isSel ? '2px solid #3b82f6' : '1px solid #e2e8f0',
                        }}>
                        <div className={`text-xs font-bold px-1 pt-1.5 ${isSat?'text-blue-500':isSun?'text-red-500':'text-slate-600'}${isToday?' underline':''}`}>{d}</div>
                        <div className={`text-xs pb-1.5 opacity-60 ${isSat?'text-blue-400':isSun?'text-red-400':'text-slate-400'}`}>{DAYS_KR[w]}</div>
                      </th>
                    )
                  })}
                  {(['D','S','H','OFF','Y'] as WorkStatus[]).map(s => (
                    <th key={s} className="text-xs text-center sticky top-0 z-10 px-1 whitespace-nowrap py-2"
                      style={{ background: STATUS_CFG[s].bg, color: STATUS_CFG[s].color, minWidth: 32, fontWeight: 800 }}>
                      {STATUS_CFG[s].label}
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
                      <td colSpan={dim + 8}
                        style={{ background: col + '10', padding: '4px 12px', fontSize: 11, fontWeight: 700, color: col, borderBottom: '1px solid #e2e8f0' }}>
                        ▸ {dept}
                      </td>
                    </tr>,
                    ...emps.map(e => {
                      const sch = schMap[e.id] || {}
                      const sum = calcSummary(e.id)
                      const isMyRow = !canEdit && profile?.employee_id === e.id
                      const rowBg = DEPT_COLORS[e.dept] ? DEPT_COLORS[e.dept] + '0c' : '#00000005'
                      return (
                        <tr key={e.id} style={{ background: isMyRow ? '#eff6ff' : rowBg }}
                          className="hover:brightness-95 transition-all">
                          <td className="px-2 py-1.5 font-mono text-xs text-slate-400 whitespace-nowrap">{e.id}</td>
                          <td className="px-2 py-1.5 text-xs font-semibold text-slate-700 whitespace-nowrap">{e.name}</td>
                          <td className="px-2 py-1.5 text-xs text-slate-400 whitespace-nowrap">{e.position}</td>
                          {Array.from({ length: dim }, (_, i) => i + 1).map(d => {
                            const st = sch[d] || ''
                            const cfg = STATUS_CFG[st] || STATUS_CFG['']
                            const w = dow(d)
                            const isSat = w === 6, isSun = w === 0
                            const isSel = selectedDay === d
                            const isClickable = canEdit || isMyRow
                            const isPickerTarget = canEdit && picker?.empId === e.id && picker?.day === d
                            return (
                              <td key={d}
                                onClick={ev => handleCellClick(ev, e.id, d)}
                                className={`text-center transition-colors ${isClickable ? 'cursor-pointer' : ''}`}
                                style={{
                                  background: isSel ? '#dbeafe' : '#ffffff',
                                  borderRight: isSat ? '2px solid #bfdbfe' : isSun ? '2px solid #fecaca' : undefined,
                                  outline: isPickerTarget ? '2px solid #2563eb' : undefined,
                                  minWidth: 40,
                                  padding: '4px 3px',
                                  zIndex: isPickerTarget ? 1 : undefined,
                                  position: isPickerTarget ? 'relative' : undefined,
                                }}>
                                {st ? (
                                  <span style={{
                                    display: 'inline-block',
                                    background: cfg.bg,
                                    color: cfg.color,
                                    borderRadius: 4,
                                    padding: '2px 5px',
                                    fontWeight: 800,
                                    fontSize: 11,
                                    lineHeight: 1.4,
                                    minWidth: 30,
                                  }}>{st}</span>
                                ) : null}
                              </td>
                            )
                          })}
                          {(['D','S','H','OFF','Y'] as WorkStatus[]).map(s => {
                            const v = s==='D'?sum.D:s==='S'?sum.S:s==='H'?sum.H:s==='OFF'?sum.OFF:sum.Y
                            return (
                              <td key={s} className="text-center text-xs font-bold px-1 py-1.5"
                                style={{ background: STATUS_CFG[s].bg, color: STATUS_CFG[s].color, minWidth: 32 }}>
                                {v || ''}
                              </td>
                            )
                          })}
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
                      <td colSpan={3} className="text-right pr-2 text-xs font-bold whitespace-nowrap py-1"
                        style={{ background: col + '12', color: col }}>{dept}</td>
                      {Array.from({ length: dim }, (_, i) => i + 1).map(d => {
                        const v = deptDayWork[dept][d] || 0
                        const w = dow(d)
                        const isSel = selectedDay === d
                        return (
                          <td key={d} className="text-center text-xs font-semibold py-1"
                            style={{ background: isSel ? col + '35' : col + '12', color: col, borderRight: w===6?'2px solid #bfdbfe':w===0?'2px solid #fecaca':undefined }}>
                            {fmt(v)}
                          </td>
                        )
                      })}
                      <td colSpan={5} style={{ background: col + '12' }} />
                    </tr>
                  )
                })}
                <tr>
                  <td colSpan={3} className="text-right pr-2 text-xs font-bold text-blue-900 whitespace-nowrap py-1"
                    style={{ background:'#dbeafe' }}>합계 근무</td>
                  {Array.from({ length: dim }, (_, i) => i + 1).map(d => {
                    const v = totalDayWork[d] || 0
                    const w = dow(d)
                    const isSel = selectedDay === d
                    return (
                      <td key={d} className="text-center text-xs font-bold text-blue-900 py-1"
                        style={{ background: isSel ? '#bfdbfe' : '#dbeafe', borderRight: w===6?'2px solid #bfdbfe':w===0?'2px solid #fecaca':undefined }}>
                        {fmt(v)}
                      </td>
                    )
                  })}
                  <td colSpan={5} style={{ background:'#dbeafe' }} />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>

      {/* Status Picker popup */}
      {picker && canEdit && (
        <div ref={pickerRef}
          style={{ position:'fixed', left:picker.x, top:picker.y, zIndex:300 }}
          className="bg-white rounded-xl shadow-2xl p-2 flex items-center gap-1 border border-slate-200">
          <span className="text-xs text-slate-400 px-1 mr-1 font-mono">D·S·H·Y·O·방향키·Esc</span>
          {STATUS_ORDER.map(s => {
            const cfg = STATUS_CFG[s]
            const cur = (schMap[picker.empId] || {})[picker.day] || ''
            return (
              <button key={s} onClick={() => setStatus(s)}
                className={`w-10 h-10 rounded-lg text-xs font-bold transition-transform hover:scale-110 ${cur === s ? 'ring-2 ring-blue-600' : ''}`}
                style={{ background: cfg.bg, color: cfg.color === 'transparent' ? '#94a3b8' : cfg.color }}>
                {s || '—'}
              </button>
            )
          })}
        </div>
      )}

      {/* Schedule Create Modal */}
      {createModal && (
        <ScheduleCreateModal
          year={year} month={month} employees={employees}
          onClose={() => setCreateModal(false)}
          onCreated={() => { setCreateModal(false); load() }}
        />
      )}

      {/* Swap Modal (level 2) */}
      {swapModal && (
        <SwapModal
          empId={swapModal.empId}
          day={swapModal.day}
          year={year}
          month={month}
          employees={employees}
          schMap={schMap}
          onClose={() => setSwapModal(null)}
          onSwapped={async () => { setSwapModal(null); await load() }}
        />
      )}
    </div>
  )
}

// ─── Swap Modal ───────────────────────────────────────────────────────────────
interface SwapModalProps {
  empId: string; day: number; year: number; month: number
  employees: Employee[]; schMap: SchMap
  onClose: () => void; onSwapped: () => void
}

function SwapModal({ empId, day, year, month, employees, schMap, onClose, onSwapped }: SwapModalProps) {
  const [targetId, setTargetId] = useState('')
  const [saving, setSaving] = useState(false)

  const myEmp    = employees.find(e => e.id === empId)
  const sameTeam = employees.filter(e => e.dept === myEmp?.dept && e.id !== empId)
  const mySt     = schMap[empId]?.[day] || ''
  const targetSt = targetId ? (schMap[targetId]?.[day] || '') : ''

  const badge = (st: string) => (
    <span className="inline-block px-3 py-1 rounded-lg text-sm font-bold"
      style={{ background: STATUS_CFG[st as WorkStatus]?.bg || '#f8fafc', color: STATUS_CFG[st as WorkStatus]?.color || '#64748b' }}>
      {st || '없음'}
    </span>
  )

  const handleSwap = async () => {
    if (!targetId) return
    setSaving(true)
    const { error } = await supabase.rpc('swap_schedules', {
      p_emp1: empId, p_emp2: targetId,
      p_year: year, p_month: month, p_day: day,
    })
    setSaving(false)
    if (error) { alert(`교환 실패: ${error.message}`); return }
    onSwapped()
  }

  return (
    <Modal open={true} onClose={onClose} title="근무 교환 신청" size="sm">
      <div className="space-y-4">
        <div className="bg-blue-50 rounded-xl p-3 text-sm text-blue-700">
          <strong>{month}월 {day}일</strong> 근무를 같은 팀 직원과 1:1 교환합니다.
        </div>
        <div className="flex items-center gap-4">
          <div className="flex-1 text-center">
            <div className="text-xs text-slate-400 mb-1">나 ({myEmp?.name})</div>
            {badge(mySt)}
          </div>
          <div className="text-2xl text-slate-400 font-light">⇌</div>
          <div className="flex-1 text-center">
            <div className="text-xs text-slate-400 mb-1">교환 상대</div>
            {badge(targetSt)}
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1.5">팀원 선택</label>
          <select value={targetId} onChange={e => setTargetId(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500">
            <option value="">선택</option>
            {sameTeam.map(e => {
              const st = schMap[e.id]?.[day] || '없음'
              return <option key={e.id} value={e.id}>{e.name} — {st}</option>
            })}
          </select>
          {sameTeam.length === 0 && (
            <p className="text-xs text-red-500 mt-1">같은 팀에 교환 가능한 직원이 없습니다</p>
          )}
        </div>
        <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
          <button type="button" onClick={onClose}
            className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-4 py-2 rounded-lg text-sm font-semibold">취소</button>
          <button onClick={handleSwap} disabled={saving || !targetId || sameTeam.length === 0}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white px-4 py-2 rounded-lg text-sm font-semibold">
            {saving ? '교환 중...' : '교환하기'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Schedule Create Modal ────────────────────────────────────────────────────
interface ScheduleCreateModalProps {
  year: number; month: number
  employees: Employee[]
  onClose: () => void; onCreated: () => void
}

function ScheduleCreateModal({ year, month, employees, onClose, onCreated }: ScheduleCreateModalProps) {
  const [loading, setLoading]   = useState(true)
  const [leaveItems, setLeaveItems] = useState<Array<{ empId: string; day: number; type: string }>>([])
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    const pad = (n: number) => String(n).padStart(2, '0')
    const startDate = `${year}-${pad(month)}-01`
    const endDate   = `${year}-${pad(month)}-31`
    supabase.from('leave_entries')
      .select('*')
      .lte('start_date', endDate)
      .gte('end_date', startDate)
      .then(({ data }: { data: Array<{ employee_id: string; start_date: string; end_date: string; type: string }> | null }) => {
        const expanded: Array<{ empId: string; day: number; type: string }> = []
        for (const entry of (data || [])) {
          const s = new Date(entry.start_date), e = new Date(entry.end_date)
          for (const dt = new Date(s); dt <= e; dt.setDate(dt.getDate() + 1)) {
            if (dt.getFullYear() === year && dt.getMonth() + 1 === month) {
              expanded.push({ empId: entry.employee_id, day: dt.getDate(), type: entry.type })
            }
          }
        }
        setLeaveItems(expanded)
        setLoading(false)
      })
  }, [year, month])

  // day → [{empId, type, name, dept}]
  const byDay: Record<number, Array<{ empId:string; type:string; name:string; dept:string }>> = {}
  for (const item of leaveItems) {
    if (!byDay[item.day]) byDay[item.day] = []
    const emp = employees.find(e => e.id === item.empId)
    byDay[item.day].push({ ...item, name: emp?.name || item.empId, dept: emp?.dept || '' })
  }

  const hasConflict = (day: number) => {
    const entries = byDay[day] || []
    const counts: Record<string, number> = {}
    entries.forEach(e => { counts[e.dept] = (counts[e.dept] || 0) + 1 })
    return Object.values(counts).some(c => c >= 2)
  }

  const days = Object.keys(byDay).map(Number).sort((a, b) => a - b)
  const DAYS_KR = ['일','월','화','수','목','금','토']

  const handleCreate = async () => {
    setCreating(true)
    if (leaveItems.length > 0) {
      const inserts = leaveItems.map(item => ({
        employee_id: item.empId, year, month, day: item.day, status: item.type,
      }))
      await supabase.from('schedules').upsert(inserts, { onConflict: 'employee_id,year,month,day' })
    }
    setCreating(false)
    onCreated()
  }

  return (
    <Modal open={true} onClose={onClose} title={`${year}년 ${month}월 근무표 생성`}>
      <div className="space-y-4">
        <div className="bg-blue-50 rounded-xl p-3 text-sm text-blue-700">
          승인된 연차/반차가 스케줄에 반영됩니다. 생성 후 나머지 근무를 직접 입력하세요.
        </div>

        {loading ? (
          <div className="text-center py-8 text-slate-400 text-sm">연차 내역 불러오는 중...</div>
        ) : (
          <>
            <div className="text-xs font-bold text-slate-500 flex items-center gap-2">
              {month}월 등록된 연차/반차
              <span className="font-normal text-slate-400">({leaveItems.length}건)</span>
              {days.some(hasConflict) && (
                <span className="text-orange-500 text-xs">⚠ 팀 2명↑ 중복 있음</span>
              )}
            </div>

            {days.length === 0 ? (
              <div className="bg-slate-50 rounded-xl p-6 text-center text-slate-400 text-sm">
                등록된 연차/반차 없음<br />
                <span className="text-xs">빈 근무표가 생성됩니다 (직접 입력해주세요)</span>
              </div>
            ) : (
              <div className="max-h-72 overflow-auto space-y-2 pr-1">
                {days.map(day => {
                  const conflict = hasConflict(day)
                  const entries  = byDay[day]
                  const dow = DAYS_KR[new Date(year, month - 1, day).getDay()]
                  // 팀별 2명↑ 목록
                  const conflictDepts = (() => {
                    const counts: Record<string, number> = {}
                    entries.forEach(e => { counts[e.dept] = (counts[e.dept] || 0) + 1 })
                    return Object.entries(counts).filter(([,c]) => c >= 2).map(([d]) => d)
                  })()
                  return (
                    <div key={day}
                      className={`p-3 rounded-xl border ${conflict ? 'border-orange-200 bg-orange-50' : 'border-slate-100 bg-slate-50'}`}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm font-bold text-slate-700">{month}월 {day}일 ({dow})</span>
                        {conflictDepts.map(d => (
                          <span key={d} className="text-xs font-bold text-orange-600 bg-orange-100 px-2 py-0.5 rounded-full">
                            ⚠ {d} 2명↑
                          </span>
                        ))}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {entries.map((e, i) => (
                          <span key={i} className={`text-xs px-2 py-0.5 rounded-full font-semibold ${e.type === 'Y' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                            {e.name} ({e.type === 'Y' ? '연차' : '반차'})
                          </span>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}

        <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
          <button onClick={onClose} className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-4 py-2 rounded-lg text-sm font-semibold">취소</button>
          <button onClick={handleCreate} disabled={creating || loading}
            className="bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white px-4 py-2 rounded-lg text-sm font-bold">
            {creating ? '생성 중...' : '근무표 생성하기'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
