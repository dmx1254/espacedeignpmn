import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    // Vérifier que l'utilisateur est un admin
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    // Vérifier si un groupe existe déjà
    const { data: existingGroup } = await supabase
      .from('conversations')
      .select('id')
      .eq('type', 'GROUP')
      .single()

    if (existingGroup) {
      return NextResponse.json(
        { error: 'Un groupe commun existe déjà' },
        { status: 400 }
      )
    }

    // Récupérer les données de la requête
    const body = await request.json()
    const { name } = body

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: 'Le nom du groupe est requis' },
        { status: 400 }
      )
    }

    // Utiliser le client admin pour créer le groupe (contourne RLS)
    const adminClient = await createAdminClient()

    // Créer le groupe
    const { data: newGroup, error: groupError } = await adminClient
      .from('conversations')
      .insert({
        type: 'GROUP',
        name: name.trim(),
        created_by: user.id,
      })
      .select()
      .single()

    if (groupError || !newGroup) {
      console.error('Error creating group:', groupError)
      return NextResponse.json(
        { error: 'Erreur lors de la création du groupe' },
        { status: 500 }
      )
    }

    // Récupérer tous les utilisateurs
    const { data: allUsers } = await adminClient
      .from('user_profiles')
      .select('id')

    if (allUsers && allUsers.length > 0) {
      // Ajouter tous les utilisateurs au groupe avec le client admin
      const { error: participantsError } = await adminClient
        .from('conversation_participants')
        .insert(
          allUsers.map((u) => ({
            conversation_id: newGroup.id,
            user_id: u.id,
          }))
        )

      if (participantsError) {
        console.error('Error adding participants:', participantsError)
        // Ne pas retourner d'erreur, le groupe est créé même si les participants ne sont pas ajoutés
      }
    }

    return NextResponse.json({ success: true, group: newGroup })
  } catch (error) {
    console.error('Error creating group:', error)
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}
