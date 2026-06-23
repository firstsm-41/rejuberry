// 2026년 6월·7월 근무표를 Supabase schedules 테이블에 임포트
// 사용법: node scripts/import-schedule-2026.mjs
// 월별로 기존 데이터를 삭제 후 재삽입하므로 재실행해도 안전합니다.

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL     = process.env.SUPABASE_URL || 'https://lbnghqtrhkkztfnnqyco.supabase.co'
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'sb_secret_af9iu_P4DkH46sx60M7QGQ_enKPMC8j'

const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

const N = null // 해당 날짜 미입력 (입사 전 등)

// ── 2026년 6월 (30일) ───────────────────────────────────────────────
const JUNE = [
  { name:'최수민', days:['D','D','D','D','D','D','D','D','D','D','D','D','D','D','D','D','D','D','D','D','D','D','D','D','D','D','D','D','D','D'] },
  { name:'김주안', days:['D','D','OFF','D','D','OFF','OFF','D','D','D','D','D','D','OFF','D','D','D','D','D','D','OFF','D','D','D','D','D','D','OFF','D','D'] },
  { name:'유라',   days:['D','D','OFF','D','D','OFF','D','D','D','D','OFF','D','D','D','D','OFF','D','D','OFF','OFF','D','D','D','D','OFF','OFF','D','D','OFF','D'] },
  { name:'김보영', days:['D','D','OFF','D','D','OFF','D','D','D','D','D','OFF','OFF','D','D','D','OFF','D','D','D','OFF','OFF','D','D','D','D','D','OFF','D','D'] },
  { name:'공슬비', days:['D','D','OFF','D','D','OFF','D','OFF','OFF','D','D','D','D','OFF','OFF','D','D','D','D','D','D','D','OFF','OFF','D','D','D','D','D','OFF'] },
  { name:'이은경', days:['D','D','OFF','OFF','D','OFF','D','OFF','OFF','OFF','OFF','OFF','OFF','D','OFF','OFF','D','OFF','OFF','OFF','D','D','D','OFF','OFF','OFF','OFF','D','OFF','D'] },
  { name:'김서린', days:['D','D','OFF','D','D','OFF','D','D','D','D','D','OFF','D','D','D','D','OFF','OFF','D','D','D','OFF','OFF','D','D','D','D','D','OFF','OFF'] },
  { name:'신하미', days:['D','D','OFF','D','D','OFF','D','D','D','D','OFF','D','D','D','OFF','OFF','D','D','D','OFF','D','D','D','D','D','OFF','OFF','D','D','D'] },
  { name:'박민희', days:['D','D','OFF','D','D','OFF','D','D','OFF','D','D','D','OFF','OFF','D','D','D','D','OFF','D','D','D','D','OFF','OFF','D','D','OFF','D','D'] },
  { name:'손수지', days:['OFF','OFF','OFF','OFF','OFF','OFF','D','OFF','OFF','OFF','OFF','OFF','OFF','D','OFF','OFF','OFF','OFF','OFF','OFF','OFF','OFF','OFF','OFF','OFF','OFF','OFF','D','OFF','OFF'] },
  { name:'주명옥', days:[N,N,N,N,N,N,N,N,N,N,N,N,N,N,N,N,N,N,N,N,N,N,N,N,'D','D','D','OFF','D','D'] },
  { name:'정재희', days:['D','D','OFF','D','D','OFF','D','H','D','D','D','OFF','D','D','D','H','OFF','D','D','D','D','D','D','OFF','OFF','OFF','D','D','D','OFF'] },
  { name:'이솔빈', days:['D','D','OFF','D','D','OFF','D','D','D','D','OFF','D','D','OFF','OFF','D','D','D','OFF','D','D','D','OFF','D','D','D','OFF','D','D','D'] },
  { name:'국지혜', days:['D','D','OFF','D','D','OFF','D','D','D','D','D','D','OFF','D','D','OFF','D','D','D','OFF','OFF','OFF','D','D','D','D','D','OFF','D','OFF'] },
  { name:'조현숙', days:['D','D','OFF','D','D','OFF','OFF','D','D','D','D','OFF','D','D','D','D','D','OFF','D','D','D','D','D','D','OFF','OFF','OFF','D','D','D'] },
  { name:'윤시은', days:['D','D','OFF','D','D','OFF','D','D','D','D','OFF','D','D','OFF','D','D','D','OFF','OFF','D','D','D','D','OFF','D','D','D','OFF','OFF','D'] },
  { name:'조미연', days:['D','D','OFF','D','D','OFF','D','D','D','D','D','OFF','D','OFF','D','D','D','D','OFF','D','D','D','D','D','OFF','OFF','D','D','OFF','OFF'] },
  { name:'이혜인', days:['D','D','OFF','D','D','OFF','D','D','D','D','OFF','D','D','D','D','D','OFF','OFF','D','D','OFF','OFF','D','D','D','D','OFF','D','D','D'] },
  { name:'이수경', days:['D','D','OFF','D','D','OFF','D','D','D','OFF','D','D','OFF','D','D','D','OFF','OFF','D','OFF','D','D','D','D','OFF','OFF','D','D','D','D'] },
  { name:'변정현', days:['D','D','OFF','D','D','OFF','D','D','D','D','OFF','D','D','D','D','OFF','OFF','D','D','D','D','OFF','D','D','D','OFF','OFF','D','D','OFF'] },
  { name:'정은비', days:['D','D','OFF','D','D','OFF','D','D','D','D','D','OFF','D','D','OFF','D','D','OFF','OFF','D','D','D','OFF','D','D','D','D','D','OFF','D'] },
  { name:'허윤정', days:['D','D','OFF','D','D','OFF','D','D','D','D','D','D','OFF','OFF','D','D','D','D','D','OFF','OFF','D','D','OFF','OFF','D','D','OFF','D','D'] },
  { name:'황성현', days:[N,N,N,N,N,N,N,N,N,N,N,N,N,N,N,N,N,N,'D','D','D','D','OFF','OFF','D','D','D','OFF','D','OFF'] },
]

// ── 2026년 7월 (31일) ───────────────────────────────────────────────
const JULY = [
  { name:'최수민', days:['D','D','D','D','D','D','D','D','D','D','D','D','D','D','D','D','D','D','D','D','D','D','D','D','D','D','D','D','D','D','D'] },
  { name:'김주안', days:['D','D','D','D','OFF','D','D','D','D','D','D','OFF','D','D','D','D','D','D','OFF','D','D','D','D','D','D','OFF','D','D','D','D','D'] },
  { name:'유라',   days:['D','D','D','D','OFF','D','D','D','OFF','D','D','D','D','OFF','D','D','OFF','D','D','D','OFF','D','D','D','D','OFF','D','D','D','OFF','OFF'] },
  { name:'김보영', days:['D','OFF','OFF','D','D','D','D','OFF','OFF','D','D','D','D','D','OFF','D','D','D','D','D','D','OFF','OFF','OFF','OFF','D','D','D','D','D','D'] },
  { name:'공슬비', days:['OFF','D','D','OFF','D','D','D','D','D','OFF','OFF','D','D','D','D','OFF','D','D','OFF','OFF','D','D','D','D','D','D','OFF','D','D','D','D'] },
  { name:'이은경', days:['D','D','D','D','D','OFF','OFF','D','D','D','D','OFF','OFF','OFF','D','D','D','D','D','D','OFF','OFF','D','D','D','D','D','OFF','OFF','D','D'] },
  { name:'김서린', days:['D','D','OFF','D','D','OFF','OFF','D','D','D','OFF','D','D','D','D','D','D','OFF','OFF','OFF','D','D','D','D','D','D','OFF','D','D','D','D'] },
  { name:'신하미', days:['D','OFF','D','D','D','D','D','OFF','OFF','D','D','D','OFF','OFF','D','D','D','D','D','OFF','D','D','OFF','D','D','D','D','OFF','D','D','OFF'] },
  { name:'박민희', days:['D','D','OFF','OFF','D','D','D','D','D','OFF','D','D','D','D','D','OFF','D','D','D','D','D','D','OFF','OFF','OFF','OFF','D','D','D','D','D'] },
  { name:'손수지', days:['OFF','D','D','D','OFF','D','D','OFF','OFF','D','D','D','D','D','OFF','D','D','D','D','D','OFF','OFF','D','D','D','D','D','D','OFF','OFF','D'] },
  { name:'주명옥', days:['D','OFF','D','D','D','OFF','OFF','D','D','D','D','OFF','D','D','OFF','OFF','OFF','D','D','D','D','OFF','D','D','D','D','OFF','D','D','D','D'] },
  { name:'정재희', days:['D','D','OFF','D','D','D','OFF','D','D','OFF','D','D','OFF','D','D','D','OFF','D','D','D','D','OFF','OFF','D','D','D','OFF','OFF','D','D','D'] },
  { name:'이솔빈', days:['D','OFF','D','D','D','OFF','D','OFF','D','D','D','D','OFF','D','D','OFF','D','D','D','OFF','D','D','D','OFF','D','D','D','OFF','OFF','D','D'] },
  { name:'국지혜', days:['OFF','D','D','D','OFF','D','D','OFF','D','D','D','D','D','OFF','OFF','D','D','OFF','D','D','D','D','D','OFF','D','D','D','D','D','OFF','D'] },
  { name:'조현숙', days:['OFF','D','D','OFF','D','D','D','D','OFF','D','D','D','D','OFF','D','OFF','D','D','OFF','D','D','OFF','D','D','D','OFF','D','D','D','D','OFF'] },
  { name:'윤시은', days:['D','OFF','D','D','D','D','OFF','D','D','D','OFF','OFF','D','D','D','D','OFF','D','D','D','OFF','D','D','D','OFF','D','D','D','OFF','D','D'] },
  { name:'조미연', days:['D','D','D','D','OFF','OFF','D','D','D','OFF','D','D','D','D','D','OFF','D','D','OFF','OFF','D','D','OFF','D','D','D','D','D','D','OFF','D'] },
  { name:'이혜인', days:['D','D','OFF','D','D','D','D','OFF','OFF','D','D','D','D','D','OFF','D','D','D','D','OFF','D','D','D','D','OFF','D','D','OFF','OFF','D','OFF'] },
  { name:'이수경', days:['D','OFF','D','D','D','D','OFF','D','D','D','D','OFF','OFF','OFF','D','D','D','D','D','D','OFF','OFF','D','D','D','OFF','D','D','D','D','D'] },
  { name:'변정현', days:['D','OFF','D','D','D','D','D','OFF','OFF','D','D','D','OFF','OFF','D','D','D','OFF','D','D','D','D','OFF','D','D','D','D','OFF','D','D','D'] },
  { name:'정은비', days:['D','D','H','OFF','OFF','D','D','D','D','OFF','OFF','D','D','D','D','D','D','D','D','D','OFF','OFF','D','D','D','OFF','D','D','D','OFF','OFF'] },
  { name:'허윤정', days:['D','D','D','D','D','OFF','OFF','D','D','D','D','D','D','OFF','D','D','D','D','OFF','OFF','D','D','D','OFF','OFF','D','D','D','OFF','D','D'] },
  { name:'황성현', days:['D','D','OFF','D','D','D','D','OFF','OFF','D','D','D','D','D','OFF','OFF','D','D','D','D','OFF','D','D','D','D','OFF','OFF','OFF','D','D','D'] },
]

const MONTHS = [
  { year: 2026, month: 6, data: JUNE },
  { year: 2026, month: 7, data: JULY },
]

// 직원 이름 → 사번 매핑
console.log('📋 직원 목록 조회 중...')
const { data: employees, error: empErr } = await sb.from('employees').select('id, name')
if (empErr) { console.error('직원 조회 실패:', empErr.message); process.exit(1) }
const nameToId = Object.fromEntries(employees.map(e => [e.name, e.id]))
console.log(`✅ 직원 ${employees.length}명`)

for (const { year, month, data } of MONTHS) {
  console.log(`\n=== ${year}년 ${month}월 ===`)
  const { error: delErr } = await sb.from('schedules').delete().eq('year', year).eq('month', month)
  if (delErr) { console.error('삭제 실패:', delErr.message); process.exit(1) }

  const inserts = []
  const notFound = []
  for (const { name, days } of data) {
    const empId = nameToId[name]
    if (!empId) { notFound.push(name); continue }
    days.forEach((status, i) => {
      if (status) inserts.push({ employee_id: empId, year, month, day: i + 1, status })
    })
  }
  if (notFound.length) console.warn('⚠️  미발견 직원:', notFound.join(', '))

  const BATCH = 500
  for (let i = 0; i < inserts.length; i += BATCH) {
    const { error } = await sb.from('schedules')
      .upsert(inserts.slice(i, i + BATCH), { onConflict: 'employee_id,year,month,day' })
    if (error) { console.error('삽입 실패:', error.message); process.exit(1) }
  }
  console.log(`✅ ${inserts.length}개 레코드 삽입 (${data.length - notFound.length}명)`)
}

console.log('\n🎉 완료')
