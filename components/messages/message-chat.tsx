"use client";

import React, { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Paperclip, Send, X, Trash2, Download, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Database } from "@/lib/supabase/database.types";
import Image from "next/image";

type Message = Database["public"]["Tables"]["messages"]["Row"] & {
  sender: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
    role: "ADMIN" | "USER";
  };
  files: Array<{
    id: string;
    file_name: string;
    file_path: string;
    file_type: "IMAGE" | "PDF" | "VIDEO";
    mime_type: string | null;
  }>;
};

interface MessageChatProps {
  conversationId: string;
  userId: string;
  role: "ADMIN" | "USER";
  onBack?: () => void;
}

export function MessageChat({
  conversationId,
  userId,
  role,
  onBack,
}: MessageChatProps) {
  const [isFileDownloading, setIsFileDownloading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [content, setContent] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [conversation, setConversation] = useState<{
    id: string;
    type: "INDIVIDUAL" | "GROUP";
    name: string | null;
  } | null>(null);
  const scrollRef = useRef<React.ElementRef<typeof ScrollArea>>(null);
  const supabase = createClient();

  useEffect(() => {
    loadConversation();
    loadMessages();

    // Subscription en temps réel pour les nouveaux messages et suppressions
    const channel = supabase
      .channel(`conversation:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => {
          loadMessages();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => {
          loadMessages();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    if (scrollRef.current) {
      // Utiliser setTimeout pour s'assurer que le DOM est complètement rendu
      setTimeout(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
      }, 0);
    }
  };

  const loadConversation = async () => {
    const { data } = await supabase
      .from("conversations")
      .select("*")
      .eq("id", conversationId)
      .single();

    if (data) {
      setConversation(data);
    }
  };

  const loadMessages = async () => {
    const { data: messagesData, error } = await supabase
      .from("messages")
      .select(
        `
        *,
        sender:user_profiles!messages_sender_id_fkey(
          id,
          full_name,
          avatar_url,
          role
        ),
        files:message_files(*)
      `
      )
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error loading messages:", error);
      return;
    }

    const formattedMessages: Message[] = (messagesData || []).map(
      (msg: {
        id: string;
        content: string | null;
        conversation_id: string;
        sender_id: string;
        created_at: string | null;
        updated_at: string | null;
        sender: {
          id: string;
          full_name: string | null;
          avatar_url: string | null;
          role: "ADMIN" | "USER";
        };
        files?: Array<{
          id: string;
          file_name: string;
          file_path: string;
          file_type: "IMAGE" | "PDF" | "VIDEO";
          mime_type: string | null;
        }>;
      }) => ({
        ...msg,
        sender: msg.sender,
        files: msg.files || [],
      })
    );

    setMessages(formattedMessages);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setSelectedFiles((prev) => [...prev, ...files]);
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const getFileType = (file: File): "IMAGE" | "PDF" | "VIDEO" => {
    if (file.type.startsWith("image/")) return "IMAGE";
    if (file.type === "application/pdf") return "PDF";
    if (file.type.startsWith("video/")) return "VIDEO";
    return "IMAGE"; // fallback
  };

  const sendMessage = async () => {
    if (!content.trim() && selectedFiles.length === 0) return;

    setSending(true);

    try {
      // Créer le message directement
      // La politique RLS sur messages vérifie automatiquement que l'utilisateur est participant
      const { data: message, error: messageError } = await supabase
        .from("messages")
        .insert({
          conversation_id: conversationId,
          sender_id: userId,
          content: content.trim() || null,
        })
        .select()
        .single();

      if (messageError) {
        console.error("Message insertion error:", {
          message: messageError.message,
          details: messageError.details,
          hint: messageError.hint,
          code: messageError.code,
        });
        throw new Error(
          `Erreur lors de l'envoi du message: ${
            messageError.message || "Erreur inconnue"
          }`
        );
      }

      if (!message) {
        throw new Error("Le message n'a pas été créé");
      }

      // Upload des fichiers si présents
      if (selectedFiles.length > 0 && message) {
        for (const file of selectedFiles) {
          const fileType = getFileType(file);
          const fileName = `${Date.now()}-${file.name}`;
          const filePath = `messages/${conversationId}/${message.id}/${fileName}`;

          // Upload vers Supabase Storage
          const { error: uploadError } = await supabase.storage
            .from("message-files")
            .upload(filePath, file);

          if (uploadError) {
            console.error("Error uploading file:", {
              message: uploadError.message,
              details: uploadError,
            });
            continue;
          }

          // Enregistrer le fichier en base
          const { error: fileError } = await supabase
            .from("message_files")
            .insert({
              message_id: message.id,
              file_name: file.name,
              file_path: filePath,
              file_type: fileType,
              file_size: file.size,
              mime_type: file.type,
            });

          if (fileError) {
            console.error("Error saving file record:", fileError);
          }
        }
      }

      setContent("");
      setSelectedFiles([]);
      loadMessages();
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : typeof error === "object" && error !== null
          ? JSON.stringify(error)
          : String(error);
      console.error("Error sending message:", errorMessage, error);
      alert(`Erreur: ${errorMessage}`);
    } finally {
      setSending(false);
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer ce message ?")) {
      return;
    }

    try {
      // Supprimer d'abord les fichiers associés du storage
      const { data: messageFiles } = await supabase
        .from("message_files")
        .select("file_path")
        .eq("message_id", messageId);

      if (messageFiles && messageFiles.length > 0) {
        const filePaths = messageFiles.map((f) => f.file_path);
        await supabase.storage.from("message-files").remove(filePaths);
      }

      // Supprimer les références des fichiers en base
      await supabase.from("message_files").delete().eq("message_id", messageId);

      // Supprimer le message
      const { error } = await supabase
        .from("messages")
        .delete()
        .eq("id", messageId);

      if (error) {
        console.error("Error deleting message:", error);
        alert("Erreur lors de la suppression du message");
        return;
      }

      // Recharger les messages pour mettre à jour l'affichage
      loadMessages();
    } catch (error) {
      console.error("Error deleting message:", error);
      alert("Erreur lors de la suppression du message");
    }
  };

  const getFileUrl = (filePath: string) => {
    const { data } = supabase.storage
      .from("message-files")
      .getPublicUrl(filePath);
    return data.publicUrl;
  };

  const canSendMessage = () => {
    // Tous les utilisateurs (ADMIN et USER) peuvent envoyer des messages
    return true;
  };

  const downloadFile = async (file: {
    file_name: string;
    file_path: string;
  }) => {
    try {
      setIsFileDownloading(true);
      const fileUrl = getFileUrl(file.file_path);

      // Récupérer le fichier comme blob
      const response = await fetch(fileUrl);
      const blob = await response.blob();

      // Créer un URL local pour le blob
      const blobUrl = window.URL.createObjectURL(blob);

      // Télécharger
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = file.file_name;
      document.body.appendChild(link);
      link.click();

      // Nettoyer
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error("Erreur lors du téléchargement:", error);
    } finally {
      setIsFileDownloading(false);
    }
  };

  return (
    <div className="flex h-full w-full flex-col">
      {/* Header */}
      <div className="border-b bg-gray-50 p-4 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-base text-foreground">
              {conversation?.type === "GROUP"
                ? conversation.name || "Groupe Commun"
                : "Conversation"}
            </h2>
          </div>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4 min-h-0" ref={scrollRef}>
        <div className="space-y-4">
          {messages.map((message, index) => {
            const isOwn = message.sender_id === userId;

            return (
              <div
                key={message.id}
                className={`flex gap-3 message-bubble group ${
                  isOwn ? "flex-row-reverse" : "flex-row"
                }`}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <Avatar className="h-8 w-8">
                  {message.sender.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={message.sender.avatar_url}
                      alt={message.sender.full_name || ""}
                    />
                  ) : (
                    <AvatarFallback className="bg-muted text-muted-foreground text-xs">
                      {message.sender.full_name?.charAt(0).toUpperCase() || "U"}
                    </AvatarFallback>
                  )}
                </Avatar>
                <div
                  className={`flex flex-col gap-1 max-w-[70%] ${
                    isOwn ? "items-end" : "items-start"
                  }`}
                >
                  {!isOwn && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-muted-foreground">
                        {message.sender.full_name || "Utilisateur"}
                      </span>
                      {message.sender.role === "ADMIN" && (
                        <Badge
                          variant="secondary"
                          className="text-xs px-1.5 py-0 h-4"
                        >
                          Admin
                        </Badge>
                      )}
                    </div>
                  )}
                  <div
                    className={cn(
                      "rounded-lg px-3 py-1.5 text-sm relative group/message",
                      isOwn
                        ? "bg-primary text-primary-foreground rounded-tr-none"
                        : "bg-white border border-border rounded-tl-none"
                    )}
                  >
                    {role === "ADMIN" && (
                      <button
                        onClick={() => handleDeleteMessage(message.id)}
                        className="absolute cursor-pointer bottom-0 -right-2 opacity-0 group-hover/message:opacity-100 transition-opacity bg-red-500 text-white rounded-full p-1 hover:bg-red-600 shadow-lg z-10"
                        title="Supprimer le message"
                      >
                        <Trash2 className="h-3 w-3 text-white" />
                      </button>
                    )}
                    {message.content && (
                      <p className="text-sm leading-relaxed whitespace-pre-wrap wrap-break-word">
                        {message.content}
                      </p>
                    )}
                    {message.files.length > 0 && (
                      <div className="mt-2 space-y-2">
                        {message.files.map((file) => {
                          const fileUrl = getFileUrl(file.file_path);

                          if (file.file_type === "IMAGE") {
                            return (
                              <div
                                key={file.id}
                                className="relative mt-2 rounded-lg overflow-hidden"
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={fileUrl}
                                  alt={file.file_name}
                                  className="max-w-xs rounded-lg object-cover"
                                />
                                <button
                                  onClick={() => downloadFile(file)}
                                  className="absolute flex items-center gap-2 cursor-pointer z-40 bottom-0 left-0 bg-white text-black p-2 rounded-lg transition-all duration-300 hover:bg-gray-200"
                                  disabled={isFileDownloading}
                                >
                                  {isFileDownloading ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <>
                                      <Download className="h-3 w-3" />{" "}
                                      <span className="text-xs">
                                        Télécharger
                                      </span>
                                    </>
                                  )}
                                </button>
                              </div>
                            );
                          }

                          if (file.file_type === "PDF") {
                            console.log("fileUrl", fileUrl);
                            return (
                              <button
                                key={file.id}
                                onClick={() => downloadFile(file)}
                                className={cn(
                                  "mt-2 flex items-center gap-2 cursor-pointer z-40 text-black rounded-lg transition-all duration-300",
                                  isFileDownloading &&
                                    "opacity-50 cursor-not-allowed"
                                )}
                                disabled={isFileDownloading}
                              >
                                <Image
                                  src="/pdf.png"
                                  alt="PDF"
                                  width={50}
                                  height={50}
                                  className="object-cover"
                                />
                              </button>
                            );
                          }
                          if (file.file_type === "VIDEO") {
                            return (
                              <div key={file.id} className="relative">
                                <button
                                  onClick={() => downloadFile(file)}
                                  className="absolute flex items-center gap-2 cursor-pointer z-40 bottom-0 left-0 bg-white text-black p-2 rounded-lg transition-all duration-300 hover:bg-gray-200"
                                  disabled={isFileDownloading}
                                >
                                  {isFileDownloading ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <>
                                      <Download className="h-3 w-3" />{" "}
                                      <span className="text-xs">
                                        Télécharger
                                      </span>
                                    </>
                                  )}
                                </button>
                                <video
                                  src={fileUrl}
                                  controls
                                  className="max-w-md rounded-lg mt-2 object-cover"
                                >
                                  Votre navigateur ne supporte pas la lecture
                                  vidéo.
                                </video>
                              </div>
                            );
                          }

                          return null;
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>

      {/* Input */}
      {canSendMessage() && (
        <div className="border-t bg-white p-3 shrink-0">
          {selectedFiles.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {selectedFiles.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 rounded-md border bg-muted px-2 py-1 text-xs"
                >
                  <span className="truncate max-w-[200px]">{file.name}</span>
                  <button
                    onClick={() => removeFile(index)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2 items-end">
            <input
              type="file"
              id="file-input"
              multiple
              accept="image/*,application/pdf,video/*"
              onChange={handleFileSelect}
              className="hidden"
            />
            <label htmlFor="file-input">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                asChild
              >
                <span>
                  <Paperclip className="h-5 w-5" />
                </span>
              </Button>
            </label>
            <Textarea
              placeholder="Tapez un message"
              className="flex-1 rounded-lg border resize-none min-h-[36px] max-h-32 bg-white text-sm"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              rows={1}
            />
            <Button
              onClick={sendMessage}
              disabled={
                sending || (!content.trim() && selectedFiles.length === 0)
              }
              size="icon"
              className="h-9 w-9 rounded-full bg-primary hover:bg-primary/90 disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
