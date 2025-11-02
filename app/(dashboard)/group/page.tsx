import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { GroupChat } from '@/components/messages/group-chat'
import { CreateGroupButton } from '@/components/group/create-group-button'

export default async function GroupPage() {
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

  // Trouver le groupe commun via conversation_participants (contourne RLS)
  const { data: participantData } = await supabase
    .from('conversation_participants')
    .select('conversation_id')
    .eq('user_id', user.id)

  let groupConversation: { id: string; name: string | null; type: 'GROUP' } | null = null

  if (participantData && participantData.length > 0) {
    // Récupérer les conversations où l'utilisateur participe
    const conversationIds = participantData.map((p) => p.conversation_id)
    const { data: conversations } = await supabase
      .from('conversations')
      .select('*')
      .in('id', conversationIds)
      .eq('type', 'GROUP')
      .limit(1)

    if (conversations && conversations.length > 0) {
      groupConversation = {
        id: conversations[0].id,
        name: conversations[0].name,
        type: conversations[0].type as 'GROUP',
      }
    }
  }

  // Si l'utilisateur n'est pas participant mais est admin, vérifier si un groupe existe
  if (!groupConversation && profile?.role === 'ADMIN') {
    const { createAdminClient } = await import('@/lib/supabase/admin')
    const adminClient = await createAdminClient()
    
    const { data: allGroups } = await adminClient
      .from('conversations')
      .select('*')
      .eq('type', 'GROUP')
      .limit(1)

    if (allGroups && allGroups.length > 0) {
      groupConversation = {
        id: allGroups[0].id,
        name: allGroups[0].name,
        type: allGroups[0].type as 'GROUP',
      }
      
      // Vérifier si l'utilisateur est participant
      const { data: existingParticipant } = await adminClient
        .from('conversation_participants')
        .select('user_id')
        .eq('conversation_id', groupConversation.id)
        .eq('user_id', user.id)
        .single()

      // Si l'utilisateur n'est pas participant, l'ajouter
      if (!existingParticipant) {
        await adminClient.from('conversation_participants').insert({
          conversation_id: groupConversation.id,
          user_id: user.id,
        })
      }
    }
  }

  // Si le groupe n'existe pas, afficher un bouton de création (seulement pour ADMIN)
  if (!groupConversation && profile?.role === 'ADMIN') {
    return <CreateGroupButton />
  }

  // Si le groupe n'existe pas et que l'utilisateur n'est pas admin
  if (!groupConversation) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="text-center text-muted-foreground space-y-4">
          <p className="text-lg">Groupe commun non disponible</p>
          <p className="text-sm">Contactez un administrateur pour créer le groupe commun</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full w-full">
      <GroupChat
        conversationId={groupConversation.id}
        userId={user.id}
        role={profile?.role as 'ADMIN' | 'USER'}
      />
    </div>
  )
}

