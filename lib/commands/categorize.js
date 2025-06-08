/**
 * @fileoverview Auto-categorization command handler for Tellet Admin CLI.
 * Processes project questions and automatically assigns categories using AI.
 * 
 * @module lib/commands/categorize
 */

const { requireAuth } = require('../auth');
const { validateOptions, commonSchemas } = require('../validation');
const { logger, ProgressTracker } = require('../logger');
const { ErrorHandler } = require('../errors');

// Import the existing categorization logic
const { processProject } = require('../../auto-categorize-logic');

/**
 * Command options schema for validation.
 * Defines all supported options and their validation rules.
 * 
 * @type {Object}
 * @private
 */
const optionsSchema = {
  project: { type: 'objectId', required: true },
  delay: { type: 'int', min: 0, max: 600000, default: 1000 },
  dryRun: { type: 'boolean', default: false },
  verbose: { type: 'boolean', default: false },
  skipRun: { type: 'boolean', default: false },
  continueOnError: { type: 'boolean', default: false }
};

/**
 * Auto-categorize command handler.
 * Processes a project's questions and assigns categories using AI analysis.
 * 
 * @param {Object} options - Command options
 * @param {string} options.project - Project ID (MongoDB ObjectId)
 * @param {number} [options.delay=1000] - Delay between API calls in milliseconds
 * @param {boolean} [options.dryRun=false] - Preview mode without making changes
 * @param {boolean} [options.verbose=false] - Show detailed output
 * @param {boolean} [options.skipRun=false] - Generate categories but don't run categorization
 * @param {boolean} [options.continueOnError=false] - Continue processing on errors
 * @param {Object} context - Command context
 * @param {AxiosInstance} context.api - Authenticated API client
 * @returns {Promise<Object>} Categorization results
 * @throws {Error} If validation fails or categorization errors occur
 * @example
 * // Run categorization
 * await categorizeHandler(
 *   { project: '507f1f77bcf86cd799439011', dryRun: true },
 *   { api: authenticatedClient }
 * );
 */
async function categorizeHandler(options, context) {
  try {
    // Validate options
    const validated = validateOptions(options, optionsSchema);
    
    logger.header('Auto-Categorization');
    logger.info(`Project ID: ${validated.project}`);
    
    if (validated.dryRun) {
      logger.warn('DRY RUN MODE - No changes will be made');
    }
    
    // Process the project
    const result = await processProject(context.api, validated.project, {
      dryRun: validated.dryRun,
      verbose: validated.verbose,
      skipRun: validated.skipRun,
      delay: validated.delay,
      continueOnError: validated.continueOnError
    });
    
    logger.separator();
    logger.success('Auto-categorization completed successfully');
    
    return result;
  } catch (error) {
    ErrorHandler.handle(error, { operation: 'categorize', exit: false });
    throw error;
  }
}

/**
 * Register the categorize command with the CLI program.
 * Adds the 'categorize' command with all its options and aliases.
 * 
 * @param {Command} program - Commander program instance
 * @example
 * const program = new Command();
 * registerCategorizeCommand(program);
 * 
 * // Usage:
 * // tellet-admin categorize -p 507f1f77bcf86cd799439011 --dry-run
 * // tellet-admin auto-categorize -p PROJECT_ID -v --delay 2000
 */
function registerCategorizeCommand(program) {
  program
    .command('categorize')
    .alias('auto-categorize')
    .description('Auto-categorize questions without existing categories using AI')
    .requiredOption('-p, --project <id>', 'Project ID (24-character MongoDB ObjectId)')
    .option('-d, --dry-run', 'Preview categorization without making changes')
    .option('-v, --verbose', 'Show detailed output')
    .option('--skip-run', 'Generate categories but do not run categorization')
    .option('--delay <ms>', 'Delay between API calls in milliseconds', '1000')
    .option('--continue-on-error', 'Continue processing even if errors occur')
    .option('-u, --url <url>', 'API base URL')
    .action(requireAuth(categorizeHandler));
}

module.exports = {
  categorizeHandler,
  registerCategorizeCommand
};