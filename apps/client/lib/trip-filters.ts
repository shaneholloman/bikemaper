import type { TripWithRoute } from "./trip-types";

/**
 * Filters trips to only include those that can be rendered on the map.
 * Used by both Search (getTripsFromStation) and BikeMap (prepareTripsForDeck).
 *
 * Criteria:
 * 1. Must have route geometry (polyline6 encoded from routes.parquet)
 * 2. Can't be same-station trip
 * 3. Speed must be 2-32 km/h (1.2-20 mph)
 */
export function filterTrips<T extends TripWithRoute>(trips: T[]): T[] {
  return trips.filter((trip) => {
    // Must have route geometry
    if (!trip.routeGeometry) return false;

    // Can't be same-station trip
    if (trip.startStationName === trip.endStationName) return false;

    // Speed must be 2-32 km/h (1.2-20 mph)
    if (!trip.routeDistance) return false;
    const durationMs = trip.endedAt.getTime() - trip.startedAt.getTime();
    const durationHours = durationMs / (1000 * 60 * 60);
    const speedKmh = trip.routeDistance / 1000 / durationHours;
    if (speedKmh <= 2 || speedKmh >= 32) return false;

    return true;
  });
}
