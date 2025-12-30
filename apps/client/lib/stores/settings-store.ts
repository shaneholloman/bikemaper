import { create } from 'zustand'

type SettingsState = {
  isOpen: boolean
  open: () => void
  close: () => void
  toggle: () => void
}

export const useSettingsStore = create<SettingsState>((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  toggle: () => set((state) => ({ isOpen: !state.isOpen })),
}))
