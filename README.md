# 💎 Shotminer

[![NPM Version](https://img.shields.io/npm/v/shotminer?style=for-the-badge&logo=npm)](https://www.npmjs.com/package/shotminer)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg?style=for-the-badge)](https://opensource.org/licenses/ISC)

Shotminer is a powerful, developer-friendly **Dribbble Design Scraper CLI Tool**. It allows you to search and download high-quality UI/UX designs directly from your terminal using a highly aesthetic and modular setup built with Node.js, TypeScript, and Puppeteer.

## 🚀 Features (v1.2.0+)

- 🔍 **Deep Scraping:** Navigates into individual shot pages to extract **all available images**, not just the thumbnail.
- 🖼️ **Asset Controls:** CLI flags to control output format, resolution, and quality.
- ⚡ **Sharp Integration:** High-performance image processing for fast conversions and resizing.
- ⏬ **Multi-Image Support:** Downloads images sequentially to organized per-shot subfolders.
- 🎨 **Beautiful CLI UX:** Interactive prompts, loaders, and real-time processing status.
- 🖱️ **Interactive Multi-Select:** Optionally choose exactly which designs to download from the search results.
- 📦 **Batch Scraping:** Supply multiple search prompts at once for automated sequential downloading.
- 🛡️ **Resilience & Performance:** Built-in automatic retries for failed downloads, parallel downloading, and rate limiting.
- 🗄️ **Smart Caching:** Avoids re-downloading the same designs with local caching and deduplication.
- 🎯 **Advanced Filtering:** Filter search results by specific hex colors, timeframes, or Dribbble tags.
- 📄 **Pagination:** Scrape multiple pages of search results to discover more designs.
- 🛠️ **Developer Friendly:** Completely typed, modular, and optimized for contribution.

## Pre-requisites

- Node.js (v18.x or above)
- NPM or Yarn

## Installation

### Via NPM (Recommended)
You can install the tool globally:
```bash
npm install -g shotminer
```

## Usage

### Global NPM Usage
Execute the CLI from anywhere:
```bash
shotminer "dashboard UI" -l 5 -f png -r 4k -q high
```

### Options:
- `-l, --limit <number>` : Limit the number of shots to fetch (Default: `10`).
- `-f, --format <format>` : Image format: `original`, `png`, `jpg`, or `webp` (Default: `original`).
- `-r, --resolution <res>` : Resolution: `original`, `1080p`, or `4k` (Default: `original`).
- `-q, --quality <level>` : Compression quality: `high`, `medium`, or `low` (Default: `high`).
- `-s, --select` : Interactive multi-select: manually choose which discovered shots to download.
- `--batch <prompts>` : Comma-separated list of search prompts for batch scraping.
- `--retries <n>` : Max retry attempts for failed downloads (Default: `3`).
- `--concurrency <n>` : Max parallel downloads (Default: `3`).
- `--rate-limit <ms>` : Delay between requests in ms to avoid rate limits (Default: `1000`).
- `--no-cache` : Disable download cache/deduplication.
- `--color <color>` : Filter by hex color code (e.g., `ff0000`).
- `--timeframe <tf>` : Filter by timeframe: `week`, `month`, `year`, `ever`.
- `--tag <tag>` : Filter by Dribbble tag.
- `--pages <n>` : Number of search result pages to scrape (Default: `1`).
- `-h, --help` : Show help for command.

---

## 📂 Folder Structure

The application organizes downloads into a structured hierarchy based on your query and individual shot titles:

```text
designs/
└── dashboard_ui/
    ├── shot_title_1/
    │   ├── image_1.png
    │   └── image_2.png
    └── shot_title_2/
        └── image_1.png
```

## Setup (Optional)

Create a `.env` file in the root of the project to configure defaults:
```env
# Disable or enable headless mode (default: true)
HEADLESS=true

# Limit how many pictures you want per command execution
RESULTS_LIMIT=10

# Destination folder name
DESIGNS_SUBDIR=designs
```

