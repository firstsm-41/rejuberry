import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Employee } from '../types/database'

const DEPTS = ['대표원장','부원장','총괄실장','실장','코디','간호','피부1(시술)','피부2(관리)','마케팅','미분류']
const DEPT_COLORS: Record<string, string> = {
  '대표원장':'#1e40af','부원장':'#1d4ed8','총괄실장':'#6d28d9',
  '실장':'#7c3aed','코디':'#0369a1','간호':'#047857',
  '피부1(시술)':'#9d174d','피부2(관리)':'#92400e',
  '마케팅':'#0f766e','미분류':'#6b7280',
}

export default function Employees() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    supabase.from('employees').select('id,name,dept,position,status').eq('status','active').order('id')
      .then(({ data }) => { setEmployees(data || []); setLoading(false) })
  }, [])

  const filtered = search
    ? employees.filter(e => e.name.includes(search) || e.position.includes(search) || e.dept.includes(search))
    : employees

  const grouped: Record<string, Employee[]> = {}
  DEPTS.forEach(d => { grouped[d] = [] })
  filtered.forEach(e => { if (grouped[e.dept]) grouped[e.dept].push(e) })
  const activeDepts = DEPTS.filter(d => grouped[d].length > 0)

  if (loading) return <div className="flex h-full items-center justify-center text-slate-400">로딩 중...</div>

  return (
    <div className="flex flex-col h-full overflow-auto">
      <div className="p-6 space-y-5">
        {/* 검색 + 인원 */}
        <div className="flex items-center gap-3">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="이름, 직급, 부서 검색"
            className="border border-slate-200 rounded-xl px-4 py-2 text-sm outline-none focus:border-blue-400 w-56 bg-white"
          />
          <span className="text-sm text-slate-400">{filtered.length}명 재직 중</span>
        </div>

        {/* 부서별 카드 그룹 */}
        {activeDepts.map(dept => {
          const col = DEPT_COLORS[dept] || '#64748b'
          const emps = grouped[dept]
          return (
            <div key={dept}>
              {/* 부서 헤더 */}
              <div className="flex items-center gap-2 mb-3">
                <div className="w-3 h-3 rounded-full" style={{ background: col }} />
                <span className="text-sm font-bold" style={{ color: col }}>{dept}</span>
                <span className="text-xs text-slate-400">{emps.length}명</span>
              </div>

              {/* 직원 카드 그리드 */}
              <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))' }}>
                {emps.map(e => (
                  <div key={e.id}
                    className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col items-center text-center hover:shadow-md hover:border-slate-300 transition-all"
                    style={{ borderTopColor: col, borderTopWidth: 3 }}>
                    {/* 아바타 */}
                    <div className="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-lg mb-2.5 shadow-sm"
                      style={{ background: col }}>
                      {e.name[0]}
                    </div>
                    <div className="font-bold text-slate-800 text-sm leading-tight">{e.name}</div>
                    <div className="text-xs text-slate-400 mt-1 leading-tight">{e.position}</div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}

        {filtered.length === 0 && (
          <div className="text-center text-slate-400 py-20 text-sm">검색 결과가 없습니다</div>
        )}
      </div>
    </div>
  )
}
