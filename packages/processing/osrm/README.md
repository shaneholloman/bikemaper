# NYC Bike Routing with OSRM

Bike-only routing for New York City using OSRM, with ferries excluded.

## Prerequisites

- Docker
- wget

## Quick Start

```bash
cd packages/processing/osrm

# 1. Download NYC OSM data (~142MB)
wget https://download.bbbike.org/osm/bbbike/NewYork/NewYork.osm.pbf

# 2. Build routing graph (one-time, ~2-3 min)
docker run -t -v "${PWD}:/data" ghcr.io/project-osrm/osrm-backend \
  osrm-extract -p /data/bicycle-no-ferry.lua /data/NewYork.osm.pbf

docker run -t -v "${PWD}:/data" ghcr.io/project-osrm/osrm-backend \
  osrm-partition /data/NewYork.osrm

docker run -t -v "${PWD}:/data" ghcr.io/project-osrm/osrm-backend \
  osrm-customize /data/NewYork.osrm

# 3. Start server (runs on localhost:5000)
docker run -t -i -p 5000:5000 -v "${PWD}:/data" ghcr.io/project-osrm/osrm-backend \
  osrm-routed --algorithm mld /data/NewYork.osrm
```

Steps 1-2 only need to run once. After that, just run step 3 to start the server.

> **Performance:** OSRM defaults to 8 threads. For high-concurrency batch jobs (like `build-routes.ts` with 50 concurrent requests), increase with `--threads N` where N ≤ number of CPU cores. Requests exceeding thread count queue automatically.
>
> ```bash
> # Example: 12-core machine
> docker run -t -i -p 5000:5000 -v "${PWD}:/data" ghcr.io/project-osrm/osrm-backend \
>   osrm-routed --algorithm mld --threads 12 /data/NewYork.osrm
> ```

## Usage

The API runs on `http://localhost:5000`.

### Route Request

```
GET /route/v1/bike/{lon1},{lat1};{lon2},{lat2}
```

### Example

Brooklyn to Central Park:

```bash
curl "http://127.0.0.1:5000/route/v1/bike/-73.9857,40.6892;-73.9712,40.7831?overview=full"
```

### Query Parameters

| Parameter | Description |
|-----------|-------------|
| `overview` | `full`, `simplified`, or `false` - geometry detail level |
| `steps` | `true` or `false` - include turn-by-turn instructions |
| `geometries` | `polyline`, `polyline6`, or `geojson` - geometry format |
| `alternatives` | `true` or `false` - return alternative routes |

## Custom Profile

`bicycle-no-ferry.lua` is a modified OSRM bicycle profile with ferry routes disabled. This ensures all routes use bridges/tunnels only.