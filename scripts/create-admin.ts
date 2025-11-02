import { readFileSync } from 'fs'
import { resolve } from 'path'
import { createAdminClient } from '../lib/supabase/admin'

// Charger les variables d'environnement depuis .env.local ou .env
function loadEnv() {
  const envFiles = ['.env.local', '.env']
  for (const envFile of envFiles) {
    try {
      const envPath = resolve(process.cwd(), envFile)
      const content = readFileSync(envPath, 'utf-8')
      content.split('\n').forEach(line => {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#')) return
        const match = trimmed.match(/^([^=]+)=(.*)$/)
        if (match) {
          const key = match[1].trim()
          let value = match[2].trim()
          // Enlever les guillemets si présents
          if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1)
          }
          process.env[key] = value
        }
      })
      console.log(`✓ Variables chargées depuis ${envFile}`)
      return
    } catch (error) {
      // Fichier non trouvé, essayer le suivant
      continue
    }
  }
  console.error('⚠️  Aucun fichier .env.local ou .env trouvé')
}

loadEnv()

async function createAdmin() {
  try {
    const adminClient = await createAdminClient()
    
    const phone = '+221778417586'
    const password = 'Admin@2024' // Mot de passe par défaut - à changer après
    const fullName = 'Mamadou SY'
    
    console.log('Création de l\'utilisateur admin...')
    console.log(`Téléphone: ${phone}`)
    console.log(`Nom: ${fullName}`)
    
    // Créer l'utilisateur dans auth
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      phone: phone,
      password: password,
      phone_confirm: true,
      user_metadata: {
        full_name: fullName,
      },
    })

    if (authError) {
      console.error('Erreur lors de la création de l\'utilisateur auth:', authError)
      return
    }

    if (!authData.user) {
      console.error('Utilisateur non créé')
      return
    }

    console.log('✓ Utilisateur auth créé avec succès:', authData.user.id)

    // Mettre à jour le profil avec le rôle ADMIN
    const { error: profileError } = await adminClient
      .from('user_profiles')
      .update({
        full_name: fullName,
        role: 'ADMIN',
      })
      .eq('id', authData.user.id)

    if (profileError) {
      console.error('Erreur lors de la mise à jour du profil:', profileError)
    } else {
      console.log('✓ Profil mis à jour avec le rôle ADMIN')
    }

    // Ajouter l'utilisateur au groupe commun
    const { data: groupConversation } = await adminClient
      .from('conversations')
      .select('id')
      .eq('type', 'GROUP')
      .single()

    if (groupConversation) {
      const { error: participantError } = await adminClient
        .from('conversation_participants')
        .insert({
          conversation_id: groupConversation.id,
          user_id: authData.user.id,
        })

      if (participantError) {
        console.error('Erreur lors de l\'ajout au groupe:', participantError)
      } else {
        console.log('✓ Ajouté au groupe commun')
      }
    }

    console.log('\n✅ Compte Admin créé avec succès!')
    console.log('\n📋 Informations de connexion:')
    console.log(`   Téléphone: ${phone}`)
    console.log(`   Mot de passe: ${password}`)
    console.log('\n⚠️  IMPORTANT: Changez le mot de passe après la première connexion!')
    
  } catch (error) {
    console.error('Erreur:', error)
  }
}

createAdmin()
