import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../store/useAuth'
import type { Employee, Schedule as SchRow } from '../types/database'
import Modal from '../components/Modal'
import * as XLSX from 'xlsx-js-style'
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
  D:   { label:'근무',  bg:'#bfdbfe', color:'#0f172a' },
  S:   { label:'추가',  bg:'#ddd6fe', color:'#0f172a' },
  H:   { label:'반차',  bg:'#bbf7d0', color:'#0f172a' },
  Y:   { label:'연차',  bg:'#fed7aa', color:'#0f172a' },
  OFF: { label:'휴무',  bg:'#fecaca', color:'#0f172a' },
  '':  { label:'공백',  bg:'transparent', color:'transparent' },
}
type SchMap = Record<string, Record<number, WorkStatus>>

export default function Schedule() {
  const { profile } = useAuth()
  const canEdit = (profile?.level ?? 2) <= 1
  const isStaff = !canEdit

  const now = new Date()
  const [year, setYear]           = useState(now.getFullYear())
  const [month, setMonth]         = useState(now.getMonth() + 1)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [schMap, setSchMap]       = useState<SchMap>({})
  const [loading, setLoading]     = useState(true)
  const [confirmed, setConfirmed] = useState(false)
  const [confirmLoading, setConfirmLoading] = useState(false)
  const [selectedDay, setSelectedDay]       = useState<number | null>(null)
  const [picker, setPicker]       = useState<{ x:number; y:number; empId:string; day:number } | null>(null)
  const [swapModal, setSwapModal] = useState<{ empId:string; day:number } | null>(null)
  const [createModal, setCreateModal]       = useState(false)
  const [monthPickerOpen, setMonthPickerOpen] = useState(false)
  const [pickerDisplayYear, setPickerDisplayYear] = useState(now.getFullYear())
  const [offQuotas, setOffQuotas] = useState<Record<string, number>>({
    '실장': 1, '코디': 1, '간호': 1, '피부1(시술)': 1, '피부2(관리)': 1,
  })
  const [showQuotaSettings, setShowQuotaSettings] = useState(false)
  const [showNotice, setShowNotice] = useState(true)
  const [clipStatus, setClipStatus] = useState<WorkStatus | null>(null)
  const [clipSrc, setClipSrc]       = useState<{empId:string; day:number} | null>(null)
  const pickerRef        = useRef<HTMLDivElement>(null)
  const tableContainerRef = useRef<HTMLDivElement>(null)

  const dim  = new Date(year, month, 0).getDate()
  const dow  = (d: number) => new Date(year, month - 1, d).getDay()
  const todayY = now.getFullYear(), todayM = now.getMonth() + 1, todayD = now.getDate()
  const isCurrentMonth = year === todayY && month === todayM
  const statsDay = selectedDay ?? (isCurrentMonth ? todayD : null)

  const load = useCallback(async () => {
    setLoading(true)
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
    try {
      const { data } = await supabase.from('schedule_confirmed')
        .select('confirmed_at').eq('year', year).eq('month', month).maybeSingle()
      setConfirmed(!!data?.confirmed_at)
    } catch { setConfirmed(false) }
    try {
      const { data: quotaData } = await supabase.from('off_quotas').select('dept,max_persons')
      if (quotaData?.length) {
        const qMap: Record<string, number> = {}
        ;(quotaData as Array<{dept:string; max_persons:number}>).forEach(q => { qMap[q.dept] = q.max_persons })
        setOffQuotas(prev => ({ ...prev, ...qMap }))
      }
    } catch { /* defaults 유지 */ }
    setLoading(false)
  }, [year, month])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setPicker(null)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

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

  const setStatus = async (status: WorkStatus) => {
    if (!picker) return
    const { empId, day } = picker
    setPicker(null)
    await applyStatus(empId, day, status)
  }

  useEffect(() => {
    if (!picker || !canEdit) return
    const KEY_MAP: Record<string, WorkStatus> = { d:'D', s:'S', h:'H', y:'Y', o:'OFF' }
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setPicker(null); setClipStatus(null); setClipSrc(null); return }
      if (e.ctrlKey && e.key === 'c') {
        const st = ((schMap[picker.empId]||{})[picker.day] ?? '') as WorkStatus
        setClipStatus(st); setClipSrc({ empId: picker.empId, day: picker.day })
        e.preventDefault(); return
      }
      if (e.ctrlKey && e.key === 'v' && clipStatus !== null) {
        applyStatus(picker.empId, picker.day, clipStatus)
        e.preventDefault(); return
      }
      if (e.key === 'ArrowLeft')  { e.preventDefault(); setPicker(p => p ? { ...p, day: Math.max(1, p.day - 1) } : null); return }
      if (e.key === 'ArrowRight') { e.preventDefault(); setPicker(p => p ? { ...p, day: Math.min(dim, p.day + 1) } : null); return }
      if (e.key === 'ArrowUp')    { e.preventDefault(); setPicker(p => { if (!p) return null; const i = employees.findIndex(e => e.id === p.empId); return { ...p, empId: employees[Math.max(0, i-1)]?.id ?? p.empId } }); return }
      if (e.key === 'ArrowDown')  { e.preventDefault(); setPicker(p => { if (!p) return null; const i = employees.findIndex(e => e.id === p.empId); return { ...p, empId: employees[Math.min(employees.length-1, i+1)]?.id ?? p.empId } }); return }
      const k = e.key.toLowerCase()
      const isClear = k === 'backspace' || k === 'delete'
      const status = KEY_MAP[k] ?? (isClear ? '' : undefined)
      if (status === undefined) return
      e.preventDefault()
      applyStatus(picker.empId, picker.day, status)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [picker, canEdit, applyStatus, employees, dim, clipStatus, schMap])

  useEffect(() => {
    if (clipStatus === null || picker) return
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') { setClipStatus(null); setClipSrc(null) } }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [clipStatus, picker])

  useEffect(() => {
    if (!monthPickerOpen) return
    const close = (e: MouseEvent) => { if (!(e.target as HTMLElement).closest('[data-month-picker]')) setMonthPickerOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [monthPickerOpen])

  const handleCellClick = (e: React.MouseEvent, empId: string, day: number) => {
    e.stopPropagation()
    if (canEdit) {
      if (clipStatus !== null) {
        applyStatus(empId, day, clipStatus)
        setClipSrc({ empId, day })
        return
      }
      const rect = (e.target as HTMLElement).getBoundingClientRect()
      setPicker({ x: Math.min(rect.left, window.innerWidth - 300), y: rect.bottom + 4, empId, day })
    } else if (profile?.employee_id === empId && confirmed) {
      setSwapModal({ empId, day })
    }
  }

  const grouped: Record<string, Employee[]> = {}
  DEPTS.forEach(d => { grouped[d] = [] })
  employees.forEach(e => { if (grouped[e.dept]) grouped[e.dept].push(e) })

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
  for (let d = 1; d <= dim; d++)
    totalDayWork[d] = DEPTS.reduce((s, dept) => s + (deptDayWork[dept][d] || 0), 0)

  const fmt = (v: number) => v === 0 ? '' : (v % 1 === 0 ? String(v) : v.toFixed(1))

  const calcSummary = (empId: string) => {
    const sch = schMap[empId] || {}; let D=0,S=0,H=0,Y=0,OFF=0
    for (let d = 1; d <= dim; d++) {
      const st = sch[d]
      if (st==='D') D++; else if (st==='S') S++; else if (st==='H') H++
      else if (st==='Y') Y++; else if (st==='OFF') OFF++
    }
    return { D, S, H, Y, OFF }
  }

  const offViolations = useMemo(() => {
    if (!canEdit) return {} as Record<number, {dept:string; names:string[]}[]>
    const res: Record<number, {dept:string; names:string[]}[]> = {}
    for (let d = 1; d <= dim; d++) {
      const viols: {dept:string; names:string[]}[] = []
      for (const [dept, max] of Object.entries(offQuotas)) {
        const offEmps = employees.filter(e => e.dept === dept && (schMap[e.id]?.[d] || '') === 'Y')
        if (offEmps.length > max) viols.push({ dept, names: offEmps.map(e => e.name) })
      }
      if (viols.length) res[d] = viols
    }
    return res
  }, [canEdit, employees, schMap, dim, offQuotas])

  // ── 확정 ──────────────────────────────────────────────────────────────────
  const handleConfirm = async () => {
    if (!window.confirm(`${year}년 ${month}월 근무표를 직원들에게 공개할까요?`)) return
    setConfirmLoading(true)
    try {
      await supabase.from('schedule_confirmed').upsert(
        { year, month, confirmed_at: new Date().toISOString(), confirmed_by: profile?.id },
        { onConflict: 'year,month' }
      )
      setConfirmed(true)
    } catch { alert('확정 실패 — DB 마이그레이션이 필요합니다 (supabase/migrations-phase2.sql)') }
    setConfirmLoading(false)
  }

  const handleUnconfirm = async () => {
    if (!window.confirm('공개를 취소할까요?')) return
    try {
      await supabase.from('schedule_confirmed').upsert(
        { year, month, confirmed_at: null, confirmed_by: null },
        { onConflict: 'year,month' }
      )
      setConfirmed(false)
    } catch { alert('취소 실패 — DB 마이그레이션이 필요합니다 (supabase/migrations-phase2.sql)') }
  }

  const handleQuotaChange = (dept: string, value: number) => {
    if (isNaN(value) || value < 1) return
    setOffQuotas(prev => ({ ...prev, [dept]: value }))
  }

  const saveQuota = async (dept: string) => {
    const max = offQuotas[dept]
    try {
      await supabase.from('off_quotas').upsert(
        { dept, max_persons: max, updated_at: new Date().toISOString(), updated_by: profile?.id },
        { onConflict: 'dept' }
      )
    } catch { /* off_quotas 테이블 없으면 무시 */ }
  }

  // ── 내보내기 ─────────────────────────────────────────────────────────────
  const DAYS_EN = ['일','월','화','수','목','금','토']
  const FONT = 'Malgun Gothic'
  const BORDER = { style: 'thin' as const, color: { rgb: 'cbd5e1' } }
  const BA = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER }

  const buildExcelSheet = (includeId: boolean) => {
    const fixedCols = includeId ? 4 : 2
    const sumCols   = includeId ? 5 : 0
    const total = fixedCols + dim + sumCols

    const titleRow = [`${year}년 ${month}월 근무표`, ...Array(total-1).fill('')]
    const h1 = includeId
      ? ['사번','소속','이름','직급', ...Array.from({length:dim},(_,i)=>i+1), '근무(D)','추가(S)','반차(H)','OFF','연차(Y)']
      : ['이름','직급', ...Array.from({length:dim},(_,i)=>i+1)]
    const h2 = includeId
      ? ['','','','', ...Array.from({length:dim},(_,i)=>DAYS_EN[new Date(year,month-1,i+1).getDay()]), '','','','','']
      : ['', '', ...Array.from({length:dim},(_,i)=>DAYS_EN[new Date(year,month-1,i+1).getDay()])]

    const rows: (string|number)[][] = [titleRow, h1, h2]
    for (const dept of DEPTS) {
      const emps = grouped[dept]; if (!emps.length) continue
      rows.push([dept, ...Array(total-1).fill('')])
      for (const e of emps) {
        const sch = schMap[e.id] || {}
        const sum = calcSummary(e.id)
        if (includeId) {
          rows.push([e.id, e.dept, e.name, e.position,
            ...Array.from({length:dim},(_,i)=>sch[i+1]||''),
            sum.D, sum.S, sum.H, sum.OFF, sum.Y])
        } else {
          rows.push([e.name, e.position, ...Array.from({length:dim},(_,i)=>sch[i+1]||'')])
        }
      }
    }

    const ws = XLSX.utils.aoa_to_sheet(rows)
    ws['!merges'] = [{ s:{r:0,c:0}, e:{r:0,c:total-1} }]
    ws['!cols'] = includeId
      ? [{wch:6},{wch:10},{wch:8},{wch:12},...Array.from({length:dim},()=>({wch:4})),{wch:6},{wch:6},{wch:6},{wch:6},{wch:6}]
      : [{wch:8},{wch:12},...Array.from({length:dim},()=>({wch:4}))]
    ws['!rows'] = [{hpt:26},{hpt:20},{hpt:16}]

    // Title
    const ta = XLSX.utils.encode_cell({r:0,c:0})
    if (!ws[ta]) ws[ta] = {v:titleRow[0],t:'s'}
    ws[ta].s = { fill:{patternType:'solid',fgColor:{rgb:'1e293b'}}, font:{name:FONT,bold:true,sz:14,color:{rgb:'f8fafc'}}, alignment:{horizontal:'center',vertical:'center'} }

    // Headers
    for (let c=0;c<total;c++) {
      ;[1,2].forEach(r => {
        const addr = XLSX.utils.encode_cell({r,c})
        if (!ws[addr]) ws[addr] = {v:'',t:'s'}
        const dateStart = fixedCols
        const isSat = r===2 && c>=dateStart && c<dateStart+dim && new Date(year,month-1,c-dateStart+1).getDay()===6
        const isSun = r===2 && c>=dateStart && c<dateStart+dim && new Date(year,month-1,c-dateStart+1).getDay()===0
        ws[addr].s = { fill:{patternType:'solid',fgColor:{rgb:'334155'}}, font:{name:FONT,bold:true,sz:9,color:{rgb:isSat?'93c5fd':isSun?'fca5a5':'f8fafc'}}, alignment:{horizontal:'center',vertical:'center'}, border:BA }
      })
    }

    // Data
    let dataRow = 3
    for (const dept of DEPTS) {
      const emps = grouped[dept]; if (!emps.length) continue
      const dc = (DEPT_COLORS[dept]||'#64748b').replace('#','')
      for (let c=0;c<total;c++) {
        const addr=XLSX.utils.encode_cell({r:dataRow,c})
        if (!ws[addr]) ws[addr]={v:c===0?dept:'',t:'s'}
        ws[addr].s={ fill:{patternType:'solid',fgColor:{rgb:dc+'22'}}, font:{name:FONT,bold:true,sz:9,color:{rgb:dc}}, border:BA, alignment:{horizontal:c===0?'left':'center',vertical:'center'} }
      }
      dataRow++
      for (const e of emps) {
        const sch = schMap[e.id]||{}
        for (let c=0;c<fixedCols;c++) {
          const addr=XLSX.utils.encode_cell({r:dataRow,c})
          if (!ws[addr]) ws[addr]={v:'',t:'s'}
          ws[addr].s={ font:{name:FONT,sz:9,bold:c===(includeId?2:0)}, border:BA, alignment:{horizontal:'left',vertical:'center'} }
        }
        for (let col=fixedCols;col<fixedCols+dim;col++) {
          const d=col-fixedCols+1; const st=sch[d]||''; const cfg=STATUS_CFG[st]
          const addr=XLSX.utils.encode_cell({r:dataRow,c:col})
          if (!ws[addr]) ws[addr]={v:st,t:'s'}
          ws[addr].s={ fill:st&&cfg.bg!=='transparent'?{patternType:'solid',fgColor:{rgb:cfg.bg.replace('#','')}}:undefined, font:{name:FONT,bold:!!st,sz:9,color:{rgb:st?cfg.color.replace('#',''):'64748b'}}, alignment:{horizontal:'center',vertical:'center'}, border:BA }
        }
        if (includeId) {
          ;(['D','S','H','OFF','Y'] as WorkStatus[]).forEach((s,si) => {
            const addr=XLSX.utils.encode_cell({r:dataRow,c:fixedCols+dim+si})
            if (!ws[addr]) ws[addr]={v:'',t:'s'}
            const cfg=STATUS_CFG[s]
            ws[addr].s={ fill:{patternType:'solid',fgColor:{rgb:cfg.bg.replace('#','')}}, font:{name:FONT,bold:true,sz:9,color:{rgb:cfg.color.replace('#','')}}, alignment:{horizontal:'center'}, border:BA }
          })
        }
        dataRow++
      }
    }
    return ws
  }

  const exportExcel = () => {
    const ws = buildExcelSheet(true)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, `${year}년${month}월`)
    XLSX.writeFile(wb, `근무표_${year}년${month}월_전체.xlsx`)
  }

  const exportEmployeeExcel = () => {
    const ws = buildExcelSheet(false)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, `${year}년${month}월_직원용`)
    XLSX.writeFile(wb, `근무표_${year}년${month}월_직원용.xlsx`)
  }

  const exportImage = async () => {
    const container = tableContainerRef.current
    if (!container) return
    const table = container.querySelector('table')
    if (!table) return

    const wrapper = document.createElement('div')
    wrapper.style.cssText = 'position:fixed;left:-99999px;top:0;background:#ffffff;padding:16px;width:max-content;z-index:-1'
    const clone = table.cloneNode(true) as HTMLElement
    // sticky 포지션 제거 (html2canvas 호환)
    clone.querySelectorAll('th,td').forEach(el => {
      (el as HTMLElement).style.position = 'static'
    })
    wrapper.appendChild(clone)
    document.body.appendChild(wrapper)
    try {
      await new Promise(r => setTimeout(r, 150))
      const canvas = await html2canvas(wrapper, {
        scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff',
      })
      const link = document.createElement('a')
      link.download = `근무표_${year}년${month}월.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
    } finally {
      document.body.removeChild(wrapper)
    }
  }

  const handleFullPrint = () => { document.body.removeAttribute('data-print'); window.print() }

  const handleEmployeePrint = () => {
    const dateHeaders = Array.from({length:dim},(_,i) => {
      const d=i+1, w=new Date(year,month-1,d).getDay()
      const bg=w===6?'#dbeafe':w===0?'#fee2e2':'#f8fafc'
      const tc=w===6?'#1d4ed8':w===0?'#b91c1c':'#475569'
      return `<th style="border:1px solid #e2e8f0;padding:2px 1px;min-width:22px;text-align:center;background:${bg}"><div style="font-weight:800;font-size:8pt;color:${tc}">${d}</div><div style="font-size:6pt;color:${tc};opacity:.8">${DAYS_KR[w]}</div></th>`
    }).join('')

    const bodyRows = employees.map(e => {
      const sch = schMap[e.id]||{}
      const cells = Array.from({length:dim},(_,i)=>{
        const d=i+1, st=sch[d]||''
        const bg=st?(STATUS_CFG[st]?.bg||'transparent'):'#fff'
        return `<td style="border:1px solid #e2e8f0;padding:2px 1px;text-align:center;background:${bg};font-weight:${st?'bold':'normal'};font-size:8pt">${st}</td>`
      }).join('')
      return `<tr><td style="border:1px solid #e2e8f0;padding:2px 6px;font-weight:700;white-space:nowrap;font-size:8pt">${e.name}</td><td style="border:1px solid #e2e8f0;padding:2px 6px;color:#64748b;white-space:nowrap;font-size:8pt">${e.position}</td>${cells}</tr>`
    }).join('')

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${year}년 ${month}월 근무표</title><style>@page{size:A4 landscape;margin:5mm}body{font-family:'Malgun Gothic',sans-serif;padding:8px}h2{font-size:13pt;font-weight:900;color:#1e293b;margin:0 0 8px}table{border-collapse:collapse;font-size:8pt;width:100%}th{background:#334155;color:#f8fafc;font-weight:bold;border:1px solid #e2e8f0;padding:2px 4px}*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}</style></head><body><h2>${year}년 ${month}월 근무표 (직원용)</h2><table><thead><tr><th style="min-width:50px;text-align:left">이름</th><th style="min-width:70px;text-align:left">직급</th>${dateHeaders}</tr></thead><tbody>${bodyRows}</tbody></table></body></html>`

    const win = window.open('','_blank','width=900,height=600')
    if (!win) return
    win.document.write(html)
    win.document.close()
    setTimeout(() => { win.print(); win.close() }, 300)
  }

  if (loading) return <div className="flex h-full items-center justify-center text-slate-400">로딩 중...</div>


  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-1 overflow-auto p-4 space-y-3">

        {/* Controls */}
        <div className="bg-white rounded-2xl border border-slate-200 p-3 flex flex-col gap-2.5 no-print">
          <div className="flex items-center gap-3 flex-wrap">
            <button onClick={() => { let m=month-1,y=year; if(m<1){m=12;y--}; setMonth(m);setYear(y);setPickerDisplayYear(y) }}
              className="bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg text-sm font-semibold">◀</button>

            <div className="relative" data-month-picker>
              <button onClick={() => { setPickerDisplayYear(year); setMonthPickerOpen(v => !v) }}
                className="font-bold text-slate-700 hover:text-blue-600 px-2 py-1 rounded-lg hover:bg-blue-50 transition-colors flex items-center gap-1">
                {year}년 {month}월
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="m6 9 6 6 6-6"/></svg>
              </button>
              {monthPickerOpen && (
                <div className="absolute left-0 top-full mt-1 z-50 bg-white rounded-2xl shadow-2xl border border-slate-200 p-4 w-64">
                  <div className="flex items-center justify-between mb-3">
                    <button onClick={() => setPickerDisplayYear(y => y-1)} className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-sm font-bold">‹</button>
                    <span className="font-bold text-slate-800">{pickerDisplayYear}년</span>
                    <button onClick={() => setPickerDisplayYear(y => y+1)} className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-sm font-bold">›</button>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {Array.from({length:12},(_,i)=>i+1).map(m => (
                      <button key={m} onClick={() => { setYear(pickerDisplayYear); setMonth(m); setMonthPickerOpen(false) }}
                        className={`h-9 rounded-xl text-sm font-semibold transition-colors ${pickerDisplayYear===year&&m===month?'bg-blue-600 text-white':'hover:bg-blue-50 text-slate-700'}`}>
                        {m}월
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <button onClick={() => { let m=month+1,y=year; if(m>12){m=1;y++}; setMonth(m);setYear(y);setPickerDisplayYear(y) }}
              className="bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg text-sm font-semibold">▶</button>

            <div className="flex gap-2 ml-2 text-xs flex-wrap">
              {Object.entries(STATUS_CFG).filter(([k])=>k!=='').map(([k,v]) => (
                <span key={k} className="flex items-center gap-1">
                  <span className="px-1.5 py-0.5 rounded font-bold" style={{background:v.bg,color:v.color}}>{k}</span>
                  <span className="text-slate-400">{v.label}</span>
                </span>
              ))}
            </div>

            <div className="flex items-center gap-1.5 ml-auto flex-wrap">
              <button onClick={exportExcel} className="flex items-center gap-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 px-2.5 py-1.5 rounded-lg text-xs font-semibold">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                엑셀(전체)
              </button>
              <button onClick={exportEmployeeExcel} className="flex items-center gap-1 bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200 px-2.5 py-1.5 rounded-lg text-xs font-semibold">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                엑셀(직원용)
              </button>
              <button onClick={exportImage} className="flex items-center gap-1 bg-violet-50 hover:bg-violet-100 text-violet-700 border border-violet-200 px-2.5 py-1.5 rounded-lg text-xs font-semibold">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                이미지
              </button>
              <button onClick={handleFullPrint} className="flex items-center gap-1 bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 px-2.5 py-1.5 rounded-lg text-xs font-semibold">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                인쇄(전체)
              </button>
              <button onClick={handleEmployeePrint} className="flex items-center gap-1 bg-sky-50 hover:bg-sky-100 text-sky-600 border border-sky-200 px-2.5 py-1.5 rounded-lg text-xs font-semibold">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                인쇄(직원용)
              </button>
              {canEdit && (
                <button onClick={() => setShowQuotaSettings(v => !v)}
                  className={`flex items-center gap-1 border px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${showQuotaSettings?'bg-indigo-100 text-indigo-700 border-indigo-300':'bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200'}`}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/></svg>
                  오프 설정
                </button>
              )}
            </div>
          </div>

          {/* 확정 행 (관리자) */}
          {canEdit && (
            <div className="flex items-center gap-3 border-t border-slate-100 pt-2.5">
              <span className="text-xs text-slate-400">D·S·H·Y·O 키 또는 팝업으로 입력</span>
              <div className="ml-auto flex items-center gap-2">
                {confirmed ? (
                  <>
                    <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-600">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />직원 공개 중
                    </span>
                    <button onClick={handleUnconfirm} className="bg-slate-100 hover:bg-slate-200 text-slate-500 px-3 py-1.5 rounded-lg text-xs font-semibold">공개 취소</button>
                  </>
                ) : (
                  <>
                    <span className="flex items-center gap-1.5 text-xs text-amber-600">
                      <span className="w-2 h-2 rounded-full bg-amber-400" />임시저장 (미공개)
                    </span>
                    <button onClick={handleConfirm} disabled={confirmLoading}
                      className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white px-3 py-1.5 rounded-lg text-xs font-bold">
                      {confirmLoading ? '처리 중...' : '확정하기 →'}
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 직원: 미확정 안내 배너 */}
        {isStaff && !confirmed && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 flex items-center gap-2 text-xs text-amber-700 font-medium no-print">
            <span>⏳</span> 아직 확정되지 않은 근무표입니다. 관리자가 확정하기 전까지 변경될 수 있습니다.
          </div>
        )}

        {/* 근무표 공지 */}
        {showNotice && (() => {
          const availMonths: string[] = []
          for (let i = 0; i <= 3; i++) {
            const m = ((todayM - 1 + i) % 12) + 1
            const y = todayY + Math.floor((todayM - 1 + i) / 12)
            availMonths.push(`${y !== todayY ? y + '년 ' : ''}${m}월`)
          }
          return (
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 no-print">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1.5 text-xs text-blue-800">
                  <div className="font-bold text-sm text-blue-900 mb-2">📌 근무표 안내</div>
                  <p>• 다음 달 근무표는 매달 <strong>15일경</strong> 나올 예정입니다.</p>
                  <p>• 오프 신청은 근무표 확정 전(15일까지) 수정 가능하며, 확정 후에는 <strong>개인 간 교환만</strong> 가능합니다.</p>
                  <p>• 오프 신청 최대 <strong>4개</strong> · 연차는 별도 신청 가능 (오프4 + 연차2 = 총 6개)</p>
                  <p>• 오프는 <strong>3개월 전 1일 0시</strong>부터 신청 가능합니다.</p>
                  <p className="text-blue-600 font-semibold">현재 신청 가능한 월: {availMonths.join(', ')}</p>
                </div>
                <button onClick={() => setShowNotice(false)}
                  className="text-blue-400 hover:text-blue-600 text-xl leading-none flex-shrink-0 px-1">×</button>
              </div>
            </div>
          )
        })()}

        {/* 오프 쿼터 설정 패널 (관리자) */}
        {canEdit && showQuotaSettings && (
          <div className="bg-white rounded-2xl border border-slate-200 p-4 no-print">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-700">파트별 최대 희망 오프 인원</span>
              <button onClick={() => setShowQuotaSettings(false)} className="text-slate-400 hover:text-slate-600 text-xl leading-none px-1">×</button>
            </div>
            <div className="flex flex-wrap gap-4">
              {Object.entries(offQuotas).map(([dept, max]) => (
                <div key={dept} className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 whitespace-nowrap">{dept}</span>
                  <input
                    type="number" min="1" max="20" value={max}
                    onChange={e => handleQuotaChange(dept, parseInt(e.target.value))}
                    onBlur={() => saveQuota(dept)}
                    onKeyDown={e => { if (e.key === 'Enter') { saveQuota(dept); (e.target as HTMLInputElement).blur() } }}
                    className="w-14 border border-slate-200 rounded-lg px-2 py-1 text-xs text-center outline-none focus:border-blue-400"
                  />
                  <span className="text-xs text-slate-400">명</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-400 mt-2.5">초과 시 날짜 헤더에 ❗ 표시됩니다. 변경 후 다른 곳 클릭하거나 Enter로 저장.</p>
          </div>
        )}

        {/* 근무표 없을 때 생성 배너 */}
        {canEdit && Object.keys(schMap).length === 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-4">
            <div className="text-2xl">📋</div>
            <div className="flex-1">
              <div className="font-bold text-amber-800 text-sm">{year}년 {month}월 근무표가 없습니다</div>
              <div className="text-xs text-amber-600 mt-0.5">연차를 불러와 근무표를 생성할 수 있습니다</div>
            </div>
            <button onClick={() => setCreateModal(true)}
              className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap">
              근무표 생성하기
            </button>
          </div>
        )}

        {/* 팀별 현황 (관리자) */}
        {canEdit && (
          <div className="bg-white rounded-2xl border border-slate-200 p-4 no-print">
            <div className="text-xs font-bold text-slate-500 mb-3">
              팀별 인원 현황
              <span className="font-normal text-slate-400 ml-1">
                {statsDay ? `— ${statsDay}일` : '— 날짜 클릭 시 해당 일 현황'}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {STATS_DEPTS.filter(d => grouped[d].length > 0).map(dept => {
                const col = DEPT_COLORS[dept]||'#64748b'
                const total = grouped[dept].length
                const full = statsDay ? grouped[dept].filter(e => ['D','S'].includes(schMap[e.id]?.[statsDay]||'')).length : null
                const half = statsDay ? grouped[dept].filter(e => schMap[e.id]?.[statsDay]==='H').length : null
                return (
                  <div key={dept} className="flex items-center gap-2 px-3 py-2 rounded-xl"
                    style={{background:col+'12',border:`1px solid ${col}30`}}>
                    <div className="w-2 h-2 rounded-full" style={{background:col}} />
                    <span className="text-xs font-bold" style={{color:col}}>{dept}</span>
                    <span className="text-xs text-slate-400">{total}명</span>
                    {full !== null && (full > 0 || (half??0) > 0) && (
                      <span className="text-xs font-bold px-1.5 py-0.5 rounded-md text-white" style={{background:col}}>
                        {full}{(half??0)>0?`(${half})`:''}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* 근무표 */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div ref={tableContainerRef} className="overflow-auto" style={{maxHeight:'calc(100vh - 240px)'}}>
            <table style={{borderCollapse:'separate',borderSpacing:0,minWidth:'max-content'}}>
              <thead>
                <tr>
                  {canEdit && <th className="px-2 py-2 text-xs text-slate-500 bg-white sticky top-0 z-10 whitespace-nowrap" style={{minWidth:40}}>사번</th>}
                  <th className="px-2 py-2 text-xs text-slate-500 bg-white sticky top-0 z-10 whitespace-nowrap" style={{minWidth:52}}>이름</th>
                  <th className="px-2 py-2 text-xs text-slate-500 bg-white sticky top-0 z-10 whitespace-nowrap" style={{minWidth:72}}>직급</th>
                  {Array.from({length:dim},(_,i)=>i+1).map(d => {
                    const w=dow(d), isSat=w===6, isSun=w===0
                    const isToday=isCurrentMonth&&d===todayD, isSel=selectedDay===d
                    const viol=offViolations[d]
                    return (
                      <th key={d} onClick={() => setSelectedDay(p => p===d?null:d)}
                        className="sticky top-0 z-10 text-center p-0 cursor-pointer select-none"
                        style={{minWidth:40,background:isSel?'#dbeafe':'#f8fafc',borderBottom:isToday?'2px solid #2563eb':isSel?'2px solid #3b82f6':'1px solid #e2e8f0'}}>
                        <div className="relative pt-1.5">
                          <div className={`text-xs font-bold px-1 ${isSat?'text-blue-500':isSun?'text-red-500':'text-slate-600'}${isToday?' underline':''}`}>{d}</div>
                          <div className={`text-xs pb-1.5 opacity-60 ${isSat?'text-blue-400':isSun?'text-red-400':'text-slate-400'}`}>{DAYS_KR[w]}</div>
                          {viol && (
                            <div className="group absolute top-0 right-0">
                              <span className="w-3.5 h-3.5 bg-red-500 text-white rounded-full flex items-center justify-center cursor-help" style={{fontSize:7,fontWeight:800}}>!</span>
                              <div className="invisible group-hover:visible absolute right-0 top-full mt-1 bg-slate-800 text-white rounded-lg px-2.5 py-2 z-[200] shadow-xl pointer-events-none whitespace-nowrap leading-5" style={{fontSize:10}}>
                                <div className="font-bold mb-1">{d}일 희망 오프 초과</div>
                                {viol.map(v => <div key={v.dept}>{v.dept}: {v.names.join(', ')} ({v.names.length}명)</div>)}
                              </div>
                            </div>
                          )}
                        </div>
                      </th>
                    )
                  })}
                  {canEdit && (['D','S','H','OFF','Y'] as WorkStatus[]).map(s => (
                    <th key={s} className="text-xs text-center sticky top-0 z-10 px-1 py-2 whitespace-nowrap"
                      style={{background:STATUS_CFG[s].bg,color:STATUS_CFG[s].color,minWidth:32,fontWeight:800}}>
                      {STATUS_CFG[s].label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DEPTS.map(dept => {
                  const emps = grouped[dept]; if (!emps.length) return null
                  const col  = DEPT_COLORS[dept]||'#64748b'
                  const span = (canEdit?1:0)+2+dim+(canEdit?5:0)
                  return [
                    <tr key={`dept-${dept}`}>
                      <td colSpan={span} style={{background:col+'10',padding:'4px 12px',fontSize:11,fontWeight:700,color:col,borderBottom:'1px solid #e2e8f0'}}>
                        ▸ {dept}
                      </td>
                    </tr>,
                    ...emps.map(e => {
                      const sch=schMap[e.id]||{}
                      const sum=canEdit?calcSummary(e.id):null
                      const isMyRow=isStaff&&profile?.employee_id===e.id
                      const rowBg=(DEPT_COLORS[e.dept]||'#000000')+'0c'
                      return (
                        <tr key={e.id} style={{background:isMyRow?'#eff6ff':rowBg}} className="hover:brightness-95 transition-all">
                          {canEdit && <td className="px-2 py-1.5 font-mono text-xs text-slate-400 whitespace-nowrap">{e.id}</td>}
                          <td className="px-2 py-1.5 text-xs font-semibold text-slate-700 whitespace-nowrap">{e.name}</td>
                          <td className="px-2 py-1.5 text-xs text-slate-400 whitespace-nowrap">{e.position}</td>
                          {Array.from({length:dim},(_,i)=>i+1).map(d => {
                            const st=sch[d]||'', cfg=STATUS_CFG[st]||STATUS_CFG['']
                            const w=dow(d), isSel=selectedDay===d
                            const isClickable=canEdit||(isMyRow&&confirmed)
                            const isPickerOn=canEdit&&picker?.empId===e.id&&picker?.day===d
                            const isCopiedSrc=clipSrc?.empId===e.id&&clipSrc?.day===d
                            const isPasteTarget=clipStatus!==null&&canEdit
                            return (
                              <td key={d} onClick={ev => isClickable?handleCellClick(ev,e.id,d):undefined}
                                className={`text-center transition-colors ${isClickable?'cursor-pointer':''}`}
                                style={{
                                  background:isSel?'#dbeafe':'#ffffff',
                                  borderRight:w===6?'2px solid #bfdbfe':w===0?'2px solid #fecaca':undefined,
                                  outline:isPickerOn?'2px solid #2563eb':isCopiedSrc?'2px dashed #2563eb':undefined,
                                  minWidth:40,padding:'4px 3px',
                                  position:isPickerOn||isCopiedSrc?'relative':undefined,
                                  zIndex:isPickerOn||isCopiedSrc?1:undefined,
                                  opacity:isPasteTarget&&!isClickable?1:undefined,
                                }}>
                                {st && <span style={{display:'inline-block',background:cfg.bg,color:cfg.color,borderRadius:4,padding:'2px 5px',fontWeight:800,fontSize:11,lineHeight:1.4,minWidth:30}}>{st}</span>}
                              </td>
                            )
                          })}
                          {canEdit && sum && (['D','S','H','OFF','Y'] as WorkStatus[]).map(s => {
                            const v=s==='D'?sum.D:s==='S'?sum.S:s==='H'?sum.H:s==='OFF'?sum.OFF:sum.Y
                            return <td key={s} className="text-center text-xs font-bold px-1 py-1.5" style={{background:STATUS_CFG[s].bg,color:STATUS_CFG[s].color,minWidth:32}}>{v||''}</td>
                          })}
                        </tr>
                      )
                    }),
                  ]
                })}
              </tbody>
              {canEdit && (
                <tfoot>
                  {DEPTS.filter(d => grouped[d].length > 0).map(dept => {
                    const col=DEPT_COLORS[dept]||'#64748b'
                    return (
                      <tr key={`s-${dept}`}>
                        <td colSpan={3} className="text-right pr-2 text-xs font-bold whitespace-nowrap py-1" style={{background:col+'12',color:col}}>{dept}</td>
                        {Array.from({length:dim},(_,i)=>i+1).map(d => {
                          const v=deptDayWork[dept][d]||0, w=dow(d), isSel=selectedDay===d
                          return <td key={d} className="text-center text-xs font-semibold py-1" style={{background:isSel?col+'35':col+'12',color:col,borderRight:w===6?'2px solid #bfdbfe':w===0?'2px solid #fecaca':undefined}}>{fmt(v)}</td>
                        })}
                        <td colSpan={5} style={{background:col+'12'}} />
                      </tr>
                    )
                  })}
                  <tr>
                    <td colSpan={3} className="text-right pr-2 text-xs font-bold text-blue-900 whitespace-nowrap py-1" style={{background:'#dbeafe'}}>합계 근무</td>
                    {Array.from({length:dim},(_,i)=>i+1).map(d => {
                      const v=totalDayWork[d]||0, w=dow(d), isSel=selectedDay===d
                      return <td key={d} className="text-center text-xs font-bold text-blue-900 py-1" style={{background:isSel?'#bfdbfe':'#dbeafe',borderRight:w===6?'2px solid #bfdbfe':w===0?'2px solid #fecaca':undefined}}>{fmt(v)}</td>
                    })}
                    <td colSpan={5} style={{background:'#dbeafe'}} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>

      {clipStatus !== null && canEdit && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[400] bg-slate-800 text-white px-4 py-2.5 rounded-full text-xs font-semibold shadow-2xl flex items-center gap-2.5 select-none pointer-events-none">
          <span style={{
            background: clipStatus ? STATUS_CFG[clipStatus].bg : '#e2e8f0',
            color: clipStatus && STATUS_CFG[clipStatus].color !== 'transparent' ? STATUS_CFG[clipStatus].color : '#64748b',
            padding:'2px 8px', borderRadius:4, fontWeight:800, fontSize:11
          }}>{clipStatus || '빈칸'}</span>
          붙여넣기 모드 — 셀 클릭 시 적용 · Esc 취소
        </div>
      )}

      {picker && canEdit && (
        <div ref={pickerRef} style={{position:'fixed',left:picker.x,top:picker.y,zIndex:300}}
          className="bg-white rounded-xl shadow-2xl p-2 flex items-center gap-1 border border-slate-200">
          <span className="text-xs text-slate-400 px-1 mr-1 font-mono">D·S·H·Y·O·방향키·Esc</span>
          {STATUS_ORDER.map(s => {
            const cfg=STATUS_CFG[s], cur=(schMap[picker.empId]||{})[picker.day]||''
            return (
              <button key={s} onClick={() => setStatus(s)}
                className={`w-10 h-10 rounded-lg text-xs font-bold transition-transform hover:scale-110 ${cur===s?'ring-2 ring-blue-600':''}`}
                style={{background:cfg.bg,color:cfg.color==='transparent'?'#94a3b8':cfg.color}}>
                {s||'—'}
              </button>
            )
          })}
        </div>
      )}

      {createModal && (
        <ScheduleCreateModal year={year} month={month} employees={employees}
          onClose={() => setCreateModal(false)} onCreated={() => { setCreateModal(false); load() }} />
      )}

      {swapModal && (
        <SwapModal empId={swapModal.empId} day={swapModal.day} year={year} month={month}
          employees={employees} schMap={schMap}
          onClose={() => setSwapModal(null)} onSwapped={async () => { setSwapModal(null); await load() }} />
      )}
    </div>
  )
}

// ── Swap Modal ────────────────────────────────────────────────────────────────
interface SwapModalProps {
  empId:string; day:number; year:number; month:number
  employees:Employee[]; schMap:SchMap
  onClose:()=>void; onSwapped:()=>void
}
function SwapModal({ empId, day, year, month, employees, schMap, onClose, onSwapped }: SwapModalProps) {
  const [targetId, setTargetId] = useState('')
  const [saving, setSaving]     = useState(false)
  const myEmp    = employees.find(e => e.id === empId)
  const sameTeam = employees.filter(e => e.dept === myEmp?.dept && e.id !== empId)
  const mySt     = schMap[empId]?.[day] || ''
  const targetSt = targetId ? (schMap[targetId]?.[day]||'') : ''
  const badge    = (st: string) => (
    <span className="inline-block px-3 py-1 rounded-lg text-sm font-bold"
      style={{background:STATUS_CFG[st as WorkStatus]?.bg||'#f8fafc',color:STATUS_CFG[st as WorkStatus]?.color||'#64748b'}}>
      {st||'없음'}
    </span>
  )
  const handleSwap = async () => {
    if (!targetId) return
    setSaving(true)
    const { error } = await supabase.rpc('swap_schedules', { p_emp1:empId, p_emp2:targetId, p_year:year, p_month:month, p_day:day })
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
          <div className="flex-1 text-center"><div className="text-xs text-slate-400 mb-1">나 ({myEmp?.name})</div>{badge(mySt)}</div>
          <div className="text-2xl text-slate-400">⇌</div>
          <div className="flex-1 text-center"><div className="text-xs text-slate-400 mb-1">교환 상대</div>{badge(targetSt)}</div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1.5">팀원 선택</label>
          <select value={targetId} onChange={e => setTargetId(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500">
            <option value="">선택</option>
            {sameTeam.map(e => <option key={e.id} value={e.id}>{e.name} — {schMap[e.id]?.[day]||'없음'}</option>)}
          </select>
          {sameTeam.length===0 && <p className="text-xs text-red-500 mt-1">같은 팀에 교환 가능한 직원이 없습니다</p>}
        </div>
        <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
          <button onClick={onClose} className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-4 py-2 rounded-lg text-sm font-semibold">취소</button>
          <button onClick={handleSwap} disabled={saving||!targetId}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white px-4 py-2 rounded-lg text-sm font-semibold">
            {saving?'교환 중...':'교환하기'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ── Schedule Create Modal ─────────────────────────────────────────────────────
interface ScheduleCreateModalProps { year:number; month:number; employees:Employee[]; onClose:()=>void; onCreated:()=>void }
function ScheduleCreateModal({ year, month, employees, onClose, onCreated }: ScheduleCreateModalProps) {
  const [loading, setLoading]   = useState(true)
  const [leaveItems, setLeaveItems] = useState<Array<{empId:string;day:number;type:string}>>([])
  const [creating, setCreating] = useState(false)
  const DAYS_KR2 = ['일','월','화','수','목','금','토']

  useEffect(() => {
    const pad = (n:number) => String(n).padStart(2,'0')
    supabase.from('leave_entries').select('*')
      .lte('start_date',`${year}-${pad(month)}-31`).gte('end_date',`${year}-${pad(month)}-01`)
      .then(({ data }:{data:Array<{employee_id:string;start_date:string;end_date:string;type:string}>|null}) => {
        const expanded:Array<{empId:string;day:number;type:string}>=[]
        for (const entry of (data||[])) {
          const s=new Date(entry.start_date), e=new Date(entry.end_date)
          for (const dt=new Date(s); dt<=e; dt.setDate(dt.getDate()+1)) {
            if (dt.getFullYear()===year&&dt.getMonth()+1===month)
              expanded.push({empId:entry.employee_id,day:dt.getDate(),type:entry.type})
          }
        }
        setLeaveItems(expanded); setLoading(false)
      })
  }, [year, month])

  const byDay: Record<number,Array<{empId:string;type:string;name:string;dept:string}>> = {}
  for (const item of leaveItems) {
    if (!byDay[item.day]) byDay[item.day]=[]
    const emp=employees.find(e=>e.id===item.empId)
    byDay[item.day].push({...item,name:emp?.name||item.empId,dept:emp?.dept||''})
  }
  const days=Object.keys(byDay).map(Number).sort((a,b)=>a-b)

  const handleCreate = async () => {
    setCreating(true)
    if (leaveItems.length>0) {
      await supabase.from('schedules').upsert(
        leaveItems.map(item=>({employee_id:item.empId,year,month,day:item.day,status:item.type})),
        {onConflict:'employee_id,year,month,day'}
      )
    }
    setCreating(false); onCreated()
  }

  return (
    <Modal open={true} onClose={onClose} title={`${year}년 ${month}월 근무표 생성`}>
      <div className="space-y-4">
        <div className="bg-blue-50 rounded-xl p-3 text-sm text-blue-700">
          승인된 연차/반차가 스케줄에 반영됩니다. 생성 후 나머지 근무를 직접 입력하세요.
        </div>
        {loading ? (
          <div className="text-center py-8 text-slate-400 text-sm">불러오는 중...</div>
        ) : (
          <>
            <div className="text-xs font-bold text-slate-500">{month}월 연차/반차 <span className="font-normal text-slate-400">({leaveItems.length}건)</span></div>
            {days.length===0 ? (
              <div className="bg-slate-50 rounded-xl p-6 text-center text-slate-400 text-sm">등록된 연차/반차 없음<br/><span className="text-xs">빈 근무표가 생성됩니다</span></div>
            ) : (
              <div className="max-h-64 overflow-auto space-y-2 pr-1">
                {days.map(day => {
                  const entries=byDay[day], dow=DAYS_KR2[new Date(year,month-1,day).getDay()]
                  return (
                    <div key={day} className="p-3 rounded-xl border border-slate-100 bg-slate-50">
                      <div className="text-sm font-bold text-slate-700 mb-1.5">{month}월 {day}일 ({dow})</div>
                      <div className="flex flex-wrap gap-1.5">
                        {entries.map((e,i) => (
                          <span key={i} className={`text-xs px-2 py-0.5 rounded-full font-semibold ${e.type==='Y'?'bg-orange-100 text-orange-700':'bg-green-100 text-green-700'}`}>
                            {e.name} ({e.type==='Y'?'연차':'반차'})
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
          <button onClick={handleCreate} disabled={creating||loading}
            className="bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white px-4 py-2 rounded-lg text-sm font-bold">
            {creating?'생성 중...':'근무표 생성하기'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
