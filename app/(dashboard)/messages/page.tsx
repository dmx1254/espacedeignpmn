import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { MessagesList } from '@/components/messages/messages-list'
import { Suspense } from 'react'

export default async function MessagesPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  return (
    <div className="flex h-screen">
      <Suspense fallback={<div className="flex h-full w-full items-center justify-center">Chargement...</div>}>
        <MessagesList userId={user.id} role={profile?.role as 'ADMIN' | 'USER'} />
      </Suspense>
    </div>
  )
}
