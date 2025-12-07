"use client"
import { getStations } from "@/app/server/trips"
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Fzf } from "fzf"
import { Bike } from "lucide-react"
import React from "react"

type Station = {
  id: string
  name: string
  latitude: number
  longitude: number
}

const MAX_RESULTS = 10

export function Search() {
  const [open, setOpen] = React.useState(false)
  const [stations, setStations] = React.useState<Station[]>([])
  const [search, setSearch] = React.useState("")

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((open) => !open)
      }
    }
    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [])

  React.useEffect(() => {
    getStations().then(setStations)
  }, [])

  const fzf = React.useMemo(
    () => new Fzf(stations, { selector: (s) => s.name }),
    [stations]
  )

  const filteredStations = React.useMemo(() => {
    const query = search.trim()
    if (!query) return stations.slice(0, MAX_RESULTS)
    return fzf.find(query).slice(0, MAX_RESULTS).map((result) => result.item)
  }, [stations, search, fzf])

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Type a station name..."
        value={search}
        onValueChange={setSearch}
      />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading={<span className="flex items-center gap-1.5">Citibike Stations</span>}>
          {filteredStations.map((station) => (
            <CommandItem
              key={station.id}
              value={station.name}
              onSelect={() => {
                console.log("Selected station:", station)
                setOpen(false)
              }}
            >
              <Bike className="size-4" />
              {station.name}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
