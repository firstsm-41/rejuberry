// 기존 auth 계정 비밀번호 재설정 + 프로필 레벨0 설정
// 사용법: node scripts/fix-admin.mjs <새비밀번호>

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL     = 'https://lbnghqtrhkkztfnnqyco.supabase.co'
const SERVICE_ROLE_KEY = 'sb_secret_af9iu_P4DkH46sx60M7QGQ_enKPMC8j'

const password = process.argv[2]
if (!password) { console.error('사용법: node scripts/fix-admin.mjs <새비밀번호>'); process.exit(1) }

const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

const TARGET_EMAIL = 'firstsm41@naver.com'
const USER_ID      = '8df50d22-96a7-4c08-8301-94a63bbe0919'

// 비밀번호 재설정
const { error: pwErr } = await sb.auth.admin.updateUserById(USER_ID, { password })
if (pwErr) { console.error('비밀번호 재설정 실패:', pwErr.message); process.exit(1) }
console.log('✅ 비밀번호 재설정 완료')

// 프로필 upsert (레벨 0, 사번 0022)
const { error: profileErr } = await sb.from('profiles').upsert({
  id: USER_ID, name: '최성민', level: 0, employee_id: '0022'
}, { onConflict: 'id' })

if (profileErr) { console.error('프로필 설정 실패:', profileErr.message); process.exit(1) }
console.log('✅ 어드민 프로필 설정 완료')
console.log('   이메일:', TARGET_EMAIL)
console.log('   레벨  : 0 (ADMIN)')
console.log('   사번  : 0022')
