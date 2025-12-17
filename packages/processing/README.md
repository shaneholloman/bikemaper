# Processing Pipeline

Converts raw Citi Bike CSV data into optimized formats for the visualization client.

## Data Flow

```
CSV files (all years) → build-stations.ts → stations.json
CSV files (all years) → build-routes.ts   → routes.db
CSV files (per year)  → build-parquet.ts  → parquet files
```

## Scripts

Run in order:

```bash
# 1. Build unified station list with aliases (from ALL years)
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
| `apps/client/public/stations.json` | Station index with aliases, coordinates, borough/neighborhood |
| `output/routes.db` | SQLite cache of routes keyed by station NAME |
| `output/trips/<year>-<month>.parquet` | Monthly trip data with embedded route geometry |

## How It Works

### Station Names as Universal Key

Routes are keyed by **station name** (not ID) because:
- Station IDs changed between years (e.g., `72` in 2018 → `6926.01` in 2025)
- Station names are unique
  
### Station Aliases

Station names changed over time (e.g., "8 Ave & W 31 St" → "W 31 St & 8 Ave"). The pipeline handles this via:

1. **`stations.json`** stores canonical name + historical aliases
2. **`build-routes.ts`** normalizes CSV names → canonical before creating route keys
3. **`build-parquet.ts`** normalizes CSV names → canonical before joining with routes

### Legacy vs Modern Schema

| Schema | Years | Detection | Route Matching |
|--------|-------|-----------|----------------|
| Legacy | 2013-2019 | Has `tripduration` column | Coordinate snap → nearest station name |
| Modern | 2020+ | Has `ride_id` column | CSV name → canonical name via alias lookup |

**Legacy coordinate matching:** Trip coordinates are matched to the nearest current station within 200m, giving ~98% route coverage despite old station names/IDs.

## Parquet Schema

| Column | Type | Description |
|--------|------|-------------|
| `id` | string | Trip ID |
| `startStationName` | string | Canonical station name |
| `endStationName` | string | Canonical station name |
| `startedAt` | timestamp | Trip start (UTC) |
| `endedAt` | timestamp | Trip end (UTC) |
| `bikeType` | string | `classic_bike` or `electric_bike` |
| `memberCasual` | string | `member` or `casual` |
| `startLat/Lng` | float | Start coordinates |
| `endLat/Lng` | float | End coordinates |
| `routeGeometry` | string | Polyline6-encoded route |
| `routeDistance` | float | Route distance in meters |

## Prerequisites

- CSV files in `data/<year>/**/*.csv`
- OSRM server running on `localhost:5000`
- NYC neighborhood GeoJSON in `data/` for station geocoding

## Route Coverage

| Year | Coverage | Notes |
|------|----------|-------|
| 2013-2019 | ~98% | Coordinate-based matching |
| 2020+ | ~98% | Name-based matching with alias normalization |

The ~2% without routes are almost entirely round trips (same start/end station).
