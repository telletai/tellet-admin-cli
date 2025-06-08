#!/usr/bin/env node

const inquirer = require('inquirer');
const chalk = require('chalk');
const ora = require('ora');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { selectOrEnterProject } = require('./project-helper');
const { selectWorkspace, selectProjectFromWorkspace } = require('./workspace-helper');
const { selectProjectWithMethod } = require('./selection-helper');

// Load environment variables if available
try {
  require('dotenv').config();
} catch (e) {
  // dotenv is optional
}

// Import update checker
const UpdateChecker = require('./update-checker');
const updateChecker = new UpdateChecker();

// Configuration
const DEFAULT_EMAIL = process.env.TELLET_EMAIL || process.env.TELLET_ADMIN_EMAIL;
const DEFAULT_PASSWORD = process.env.TELLET_PASSWORD || process.env.TELLET_ADMIN_PASSWORD;

// ASCII Art Banner
const banner = `
${chalk.cyan('╔════════════════════════════════════════════╗')}
${chalk.cyan('║')}       ${chalk.bold.white('TELLET ADMIN TOOL WIZARD')}        ${chalk.cyan('║')}
${chalk.cyan('║')}         ${chalk.gray('Interactive CLI v2.5.1')}          ${chalk.cyan('║')}
${chalk.cyan('╚════════════════════════════════════════════╝')}
`;

// Main menu options
const mainMenuChoices = [
  { name: '🤖 Auto-Categorize Questions', value: 'categorize' },
  { name: '📥 Export Data', value: 'export' },
  { name: '🎬 Download Media Files', value: 'download-media' },
  { name: '🏥 Check Project Health', value: 'health-check' },
  { name: '📊 Usage Analytics', value: 'usage-analytics' },
  { name: '👥 Bulk Invite Users', value: 'bulk-invite' },
  { name: '🏢 List Organizations & Projects', value: 'list-orgs' },
  { name: '🔍 Test API Endpoints', value: 'test-api' },
  new inquirer.Separator(),
  { name: '⚙️  Settings', value: 'settings' },
  { name: '❌ Exit', value: 'exit' }
];

// Export submenu
const exportMenuChoices = [
  { name: '📊 Export Conversation Overview', value: 'export-overview' },
  { name: '💬 Export All Conversations (CSV)', value: 'export-conversations' },
  { name: '📄 Export Transcripts (Text)', value: 'export-transcripts' },
  { name: '← Back to Main Menu', value: 'back' }
];

// Utility functions
async function checkCredentials() {
  if (DEFAULT_EMAIL && DEFAULT_PASSWORD) {
    return { email: DEFAULT_EMAIL, password: DEFAULT_PASSWORD };
  }
  
  return promptForCredentials();
}

async function promptForCredentials(showTip = true) {
  if (showTip) {
    console.log(chalk.yellow('\n⚠️  No credentials found in environment variables.'));
    console.log(chalk.gray('Tip: Create a .env file to save your credentials.\n'));
  }
  
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'email',
      message: 'Enter your Tellet email:',
      validate: (input) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(input) || 'Please enter a valid email address';
      }
    },
    {
      type: 'password',
      name: 'password',
      message: 'Enter your Tellet password:',
      mask: '*',
      validate: (input) => input.length > 0 || 'Password is required'
    }
  ]);
  
  // Offer to save credentials
  const { saveCredentials } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'saveCredentials',
      message: 'Would you like to save these credentials to a .env file?',
      default: true
    }
  ]);
  
  if (saveCredentials) {
    const envContent = `# Tellet Admin CLI Credentials
TELLET_EMAIL=${answers.email}
TELLET_PASSWORD=${answers.password}
`;
    fs.writeFileSync('.env', envContent);
    console.log(chalk.green('✅ Credentials saved to .env file'));
  }
  
  return answers;
}

async function selectProjectWithFlow(credentials) {
  // First, select organization
  const orgId = await selectOrganization(credentials);
  if (!orgId) return null;
  
  // Then, select workspace
  const workspaceId = await selectWorkspace(credentials, orgId);
  if (!workspaceId) return null;
  
  // Finally, select project
  const projectId = await selectProjectFromWorkspace(credentials, orgId, workspaceId);
  return projectId;
}

async function selectProject(credentials) {
  const spinner = ora('Fetching your projects...').start();
  
  try {
    // Check API URL
    const apiUrl = process.env.TELLET_API_URL || 'https://api.tellet.ai';
    
    // Run list-orgs command to get projects
    const result = await runCommand('node', [
      'tellet-admin-tool.js',
      'list-orgs',
      '-e', credentials.email,
      '-P', credentials.password,
      '--show-ids'
    ]);
    
    spinner.stop();
    
    // Check if the command failed
    if (result.code !== 0) {
      console.error(chalk.red('\n❌ Failed to fetch projects'));
      console.error(chalk.gray('Error output:', result.stderr || result.stdout));
      
      // Common error cases
      if (result.stdout.includes('404')) {
        console.error(chalk.yellow('\n⚠️  Organizations endpoint not accessible (404 error)'));
        console.error(chalk.gray(`Current API URL: ${apiUrl}`));
        console.error(chalk.gray('\nThis can happen if:'));
        console.error(chalk.gray('• The API URL is incorrect'));
        console.error(chalk.gray('• You\'re using a different API environment'));
        console.error(chalk.gray('• The dashboard service is not accessible from your network'));
        console.error(chalk.gray('\nYou can still use the tool by entering project IDs manually.'));
      } else if (result.stdout.includes('Authentication failed') || result.stderr.includes('Authentication failed')) {
        console.error(chalk.yellow('Please check your credentials and try again.'));
      } else if (result.stdout.includes('No organizations found')) {
        console.error(chalk.yellow('No organizations found. You may not have access to any organizations.'));
      }
      
      return null;
    }
    
    // Parse the output to extract projects
    const projects = [];
    const lines = result.stdout.split('\n');
    
    // Debug: Show first few lines if no projects found
    let foundOrgs = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Check if we're getting organizations
      if (line.includes('📂 Organization:')) {
        foundOrgs = true;
      }
      
      if (line.includes('📄')) {
        // Extract project info: 📄 Title (ID) - STATUS
        const match = line.match(/📄\s+(.+?)\s+\(([a-f0-9]{24})\)\s+-\s+(\w+)/);
        if (match) {
          projects.push({
            name: `${match[1]} (${match[3]})`,
            value: match[2],
            title: match[1],
            status: match[3]
          });
        }
      }
    }
    
    if (projects.length === 0) {
      if (!foundOrgs) {
        console.log(chalk.yellow('\n⚠️  No organizations found.'));
        console.log(chalk.gray('This could mean:'));
        console.log(chalk.gray('  - Your credentials might be incorrect'));
        console.log(chalk.gray('  - You might not have access to any organizations'));
        console.log(chalk.gray('  - There might be a connection issue\n'));
        console.log(chalk.cyan('Try running this command directly to see more details:'));
        console.log(chalk.gray(`node tellet-admin-tool.js list-orgs -e ${credentials.email} -P ****`));
      } else {
        console.log(chalk.yellow('\n⚠️  No projects found using quick scan.'));
        console.log(chalk.cyan('Switching to step-by-step selection...'));
        // Use the flow-based selection
        return await selectProjectWithFlow(credentials);
      }
      return null;
    }
    
    const { projectId } = await inquirer.prompt([
      {
        type: 'list',
        name: 'projectId',
        message: 'Select a project:',
        choices: [...projects, new inquirer.Separator(), { name: '← Cancel', value: null }],
        pageSize: 15
      }
    ]);
    
    return projectId;
  } catch (error) {
    spinner.stop();
    console.error(chalk.red('\n❌ Failed to fetch projects:'), error.message);
    console.error(chalk.gray('Try running the command directly for more details.'));
    return null;
  }
}

async function selectOrganization(credentials) {
  const spinner = ora('Fetching your organizations...').start();
  
  try {
    const result = await runCommand('node', [
      'tellet-admin-tool.js',
      'list-orgs',
      '-e', credentials.email,
      '-P', credentials.password,
      '--show-ids'
    ]);
    
    spinner.stop();
    
    // Check if the command failed
    if (result.code !== 0) {
      console.error(chalk.red('\n❌ Failed to fetch organizations'));
      console.error(chalk.gray('Error output:', result.stderr || result.stdout));
      
      if (result.stdout.includes('Authentication failed') || result.stderr.includes('Authentication failed')) {
        console.error(chalk.yellow('Please check your credentials and try again.'));
      }
      
      return null;
    }
    
    // Parse organizations
    const organizations = [];
    const lines = result.stdout.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.includes('📂 Organization:')) {
        const nameMatch = line.match(/📂 Organization:\s+(.+)/);
        const idLine = lines[i + 1];
        const idMatch = idLine && idLine.match(/ID:\s+([a-f0-9]{24})/);
        
        if (nameMatch && idMatch) {
          organizations.push({
            name: nameMatch[1],
            value: idMatch[1]
          });
        }
      }
    }
    
    if (organizations.length === 0) {
      console.log(chalk.yellow('\n⚠️  No organizations found.'));
      console.log(chalk.gray('This could mean:'));
      console.log(chalk.gray('  - Your credentials might be incorrect'));
      console.log(chalk.gray('  - You might not have access to any organizations'));
      console.log(chalk.gray('  - There might be a connection issue'));
      return null;
    }
    
    const { orgId } = await inquirer.prompt([
      {
        type: 'list',
        name: 'orgId',
        message: 'Select an organization:',
        choices: [...organizations, new inquirer.Separator(), { name: '← Cancel', value: null }]
      }
    ]);
    
    return orgId;
  } catch (error) {
    spinner.stop();
    console.error(chalk.red('\n❌ Failed to fetch organizations:'), error.message);
    return null;
  }
}

async function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, { 
      shell: true,
      stdio: ['inherit', 'pipe', 'pipe']
    });
    
    let stdout = '';
    let stderr = '';
    
    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    proc.on('close', (code) => {
      resolve({ code, stdout, stderr });
    });
    
    proc.on('error', (err) => {
      reject(err);
    });
  });
}

async function executeCommand(command, args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, { 
      shell: true,
      stdio: 'inherit'
    });
    
    proc.on('close', (code) => {
      resolve(code);
    });
    
    proc.on('error', (err) => {
      reject(err);
    });
  });
}

// Command handlers
async function handleCategorize(credentials) {
  const projectId = await selectProjectWithMethod(credentials, selectProject, selectProjectWithFlow);
  if (!projectId) return;
  
  const { options } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'dryRun',
      message: 'Run in dry mode (preview without making changes)?',
      default: false
    },
    {
      type: 'confirm',
      name: 'verbose',
      message: 'Show detailed output?',
      default: true
    }
  ]);
  
  const args = [
    'tellet-admin-tool.js',
    'categorize',
    '-p', projectId,
    '-e', credentials.email,
    '-P', credentials.password
  ];
  
  if (options.dryRun) args.push('--dry-run');
  if (options.verbose) args.push('--verbose');
  
  console.log(chalk.cyan('\n🚀 Starting auto-categorization...\n'));
  await executeCommand('node', args);
}

async function handleExport(credentials) {
  const { exportType } = await inquirer.prompt([
    {
      type: 'list',
      name: 'exportType',
      message: 'What would you like to export?',
      choices: exportMenuChoices
    }
  ]);
  
  if (exportType === 'back') return;
  
  const projectId = await selectProjectWithMethod(credentials, selectProject, selectProjectWithFlow);
  if (!projectId) return;
  
  const { outputDir } = await inquirer.prompt([
    {
      type: 'input',
      name: 'outputDir',
      message: 'Output directory:',
      default: './exports'
    }
  ]);
  
  const args = [
    'tellet-admin-tool.js',
    exportType,
    '-p', projectId,
    '-e', credentials.email,
    '-P', credentials.password,
    '-o', outputDir
  ];
  
  // Additional options for specific export types
  if (exportType === 'export-overview') {
    const { filterStatus } = await inquirer.prompt([
      {
        type: 'list',
        name: 'filterStatus',
        message: 'Filter by conversation status?',
        choices: [
          { name: 'All conversations', value: null },
          { name: 'Completed (digested)', value: 'digested' },
          { name: 'Abandoned', value: 'abandoned' },
          { name: 'In Progress', value: 'in_progress' }
        ]
      }
    ]);
    
    if (filterStatus) {
      args.push('-s', filterStatus);
    }
  } else if (exportType === 'export-transcripts') {
    const { splitByQuestion } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'splitByQuestion',
        message: 'Create separate files for each question?',
        default: false
      }
    ]);
    
    if (splitByQuestion) args.push('-q');
  }
  
  console.log(chalk.cyan('\n📥 Starting export...\n'));
  await executeCommand('node', args);
}

async function handleDownloadMedia(credentials) {
  const projectId = await selectProjectWithMethod(credentials, selectProject, selectProjectWithFlow);
  if (!projectId) return;
  
  const { options } = await inquirer.prompt([
    {
      type: 'input',
      name: 'outputDir',
      message: 'Output directory for media files:',
      default: './media-downloads'
    },
    {
      type: 'list',
      name: 'status',
      message: 'Filter by conversation status?',
      choices: [
        { name: 'All conversations', value: null },
        { name: 'Completed only', value: 'digested' },
        { name: 'Abandoned only', value: 'abandoned' }
      ]
    },
    {
      type: 'confirm',
      name: 'continueOnError',
      message: 'Continue if download errors occur?',
      default: true
    }
  ]);
  
  const args = [
    'tellet-admin-tool.js',
    'download-media',
    '-p', projectId,
    '-e', credentials.email,
    '-P', credentials.password,
    '-o', options.outputDir
  ];
  
  if (options.status) args.push('-s', options.status);
  if (options.continueOnError) args.push('--continue-on-error');
  
  console.log(chalk.cyan('\n🎬 Starting media download...\n'));
  await executeCommand('node', args);
}

async function handleHealthCheck(credentials) {
  const { checkType } = await inquirer.prompt([
    {
      type: 'list',
      name: 'checkType',
      message: 'What would you like to check?',
      choices: [
        { name: 'Single project', value: 'project' },
        { name: 'All projects in a workspace', value: 'workspace' }
      ]
    }
  ]);
  
  let args = [
    'tellet-admin-tool.js',
    'health-check',
    '-e', credentials.email,
    '-P', credentials.password
  ];
  
  if (checkType === 'project') {
    const projectId = await selectProjectWithMethod(credentials, selectProject, selectProjectWithFlow);
    if (!projectId) return;
    args.push('-p', projectId);
  } else {
    // For workspace, select organization then workspace
    const orgId = await selectOrganization(credentials);
    if (!orgId) return;
    
    const workspaceId = await selectWorkspace(credentials, orgId);
    if (!workspaceId) return;
    
    args.push('-w', workspaceId);
  }
  
  const { exportReport } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'exportReport',
      message: 'Export detailed report to JSON?',
      default: false
    }
  ]);
  
  if (exportReport) args.push('--export');
  
  console.log(chalk.cyan('\n🏥 Running health check...\n'));
  await executeCommand('node', args);
}

async function handleUsageAnalytics(credentials) {
  console.log(chalk.yellow('\n📊 Usage Analytics Configuration\n'));
  
  const { scope } = await inquirer.prompt([
    {
      type: 'list',
      name: 'scope',
      message: 'Select analytics scope:',
      choices: [
        { name: 'All Organizations & Workspaces', value: 'all' },
        { name: 'Specific Organization', value: 'organization' },
        { name: 'Specific Workspace', value: 'workspace' }
      ]
    }
  ]);
  
  const args = ['tellet-admin-tool.js', 'usage-analytics'];
  
  // Add credentials
  if (credentials.email) {
    args.push('--email', credentials.email);
  }
  if (credentials.password) {
    args.push('--password', credentials.password);
  }
  
  // Handle scope selection
  if (scope === 'organization') {
    const orgId = await selectOrganization(credentials);
    if (!orgId) return;
    args.push('-o', orgId);
  } else if (scope === 'workspace') {
    const orgId = await selectOrganization(credentials);
    if (!orgId) return;
    
    const workspaceId = await selectWorkspace(credentials, orgId);
    if (!workspaceId) return;
    args.push('-w', workspaceId);
  }
  
  // Date range options
  const { useDateRange } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'useDateRange',
      message: 'Filter by date range?',
      default: false
    }
  ]);
  
  if (useDateRange) {
    const dateAnswers = await inquirer.prompt([
      {
        type: 'input',
        name: 'startDate',
        message: 'Start date (YYYY-MM-DD):',
        validate: (input) => {
          if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) {
            return 'Please enter date in YYYY-MM-DD format';
          }
          return true;
        }
      },
      {
        type: 'input',
        name: 'endDate',
        message: 'End date (YYYY-MM-DD):',
        default: new Date().toISOString().split('T')[0],
        validate: (input) => {
          if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) {
            return 'Please enter date in YYYY-MM-DD format';
          }
          return true;
        }
      }
    ]);
    
    args.push('-s', dateAnswers.startDate);
    args.push('-e', dateAnswers.endDate);
  }
  
  // Additional options
  const { verbose, outputDir } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'verbose',
      message: 'Show detailed progress?',
      default: true
    },
    {
      type: 'input',
      name: 'outputDir',
      message: 'Output directory for reports:',
      default: './analytics'
    }
  ]);
  
  if (verbose) args.push('-v');
  args.push('--output-dir', outputDir);
  
  console.log(chalk.cyan('\n📊 Generating usage analytics...\n'));
  await executeCommand('node', args);
}

async function handleBulkInvite(credentials) {
  const orgId = await selectOrganization(credentials);
  if (!orgId) return;
  
  const { csvFile } = await inquirer.prompt([
    {
      type: 'input',
      name: 'csvFile',
      message: 'Path to CSV file with user data:',
      default: './users.csv',
      validate: (input) => {
        if (!fs.existsSync(input)) {
          return `File not found: ${input}`;
        }
        return true;
      }
    }
  ]);
  
  // Show CSV format example
  console.log(chalk.gray('\nCSV file should have columns: email,name'));
  console.log(chalk.gray('Example:'));
  console.log(chalk.gray('john.doe@example.com,John Doe'));
  console.log(chalk.gray('jane.smith@example.com,Jane Smith\n'));
  
  const { options } = await inquirer.prompt([
    {
      type: 'list',
      name: 'role',
      message: 'Default role for invited users:',
      choices: [
        { name: 'Viewer (read-only access)', value: 'viewer' },
        { name: 'Moderator (can manage projects)', value: 'moderator' },
        { name: 'Admin (full access)', value: 'admin' }
      ],
      default: 'viewer'
    },
    {
      type: 'confirm',
      name: 'dryRun',
      message: 'Run in dry mode (preview without sending invites)?',
      default: true
    }
  ]);
  
  const args = [
    'tellet-admin-tool.js',
    'bulk-invite',
    '-o', orgId,
    '-f', csvFile,
    '-r', options.role,
    '-e', credentials.email,
    '-P', credentials.password
  ];
  
  if (options.dryRun) args.push('--dry-run');
  
  console.log(chalk.cyan('\n👥 Starting bulk invite process...\n'));
  await executeCommand('node', args);
}

async function handleSettings(credentials) {
  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'Settings:',
      choices: [
        { name: '🔑 Update Credentials', value: 'credentials' },
        { name: '📁 View Configuration', value: 'config' },
        { name: '🔗 Change API URL', value: 'api-url' },
        { name: '← Back', value: 'back' }
      ]
    }
  ]);
  
  switch (action) {
    case 'credentials':
      console.log(chalk.yellow('\n📝 Enter new credentials:'));
      
      // Directly prompt for new credentials without checking existing ones
      const newCreds = await promptForCredentials(false);
      
      // Update the credentials object that's passed around
      credentials.email = newCreds.email;
      credentials.password = newCreds.password;
      
      console.log(chalk.green('✅ Credentials updated for this session'));
      
      // If user saved to .env, update the environment variables
      if (fs.existsSync('.env') && fs.readFileSync('.env', 'utf-8').includes(newCreds.email)) {
        process.env.TELLET_EMAIL = newCreds.email;
        process.env.TELLET_PASSWORD = newCreds.password;
      }
      
      return newCreds;
      
    case 'config':
      console.log(chalk.cyan('\nCurrent Configuration:'));
      console.log(chalk.gray(`Session Email: ${credentials.email}`));
      console.log(chalk.gray(`Session Password: ${'*'.repeat(8)}`));
      console.log(chalk.gray(`\nEnvironment Variables:`));
      console.log(chalk.gray(`  TELLET_EMAIL: ${DEFAULT_EMAIL || 'Not set'}`));
      console.log(chalk.gray(`  TELLET_PASSWORD: ${DEFAULT_PASSWORD ? '********' : 'Not set'}`));
      console.log(chalk.gray(`API URL: ${process.env.TELLET_API_URL || 'https://api.tellet.ai (default)'}`));
      console.log(chalk.gray(`\nConfiguration file: ${fs.existsSync('.env') ? '.env (found)' : '.env (not found)'}`));
      break;
      
    case 'api-url':
      const { apiUrl } = await inquirer.prompt([
        {
          type: 'input',
          name: 'apiUrl',
          message: 'Enter API URL:',
          default: process.env.TELLET_API_URL || 'https://api.tellet.ai'
        }
      ]);
      
      // Update .env file if it exists
      if (fs.existsSync('.env')) {
        let envContent = fs.readFileSync('.env', 'utf-8');
        if (envContent.includes('TELLET_API_URL=')) {
          envContent = envContent.replace(/TELLET_API_URL=.*/g, `TELLET_API_URL=${apiUrl}`);
        } else {
          envContent += `\nTELLET_API_URL=${apiUrl}`;
        }
        fs.writeFileSync('.env', envContent);
        console.log(chalk.green('✅ API URL updated in .env file'));
      }
      break;
  }
}

// Main wizard loop
async function mainLoop() {
  console.clear();
  console.log(banner);
  
  // Check credentials first
  const credentials = await checkCredentials();
  
  while (true) {
    console.log(''); // Empty line for spacing
    
    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'What would you like to do?',
        choices: mainMenuChoices,
        pageSize: 12
      }
    ]);
    
    switch (action) {
      case 'categorize':
        await handleCategorize(credentials);
        break;
        
      case 'export':
        await handleExport(credentials);
        break;
        
      case 'download-media':
        await handleDownloadMedia(credentials);
        break;
        
      case 'health-check':
        await handleHealthCheck(credentials);
        break;
        
      case 'usage-analytics':
        await handleUsageAnalytics(credentials);
        break;
        
      case 'bulk-invite':
        await handleBulkInvite(credentials);
        break;
        
      case 'list-orgs':
        console.log(chalk.cyan('\n🏢 Fetching organizations...\n'));
        await executeCommand('node', [
          'tellet-admin-tool.js',
          'list-orgs',
          '-e', credentials.email,
          '-P', credentials.password
        ]);
        break;
        
      case 'test-api':
        console.log(chalk.cyan('\n🔍 Testing API endpoints...\n'));
        await executeCommand('node', [
          'tellet-admin-tool.js',
          'test-api',
          '-e', credentials.email,
          '-P', credentials.password
        ]);
        break;
        
      case 'settings':
        const updatedCreds = await handleSettings(credentials);
        if (updatedCreds && updatedCreds.email) {
          // Update credentials if they were changed
          credentials.email = updatedCreds.email;
          credentials.password = updatedCreds.password;
        }
        break;
        
      case 'exit':
        console.log(chalk.green('\n👋 Goodbye!\n'));
        process.exit(0);
    }
    
    // Pause before showing menu again
    if (action !== 'exit') {
      await inquirer.prompt([
        {
          type: 'input',
          name: 'continue',
          message: chalk.gray('Press Enter to continue...'),
          prefix: ''
        }
      ]);
    }
  }
}

// Check for updates before starting
updateChecker.checkAndNotify();

// Start the wizard
mainLoop().catch(error => {
  console.error(chalk.red('\n❌ An error occurred:'), error.message);
  process.exit(1);
});