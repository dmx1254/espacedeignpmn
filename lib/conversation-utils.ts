import { SupabaseClient } from '@supabase/supabase-js'

/**
 * Crée ou trouve une conversation individuelle entre deux utilisateurs
 * Règle : Un USER ne peut créer une conversation qu'avec un ADMIN
 * Un ADMIN peut créer une conversation avec n'importe qui
 * @param supabase - Client Supabase
 * @param currentUserId - ID de l'utilisateur actuel
 * @param otherUserId - ID de l'autre utilisateur
 * @param currentUserRole - Rôle de l'utilisateur actuel (pour vérifier les permissions)
 * @returns L'ID de la conversation (existante ou nouvellement créée)
 */
export async function getOrCreateIndividualConversation(
  supabase: SupabaseClient,
  currentUserId: string,
  otherUserId: string,
  currentUserRole?: 'ADMIN' | 'USER'
): Promise<string | null> {
  try {
    // Vérifier les permissions : un USER ne peut créer une conversation qu'avec un ADMIN
    if (currentUserRole === 'USER') {
      const { data: otherUserProfile } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', otherUserId)
        .single()

      if (otherUserProfile?.role !== 'ADMIN') {
        throw new Error('Vous ne pouvez créer une conversation qu\'avec un administrateur')
      }
    }

    // Vérifier si une conversation existe déjà entre ces deux utilisateurs
    const { data: existingParticipations } = await supabase
      .from('conversation_participants')
      .select('conversation_id')
      .eq('user_id', currentUserId)

    if (existingParticipations && existingParticipations.length > 0) {
      // Vérifier chaque conversation pour voir si elle est avec l'autre utilisateur
      for (const participation of existingParticipations) {
        const { data: conversation } = await supabase
          .from('conversations')
          .select('id, type')
          .eq('id', participation.conversation_id)
          .eq('type', 'INDIVIDUAL')
          .single()

        if (conversation) {
          // Vérifier si l'autre utilisateur est dans cette conversation
          const { data: participants } = await supabase
            .from('conversation_participants')
            .select('user_id')
            .eq('conversation_id', conversation.id)

          const participantIds = participants?.map((p) => p.user_id) || []
          if (participantIds.includes(currentUserId) && participantIds.includes(otherUserId)) {
            // Conversation existe déjà
            return conversation.id
          }
        }
      }
    }

    // Utiliser l'API route pour créer la conversation (utilise le client serveur qui a mieux accès à auth.uid())
    // Cela évite les problèmes de session avec le client browser
    const response = await fetch('/api/conversations/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        otherUserId,
      }),
    })

    const result = await response.json()

    if (!response.ok) {
      throw new Error(result.error || 'Erreur lors de la création de la conversation')
    }

    if (!result.conversationId) {
      throw new Error('La conversation n\'a pas été créée')
    }

    return result.conversationId
  } catch (error) {
    console.error('Error in getOrCreateIndividualConversation:', error)
    throw error
  }
}

