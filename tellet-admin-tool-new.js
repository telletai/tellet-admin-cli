#!/usr/bin/env node

/**
 * Tellet Admin Tool - New modular version
 * 
 * This is the new entry point that uses the modular architecture.
 * It simply delegates to the CLI module.
 */

// Load environment variables
try {
  require('dotenv').config();
} catch (error) {
  // dotenv is optional
}

// Run the CLI
require('./lib/cli').run();