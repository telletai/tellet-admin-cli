/**
 * @fileoverview Usage analytics command handler for Tellet Admin CLI.
 * Generates comprehensive usage statistics across organizations, workspaces, and projects.
 * 
 * @module lib/commands/usage-analytics
 */

const { requireAuth } = require('../auth');
const UsageAnalytics = require('../../usage-analytics');

/**
 * Register the usage-analytics command with the CLI program.
 * This command uses the existing UsageAnalytics class from the legacy codebase.
 * 
 * @param {Command} program - Commander program instance
 * @returns {void}
 * @example
 * const { Command } = require('commander');
 * const program = new Command();
 * registerUsageAnalyticsCommand(program);
 */
function registerUsageAnalyticsCommand(program) {
  program
    .command('usage-analytics')
    .description('Generate usage analytics report')
    .option('-o, --output <directory>', 'Output directory for reports', './analytics')
    .option('-g, --organization <id>', 'Filter by specific organization ID')
    .option('-w, --workspace <id>', 'Filter by specific workspace ID')
    .option('--from-date <date>', 'Start date for filtering (YYYY-MM-DD)')
    .option('--to-date <date>', 'End date for filtering (YYYY-MM-DD)')
    .option('--format <format>', 'Output format (json, csv, both)', 'both')
    .option('--include-empty', 'Include projects with no conversations')
    .option('--detailed', 'Include detailed conversation data')
    .action(requireAuth(async (options) => {
      // Use the existing UsageAnalytics implementation
      const analytics = new UsageAnalytics(options.api, {
        outputDir: options.output,
        organizationId: options.organization,
        workspaceId: options.workspace,
        startDate: options.fromDate,
        endDate: options.toDate,
        format: options.format,
        includeEmpty: options.includeEmpty,
        detailed: options.detailed,
        verbose: true
      });
      
      await analytics.run();
    }));
}

module.exports = {
  registerUsageAnalyticsCommand
};