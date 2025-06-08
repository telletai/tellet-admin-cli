/**
 * @fileoverview Update metadata command handler for Tellet Admin CLI.
 * Updates metadata for multiple conversations in bulk.
 * 
 * @module lib/commands/update-metadata
 */

const fs = require('fs');
const csv = require('csv-parse');
const chalk = require('chalk');
const ora = require('ora');
const { requireAuth } = require('../auth');
const { logger, ProgressTracker } = require('../logger');
const { validateOptions } = require('../validation');
const { selectProjectWithMethod } = require('../../selection-helper');

/**
 * Options schema for the update-metadata command
 * @private
 */
const optionsSchema = {
  project: { type: 'string' },
  workspace: { type: 'string' },
  organization: { type: 'string' },
  csv: { type: 'string', required: true },
  dryRun: { type: 'boolean', default: false },
  continueOnError: { type: 'boolean', default: false },
  quickSelect: { type: 'boolean', default: false }
};

/**
 * Update metadata for conversations in bulk from a CSV file.
 * CSV must have conversation_id column and any metadata fields to update.
 * 
 * @param {Object} options - Command options with authenticated API client
 * @returns {Promise<void>}
 * @private
 */
async function updateMetadataHandler(options) {
  const spinner = ora();
  
  try {
    const api = options.api;
    const validatedOptions = validateOptions(options, optionsSchema);
    
    // Select project
    let projectId = validatedOptions.project;
    if (!projectId) {
      projectId = await selectProjectWithMethod(
        api,
        validatedOptions.organization,
        validatedOptions.workspace,
        'metadata update',
        validatedOptions.quickSelect
      );
      if (!projectId) return;
    }
    
    // Read and parse CSV file
    spinner.start('Reading CSV file...');
    const csvContent = await fs.promises.readFile(validatedOptions.csv, 'utf8');
    
    const records = await new Promise((resolve, reject) => {
      csv.parse(csvContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true
      }, (err, data) => {
        if (err) reject(err);
        else resolve(data);
      });
    });
    
    spinner.succeed(`Loaded ${records.length} records from CSV`);
    
    if (records.length === 0) {
      logger.warn('No records found in CSV file');
      return;
    }
    
    // Validate CSV structure
    if (!records[0].conversation_id) {
      throw new Error('CSV must have a "conversation_id" column');
    }
    
    // Extract metadata fields (all columns except conversation_id)
    const metadataFields = Object.keys(records[0]).filter(key => key !== 'conversation_id');
    
    if (metadataFields.length === 0) {
      throw new Error('No metadata fields found in CSV (only conversation_id column exists)');
    }
    
    logger.info(`Metadata fields to update: ${metadataFields.join(', ')}`);
    
    // Dry run mode
    if (validatedOptions.dryRun) {
      logger.warn('DRY RUN MODE - No changes will be made');
      logger.info('\nSample updates:');
      records.slice(0, 3).forEach(record => {
        logger.info(`Conversation ${record.conversation_id}:`);
        metadataFields.forEach(field => {
          logger.info(`  ${field}: ${record[field]}`);
        });
      });
      return;
    }
    
    // Update metadata for each conversation
    const progress = new ProgressTracker(records.length, 'Updating metadata');
    const results = { success: 0, failed: 0, notFound: 0 };
    
    for (const record of records) {
      try {
        // Build metadata object
        const metadata = {};
        metadataFields.forEach(field => {
          if (record[field] !== '') {
            metadata[field] = record[field];
          }
        });
        
        // Update conversation
        await api.put(`/analyzer/conversations/${record.conversation_id}`, {
          metadata
        });
        
        results.success++;
        logger.debug(`Updated conversation ${record.conversation_id}`);
        
      } catch (error) {
        if (error.statusCode === 404) {
          results.notFound++;
          logger.debug(`Conversation not found: ${record.conversation_id}`);
        } else {
          results.failed++;
          logger.debug(`Failed to update ${record.conversation_id}: ${error.message}`);
        }
        
        if (!validatedOptions.continueOnError) {
          progress.finish();
          throw error;
        }
      }
      
      progress.increment();
    }
    
    progress.finish('Metadata update complete');
    
    // Display results
    logger.section('Update Summary');
    logger.info(`✅ Updated: ${chalk.green(results.success)} conversations`);
    if (results.notFound > 0) {
      logger.info(`⚠️  Not found: ${chalk.yellow(results.notFound)} conversations`);
    }
    if (results.failed > 0) {
      logger.info(`❌ Failed: ${chalk.red(results.failed)} conversations`);
    }
    
  } catch (error) {
    spinner.fail('Metadata update failed');
    throw error;
  }
}

/**
 * Register the update-metadata command with the CLI program.
 * 
 * @param {Command} program - Commander program instance
 * @returns {void}
 * @example
 * const { Command } = require('commander');
 * const program = new Command();
 * registerUpdateMetadataCommand(program);
 */
function registerUpdateMetadataCommand(program) {
  program
    .command('update-metadata')
    .description('Update conversation metadata in bulk from CSV')
    .option('-p, --project <id>', 'Project ID')
    .option('-w, --workspace <id>', 'Workspace ID for project selection')
    .option('-g, --organization <id>', 'Organization ID for workspace selection')
    .option('-f, --csv <file>', 'CSV file with metadata updates (required)')
    .option('--dry-run', 'Preview changes without updating')
    .option('--continue-on-error', 'Continue processing if errors occur')
    .option('-q, --quick-select', 'Use quick selection mode')
    .action(requireAuth(updateMetadataHandler));
}

module.exports = {
  registerUpdateMetadataCommand,
  updateMetadataHandler
};