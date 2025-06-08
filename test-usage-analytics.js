#!/usr/bin/env node

/**
 * Test script for usage analytics filtering
 * Run with: node test-usage-analytics.js
 */

const chalk = require('chalk');

console.log(chalk.blue.bold('\n📊 Usage Analytics Filter Testing\n'));

const tests = [
    {
        name: 'Test 1: All organizations (no filters)',
        command: 'node tellet-admin-tool.js usage-analytics -v'
    },
    {
        name: 'Test 2: Specific organization',
        command: 'node tellet-admin-tool.js usage-analytics -o YOUR_ORG_ID -v',
        note: 'Replace YOUR_ORG_ID with an actual organization ID'
    },
    {
        name: 'Test 3: Specific workspace',
        command: 'node tellet-admin-tool.js usage-analytics -w YOUR_WORKSPACE_ID -v',
        note: 'Replace YOUR_WORKSPACE_ID with an actual workspace ID'
    },
    {
        name: 'Test 4: Date range filter',
        command: 'node tellet-admin-tool.js usage-analytics -s 2025-01-01 -e 2025-06-30 -v'
    },
    {
        name: 'Test 5: Organization with date range',
        command: 'node tellet-admin-tool.js usage-analytics -o YOUR_ORG_ID -s 2025-01-01 -e 2025-06-30 -v',
        note: 'Replace YOUR_ORG_ID with an actual organization ID'
    },
    {
        name: 'Test 6: Invalid organization ID',
        command: 'node tellet-admin-tool.js usage-analytics -o invalid_id_12345 -v',
        expectedResult: 'Should show error: Organization not found'
    },
    {
        name: 'Test 7: Invalid workspace ID',
        command: 'node tellet-admin-tool.js usage-analytics -w invalid_ws_12345 -v',
        expectedResult: 'Should show error: Workspace not found'
    }
];

console.log(chalk.yellow('Test Commands:\n'));

tests.forEach((test, index) => {
    console.log(chalk.cyan(`${test.name}:`));
    console.log(chalk.gray(`  ${test.command}`));
    if (test.note) {
        console.log(chalk.yellow(`  Note: ${test.note}`));
    }
    if (test.expectedResult) {
        console.log(chalk.green(`  Expected: ${test.expectedResult}`));
    }
    console.log();
});

console.log(chalk.blue('─'.repeat(60)));
console.log(chalk.yellow('\nTo get organization and workspace IDs:'));
console.log(chalk.gray('  node tellet-admin-tool.js list-orgs --show-ids'));

console.log(chalk.blue('─'.repeat(60)));
console.log(chalk.yellow('\nExpected file outputs:'));
console.log(chalk.gray('  • No filter: organization_usage_summary_all_time_YYYY-MM-DD.csv'));
console.log(chalk.gray('  • Org filter: organization_usage_summary_orgname_all_time_YYYY-MM-DD.csv'));
console.log(chalk.gray('  • WS filter: workspace_usage_summary_wsname_all_time_YYYY-MM-DD.csv'));
console.log(chalk.gray('  • Date filter: organization_usage_summary_2025-01-01_to_2025-06-30_YYYY-MM-DD.csv'));

console.log(chalk.blue('\n═'.repeat(60)));
console.log(chalk.green.bold('✅ Filtering Implementation Complete!\n'));
console.log(chalk.white('Key features added:'));
console.log(chalk.gray('  • Organization filtering (-o flag)'));
console.log(chalk.gray('  • Workspace filtering (-w flag)'));
console.log(chalk.gray('  • Filter information in file names'));
console.log(chalk.gray('  • Filter details in summary output'));
console.log(chalk.gray('  • Error handling for invalid IDs'));
console.log(chalk.blue('═'.repeat(60)) + '\n');