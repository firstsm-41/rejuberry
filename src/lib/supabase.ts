import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'

const url = import.meta.env.VITE_SUPABASE_URL as string
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!url || url.startsWith('여기에')) {
  console.warn('⚠️ .env.local에 Supabase URL을 입력하세요')
}

// NOTE: supabase-js 2.108의 타입 추론이 수기 작성 Database 타입과 충돌해
// insert/rpc 페이로드가 전부 never로 떨어지는 문제가 있어 런타임 클라이언트는
// 느슨하게(any) 두고, Database/Row 타입은 각 쿼리에서 수동 주석으로 활용한다.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const supabase = createClient(url, key) as SupabaseClient<Database> as any
