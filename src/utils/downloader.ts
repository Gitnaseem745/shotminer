import fs from 'fs';
import path from 'path';
import { logger } from './logger.js';
import { config } from '../config/index.js';
import { processImage, type ProcessImageOptions } from './converter.js';

/**
 * Downloads an image from a URL and saves it to the output directory.
 * Optionally processes it (format conversion, resize, quality).
 * @param url The image URL
 * @param filename The desired filename
 * @param subDir Subdirectory path relative to the output dir (e.g., "prompt/shot_1")
 * @param processOpts Optional image processing options
 * @returns The final local file path
 */
export async function downloadImage(
  url: string,
  filename: string,
  subDir: string,
  processOpts?: ProcessImageOptions
): Promise<string> {
  const dirPath = path.join(config.outputDir, subDir);

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

    // Wait for the file stream to finish before processing
    await new Promise<void>((resolve, reject) => {
      fileStream.on('finish', resolve);
      fileStream.on('error', reject);
    });

    // Post-process if options provided
    if (processOpts) {
      const finalPath = await processImage(filePath, processOpts);
      return finalPath;
    }

    return filePath;
  } catch (error: any) {
    logger.error(`Error downloading image ${filename}: ${error.message}`);
    throw error;
  }
}
