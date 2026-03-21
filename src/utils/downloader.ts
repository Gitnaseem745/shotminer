import fs from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';
import { logger } from './logger.js';
import { config } from '../config/index.js';

/**
 * Downloads an image from a URL and saves it to the output directory
 * @param url The image URL
 * @param filename The desired filename
 * @param prompt Dir name derived from the prompt
 */
export async function downloadImage(url: string, filename: string, prompt: string): Promise<string> {
  const dirPath = path.join(config.outputDir, prompt.replace(/[^a-z0-9]/gi, '_').toLowerCase());
  
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }

  const filePath = path.join(dirPath, filename);

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
    }

    if (!response.body) {
      throw new Error('No body in response');
    }

    // Convert Web ReadableStream to Node.js Readable
    const fileStream = fs.createWriteStream(filePath);
    const reader = response.body.getReader();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      fileStream.write(value);
    }
    fileStream.end();

    return filePath;
  } catch (error: any) {
    logger.error(`Error downloading image ${filename}: ${error.message}`);
    throw error;
  }
}
