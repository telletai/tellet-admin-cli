#!/usr/bin/env node

/**
 * Tellet Admin Tool - Main entry point
 * 
 * This file serves as the main entry point for the Tellet Admin CLI.
 * It delegates all functionality to the modular CLI system in lib/cli.js
 */

// Load environment variables if available
try {
  require('dotenv').config();
} catch (error) {
  // dotenv is optional - not required for the tool to work
}

// Check Node.js version
const semver = require('semver');
const { engines } = require('./package.json');

if (!semver.satisfies(process.version, engines.node)) {
  console.error(`Error: This tool requires Node.js ${engines.node}`);
  console.error(`You are running Node.js ${process.version}`);
  process.exit(1);
}

// Run the CLI
require('./lib/cli').run();