import {
  readFileSync,
  writeFileSync,
  renameSync,
  unlinkSync,
  existsSync,
  mkdirSync,
} from "node:fs";
import { join, dirname } from "node:path";
import * as lockfile from "proper-lockfile";
import type { RatingWire } from "./types";

interface RatingsData {
  readonly ratings: readonly RatingWire[];
}

const EMPTY_RATINGS_DATA: RatingsData = { ratings: [] };

/** Lock retry configuration (matches registry/writer.ts pattern) */
const LOCK_RETRIES = 10;
const LOCK_MIN_TIMEOUT_MS = 100;
const LOCK_MAX_TIMEOUT_MS = 1000;
const LOCK_STALE_MS = 30_000;

const LOCK_OPTIONS = {
  retries: {
    retries: LOCK_RETRIES,
    minTimeout: LOCK_MIN_TIMEOUT_MS,
    maxTimeout: LOCK_MAX_TIMEOUT_MS,
  },
  stale: LOCK_STALE_MS,
} as const;

/**
 * Resolve the path to the ratings.json file.
 */
function getRatingsFilePath(): string {
  const cwd = process.cwd();
  return join(cwd, "src", "data", "registry", "ratings.json");
}

/**
 * Ensure the ratings file exists. Creates directory and file if missing.
 */
function ensureRatingsFile(filePath: string): void {
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  if (!existsSync(filePath)) {
    writeFileSync(filePath, JSON.stringify(EMPTY_RATINGS_DATA, null, 2), "utf-8");
  }
}

/**
 * Load all ratings from the JSON file.
 */
export function loadRatings(): readonly RatingWire[] {
  const filePath = getRatingsFilePath();
  ensureRatingsFile(filePath);

  const raw = readFileSync(filePath, "utf-8");
  const data: RatingsData = JSON.parse(raw);

  if (!data.ratings || !Array.isArray(data.ratings)) {
    return [];
  }

  return data.ratings;
}

/**
 * Check if a rating already exists for the given order_id and client_address.
 */
export function isDuplicateRating(
  ratings: readonly RatingWire[],
  orderId: string,
  clientAddress: string,
): boolean {
  return ratings.some(
    (r) => r.order_id === orderId && r.client_address.toLowerCase() === clientAddress.toLowerCase(),
  );
}

/**
 * Add a new rating to the ratings JSON file.
 * Uses file locking and atomic write (tmp + rename) to prevent
 * race conditions and corruption.
 *
 * @throws Error if a duplicate rating exists or lock cannot be acquired
 */
export async function addRating(newRating: RatingWire): Promise<RatingWire> {
  const filePath = getRatingsFilePath();
  const tmpPath = `${filePath}.tmp`;
  let release: (() => Promise<void>) | null = null;

  ensureRatingsFile(filePath);

  try {
    release = await lockfile.lock(filePath, LOCK_OPTIONS);

    const raw = readFileSync(filePath, "utf-8");
    const data: RatingsData = JSON.parse(raw);
    const ratings = data.ratings ?? [];

    if (isDuplicateRating(ratings, newRating.order_id, newRating.client_address)) {
      throw new Error(
        `Rating already exists for order ${newRating.order_id} from ${newRating.client_address}`,
      );
    }

    const updatedData: RatingsData = {
      ratings: [...ratings, newRating],
    };

    writeFileSync(tmpPath, JSON.stringify(updatedData, null, 2), "utf-8");
    renameSync(tmpPath, filePath);

    return newRating;
  } catch (error) {
    if (existsSync(tmpPath)) {
      try {
        unlinkSync(tmpPath);
      } catch {
        // Ignore cleanup errors
      }
    }
    throw error;
  } finally {
    if (release) {
      await release();
    }
  }
}

/**
 * Get all ratings for a specific provider.
 */
export function getRatingsByProvider(providerAddress: string): readonly RatingWire[] {
  const ratings = loadRatings();
  return ratings.filter((r) => r.provider_address.toLowerCase() === providerAddress.toLowerCase());
}
