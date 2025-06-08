/**
 * @fileoverview Bulk invite command handler for Tellet Admin CLI.
 * Invites multiple users to an organization from a CSV file.
 * 
 * @module lib/commands/bulk-invite
 */

const fs = require('fs');
const csv = require('csv-parse');
const chalk = require('chalk');
const ora = require('ora');
const { requireAuth } = require('../auth');
const { logger, ProgressTracker } = require('../logger');
const { validateOptions, validateEmail } = require('../validation');

/**
 * Options schema for the bulk-invite command
 * @private
 */
const optionsSchema = {
  organization: { type: 'string' },
  csv: { type: 'string', required: true },
  role: { type: 'string', enum: ['MEMBER', 'ADMIN'], default: 'MEMBER' },
  dryRun: { type: 'boolean', default: false },
  continueOnError: { type: 'boolean', default: false }
};

/**
 * Bulk invite users to an organization from a CSV file.
 * CSV must have 'email' column and optionally 'first_name', 'last_name', 'role' columns.
 * 
 * @param {Object} options - Command options with authenticated API client
 * @returns {Promise<void>}
 * @private
 */
async function bulkInviteHandler(options) {
  const spinner = ora();
  
  try {
    const api = options.api;
    const validatedOptions = validateOptions(options, optionsSchema);
    
    // Select organization
    let organizationId = validatedOptions.organization;
    if (!organizationId) {
      const { selectOrganizationFast } = require('../../fast-org-selector');
      const org = await selectOrganizationFast(api, 'bulk invite');
      if (!org) return;
      organizationId = org._id;
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
    if (!records[0].email) {
      throw new Error('CSV must have an "email" column');
    }
    
    // Validate all emails
    logger.info('Validating email addresses...');
    const invalidEmails = [];
    records.forEach((record, index) => {
      if (!validateEmail(record.email)) {
        invalidEmails.push({ row: index + 2, email: record.email });
      }
    });
    
    if (invalidEmails.length > 0) {
      logger.error('Invalid email addresses found:');
      invalidEmails.forEach(({ row, email }) => {
        logger.error(`  Row ${row}: ${email}`);
      });
      throw new Error('Please fix invalid email addresses before proceeding');
    }
    
    // Display sample in dry run mode
    if (validatedOptions.dryRun) {
      logger.warn('DRY RUN MODE - No invitations will be sent');
      logger.info('\nSample invitations:');
      records.slice(0, 5).forEach(record => {
        const role = record.role || validatedOptions.role;
        logger.info(`  ${record.email} - Role: ${role}`);
        if (record.first_name || record.last_name) {
          logger.info(`    Name: ${record.first_name || ''} ${record.last_name || ''}`);
        }
      });
      if (records.length > 5) {
        logger.info(`  ... and ${records.length - 5} more`);
      }
      return;
    }
    
    // Send invitations
    const progress = new ProgressTracker(records.length, 'Sending invitations');
    const results = { success: 0, failed: 0, alreadyMember: 0 };
    const errors = [];
    
    for (const record of records) {
      try {
        const inviteData = {
          email: record.email,
          role: record.role || validatedOptions.role,
          firstName: record.first_name || record.firstName || '',
          lastName: record.last_name || record.lastName || ''
        };
        
        await api.post(`/organizations/${organizationId}/invitations`, inviteData);
        
        results.success++;
        logger.debug(`Invited: ${record.email}`);
        
      } catch (error) {
        if (error.statusCode === 409) {
          results.alreadyMember++;
          logger.debug(`Already a member: ${record.email}`);
        } else {
          results.failed++;
          errors.push({ email: record.email, error: error.message });
          logger.debug(`Failed to invite ${record.email}: ${error.message}`);
        }
        
        if (!validatedOptions.continueOnError && error.statusCode !== 409) {
          progress.finish();
          throw error;
        }
      }
      
      progress.increment();
    }
    
    progress.finish('Bulk invite complete');
    
    // Display results
    logger.section('Invitation Summary');
    logger.info(`✅ Invited: ${chalk.green(results.success)} users`);
    if (results.alreadyMember > 0) {
      logger.info(`ℹ️  Already members: ${chalk.blue(results.alreadyMember)} users`);
    }
    if (results.failed > 0) {
      logger.info(`❌ Failed: ${chalk.red(results.failed)} invitations`);
      
      if (errors.length > 0 && errors.length <= 10) {
        logger.subsection('Failed Invitations');
        errors.forEach(({ email, error }) => {
          logger.error(`  ${email}: ${error}`);
        });
      }
    }
    
    // Instructions
    if (results.success > 0) {
      logger.subsection('Next Steps');
      logger.bullet('Invited users will receive an email invitation');
      logger.bullet('They must accept the invitation to join the organization');
      logger.bullet('You can track pending invitations in the Tellet dashboard');
    }
    
  } catch (error) {
    spinner.fail('Bulk invite failed');
    throw error;
  }
}

/**
 * Register the bulk-invite command with the CLI program.
 * 
 * @param {Command} program - Commander program instance
 * @returns {void}
 * @example
 * const { Command } = require('commander');
 * const program = new Command();
 * registerBulkInviteCommand(program);
 */
function registerBulkInviteCommand(program) {
  program
    .command('bulk-invite')
    .description('Bulk invite users to organization from CSV')
    .option('-g, --organization <id>', 'Organization ID')
    .option('-f, --csv <file>', 'CSV file with user emails (required)')
    .option('-r, --role <role>', 'Default role for invites (MEMBER or ADMIN)', 'MEMBER')
    .option('--dry-run', 'Preview invitations without sending')
    .option('--continue-on-error', 'Continue if errors occur')
    .action(requireAuth(bulkInviteHandler));
}

module.exports = {
  registerBulkInviteCommand,
  bulkInviteHandler
};