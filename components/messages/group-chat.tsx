'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { MessageChat } from './message-chat'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Users } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'

type Participant = {
  user_id: string
  user_profiles: {
    id: string
    full_name: string | null
    avatar_url: string | null
    role: 'ADMIN' | 'USER'
    business: string | null
  }
}

interface GroupChatProps {
  conversationId: string
  userId: string
  role: 'ADMIN' | 'USER'
}

export function GroupChat({ conversationId, userId, role }: GroupChatProps) {
  const [participants, setParticipants] = useState<Participant[]>([])
  const [groupInfo, setGroupInfo] = useState<{
    name: string | null
    created_at: string | null
  } | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const supabase = createClient()

  // Charger les informations du groupe
  useEffect(() => {
    const loadGroupInfo = async () => {
      const { data } = await supabase
        .from('conversations')
        .select('name, created_at')
        .eq('id', conversationId)
        .single()

      if (data) {
        setGroupInfo(data)
      }
    }

    void loadGroupInfo()
  }, [conversationId, supabase])

  // Charger et souscrire aux participants
  useEffect(() => {
    const loadParticipants = async () => {
      const { data, error } = await supabase
        .from('conversation_participants')
        .select(
          `
          user_id,
          user_profiles(
            id,
            full_name,
            avatar_url,
            role,
            business
          )
        `
        )
        .eq('conversation_id', conversationId)

      if (error) {
        console.error('Error loading participants:', error)
        return
      }

      const formattedParticipants: Participant[] = (data || []).map((p: {
        user_id: string
        user_profiles: {
          id: string
          full_name: string | null
          avatar_url: string | null
          role: 'ADMIN' | 'USER'
          business: string | null
        }
      }) => ({
        user_id: p.user_id,
        user_profiles: p.user_profiles,
      }))

      setParticipants(formattedParticipants)
    }

    void loadParticipants()

    // Subscription pour les nouveaux participants
    const channel = supabase
      .channel(`group-participants:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversation_participants',
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => {
          void loadParticipants()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [conversationId, supabase])

  return (
    <div className="flex h-full w-full flex-col relative">
      {/* Header avec bouton participants */}
      <div className="border-b p-4 flex items-center justify-between shrink-0">
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold">
              {groupInfo?.name || 'Groupe Commun'}
            </h2>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {participants.length} {participants.length > 1 ? 'membres' : 'membre'}
          </p>
        </div>
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon">
              <Users className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-[400px] sm:w-[540px]">
            <SheetHeader>
              <SheetTitle>Membres du groupe</SheetTitle>
              <SheetDescription>
                Liste de tous les participants au groupe commun
              </SheetDescription>
            </SheetHeader>
            <ScrollArea className="h-[calc(100vh-120px)] mt-6">
              <div className="space-y-3">
                {participants.map((participant) => {
                  const profile = participant.user_profiles
                  const isCurrentUser = profile.id === userId

                  const handleParticipantClick = async () => {
                    if (isCurrentUser) return

                    // Les USER ne peuvent créer une conversation qu'avec un ADMIN
                    if (role === 'USER' && profile.role !== 'ADMIN') {
                      alert('Vous ne pouvez envoyer des messages qu\'à un administrateur')
                      return
                    }

                    try {
                      const { getOrCreateIndividualConversation } = await import('@/lib/conversation-utils')
                      const conversationId = await getOrCreateIndividualConversation(
                        supabase,
                        userId,
                        profile.id,
                        role
                      )

                      if (conversationId) {
                        // Rediriger vers la page messages avec la conversation
                        window.location.href = `/messages?conversation=${conversationId}`
                      }
                    } catch (error) {
                      console.error('Error creating conversation:', error)
                      const errorMessage = error instanceof Error ? error.message : 'Erreur lors de la création de la conversation'
                      alert(errorMessage)
                    }
                  }

                  // Les USER ne peuvent cliquer que sur les ADMIN
                  const canClick = role === 'ADMIN' || (role === 'USER' && profile.role === 'ADMIN')

                  return (
                    <div
                      key={participant.user_id}
                      className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                        isCurrentUser 
                          ? 'bg-accent cursor-default' 
                          : canClick
                            ? 'hover:bg-accent/50 cursor-pointer'
                            : 'opacity-50 cursor-not-allowed'
                      }`}
                      onClick={canClick ? handleParticipantClick : undefined}
                      title={!canClick && !isCurrentUser ? 'Vous ne pouvez envoyer des messages qu\'à un administrateur' : ''}
                    >
                      <Avatar>
                        {profile.avatar_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={profile.avatar_url} alt={profile.full_name || ''} />
                        ) : (
                          <AvatarFallback>
                            {profile.full_name?.charAt(0).toUpperCase() || 'U'}
                          </AvatarFallback>
                        )}
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium truncate">
                            {profile.full_name || 'Utilisateur'}
                            {isCurrentUser && (
                              <span className="text-muted-foreground ml-2 text-sm">
                                (Vous)
                              </span>
                            )}
                          </p>
                          {profile.role === 'ADMIN' && (
                            <Badge variant="default" className="text-xs">
                              Admin
                            </Badge>
                          )}
                        </div>
                        {profile.business && (
                          <p className="text-sm text-muted-foreground truncate">
                            {profile.business}
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </ScrollArea>
          </SheetContent>
        </Sheet>
      </div>

      {/* Chat component */}
      <div className="flex-1 w-full overflow-hidden min-h-0">
        <MessageChat
          conversationId={conversationId}
          userId={userId}
          role={role}
        />
      </div>
    </div>
  )
}