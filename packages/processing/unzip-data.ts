// Recursively extracts all .zip files in data/
// Usage: bun run unzip-data.ts
//
// Handles nested zips (e.g., yearly archives containing monthly zips)
// by looping until no more zip files are found.
//
// Tracks processed zips in .processed-zips.json for resumability.

import { exec } from "child_process";
import { globSync } from "glob";
import { stat } from "node:fs/promises";
import os from "os";
import path from "path";
import { promisify } from "util";
import { dataDir } from "./utils";

const PROCESSED_ZIPS_FILE = path.join(dataDir, ".processed-zips.json");

type ProcessedZipsData = {
  processedZips: string[];
};

async function loadProcessedZips(): Promise<Set<string>> {
  const file = Bun.file(PROCESSED_ZIPS_FILE);
  if (await file.exists()) {
    const data: ProcessedZipsData = await file.json();
    return new Set(data.processedZips);
  }
  return new Set();
}

async function saveProcessedZips(processedZips: Set<string>): Promise<void> {
  const data: ProcessedZipsData = {
    processedZips: Array.from(processedZips),
  };
  await Bun.write(PROCESSED_ZIPS_FILE, JSON.stringify(data, null, 2));
}

const execAsync = promisify(exec);
const CONCURRENCY = os.cpus().length;

function findZipFiles(dir: string): string[] {
  return globSync("**/*.zip", {
    cwd: dir,
    absolute: true,
    ignore: ["**/__MACOSX/**", "**/._*"],
  });
}

// Returns true if extraction succeeded
async function unzipFile(zipPath: string, current: number, total: number): Promise<boolean> {
  const dir = path.dirname(zipPath);
  console.log(`  [${current}/${total}] ${path.basename(zipPath)}`);
  try {
    // -x excludes macOS metadata (__MACOSX dirs and ._ resource fork files)
    await execAsync(`unzip -o -q "${zipPath}" -d "${dir}" -x "__MACOSX/*" "*/._*" "._*"`);
    return true;
  } catch (err) {
    console.error(`  Failed to extract ${zipPath}: ${err}`);
    return false;
  }
}

// Returns set of successfully extracted zips
async function unzipAll(zips: string[]): Promise<Set<string>> {
  const extracted = new Set<string>();
  let index = 0;
  let completed = 0;
  const total = zips.length;

  async function worker(): Promise<void> {
    while (index < zips.length) {
      const currentIndex = index++;
      const zipPath = zips[currentIndex]!;
      const success = await unzipFile(zipPath, ++completed, total);
      if (success) {
        extracted.add(zipPath);
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
  return extracted;
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

  // Load previously processed zips for resumability
  const processedZips = await loadProcessedZips();
  if (processedZips.size > 0) {
    console.log(`Resuming: ${processedZips.size} zips already processed`);
  }

  // Keep extracting until no new zips found (handles nested zips)
  let iteration = 0;
  let totalExtracted = 0;

  while (true) {
    const allZips = findZipFiles(dataDir);
    const zips = allZips.filter((z) => !processedZips.has(z));
    if (zips.length === 0) break;

    iteration++;
    console.log(`\nPass ${iteration}: Found ${zips.length} new zip file(s) (concurrency: ${CONCURRENCY})`);

    const extracted = await unzipAll(zips);
    for (const zip of extracted) {
      processedZips.add(zip);
    }
    totalExtracted += extracted.size;

    // Save after each pass for resumability
    await saveProcessedZips(processedZips);
  }

  if (totalExtracted === 0) {
    console.log("\nNo zip files found.");
  } else {
    console.log(`\nDone. Extracted ${totalExtracted} zip file(s) in ${iteration} pass(es).`);
  }
}

main();
