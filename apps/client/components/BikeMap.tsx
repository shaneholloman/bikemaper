"use client";

import { getActiveRides } from "@/app/server/trips";
import { getColorFromId } from "@/utils/map";
import polyline from "@mapbox/polyline";
import along from "@turf/along";
import { lineString } from "@turf/helpers";
import length from "@turf/length";
import type { GeoJSONSource } from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useCallback, useEffect, useRef, useState } from "react";
import Map, { Layer, Source, useMap } from "react-map-gl/mapbox";

// Infer types from server function
type TripsResponse = Awaited<ReturnType<typeof getActiveRides>>;
type Trip = TripsResponse["trips"][number];

type AnimationState = "idle" | "playing" | "finished";

type PreparedTrip = {
  id: string;
  color: string;
  startTime: number; // ms offset from animation window start
  endTime: number;
  startProgress: number; // 0-1, where on route the bike starts (for clipped trips)
  endProgress: number; // 0-1, where on route the bike ends (for clipped trips)
  line: GeoJSON.Feature<GeoJSON.LineString>; // turf lineString for interpolation
  totalDistance: number; // in meters
};

// Animation plays at 150x speed (e.g., 2 hours plays in ~48 seconds)
const SPEEDUP = 150;

function prepareTrips(data: {
  trips: Trip[];
  windowStartMs: number;
  windowEndMs: number;
}): PreparedTrip[] {
  const { trips, windowStartMs, windowEndMs } = data;
  const windowDuration = windowEndMs - windowStartMs;

  return trips
    .filter((trip): trip is Trip & { routeGeometry: string } =>
      trip.routeGeometry !== null &&
      trip.startStationId !== trip.endStationId
    )
    .map((trip) => {
      // Decode polyline6 - returns [lat, lng][], flip to [lng, lat]
      const decoded = polyline.decode(trip.routeGeometry, 6);
      const coordinates = decoded.map(
        ([lat, lng]) => [lng, lat] as [number, number]
      );

      // Create turf lineString and compute total distance
      const line = lineString(coordinates);
      const totalDistance = length(line, { units: "meters" });
    


      // Normalize times relative to window start (0 to windowDuration)
      const tripStartMs = new Date(trip.startedAt).getTime();
      const tripEndMs = new Date(trip.endedAt).getTime();

      // Calculate implied speed and filter unrealistic trips
      const tripDurationHours = (tripEndMs - tripStartMs) / (1000 * 60 * 60);
      const speedKmh = totalDistance / 1000 / tripDurationHours;

      // Skip trips faster than 25 km/h (unrealistic for bikes)
      if (speedKmh > 25 || speedKmh < 0.25) return null;

      // Calculate where on the route the bike should be at window boundaries
      // For trips that start before or end after the window
      const tripDurationMs = tripEndMs - tripStartMs;
      const startProgress = Math.max(0, (windowStartMs - tripStartMs) / tripDurationMs);
      const endProgress = Math.min(1, (windowEndMs - tripEndMs + tripDurationMs) / tripDurationMs);

      return {
        id: trip.id,
        color: getColorFromId(trip.id),
        startTime: Math.max(0, tripStartMs - windowStartMs),
        endTime: Math.min(windowDuration, tripEndMs - windowStartMs),
        startProgress,
        endProgress,
        line,
        totalDistance,
      };
    })
    .filter((trip): trip is PreparedTrip => trip !== null);
}

const EMPTY_GEOJSON: GeoJSON.FeatureCollection = {
  type: "FeatureCollection",
  features: [],
};

function AnimationController(props: {
  preparedTrips: PreparedTrip[];
  windowDurationMs: number;
  animationDurationMs: number;
}) {
  const { preparedTrips, windowDurationMs, animationDurationMs } = props;
  const { current: mapRef } = useMap();
  const [animState, setAnimState] = useState<AnimationState>("idle");

  const animationRef = useRef<{
    rafId: number | null;
    startTimestamp: number | null;
  }>({ rafId: null, startTimestamp: null });

  const animateFnRef = useRef<((timestamp: number) => void) | null>(null);

  // Store animate function in ref to avoid circular dependency
  useEffect(() => {
    animateFnRef.current = (timestamp: number) => {
      const map = mapRef?.getMap();
      if (!map) return;

      const ref = animationRef.current;
      if (ref.startTimestamp === null) {
        ref.startTimestamp = timestamp;
      }

      const elapsedReal = timestamp - ref.startTimestamp;
      // Map real time to simulation time using ratio
      const simulationTime =
        (elapsedReal / animationDurationMs) * windowDurationMs;

      // Check if animation finished
      if (simulationTime >= windowDurationMs) {
        setAnimState("finished");
        const source = map.getSource("riders") as GeoJSONSource | undefined;
        if (source) {
          source.setData(EMPTY_GEOJSON);
        }
        ref.rafId = null;
        return;
      }

      // Build features for active trips
      const features: GeoJSON.Feature[] = [];
      for (const trip of preparedTrips) {
        if (simulationTime < trip.startTime || simulationTime > trip.endTime) {
          continue;
        }

        // Calculate progress within the visible window (0-1)
        const windowProgress =
          (simulationTime - trip.startTime) / (trip.endTime - trip.startTime);
        // Map to actual route progress using startProgress and endProgress
        const routeProgress =
          trip.startProgress +
          windowProgress * (trip.endProgress - trip.startProgress);

        // Use turf's along() to get point at distance along the line
        const distanceAlongRoute = routeProgress * trip.totalDistance;
        const point = along(trip.line, distanceAlongRoute, { units: "meters" });

        features.push({
          type: "Feature",
          geometry: point.geometry,
          properties: { id: trip.id, color: trip.color },
        });
      }

      // Update Mapbox source directly - bypasses React
      const source = map.getSource("riders") as GeoJSONSource | undefined;
      if (source) {
        source.setData({ type: "FeatureCollection", features });
      }

      ref.rafId = requestAnimationFrame((ts) => animateFnRef.current?.(ts));
    };
  }, [mapRef, preparedTrips, windowDurationMs, animationDurationMs]);

  const play = useCallback(() => {
    animationRef.current.startTimestamp = null;
    setAnimState("playing");
    animationRef.current.rafId = requestAnimationFrame((ts) =>
      animateFnRef.current?.(ts)
    );
  }, []);

  const replay = useCallback(() => {
    if (animationRef.current.rafId) {
      cancelAnimationFrame(animationRef.current.rafId);
    }
    play();
  }, [play]);

  // Cleanup on unmount
  useEffect(() => {
    const ref = animationRef.current;
    return () => {
      if (ref.rafId) {
        cancelAnimationFrame(ref.rafId);
      }
    };
  }, []);

  return (
    <div className="absolute top-4 left-4 z-10">
      {animState === "idle" && (
        <button
          onClick={play}
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg shadow-lg transition-colors"
        >
          Play
        </button>
      )}
      {animState === "playing" && (
        <div className="bg-gray-800 text-white font-medium px-4 py-2 rounded-lg shadow-lg">
          Playing...
        </div>
      )}
      {animState === "finished" && (
        <button
          onClick={replay}
          className="bg-green-600 hover:bg-green-700 text-white font-medium px-4 py-2 rounded-lg shadow-lg transition-colors"
        >
          Replay
        </button>
      )}
    </div>
  );
}

export const BikeMap = () => {
  const [preparedTrips, setPreparedTrips] = useState<PreparedTrip[]>([]);
  const [windowDurationMs, setWindowDurationMs] = useState(0);

  useEffect(() => {
    const fetchTrips = async () => {
      const data = await getActiveRides();
      console.log(`Found ${data.count} trips`);

      const windowStartMs = data.startTime.getTime();
      const windowEndMs = data.endTime.getTime();

      const prepared = prepareTrips({
        trips: data.trips,
        windowStartMs,
        windowEndMs,
      });

      console.log(`Prepared ${prepared.length} trips with routes`);
      setPreparedTrips(prepared);
      setWindowDurationMs(windowEndMs - windowStartMs);
    };
    fetchTrips();
  }, []);

  if (!process.env.NEXT_PUBLIC_MAPBOX_TOKEN) {
    throw new Error("NEXT_PUBLIC_MAPBOX_TOKEN is not set");
  }

  return (
    <Map
      id="bikemap"
      mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
      initialViewState={{
        longitude: -74.0,
        latitude: 40.7,
        zoom: 14,
      }}
      mapStyle="mapbox://styles/mapbox/streets-v9"
      style={{ width: "100%", height: "100%" }}
    >
      <Source id="riders" type="geojson" data={EMPTY_GEOJSON}>
        <Layer
          id="riders"
          type="circle"
          paint={{
            "circle-radius": 5,
            "circle-color": ["get", "color"],
            "circle-opacity": 0.8,
          }}
        />
      </Source>

      {preparedTrips.length > 0 && windowDurationMs > 0 && (
        <AnimationController
          preparedTrips={preparedTrips}
          windowDurationMs={windowDurationMs}
          animationDurationMs={windowDurationMs / SPEEDUP}
        />
      )}
    </Map>
  );
};
