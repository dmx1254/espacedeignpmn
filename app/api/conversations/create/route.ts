import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    // Récupérer le rôle de l'utilisateur
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'Profil utilisateur non trouvé' }, { status: 404 })
    }

    const body = await request.json()
    const { otherUserId } = body

    if (!otherUserId) {
      return NextResponse.json({ error: 'ID de l\'autre utilisateur requis' }, { status: 400 })
    }

    // Vérifier les permissions : un USER ne peut créer une conversation qu'avec un ADMIN
    if (profile.role === 'USER') {
      const { data: otherUserProfile } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', otherUserId)
        .single()

      if (otherUserProfile?.role !== 'ADMIN') {
        return NextResponse.json(
          { error: 'Vous ne pouvez créer une conversation qu\'avec un administrateur' },
          { status: 403 }
        )
      }
    }

    // Vérifier si une conversation existe déjà
    const { data: existingParticipations } = await supabase
      .from('conversation_participants')
      .select('conversation_id')
      .eq('user_id', user.id)

    if (existingParticipations && existingParticipations.length > 0) {
      for (const participation of existingParticipations) {
        const { data: conversation } = await supabase
          .from('conversations')
          .select('id, type')
          .eq('id', participation.conversation_id)
          .eq('type', 'INDIVIDUAL')
          .single()

        if (conversation) {
          const { data: participants } = await supabase
            .from('conversation_participants')
            .select('user_id')
            .eq('conversation_id', conversation.id)

          const participantIds = participants?.map((p) => p.user_id) || []
          if (participantIds.includes(user.id) && participantIds.includes(otherUserId)) {
            // Conversation existe déjà
            return NextResponse.json({ conversationId: conversation.id, existing: true })
          }
        }
      }
    }

    // Utiliser le client admin pour tous les utilisateurs afin d'éviter les problèmes RLS
    // Les vérifications de sécurité sont déjà faites (authentification, permissions, etc.)
    const { createAdminClient } = await import('@/lib/supabase/admin')
    let adminClient
    
    try {
      adminClient = await createAdminClient()
    } catch (adminError) {
      console.error('Error creating admin client:', adminError)
      return NextResponse.json(
        { error: 'Erreur de configuration serveur. Vérifiez SUPABASE_SERVICE_ROLE_KEY.' },
        { status: 500 }
      )
    }

    // Créer une nouvelle conversation individuelle avec le client admin
    const { data: conversation, error: convError } = await adminClient
      .from('conversations')
      .insert({
        type: 'INDIVIDUAL',
        created_by: user.id,
      })
      .select()
      .single()

    if (convError) {
      console.error('Error creating conversation with admin client:', {
        error: convError,
        errorCode: convError.code,
        errorMessage: convError.message,
        userId: user.id,
        userRole: profile.role,
        hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      })
      return NextResponse.json(
        { error: convError.message || 'Erreur lors de la création de la conversation' },
        { status: 500 }
      )
    }

    if (!conversation) {
      console.error('No conversation returned but no error')
      return NextResponse.json(
        { error: 'La conversation n\'a pas été créée' },
        { status: 500 }
      )
    }

    // Ajouter les participants avec le client admin
    const { error: participantsError } = await adminClient
      .from('conversation_participants')
      .insert([
        { conversation_id: conversation.id, user_id: user.id },
        { conversation_id: conversation.id, user_id: otherUserId },
      ])

    if (participantsError) {
      console.error('Error adding participants:', participantsError)
      return NextResponse.json(
        { error: 'Erreur lors de l\'ajout des participants' },
        { status: 500 }
      )
    }

    return NextResponse.json({ conversationId: conversation.id, existing: false })
  } catch (error) {
    console.error('Error in create conversation API:', error)
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}

