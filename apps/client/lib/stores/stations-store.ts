import { create } from "zustand"

export type Station = {
  ids: string[]
  name: string
  latitude: number
  longitude: number
  borough: string
  neighborhood: string
}

type StationsState = {
  stations: Station[]
  stationMap: Map<string, Station> // id -> station for O(1) lookup
  isLoading: boolean
  load: () => Promise<void>
  getStation: (id: string) => Station
}

export const useStationsStore = create<StationsState>((set, get) => ({
  stations: [],
  stationMap: new Map(),
  isLoading: false,
  load: async () => {
    if (get().stations.length > 0 || get().isLoading) return
    set({ isLoading: true })
    const stations: Station[] = await fetch("/stations.json").then((r) => r.json())
    const stationMap = new Map<string, Station>()
    for (const station of stations) {
      for (const id of station.ids) {
        stationMap.set(id, station)
      }
    }
    set({ stations, stationMap, isLoading: false })
  },
  getStation: (id: string) => {
    const station = get().stationMap.get(id)
    if (!station) {
      throw new Error(`Station not found: ${id}`)
    }
    return station
  },
}))
