/**
 * @fileoverview Export overview command handler for Tellet Admin CLI.
 * Exports conversation overview data in CSV format with metadata and statistics.
 * 
 * @module lib/commands/export-overview
 */

const chalk = require('chalk');
const ora = require('ora');
const path = require('path');
const { requireAuth } = require('../auth');
const { logger } = require('../logger');
const { validateOptions } = require('../validation');
const { ensureDirectoryExists } = require('../utils/file-utils');
const { selectProjectWithMethod } = require('../../selection-helper');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

/**
 * Options schema for the export-overview command
 * @private
 */
const optionsSchema = {
  project: { type: 'string' },
  workspace: { type: 'string' }, 
  organization: { type: 'string' },
  output: { type: 'string', default: './exports' },
  status: { type: 'enum', enum: ['all', 'in_progress', 'done', 'digested'], default: 'all' },
  fromDate: { type: 'date' },
  toDate: { type: 'date' },
  quickSelect: { type: 'boolean', default: false }
};

/**
 * Export conversation overview with metadata to CSV file.
 * Includes participant counts, status, dates, and custom metadata fields.
 * 
 * @param {Object} options - Command options with authenticated API client
 * @returns {Promise<void>}
 * @private
 */
async function exportOverviewHandler(options) {
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
        'overview export',
        validatedOptions.quickSelect
      );
      if (!projectId) return;
    }
    
    // Fetch project details
    spinner.start('Fetching project details...');
    let project;
    try {
      project = await api.get(`/analyzer/projects/${projectId}`);
    } catch (error) {
      // Fallback to just using the project ID if endpoint doesn't exist
      project = { _id: projectId, title: projectId };
    }
    spinner.succeed(`Project: ${project.title || projectId}`);
    
    // Fetch conversations
    spinner.start('Fetching conversations...');
    const params = {
      project_id: projectId,
      status: validatedOptions.status || 'all'
    };
    
    if (validatedOptions.fromDate) {
      params.from_date = validatedOptions.fromDate.toISOString();
    }
    if (validatedOptions.toDate) {
      params.to_date = validatedOptions.toDate.toISOString();
    }
    
    const conversations = await api.get(`/analyzer/results/${projectId}/conversations`, { params });
    spinner.succeed(`Found ${conversations.length} conversations`);
    
    if (conversations.length === 0) {
      logger.warn('No conversations found matching criteria');
      return;
    }
    
    // Prepare output
    await ensureDirectoryExists(validatedOptions.output);
    const dateStr = new Date().toISOString().split('T')[0];
    const statusStr = validatedOptions.status || 'all';
    const filename = `conversation_overview_${projectId}_${statusStr}_${dateStr}.csv`;
    const filepath = path.join(validatedOptions.output, filename);
    
    // Extract all metadata keys
    const metadataKeys = new Set();
    conversations.forEach(conv => {
      if (conv.metadata) {
        Object.keys(conv.metadata).forEach(key => metadataKeys.add(key));
      }
    });
    
    // Prepare CSV headers
    const headers = [
      { id: 'conversation_id', title: 'Conversation ID' },
      { id: 'status', title: 'Status' },
      { id: 'created_at', title: 'Created At' },
      { id: 'updated_at', title: 'Updated At' },
      { id: 'participant_count', title: 'Participants' },
      { id: 'message_count', title: 'Messages' },
      { id: 'duration_seconds', title: 'Duration (seconds)' },
      { id: 'digest_preview', title: 'Digest Preview' }
    ];
    
    // Add metadata headers
    metadataKeys.forEach(key => {
      headers.push({ 
        id: `metadata_${key}`, 
        title: `Metadata: ${key}` 
      });
    });
    
    // Create CSV writer
    const csvWriter = createCsvWriter({
      path: filepath,
      header: headers
    });
    
    // Prepare all records
    spinner.start('Writing CSV file...');
    const records = conversations.map(conv => {
      const record = {
        conversation_id: conv._id,
        status: conv.status,
        created_at: new Date(conv.createdAt).toISOString(),
        updated_at: new Date(conv.updatedAt).toISOString(),
        participant_count: conv.participants?.length || 0,
        message_count: conv.messages?.length || 0,
        duration_seconds: conv.duration || 0,
        digest_preview: conv.digest ? String(conv.digest).substring(0, 100) + '...' : ''
      };
      
      // Add metadata fields
      metadataKeys.forEach(key => {
        record[`metadata_${key}`] = conv.metadata?.[key] || '';
      });
      
      return record;
    });
    
    // Write all records at once
    await csvWriter.writeRecords(records);
    
    spinner.succeed(`Exported ${conversations.length} conversations to ${filename}`);
    logger.info(`Full path: ${filepath}`);
    
  } catch (error) {
    spinner.fail('Export failed');
    throw error;
  }
}

/**
 * Register the export-overview command with the CLI program.
 * 
 * @param {Command} program - Commander program instance
 * @returns {void}
 * @example
 * const { Command } = require('commander');
 * const program = new Command();
 * registerExportOverviewCommand(program);
 */
function registerExportOverviewCommand(program) {
  program
    .command('export-overview')
    .description('Export conversation overview with metadata to CSV')
    .option('-p, --project <id>', 'Project ID')
    .option('-w, --workspace <id>', 'Workspace ID for project selection')
    .option('-g, --organization <id>', 'Organization ID for workspace selection')
    .option('-o, --output <path>', 'Output directory', './exports')
    .option('-s, --status <status>', 'Filter by status (all, in_progress, done, digested)', 'all')
    .option('--from-date <date>', 'From date (YYYY-MM-DD)')
    .option('--to-date <date>', 'To date (YYYY-MM-DD)')
    .option('-q, --quick-select', 'Use quick selection mode')
    .action(requireAuth(exportOverviewHandler));
}

module.exports = {
  registerExportOverviewCommand,
  exportOverviewHandler
};