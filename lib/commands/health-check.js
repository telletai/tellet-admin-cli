/**
 * @fileoverview Health check command handler for Tellet Admin CLI.
 * Analyzes project health including conversation completion rates and missing digests.
 * 
 * @module lib/commands/health-check
 */

const chalk = require('chalk');
const ora = require('ora');
const Table = require('cli-table3');
const { requireAuth } = require('../auth');
const { logger, ProgressTracker } = require('../logger');
const { validateOptions } = require('../validation');
const { selectProjectWithMethod } = require('../../selection-helper');

/**
 * Options schema for the health-check command
 * @private
 */
const optionsSchema = {
  workspace: { type: 'string' },
  organization: { type: 'string' },
  quickSelect: { type: 'boolean', default: false },
  detailed: { type: 'boolean', default: false }
};

/**
 * Perform health check on projects to analyze completion rates and issues.
 * Shows statistics on conversation statuses, missing digests, and overall health.
 * 
 * @param {Object} options - Command options with authenticated API client
 * @returns {Promise<void>}
 * @private
 */
async function healthCheckHandler(options) {
  const spinner = ora();
  
  try {
    const api = options.api;
    const validatedOptions = validateOptions(options, optionsSchema);
    
    // Get workspace info
    let workspace;
    if (validatedOptions.workspace) {
      // If workspace ID provided, get workspace details
      spinner.start('Fetching workspace details...');
      try {
        // We need to find the organization that contains this workspace
        const orgsResponse = await api.get('/organizations');
        const organizations = orgsResponse.data;
        
        for (const org of organizations) {
          try {
            const wsResponse = await api.get(`/organizations/${org._id}/workspaces`);
            const workspaces = wsResponse.data;
            const allWorkspaces = [
              ...(workspaces.priv || []).map(w => ({ ...w, type: 'Private' })),
              ...(workspaces.shared || []).map(w => ({ ...w, type: 'Shared' }))
            ];
            
            const targetWorkspace = allWorkspaces.find(ws => ws._id === validatedOptions.workspace);
            if (targetWorkspace) {
              workspace = { ...targetWorkspace, organization_id: org._id };
              break;
            }
          } catch (e) {
            // Skip this org if we can't access workspaces
            continue;
          }
        }
        
        if (!workspace) {
          spinner.fail('Workspace not found or not accessible');
          return;
        }
        spinner.succeed(`Selected workspace: ${workspace.name} (${workspace.type})`);
      } catch (error) {
        spinner.fail('Failed to fetch workspace details');
        logger.error(error.message);
        return;
      }
    } else {
      spinner.fail('Workspace ID is required (-w option)');
      logger.info('Please provide a workspace ID using the -w option');
      logger.info('Use "list-orgs" command to find workspace IDs');
      return;
    }
    
    // Fetch projects
    spinner.start('Fetching projects...');
    const projectsResponse = await api.get(`/organizations/${workspace.organization_id}/workspaces/${workspace._id}/projects`);
    const projects = projectsResponse.data;
    spinner.succeed(`Found ${projects.length} projects`);
    
    if (projects.length === 0) {
      logger.warn('No projects found in workspace');
      return;
    }
    
    // Analyze each project
    const projectStats = [];
    const progressBar = new ProgressTracker(projects.length, { 
      logger: logger,
      showPercentage: true 
    });
    
    logger.info('Analyzing projects...');
    
    for (const project of projects) {
      try {
        const conversationsResponse = await api.get('/analyzer/results/conversations', {
          params: { project_id: project._id }
        });
        const conversations = conversationsResponse.data;
        
        const stats = {
          projectId: project._id,
          projectName: project.title || 'Untitled',
          status: project.status,
          totalConversations: conversations.length,
          inProgress: 0,
          done: 0,
          digested: 0,
          missingDigest: 0,
          avgDuration: 0,
          avgMessages: 0
        };
        
        let totalDuration = 0;
        let totalMessages = 0;
        
        conversations.forEach(conv => {
          if (conv.status === 'IN_PROGRESS') stats.inProgress++;
          else if (conv.status === 'DONE') {
            stats.done++;
            if (!conv.digest) stats.missingDigest++;
          } else if (conv.status === 'DIGESTED') {
            stats.digested++;
          }
          
          totalDuration += conv.duration || 0;
          totalMessages += conv.messages?.length || 0;
        });
        
        if (conversations.length > 0) {
          stats.avgDuration = Math.round(totalDuration / conversations.length);
          stats.avgMessages = Math.round(totalMessages / conversations.length);
        }
        
        stats.completionRate = conversations.length > 0 
          ? Math.round(((stats.done + stats.digested) / conversations.length) * 100)
          : 0;
        
        stats.healthScore = calculateHealthScore(stats);
        projectStats.push(stats);
        
      } catch (error) {
        logger.debug(`Failed to analyze project ${project._id}: ${error.message}`);
        projectStats.push({
          projectId: project._id,
          projectName: project.title || 'Untitled',
          status: project.status,
          error: error.message
        });
      }
      
      progressBar.increment();
    }
    
    progressBar.complete();
    
    // Display results
    displayHealthResults(projectStats, validatedOptions.detailed);
    
  } catch (error) {
    spinner.fail('Health check failed');
    throw error;
  }
}

/**
 * Calculate health score for a project based on various metrics.
 * 
 * @param {Object} stats - Project statistics
 * @returns {string} Health score (Excellent, Good, Fair, Poor)
 * @private
 */
function calculateHealthScore(stats) {
  let score = 100;
  
  // Deduct points for issues
  if (stats.completionRate < 90) score -= 20;
  if (stats.completionRate < 70) score -= 20;
  if (stats.missingDigest > 0) score -= 10;
  if (stats.inProgress > stats.done) score -= 10;
  if (stats.status !== 'PUBLISHED') score -= 5;
  
  if (score >= 90) return 'Excellent';
  if (score >= 70) return 'Good';
  if (score >= 50) return 'Fair';
  return 'Poor';
}

/**
 * Display health check results in a formatted table.
 * 
 * @param {Array} projectStats - Array of project statistics
 * @param {boolean} detailed - Show detailed information
 * @private
 */
function displayHealthResults(projectStats, detailed) {
  logger.section('Project Health Report');
  
  // Summary statistics
  const totalProjects = projectStats.length;
  const errorProjects = projectStats.filter(p => p.error).length;
  const healthyProjects = projectStats.filter(p => !p.error && p.healthScore === 'Excellent').length;
  const issueProjects = projectStats.filter(p => !p.error && p.healthScore === 'Poor').length;
  
  logger.info(`Total projects: ${totalProjects}`);
  logger.info(`Healthy projects: ${chalk.green(healthyProjects)}`);
  logger.info(`Projects with issues: ${chalk.yellow(issueProjects)}`);
  if (errorProjects > 0) {
    logger.info(`Projects with errors: ${chalk.red(errorProjects)}`);
  }
  
  // Create table
  const table = new Table({
    head: detailed 
      ? ['Project', 'Status', 'Conversations', 'Completion', 'Missing Digests', 'Avg Duration', 'Health']
      : ['Project', 'Status', 'Conversations', 'Completion', 'Health']
  });
  
  projectStats
    .sort((a, b) => {
      // Sort by health score
      const scoreOrder = { 'Poor': 0, 'Fair': 1, 'Good': 2, 'Excellent': 3 };
      return (scoreOrder[b.healthScore] || -1) - (scoreOrder[a.healthScore] || -1);
    })
    .forEach(stats => {
      if (stats.error) {
        table.push([
          stats.projectName,
          chalk.red('ERROR'),
          '-',
          '-',
          chalk.red('Error')
        ]);
        return;
      }
      
      const healthColor = {
        'Excellent': chalk.green,
        'Good': chalk.blue,
        'Fair': chalk.yellow,
        'Poor': chalk.red
      }[stats.healthScore] || chalk.gray;
      
      if (detailed) {
        table.push([
          stats.projectName,
          stats.status,
          stats.totalConversations,
          `${stats.completionRate}%`,
          stats.missingDigest || '-',
          `${stats.avgDuration}s`,
          healthColor(stats.healthScore)
        ]);
      } else {
        table.push([
          stats.projectName,
          stats.status,
          stats.totalConversations,
          `${stats.completionRate}%`,
          healthColor(stats.healthScore)
        ]);
      }
    });
  
  console.log(table.toString());
  
  // Recommendations
  if (issueProjects > 0) {
    logger.subsection('Recommendations');
    logger.bullet('Review projects marked as "Poor" health');
    logger.bullet('Complete in-progress conversations');
    logger.bullet('Generate missing digests for completed conversations');
    logger.bullet('Consider publishing draft projects when ready');
  }
}

/**
 * Register the health-check command with the CLI program.
 * 
 * @param {Command} program - Commander program instance
 * @returns {void}
 * @example
 * const { Command } = require('commander');
 * const program = new Command();
 * registerHealthCheckCommand(program);
 */
function registerHealthCheckCommand(program) {
  program
    .command('health-check')
    .description('Check project health and identify issues')
    .option('-w, --workspace <id>', 'Workspace ID')
    .option('-g, --organization <id>', 'Organization ID')
    .option('-q, --quick-select', 'Use quick selection mode')
    .option('-d, --detailed', 'Show detailed information')
    .action(requireAuth(healthCheckHandler));
}

module.exports = {
  registerHealthCheckCommand,
  healthCheckHandler
};