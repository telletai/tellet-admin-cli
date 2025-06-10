/**
 * @fileoverview Download media command handler for Tellet Admin CLI.
 * Downloads all media files (images, videos, documents) from project conversations.
 * 
 * @module lib/commands/download-media
 */

const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const ora = require('ora');
const { requireAuth } = require('../auth');
const { logger, ProgressTracker } = require('../logger');
const { validateOptions } = require('../validation');
const { ensureDirectoryExists } = require('../utils/file-utils');
const { selectProjectWithMethod } = require('../../selection-helper');

/**
 * Options schema for the download-media command
 * @private
 */
const optionsSchema = {
  project: { type: 'string' },
  workspace: { type: 'string' },
  organization: { type: 'string' },
  output: { type: 'string', default: './media-downloads' },
  concurrency: { type: 'int', min: 1, max: 10, default: 3 },
  includeTranscriptions: { type: 'boolean', default: false },
  quickSelect: { type: 'boolean', default: false }
};

/**
 * Download all media files from a project's conversations.
 * Organizes downloads by conversation ID and handles various media types.
 * 
 * @param {Object} options - Command options with authenticated API client
 * @returns {Promise<void>}
 * @private
 */
async function downloadMediaHandler(options) {
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
        'media download',
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
    
    // Fetch conversations with media
    spinner.start('Scanning for media files...');
    const conversations = await api.get(`/analyzer/results/${projectId}/conversations`);
    
    // Extract all media URLs
    const mediaFiles = [];
    conversations.forEach(conv => {
      if (conv.messages) {
        conv.messages.forEach(msg => {
          // Check for media attachments
          if (msg.attachments) {
            msg.attachments.forEach(attachment => {
              if (attachment.url) {
                mediaFiles.push({
                  conversationId: conv._id,
                  messageId: msg._id,
                  url: attachment.url,
                  type: attachment.type || 'unknown',
                  filename: attachment.filename || extractFilename(attachment.url),
                  timestamp: msg.timestamp
                });
              }
            });
          }
          
          // Check for media in content (for backwards compatibility)
          if (msg.mediaUrl) {
            mediaFiles.push({
              conversationId: conv._id,
              messageId: msg._id,
              url: msg.mediaUrl,
              type: msg.mediaType || 'unknown',
              filename: extractFilename(msg.mediaUrl),
              timestamp: msg.timestamp
            });
          }
          
          // Include transcriptions if requested
          if (validatedOptions.includeTranscriptions && msg.transcription) {
            mediaFiles.push({
              conversationId: conv._id,
              messageId: msg._id,
              content: msg.transcription,
              type: 'transcription',
              filename: `${msg._id}_transcription.txt`,
              timestamp: msg.timestamp
            });
          }
        });
      }
    });
    
    spinner.succeed(`Found ${mediaFiles.length} media files in ${conversations.length} conversations`);
    
    if (mediaFiles.length === 0) {
      logger.warn('No media files found in project');
      return;
    }
    
    // Create output directory structure
    const baseDir = path.join(validatedOptions.output, projectId);
    await ensureDirectoryExists(baseDir);
    
    // Download media files
    logger.info(`Downloading to: ${baseDir}`);
    const progress = new ProgressTracker(mediaFiles.length, 'Downloading media');
    
    const downloadQueue = [...mediaFiles];
    const concurrent = validatedOptions.concurrency;
    const results = { success: 0, failed: 0, skipped: 0 };
    
    // Process downloads in batches
    while (downloadQueue.length > 0) {
      const batch = downloadQueue.splice(0, concurrent);
      const promises = batch.map(media => downloadMediaFile(api, media, baseDir, results));
      
      await Promise.allSettled(promises);
      progress.update(mediaFiles.length - downloadQueue.length);
    }
    
    progress.finish();
    
    // Display results
    logger.section('Download Summary');
    logger.info(`✅ Downloaded: ${chalk.green(results.success)} files`);
    if (results.skipped > 0) {
      logger.info(`⏭️  Skipped: ${chalk.yellow(results.skipped)} files (already exist)`);
    }
    if (results.failed > 0) {
      logger.info(`❌ Failed: ${chalk.red(results.failed)} files`);
    }
    logger.info(`📁 Location: ${baseDir}`);
    
  } catch (error) {
    spinner.fail('Download failed');
    throw error;
  }
}

/**
 * Download a single media file.
 * 
 * @param {Object} api - API client instance
 * @param {Object} media - Media file information
 * @param {string} baseDir - Base directory for downloads
 * @param {Object} results - Results counter object
 * @returns {Promise<void>}
 * @private
 */
async function downloadMediaFile(api, media, baseDir, results) {
  try {
    // Create conversation directory
    const convDir = path.join(baseDir, media.conversationId);
    await ensureDirectoryExists(convDir);
    
    // Determine filename
    const timestamp = media.timestamp ? new Date(media.timestamp).getTime() : Date.now();
    const safeFilename = sanitizeFilename(media.filename);
    const filename = `${timestamp}_${safeFilename}`;
    const filepath = path.join(convDir, filename);
    
    // Check if file already exists
    if (fs.existsSync(filepath)) {
      logger.debug(`File already exists: ${filename}`);
      results.skipped++;
      return;
    }
    
    // Handle transcriptions (text content)
    if (media.type === 'transcription' && media.content) {
      await fs.promises.writeFile(filepath, media.content, 'utf8');
      results.success++;
      return;
    }
    
    // Download media file
    if (media.url) {
      const data = await api.download(media.url);
      await fs.promises.writeFile(filepath, data);
      results.success++;
      logger.debug(`Downloaded: ${filename}`);
    }
    
  } catch (error) {
    logger.debug(`Failed to download ${media.filename}: ${error.message}`);
    results.failed++;
  }
}

/**
 * Extract filename from URL.
 * 
 * @param {string} url - Media URL
 * @returns {string} Extracted filename
 * @private
 */
function extractFilename(url) {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const filename = path.basename(pathname);
    return filename || 'unknown_media';
  } catch {
    return 'unknown_media';
  }
}

/**
 * Sanitize filename for safe filesystem storage.
 * 
 * @param {string} filename - Original filename
 * @returns {string} Sanitized filename
 * @private
 */
function sanitizeFilename(filename) {
  return filename
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_{2,}/g, '_')
    .substring(0, 255);
}

/**
 * Register the download-media command with the CLI program.
 * 
 * @param {Command} program - Commander program instance
 * @returns {void}
 * @example
 * const { Command } = require('commander');
 * const program = new Command();
 * registerDownloadMediaCommand(program);
 */
function registerDownloadMediaCommand(program) {
  program
    .command('download-media')
    .description('Download all media files from a project')
    .option('-p, --project <id>', 'Project ID')
    .option('-w, --workspace <id>', 'Workspace ID for project selection')
    .option('-g, --organization <id>', 'Organization ID for workspace selection')
    .option('-o, --output <path>', 'Output directory', './media-downloads')
    .option('-c, --concurrency <number>', 'Number of concurrent downloads', '3')
    .option('-t, --include-transcriptions', 'Include transcription files')
    .option('-q, --quick-select', 'Use quick selection mode')
    .action(requireAuth(downloadMediaHandler));
}

module.exports = {
  registerDownloadMediaCommand,
  downloadMediaHandler
};