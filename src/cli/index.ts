import { Command } from 'commander';
import inquirer from 'inquirer';
import ora from 'ora';
import { scrapeDesigns } from '../scraper/index.js';
import { logger } from '../utils/logger.js';

export async function runCLI() {
  const program = new Command();

  program
    .name('shotminer')
    .description('Dribbble Design Scraper CLI Tool')
    .version('1.0.0')
    .argument('[prompt]', 'Search prompt to scrape')
    .option('-l, --limit <number>', 'Number of results to scrape', '10')
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

  console.log(); // Add empty line
  const spinner = ora(`Scraping designs for "${prompt}"...`).start();

  try {
    const results = await scrapeDesigns({ prompt, limit });
    spinner.succeed(`Successfully scraped ${results.length} designs!`);
    
    console.log('\n--- Results ---');
    results.forEach((res, i) => {
      console.log(`${i + 1}. [${res.designer}] ${res.title}`);
      console.log(`   URL: ${res.url}`);
      console.log(`   Saved to: ${res.localPath}\n`);
    });
  } catch (error: any) {
    spinner.fail(`Scraping failed: ${error.message}`);
    logger.error(error);
    process.exit(1);
  }
}
