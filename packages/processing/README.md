# Processing Pipeline

Converts raw Citi Bike CSV data into optimized formats for the visualization client.

## Scripts

Run in order:

```bash
# 1. Derive station metadata with geocoding
bun run build-stations.ts

# 2. Build route cache from OSRM (requires OSRM server on localhost:5000)
bun run build-routes.ts

# 3. Build trips parquet with embedded route geometries
bun run build-parquet.ts
```

## Outputs

| File | Description |
|------|-------------|
| `output/routes.db` | SQLite cache of routes (start/end station → path, distance) |
| `output/trips/2025.parquet` | Trip data with embedded route geometry (polyline6) |
| `apps/client/public/stations.json` | Station search index with borough/neighborhood |

## Parquet Schema

`2025.parquet` columns:
- `id` - Trip ID
- `startStationId`, `endStationId` - Station IDs
- `startedAt`, `endedAt` - Timestamps
- `bikeType` - classic_bike or electric_bike
- `memberCasual` - member or casual
- `startLat`, `startLng`, `endLat`, `endLng` - Coordinates
- `routeGeometry` - Polyline6-encoded route (endpoints adjusted to trip coords)
- `routeDistance` - Route distance in meters

## Prerequisites

- CSV files in `data/2025/**/*.csv`
- OSRM server running for route building: `osrm-routed /path/to/NewYork.osrm`
- NYC neighborhood GeoJSON in `data/` for station geocoding
