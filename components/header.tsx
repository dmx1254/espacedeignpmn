"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { User, LogOut, Phone, Building2, Bell, Menu } from "lucide-react";
import { MobileSidebar } from "@/components/mobile-sidebar";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

interface UserProfile {
  id: string;
  full_name: string | null;
  role: "ADMIN" | "USER";
  business: string | null;
  phone?: string;
}

interface Notification {
  id: string;
  conversation_id: string;
  sender_name: string | null;
  content: string | null;
  created_at: string;
  conversation_name: string;
}

export function Header() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const supabase = createClient();
  const router = useRouter();

  const loadNotifications = useCallback(
    async (userId: string) => {
      try {
        // Récupérer les conversations où l'utilisateur participe
        const { data: participantData } = await supabase
          .from("conversation_participants")
          .select("conversation_id")
          .eq("user_id", userId);

        if (!participantData || participantData.length === 0) {
          return;
        }

        const conversationIds = participantData.map((p) => p.conversation_id);

        // Récupérer les conversations
        const { data: conversations } = await supabase
          .from("conversations")
          .select("id, type, name")
          .in("id", conversationIds);

        // Calculer la date d'il y a 24h
        const yesterday = new Date();
        yesterday.setHours(yesterday.getHours() - 24);

        // Récupérer les messages récents (dernières 24h) dans les conversations de l'utilisateur
        const { data: recentMessages } = await supabase
          .from("messages")
          .select(
            `
          id,
          conversation_id,
          content,
          created_at,
          sender_id,
          user_profiles!messages_sender_id_fkey (
            full_name
          )
        `
          )
          .in("conversation_id", conversationIds)
          .neq("sender_id", userId) // Exclure les messages de l'utilisateur lui-même
          .gte("created_at", yesterday.toISOString())
          .order("created_at", { ascending: false })
          .limit(10);

        if (recentMessages) {
          const formattedNotifications: Notification[] = recentMessages.map(
            (msg: {
              id: string;
              conversation_id: string;
              content: string | null;
              created_at: string | null;
              sender_id: string;
              user_profiles: {
                full_name: string | null;
              } | null;
            }) => {
              // Trouver le nom de la conversation
              const conversation = conversations?.find(
                (c) => c.id === msg.conversation_id
              );
              let conversationName = "Conversation";

              if (conversation) {
                if (conversation.type === "GROUP") {
                  conversationName = conversation.name || "Groupe Commun";
                } else {
                  // Pour une conversation individuelle, utiliser le nom du sender
                  conversationName =
                    msg.user_profiles?.full_name || "Utilisateur";
                }
              }

              return {
                id: msg.id,
                conversation_id: msg.conversation_id,
                sender_name: msg.user_profiles?.full_name || null,
                content: msg.content,
                created_at: msg.created_at || "",
                conversation_name: conversationName,
              };
            }
          );

          setNotifications(formattedNotifications);
        }
      } catch (error) {
        console.error("Error loading notifications:", error);
      }
    },
    [supabase]
  );

  const loadProfile = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profileData } = await supabase
        .from("user_profiles")
        .select("id, full_name, role, business")
        .eq("id", user.id)
        .single();

      if (profileData) {
        // Récupérer le numéro de téléphone depuis auth.users
        const {
          data: { user: authUser },
        } = await supabase.auth.getUser();
        setProfile({
          ...profileData,
          phone: authUser?.phone || undefined,
        });
        // Charger les notifications après avoir chargé le profil
        void loadNotifications(user.id);
      }
    } catch (error) {
      console.error("Error loading profile:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  useEffect(() => {
    void loadProfile();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Subscription pour les nouveaux messages
  useEffect(() => {
    if (!profile) return;

    const channel = supabase
      .channel("header-notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        () => {
          // Recharger les notifications quand un nouveau message arrive
          void loadNotifications(profile.id);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile, supabase, loadNotifications]);

  if (loading) {
    return (
      <header className="h-14 bg-gray-50">
        <div className="flex h-full items-center justify-end px-6">
          <div className="h-8 w-8 animate-pulse rounded-full bg-muted" />
        </div>
      </header>
    );
  }

  if (!profile) {
    return null;
  }

  const initials = profile.full_name
    ? profile.full_name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "U";

  return (
    <header
      className="sticky top-0 z-50 h-14 bg-gray-50/95"
      style={{ boxShadow: "rgba(17, 17, 26, 0.1) 0px 1px 0px 0px" }}
    >
      <div className="flex h-full items-center justify-between px-4 md:px-8">
        <div className="flex items-center gap-4">
          {/* Menu mobile */}
          {profile && (
            <>
              <button
                className="md:hidden flex items-center justify-center w-10 h-10 rounded-xl hover:bg-muted/80 transition-all duration-200 border border-transparent hover:border-border"
                onClick={() => setMobileMenuOpen(true)}
              >
                <Menu className="h-5 w-5 text-foreground" />
              </button>
              <MobileSidebar 
                role={profile.role} 
                open={mobileMenuOpen} 
                onOpenChange={setMobileMenuOpen}
              />
            </>
          )}
          {/* Breadcrumb ou titre de section pourrait aller ici */}
        </div>

        <div className="flex items-center gap-2 md:gap-4">
          {/* Notifications */}
          <DropdownMenu
            open={notificationOpen}
            onOpenChange={setNotificationOpen}
          >
            <DropdownMenuTrigger asChild>
              <button className="relative flex items-center justify-center w-10 h-10 rounded-xl hover:bg-muted/80 transition-all duration-200 border border-transparent hover:border-border group">
                <Bell className="h-5 w-5 text-muted-foreground group-hover:text-foreground" />
                {notifications.length > 0 && (
                  <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 bg-red-500 hover:bg-red-600">
                    {notifications.length}
                  </Badge>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-80 shadow-xl border-2"
            >
              <DropdownMenuLabel className="pb-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">Notifications</span>
                  {notifications.length > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {notifications.length}{" "}
                      {notifications.length === 1
                        ? "nouveau message"
                        : "nouveaux messages"}
                    </Badge>
                  )}
                </div>
              </DropdownMenuLabel>
              <ScrollArea className="max-h-[400px]">
                {notifications.length === 0 ? (
                  <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                    Aucune nouvelle notification
                  </div>
                ) : (
                  <div className="px-1 space-y-1">
                    {notifications.map((notification) => (
                      <DropdownMenuItem
                        key={notification.id}
                        className="flex flex-col items-start gap-2 p-3 rounded-lg hover:bg-muted/50 cursor-pointer"
                        onClick={() => {
                          setNotificationOpen(false);
                          router.push(
                            `/messages?conversation=${notification.conversation_id}`
                          );
                        }}
                      >
                        <div className="flex items-start gap-2 w-full">
                          <div className="p-1.5 rounded-md bg-primary/10">
                            <Bell className="h-3 w-3 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-foreground truncate">
                              {notification.conversation_name}
                            </p>
                            {notification.sender_name && (
                              <p className="text-xs text-muted-foreground">
                                De: {notification.sender_name}
                              </p>
                            )}
                            <p className="text-xs text-foreground mt-1 line-clamp-2">
                              {notification.content || "Fichier partagé"}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {getTimeAgo(new Date(notification.created_at))}
                            </p>
                          </div>
                        </div>
                      </DropdownMenuItem>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-muted/80 transition-all duration-200 border border-transparent hover:border-border group">
                <Avatar className="h-8 w-8 ring-2 ring-primary/20 group-hover:ring-primary/40 transition-all">
                  <AvatarFallback className="bg-linear-to-br from-primary to-primary/80 text-primary-foreground font-semibold text-sm shadow-sm">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden text-left lg:block">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-foreground">
                      {profile.full_name || "Utilisateur"}
                    </p>
                    <span
                      style={{ boxShadow: "rgba(0, 0, 0, 0.16) 0px 1px 4px" }}
                      className={cn(
                        "text-xs font-medium rounded-full px-2 py-1",
                        profile.role === "ADMIN"
                          ? "text-primary bg-primary/10"
                          : "text-muted-foreground bg-muted/10"
                      )}
                    >
                      {profile.role === "ADMIN" ? "👑 ADMIN" : "👤 USER"}
                    </span>
                  </div>
                  {profile.business && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {profile.business}
                    </p>
                  )}
                </div>
                <User className="h-4 w-4 text-muted-foreground lg:hidden" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-72 shadow-xl border-2"
            >
              <DropdownMenuLabel className="pb-4">
                <div className="flex items-center gap-4">
                  <Avatar className="h-14 w-14 ring-2 ring-primary/20">
                    <AvatarFallback className="bg-linear-to-br from-primary to-primary/80 text-primary-foreground font-semibold text-lg shadow-md">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col space-y-1.5 flex-1">
                    <div>
                      <p className="font-semibold text-base leading-tight">
                        {profile.full_name || "Utilisateur"}
                      </p>
                      <Badge
                        variant={
                          profile.role === "ADMIN" ? "default" : "secondary"
                        }
                        className="mt-1.5 text-xs font-medium"
                      >
                        {profile.role}
                      </Badge>
                    </div>
                  </div>
                </div>
              </DropdownMenuLabel>

              <DropdownMenuSeparator />

              <div className="px-2 py-2 space-y-2">
                {profile.business && (
                  <div className="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="p-1.5 rounded-md bg-primary/10">
                      <Building2 className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground font-medium">
                        Entreprise
                      </p>
                      <p className="text-sm font-medium text-foreground truncate">
                        {profile.business}
                      </p>
                    </div>
                  </div>
                )}
                {profile.phone && (
                  <div className="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="p-1.5 rounded-md bg-primary/10">
                      <Phone className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground font-medium">
                        Téléphone
                      </p>
                      <p className="text-sm font-medium text-foreground">
                        {profile.phone}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <DropdownMenuSeparator />

              <DropdownMenuItem
                onClick={handleLogout}
                className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer rounded-lg mx-1 my-1"
              >
                <LogOut className="mr-2 h-4 w-4" />
                <span className="font-medium">Déconnexion</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}

// Fonction pour calculer le temps écoulé
function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) {
    return "À l'instant";
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `Il y a ${diffInMinutes} ${
      diffInMinutes === 1 ? "minute" : "minutes"
    }`;
  }

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `Il y a ${diffInHours} ${diffInHours === 1 ? "heure" : "heures"}`;
  }

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) {
    return `Il y a ${diffInDays} ${diffInDays === 1 ? "jour" : "jours"}`;
  }

  return date.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
