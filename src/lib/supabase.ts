import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'

const url = import.meta.env.VITE_SUPABASE_URL as string
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!url || url.startsWith('여기에')) {
  console.warn('⚠️ .env.local에 Supabase URL을 입력하세요')
}

export const supabase = createClient<Database>(url, key)
