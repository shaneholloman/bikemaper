"use client"

import { getTrips } from "@/app/server/trips";
import { useEffect } from "react";

export const Map = () => {
  useEffect(() => {
    const fetchTrips = async () => {
      const data = await getTrips();
      console.log(`Found ${data.count} trips`, data);
    };
    fetchTrips();
  }, []);


  return (
    <div>Map</div>
  )
}
