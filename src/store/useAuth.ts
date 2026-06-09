import { create } from 'zustand'
import type { User, Session } from '@supabase/supabase-js'
import type { Profile } from '../types/database'
import { supabase } from '../lib/supabase'

interface AuthState {
  user: User | null
  session: Session | null
  profile: Profile | null
  loading: boolean
  setSession: (session: Session | null) => void
  setProfile: (profile: Profile | null) => void
  setLoading: (v: boolean) => void
  signOut: () => Promise<void>
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  session: null,
  profile: null,
  loading: true,

  setSession: (session) => set({ session, user: session?.user ?? null }),
  setProfile: (profile) => set({ profile }),
  setLoading: (loading) => set({ loading }),

  signOut: async () => {
    await supabase.auth.signOut()
    set({ user: null, session: null, profile: null })
  },
}))
