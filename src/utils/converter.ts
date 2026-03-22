import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import type { ImageFormat, ImageResolution, ImageQuality } from '../config/index.js';
import { logger } from './logger.js';

/** Quality maps for sharp compression */
const QUALITY_MAP: Record<ImageQuality, number> = {
  high: 95,
  medium: 75,
  low: 50,
};

/** Max dimension (longest side) for each resolution preset */
const RESOLUTION_MAP: Record<Exclude<ImageResolution, 'original'>, { width: number; height: number }> = {
  '1080p': { width: 1920, height: 1080 },
  '4k': { width: 3840, height: 2160 },
};

/** Format → sharp output format name */
const FORMAT_MAP: Record<Exclude<ImageFormat, 'original'>, keyof sharp.FormatEnum> = {
  png: 'png',
  jpg: 'jpeg',
  webp: 'webp',
};

export interface ProcessImageOptions {
  format?: ImageFormat;
  resolution?: ImageResolution;
  quality?: ImageQuality;
}

/**
 * Processes an image file in-place: converts format, resizes, and compresses.
 * Returns the final file path (extension may change if format was converted).
 */
export async function processImage(inputPath: string, opts: ProcessImageOptions): Promise<string> {
  const { format = 'original', resolution = 'original', quality = 'high' } = opts;

  // If everything is default, skip processing
  if (format === 'original' && resolution === 'original' && quality === 'high') {
    return inputPath;
  }

  try {
    let pipeline = sharp(inputPath);

    // --- Resize ---
    if (resolution !== 'original') {
      const maxDims = RESOLUTION_MAP[resolution];
      pipeline = pipeline.resize(maxDims.width, maxDims.height, {
        fit: 'inside',           // maintain aspect ratio, fit within box
        withoutEnlargement: true // don't upscale
      });
    }

    // --- Format & Quality ---
    const qualityValue = QUALITY_MAP[quality];

    if (format !== 'original') {
      const sharpFormat = FORMAT_MAP[format];
      pipeline = pipeline.toFormat(sharpFormat, { quality: qualityValue });
    } else if (quality !== 'high') {
      // Keep original format but apply quality
      // Detect format from file extension
      const ext = path.extname(inputPath).toLowerCase().replace('.', '');
      if (ext === 'jpg' || ext === 'jpeg') {
        pipeline = pipeline.jpeg({ quality: qualityValue });
      } else if (ext === 'png') {
        pipeline = pipeline.png({ quality: qualityValue });
      } else if (ext === 'webp') {
        pipeline = pipeline.webp({ quality: qualityValue });
      }
    }

    // Determine output path (extension may change)
    let outputPath = inputPath;
    if (format !== 'original') {
      const dir = path.dirname(inputPath);
      const basename = path.basename(inputPath, path.extname(inputPath));
      const newExt = format === 'jpg' ? 'jpg' : format;
      outputPath = path.join(dir, `${basename}.${newExt}`);
    }

    // Write to a temp file, then replace
    const tempPath = outputPath + '.tmp';
    await pipeline.toFile(tempPath);

    // Remove original if output path is different
    if (outputPath !== inputPath && fs.existsSync(inputPath)) {
      fs.unlinkSync(inputPath);
    }

    // Rename temp to final
    fs.renameSync(tempPath, outputPath);

    logger.debug(`Processed image: ${path.basename(outputPath)} (format=${format}, res=${resolution}, quality=${quality})`);
    return outputPath;
  } catch (error: any) {
    logger.error(`Image processing failed for ${path.basename(inputPath)}: ${error.message}`);
    // Return original path on failure — the raw download is still usable
    return inputPath;
  }
}
