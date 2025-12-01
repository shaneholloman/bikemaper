"use server";

import { prisma } from "@bikemap/db";

// June 1, 2025 8:00 AM - 9:00 AM (peak commute)
const START_TIME = new Date("2025-06-01T08:00:00.000Z");
const END_TIME = new Date("2025-06-01T09:00:00.000Z");

export async function getTrips() {
  // Trips that overlap with the window:
  // started before END_TIME AND ended after START_TIME
  const trips = await prisma.trip.findMany({
    where: {
      startedAt: { lt: END_TIME },
      endedAt: { gt: START_TIME },
    },
    orderBy: { startedAt: "asc" },
  });

  return {
    startTime: START_TIME.toISOString(),
    endTime: END_TIME.toISOString(),
    count: trips.length,
    trips,
  };
}
