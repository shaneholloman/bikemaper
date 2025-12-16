import { DuckDBConnection } from "@duckdb/node-api";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import { point } from "@turf/helpers";
import fs from "fs";
import type { Feature, FeatureCollection, Polygon } from "geojson";
import path from "path";
import { csvGlob, dataDir, gitRoot } from "./utils";

// Derive station data from raw CSV files + geocode with neighborhood boundaries.
//
// Input:
// - data/2025/**/*.csv (raw Citi Bike trip CSVs)
// - data/d085e2f8d0b54d4590b1e7d1f35594c1pediacitiesnycneighborhoods.geojson
//
// Output:
// - apps/client/public/stations.json

type NeighborhoodProperties = {
  neighborhood: string;
  borough: string;
};

type NeighborhoodFeature = Feature<Polygon, NeighborhoodProperties>;

type StationRegion = {
  borough: string;
  neighborhood: string;
};

type StationForSearch = {
  name: string;
  ids: string[];
  latitude: number;
  longitude: number;
  borough: string;
  neighborhood: string;
};

// Get region for NJ stations (simple bounding box)
function getNJRegion(lat: number, lng: number): StationRegion | null {
  // West of Hudson River = NJ
  if (lng < -74.02) {
    if (lat > 40.735) {
      return { borough: "New Jersey", neighborhood: "Hoboken" };
    }
    return { borough: "New Jersey", neighborhood: "Jersey City" };
  }
  return null;
}

// Get region for NYC stations (point-in-polygon)
function getNYCRegion(
  lat: number,
  lng: number,
  neighborhoods: NeighborhoodFeature[]
): StationRegion | null {
  const stationPoint = point([lng, lat]);

  for (const feature of neighborhoods) {
    if (booleanPointInPolygon(stationPoint, feature.geometry)) {
      return {
        borough: feature.properties.borough,
        neighborhood: feature.properties.neighborhood,
      };
    }
  }
  return null;
}

// Get region for a station
function getStationRegion(
  lat: number,
  lng: number,
  neighborhoods: NeighborhoodFeature[]
): StationRegion {
  // Try NJ first (fast bounding box check)
  const njRegion = getNJRegion(lat, lng);
  if (njRegion) return njRegion;

  // Try NYC (point-in-polygon)
  const nycRegion = getNYCRegion(lat, lng, neighborhoods);
  if (nycRegion) return nycRegion;

  return { borough: "Unknown", neighborhood: "Unknown" };
}

// Haversine distance in meters
function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000; // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const WARN_COORD_VARIANCE_METERS = 200;

function checkStationCoordDeviation(
  stations: Array<{
    id: string;
    name: string;
    point_count: bigint;
    max_deviation_m: number;
  }>
): void {
  const tooFar = stations.filter((s) => s.max_deviation_m > WARN_COORD_VARIANCE_METERS);

  if (tooFar.length > 0) {
    console.warn(
      `\n⚠️  ${tooFar.length} station ID(s) have points > ${WARN_COORD_VARIANCE_METERS}m from median:\n` +
        tooFar.map((s) => `  - ${s.id} "${s.name}" (max ${s.max_deviation_m.toFixed(1)}m, ${s.point_count} points)`).join("\n")
    );
  }
}

async function main() {
  const clientPublicDir = path.join(gitRoot, "apps/client/public");
  const stationsPath = path.join(clientPublicDir, "stations.json");
  const geoJsonPath = path.join(
    dataDir,
    "d085e2f8d0b54d4590b1e7d1f35594c1pediacitiesnycneighborhoods.geojson"
  );

  console.log("Building stations.json from CSV files...");
  console.log(`CSV glob: ${csvGlob}`);
  console.log(`GeoJSON: ${geoJsonPath}`);
  console.log(`Output: ${stationsPath}`);

  // Load neighborhood boundaries for geocoding
  console.log("\nLoading neighborhood boundaries...");
  const geoData = JSON.parse(fs.readFileSync(geoJsonPath, "utf-8")) as FeatureCollection<
    Polygon,
    NeighborhoodProperties
  >;
  const neighborhoods = geoData.features as NeighborhoodFeature[];
  console.log(`Loaded ${neighborhoods.length} neighborhood polygons`);

  const connection = await DuckDBConnection.create();

  // Diagnostics: show station IDs where any point deviates significantly from the median.
  const stationDeviationReader = await connection.runAndReadAll(`
    WITH station_points AS (
      SELECT
        start_station_id AS id,
        start_station_name AS name,
        start_lat AS lat,
        start_lng AS lng
      FROM read_csv_auto('${csvGlob}')
      UNION ALL
      SELECT
        end_station_id AS id,
        end_station_name AS name,
        end_lat AS lat,
        end_lng AS lng
      FROM read_csv_auto('${csvGlob}')
    ),
    station_median AS (
      SELECT
        id,
        MEDIAN(lat) AS median_lat,
        MEDIAN(lng) AS median_lng,
        COUNT(*) AS point_count
      FROM station_points
      WHERE id IS NOT NULL AND lat IS NOT NULL AND lng IS NOT NULL
      GROUP BY id
    ),
    station_name AS (
      -- Pick the most frequently observed name for each station id
      SELECT id, name
      FROM (
        SELECT
          id,
          name,
          COUNT(*) AS cnt,
          ROW_NUMBER() OVER (PARTITION BY id ORDER BY COUNT(*) DESC, name) AS rn
        FROM station_points
        WHERE id IS NOT NULL AND name IS NOT NULL
        GROUP BY id, name
      )
      WHERE rn = 1
    ),
    point_deviations AS (
      SELECT
        sp.id,
        sm.point_count,
        -- Haversine approximation for small distances
        6371000 * SQRT(
          POWER(RADIANS(sp.lat - sm.median_lat), 2) +
          POWER(COS(RADIANS(sm.median_lat)) * RADIANS(sp.lng - sm.median_lng), 2)
        ) AS distance_m
      FROM station_points sp
      JOIN station_median sm ON sp.id = sm.id
      WHERE sp.id IS NOT NULL AND sp.lat IS NOT NULL AND sp.lng IS NOT NULL
    )
    SELECT
      pd.id,
      COALESCE(sn.name, '') AS name,
      MAX(pd.point_count) AS point_count,
      MAX(pd.distance_m) AS max_deviation_m
    FROM point_deviations pd
    LEFT JOIN station_name sn ON pd.id = sn.id
    GROUP BY pd.id, sn.name
    HAVING MAX(pd.distance_m) > ${WARN_COORD_VARIANCE_METERS}
    ORDER BY MAX(pd.distance_m) DESC
    LIMIT 20
  `);

  checkStationCoordDeviation(
    stationDeviationReader.getRowObjectsJson() as unknown as Array<{
      id: string;
      name: string;
      point_count: bigint;
      max_deviation_m: number;
    }>
  );

  const stationsReader = await connection.runAndReadAll(`
    WITH station_points AS (
      SELECT
        start_station_id AS id,
        start_station_name AS name,
        start_lat AS lat,
        start_lng AS lng
      FROM read_csv_auto('${csvGlob}')
      UNION ALL
      SELECT
        end_station_id AS id,
        end_station_name AS name,
        end_lat AS lat,
        end_lng AS lng
      FROM read_csv_auto('${csvGlob}')
    ),
    -- Median coordinates for each station name
    station_coords AS (
      SELECT
        name,
        MEDIAN(lat) AS latitude,
        MEDIAN(lng) AS longitude
      FROM station_points
      WHERE name IS NOT NULL AND lat IS NOT NULL AND lng IS NOT NULL
      GROUP BY name
    ),
    -- Collect all IDs for each station name
    station_ids AS (
      SELECT
        name,
        STRING_AGG(DISTINCT id, ',') AS ids_csv
      FROM station_points
      WHERE name IS NOT NULL AND id IS NOT NULL
      GROUP BY name
    )
    SELECT
      sc.name,
      si.ids_csv,
      sc.latitude,
      sc.longitude
    FROM station_coords sc
    JOIN station_ids si ON sc.name = si.name
    ORDER BY sc.name
  `);

  const rows = stationsReader.getRowObjectsJson() as unknown as Array<{
    name: string;
    ids_csv: string;
    latitude: number;
    longitude: number;
  }>;

  // Geocode each station
  console.log("\nGeocoding stations...");
  let matched = 0;
  let unmatched = 0;

  const stations: StationForSearch[] = rows.map((r) => {
    const region = getStationRegion(r.latitude, r.longitude, neighborhoods);
    if (region.borough === "Unknown") {
      unmatched++;
      console.warn(`  ⚠ Unmatched: ${r.name} (${r.latitude.toFixed(6)}, ${r.longitude.toFixed(6)})`);
    } else {
      matched++;
    }
    return {
      name: r.name,
      ids: r.ids_csv.split(",").filter(Boolean),
      latitude: r.latitude,
      longitude: r.longitude,
      borough: region.borough,
      neighborhood: region.neighborhood,
    };
  });

  console.log(`Geocoded: ${matched} matched, ${unmatched} unmatched`);

  fs.writeFileSync(stationsPath, JSON.stringify(stations, null, 2));
  console.log(`\nWrote ${stations.length} stations to ${stationsPath}`);

  connection.closeSync();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
