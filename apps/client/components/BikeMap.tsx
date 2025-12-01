"use client";

import { getActiveRides } from "@/app/server/trips";
import { getColorFromId } from "@/utils/map";
import polyline from "@mapbox/polyline";
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
  coordinates: [number, number][]; // [lng, lat] decoded from polyline
};

// Time compression: 2 hours -> 45 seconds
const ANIMATION_DURATION_MS = 150_000;

function interpolateAlongRoute(
  coords: [number, number][],
  progress: number
): [number, number] {
  const idx = progress * (coords.length - 1);
  const i = Math.floor(idx);
  const t = idx - i;

  if (i >= coords.length - 1) {
    return coords[coords.length - 1];
  }

  const [lng1, lat1] = coords[i];
  const [lng2, lat2] = coords[i + 1];
  return [lng1 + (lng2 - lng1) * t, lat1 + (lat2 - lat1) * t];
}

function prepareTrips(data: {
  trips: Trip[];
  windowStartMs: number;
  windowEndMs: number;
}): PreparedTrip[] {
  const { trips, windowStartMs, windowEndMs } = data;
  const windowDuration = windowEndMs - windowStartMs;

  return trips
    .filter((trip): trip is Trip & { routeGeometry: string } =>
      trip.routeGeometry !== null
    )
    .map((trip) => {
      // Decode polyline6 - returns [lat, lng][], flip to [lng, lat]
      const decoded = polyline.decode(trip.routeGeometry, 6);
      const coordinates = decoded.map(
        ([lat, lng]) => [lng, lat] as [number, number]
      );

      // Normalize times relative to window start (0 to windowDuration)
      const tripStartMs = new Date(trip.startedAt).getTime();
      const tripEndMs = new Date(trip.endedAt).getTime();

      return {
        id: trip.id,
        color: getColorFromId(trip.id),
        startTime: Math.max(0, tripStartMs - windowStartMs),
        endTime: Math.min(windowDuration, tripEndMs - windowStartMs),
        coordinates,
      };
    });
}

const EMPTY_GEOJSON: GeoJSON.FeatureCollection = {
  type: "FeatureCollection",
  features: [],
};

function AnimationController(props: {
  preparedTrips: PreparedTrip[];
  windowDurationMs: number;
}) {
  const { preparedTrips, windowDurationMs } = props;
  const { current: mapRef } = useMap();
  const [animState, setAnimState] = useState<AnimationState>("idle");

  const animationRef = useRef<{
    rafId: number | null;
    startTimestamp: number | null;
  }>({ rafId: null, startTimestamp: null });

  const animate = useCallback(
    (timestamp: number) => {
      const map = mapRef?.getMap();
      if (!map) return;

      const ref = animationRef.current;
      if (ref.startTimestamp === null) {
        ref.startTimestamp = timestamp;
      }

      const elapsedReal = timestamp - ref.startTimestamp;
      // Map real time to simulation time
      const simulationTime =
        (elapsedReal / ANIMATION_DURATION_MS) * windowDurationMs;

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

        const progress =
          (simulationTime - trip.startTime) / (trip.endTime - trip.startTime);
        const [lng, lat] = interpolateAlongRoute(trip.coordinates, progress);

        features.push({
          type: "Feature",
          geometry: { type: "Point", coordinates: [lng, lat] },
          properties: { id: trip.id, color: trip.color },
        });
      }

      // Update Mapbox source directly - bypasses React
      const source = map.getSource("riders") as GeoJSONSource | undefined;
      if (source) {
        source.setData({ type: "FeatureCollection", features });
      }

      ref.rafId = requestAnimationFrame(animate);
    },
    [mapRef, preparedTrips, windowDurationMs]
  );

  const play = useCallback(() => {
    animationRef.current.startTimestamp = null;
    setAnimState("playing");
    animationRef.current.rafId = requestAnimationFrame(animate);
  }, [animate]);

  const replay = useCallback(() => {
    if (animationRef.current.rafId) {
      cancelAnimationFrame(animationRef.current.rafId);
    }
    play();
  }, [play]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current.rafId) {
        cancelAnimationFrame(animationRef.current.rafId);
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

      const windowStartMs = new Date(data.startTime).getTime();
      const windowEndMs = new Date(data.endTime).getTime();

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
        />
      )}
    </Map>
  );
};
