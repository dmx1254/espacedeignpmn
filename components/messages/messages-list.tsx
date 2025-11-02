'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { MessageSquare, Plus } from 'lucide-react'
import { MessageChat } from './message-chat'
import { cn } from '@/lib/utils'
import type { Database } from '@/lib/supabase/database.types'

type Conversation = Database['public']['Tables']['conversations']['Row'] & {
  participants: Array<{
    user_id: string
    user_profiles: {
      id: string
      full_name: string | null
      avatar_url: string | null
      role: 'ADMIN' | 'USER'
    }
  }>
  last_message?: {
    content: string | null
    created_at: string | null
  }
}

interface MessagesListProps {
  userId: string
  role: 'ADMIN' | 'USER'
}

export function MessagesList({ userId, role }: MessagesListProps) {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()
  const searchParams = useSearchParams()

  const loadConversations = useCallback(async () => {
    try {
      // Récupérer les conversations où l'utilisateur participe
      const { data: participantData } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', userId)

      if (!participantData || participantData.length === 0) {
        setLoading(false)
        return
      }

      const conversationIds = participantData.map((p) => p.conversation_id)

      // Récupérer les conversations avec leurs participants
      const { data: conversationsData, error } = await supabase
        .from('conversations')
        .select(
          `
          *,
          conversation_participants!inner(
            user_id,
            user_profiles(
              id,
              full_name,
              avatar_url,
              role
            )
          )
        `
        )
        .in('id', conversationIds)
        .order('updated_at', { ascending: false })

      if (error) throw error

      // Récupérer le dernier message pour chaque conversation
      const conversationsWithMessages = await Promise.all(
        (conversationsData || []).map(async (conv) => {
          const { data: lastMessage } = await supabase
            .from('messages')
            .select('content, created_at')
            .eq('conversation_id', conv.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single()

          return {
            ...conv,
            participants: (conv.conversation_participants || []) as Array<{
              user_id: string
              user_profiles: {
                id: string
                full_name: string | null
                avatar_url: string | null
                role: 'ADMIN' | 'USER'
              }
            }>,
            last_message: lastMessage || undefined,
          }
        })
      )

      // Filtrer les participants pour chaque conversation
      const formattedConversations: Conversation[] = conversationsWithMessages.map((conv) => ({
        ...conv,
        participants: (conv.participants || []).map((p: {
          user_id: string
          user_profiles: {
            id: string
            full_name: string | null
            avatar_url: string | null
            role: 'ADMIN' | 'USER'
          }
        }) => ({
          user_id: p.user_id,
          user_profiles: p.user_profiles,
        })),
      }))

      setConversations(formattedConversations)

      // Sélectionner la première conversation si aucune n'est sélectionnée et pas de paramètre URL
      const conversationParam = searchParams.get('conversation')
      if (!conversationParam && !selectedConversationId && formattedConversations.length > 0) {
        setSelectedConversationId(formattedConversations[0].id)
      }
    } catch (error) {
      console.error('Error loading conversations:', error)
    } finally {
      setLoading(false)
    }
  }, [userId, supabase, searchParams, selectedConversationId])

  useEffect(() => {
    // Vérifier si une conversation est spécifiée dans l'URL
    const conversationParam = searchParams.get('conversation')
    if (conversationParam) {
      setSelectedConversationId(conversationParam)
    }
  }, [searchParams])

  useEffect(() => {
    loadConversations()

    // Subscription pour les nouveaux messages
    const channel = supabase
      .channel('conversations-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
        },
        () => {
          loadConversations()
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversation_participants',
        },
        () => {
          loadConversations()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [loadConversations, supabase])

  const getConversationName = (conversation: Conversation) => {
    if (conversation.type === 'GROUP') {
      return conversation.name || 'Groupe Commun'
    }

    // Pour les conversations individuelles, afficher le nom de l'autre participant
    const otherParticipant = conversation.participants.find((p) => p.user_id !== userId)
    return otherParticipant?.user_profiles?.full_name || 'Utilisateur'
  }

  const getConversationAvatar = (conversation: Conversation) => {
    if (conversation.type === 'GROUP') {
      return null
    }

    const otherParticipant = conversation.participants.find((p) => p.user_id !== userId)
    return otherParticipant?.user_profiles?.avatar_url || null
  }

  const handleCreateConversationWithAdmin = async () => {
    try {
      // Récupérer l'ID de l'admin
      const { data: adminProfile } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('role', 'ADMIN')
        .limit(1)
        .single()

      if (!adminProfile) {
        alert('Aucun administrateur trouvé')
        return
      }

      const adminId = adminProfile.id

      // Utiliser la fonction utilitaire pour créer ou trouver la conversation
      const { getOrCreateIndividualConversation } = await import('@/lib/conversation-utils')
      const conversationId = await getOrCreateIndividualConversation(
        supabase,
        userId,
        adminId,
        role
      )

      if (conversationId) {
        // Recharger les conversations et sélectionner la nouvelle
        await loadConversations()
        setSelectedConversationId(conversationId)
      }
    } catch (error) {
      console.error('Error creating conversation with admin:', error)
      alert('Une erreur est survenue lors de la création de la conversation')
    }
  }

  if (loading) {
    return (
      <div className="flex h-full w-full items-center justify-center" style={{ backgroundColor: 'oklch(0.45 0.18 160)' }}>
        <div className="text-white/80">Chargement...</div>
      </div>
    )
  }

  return (
    <div className="flex h-full w-full">
      {/* Liste des conversations */}
      <div className={`flex w-20 md:w-80 border-r flex-col`} style={{ backgroundColor: 'oklch(0.45 0.18 160)' }}>
        <div className="border-b p-4 flex items-center justify-between opacity-95" style={{ borderColor: 'oklch(0.40 0.20 160)' }}>
          <h2 className="text-lg max-md:hidden font-semibold text-white">
            Conversations
          </h2>
          {role === 'USER' && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleCreateConversationWithAdmin}
              className="h-8 w-8 p-0 rounded-xl border-2 border-white/30 hover:border-white/60 bg-white/10 hover:bg-white/20 transition-all duration-200 shadow-sm hover:shadow-md"
              title="Nouvelle conversation avec l'admin"
            >
              <Plus className="h-4 w-4 text-white" />
            </Button>
          )}
        </div>
        <ScrollArea className="h-[calc(100vh-73px)]">
          {conversations.length === 0 ? (
            <div className="flex h-full items-center justify-center p-8 text-center">
              <div className="animate-in">
                <MessageSquare className="mx-auto mb-2 h-12 w-12 opacity-50 text-white" />
                <p className="font-medium text-white/80">Aucune conversation</p>
              </div>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: 'oklch(0.40 0.20 160)' }}>
              {conversations.map((conversation) => {
                const avatarUrl = getConversationAvatar(conversation)
                const name = getConversationName(conversation)
                const isSelected = selectedConversationId === conversation.id

                return (
                  <Card
                    key={conversation.id}
                    className={cn(
                      "cursor-pointer rounded-none border-0 border-b transition-colors",
                      isSelected
                        ? 'bg-white/20'
                        : 'bg-transparent hover:bg-white/10'
                    )}
                    style={{ borderColor: 'oklch(0.40 0.20 160)' }}
                    onClick={() => setSelectedConversationId(conversation.id)}
                  >
                    <div className="flex items-center gap-3 p-2 md:p-3">
                      <Avatar className="h-4 w-4 ring-2 ring-white/30">
                        {avatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={avatarUrl} alt={name} />
                        ) : (
                          <AvatarFallback className="bg-white/20 text-white text-xs">
                            {name.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        )}
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-xs line-clamp-1 md:text-sm text-white">{name}</div>
                        {conversation.last_message && (
                          <div className="text-xs text-white/70 max-md:text-xs line-clamp-1 mt-0.5">
                            {conversation.last_message.content || 'Fichier envoyé'}
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Chat */}
      {selectedConversationId ? (
        <MessageChat
          conversationId={selectedConversationId}
          userId={userId}
          role={role}
          onBack={() => setSelectedConversationId(null)}
        />
      ) : (
        <div className="hidden md:flex flex-1 items-center justify-center">
          <div className="text-center text-muted-foreground">
            <MessageSquare className="mx-auto mb-2 h-12 w-12 opacity-50" />
            <p>Sélectionnez une conversation</p>
          </div>
        </div>
      )}
    </div>
  )
}
