import { Command } from 'commander';
import inquirer from 'inquirer';
import ora from 'ora';
import { scrapeDesigns } from '../scraper/index.js';
import { logger } from '../utils/logger.js';
import type { ImageFormat, ImageResolution, ImageQuality } from '../config/index.js';

export async function runCLI() {
  const program = new Command();

  program
    .name('shotminer')
    .description('Dribbble Design Scraper CLI Tool')
    .version('1.0.0')
    .argument('[prompt]', 'Search prompt to scrape')
    .option('-l, --limit <number>', 'Number of shots to scrape', '10')
    .option('-f, --format <format>', 'Image format: original, png, jpg, webp', 'original')
    .option('-r, --resolution <res>', 'Resolution: original, 1080p, 4k', 'original')
    .option('-q, --quality <quality>', 'Quality: high, medium, low', 'high')
    .parse(process.argv);

  const options = program.opts();
  let args = program.args;

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

  const limit = parseInt(options.limit, 10);
  const format = options.format as ImageFormat;
  const resolution = options.resolution as ImageResolution;
  const quality = options.quality as ImageQuality;

  console.log(); // Add empty line
  const spinner = ora(`Scraping designs for "${prompt}"...`).start();

  try {
    const results = await scrapeDesigns({ prompt, limit, format, resolution, quality });
    spinner.succeed(`Successfully scraped ${results.length} shots!`);

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
  } catch (error: any) {
    spinner.fail(`Scraping failed: ${error.message}`);
    logger.error(error);
    process.exit(1);
  }
}
