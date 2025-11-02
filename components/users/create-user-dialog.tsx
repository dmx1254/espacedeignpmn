'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Phone } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { AlertCircle } from 'lucide-react'

interface CreateUserDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

// Fonction pour formater le numéro de téléphone (Sénégal +221)
const formatPhoneNumber = (value: string): string => {
  let cleaned = value.replace(/[^\d+]/g, '')
  
  // Si ça ne commence pas par +, ajouter le +221 (Sénégal)
  if (cleaned && !cleaned.startsWith('+')) {
    // Si ça commence par 0, remplacer par +221
    if (cleaned.startsWith('0')) {
      cleaned = '+221' + cleaned.substring(1)
    } else {
      // Sinon, ajouter +221 au début
      cleaned = '+221' + cleaned
    }
  } else if (cleaned.startsWith('+') && !cleaned.startsWith('+221')) {
    // Si ça commence par + mais pas +221, on peut ajouter +221 si besoin
    if (cleaned.length <= 3) {
      // Format trop court, on ajoute +221
      cleaned = '+221' + cleaned.substring(1)
    }
  }
  
  return cleaned
}

export function CreateUserDialog({ open, onOpenChange, onSuccess }: CreateUserDialogProps) {
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [business, setBusiness] = useState('')
  const [role, setRole] = useState<'ADMIN' | 'USER'>('USER')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const formattedPhone = formatPhoneNumber(phone.trim())
      
      if (!formattedPhone || formattedPhone === '+') {
        setError('Veuillez saisir un numéro de téléphone valide.')
        setLoading(false)
        return
      }

      const response = await fetch('/api/users/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone: formattedPhone,
          password,
          fullName,
          business: business.trim() || null,
          role,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erreur lors de la création de l\'utilisateur')
      }

      onSuccess()
      onOpenChange(false)
      setPhone('')
      setPassword('')
      setFullName('')
      setBusiness('')
      setRole('USER')
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Une erreur est survenue')
    } finally {
      setLoading(false)
    }
  }

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    const formatted = formatPhoneNumber(value)
    setPhone(formatted)
    setError(null)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajouter un utilisateur</DialogTitle>
          <DialogDescription>
            Créez un nouveau compte utilisateur sur la plateforme.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="flex items-start gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
              <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium">Erreur</p>
                <p className="mt-1 text-destructive/90">{error}</p>
              </div>
            </div>
          )}
          <div className="space-y-2">
            <label htmlFor="fullName" className="text-sm font-medium">
              Nom complet
            </label>
            <Input
              id="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="phone" className="text-sm font-medium">
              Numéro de téléphone
            </label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                id="phone"
                type="tel"
                placeholder="+33612345678"
                value={phone}
                onChange={handlePhoneChange}
                required
                className="pl-10"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Format Sénégal : +221778417586 (le +221 sera ajouté automatiquement)
            </p>
          </div>
          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium">
              Mot de passe
            </label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="business" className="text-sm font-medium">
              Nom d&apos;entreprise <span className="text-muted-foreground">(optionnel)</span>
            </label>
            <Input
              id="business"
              value={business}
              onChange={(e) => setBusiness(e.target.value)}
              placeholder="Nom de l'entreprise"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="role" className="text-sm font-medium">
              Rôle
            </label>
            <Select value={role} onValueChange={(value) => setRole(value as 'ADMIN' | 'USER')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="USER">Utilisateur</SelectItem>
                <SelectItem value="ADMIN">Administrateur</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Création...' : 'Créer'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}