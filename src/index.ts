#!/usr/bin/env node
import { runCLI } from './cli/index.js';

process.on('unhandledRejection', (err) => {
  console.error('Unhandled Promise Rejection:', err);
  process.exit(1);
});

runCLI().catch((err) => {
  console.error('Fatal Error:', err);
  process.exit(1);
});
