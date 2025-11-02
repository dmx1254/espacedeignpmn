"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  MessageSquare,
  Users,
  LogOut,
  MessageCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  Sheet,
  SheetContent,
  SheetClose,
} from "@/components/ui/sheet";

interface MobileSidebarProps {
  role: "ADMIN" | "USER";
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MobileSidebar({ role, open, onOpenChange }: MobileSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
    onOpenChange(false);
  };

  const navItems = [
    {
      title: "Dashboard",
      href: "/dashboard",
      icon: LayoutDashboard,
    },
    {
      title: role === "ADMIN" ? "Conversations" : "Messages",
      href: "/messages",
      icon: MessageSquare,
    },
    ...(role === "ADMIN"
      ? [
          {
            title: "Utilisateurs",
            href: "/users",
            icon: Users,
          },
        ]
      : []),
    {
      title: "Groupe Commun",
      href: "/group",
      icon: MessageCircle,
    },
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-72 p-0" style={{ backgroundColor: 'oklch(0.55 0.15 160)' }}>
        <div className="flex h-full w-full flex-col">
          {/* Header de la sidebar */}
          <div className="flex h-20 items-center border-b px-6 bg-linear-to-r opacity-95" style={{ borderColor: 'oklch(0.48 0.18 160)' }}>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-white/20">
                <Image src="/pmn.jpg" alt="PMN Logo" width={50} height={50} className="object-cover rounded-full" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-white leading-tight">
                  PMN - Messagerie
                </h1>
                <p className="text-xs text-white/80">
                  Espace Design Mobilier National
                </p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 p-4 overflow-y-auto">
            <div className="mb-2 px-3">
              <p className="text-xs font-semibold text-white/70 uppercase tracking-wider">
                Menu principal
              </p>
            </div>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <SheetClose key={item.href} asChild>
                  <Link
                    href={item.href}
                    className={cn(
                      "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 relative",
                      isActive
                        ? "bg-white/20 text-white shadow-sm"
                        : "text-white/90 hover:bg-white/10 hover:shadow-sm"
                    )}
                  >
                    {isActive && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-white rounded-r-full" />
                    )}
                    <Icon
                      className={cn(
                        "h-5 w-5 transition-transform duration-200",
                        isActive ? "scale-110" : "group-hover:scale-105"
                      )}
                    />
                    <span className="flex-1">{item.title}</span>
                  </Link>
                </SheetClose>
              );
            })}
          </nav>

          {/* Footer de la sidebar */}
          <div className="border-t p-4 opacity-95" style={{ borderColor: 'oklch(0.48 0.18 160)' }}>
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 text-white/90 hover:bg-white/20 transition-all duration-200 rounded-lg"
              onClick={handleLogout}
            >
              <LogOut className="h-5 w-5" />
              <span className="font-medium">Déconnexion</span>
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

