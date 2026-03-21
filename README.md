# 💎 Shotminer

[![NPM Version](https://img.shields.io/npm/v/shotminer?style=for-the-badge&logo=npm)](https://www.npmjs.com/package/shotminer)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg?style=for-the-badge)](https://opensource.org/licenses/ISC)

Shotminer is a powerful, developer-friendly **Dribbble Design Scraper CLI Tool**. It allows you to search and download high-quality UI/UX designs directly from your terminal using a highly aesthetic and modular setup built with Node.js, TypeScript, and Puppeteer.

## Features

- 🔍 **Automated Scraping:** Retrieve designs using just a search prompt.
- ⏬ **Bulk Downloading:** Downloads images sequentially to a well-organized folder structure constraint to your prompt.
- 🎨 **Beautiful CLI UX:** Utilizes interactive prompts and status spinners using Commander, Inquirer, and Ora.
- ⚡ **Puppeteer Engine:** Efficiently fetches data bypassing general restrictions.
- 🛠️ **Developer Friendly:** Completely typed, modular, and optimized for contribution.

## Pre-requisites

- Node.js (v18.x or above)
- NPM or Yarn

## Installation

### Via NPM (Recommended)
You can install the tool globally so that it's accessible anywhere on your computer:
```bash
npm install -g shotminer
```

### From Source
1. Clone the repository:
   ```bash
   git clone https://github.com/Gitnaseem745/shotminer.git
   cd shotminer
   ```
2. Install dependencies:
   ```bash
   npm install
   ```

## Setup

Create a `.env` file in the root of the project to configure the scraper (optional):
```env
# Disable or enable headless mode (default: false for true headless execution)
HEADLESS=true

# Limit how many pictures you want per command execution
RESULTS_LIMIT=10

# Destination folder name
DESIGNS_SUBDIR=designs
```

## Usage

### Global NPM Usage
If you installed the package via NPM (`npm i -g shotminer`), you can execute the CLI immediately from anywhere:
```bash
shotminer "dashboard UI" -l 5
```

If you prefer to run it dynamically without installing:
```bash
npx shotminer "dashboard UI" -l 5
```

### From Source

**Using Development Mode:**
```bash
npm run dev
```
Wait for the prompt and enter your search term (e.g., `mobile app UI design`).

**Compiled Usage:**
First build the TypeScript source:
```bash
npm run build
```

Then execute it via node:
```bash
npm start -- "dashboard UI" -l 5
```

Options:
- `-l, --limit <number>` : Limit the number of designs to fetch.
- `-h, --help` : Show help for command.

## Folder Structure

The application will construct a folder based on your prompt query. E.g., for `dashboard UI` it will yield the path:
`./designs/dashboard_ui/design_1.png`
