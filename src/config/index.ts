import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export type ImageFormat = 'original' | 'png' | 'jpg' | 'webp';
export type ImageResolution = 'original' | '1080p' | '4k';
export type ImageQuality = 'high' | 'medium' | 'low';
export type Timeframe = 'week' | 'month' | 'year' | 'ever';

export const config = {
  // Application configs
  headless: process.env.HEADLESS !== 'false', // default true
  resultsLimit: parseInt(process.env.RESULTS_LIMIT || '10', 10),
  designsSubdir: process.env.DESIGNS_SUBDIR || 'designs',
  delay: parseInt(process.env.SCRAPE_DELAY || '1000', 10),

  // Download & asset control defaults
  format: (process.env.FORMAT || 'original') as ImageFormat,
  resolution: (process.env.RESOLUTION || 'original') as ImageResolution,
  quality: (process.env.QUALITY || 'high') as ImageQuality,

  // Retry & resilience
  maxRetries: parseInt(process.env.MAX_RETRIES || '3', 10),

  // Performance & scalability
  concurrency: parseInt(process.env.CONCURRENCY || '3', 10),
  rateLimit: parseInt(process.env.RATE_LIMIT || '1000', 10),
  cacheEnabled: process.env.CACHE_ENABLED !== 'false', // default true

  // Search / filter defaults
  pages: parseInt(process.env.PAGES || '1', 10),

  // Computed paths
  outputDir: path.resolve(process.cwd(), process.env.DESIGNS_SUBDIR || 'designs'),
};
