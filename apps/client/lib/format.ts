// =============================================================================
// Distance Formatting
// =============================================================================

import { convertLength } from "@turf/helpers";

export function formatDistance(meters: number): string {
  const feet = convertLength(meters, "meters", "feet");
  if (feet < 1000) {
    return `${Math.round(feet)} ft`;
  }
  const miles = convertLength(meters, "meters", "miles");
  return `${miles.toFixed(1)} mi`;
}

// =============================================================================
// Duration Formatting
// =============================================================================

export function formatDurationMinutes(startedAt: Date, endedAt: Date): string {
  const ms = endedAt.getTime() - startedAt.getTime();
  const minutes = Math.round(ms / 60000);
  return `${minutes} min${minutes !== 1 ? "s" : ""}`;
}

// =============================================================================
// Date/Time Formatting
// =============================================================================

// Format date for display (omits year if current year)
export function formatDateTime(date: Date): string {
  const currentYear = new Date().getFullYear();
  const dateYear = date.getFullYear();

  return date.toLocaleString("en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: dateYear !== currentYear ? "numeric" : undefined,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

// Format date with year always included
export function formatDateTimeFull(date: Date): string {
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

// Format milliseconds timestamp (NYC timezone)
export function formatTime(ms: number): string {
  return new Date(ms).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "America/New_York",
  });
}

// Format just the time portion (NYC timezone)
export function formatTimeOnly(ms: number): string {
  return new Date(ms).toLocaleString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
    timeZone: "America/New_York",
  });
}

// Format just the date portion (NYC timezone)
export function formatDateShort(ms: number): string {
  return new Date(ms).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "America/New_York",
  });
}
