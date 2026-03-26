import { Command } from 'commander';
import inquirer from 'inquirer';
import ora from 'ora';
import puppeteer from 'puppeteer';
import { scrapeDesigns, discoverShots, downloadShots, type ScrapeOptions } from '../scraper/index.js';
import { selectShots } from './selector.js';
import { logger } from '../utils/logger.js';
import { config, type ImageFormat, type ImageResolution, type ImageQuality, type Timeframe } from '../config/index.js';

/**
 * Runs a single prompt scrape (standard or selective mode).
 */
async function runSinglePrompt(prompt: string, options: any): Promise<void> {
  const limit = parseInt(options.limit, 10);
  const format = options.format as ImageFormat;
  const resolution = options.resolution as ImageResolution;
  const quality = options.quality as ImageQuality;
  const maxRetries = parseInt(options.retries, 10);
  const concurrency = parseInt(options.concurrency, 10);
  const rateLimit = parseInt(options.rateLimit, 10);
  const cacheEnabled = options.cache !== false;
  const pages = parseInt(options.pages, 10);
  const color = options.color as string | undefined;
  const timeframe = options.timeframe as Timeframe | undefined;
  const tag = options.tag as string | undefined;
  const selectMode = options.select === true;

  if (selectMode) {
    // --- Selective mode: discover first, let user pick, then download ---
    const discoverSpinner = ora(`Discovering shots for "${prompt}"...`).start();

    const browser = await puppeteer.launch({
      headless: config.headless,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security']
    });

    try {
      const page = await browser.newPage();
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      await page.setViewport({ width: 1280, height: 800 });

      const shotCards = await discoverShots(page, { prompt, limit, pages, color, timeframe, tag });
      discoverSpinner.succeed(`Found ${shotCards.length} shots.`);

      if (shotCards.length === 0) {
        console.log('\nNo shots found for this query.\n');
        return;
      }

      // Let user select which shots to download
      console.log();
      const selectedCards = await selectShots(shotCards);

      if (selectedCards.length === 0) {
        console.log('\nNo shots selected. Exiting.\n');
        return;
      }

      const downloadSpinner = ora(`Downloading ${selectedCards.length} selected shots...`).start();

      const results = await downloadShots(page, selectedCards, {
        prompt, format, resolution, quality,
        maxRetries, concurrency, rateLimit, cacheEnabled,
      });

      downloadSpinner.succeed(`Successfully downloaded ${results.length} shots!`);
      printResults(results);
    } finally {
      await browser.close();
    }
  } else {
    // --- Standard mode: discover + download all ---
    console.log();
    const spinner = ora(`Scraping designs for "${prompt}"...`).start();

    try {
      const results = await scrapeDesigns({
        prompt, limit, format, resolution, quality,
        maxRetries, concurrency, rateLimit, cacheEnabled,
        color, timeframe, tag, pages,
      });
      spinner.succeed(`Successfully scraped ${results.length} shots!`);
      printResults(results);
    } catch (error: any) {
      spinner.fail(`Scraping failed: ${error.message}`);
      logger.error(error);
      process.exit(1);
    }
  }
}

/**
 * Prints the results summary to the console.
 */
function printResults(results: { title: string; designer: string; url: string; localPaths: string[] }[]): void {
  console.log('\n--- Results ---');
  let totalImages = 0;
  results.forEach((res, i) => {
    const imgCount = res.localPaths.length;
    totalImages += imgCount;
    console.log(`\n${i + 1}. [${res.designer}] ${res.title}`);
    console.log(`   URL: ${res.url}`);
    console.log(`   Images: ${imgCount}`);
    res.localPaths.forEach((p, j) => {
      console.log(`     ${j + 1}. ${p}`);
    });
  });

  console.log(`\n--- Total: ${totalImages} images from ${results.length} shots ---\n`);
}

export async function runCLI() {
  const program = new Command();

  program
    .name('shotminer')
    .description('Dribbble Design Scraper CLI Tool')
    .version('1.1.1')
    .argument('[prompt]', 'Search prompt to scrape')
    // Core options
    .option('-l, --limit <number>', 'Number of shots to scrape', '10')
    .option('-f, --format <format>', 'Image format: original, png, jpg, webp', 'original')
    .option('-r, --resolution <res>', 'Resolution: original, 1080p, 4k', 'original')
    .option('-q, --quality <quality>', 'Quality: high, medium, low', 'high')
    // Download controls
    .option('-s, --select', 'Interactive multi-select: choose which shots to download')
    .option('--batch <prompts>', 'Comma-separated list of search prompts for batch scraping')
    // Resilience
    .option('--retries <n>', 'Max retry attempts for failed downloads', '3')
    // Performance
    .option('--concurrency <n>', 'Max parallel downloads', '3')
    .option('--rate-limit <ms>', 'Delay between requests in ms', '1000')
    .option('--no-cache', 'Disable download cache/deduplication')
    // Filtering & Pagination
    .option('--color <color>', 'Filter by hex color code (e.g., ff0000)')
    .option('--timeframe <tf>', 'Filter by timeframe: week, month, year, ever')
    .option('--tag <tag>', 'Filter by Dribbble tag')
    .option('--pages <n>', 'Number of search result pages to scrape', '1')
    .parse(process.argv);

  const options = program.opts();
  const args = program.args;

  // --- Batch Mode ---
  if (options.batch) {
    const prompts = (options.batch as string).split(',').map(p => p.trim()).filter(Boolean);

    if (prompts.length === 0) {
      console.error('Error: --batch requires at least one prompt (comma-separated).');
      process.exit(1);
    }

    console.log(`\n🔁 Batch mode: ${prompts.length} prompts\n`);

    for (let i = 0; i < prompts.length; i++) {
      console.log(`\n${'═'.repeat(50)}`);
      console.log(`📦 Batch ${i + 1}/${prompts.length}: "${prompts[i]}"`);
      console.log('═'.repeat(50));

      await runSinglePrompt(prompts[i], options);
    }

    console.log(`\n✅ Batch scraping complete! Processed ${prompts.length} prompts.\n`);
    return;
  }

  // --- Single Prompt Mode ---
  let prompt = args[0];

  if (!prompt) {
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'prompt',
        message: 'Enter a search prompt (e.g., "mobile app UI design"):',
        validate: (input) => input.trim() ? true : 'Prompt cannot be empty!',
      },
    ]);
    prompt = answers.prompt;
  }

  await runSinglePrompt(prompt, options);
}
