-- CreateTable
CREATE TABLE "Trip" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "startStationId" TEXT NOT NULL,
    "endStationId" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL,
    "endedAt" DATETIME NOT NULL,
    "rideableType" TEXT NOT NULL,
    "memberCasual" TEXT NOT NULL,
    "startLat" REAL NOT NULL,
    "startLng" REAL NOT NULL,
    "endLat" REAL,
    "endLng" REAL
);

-- CreateTable
CREATE TABLE "Station" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "latitude" REAL NOT NULL,
    "longitude" REAL NOT NULL
);

-- CreateIndex
CREATE INDEX "Trip_startedAt_endedAt_idx" ON "Trip"("startedAt", "endedAt");

-- CreateIndex
CREATE INDEX "Trip_startStationId_endStationId_idx" ON "Trip"("startStationId", "endStationId");
