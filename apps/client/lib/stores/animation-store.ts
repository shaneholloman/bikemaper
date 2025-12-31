import { create } from "zustand";
import { DEFAULT_ANIMATION_START_DATE, DEFAULT_SPEEDUP } from "../config";
import { usePickerStore } from "./location-picker-store";

export type SelectedTripInfo = {
  id: string;
  bikeType: string;
  memberCasual: string;
  startStationName: string;
  endStationName: string;
  startNeighborhood: string | null;
  endNeighborhood: string | null;
  startedAt: Date;
  endedAt: Date;
  routeDistance: number | null;
};

type AnimationStore = {
  // Source config only
  speedup: number
  animationStartDate: Date

  // Playback
  isPlaying: boolean
  currentTime: number // simulation seconds from windowStart
  pendingAutoPlay: boolean // flag to auto-play after trips load

  // Loading state
  isLoadingTrips: boolean

  // Trip selection (shared between Search and BikeMap)
  selectedTripId: string | null
  selectedTripInfo: SelectedTripInfo | null

  // Actions
  setSpeedup: (value: number) => void
  setAnimationStartDate: (date: Date) => void
  setAnimationStartDateAndPlay: (date: Date) => void
  clearPendingAutoPlay: () => void
  play: () => void
  pause: () => void
  setCurrentTime: (time: number) => void
  advanceTime: (delta: number) => void
  resetPlayback: () => void
  selectTrip: (data: { id: string; info?: SelectedTripInfo | null } | null) => void
  setIsLoadingTrips: (loading: boolean) => void
}

export const useAnimationStore = create<AnimationStore>((set) => ({
  // Config
  speedup: DEFAULT_SPEEDUP,
  animationStartDate: DEFAULT_ANIMATION_START_DATE,

  // Playback
  isPlaying: false,
  currentTime: 0,
  pendingAutoPlay: true, // Auto-play on initial page load

  // Loading state
  isLoadingTrips: false,

  // Trip selection
  selectedTripId: null,
  selectedTripInfo: null,

  // Config actions (reset playback when config changes)
  setSpeedup: (speedup) => set({ speedup, isPlaying: false, currentTime: 0 }),
  setAnimationStartDate: (animationStartDate) => set({ animationStartDate, isPlaying: false, currentTime: 0 }),
  setAnimationStartDateAndPlay: (animationStartDate) => set({ animationStartDate, isPlaying: false, currentTime: 0, pendingAutoPlay: true }),
  clearPendingAutoPlay: () => set({ pendingAutoPlay: false }),

  // Playback actions
  play: () => set({ isPlaying: true }),
  pause: () => set({ isPlaying: false }),
  setCurrentTime: (currentTime) => set({ currentTime }),
  advanceTime: (delta) => set((state) => ({ currentTime: state.currentTime + delta })),
  resetPlayback: () => set({ isPlaying: false, currentTime: 0 }),

  // Trip selection
  selectTrip: (data) => {
    // Clear picked location when selecting a bike
    if (data) {
      usePickerStore.getState().clearPicking();
    }
    set({
      selectedTripId: data?.id ?? null,
      selectedTripInfo: data?.info ?? null,
    });
  },

  // Loading state
  setIsLoadingTrips: (isLoadingTrips) => set({ isLoadingTrips }),
}))
