import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const config = {
  // Application configs
  headless: process.env.HEADLESS !== 'false', // default true
  resultsLimit: parseInt(process.env.RESULTS_LIMIT || '10', 10),
  designsSubdir: process.env.DESIGNS_SUBDIR || 'designs',
  
  // Computed paths
  outputDir: path.resolve(process.cwd(), process.env.DESIGNS_SUBDIR || 'designs'),
};
