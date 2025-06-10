/**
 * @fileoverview Main CLI setup and command registration for Tellet Admin CLI.
 * This module creates the commander program, registers all commands, and handles
 * global options and error handling.
 * 
 * @module lib/cli
 */

const { Command } = require('commander');
const chalk = require('chalk');
const { logger } = require('./logger');
const { ErrorHandler } = require('./errors');
const UpdateChecker = require('../update-checker');

// Import command handlers
const { registerCategorizeCommand } = require('./commands/categorize');
const { registerExportConversationsCommand } = require('./commands/export-conversations');
const { registerExportTranscriptsCommand } = require('./commands/export-transcripts');
const { registerExportOverviewCommand } = require('./commands/export-overview');
const { registerHealthCheckCommand } = require('./commands/health-check');
const { registerDownloadMediaCommand } = require('./commands/download-media');
const { registerUsageAnalyticsCommand } = require('./commands/usage-analytics');
const { registerTestApiCommand } = require('./commands/test-api');
const { registerUpdateMetadataCommand } = require('./commands/update-metadata');
const { registerBulkInviteCommand } = require('./commands/bulk-invite');

// Version from package.json
const { version, description } = require('../package.json');

/**
 * Create and configure the CLI program with all commands and options.
 * Sets up global options, error handling, update checking, and command registration.
 * 
 * @returns {Command} Configured commander program instance
 * @example
 * const program = createProgram();
 * await program.parseAsync(process.argv);
 */
function createProgram() {
  const program = new Command();
  
  // Basic configuration
  program
    .name('tellet-admin')
    .description(description)
    .version(version, '-v, --version', 'Display version number')
    .helpOption('-h, --help', 'Display help information')
    .addHelpCommand('help [command]', 'Display help for command');
  
  // Global options
  program
    .option('-e, --email <email>', 'Email for authentication (can also use TELLET_EMAIL env var)')
    .option('-P, --password <password>', 'Password for authentication (can also use TELLET_PASSWORD env var)')
    .option('-u, --url <url>', 'API base URL (default: https://api.tellet.ai)')
    .option('--no-cache', 'Skip credential caching')
    .option('--debug', 'Enable debug logging');
  
  // Configure global error handling
  program.exitOverride((err) => {
    if (err.code === 'commander.help' || err.code === 'commander.helpDisplayed') {
      process.exit(0);
    }
    if (err.code === 'commander.unknownCommand') {
      // Let commander handle unknown command errors naturally
      return;
    }
    // Don't handle errors that are just help output
    if (err.message && err.message.includes('outputHelp')) {
      process.exit(0);
    }
    ErrorHandler.handle(err, { operation: 'cli' });
  });
  
  // Add update check
  program.hook('preAction', async () => {
    // Check for updates
    const updateChecker = new UpdateChecker();
    const updateInfo = await updateChecker.checkForUpdate(true);
    
    if (updateInfo && updateInfo.updateAvailable) {
      logger.warn(`
A new version of Tellet Admin CLI is available!
Current version: ${updateInfo.current}
Latest version: ${updateInfo.latest}

Run 'npm update -g @tellet/admin-cli' to update.
      `);
    }
    
    // Set debug logging if requested
    if (program.opts().debug) {
      logger.options.level = 'debug';
    }
  });
  
  // Register commands
  registerCategorizeCommand(program);
  registerExportConversationsCommand(program);
  registerExportTranscriptsCommand(program);
  registerExportOverviewCommand(program);
  registerHealthCheckCommand(program);
  registerDownloadMediaCommand(program);
  registerUsageAnalyticsCommand(program);
  registerTestApiCommand(program);
  registerUpdateMetadataCommand(program);
  registerBulkInviteCommand(program);
  
  // Wizard command
  program
    .command('wizard')
    .description('Launch the interactive wizard')
    .action(() => {
      // Launch wizard in a subprocess to keep it isolated
      const { spawn } = require('child_process');
      const wizardProcess = spawn('node', ['tellet-wizard.js'], {
        stdio: 'inherit',
        shell: false
      });
      
      wizardProcess.on('close', (code) => {
        process.exit(code);
      });
    });
  
  // List organizations command (simplified version)
  program
    .command('list-orgs')
    .description('List your organizations and workspaces')
    .option('--show-ids', 'Show full IDs instead of truncated versions')
    .option('--fast', 'Fast mode - only fetch organization names')
    .action(async (options) => {
      const { requireAuth } = require('./auth');
      const handler = requireAuth(async ({ api }) => {
        try {
          const orgs = await api.get('/organizations');
          
          if (!orgs || !Array.isArray(orgs)) {
            logger.warn('No organizations found or unexpected response format');
            logger.debug('Response:', orgs);
            return;
          }
          
          if (orgs.length === 0) {
            logger.warn('No organizations found');
            return;
          }
          
          for (const org of orgs) {
            logger.info(chalk.blue(`\n📂 Organization: ${org.name}`));
            logger.info(`   ID: ${options.showIds ? org._id : org._id.substring(0, 8) + '...'}`);
            
            if (!options.fast) {
              try {
                const workspaceData = await api.get(`/organizations/${org._id}/workspaces`);
                const workspaces = [
                  ...(workspaceData.privateWorkspaces || workspaceData.priv || []),
                  ...(workspaceData.sharedWorkspaces || workspaceData.shared || [])
                ];
                
                for (const ws of workspaces) {
                  logger.info(chalk.green(`   📁 ${ws.name}`));
                  logger.info(`      ID: ${options.showIds ? ws._id : ws._id.substring(0, 8) + '...'}`);
                }
              } catch (error) {
                logger.warn(`   Failed to fetch workspaces: ${error.message}`);
              }
            }
          }
        } catch (error) {
          ErrorHandler.handle(error, { operation: 'list-orgs' });
        }
      });
      
      await handler(options);
    });
  
  // Update command
  program
    .command('update')
    .description('Check for updates and install if available')
    .action(async () => {
      const updateChecker = new UpdateChecker();
      const updateInfo = await updateChecker.checkForUpdate();
      
      if (!updateInfo || !updateInfo.updateAvailable) {
        logger.info('You are already running the latest version.');
        return;
      }
      
      logger.info(`New version available: ${updateInfo.latest}`);
      logger.info('Run: npm update -g @tellet/admin-cli');
    });
  
  // Add custom help
  program.on('--help', () => {
    console.log('');
    console.log('Examples:');
    console.log('  $ tellet-admin categorize -p PROJECT_ID');
    console.log('  $ tellet-admin export-conversations -p PROJECT_ID -o ./exports');
    console.log('  $ tellet-admin export-transcripts -w WORKSPACE_ID -q');
    console.log('  $ tellet-admin list-orgs --show-ids');
    console.log('  $ tellet-admin wizard');
    console.log('');
    console.log('Environment Variables:');
    console.log('  TELLET_EMAIL     - Your Tellet account email');
    console.log('  TELLET_PASSWORD  - Your Tellet account password');
    console.log('  TELLET_API_URL   - API base URL (default: https://api.tellet.ai)');
  });
  
  return program;
}

/**
 * Run the CLI application with the provided arguments.
 * Handles program creation, parsing, and top-level error handling.
 * 
 * @param {string[]} [argv=process.argv] - Command line arguments array
 * @returns {Promise<void>}
 * @throws {Error} Any unhandled errors are caught and processed by ErrorHandler
 * @example
 * // Run with custom arguments
 * await run(['node', 'tellet-admin', 'list-orgs', '--show-ids']);
 * 
 * // Run with process arguments (default)
 * await run();
 */
async function run(argv = process.argv) {
  try {
    const program = createProgram();
    await program.parseAsync(argv);
  } catch (error) {
    ErrorHandler.handle(error, { operation: 'cli' });
  }
}

// Export for testing
module.exports = {
  createProgram,
  run
};

// Run if called directly
if (require.main === module) {
  run();
}