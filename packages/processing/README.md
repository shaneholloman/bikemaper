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
bun run build-parquet.ts <year>
# Example: bun run build-parquet.ts 2025
```

## Outputs

| File | Description |
|------|-------------|
| `output/routes.db` | SQLite cache of routes (start/end station → path, distance) |
| `output/trips/<year>-<month>.parquet` | Monthly trip data with embedded route geometry |
| `apps/client/public/stations.json` | Station search index with borough/neighborhood |

## Legacy Schema Support

The pipeline automatically detects and handles two CSV schemas:

| Schema | Years | Detection |
|--------|-------|-----------|
| Legacy | 2013, 2018 | Has `tripduration` column |
| Modern | 2020+ | Has `ride_id` column |

**Legacy schema transformations:**
- `bikeid + starttime` → `ride_id` (MD5 hash)
- `'classic_bike'` → `rideable_type` (no e-bikes existed)
- `usertype` → `member_casual` (Subscriber→member, Customer→casual)
- Column names normalized (spaces → underscores)

**Route matching for legacy data:**
Legacy station IDs don't match current routes.db. The pipeline matches by station name:
1. Legacy trip's `start station name` → lookup in stations.json → 2025 station ID
2. Join to routes.db using the translated ID
3. Defunct stations (not in stations.json) get NULL routes

## Parquet Schema

Output columns:
- `id` - Trip ID
- `startStationId`, `endStationId` - Station IDs
- `startedAt`, `endedAt` - Timestamps
- `bikeType` - classic_bike or electric_bike
- `memberCasual` - member or casual
- `startLat`, `startLng`, `endLat`, `endLng` - Coordinates
- `routeGeometry` - Polyline6-encoded route (endpoints adjusted to trip coords)
- `routeDistance` - Route distance in meters

## Prerequisites

- CSV files in `data/<year>/**/*.csv`
- OSRM server running for route building: `osrm-routed /path/to/NewYork.osrm`
- NYC neighborhood GeoJSON in `data/` for station geocoding
- `stations.json` (from build-stations.ts) for legacy route matching
