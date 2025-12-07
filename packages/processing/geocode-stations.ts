import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import { point } from "@turf/helpers";
import { wktToGeoJSON } from "betterknown";
import { Database } from "bun:sqlite";
import { parse } from "csv-parse/sync";
import type { MultiPolygon, Polygon } from "geojson";
import path from "path";

type StationRegion = {
  region: string;
  neighborhood: string;
};

type NTARecord = {
  BoroName: string;
  NTAName: string;
  the_geom: string;
};

type Station = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
};

// Parse NTA CSV and build lookup structure
function loadNTAs(csvPath: string): Array<NTARecord & { geometry: Polygon | MultiPolygon }> {
  const fileContent = Bun.file(csvPath).text();
  const records = parse(fileContent, { columns: true }) as NTARecord[];

  return records.map((record) => {
    const geometry = wktToGeoJSON(record.the_geom) as Polygon | MultiPolygon;
    return {
      ...record,
      geometry,
    };
  });
}

// Get region for NJ stations (simple bounding box)
function getNJRegion(data: { lat: number; lng: number }): StationRegion | null {
  const { lat, lng } = data;

  // West of Hudson River = NJ
  if (lng < -74.02) {
    if (lat > 40.735) {
      return { region: "Hoboken", neighborhood: "Hoboken" };
    }
    return { region: "Jersey City", neighborhood: "Jersey City" };
  }

  return null;
}

// Get region for NYC stations (point-in-polygon)
function getNYCRegion(data: {
  lat: number;
  lng: number;
  ntas: Array<NTARecord & { geometry: Polygon | MultiPolygon }>;
}): StationRegion | null {
  const { lat, lng, ntas } = data;
  const stationPoint = point([lng, lat]);

  for (const nta of ntas) {
    if (booleanPointInPolygon(stationPoint, nta.geometry)) {
      return {
        region: nta.BoroName,
        neighborhood: nta.NTAName,
      };
    }
  }

  return null;
}

// Get region for a station
function getStationRegion(data: {
  lat: number;
  lng: number;
  ntas: Array<NTARecord & { geometry: Polygon | MultiPolygon }>;
}): StationRegion {
  // Try NJ first (fast bounding box check)
  const njRegion = getNJRegion({ lat: data.lat, lng: data.lng });
  if (njRegion) return njRegion;

  // Try NYC (point-in-polygon)
  const nycRegion = getNYCRegion(data);
  if (nycRegion) return nycRegion;

  // Fallback
  return { region: "Unknown", neighborhood: "Unknown" };
}

async function main() {
  const dataDir = path.join(process.cwd(), "../../data");
  const ntaCsvPath = path.join(dataDir, "2020_Neighborhood_Tabulation_Areas_(NTAs)_20251207.csv");
  const outputPath = path.join(dataDir, "station-regions.json");
  const dbPath = path.join(import.meta.dir, "../db/mydb.db");

  console.log("Loading NTA boundaries...");
  const ntaContent = await Bun.file(ntaCsvPath).text();
  const ntaRecords = parse(ntaContent, { columns: true }) as NTARecord[];

  console.log(`Parsing ${ntaRecords.length} NTA polygons...`);
  const ntas = ntaRecords.map((record) => {
    const geometry = wktToGeoJSON(record.the_geom) as Polygon | MultiPolygon;
    return { ...record, geometry };
  });

  console.log("Loading stations from database...");
  const db = new Database(dbPath, { readonly: true });
  const stations = db.query("SELECT id, name, latitude, longitude FROM Station").all() as Station[];
  console.log(`Found ${stations.length} stations`);

  console.log("Geocoding stations...");
  const results: Record<string, StationRegion> = {};
  let matched = 0;
  let unmatched = 0;

  for (const station of stations) {
    const region = getStationRegion({
      lat: station.latitude,
      lng: station.longitude,
      ntas,
    });

    results[station.id] = region;

    if (region.region === "Unknown") {
      unmatched++;
      console.log(`  ⚠ Unmatched: ${station.name} (${station.latitude}, ${station.longitude})`);
    } else {
      matched++;
    }
  }

  console.log(`\nResults: ${matched} matched, ${unmatched} unmatched`);

  // Write output
  await Bun.write(outputPath, JSON.stringify(results, null, 2));
  console.log(`\nWritten to ${outputPath}`);

  db.close();
}

main();
