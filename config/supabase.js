import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const SUPABASE_URL = 'SUPABASE_URL'
const SUPABASE_ANON_KEY = 'SUPABASE_ANON_KEY'
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// Test koneksi saat load
supabase.auth.getSession().then(({ data, error }) => {
    if (error) {
        console.error('Supabase connection error:', error.message)
        console.log('Pastikan SUPABASE_URL dan SUPABASE_ANON_KEY sudah benar!')
    } else {
        console.log('Supabase connected successfully')
    }
})
