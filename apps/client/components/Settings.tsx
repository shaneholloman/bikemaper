"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useSettingsStore } from "@/lib/stores/settings-store"
import React from "react"

export function Settings() {
  const { isOpen, close } = useSettingsStore()

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && close()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>
        <div className="text-sm text-muted-foreground">
          Settings coming soon.
        </div>
      </DialogContent>
    </Dialog>
  )
}
