# Processing Pipeline

Converts raw Citi Bike CSV data into optimized formats for the visualization client.

## Scripts

Run in order:

```bash
# 1. CSV → Parquet (trips)
bun run build-parquet.ts

# 2. Derive station metadata with geocoding
bun run build-stations.ts

# 3. Pre-compute route geometries (requires OSRM server on localhost:5000)
bun run build-routes-parquet.ts

# 4. Validate routes output
bun run check-routes-parquet.ts
```

## Outputs

| File | Description |
|------|-------------|
| `output/trips/2025.parquet` | Trip data (id, stations, timestamps, coords) |
| `output/routes.parquet` | Route geometries with animation data (path, timeFractions, bearings) |
| `output/routes-checkpoint.duckdb` | Checkpoint for resumable route building |
| `apps/client/public/stations.json` | Station search index with borough/neighborhood |

## Prerequisites

- CSV files in `data/2025/**/*.csv`
- OSRM server running for route building: `osrm-routed /path/to/NewYork.osrm`
- NYC neighborhood GeoJSON in `data/` for station geocoding
