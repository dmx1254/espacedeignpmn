'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Users } from 'lucide-react'
import { CreateGroupDialog } from './create-group-dialog'

export function CreateGroupButton() {
  const [dialogOpen, setDialogOpen] = useState(false)

  const handleSuccess = () => {
    window.location.href = '/group'
  }

  return (
    <>
      <div className="flex h-full w-full items-center justify-center p-6">
        <div className="max-w-md w-full space-y-6 text-center">
          <div className="flex justify-center mb-4">
            <div className="rounded-full bg-primary/10 p-4">
              <Users className="h-12 w-12 text-primary" />
            </div>
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold">Groupe Commun</h2>
            <p className="text-muted-foreground">
              Le groupe commun n&apos;a pas encore été créé. Cliquez sur le bouton ci-dessous pour le créer et y ajouter tous les utilisateurs.
            </p>
          </div>
          <Button
            onClick={() => setDialogOpen(true)}
            size="lg"
            className="gap-2"
          >
            <Users className="h-5 w-5" />
            Créer le Groupe Commun
          </Button>
        </div>
      </div>
      <CreateGroupDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={handleSuccess}
      />
    </>
  )
}
