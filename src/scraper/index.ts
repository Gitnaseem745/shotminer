import puppeteer from 'puppeteer';
import type { Page } from 'puppeteer';
import { config, type ImageFormat, type ImageResolution, type ImageQuality } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { downloadImage } from '../utils/downloader.js';

export interface ScrapeOptions {
  prompt: string;
  limit?: number;
  format?: ImageFormat;
  resolution?: ImageResolution;
  quality?: ImageQuality;
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

export async function scrapeDesigns({
  prompt,
  limit = config.resultsLimit,
  format = config.format,
  resolution = config.resolution,
  quality = config.quality,
}: ScrapeOptions) {
  logger.info(`Starting scrape for prompt: "${prompt}" (limit: ${limit})`);
  logger.info(`Options — format: ${format}, resolution: ${resolution}, quality: ${quality}`);

  const browser = await puppeteer.launch({
    headless: config.headless,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security']
  });

  try {
    const page = await browser.newPage();

    // Set a realistic user agent
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1280, height: 800 });

    // --- Step 1: Get shot URLs from search page ---
    const searchUrl = `https://dribbble.com/search/${encodeURIComponent(prompt)}`;
    logger.debug(`Navigating to ${searchUrl}`);

    await page.goto(searchUrl, { waitUntil: 'networkidle2' });

    await page.waitForSelector('.shot-thumbnail', { timeout: 15000 }).catch(() => {
      logger.warn('Could not find shots grid. Dribbble might have blocked the request or UI changed.');
    });

    // Extract shot card links and metadata
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
    }, limit);

    logger.info(`Found ${shotCards.length} shot cards. Now visiting each shot page to extract all images...`);

    // --- Step 2: Visit each shot page and extract all images ---
    const promptDir = prompt.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const processOpts = { format, resolution, quality };
    const downloadedResults: DesignData[] = [];

    for (let i = 0; i < shotCards.length; i++) {
      const card = shotCards[i];
      const shotLabel = `Shot ${i + 1}/${shotCards.length}`;
      logger.info(`[${shotLabel}] Scraping: ${card.title}`);

      try {
        // Navigate to the shot page and extract all image URLs
        const imageUrls = await scrapeShotPage(page, card.url);

        if (imageUrls.length === 0) {
          logger.warn(`[${shotLabel}] No images found on page, skipping.`);
          continue;
        }

        // Download all images into a per-shot subfolder
        const shotDir = `${promptDir}/shot_${i + 1}`;
        const localPaths: string[] = [];

        for (let j = 0; j < imageUrls.length; j++) {
          try {
            const imgUrl = imageUrls[j];
            const extMatch = imgUrl.match(/\.([a-zA-Z0-9]{2,5})(?:[?#]|$)/);
            const ext = extMatch ? extMatch[1] : 'jpg';
            const filename = `image_${j + 1}.${ext}`;

            const localPath = await downloadImage(imgUrl, filename, shotDir, processOpts);
            localPaths.push(localPath);
            logger.debug(`  Saved ${filename}`);
          } catch (e: any) {
            logger.error(`  Failed to download image ${j + 1}: ${e.message}`);
          }
        }

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

      // Delay between shot page navigations to be respectful
      if (i < shotCards.length - 1) {
        await sleep(config.delay);
      }
    }

    return downloadedResults;
  } finally {
    await browser.close();
  }
}
