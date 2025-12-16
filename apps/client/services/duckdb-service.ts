import type { TripWithRoute } from "@/lib/trip-types";
import * as duckdb from "@duckdb/duckdb-wasm";

// Use subdomain-style URL for CORS support
const TRIPS_URL = "https://bikemap.storage.googleapis.com/2025.parquet";
const ROUTES_URL = "https://bikemap.storage.googleapis.com/routes.parquet";

/**
 * DuckDB WASM service for querying Parquet files from GCS.
 * Uses an internal worker for non-blocking queries.
 */
class DuckDBService {
  private db: duckdb.AsyncDuckDB | null = null;
  private conn: duckdb.AsyncDuckDBConnection | null = null;
  private initPromise: Promise<void> | null = null;

  async init(): Promise<void> {
    if (this.initPromise) return this.initPromise;

    this.initPromise = this._initialize();
    return this.initPromise;
  }

  private async _initialize(): Promise<void> {
    console.log("[DuckDB] Initializing...");
    const startTime = Date.now();

    // Use jsdelivr CDN bundles
    const JSDELIVR_BUNDLES = duckdb.getJsDelivrBundles();
    const bundle = await duckdb.selectBundle(JSDELIVR_BUNDLES);

    const workerUrl = URL.createObjectURL(
      new Blob([`importScripts("${bundle.mainWorker}");`], {
        type: "text/javascript",
      })
    );

    const worker = new Worker(workerUrl);
    const logger = new duckdb.ConsoleLogger();
    this.db = new duckdb.AsyncDuckDB(logger, worker);

    await this.db.instantiate(bundle.mainModule, bundle.pthreadWorker);
    URL.revokeObjectURL(workerUrl);

    // Configure for partial HTTP reads (range requests)
    await this.db.open({
      path: ":memory:",
      filesystem: {
        forceFullHTTPReads: false,
        allowFullHTTPReads: false,
      },
    });
    console.log("[DuckDB] Configured filesystem for range requests");

    this.conn = await this.db.connect();

    // Register remote parquet files with HTTP protocol for range request support
    await this.db.registerFileURL("trips.parquet", TRIPS_URL, duckdb.DuckDBDataProtocol.HTTP, false);
    console.log(`[DuckDB] Registered trips.parquet`);

    // No views - we query read_parquet() directly with filters for predicate pushdown
    console.log(`[DuckDB] Initialized in ${Date.now() - startTime}ms`);
  }

  private ensureInitialized(): duckdb.AsyncDuckDBConnection {
    if (!this.conn) {
      throw new Error("DuckDB not initialized. Call init() first.");
    }
    return this.conn;
  }

  /**
   * Get trips that START within a time range (for progressive batch loading)
   */
  async getTripsInRange(params: {
    from: Date;
    to: Date;
  }): Promise<TripWithRoute[]> {
    const conn = this.ensureInitialized();
    const { from, to } = params;

    console.log(`[DuckDB] getTripsInRange: ${from.toISOString()} to ${to.toISOString()}`);
    const startTime = Date.now();

    const result = await conn.query(`
      SELECT
        t.id,
        t.startStationId,
        t.endStationId,
        t.startedAt,
        t.endedAt,
        t.bikeType,
        t.memberCasual,
        t.startLat,
        t.startLng,
        t.endLat,
        t.endLng,
        NULL as path,
        NULL as timeFractions,
        NULL as bearings,
        NULL as routeDistance
      FROM read_parquet('trips.parquet') t
      WHERE t.startedAt >= epoch_ms(${from.getTime()})
        AND t.startedAt < epoch_ms(${to.getTime()})
      ORDER BY t.startedAt ASC
    `);

    const trips = this.transformResults(result);
    console.log(`[DuckDB] getTripsInRange completed in ${Date.now() - startTime}ms, ${trips.length} trips`);
    console.log(`[DuckDB] Sample trips (${trips.length}):`, trips);
    return trips;
  }

  /**
   * Get trips that OVERLAP with a time window (started before end, ended after start)
   * Used for loading trips already in progress at animation start
   */
  async getTripsOverlap(params: {
    chunkStart: Date;
    chunkEnd: Date;
  }): Promise<TripWithRoute[]> {
    const conn = this.ensureInitialized();
    const { chunkStart, chunkEnd } = params;

    console.log(`[DuckDB] getTripsOverlap: ${chunkStart.toISOString()} to ${chunkEnd.toISOString()}`);
    const startTime = Date.now();

    const result = await conn.query(`
      SELECT
        t.id,
        t.startStationId,
        t.endStationId,
        t.startedAt,
        t.endedAt,
        t.bikeType,
        t.memberCasual,
        t.startLat,
        t.startLng,
        t.endLat,
        t.endLng,
        NULL as path,
        NULL as timeFractions,
        NULL as bearings,
        NULL as routeDistance
      FROM read_parquet('trips.parquet') t
      WHERE t.startedAt < epoch_ms(${chunkEnd.getTime()})
        AND t.endedAt > epoch_ms(${chunkStart.getTime()})
      ORDER BY t.startedAt ASC
    `);

    const trips = this.transformResults(result);
    console.log(`[DuckDB] getTripsOverlap completed in ${Date.now() - startTime}ms, ${trips.length} trips`);
    return trips;
  }

  /**
   * Get trips from specific station(s) within a time window (for search)
   */
  async getTripsFromStation(params: {
    startStationIds: string[];
    datetime: Date;
    intervalSeconds: number;
  }): Promise<TripWithRoute[]> {
    const conn = this.ensureInitialized();
    const { startStationIds, datetime, intervalSeconds } = params;

    const windowStart = new Date(datetime.getTime() - intervalSeconds * 1000);
    const windowEnd = new Date(datetime.getTime() + intervalSeconds * 1000);

    // Build IN clause with quoted strings
    const idList = startStationIds.map((id) => `'${id}'`).join(",");

    const result = await conn.query(`
      SELECT
        t.id,
        t.startStationId,
        t.endStationId,
        t.startedAt,
        t.endedAt,
        t.bikeType,
        t.memberCasual,
        t.startLat,
        t.startLng,
        t.endLat,
        t.endLng,
        NULL as path,
        NULL as timeFractions,
        NULL as bearings,
        NULL as routeDistance
      FROM read_parquet('trips.parquet') t
      WHERE t.startStationId IN (${idList})
        AND t.startedAt >= epoch_ms(${windowStart.getTime()})
        AND t.startedAt <= epoch_ms(${windowEnd.getTime()})
      ORDER BY t.startedAt ASC
    `);

    return this.transformResults(result);
  }

  /**
   * Transform DuckDB Arrow result to TripWithRoute[]
   */
  private transformResults(result: { toArray(): unknown[] }): TripWithRoute[] {
    const rows = result.toArray() as Array<{
      id: string;
      startStationId: string;
      endStationId: string;
      startedAt: bigint;
      endedAt: bigint;
      bikeType: string;
      memberCasual: string;
      startLat: number;
      startLng: number;
      endLat: number | null;
      endLng: number | null;
      path: string | null;
      timeFractions: string | null;
      bearings: string | null;
      routeDistance: number | null;
    }>;

    return rows.map((row) => {
      // DuckDB returns JSON columns as strings, parse them
      const path = row.path ? JSON.parse(row.path) : null;
      const timeFractions = row.timeFractions
        ? JSON.parse(row.timeFractions)
        : null;
      const bearings = row.bearings ? JSON.parse(row.bearings) : null;

      // DuckDB returns timestamps as BigInt microseconds, convert to Date
      const startedAt = new Date(Number(row.startedAt) / 1000);
      const endedAt = new Date(Number(row.endedAt) / 1000);

      return {
        id: row.id,
        startStationId: row.startStationId,
        endStationId: row.endStationId,
        startedAt,
        endedAt,
        bikeType: row.bikeType,
        memberCasual: row.memberCasual,
        startLat: row.startLat,
        startLng: row.startLng,
        endLat: row.endLat,
        endLng: row.endLng,
        path,
        timeFractions,
        bearings,
        routeDistance: row.routeDistance,
      };
    });
  }

  terminate(): void {
    this.conn?.close();
    this.db?.terminate();
    this.conn = null;
    this.db = null;
    this.initPromise = null;
  }
}

// Singleton instance
export const duckdbService = new DuckDBService();
