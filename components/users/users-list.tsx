'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Pencil, Trash2, Plus, MessageSquare, Building2, User as UserIcon, MoreVertical } from 'lucide-react'
import { CreateUserDialog } from './create-user-dialog'
import { EditUserDialog } from './edit-user-dialog'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { Database } from '@/lib/supabase/database.types'
import { cn } from '@/lib/utils'

type User = Database['public']['Tables']['user_profiles']['Row']

export function UsersList() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const supabase = createClient()

  const loadUsers = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setUsers(data || [])
    } catch (error) {
      console.error('Error loading users:', error)
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    loadUsers()
  }, [loadUsers])

  const handleDelete = async () => {
    if (!selectedUser) return

    try {
      // Note: La suppression de l'utilisateur dans auth.users doit être faite via l'API Admin
      // Pour l'instant, on supprime juste le profil
      const { error } = await supabase
        .from('user_profiles')
        .delete()
        .eq('id', selectedUser.id)

      if (error) throw error

      setDeleteDialogOpen(false)
      setSelectedUser(null)
      loadUsers()
    } catch (error) {
      console.error('Error deleting user:', error)
    }
  }

  const handleCreateConversation = async (userId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Récupérer le rôle de l'utilisateur actuel
      const { data: currentUserProfile } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      // Utiliser la fonction utilitaire pour créer ou trouver la conversation
      const { getOrCreateIndividualConversation } = await import('@/lib/conversation-utils')
      const conversationId = await getOrCreateIndividualConversation(
        supabase,
        user.id,
        userId,
        currentUserProfile?.role as 'ADMIN' | 'USER'
      )

      if (conversationId) {
        window.location.href = `/messages?conversation=${conversationId}`
      }
    } catch (error) {
      console.error('Error creating conversation:', error)
      alert('Erreur lors de la création de la conversation')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">Chargement...</div>
      </div>
    )
  }

  const getInitials = (name: string | null) => {
    if (!name) return 'U'
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Total: {users.length} utilisateur{users.length > 1 ? 's' : ''}</p>
        </div>
        <Button 
          onClick={() => setCreateDialogOpen(true)}
          className="shadow-sm"
        >
          <Plus className="mr-2 h-4 w-4" />
          Ajouter un utilisateur
        </Button>
      </div>

      {users.length === 0 ? (
        <Card className="p-12 text-center border-2 border-dashed">
          <UserIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
          <p className="text-muted-foreground font-medium">Aucun utilisateur</p>
          <p className="text-sm text-muted-foreground mt-1">Commencez par ajouter un utilisateur</p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {users.map((user) => (
            <Card 
              key={user.id} 
              className={cn(
                "relative overflow-hidden border-2 shadow-md hover:shadow-xl transition-all duration-300 group bg-white",
                "hover:scale-[1.02]"
              )}
            >
              {/* Gradient background effect on hover */}
              <div className={cn(
                "absolute inset-0 bg-linear-to-br opacity-0 group-hover:opacity-5 transition-opacity duration-300",
                user.role === 'ADMIN' 
                  ? "from-primary to-primary/80" 
                  : "from-blue-500 to-blue-400"
              )} />
              
              <div className="relative p-5">
                {/* Header avec avatar et actions */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Avatar className="h-14 w-14 ring-2 ring-border group-hover:ring-primary/30 transition-all duration-300">
                      {user.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img 
                          src={user.avatar_url} 
                          alt={user.full_name || ''} 
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <AvatarFallback className={cn(
                          "text-base font-semibold bg-linear-to-br",
                          user.role === 'ADMIN'
                            ? "from-primary to-primary/80 text-primary-foreground"
                            : "from-blue-500 to-blue-400 text-white"
                        )}>
                          {getInitials(user.full_name)}
                        </AvatarFallback>
                      )}
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-base text-foreground truncate">
                          {user.full_name || 'Utilisateur'}
                        </h3>
                      </div>
                      <Badge 
                        variant={user.role === 'ADMIN' ? 'default' : 'secondary'} 
                        className="text-xs font-medium shadow-sm"
                      >
                        {user.role === 'ADMIN' ? '👑 ADMIN' : '👤 USER'}
                      </Badge>
                    </div>
                  </div>
                  
                  {/* Menu dropdown pour les actions */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 hover:bg-muted/80"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem
                        onClick={() => handleCreateConversation(user.id)}
                        className="cursor-pointer"
                      >
                        <MessageSquare className="mr-2 h-4 w-4" />
                        Envoyer un message
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => {
                          setSelectedUser(user)
                          setEditDialogOpen(true)
                        }}
                        className="cursor-pointer"
                      >
                        <Pencil className="mr-2 h-4 w-4" />
                        Modifier
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          setSelectedUser(user)
                          setDeleteDialogOpen(true)
                        }}
                        className="cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Supprimer
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Informations supplémentaires */}
                {user.business && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border border-border/50 group-hover:bg-muted/80 transition-colors">
                    <div className="p-1.5 rounded-md bg-primary/10">
                      <Building2 className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-muted-foreground">Entreprise</p>
                      <p className="text-sm font-medium text-foreground truncate">{user.business}</p>
                    </div>
                  </div>
                )}

                {/* Actions rapides en bas */}
                <div className="mt-4 pt-4 border-t border-border/50 flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCreateConversation(user.id)}
                    className="flex-1 text-xs h-8 hover:bg-primary/5 hover:border-primary/50 transition-all"
                  >
                    <MessageSquare className="mr-1.5 h-3.5 w-3.5" />
                    Message
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedUser(user)
                      setEditDialogOpen(true)
                    }}
                    className="flex-1 text-xs h-8 hover:bg-primary/5 hover:border-primary/50 transition-all"
                  >
                    <Pencil className="mr-1.5 h-3.5 w-3.5" />
                    Modifier
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <CreateUserDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} onSuccess={loadUsers} />
      {selectedUser && (
        <>
          <EditUserDialog
            open={editDialogOpen}
            onOpenChange={setEditDialogOpen}
            user={selectedUser}
            onSuccess={loadUsers}
          />
          <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Supprimer &apos;utilisateur</DialogTitle>
                <DialogDescription>
                  Êtes-vous sûr de vouloir supprimer {selectedUser.full_name || 'cet utilisateur'} ?
                  Cette action est irréversible.
                </DialogDescription>
              </DialogHeader>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
                  Annuler
                </Button>
                <Button variant="destructive" onClick={handleDelete}>
                  Supprimer
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </>
      )}
    </>
  )
}
