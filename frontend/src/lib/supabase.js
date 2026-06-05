import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://munywxejlectjxufjcxb.supabase.co'
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im11bnl3eGVqbGVjdGp4dWZqY3hiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1OTc2NjgsImV4cCI6MjA5NjE3MzY2OH0.M8PLT5H5XQo1SKMcoNT22YfgQ0DnmahyrOYhmwlZxz0'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { autoRefreshToken: true, persistSession: true }
})
