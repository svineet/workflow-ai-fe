import { supabase } from './supabase'
import type { Session, User } from '@supabase/supabase-js'

export async function loginWithGoogle(opts?: { next?: string; prompt?: string }) {
  const next = opts?.next || '/'
  const carryPrompt = opts?.prompt || ''
  const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}&prompt=${encodeURIComponent(carryPrompt)}`
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      queryParams: {
        prompt: 'select_account',
      },
    },
  })
  if (error) throw error
}

export async function logout() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function getSession(): Promise<Session | null> {
  const { data } = await supabase.auth.getSession()
  return data.session
}

export async function getUser(): Promise<User | null> {
  const session = await getSession()
  return session?.user || null
}

export async function getAccessToken(): Promise<string | null> {
  const session = await getSession()
  return session?.access_token || null
}

