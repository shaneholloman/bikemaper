"use server";

import { prisma } from "@bikemap/db";

// Default: June 8, 2025 10:00 AM - 12:00 PM (peak commute)
const DEFAULT_START_TIME = new Date("2025-06-08T10:00:00.000Z");
const DEFAULT_END_TIME = new Date("2025-06-08T12:00:00.000Z");

export async function getActiveRides(params?: {
  startTime?: Date;
  endTime?: Date;
}) {
  const startTime = params?.startTime
    ? params.startTime
    : DEFAULT_START_TIME;
  const endTime = params?.endTime
    ? params.endTime
    : DEFAULT_END_TIME;
  // Get trips with their routes via raw SQL JOIN
  const tripsWithRoutes = await prisma.$queryRaw<
    Array<{
      id: string;
      startStationId: string;
      endStationId: string;
      startedAt: Date;
      endedAt: Date;
      rideableType: string;
      memberCasual: string;
      startLat: number;
      startLng: number;
      endLat: number | null;
      endLng: number | null;
      routeGeometry: string | null;
      routeDistance: number | null;
      routeDuration: number | null;
    }>
  >`
    SELECT
      t.id,
      t.startStationId,
      t.endStationId,
      t.startedAt,
      t.endedAt,
      t.rideableType,
      t.memberCasual,
      t.startLat,
      t.startLng,
      t.endLat,
      t.endLng,
      r.geometry as routeGeometry,
      r.distance as routeDistance,
      r.duration as routeDuration
    FROM Trip t
    LEFT JOIN Route r
      ON r.startStationId = t.startStationId
      AND r.endStationId = t.endStationId
    WHERE t.startedAt < ${endTime}
      AND t.endedAt > ${startTime}
    ORDER BY t.startedAt ASC
  `;

  return {
    startTime,
    endTime,
    count: tripsWithRoutes.length,
    trips: tripsWithRoutes,
  };
}
