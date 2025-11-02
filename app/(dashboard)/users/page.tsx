import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { UsersList } from '@/components/users/users-list'
import { Users } from 'lucide-react'

export default async function UsersPage() {
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

  if (profile?.role !== 'ADMIN') {
    redirect('/dashboard')
  }

  return (
    <div className="flex flex-col gap-6 p-6 bg-linear-to-br from-gray-50 via-white to-gray-50/50 overflow-y-auto">
      {/* Header amélioré */}
      <div className="flex items-center justify-between pb-4 border-b border-border/50">
        <div>
          <div className="flex items-center gap-3 mb-1.5">
            <div className="p-1.5 rounded-lg bg-primary/10">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Gestion des Utilisateurs
            </h1>
          </div>
          <p className="text-muted-foreground text-sm ml-11">
            Gérez les utilisateurs et leurs permissions
          </p>
        </div>
      </div>

      <UsersList />
    </div>
  )
}
