import puppeteer from 'puppeteer';
import type { Page } from 'puppeteer';
import { config, type ImageFormat, type ImageResolution, type ImageQuality, type Timeframe } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { downloadImage } from '../utils/downloader.js';
import { withRetry } from '../utils/retry.js';
import { DownloadCache } from '../utils/cache.js';
import { parallelMap } from '../utils/parallel.js';

export interface ScrapeOptions {
  prompt: string;
  limit?: number;
  format?: ImageFormat;
  resolution?: ImageResolution;
  quality?: ImageQuality;
  maxRetries?: number;
  concurrency?: number;
  rateLimit?: number;
  cacheEnabled?: boolean;
  color?: string;
  timeframe?: Timeframe;
  tag?: string;
  pages?: number;
}

export interface ShotCard {
  title: string;
  designer: string;
  url: string;
}

export interface DesignData {
  title: string;
  designer: string;
  url: string;
  imageUrls: string[];
  localPaths: string[];
}

/** Small helper to sleep between navigations */
function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Builds a Dribbble search URL with optional filters.
 */
function buildSearchUrl(prompt: string, page: number, opts: { color?: string; timeframe?: Timeframe; tag?: string }): string {
  const base = `https://dribbble.com/search/${encodeURIComponent(prompt)}`;
  const params = new URLSearchParams();

  if (page > 1) params.set('page', String(page));
  if (opts.color) params.set('color', opts.color);
  if (opts.timeframe && opts.timeframe !== 'ever') params.set('timeframe', opts.timeframe);
  if (opts.tag) params.set('tag', opts.tag);

  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

/**
 * Extracts all image URLs from a single shot detail page.
 */
async function scrapeShotPage(page: Page, shotUrl: string): Promise<string[]> {
  logger.debug(`Navigating to shot page: ${shotUrl}`);

  await page.goto(shotUrl, { waitUntil: 'networkidle2', timeout: 30000 });

  // Wait for the media content to appear
  await page.waitForSelector('[class*="media-content"], [class*="shot-content"], .media-content, .shot-content, .ShotMediaSection, .shot-media, [data-testid="shot-media"]', { timeout: 10000 }).catch(() => {
    logger.debug('Primary media container selector not found, falling back to broader search.');
  });

  const imageUrls: string[] = await page.evaluate(() => {
    const urls = new Set<string>();

    // Strategy 1: Find images inside known shot content containers
    const contentSelectors = [
      '[class*="media-content"]',
      '[class*="shot-content"]',
      '[class*="ShotMedia"]',
      '[class*="shot-media"]',
      '[data-testid="shot-media"]',
      '.shot-content',
      '.media-content',
    ];

    let contentContainer: Element | null = null;
    for (const sel of contentSelectors) {
      contentContainer = document.querySelector(sel);
      if (contentContainer) break;
    }

    // If we found a specific container, search inside it
    const searchRoot = contentContainer || document.body;

    const imgs = searchRoot.querySelectorAll('img');
    for (const img of imgs) {
      // Skip tiny images (icons, avatars, etc.)
      const width = img.naturalWidth || parseInt(img.getAttribute('width') || '0');
      const height = img.naturalHeight || parseInt(img.getAttribute('height') || '0');

      // Get the best URL from srcset or src
      let bestUrl = '';

      const srcset = img.getAttribute('srcset') || '';
      if (srcset) {
        const sources = srcset.split(',').map(s => s.trim().split(/\s+/));
        // Take the highest resolution entry (usually the last)
        bestUrl = sources[sources.length - 1]?.[0] || '';
      }

      if (!bestUrl) {
        bestUrl = img.getAttribute('data-src') || img.getAttribute('src') || '';
      }

      // Filter out placeholder/data URIs, tiny assets, and tracking pixels
      if (
        bestUrl &&
        !bestUrl.startsWith('data:') &&
        !bestUrl.includes('/icons/') &&
        !bestUrl.includes('/avatars/') &&
        !bestUrl.includes('profile_') &&
        !bestUrl.includes('gravatar') &&
        (width === 0 || width > 100) &&
        (height === 0 || height > 100)
      ) {
        // Clean the URL — remove low-res query params if possible
        let cleanUrl = bestUrl;
        if (cleanUrl.includes('compress=1')) {
          cleanUrl = cleanUrl.replace(/[?&]compress=1/, '');
        }
        urls.add(cleanUrl);
      }
    }

    return Array.from(urls);
  });

  logger.debug(`Found ${imageUrls.length} images on shot page`);
  return imageUrls;
}

/**
 * Phase 1: Discover shot cards from Dribbble search results.
 * Supports pagination and filtering.
 */
export async function discoverShots(
  page: Page,
  opts: {
    prompt: string;
    limit: number;
    pages: number;
    color?: string;
    timeframe?: Timeframe;
    tag?: string;
  }
): Promise<ShotCard[]> {
  const { prompt, limit, pages, color, timeframe, tag } = opts;
  const allCards: ShotCard[] = [];
  const seenUrls = new Set<string>();

  for (let p = 1; p <= pages; p++) {
    if (allCards.length >= limit) break;

    const searchUrl = buildSearchUrl(prompt, p, { color, timeframe, tag });
    logger.info(`[Page ${p}/${pages}] Navigating to: ${searchUrl}`);

    await page.goto(searchUrl, { waitUntil: 'networkidle2' });

    await page.waitForSelector('.shot-thumbnail', { timeout: 15000 }).catch(() => {
      logger.warn('Could not find shots grid. Dribbble might have blocked the request or UI changed.');
    });

    const remaining = limit - allCards.length;

    const shotCards = await page.evaluate((maxLimit) => {
      const shots = document.querySelectorAll('.shot-thumbnail');
      const cards: { title: string; designer: string; url: string }[] = [];

      for (let i = 0; i < shots.length; i++) {
        if (cards.length >= maxLimit) break;

        const shot = shots[i];

        const titleEl = shot.querySelector('.shot-title');
        const title = titleEl?.textContent?.trim() || `Design ${i + 1}`;

        const designerEl = shot.querySelector('.display-name');
        const designer = designerEl?.textContent?.trim() || 'Unknown';

        const linkEl = shot.querySelector('.dribbble-link');
        const href = linkEl?.getAttribute('href') || '';
        const url = href ? `https://dribbble.com${href}` : '';

        if (url) {
          cards.push({ title, designer, url });
        }
      }

      return cards;
    }, remaining);

    // Deduplicate across pages
    for (const card of shotCards) {
      if (!seenUrls.has(card.url)) {
        seenUrls.add(card.url);
        allCards.push(card);
      }
    }

    logger.info(`[Page ${p}/${pages}] Found ${shotCards.length} cards (total so far: ${allCards.length})`);

    // Delay between pages
    if (p < pages && allCards.length < limit) {
      await sleep(config.delay);
    }
  }

  return allCards.slice(0, limit);
}

/**
 * Phase 2: Download images from selected shot cards.
 * Supports parallel downloads, retry, and caching.
 */
export async function downloadShots(
  page: Page,
  shotCards: ShotCard[],
  opts: {
    prompt: string;
    format: ImageFormat;
    resolution: ImageResolution;
    quality: ImageQuality;
    maxRetries: number;
    concurrency: number;
    rateLimit: number;
    cacheEnabled: boolean;
  }
): Promise<DesignData[]> {
  const { prompt, format, resolution, quality, maxRetries, concurrency, rateLimit, cacheEnabled } = opts;

  const promptDir = prompt.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  const processOpts = { format, resolution, quality };

  // Initialize cache
  const cache = new DownloadCache();
  if (cacheEnabled) {
    cache.load();
  }

  const downloadedResults: DesignData[] = [];

  for (let i = 0; i < shotCards.length; i++) {
    const card = shotCards[i];
    const shotLabel = `Shot ${i + 1}/${shotCards.length}`;
    logger.info(`[${shotLabel}] Scraping: ${card.title}`);

    try {
      // Navigate to the shot page and extract all image URLs
      const imageUrls = await withRetry(
        () => scrapeShotPage(page, card.url),
        `scrape ${card.title}`,
        { maxRetries }
      );

      if (imageUrls.length === 0) {
        logger.warn(`[${shotLabel}] No images found on page, skipping.`);
        continue;
      }

      // Download all images with parallelism, retry, and caching
      const shotDir = `${promptDir}/shot_${i + 1}`;

      const downloadResults = await parallelMap(
        imageUrls,
        async (imgUrl, j) => {
          // Check cache first
          if (cacheEnabled && cache.has(imgUrl)) {
            const cachedPath = cache.get(imgUrl)!;
            logger.info(`  [Cached] Skipping image ${j + 1} — already downloaded`);
            return cachedPath;
          }

          const extMatch = imgUrl.match(/\.([a-zA-Z0-9]{2,5})(?:[?#]|$)/);
          const ext = extMatch ? extMatch[1] : 'jpg';
          const filename = `image_${j + 1}.${ext}`;

          const localPath = await withRetry(
            () => downloadImage(imgUrl, filename, shotDir, processOpts),
            `download ${filename}`,
            { maxRetries }
          );

          // Add to cache
          if (cacheEnabled) {
            cache.add(imgUrl, localPath);
          }

          logger.debug(`  Saved ${filename}`);
          return localPath;
        },
        concurrency,
        rateLimit
      );

      // Filter out nulls from failed downloads
      const localPaths = downloadResults.filter(Boolean) as string[];

      downloadedResults.push({
        title: card.title,
        designer: card.designer,
        url: card.url,
        imageUrls,
        localPaths,
      });

      logger.info(`[${shotLabel}] Downloaded ${localPaths.length}/${imageUrls.length} images`);
    } catch (e: any) {
      logger.error(`[${shotLabel}] Failed to scrape shot page: ${e.message}`);
    }

    // Delay between shot page navigations
    if (i < shotCards.length - 1) {
      await sleep(config.delay);
    }
  }

  // Save cache
  if (cacheEnabled) {
    cache.save();
  }

  return downloadedResults;
}

/**
 * Original API-compatible wrapper.
 * Used when not in selective mode (no --select flag).
 */
export async function scrapeDesigns(opts: ScrapeOptions) {
  const {
    prompt,
    limit = config.resultsLimit,
    format = config.format,
    resolution = config.resolution,
    quality = config.quality,
    maxRetries = config.maxRetries,
    concurrency = config.concurrency,
    rateLimit = config.rateLimit,
    cacheEnabled = config.cacheEnabled,
    color,
    timeframe,
    tag,
    pages = config.pages,
  } = opts;

  logger.info(`Starting scrape for prompt: "${prompt}" (limit: ${limit})`);
  logger.info(`Options — format: ${format}, resolution: ${resolution}, quality: ${quality}`);
  logger.info(`Performance — concurrency: ${concurrency}, retries: ${maxRetries}, rateLimit: ${rateLimit}ms, cache: ${cacheEnabled}`);
  if (color || timeframe || tag) {
    logger.info(`Filters — color: ${color || 'none'}, timeframe: ${timeframe || 'none'}, tag: ${tag || 'none'}`);
  }
  if (pages > 1) {
    logger.info(`Pagination — pages: ${pages}`);
  }

  const browser = await puppeteer.launch({
    headless: config.headless,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security']
  });

  try {
    const page = await browser.newPage();

    // Set a realistic user agent
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1280, height: 800 });

    // Phase 1: Discover
    const shotCards = await discoverShots(page, { prompt, limit, pages, color, timeframe, tag });

    logger.info(`Found ${shotCards.length} shot cards. Now downloading images...`);

    // Phase 2: Download
    const results = await downloadShots(page, shotCards, {
      prompt, format, resolution, quality,
      maxRetries, concurrency, rateLimit, cacheEnabled,
    });

    return results;
  } finally {
    await browser.close();
  }
}
