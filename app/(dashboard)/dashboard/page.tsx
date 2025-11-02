import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, MessageSquare, FileText, UserCheck, TrendingUp, Clock, Activity, Zap, FolderPlus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import Link from 'next/link'

export default async function DashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const isAdmin = profile?.role === 'ADMIN'

  // Statistiques pour ADMIN
  let stats = {
    totalUsers: 0,
    totalMessages: 0,
    totalFiles: 0,
    totalConversations: 0,
  }

  // Dernières activités pour ADMIN
  let recentActivities: Array<{
    id: string
    type: 'message' | 'conversation' | 'file'
    user_name: string | null
    user_id: string
    action: string
    timestamp: string
    details?: string
  }> = []

  if (isAdmin) {
    const [usersRes, messagesRes, filesRes, conversationsRes] = await Promise.all([
      supabase.from('user_profiles').select('id', { count: 'exact', head: true }),
      supabase.from('messages').select('id', { count: 'exact', head: true }),
      supabase.from('message_files').select('id', { count: 'exact', head: true }),
      supabase.from('conversations').select('id', { count: 'exact', head: true }),
    ])

    stats = {
      totalUsers: usersRes.count || 0,
      totalMessages: messagesRes.count || 0,
      totalFiles: filesRes.count || 0,
      totalConversations: conversationsRes.count || 0,
    }

    // Récupérer les dernières activités
    // Derniers messages avec informations utilisateur
    const { data: recentMessages } = await supabase
      .from('messages')
      .select(`
        id,
        content,
        created_at,
        sender_id,
        user_profiles!messages_sender_id_fkey (
          full_name,
          role
        )
      `)
      .order('created_at', { ascending: false })
      .limit(10)

    // Dernières conversations créées
    const { data: recentConversations } = await supabase
      .from('conversations')
      .select(`
        id,
        type,
        name,
        created_at,
        created_by,
        user_profiles!conversations_created_by_fkey (
          full_name,
          role
        )
      `)
      .order('created_at', { ascending: false })
      .limit(5)

    // Derniers fichiers partagés
    const { data: recentFiles } = await supabase
      .from('message_files')
      .select(`
        id,
        file_name,
        file_type,
        created_at,
        messages!message_files_message_id_fkey (
          sender_id,
          user_profiles!messages_sender_id_fkey (
            full_name,
            role
          )
        )
      `)
      .order('created_at', { ascending: false })
      .limit(5)

    // Formater les activités
    const activities: typeof recentActivities = []

    // Ajouter les messages récents
    recentMessages?.forEach((msg: {
      id: string
      content: string | null
      created_at: string | null
      sender_id: string
      user_profiles: {
        full_name: string | null
        role: 'ADMIN' | 'USER'
      } | null
    }) => {
      if (msg.user_profiles && msg.created_at) {
        activities.push({
          id: msg.id,
          type: 'message' as const,
          user_name: msg.user_profiles.full_name,
          user_id: msg.sender_id,
          action: 'a envoyé un message',
          timestamp: msg.created_at,
          details: msg.content || 'Fichier partagé',
        })
      }
    })

    // Ajouter les conversations récentes
    recentConversations?.forEach((conv: {
      id: string
      type: 'INDIVIDUAL' | 'GROUP'
      name: string | null
      created_at: string | null
      created_by: string | null
      user_profiles: {
        full_name: string | null
        role: 'ADMIN' | 'USER'
      } | null
    }) => {
      if (conv.user_profiles && conv.created_at && conv.created_by) {
        activities.push({
          id: conv.id,
          type: 'conversation' as const,
          user_name: conv.user_profiles.full_name,
          user_id: conv.created_by,
          action: conv.type === 'GROUP' 
            ? `a créé le groupe "${conv.name || 'Groupe Commun'}"`
            : 'a créé une conversation',
          timestamp: conv.created_at,
        })
      }
    })

    // Ajouter les fichiers récents
    recentFiles?.forEach((file: {
      id: string
      file_name: string
      file_type: 'IMAGE' | 'PDF' | 'VIDEO'
      created_at: string | null
      messages: {
        sender_id: string
        user_profiles: {
          full_name: string | null
          role: 'ADMIN' | 'USER'
        } | null
      } | null
    }) => {
      if (file.messages?.user_profiles && file.created_at) {
        activities.push({
          id: file.id,
          type: 'file' as const,
          user_name: file.messages.user_profiles.full_name,
          user_id: file.messages.sender_id,
          action: 'a partagé un fichier',
          timestamp: file.created_at,
          details: file.file_name,
        })
      }
    })

    // Trier par date décroissante et limiter à 15
    recentActivities = activities
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 15)
  } else {
    // Statistiques pour USER
    const { data: conversations } = await supabase
      .from('conversation_participants')
      .select('conversation_id')
      .eq('user_id', user.id)

    const conversationIds = conversations?.map((c) => c.conversation_id) || []

    const [messagesRes, filesRes] = await Promise.all([
      supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .in('conversation_id', conversationIds),
      supabase
        .from('message_files')
        .select('id', { count: 'exact', head: true })
        .in(
          'message_id',
          conversationIds.length > 0
            ? (
                await supabase
                  .from('messages')
                  .select('id')
                  .in('conversation_id', conversationIds)
              ).data?.map((m) => m.id) || []
            : []
        ),
    ])

    stats = {
      totalUsers: 0,
      totalMessages: messagesRes.count || 0,
      totalFiles: filesRes.count || 0,
      totalConversations: conversationIds.length,
    }
  }

  const statCards = [
    ...(isAdmin ? [{
      title: 'Utilisateurs',
      value: stats.totalUsers,
      description: 'Total utilisateurs',
      icon: Users,
      gradient: 'from-primary to-primary/80',
    }] : []),
    {
      title: 'Messages',
      value: stats.totalMessages,
      description: isAdmin ? 'Total messages' : 'Vos messages',
      icon: MessageSquare,
      gradient: 'from-primary/90 to-accent/80',
    },
    {
      title: 'Fichiers',
      value: stats.totalFiles,
      description: isAdmin ? 'Total fichiers' : 'Fichiers échangés',
      icon: FileText,
      gradient: 'from-accent to-primary/60',
    },
    {
      title: 'Conversations',
      value: stats.totalConversations,
      description: isAdmin ? 'Total conversations' : 'Vos conversations',
      icon: UserCheck,
      gradient: 'from-primary/70 to-accent/70',
    },
  ]

  const iconColors = [
    'bg-blue-500/10 text-blue-600',
    'bg-green-500/10 text-green-600',
    'bg-purple-500/10 text-purple-600',
    'bg-orange-500/10 text-orange-600',
  ]

  return (
    <div className="flex flex-col gap-4 md:gap-6 p-4 md:p-6 bg-linear-to-br from-gray-50 via-white to-gray-50/50 overflow-y-auto">
      {/* Header du dashboard avec style amélioré */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 pb-3 border-b border-border/50">
        <div>
          <div className="flex items-center gap-3 mb-1.5">
            <div className="p-1.5 rounded-lg bg-primary/10">
              <Activity className="h-5 w-5 text-primary" />
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
              Tableau de bord
            </h1>
          </div>
          <p className="text-muted-foreground text-xs sm:text-sm ml-11 hidden sm:block">
            Vue d&apos;ensemble complète de votre activité
          </p>
        </div>
        <Badge 
          variant={isAdmin ? 'default' : 'secondary'}
          className="px-4 py-1.5 text-xs font-semibold shadow-sm w-fit"
        >
          {isAdmin ? '👑 Administrateur' : '👤 Utilisateur'}
        </Badge>
      </div>

      {/* Statistiques principales avec design amélioré */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat, index) => {
          const Icon = stat.icon
          const colorClass = iconColors[index % iconColors.length]
          return (
            <Card 
              key={stat.title} 
              className="relative overflow-hidden p-0 border-2 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.01] group bg-white"
            >
              {/* Gradient background effect */}
              <div className={`absolute inset-0 bg-linear-to-br ${stat.gradient} opacity-0 group-hover:opacity-5 transition-opacity duration-300`} />
              
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-4 relative z-10">
                <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  {stat.title}
                </CardTitle>
                <div className={`p-2 rounded-lg ${colorClass} shadow-sm group-hover:scale-110 transition-transform duration-300`}>
                  <Icon className="h-5 w-5" />
                </div>
              </CardHeader>
              <CardContent className="relative z-10 px-4 pb-4">
                <div className="flex items-baseline gap-2 mb-1">
                  <div className="text-3xl font-bold text-foreground">
                    {stat.value}
                  </div>
                  {stat.value > 0 && (
                    <div className="flex items-center gap-1 text-green-600 text-xs font-semibold">
                      <TrendingUp className="h-3 w-3" />
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground font-medium mb-2">
                  {stat.description}
                </p>
                {/* Progress bar decorative */}
                <div className="h-1 bg-muted rounded-full overflow-hidden">
                  <div 
                    className={`h-full bg-linear-to-r ${stat.gradient} transition-all duration-500`}
                    style={{ width: `${Math.min((stat.value / (stats.totalMessages || 100)) * 100, 100)}%` }}
                  />
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Sections améliorées */}
      <div className="grid gap-4 lg:grid-cols-3 pb-4">
        {/* Aperçu rapide amélioré */}
        <Card className="border-2 shadow-lg bg-white hover:shadow-xl transition-all duration-300 lg:col-span-2">
          <CardHeader className="border-b border-border/50 pb-3 pt-4 px-4">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-blue-500/10">
                <Clock className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <CardTitle className="text-lg font-bold">Aperçu rapide</CardTitle>
                <CardDescription className="text-xs">
                  Résumé de votre activité récente
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-4 px-4 pb-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg bg-linear-to-r from-blue-50 to-blue-50/50 border border-blue-100 hover:shadow-sm transition-all group">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-lg bg-blue-500/20 group-hover:bg-blue-500/30 transition-colors">
                    <MessageSquare className="h-4 w-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-foreground">Messages aujourd&apos;hui</p>
                    <p className="text-xs text-muted-foreground">Dernière activité</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xl font-bold text-foreground">-</span>
                  <p className="text-xs text-muted-foreground">En attente</p>
                </div>
              </div>
              
              <div className="flex items-center justify-between p-3 rounded-lg bg-linear-to-r from-green-50 to-green-50/50 border border-green-100 hover:shadow-sm transition-all group">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-lg bg-green-500/20 group-hover:bg-green-500/30 transition-colors">
                    <UserCheck className="h-4 w-4 text-green-600" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-foreground">Conversations actives</p>
                    <p className="text-xs text-muted-foreground">Total ouvertes</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xl font-bold text-foreground">{stats.totalConversations}</span>
                  <p className="text-xs text-muted-foreground">Actives</p>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-linear-to-r from-purple-50 to-purple-50/50 border border-purple-100 hover:shadow-sm transition-all group">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-lg bg-purple-500/20 group-hover:bg-purple-500/30 transition-colors">
                    <FileText className="h-4 w-4 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-foreground">Fichiers partagés</p>
                    <p className="text-xs text-muted-foreground">Total échangés</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xl font-bold text-foreground">{stats.totalFiles}</span>
                  <p className="text-xs text-muted-foreground">Fichiers</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Actions rapides améliorées */}
        <Card className="border-2 shadow-lg bg-white hover:shadow-xl transition-all duration-300">
          <CardHeader className="border-b border-border/50 pb-3 pt-4 px-4">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-primary/10">
                <Zap className="h-4 w-4 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg font-bold">Actions rapides</CardTitle>
                <CardDescription className="text-xs">
                  Accès direct aux fonctionnalités
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-4 px-4 pb-4">
            <div className="space-y-2.5">
              <Link 
                href="/messages"
                className="flex items-center gap-3 p-3 rounded-lg border-2 border-dashed border-primary/30 hover:border-primary hover:bg-primary/5 transition-all group"
              >
                <div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                  <MessageSquare className="h-5 w-5 text-primary group-hover:scale-110 transition-transform" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-foreground">Nouveau message</p>
                  <p className="text-xs text-muted-foreground truncate">Commencer une conversation</p>
                </div>
              </Link>
              
              {isAdmin && (
                <Link
                  href="/users"
                  className="flex items-center gap-3 p-3 rounded-lg border-2 border-dashed border-primary/30 hover:border-primary hover:bg-primary/5 transition-all group"
                >
                  <div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                    <Users className="h-5 w-5 text-primary group-hover:scale-110 transition-transform" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-foreground">Gérer utilisateurs</p>
                    <p className="text-xs text-muted-foreground truncate">Administrer les comptes</p>
                  </div>
                </Link>
              )}
              
              <Link
                href="/group"
                className="flex items-center gap-3 p-3 rounded-lg border-2 border-dashed border-primary/30 hover:border-primary hover:bg-primary/5 transition-all group"
              >
                <div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                  <Activity className="h-5 w-5 text-primary group-hover:scale-110 transition-transform" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-foreground">Groupe commun</p>
                  <p className="text-xs text-muted-foreground truncate">Voir le groupe</p>
                </div>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Section Activités récentes pour ADMIN */}
      {isAdmin && recentActivities.length > 0 && (
        <Card className="border-2 shadow-lg bg-white">
          <CardHeader className="border-b border-border/50 pb-3 pt-4 px-4">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-orange-500/10">
                <Activity className="h-4 w-4 text-orange-600" />
              </div>
              <div>
                <CardTitle className="text-lg font-bold">Activités récentes</CardTitle>
                <CardDescription className="text-xs">
                  Dernières actions des utilisateurs
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-4 px-4 pb-4">
            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {recentActivities.map((activity) => {
                const date = new Date(activity.timestamp)
                const timeAgo = getTimeAgo(date)
                
                const getActivityIcon = () => {
                  switch (activity.type) {
                    case 'message':
                      return <MessageSquare className="h-4 w-4 text-blue-600" />
                    case 'conversation':
                      return <FolderPlus className="h-4 w-4 text-green-600" />
                    case 'file':
                      return <FileText className="h-4 w-4 text-purple-600" />
                  }
                }

                const getActivityColor = () => {
                  switch (activity.type) {
                    case 'message':
                      return 'bg-blue-50 border-blue-100'
                    case 'conversation':
                      return 'bg-green-50 border-green-100'
                    case 'file':
                      return 'bg-purple-50 border-purple-100'
                  }
                }

                const initials = activity.user_name
                  ? activity.user_name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .toUpperCase()
                      .slice(0, 2)
                  : 'U'

                return (
                  <div
                    key={activity.id}
                    className={`flex items-start gap-3 p-3 rounded-lg border ${getActivityColor()} hover:shadow-sm transition-all group`}
                  >
                    <Avatar className="h-9 w-9 border-2 border-white shadow-sm">
                      <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-foreground">
                            <span className="font-bold">{activity.user_name || 'Utilisateur'}</span>{' '}
                            {activity.action}
                          </p>
                          {activity.details && (
                            <p className="text-xs text-muted-foreground mt-0.5 truncate">
                              {activity.details}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          {getActivityIcon()}
                          <span className="text-xs font-medium whitespace-nowrap">{timeAgo}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// Fonction pour calculer le temps écoulé
function getTimeAgo(date: Date): string {
  const now = new Date()
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (diffInSeconds < 60) {
    return 'À l\'instant'
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60)
  if (diffInMinutes < 60) {
    return `Il y a ${diffInMinutes} ${diffInMinutes === 1 ? 'minute' : 'minutes'}`
  }

  const diffInHours = Math.floor(diffInMinutes / 60)
  if (diffInHours < 24) {
    return `Il y a ${diffInHours} ${diffInHours === 1 ? 'heure' : 'heures'}`
  }

  const diffInDays = Math.floor(diffInHours / 24)
  if (diffInDays < 7) {
    return `Il y a ${diffInDays} ${diffInDays === 1 ? 'jour' : 'jours'}`
  }

  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}
