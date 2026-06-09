// 테스트 계정 생성 스크립트 (레벨 1 · 레벨 2)
// 사용법: node scripts/create-test-users.mjs
// 생성 계정:
//   레벨 1 — 테스트원 (T001)  test1@rejubery.local / Test1234!
//   레벨 2 — 테스트이 (T002)  test2@rejubery.local / Test1234!

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL     = 'https://lbnghqtrhkkztfnnqyco.supabase.co'
const SERVICE_ROLE_KEY = 'sb_secret_af9iu_P4DkH46sx60M7QGQ_enKPMC8j'

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

const TEST_EMAILS = ['test1@rejubery.local', 'test2@rejubery.local']

const TEST_EMPLOYEES = [
  { id: 'T001', name: '테스트원', dept: '테스트', position: '운영자', start_date: '2026-01-01' },
  { id: 'T002', name: '테스트이', dept: '테스트', position: '직원',   start_date: '2026-01-01' },
]

const TEST_USERS = [
  { name: '테스트원', employee_id: 'T001', level: 1, email: 'test1@rejubery.local', password: 'Test1234!' },
  { name: '테스트이', employee_id: 'T002', level: 2, email: 'test2@rejubery.local', password: 'Test1234!' },
]

// ── Step 1: 이메일로 auth 유저 찾아 완전 삭제 ─────────────────
console.log('기존 테스트 계정 정리 중...')
const { data: { users: allUsers } } = await supabase.auth.admin.listUsers({ perPage: 1000 })
for (const email of TEST_EMAILS) {
  const existing = allUsers.find(u => u.email === email)
  if (existing) {
    await supabase.auth.admin.deleteUser(existing.id)
    console.log(`  삭제: ${email} (${existing.id})`)
  }
}

// 기존 테스트 직원 삭제
for (const e of TEST_EMPLOYEES) {
  await supabase.from('employees').delete().eq('id', e.id)
}

// ── Step 2: 테스트 직원 레코드 생성 ───────────────────────────
console.log('테스트 직원 레코드 생성 중...')
const { error: empErr } = await supabase.from('employees').insert(TEST_EMPLOYEES)
if (empErr) {
  console.error('직원 생성 실패:', empErr.message)
  process.exit(1)
}

// ── Step 3: Auth + 프로필 생성 ────────────────────────────────
for (const u of TEST_USERS) {
  process.stdout.write(`[레벨 ${u.level}] ${u.name} 생성 중...`)

  const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
    email: u.email,
    password: u.password,
    email_confirm: true,
  })

  if (authErr) {
    console.log(` ❌ Auth 실패: ${authErr.message}`)
    continue
  }

  const userId = authData.user.id

  const { error: profileErr } = await supabase.from('profiles').insert({
    id:          userId,
    name:        u.name,
    level:       u.level,
    employee_id: u.employee_id,
  })

  if (profileErr) {
    console.log(` ❌ 프로필 실패: ${profileErr.message}`)
    await supabase.auth.admin.deleteUser(userId)
    continue
  }

  console.log(` ✅ 완료`)
}

console.log('\n──────────────────────────────────────────')
console.log('테스트 계정 정보:')
console.log('  레벨 1 (운영자) — test1@rejubery.local / Test1234!')
console.log('  레벨 2 (직원)   — test2@rejubery.local / Test1234!')
console.log('──────────────────────────────────────────\n')
