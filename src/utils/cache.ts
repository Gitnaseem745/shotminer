import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { config } from '../config/index.js';
import { logger } from './logger.js';

interface CacheEntry {
  url: string;
  localPath: string;
  timestamp: number;
}

interface CacheManifest {
  version: number;
  entries: Record<string, CacheEntry>;
}

/**
 * URL-based download cache that persists to a JSON manifest file.
 * Prevents re-downloading images that have already been saved.
 */
export class DownloadCache {
  private manifest: CacheManifest;
  private filePath: string;

  constructor(outputDir?: string) {
    this.filePath = path.join(outputDir || config.outputDir, '.shotminer-cache.json');
    this.manifest = { version: 1, entries: {} };
  }

  /** Generate a deterministic hash key for a URL */
  private hashUrl(url: string): string {
    return crypto.createHash('sha256').update(url).digest('hex').slice(0, 16);
  }

  /** Load the cache manifest from disk */
  load(): void {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        this.manifest = JSON.parse(raw);
        logger.debug(`[Cache] Loaded ${Object.keys(this.manifest.entries).length} cached entries`);
      }
    } catch (e: any) {
      logger.warn(`[Cache] Failed to load cache file, starting fresh: ${e.message}`);
      this.manifest = { version: 1, entries: {} };
    }
  }

  /** Save the cache manifest to disk */
  save(): void {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.filePath, JSON.stringify(this.manifest, null, 2));
      logger.debug(`[Cache] Saved ${Object.keys(this.manifest.entries).length} entries`);
    } catch (e: any) {
      logger.warn(`[Cache] Failed to save cache: ${e.message}`);
    }
  }

  /** Check if a URL has already been downloaded */
  has(url: string): boolean {
    const key = this.hashUrl(url);
    const entry = this.manifest.entries[key];
    if (!entry) return false;

    // Verify the local file still exists
    if (!fs.existsSync(entry.localPath)) {
      delete this.manifest.entries[key];
      return false;
    }
    return true;
  }

  /** Get the cached local path for a URL */
  get(url: string): string | null {
    const key = this.hashUrl(url);
    return this.manifest.entries[key]?.localPath || null;
  }

  /** Add a URL → localPath mapping to the cache */
  add(url: string, localPath: string): void {
    const key = this.hashUrl(url);
    this.manifest.entries[key] = {
      url,
      localPath,
      timestamp: Date.now(),
    };
  }

  /** Get the total number of cached entries */
  get size(): number {
    return Object.keys(this.manifest.entries).length;
  }
}
