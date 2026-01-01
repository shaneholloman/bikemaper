// =============================================================================
// Timezone Convention
// =============================================================================
// All timestamps are stored and processed in UTC internally.
// Display functions convert to America/New_York for user-facing output.
// See packages/processing/README.md for full documentation.

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

// Format date for display (NYC timezone)
export function formatDateTime(date: Date): string {
  return date.toLocaleString("en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "America/New_York",
  });
}

// Format date with year always included (NYC timezone)
// If endDate is provided, shows a time range (e.g., "Jun 1, 2015, 3:30 – 3:52 PM")
export function formatDateTimeFull(data: { startDate: Date; endDate?: Date }): string {
  const { startDate, endDate } = data;

  if (!endDate) {
    return startDate.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: "America/New_York",
    });
  }

  // Format as "Jun 1, 2015, 3:30 – 3:52 PM"
  const datePart = startDate.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "America/New_York",
  });

  const startTime = startDate.toLocaleString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: false,
    timeZone: "America/New_York",
  });

  const endTime = endDate.toLocaleString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "America/New_York",
  });

  return `${datePart}, ${startTime} – ${endTime}`;
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

// Format a time range (NYC timezone)
export function formatTimeRange(startedAt: Date, endedAt: Date): string {
  const options: Intl.DateTimeFormatOptions = {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "America/New_York",
  };
  const start = startedAt.toLocaleTimeString("en-US", options);
  const end = endedAt.toLocaleTimeString("en-US", options);
  return `${start} – ${end}`;
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

// =============================================================================
// Speed Formatting
// =============================================================================

export function formatSpeedMph(data: {
  distanceMeters: number;
  startedAt: Date;
  endedAt: Date;
}): string {
  const miles = convertLength(data.distanceMeters, "meters", "miles");
  const hours = (data.endedAt.getTime() - data.startedAt.getTime()) / 3600000;
  const mph = miles / hours;
  return `${mph.toFixed(1)} mph`;
}
