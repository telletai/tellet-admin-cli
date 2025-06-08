/**
 * @fileoverview Export conversations command handler for Tellet Admin CLI.
 * Exports project conversation data to CSV or JSON format with metadata.
 * 
 * @module lib/commands/export-conversations
 */

const fs = require('fs').promises;
const path = require('path');
const { requireAuth } = require('../auth');
const { validateOptions } = require('../validation');
const { logger, ProgressTracker } = require('../logger');
const { ErrorHandler, FileSystemError } = require('../errors');
const { createExportDirectory, ensureDirectoryExists } = require('../utils/file-utils');

/**
 * Command options schema for validation.
 * Defines supported export options and their validation rules.
 * 
 * @type {Object}
 * @private
 */
const optionsSchema = {
  project: { type: 'objectId', required: true },
  outputDir: { type: 'string', default: './exports' },
  status: { type: 'string' },
  format: { type: 'enum', values: ['csv', 'json'], default: 'csv' }
};

/**
 * Export conversations command handler.
 * Fetches project conversations and exports them to the specified format.
 * 
 * @param {Object} options - Command options
 * @param {string} options.project - Project ID (MongoDB ObjectId)
 * @param {string} [options.outputDir='./exports'] - Output directory path
 * @param {string} [options.status] - Filter conversations by status
 * @param {string} [options.format='csv'] - Export format (csv or json)
 * @param {Object} context - Command context
 * @param {AxiosInstance} context.api - Authenticated API client
 * @returns {Promise<{count: number, outputFile: string}>} Export results
 * @throws {Error} If export fails or no conversations found
 * @example
 * const result = await exportConversationsHandler(
 *   { project: '507f1f77bcf86cd799439011', format: 'csv' },
 *   { api: authenticatedClient }
 * );
 * // Returns: { count: 150, outputFile: './exports/projectId/conversations_2024-01-15.csv' }
 */
async function exportConversationsHandler(options, context) {
  try {
    // Validate options
    const validated = validateOptions(options, optionsSchema);
    const { api } = context;
    
    logger.header('Export Conversations');
    logger.info(`Project ID: ${validated.project}`);
    
    // Get project details
    logger.progress('Fetching project details...');
    const projectResponse = await api.get(`/analyzer/results/${validated.project}/conversations`);
    const conversations = Array.isArray(projectResponse) ? projectResponse : projectResponse.data || [];
    
    if (conversations.length === 0) {
      logger.warn('No conversations found for this project');
      return;
    }
    
    logger.info(`Found ${conversations.length} conversations`);
    
    // Create export directory
    const exportPath = await createExportDirectory(validated.project, validated.outputDir, api);
    await ensureDirectoryExists(exportPath);
    
    // Export based on format
    const timestamp = new Date().toISOString().split('T')[0];
    let filename;
    
    if (validated.format === 'csv') {
      filename = `conversations_${validated.project}_${timestamp}.csv`;
      await exportToCSV(conversations, path.join(exportPath, filename));
    } else {
      filename = `conversations_${validated.project}_${timestamp}.json`;
      await exportToJSON(conversations, path.join(exportPath, filename));
    }
    
    logger.success(`Exported ${conversations.length} conversations to ${path.join(exportPath, filename)}`);
    
    return {
      count: conversations.length,
      outputFile: path.join(exportPath, filename)
    };
  } catch (error) {
    ErrorHandler.handle(error, { operation: 'export-conversations', exit: false });
    throw error;
  }
}

/**
 * Export conversations to CSV format.
 * Flattens conversation messages into individual rows with metadata.
 * 
 * @param {Array<Object>} conversations - Array of conversation objects
 * @param {string} outputPath - Full path to output CSV file
 * @returns {Promise<void>}
 * @throws {FileSystemError} If unable to write file
 * @private
 * @example
 * await exportToCSV(conversations, '/path/to/output.csv');
 */
async function exportToCSV(conversations, outputPath) {
  const createCsvWriter = require('csv-writer').createObjectCsvWriter;
  const tracker = new ProgressTracker(conversations.length, { logger });
  
  // Flatten conversation messages
  const rows = [];
  for (const conversation of conversations) {
    const messages = conversation.messages || [];
    for (const message of messages) {
      rows.push({
        conversation_id: conversation._id,
        message_id: message._id,
        text: message.text,
        role: message.role,
        created_at: message.created_at || message.createdAt,
        status: conversation.status,
        duration: conversation.duration,
        language: conversation.metadata?.language || '',
        participant_id: conversation.metadata?.participant_id || ''
      });
    }
    tracker.increment();
  }
  
  // Write CSV
  const csvWriter = createCsvWriter({
    path: outputPath,
    header: [
      { id: 'conversation_id', title: 'Conversation ID' },
      { id: 'message_id', title: 'Message ID' },
      { id: 'text', title: 'Text' },
      { id: 'role', title: 'Role' },
      { id: 'created_at', title: 'Created At' },
      { id: 'status', title: 'Status' },
      { id: 'duration', title: 'Duration' },
      { id: 'language', title: 'Language' },
      { id: 'participant_id', title: 'Participant ID' }
    ]
  });
  
  await csvWriter.writeRecords(rows);
  tracker.complete();
}

/**
 * Export conversations to JSON format.
 * Preserves the full conversation structure with pretty printing.
 * 
 * @param {Array<Object>} conversations - Array of conversation objects
 * @param {string} outputPath - Full path to output JSON file
 * @returns {Promise<void>}
 * @throws {FileSystemError} If unable to write file
 * @private
 * @example
 * await exportToJSON(conversations, '/path/to/output.json');
 */
async function exportToJSON(conversations, outputPath) {
  await fs.writeFile(outputPath, JSON.stringify(conversations, null, 2));
}

/**
 * Register the export-conversations command with the CLI program.
 * Adds the 'export-conversations' command with format and filter options.
 * 
 * @param {Command} program - Commander program instance
 * @example
 * const program = new Command();
 * registerExportConversationsCommand(program);
 * 
 * // Usage:
 * // tellet-admin export-conversations -p PROJECT_ID
 * // tellet-admin export -p PROJECT_ID -f json -o ./data
 * // tellet-admin export-conversations -p PROJECT_ID -s completed
 */
function registerExportConversationsCommand(program) {
  program
    .command('export-conversations')
    .alias('export')
    .description('Export conversation data to CSV or JSON format')
    .requiredOption('-p, --project <id>', 'Project ID')
    .option('-o, --output-dir <path>', 'Output directory', './exports')
    .option('-s, --status <status>', 'Filter by conversation status')
    .option('-f, --format <format>', 'Export format (csv or json)', 'csv')
    .option('-u, --url <url>', 'API base URL')
    .action(requireAuth(exportConversationsHandler));
}

module.exports = {
  exportConversationsHandler,
  registerExportConversationsCommand
};