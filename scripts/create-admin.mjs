// ADMIN 계정 생성 스크립트 (최성민 · Level 0)
// 사용법: node scripts/create-admin.mjs <이메일> <비밀번호>
// 예시:   node scripts/create-admin.mjs admin@rejubery.com mypassword123

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL     = 'https://lbnghqtrhkkztfnnqyco.supabase.co'
const SERVICE_ROLE_KEY = 'sb_secret_af9iu_P4DkH46sx60M7QGQ_enKPMC8j'

const email    = process.argv[2]
const password = process.argv[3]

if (!email || !password) {
  console.error('사용법: node scripts/create-admin.mjs <이메일> <비밀번호>')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

console.log('ADMIN 계정 생성 중...')

// 이미 해당 employee_id로 프로필이 있는지 확인
const { data: existing } = await supabase
  .from('profiles')
  .select('id')
  .eq('employee_id', '0022')
  .maybeSingle()

if (existing) {
  console.log('⚠️  이미 최성민(0022) 계정이 존재합니다.')
  process.exit(0)
}

// Auth 계정 생성
const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
})

if (authErr) {
  console.error('Auth 생성 실패:', authErr.message)
  process.exit(1)
}

const userId = authData.user.id

// 프로필 생성
const { error: profileErr } = await supabase.from('profiles').insert({
  id:          userId,
  name:        '최성민',
  level:       0,
  employee_id: '0022',
})

if (profileErr) {
  console.error('프로필 생성 실패:', profileErr.message)
  // Auth 계정은 만들어졌으므로 정리
  await supabase.auth.admin.deleteUser(userId)
  process.exit(1)
}

console.log('✅ ADMIN 계정 생성 완료!')
console.log('   이름  :', '최성민')
console.log('   이메일:', email)
console.log('   레벨  : 0 (ADMIN)')
console.log('   사번  : 0022')
