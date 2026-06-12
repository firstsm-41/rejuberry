import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Employee } from '../types/database'

const TEAM_GROUPS = [
  { label: '진료진', depts: ['대표원장', '부원장'],    color: '#1d4ed8' },
  { label: '실장',   depts: ['총괄실장', '실장'],       color: '#7c3aed' },
  { label: '코디',   depts: ['코디'],                   color: '#0369a1' },
  { label: '간호',   depts: ['간호'],                   color: '#047857' },
  { label: '피부1',  depts: ['피부1(시술)'],             color: '#9d174d' },
  { label: '피부2',  depts: ['피부2(관리)'],             color: '#92400e' },
  { label: '마케팅', depts: ['마케팅'],                  color: '#0f766e' },
]

export default function Employees() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    supabase.from('employees')
      .select('id,name,dept,position,status,start_date,phone')
      .eq('status', 'active')
      .order('id')
      .then(({ data }: { data: Employee[] | null }) => { setEmployees(data || []); setLoading(false) })
  }, [])

  const filtered = search
    ? employees.filter(e => e.name.includes(search) || e.position.includes(search) || e.dept.includes(search))
    : employees

  if (loading) return <div className="flex h-full items-center justify-center text-slate-400">로딩 중...</div>

  return (
    <div className="flex flex-col h-full overflow-auto">
      <div className="p-6 space-y-4">
        <div className="flex items-center gap-3">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="이름, 직급, 부서 검색"
            className="border border-slate-200 rounded-xl px-4 py-2 text-sm outline-none focus:border-blue-400 w-56 bg-white"
          />
          <span className="text-sm text-slate-400">{filtered.length}명 재직 중</span>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500">이름</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">소속</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">직급</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">입사일</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">연락처</th>
              </tr>
            </thead>
            <tbody>
              {TEAM_GROUPS.flatMap(group => {
                const emps = filtered.filter(e => group.depts.includes(e.dept))
                if (emps.length === 0) return []
                return [
                  <tr key={`hdr-${group.label}`} style={{ background: group.color + '12' }}>
                    <td colSpan={5} className="px-5 py-2">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: group.color }} />
                        <span className="text-xs font-bold" style={{ color: group.color }}>{group.label}</span>
                        <span className="text-xs text-slate-400 ml-1">{emps.length}명</span>
                      </div>
                    </td>
                  </tr>,
                  ...emps.map(e => (
                    <tr key={e.id} className="border-t border-slate-100 hover:bg-slate-50/70 transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                            style={{ background: group.color + 'bb' }}>{e.name[0]}</div>
                          <span className="font-semibold text-slate-800">{e.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{e.dept}</td>
                      <td className="px-4 py-3 text-slate-600">{e.position}</td>
                      <td className="px-4 py-3 text-slate-500 tabular-nums">{e.start_date || '—'}</td>
                      <td className="px-4 py-3 text-slate-500 tabular-nums">{e.phone || '—'}</td>
                    </tr>
                  )),
                ]
              })}
            </tbody>
          </table>

          {filtered.length === 0 && (
            <div className="text-center text-slate-400 py-16 text-sm">검색 결과가 없습니다</div>
          )}
        </div>
      </div>
    </div>
  )
}
