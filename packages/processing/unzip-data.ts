// Recursively extracts all .zip files in data/
// Usage: bun run unzip-data.ts
//
// Handles nested zips (e.g., yearly archives containing monthly zips)
// by looping until no more zip files are found.

import { execSync } from "child_process";
import { readdir, stat } from "node:fs/promises";
import path from "path";
import { dataDir } from "./utils";

async function findZipFiles(dir: string): Promise<string[]> {
  const zips: string[] = [];

  // Check if directory exists
  try {
    const dirStat = await stat(dir);
    if (!dirStat.isDirectory()) {
      return zips;
    }
  } catch {
    return zips;
  }

  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    // Skip macOS metadata directories and files
    if (entry.name === "__MACOSX" || entry.name.startsWith("._")) {
      continue;
    }
    if (entry.isDirectory()) {
      zips.push(...(await findZipFiles(fullPath)));
    } else if (entry.name.endsWith(".zip")) {
      zips.push(fullPath);
    }
  }
  return zips;
}

function unzipFile(zipPath: string): void {
  const dir = path.dirname(zipPath);
  console.log(`  Extracting: ${path.basename(zipPath)}`);
  try {
    execSync(`unzip -o -q "${zipPath}" -d "${dir}"`, { stdio: "pipe" });
  } catch (err) {
    console.error(`  Failed to extract ${zipPath}: ${err}`);
  }
}

async function main() {
  console.log(`Scanning for .zip files in ${dataDir}...`);

  // Check if data directory exists
  try {
    const dirStat = await stat(dataDir);
    if (!dirStat.isDirectory()) {
      console.error(`Data directory not found: ${dataDir}`);
      console.error(`Create it and add your .zip files there.`);
      process.exit(1);
    }
  } catch {
    console.error(`Data directory not found: ${dataDir}`);
    console.error(`Create it and add your .zip files there.`);
    process.exit(1);
  }

  // Keep extracting until no new zips found (handles nested zips)
  let iteration = 0;
  let totalExtracted = 0;
  const processedZips = new Set<string>();

  while (true) {
    const allZips = await findZipFiles(dataDir);
    const zips = allZips.filter((z) => !processedZips.has(z));
    if (zips.length === 0) break;

    iteration++;
    console.log(`\nPass ${iteration}: Found ${zips.length} new zip file(s)`);

    for (const zip of zips) {
      unzipFile(zip);
      processedZips.add(zip);
      totalExtracted++;
    }
  }

  if (totalExtracted === 0) {
    console.log("\nNo zip files found.");
  } else {
    console.log(`\nDone. Extracted ${totalExtracted} zip file(s) in ${iteration} pass(es).`);
  }
}

main();
