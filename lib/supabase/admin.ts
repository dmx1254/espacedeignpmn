import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

// Client admin avec service key (utiliser uniquement côté serveur)
export async function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  if (!supabaseUrl) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set')
  }

  if (!serviceKey) {
    console.error('SUPABASE_SERVICE_ROLE_KEY is missing. Available env vars:', Object.keys(process.env).filter(k => k.includes('SUPABASE')))
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set. Ajoutez-la dans votre fichier .env.local')
  }

  const client = createClient<Database>(supabaseUrl, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  return client
}
