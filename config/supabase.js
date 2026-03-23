import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const SUPABASE_URL = 'https://nlvpexmaeszkmpbtcsac.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_GXiL_GADisi__c2FzWJeqw_gKwLZJFi'

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
