/**
 * Validates routes.parquet output from build-routes-parquet.ts
 *
 * Checks:
 * - Basic stats (count, file size)
 * - Data structure integrity (matching array lengths)
 * - Data quality (coordinates in bounds, timeFractions 0-1, bearings valid)
 * - No duplicate station pairs
 */
import { DuckDBConnection } from "@duckdb/node-api";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { formatHumanReadableBytes } from "../../apps/client/lib/utils";

const gitRoot = execSync("git rev-parse --show-toplevel", { encoding: "utf-8" }).trim();
const parquetPath = path.join(gitRoot, "packages/processing/output/routes.parquet");

// NYC bounding box (same as build-parquet.ts)
const NYC_BOUNDS = {
  minLat: 40.3,
  maxLat: 41.2,
  minLng: -74.5,
  maxLng: -73.5,
};

type CheckResult = {
  name: string;
  passed: boolean;
  message: string;
};

const results: CheckResult[] = [];

function check(name: string, passed: boolean, message: string): void {
  results.push({ name, passed, message });
  const icon = passed ? "✅" : "❌";
  console.log(`${icon} ${name}: ${message}`);
}

async function main() {
  console.log("=== Routes Parquet Validation ===\n");

  // Check file exists
  if (!fs.existsSync(parquetPath)) {
    console.error(`❌ File not found: ${parquetPath}`);
    process.exit(1);
  }

  const fileStats = fs.statSync(parquetPath);
  console.log(`File: ${parquetPath}`);
  console.log(`Size: ${formatHumanReadableBytes(fileStats.size)}\n`);

  const db = await DuckDBConnection.create();

  // === Basic Stats ===
  console.log("--- Basic Stats ---");
  const countResult = await db.runAndReadAll(
    `SELECT COUNT(*) as count FROM '${parquetPath}'`
  );
  const totalCount = Number((countResult.getRowObjects()[0] as { count: bigint }).count);
  console.log(`Total routes: ${totalCount.toLocaleString()}\n`);

  // === Sample Data ===
  console.log("--- Sample Routes ---");
  const sampleResult = await db.runAndReadAll(`
    SELECT
      startStationId,
      endStationId,
      ROUND(distance, 1) as distance_m,
      json_array_length(path) as path_points
    FROM '${parquetPath}'
    LIMIT 5
  `);
  console.table(sampleResult.getRowObjects());

  // === Single Route Detail ===
  console.log("\n--- Sample Route Detail ---");
  const detailResult = await db.runAndReadAll(`
    SELECT
      startStationId,
      endStationId,
      distance,
      path::VARCHAR as path,
      timeFractions::VARCHAR as timeFractions,
      bearings::VARCHAR as bearings
    FROM '${parquetPath}'
    WHERE distance > 500 AND distance < 1000
    LIMIT 1
  `);
  const detail = detailResult.getRowObjects()[0] as {
    startStationId: string;
    endStationId: string;
    distance: number;
    path: string;
    timeFractions: string;
    bearings: string;
  };
  const pathArr = JSON.parse(detail.path) as [number, number][];
  const timeFractionsArr = JSON.parse(detail.timeFractions) as number[];
  const bearingsArr = JSON.parse(detail.bearings) as number[];

  console.log(`  Route: ${detail.startStationId} → ${detail.endStationId}`);
  console.log(`  Distance: ${detail.distance.toFixed(1)}m`);
  console.log(`  Path points: ${pathArr.length}`);
  console.log(`  First 3 coords: ${JSON.stringify(pathArr.slice(0, 3))}`);
  console.log(`  First 3 timeFractions: ${JSON.stringify(timeFractionsArr.slice(0, 3))}`);
  console.log(`  First 3 bearings: ${JSON.stringify(bearingsArr.slice(0, 3))}`);

  // === Integrity Checks ===
  console.log("\n--- Integrity Checks ---");

  const integrityResult = await db.runAndReadAll(`
    SELECT
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE distance > 0) as has_distance,
      COUNT(*) FILTER (WHERE json_array_length(path) > 1) as has_path,
      COUNT(*) FILTER (WHERE
        json_array_length(path) = json_array_length(timeFractions)
        AND json_array_length(path) = json_array_length(bearings)
      ) as arrays_match,
      ROUND(AVG(json_array_length(path)), 1) as avg_path_points,
      ROUND(AVG(distance), 1) as avg_distance_m
    FROM '${parquetPath}'
  `);
  const integrity = integrityResult.getRowObjects()[0] as {
    total: bigint;
    has_distance: bigint;
    has_path: bigint;
    arrays_match: bigint;
    avg_path_points: number;
    avg_distance_m: number;
  };

  const total = Number(integrity.total);
  const hasDistance = Number(integrity.has_distance);
  const hasPath = Number(integrity.has_path);
  const arraysMatch = Number(integrity.arrays_match);

  check(
    "Has distance",
    hasDistance === total,
    `${hasDistance.toLocaleString()}/${total.toLocaleString()} (${((hasDistance / total) * 100).toFixed(2)}%)`
  );

  check(
    "Has path (>1 point)",
    hasPath === total,
    `${hasPath.toLocaleString()}/${total.toLocaleString()} (${((hasPath / total) * 100).toFixed(2)}%)`
  );

  check(
    "Arrays match length",
    arraysMatch === total,
    `${arraysMatch.toLocaleString()}/${total.toLocaleString()}`
  );

  console.log(`  Avg path points: ${integrity.avg_path_points}`);
  console.log(`  Avg distance: ${integrity.avg_distance_m}m`);

  // === Data Quality Checks ===
  console.log("\n--- Data Quality Checks ---");

  // TimeFractions check (should start at 0, end near 1)
  const timeFractionsCheck = await db.runAndReadAll(`
    SELECT
      COUNT(*) FILTER (WHERE
        CAST(json_extract(timeFractions, '$[0]') AS DOUBLE) = 0
      ) as starts_at_zero,
      COUNT(*) FILTER (WHERE
        CAST(json_extract(timeFractions, '$[#-1]') AS DOUBLE) BETWEEN 0.99 AND 1.01
      ) as ends_near_one
    FROM '${parquetPath}'
  `);
  const tf = timeFractionsCheck.getRowObjects()[0] as {
    starts_at_zero: bigint;
    ends_near_one: bigint;
  };

  check(
    "TimeFractions start at 0",
    Number(tf.starts_at_zero) === total,
    `${Number(tf.starts_at_zero).toLocaleString()}/${total.toLocaleString()}`
  );

  check(
    "TimeFractions end near 1",
    Number(tf.ends_near_one) === total,
    `${Number(tf.ends_near_one).toLocaleString()}/${total.toLocaleString()}`
  );

  // Coordinates in NYC bounds (spot check first coord of each path)
  const coordsCheck = await db.runAndReadAll(`
    SELECT COUNT(*) as in_bounds
    FROM '${parquetPath}'
    WHERE
      CAST(json_extract(path, '$[0][0]') AS DOUBLE) BETWEEN ${NYC_BOUNDS.minLng} AND ${NYC_BOUNDS.maxLng}
      AND CAST(json_extract(path, '$[0][1]') AS DOUBLE) BETWEEN ${NYC_BOUNDS.minLat} AND ${NYC_BOUNDS.maxLat}
  `);
  const inBounds = Number((coordsCheck.getRowObjects()[0] as { in_bounds: bigint }).in_bounds);

  check(
    "First coord in NYC bounds",
    inBounds === total,
    `${inBounds.toLocaleString()}/${total.toLocaleString()}`
  );

  // Duplicate station pairs check
  const duplicatesCheck = await db.runAndReadAll(`
    SELECT COUNT(*) as duplicate_pairs
    FROM (
      SELECT startStationId, endStationId
      FROM '${parquetPath}'
      GROUP BY startStationId, endStationId
      HAVING COUNT(*) > 1
    )
  `);
  const duplicates = Number(
    (duplicatesCheck.getRowObjects()[0] as { duplicate_pairs: bigint }).duplicate_pairs
  );

  check("No duplicate station pairs", duplicates === 0, `${duplicates} duplicates found`);

  // === Summary ===
  console.log("\n--- Summary ---");
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  if (failed === 0) {
    console.log(`\n✅ All ${passed} checks passed!`);
  } else {
    console.log(`\n⚠️  ${passed} passed, ${failed} failed`);
    console.log("\nFailed checks:");
    for (const r of results.filter((r) => !r.passed)) {
      console.log(`  ❌ ${r.name}: ${r.message}`);
    }
  }

  db.closeSync();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
