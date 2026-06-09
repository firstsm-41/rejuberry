// 6월 근무표 CSV 데이터를 Supabase schedules 테이블에 임포트
// 사용법: node scripts/import-june-schedule.mjs

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL     = 'https://lbnghqtrhkkztfnnqyco.supabase.co'
const SERVICE_ROLE_KEY = 'sb_secret_af9iu_P4DkH46sx60M7QGQ_enKPMC8j'

const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

const YEAR = 2026
const MONTH = 6

// CSV에서 파싱한 6월 근무 데이터 (null = 해당 날짜 없음/미입력, 빈 문자열 = 건너뜀)
const rawSchedule = [
  { name: '최수민',  days: ['D','D','D','D','D','D','D','D','D','D','D','D','D','D','D','D','D','D','D','D','D','D','D','D','D','D','D','D','D','D'] },
  { name: '김주안',  days: ['D','D','OFF','D','D','OFF','OFF','D','D','D','D','D','D','OFF','D','D','D','D','D','D','OFF','D','D','D','D','D','D','OFF','D','D'] },
  { name: '유라',    days: ['D','D','OFF','D','D','OFF','D','D','D','D','OFF','D','D','D','D','OFF','D','D','OFF','OFF','D','D','D','D','OFF','OFF','D','D','OFF','D'] },
  { name: '김보영',  days: ['D','D','OFF','D','D','OFF','D','D','D','D','D','OFF','OFF','D','D','D','OFF','D','D','D','OFF','OFF','D','D','D','D','D','OFF','D','D'] },
  { name: '공슬비',  days: ['D','D','OFF','D','D','OFF','D','OFF','OFF','D','D','D','D','OFF','OFF','D','D','D','D','D','D','D','OFF','OFF','D','D','D','D','D','OFF'] },
  { name: '이은경',  days: ['D','D','OFF','OFF','D','OFF','D','OFF','OFF','OFF','OFF','OFF','OFF','D','OFF','OFF','OFF','OFF','OFF','OFF','D','OFF','OFF','OFF','OFF','OFF','OFF','D','OFF','OFF'] },
  { name: '김서린',  days: ['D','D','OFF','D','D','OFF','D','D','D','D','D','OFF','D','D','D','D','OFF','OFF','D','D','D','OFF','OFF','D','D','D','D','D','OFF','OFF'] },
  { name: '신하미',  days: ['D','D','OFF','D','D','OFF','D','D','D','D','OFF','D','D','D','OFF','OFF','D','D','D','OFF','D','D','D','D','D','OFF','OFF','D','D','D'] },
  { name: '박민희',  days: ['D','D','OFF','D','D','OFF','D','D','OFF','D','D','D','OFF','OFF','D','D','D','D','OFF','D','D','D','D','OFF','OFF','D','D','OFF','D','D'] },
  { name: '손수지',  days: ['OFF','OFF','OFF','OFF','OFF','OFF','D','OFF','OFF','OFF','OFF','OFF','OFF','D','OFF','OFF','OFF','OFF','OFF','OFF','OFF','OFF','OFF','OFF','OFF','OFF','OFF','D','OFF','OFF'] },
  { name: '주명옥',  days: [null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,'D','D','D','OFF','D','D'] },
  { name: '정재희',  days: ['D','D','OFF','D','D','OFF','D','H','H','D','D','OFF','D','D','D','D','OFF','D','D','D','D','D','D','OFF','OFF','OFF','D','D','D','OFF'] },
  { name: '이솔빈',  days: ['D','D','OFF','D','D','OFF','D','D','D','D','OFF','D','D','OFF','OFF','D','D','D','OFF','D','D','D','OFF','D','D','D','OFF','D','D','D'] },
  { name: '국지혜',  days: ['D','D','OFF','D','D','OFF','D','D','D','D','D','D','OFF','D','D','OFF','D','D','D','OFF','OFF','OFF','D','D','D','D','D','OFF','D','OFF'] },
  { name: '조현숙',  days: ['D','D','OFF','D','D','OFF','OFF','D','D','D','D','OFF','D','D','D','D','D','OFF','D','D','D','D','D','D','OFF','OFF','OFF','D','D','D'] },
  { name: '윤시은',  days: ['D','D','OFF','D','D','OFF','D','D','D','D','OFF','D','D','OFF','D','D','D','OFF','OFF','D','D','D','D','OFF','D','D','D','OFF','OFF','D'] },
  { name: '조미연',  days: ['D','D','OFF','D','D','OFF','D','D','D','D','D','OFF','D','OFF','D','D','D','D','OFF','D','D','D','D','D','OFF','OFF','D','D','OFF','OFF'] },
  { name: '이혜인',  days: ['D','D','OFF','D','D','OFF','D','D','D','D','OFF','D','D','D','D','D','OFF','OFF','D','D','OFF','OFF','D','D','D','D','OFF','D','D','D'] },
  { name: '이수경',  days: ['D','D','OFF','D','D','OFF','D','D','D','OFF','D','D','OFF','D','D','D','OFF','OFF','D','OFF','D','D','D','D','OFF','OFF','D','D','D','D'] },
  { name: '황성현',  days: [null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,'D','D','D','D','OFF','OFF','D','D','D','OFF','D','OFF'] },
  { name: '변정현',  days: ['D','D','OFF','D','D','OFF','D','D','D','D','OFF','D','D','D','D','OFF','OFF','D','D','D','D','OFF','D','D','D','OFF','OFF','D','D','OFF'] },
  { name: '정은비',  days: ['D','D','OFF','D','D','OFF','D','D','D','D','D','OFF','D','D','OFF','D','D','OFF','OFF','D','D','D','OFF','D','D','D','D','D','OFF','D'] },
  { name: '허윤정',  days: ['D','D','OFF','D','D','OFF','D','D','D','D','D','D','OFF','OFF','D','D','D','D','D','OFF','OFF','D','D','OFF','OFF','D','D','OFF','D','D'] },
]

// 1. employees 목록 조회 (name → id 매핑)
console.log('📋 직원 목록 조회 중...')
const { data: employees, error: empErr } = await sb.from('employees').select('id, name, dept, status')
if (empErr) { console.error('직원 조회 실패:', empErr.message); process.exit(1) }

const nameToId = {}
for (const e of employees) {
  nameToId[e.name] = e.id
}
console.log(`✅ 직원 ${employees.length}명 조회 완료`)
console.log('   DB 직원 목록:', employees.map(e => e.name).join(', '))

// 2. 기존 6월 데이터 삭제 후 재입력
console.log(`\n🗑  기존 ${YEAR}년 ${MONTH}월 데이터 삭제 중...`)
const { error: delErr } = await sb.from('schedules')
  .delete()
  .eq('year', YEAR)
  .eq('month', MONTH)
if (delErr) { console.error('삭제 실패:', delErr.message); process.exit(1) }
console.log('✅ 기존 데이터 삭제 완료')

// 3. 새 데이터 삽입
const inserts = []
const notFound = []

for (const { name, days } of rawSchedule) {
  const empId = nameToId[name]
  if (!empId) {
    notFound.push(name)
    continue
  }
  for (let i = 0; i < days.length; i++) {
    const status = days[i]
    if (!status) continue  // null = 미입력 (해당 날짜 없음)
    inserts.push({ employee_id: empId, year: YEAR, month: MONTH, day: i + 1, status })
  }
}

if (notFound.length > 0) {
  console.warn('\n⚠️  DB에서 찾지 못한 직원 (이름 불일치 확인 필요):')
  notFound.forEach(n => console.warn(`   - ${n}`))
}

console.log(`\n📥 ${inserts.length}개 레코드 삽입 중...`)
// 배치 처리 (500개씩)
const BATCH = 500
for (let i = 0; i < inserts.length; i += BATCH) {
  const batch = inserts.slice(i, i + BATCH)
  const { error: insErr } = await sb.from('schedules')
    .upsert(batch, { onConflict: 'employee_id,year,month,day' })
  if (insErr) { console.error('삽입 실패:', insErr.message); process.exit(1) }
}

console.log(`✅ ${YEAR}년 ${MONTH}월 근무표 임포트 완료!`)
console.log(`   총 ${inserts.length}개 레코드 (${rawSchedule.length - notFound.length}명)`)
