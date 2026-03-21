import puppeteer from 'puppeteer';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { downloadImage } from '../utils/downloader.js';

export interface ScrapeOptions {
  prompt: string;
  limit?: number;
}

export interface DesignData {
  title: string;
  designer: string;
  url: string;
  imageUrl: string;
  metadata?: any;
}

export async function scrapeDesigns({ prompt, limit = config.resultsLimit }: ScrapeOptions) {
  logger.info(`Starting scrape for prompt: "${prompt}" (limit: ${limit})`);
  
  const browser = await puppeteer.launch({
    headless: config.headless,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security']
  });

  try {
    const page = await browser.newPage();
    
    // Set a realistic user agent
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1280, height: 800 });

    const searchUrl = `https://dribbble.com/search/${encodeURIComponent(prompt)}`;
    logger.debug(`Navigating to ${searchUrl}`);
    
    await page.goto(searchUrl, { waitUntil: 'networkidle2' });

    // Wait for the results grid to load
    await page.waitForSelector('.shot-thumbnail', { timeout: 15000 }).catch(() => {
      logger.warn('Could not find shots grid. Dribbble might have blocked the request or UI changed.');
    });

    // We will evaluate the page to extract data
    const extractedData = await page.evaluate((maxLimit) => {
      const shots = document.querySelectorAll('.shot-thumbnail');
      const results: DesignData[] = [];

      for (let i = 0; i < shots.length; i++) {
        if (results.length >= maxLimit) break;

        const shot = shots[i];
        
        // Find the image element inside the shot
        const imgEl = shot.querySelector('figure img');
        let imageUrl = imgEl?.getAttribute('data-src') || imgEl?.getAttribute('src') || '';
        
        // Often Dribbble serves a low-res image. The high-res or video could be in a data-attr
        // Look for better resolutions if available
        const srcset = imgEl?.getAttribute('srcset') || '';
        if (srcset) {
             const sources = srcset.split(',').map(s => s.trim().split(' '));
             // Naive approach: take the last one which is usually highest res
             imageUrl = sources[sources.length - 1]?.[0] || imageUrl;
        } else if (imageUrl.includes('compress')) {
             imageUrl = imageUrl.replace(/(compress=1&|resize=\d+x\d+)/g, ''); // Try to clean up URL
        }

        if (imageUrl.startsWith('data:')) {
             const videoEl = shot.querySelector('video source');
             if (videoEl) {
                 imageUrl = videoEl.getAttribute('src') || imageUrl;
             }
        }

        const titleEl = shot.querySelector('.shot-title');
        const title = titleEl?.textContent?.trim() || `Design ${i+1}`;

        const designerEl = shot.querySelector('.display-name');
        const designer = designerEl?.textContent?.trim() || 'Unknown';

        const linkEl = shot.querySelector('.dribbble-link');
        const url = linkEl ? `https://dribbble.com${linkEl.getAttribute('href')}` : '';

        if (imageUrl && !imageUrl.startsWith('data:')) {
          results.push({
            title,
            designer,
            url,
            imageUrl
          });
        }
      }

      return results;
    }, limit);

    logger.info(`Extracted ${extractedData.length} designs. Starting downloads...`);

    const downloadedResults = [];

    // Download images locally
    for (let i = 0; i < extractedData.length; i++) {
        const item = extractedData[i];
        try {
           const extMatch = item.imageUrl.match(/\\.([a-zA-Z0-9]{2,5})(?:[\\?#]|$)/);
           const ext = extMatch ? extMatch[1] : 'jpg';
           const filename = `design_${i + 1}.${ext}`;
           const localPath = await downloadImage(item.imageUrl, filename, prompt);
           downloadedResults.push({
             ...item,
             localPath
           });
           logger.debug(`Saved ${filename}`);
        } catch (e: any) {
           logger.error(`Failed to save ${item.imageUrl}: ${e.message}`);
        }
    }

    return downloadedResults;
  } finally {
    await browser.close();
  }
}
