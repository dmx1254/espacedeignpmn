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

    // Récupérer les données de la requête
    const body = await request.json()
    const { phone, password, fullName, business, role } = body

    if (!phone || !password || !fullName) {
      return NextResponse.json(
        { error: 'Téléphone, mot de passe et nom requis' },
        { status: 400 }
      )
    }

    // Créer l'utilisateur avec l'API admin
    const adminClient = await createAdminClient()

    // Formater le numéro de téléphone (Sénégal +221)
    let formattedPhone = phone.trim().replace(/[^\d+]/g, '')
    
    if (!formattedPhone.startsWith('+')) {
      // Si ça commence par 0, remplacer par +221
      if (formattedPhone.startsWith('0')) {
        formattedPhone = '+221' + formattedPhone.substring(1)
      } else {
        // Sinon, ajouter +221 au début
        formattedPhone = '+221' + formattedPhone
      }
    } else if (!formattedPhone.startsWith('+221')) {
      // Si ça commence par + mais pas +221, on peut corriger si format trop court
      if (formattedPhone.length <= 4) {
        formattedPhone = '+221' + formattedPhone.substring(1)
      }
    }

    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      phone: formattedPhone,
      password,
      phone_confirm: true, // Confirmer automatiquement le téléphone (pas besoin de SMS)
      user_metadata: {
        full_name: fullName,
      },
    })

    if (authError) {
      return NextResponse.json(
        { error: authError.message || 'Erreur lors de la création de l\'utilisateur' },
        { status: 400 }
      )
    }

    if (!authData.user) {
      return NextResponse.json(
        { error: 'Utilisateur non créé' },
        { status: 500 }
      )
    }

    // Mettre à jour le profil avec le rôle
    const { error: profileError } = await adminClient
      .from('user_profiles')
      .update({
        full_name: fullName,
        business: business || null,
        role: role || 'USER',
      })
      .eq('id', authData.user.id)

    if (profileError) {
      return NextResponse.json(
        { error: 'Erreur lors de la mise à jour du profil' },
        { status: 500 }
      )
    }

    // Ajouter l'utilisateur au groupe commun
    const { data: groupConversation } = await adminClient
      .from('conversations')
      .select('id')
      .eq('type', 'GROUP')
      .single()

    if (groupConversation) {
      await adminClient.from('conversation_participants').insert({
        conversation_id: groupConversation.id,
        user_id: authData.user.id,
      })
    }

    return NextResponse.json({ success: true, user: authData.user })
  } catch (error) {
    console.error('Error creating user:', error)
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}
