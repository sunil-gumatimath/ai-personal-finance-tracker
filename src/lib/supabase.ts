import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('Supabase credentials not found. Running in demo mode.')
}

// Using untyped client - types will be inferred from queries
// For full type safety, generate types from your Supabase schema:
// npx supabase gen types typescript --project-id YOUR_PROJECT_ID > src/types/supabase.ts
export const supabase = createClient(
    supabaseUrl || 'https://placeholder.supabase.co',
    supabaseAnonKey || 'placeholder-key'
)
