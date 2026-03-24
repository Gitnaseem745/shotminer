# 💎 Shotminer

[![NPM Version](https://img.shields.io/npm/v/shotminer?style=for-the-badge&logo=npm)](https://www.npmjs.com/package/shotminer)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg?style=for-the-badge)](https://opensource.org/licenses/ISC)

Shotminer is a powerful, developer-friendly **Dribbble Design Scraper CLI Tool**. It allows you to search and download high-quality UI/UX designs directly from your terminal using a highly aesthetic and modular setup built with Node.js, TypeScript, and Puppeteer.

## 🚀 Features (v1.1.0+)

- 🔍 **Deep Scraping:** Navigates into individual shot pages to extract **all available images**, not just the thumbnail.
- 🖼️ **Asset Controls:** New CLI flags to control output format, resolution, and quality.
- ⚡ **Sharp Integration:** High-performance image processing for fast conversions and resizing.
- ⏬ **Multi-Image Support:** Downloads images sequentially to organized per-shot subfolders.
- 🎨 **Beautiful CLI UX:** Enhanced output showing real-time processing status and image counts.
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
- `-l, --limit <number>` : Limit the number of shots to fetch.
- `-f, --format <format>` : Image format: `png`, `jpg`, or `webp` (Default: `webp`).
- `-r, --resolution <res>` : Resolution: `original`, `1080p`, or `4k` (Default: `original`).
- `-q, --quality <level>` : Compression quality: `high`, `medium`, or `low` (Default: `high`).
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

