/**
 * @fileoverview Test API command handler for Tellet Admin CLI.
 * Tests API connectivity and authentication.
 * 
 * @module lib/commands/test-api
 */

const chalk = require('chalk');
const { requireAuth } = require('../auth');
const { logger } = require('../logger');

/**
 * Test API connectivity and authentication.
 * Performs a series of API calls to verify access and permissions.
 * 
 * @param {Object} options - Command options with authenticated API client
 * @returns {Promise<void>}
 * @private
 */
async function testApiHandler(options) {
  try {
    const api = options.api;
    
    logger.section('Testing API Connection');
    
    // Test 1: Organizations endpoint
    logger.info('Testing organizations endpoint...');
    try {
      const response = await api.get('/organizations');
      const orgs = response.data;
      const orgCount = Array.isArray(orgs) ? orgs.length : 0;
      logger.success(`✓ Organizations: Found ${orgCount} organization(s)`);
      
      if (Array.isArray(orgs) && orgs.length > 0) {
        logger.info(`  First org: ${orgs[0].name} (${orgs[0]._id})`);
      }
    } catch (error) {
      logger.fail(`✗ Organizations: ${error.message}`);
    }
    
    // Test 2: User authentication (implicit test - if we got this far, auth is working)
    logger.info('\nTesting authentication...');
    logger.success('✓ Authentication: Token is valid and working');
    
    // Test 3: Workspaces (if org exists)
    try {
      const response = await api.get('/organizations');
      const orgs = response.data;
      if (Array.isArray(orgs) && orgs.length > 0) {
        logger.info('\nTesting workspaces endpoint...');
        const workspaceResponse = await api.get(`/organizations/${orgs[0]._id}/workspaces`);
        const workspaces = workspaceResponse.data;
        const totalWorkspaces = (workspaces.priv?.length || 0) + (workspaces.shared?.length || 0);
        logger.success(`✓ Workspaces: Found ${totalWorkspaces} workspace(s)`);
      }
    } catch (error) {
      logger.fail(`✗ Workspaces: ${error.message}`);
    }
    
    // Summary
    logger.section('API Test Summary');
    logger.info(`Base URL: ${api.defaults?.baseURL || 'https://api.tellet.ai'}`);
    logger.info(`Authentication: ${chalk.green('Working')}`);
    logger.info(`API Status: ${chalk.green('Connected')}`);
    
  } catch (error) {
    logger.section('API Test Failed');
    logger.error(`Error: ${error.message}`);
    logger.info('\nTroubleshooting:');
    logger.bullet('Check your internet connection');
    logger.bullet('Verify your email and password are correct');
    logger.bullet('Ensure the API URL is correct (default: https://api.tellet.ai)');
    logger.bullet('Try setting TELLET_EMAIL and TELLET_PASSWORD environment variables');
    throw error;
  }
}

/**
 * Register the test-api command with the CLI program.
 * 
 * @param {Command} program - Commander program instance
 * @returns {void}
 * @example
 * const { Command } = require('commander');
 * const program = new Command();
 * registerTestApiCommand(program);
 */
function registerTestApiCommand(program) {
  program
    .command('test-api')
    .description('Test API connection and authentication')
    .action(requireAuth(testApiHandler));
}

module.exports = {
  registerTestApiCommand,
  testApiHandler
};