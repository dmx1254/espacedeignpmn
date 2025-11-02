"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Eye, EyeOff, AlertCircle, Loader2, Phone } from "lucide-react";
import Image from "next/image";

// Fonction pour traduire les erreurs Supabase en français
const translateError = (error: {
  message?: string;
  status?: number;
}): string => {
  const errorMessage = error.message?.toLowerCase() || "";
  const status = error.status;

  // Erreurs communes Supabase Auth
  if (
    errorMessage.includes("invalid login credentials") ||
    errorMessage.includes("invalid credentials") ||
    errorMessage === "invalid login credentials"
  ) {
    return "Identifiants invalides. Vérifiez votre numéro de téléphone et votre mot de passe.";
  }

  if (
    errorMessage.includes("phone not confirmed") ||
    errorMessage.includes("phone_not_confirmed")
  ) {
    return "Votre numéro de téléphone n'a pas été confirmé.";
  }

  if (
    errorMessage.includes("user not found") ||
    errorMessage.includes("user_not_found")
  ) {
    return "Aucun compte trouvé avec ce numéro de téléphone.";
  }

  if (
    errorMessage.includes("rate limit exceeded") ||
    errorMessage.includes("too many requests")
  ) {
    return "Trop de tentatives. Veuillez patienter quelques instants avant de réessayer.";
  }

  if (errorMessage.includes("network") || errorMessage.includes("fetch")) {
    return "Erreur de connexion. Vérifiez votre connexion internet.";
  }

  if (errorMessage.includes("phone") && errorMessage.includes("invalid")) {
    return "Format de numéro de téléphone invalide. Utilisez le format international (ex: +33612345678).";
  }

  if (errorMessage.includes("password") && errorMessage.includes("weak")) {
    return "Le mot de passe est trop faible. Utilisez au moins 6 caractères.";
  }

  if (status === 400) {
    return "Données invalides. Vérifiez les informations saisies.";
  }

  if (status === 401) {
    return "Authentification échouée. Vérifiez vos identifiants.";
  }

  if (status === 429) {
    return "Trop de tentatives. Veuillez patienter avant de réessayer.";
  }

  if (status === 500 || status === 503) {
    return "Erreur du serveur. Veuillez réessayer plus tard.";
  }

  // Message par défaut
  return "Une erreur est survenue lors de la connexion. Veuillez réessayer.";
};

// Fonction pour formater le numéro de téléphone (Sénégal +221)
const formatPhoneNumber = (value: string): string => {
  // Supprimer tous les caractères non numériques sauf le +
  let cleaned = value.replace(/[^\d+]/g, "");

  // Si ça ne commence pas par +, ajouter le +221 (Sénégal)
  if (cleaned && !cleaned.startsWith("+")) {
    // Si ça commence par 0, remplacer par +221
    if (cleaned.startsWith("0")) {
      cleaned = "+221" + cleaned.substring(1);
    } else {
      // Sinon, ajouter +221 au début
      cleaned = "+221" + cleaned;
    }
  } else if (cleaned.startsWith("+") && !cleaned.startsWith("+221")) {
    // Si ça commence par + mais pas +221, on peut ajouter +221 si besoin
    // Mais on garde tel quel si c'est déjà un format international valide
    if (cleaned.length <= 3) {
      // Format trop court, on ajoute +221
      cleaned = "+221" + cleaned.substring(1);
    }
  }

  return cleaned;
};

export default function LoginPage() {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    // Validation côté client
    const formattedPhone = formatPhoneNumber(phone.trim());

    if (!formattedPhone || formattedPhone === "+") {
      setError("Veuillez saisir votre numéro de téléphone.");
      setIsLoading(false);
      return;
    }

    if (!password.trim()) {
      setError("Veuillez saisir votre mot de passe.");
      setIsLoading(false);
      return;
    }

    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        phone: formattedPhone,
        password,
      });

      if (authError) {
        const translatedError = translateError(authError);
        setError(translatedError);
        return;
      }

      // Connexion réussie
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : "Une erreur inattendue est survenue.";
      setError(translateError({ message: errorMessage }));
    } finally {
      setIsLoading(false);
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const formatted = formatPhoneNumber(value);
    setPhone(formatted);
    setError(null);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-linear-to-br from-zinc-50 via-zinc-50 to-zinc-100 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950 p-4">
      <div className="w-full max-w-md space-y-6">
        <Card className="border-2 shadow-xl">
          <CardHeader className="space-y-3 text-center pb-6">
            <div className="flex justify-center">
              <div className="rounded-full bg-linear-to-br from-primary to-primary/80 p-2 shadow-lg overflow-hidden ring-2 ring-primary/20">
                <Image
                  src="/pmn.jpg"
                  alt="PMN Logo"
                  width={64}
                  height={64}
                  className="h-16 w-16 object-cover rounded-full"
                  priority
                />
              </div>
            </div>
            <div className="space-y-1">
              <CardTitle className="text-3xl font-bold tracking-tight">
                Plateforme de Messagerie
              </CardTitle>
              <CardDescription className="text-base">
                Connectez-vous à votre compte pour accéder à la messagerie
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-5">
              {error && (
                <div className="flex items-start gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive animate-in slide-in-from-top-2">
                  <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium">Erreur de connexion</p>
                    <p className="mt-1 text-destructive/90">{error}</p>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <label
                  htmlFor="phone"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Numéro de téléphone
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="778417782"
                    value={phone}
                    onChange={handlePhoneChange}
                    required
                    disabled={isLoading}
                    className="h-11 pl-10"
                    autoComplete="tel"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="password"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Mot de passe
                </label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setError(null);
                    }}
                    required
                    disabled={isLoading}
                    className="h-11 pr-10"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={isLoading}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-11 text-base font-semibold"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Connexion en cours...
                  </>
                ) : (
                  "Se connecter"
                )}
              </Button>
            </form>

            <div className="mt-6 text-center text-sm text-muted-foreground">
              <p>Vous n&apos;avez pas de compte ?</p>
              <p className="mt-1">
                Contactez votre administrateur pour obtenir un accès.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
