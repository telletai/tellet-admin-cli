#!/usr/bin/env node

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { program } = require('commander');
const csv = require('csv-parse');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

// Load environment variables if .env file exists
try {
  require('dotenv').config();
} catch (e) {
  // dotenv is optional, continue without it
}

// Import update checker
const UpdateChecker = require('./update-checker');
const updateChecker = new UpdateChecker();

// Configuration
const API_BASE_URL = process.env.TELLET_API_URL || 'https://api.tellet.ai';
const DEFAULT_EMAIL = process.env.TELLET_EMAIL || process.env.TELLET_ADMIN_EMAIL;
const DEFAULT_PASSWORD = process.env.TELLET_PASSWORD || process.env.TELLET_ADMIN_PASSWORD;
const API_ENDPOINTS = {
  login: '/users/login',
  // Dashboard endpoints - these need organization and workspace IDs
  organizations: '/organizations',
  projects: '/organizations/:organizationId/workspaces/:workspaceId/projects',
  projectDetail: '/organizations/:organizationId/workspaces/:workspaceId/projects/:projectId',
  workspaces: '/organizations/:organizationId/workspaces',
  // Analyzer endpoints
  analysis: '/analyzer/results',
  categoriesAI: '/analyzer/categorization',
  categoriesGet: '/analyzer/categorization',
  interviewQuestions: '/analyzer/results',
  // Export endpoints
  exportConversation: '/analyzer/results/per_respondent/export',
  exportAllConversations: '/analyzer/results/per_respondent/export_all',
  exportOverview: '/analyzer/results/per_conversation/export',
  // Conversation endpoints
  conversations: '/analyzer/results',
  conversationUpdate: '/conversations',
};

// Axios instance with interceptor for auth
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
let authToken = null;
api.interceptors.request.use((config) => {
  if (authToken) {
    config.headers.Authorization = `Bearer ${authToken}`;
  }
  return config;
});

// Utility functions
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Get user's organizations
async function getOrganizations() {
  try {
    const response = await api.get(API_ENDPOINTS.organizations);
    return response.data || [];
  } catch (error) {
    console.error('Failed to get organizations:', error.message);
    return [];
  }
}

// Get workspaces for an organization
async function getWorkspaces(organizationId) {
  try {
    const url = API_ENDPOINTS.workspaces.replace(':organizationId', organizationId);
    const response = await api.get(url);
    return response.data || [];
  } catch (error) {
    console.error('Failed to get workspaces:', error.message);
    return [];
  }
}

// Get projects for a workspace
async function getProjects(organizationId, workspaceId) {
  try {
    const url = API_ENDPOINTS.projects
      .replace(':organizationId', organizationId)
      .replace(':workspaceId', workspaceId);
    const response = await api.get(url);
    return response.data || [];
  } catch (error) {
    console.error('Failed to get projects:', error.message);
    return [];
  }
}

// Find project in organization hierarchy
async function findProjectInOrganizations(projectId) {
  try {
    const organizations = await getOrganizations();
    
    for (const org of organizations) {
      const workspaces = await getWorkspaces(org._id);
      
      for (const workspace of workspaces) {
        const projects = await getProjects(org._id, workspace._id);
        
        const project = projects.find(p => p._id === projectId);
        if (project) {
          return {
            organization: org,
            workspace: workspace,
            project: project
          };
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error('Failed to find project in organizations:', error.message);
    return null;
  }
}

// Create export directory with proper hierarchy
async function createExportDirectory(projectId, baseOutputDir) {
  // Try to find the project in the organization hierarchy
  const hierarchy = await findProjectInOrganizations(projectId);
  
  let exportPath;
  if (hierarchy) {
    // Use actual organization and workspace IDs
    exportPath = path.join(
      baseOutputDir,
      hierarchy.organization._id,
      hierarchy.workspace._id,
      projectId
    );
  } else {
    // Fallback to project ID only if hierarchy not found
    console.log('⚠️  Could not determine organization/workspace hierarchy. Using project ID only.');
    exportPath = path.join(baseOutputDir, 'unknown_org', 'unknown_workspace', projectId);
  }
  
  // Create directory if it doesn't exist
  if (!fs.existsSync(exportPath)) {
    fs.mkdirSync(exportPath, { recursive: true });
  }
  
  return exportPath;
}

// Validate that credentials are provided
function validateCredentials(options) {
  if (!options.email || !options.password) {
    console.error('❌ Email and password are required.');
    console.error('   Provide them via -e/-P options or set environment variables:');
    console.error('   export TELLET_EMAIL=your-email@example.com');
    console.error('   export TELLET_PASSWORD=your-password');
    console.error('\n   Or create a .env file with:');
    console.error('   TELLET_EMAIL=your-email@example.com');
    console.error('   TELLET_PASSWORD=your-password');
    process.exit(1);
  }
}

async function login(email, password) {
  try {
    console.log('🔐 Authenticating...');
    const response = await api.post(API_ENDPOINTS.login, {
      email,
      password,
    });
    
    authToken = response.data.token || response.data.access_token;
    
    if (response.data.requires2FA) {
      throw new Error('This account requires 2FA authentication, which is not supported by this script.');
    }
    
    if (!authToken) {
      throw new Error('No authentication token received from server');
    }
    
    console.log('✅ Authentication successful');
    return authToken;
  } catch (error) {
    console.error('❌ Authentication failed:', error.response?.data?.message || error.message);
    throw error;
  }
}

// Export functions
async function exportConversations(projectId, outputDir, options) {
  try {
    console.log(`📥 Exporting conversations for project ${projectId}...`);
    
    // Create export directory with proper hierarchy
    const projectOutputDir = await createExportDirectory(projectId, outputDir);
    
    // Use the export all endpoint
    const response = await api.get(`${API_ENDPOINTS.exportAllConversations}/${projectId}`, {
      responseType: 'text',
    });
    
    const filename = `conversations_${projectId}_${new Date().toISOString().split('T')[0]}.csv`;
    const outputPath = path.join(projectOutputDir, filename);
    fs.writeFileSync(outputPath, response.data);
    
    console.log(`✅ Exported conversations to ${outputPath}`);
    return outputPath;
  } catch (error) {
    console.error('❌ Failed to export conversations:', error.response?.data?.message || error.message);
    throw error;
  }
}

async function exportConversationOverview(projectId, status, outputDir, options) {
  try {
    console.log(`📊 Exporting conversation overview...`);
    
    // Create export directory with proper hierarchy
    const projectOutputDir = await createExportDirectory(projectId, outputDir);
    
    // Use the export endpoint which includes all conversations
    const response = await api.get(`${API_ENDPOINTS.exportOverview}/${projectId}`, {
      responseType: 'text',
    });
    
    // Parse CSV to filter by status if requested
    const lines = response.data.split('\n').filter(line => line.trim());
    if (lines.length === 0) {
      console.log('⚠️  No data returned');
      return;
    }
    
    // Parse headers
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    console.log(`   Found ${lines.length - 1} conversations in export`);
    
    // For now, save the raw export since we don't have status in the export
    if (status) {
      console.log(`   ⚠️  Note: The export endpoint doesn't include status information.`);
      console.log(`      All conversations are exported regardless of status filter.`);
    }
    
    const filename = `conversation_overview_${projectId}_${status || 'all'}_${new Date().toISOString().split('T')[0]}.csv`;
    const outputPath = path.join(projectOutputDir, filename);
    fs.writeFileSync(outputPath, response.data);
    
    console.log(`✅ Exported conversation overview to ${outputPath}`);
    console.log(`   Total conversations: ${lines.length - 1}`);
    console.log(`   Columns: ${headers.join(', ')}`);
    
  } catch (error) {
    console.error('❌ Failed to export conversation overview:', error.response?.data?.message || error.message);
    throw error;
  }
}

async function updateConversationMetadata(projectId, csvPath, matchField, options) {
  try {
    console.log(`📝 Updating conversation metadata from ${csvPath}...`);
    console.log(`   Matching on field: ${matchField}`);
    
    // Read and parse CSV
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const records = await new Promise((resolve, reject) => {
      csv.parse(csvContent, {
        columns: true,
        skip_empty_lines: true,
      }, (err, records) => {
        if (err) reject(err);
        else resolve(records);
      });
    });
    
    console.log(`   Found ${records.length} records in CSV`);
    
    // Get all conversations for the project
    const conversationsResponse = await api.get(`${API_ENDPOINTS.conversations}/${projectId}/conversations`);
    const conversations = conversationsResponse.data || [];
    console.log(`   Found ${conversations.length} conversations in project`);
    
    // Create lookup map for conversations
    const conversationLookup = {};
    conversations.forEach(conv => {
      // Check if match field exists in conversation metadata or root level
      const matchValue = conv.metadata?.[matchField] || conv[matchField];
      if (matchValue) {
        conversationLookup[matchValue] = conv;
      }
    });
    
    let updated = 0;
    let skipped = 0;
    let errors = 0;
    
    // Process each CSV record
    for (const record of records) {
      const matchValue = record[matchField];
      
      if (!matchValue) {
        console.log(`   ⚠️  Skipping row - no value for match field '${matchField}'`);
        skipped++;
        continue;
      }
      
      const conversation = conversationLookup[matchValue];
      
      if (!conversation) {
        console.log(`   ⚠️  No conversation found with ${matchField}='${matchValue}'`);
        skipped++;
        continue;
      }
      
      try {
        // Prepare metadata update (exclude the match field itself)
        const metadataUpdate = {};
        Object.keys(record).forEach(key => {
          if (key !== matchField && record[key] !== '') {
            metadataUpdate[key] = record[key];
          }
        });
        
        if (Object.keys(metadataUpdate).length === 0) {
          console.log(`   ⏭️  No metadata to update for ${matchField}='${matchValue}'`);
          skipped++;
          continue;
        }
        
        // Update conversation metadata
        const updatePayload = {
          metadata: {
            ...conversation.metadata,
            ...metadataUpdate
          }
        };
        
        if (options.dryRun) {
          console.log(`   🔍 [DRY RUN] Would update conversation ${conversation._id} with:`, metadataUpdate);
        } else {
          // NOTE: The Tellet API currently doesn't have a direct endpoint for updating conversation metadata
          // This functionality would need to be implemented in the backend first
          // For now, this serves as a placeholder showing the intended functionality
          console.log(`   ⚠️  Metadata update endpoint not yet available in Tellet API`);
          console.log(`      Would update conversation ${conversation._id} with:`, metadataUpdate);
          
          // Uncomment when endpoint is available:
          // await api.patch(`/conversations/${conversation._id}/metadata`, metadataUpdate);
          // console.log(`   ✅ Updated conversation ${conversation._id}`);
          
          skipped++;
          continue;
        }
        
        updated++;
        
        // Add delay to avoid rate limiting
        if (options.delay > 0) {
          await delay(options.delay);
        }
        
      } catch (error) {
        console.error(`   ❌ Failed to update conversation ${conversation._id}:`, error.message);
        errors++;
        
        if (!options.continueOnError) {
          throw error;
        }
      }
    }
    
    // Summary
    console.log('\n📊 Metadata Update Summary:');
    console.log(`   Updated: ${updated}`);
    console.log(`   Skipped: ${skipped}`);
    console.log(`   Errors: ${errors}`);
    
    if (options.dryRun) {
      console.log('\n🔍 [DRY RUN MODE - No changes were made]');
    }
    
  } catch (error) {
    console.error('❌ Failed to update metadata:', error.message);
    throw error;
  }
}

// CLI setup
program
  .name('tellet-admin-tool')
  .description('Tellet Admin Tool - Manage categories, export data, transcripts, download media, and update metadata')
  .version('2.5.1');

// Auto-categorize command
program
  .command('categorize')
  .description('Auto-generate AI categories for project questions')
  .requiredOption('-p, --project <id>', 'Project ID')
  .option('-e, --email <email>', 'Email for authentication', DEFAULT_EMAIL)
  .option('-P, --password <password>', 'Password for authentication', DEFAULT_PASSWORD)
  .option('-u, --url <url>', 'API base URL', API_BASE_URL)
  .option('-d, --dry-run', 'Run in dry mode without making changes', false)
  .option('-v, --verbose', 'Show detailed output', false)
  .option('--skip-run', 'Generate categories but skip running categorization', false)
  .option('--delay <ms>', 'Delay between operations in milliseconds', parseInt, 1000)
  .option('--continue-on-error', 'Continue processing even if an error occurs', false)
  .action(async (options) => {
    try {
      validateCredentials(options);
      
      if (options.url) {
        api.defaults.baseURL = options.url;
      }
      await login(options.email, options.password);
      
      // Run the categorization logic inline
      const autoCategorize = require('./auto-categorize-logic.js');
      await autoCategorize.processProject(api, options.project, options);
      
      console.log('\n✅ Auto-categorization completed successfully!');
      process.exit(0);
    } catch (error) {
      console.error('\n❌ Auto-categorization failed:', error.message);
      process.exit(1);
    }
  });

// Export conversations command
program
  .command('export-conversations')
  .description('Export all conversation transcripts for a project')
  .requiredOption('-p, --project <id>', 'Project ID')
  .option('-e, --email <email>', 'Email for authentication', DEFAULT_EMAIL)
  .option('-P, --password <password>', 'Password for authentication', DEFAULT_PASSWORD)
  .option('-o, --output-dir <path>', 'Output directory', path.join(process.cwd(), 'exports'))
  .option('-u, --url <url>', 'API base URL', API_BASE_URL)
  .action(async (options) => {
    try {
      validateCredentials(options);
      
      if (options.url) {
        api.defaults.baseURL = options.url;
      }
      await login(options.email, options.password);
      await exportConversations(options.project, options.outputDir, options);
      console.log(`\n✅ Export completed! Check the ${options.outputDir} directory for your export.`);
      process.exit(0);
    } catch (error) {
      console.error('\n❌ Export failed:', error.message);
      process.exit(1);
    }
  });

// Export overview command
program
  .command('export-overview')
  .description('Export conversation overview with metadata')
  .requiredOption('-p, --project <id>', 'Project ID')
  .option('-e, --email <email>', 'Email for authentication', DEFAULT_EMAIL)
  .option('-P, --password <password>', 'Password for authentication', DEFAULT_PASSWORD)
  .option('-s, --status <status>', 'Filter by status (e.g., DIGESTED, ABANDONED)')
  .option('-o, --output-dir <path>', 'Output directory', path.join(process.cwd(), 'exports'))
  .option('-u, --url <url>', 'API base URL', API_BASE_URL)
  .action(async (options) => {
    try {
      validateCredentials(options);
      
      if (options.url) {
        api.defaults.baseURL = options.url;
      }
      await login(options.email, options.password);
      await exportConversationOverview(options.project, options.status, options.outputDir, options);
      console.log(`\n✅ Export completed! Check the ${options.outputDir} directory for your export.`);
      process.exit(0);
    } catch (error) {
      console.error('\n❌ Export failed:', error.message);
      process.exit(1);
    }
  });

// Export transcripts command
program
  .command('export-transcripts')
  .description('Export conversation transcripts in text format for qualitative analysis')
  .option('-e, --email <email>', 'Email for authentication', DEFAULT_EMAIL)
  .option('-P, --password <password>', 'Password for authentication', DEFAULT_PASSWORD)
  .option('-p, --projects <ids...>', 'Project IDs to export (space-separated)')
  .option('-w, --workspaces <ids...>', 'Workspace IDs to export all projects from (space-separated)')
  .option('-o, --output-dir <path>', 'Output directory', path.join(process.cwd(), 'exports'))
  .option('-q, --split-by-question', 'Create separate files for each question', false)
  .option('--include-unrelated', 'Include messages without relates_to field', true)
  .option('-u, --url <url>', 'API base URL', API_BASE_URL)
  .option('--delay <ms>', 'Delay between API calls in milliseconds', parseInt, 100)
  .option('--continue-on-error', 'Continue processing even if an error occurs', false)
  .action(async (options) => {
    try {
      validateCredentials(options);
      
      if (options.url) {
        api.defaults.baseURL = options.url;
      }
      
      // Validate that at least one project or workspace is provided
      if ((!options.projects || options.projects.length === 0) && 
          (!options.workspaces || options.workspaces.length === 0)) {
        console.error('❌ You must provide at least one project ID (-p) or workspace ID (-w)');
        process.exit(1);
      }
      
      await login(options.email, options.password);
      
      // Import and run the transcript export
      const { exportTranscripts } = require('./transcript-export.js');
      await exportTranscripts(api, {
        projects: options.projects || [],
        workspaces: options.workspaces || [],
        outputDir: options.outputDir,
        splitByQuestion: options.splitByQuestion,
        includeUnrelatedMessages: options.includeUnrelated,
        delay: options.delay,
        continueOnError: options.continueOnError
      }, createExportDirectory);
      
      console.log(`\n✅ Export completed! Check the ${options.outputDir} directory for your transcripts.`);
      process.exit(0);
    } catch (error) {
      console.error('\n❌ Export failed:', error.message);
      process.exit(1);
    }
  });

// Health check command
program
  .command('health-check')
  .description('Check project health and identify issues')
  .option('-p, --project <id>', 'Check specific project')
  .option('-w, --workspace <id>', 'Check all projects in workspace')
  .option('--org <id>', 'Organization ID (optional, speeds up workspace lookup)')
  .option('-e, --email <email>', 'Email for authentication', DEFAULT_EMAIL)
  .option('-P, --password <password>', 'Password for authentication', DEFAULT_PASSWORD)
  .option('--export', 'Export detailed report to JSON', false)
  .option('-o, --output-dir <path>', 'Output directory for report', path.join(process.cwd(), 'reports'))
  .option('-u, --url <url>', 'API base URL', API_BASE_URL)
  .option('--delay <ms>', 'Delay between checks in milliseconds', parseInt, 100)
  .action(async (options) => {
    try {
      validateCredentials(options);
      
      // Validate that either project or workspace is provided
      if (!options.project && !options.workspace) {
        console.error('❌ You must provide either a project ID (-p) or workspace ID (-w)');
        process.exit(1);
      }
      
      if (options.url) {
        api.defaults.baseURL = options.url;
      }
      
      await login(options.email, options.password);
      
      // Import and run the health check
      const { healthCheck } = require('./project-health-check.js');
      await healthCheck(api, {
        projectId: options.project,
        workspaceId: options.workspace,
        organizationId: options.org,
        export: options.export,
        outputDir: options.outputDir,
        delay: options.delay
      });
      
      process.exit(0);
    } catch (error) {
      console.error('\n❌ Health check failed:', error.message);
      process.exit(1);
    }
  });

// Download media command
program
  .command('download-media')
  .description('Download all media files (audio, video, images) from conversations')
  .requiredOption('-p, --project <id>', 'Project ID')
  .option('-c, --conversation <id>', 'Specific conversation ID (optional)')
  .option('-s, --status <status>', 'Filter by conversation status (e.g., digested)')
  .option('-e, --email <email>', 'Email for authentication', DEFAULT_EMAIL)
  .option('-P, --password <password>', 'Password for authentication', DEFAULT_PASSWORD)
  .option('-o, --output-dir <path>', 'Output directory', path.join(process.cwd(), 'media-downloads'))
  .option('-u, --url <url>', 'API base URL', API_BASE_URL)
  .option('--delay <ms>', 'Delay between downloads in milliseconds', parseInt, 200)
  .option('--continue-on-error', 'Continue processing even if errors occur', false)
  .action(async (options) => {
    try {
      validateCredentials(options);
      
      if (options.url) {
        api.defaults.baseURL = options.url;
      }
      
      await login(options.email, options.password);
      
      // Import and run the media download
      const { downloadMedia } = require('./media-download.js');
      await downloadMedia(api, {
        projectId: options.project,
        conversationId: options.conversation,
        status: options.status,
        outputDir: options.outputDir,
        delay: options.delay,
        continueOnError: options.continueOnError
      });
      
      console.log(`\n✅ Media download completed! Check the ${options.outputDir} directory.`);
      process.exit(0);
    } catch (error) {
      console.error('\n❌ Media download failed:', error.message);
      process.exit(1);
    }
  });

// List organizations and workspaces command
program
  .command('list-orgs')
  .description('List your organizations, workspaces, and projects')
  .option('-e, --email <email>', 'Email for authentication', DEFAULT_EMAIL)
  .option('-P, --password <password>', 'Password for authentication', DEFAULT_PASSWORD)
  .option('-u, --url <url>', 'API base URL', API_BASE_URL)
  .option('--show-ids', 'Show full IDs (not truncated)', false)
  .action(async (options) => {
    try {
      validateCredentials(options);
      
      if (options.url) {
        api.defaults.baseURL = options.url;
      }
      
      await login(options.email, options.password);
      
      console.log('\n🏢 Fetching your organizations...\n');
      
      const organizations = await getOrganizations();
      if (organizations.length === 0) {
        console.log('❌ No organizations found or unable to access organizations');
        console.log('   This might require different permissions.');
        process.exit(1);
      }
      
      for (const org of organizations) {
        const orgId = options.showIds ? org._id : org._id.slice(-6);
        console.log(`📂 Organization: ${org.name}`);
        console.log(`   ID: ${orgId}`);
        console.log(`   Role: ${org.user_role || 'member'}`);
        
        // Get workspaces for this org
        const workspaces = await getWorkspaces(org._id);
        if (workspaces.length > 0) {
          console.log(`   Workspaces:`);
          
          for (const workspace of workspaces) {
            const wsId = options.showIds ? workspace._id : workspace._id.slice(-6);
            console.log(`\n   📁 ${workspace.name}`);
            console.log(`      ID: ${wsId}`);
            console.log(`      Role: ${workspace.user_role || 'member'}`);
            
            // Get projects for this workspace
            const projects = await getProjects(org._id, workspace._id);
            if (projects.length > 0) {
              console.log(`      Projects:`);
              for (const project of projects) {
                const projId = options.showIds ? project._id : project._id.slice(-6);
                console.log(`      📄 ${project.title || 'Untitled'} (${projId}) - ${project.status}`);
              }
            } else {
              console.log(`      No projects`);
            }
          }
        } else {
          console.log(`   No workspaces`);
        }
        console.log('\n' + '-'.repeat(60) + '\n');
      }
      
      console.log('💡 Tips:');
      console.log('   • Use --show-ids flag to see full IDs');
      console.log('   • Dashboard endpoints require organization and workspace IDs');
      console.log('   • Most analyzer endpoints only need project IDs');
      process.exit(0);
    } catch (error) {
      console.error('\n❌ Failed to list organizations:', error.message);
      process.exit(1);
    }
  });

// Test API endpoints command
program
  .command('test-api')
  .description('Test all API endpoints used by the admin tool')
  .option('-p, --project <id>', 'Test project ID (optional, will auto-detect)')
  .option('-w, --workspace <id>', 'Test workspace ID (optional, will auto-detect)')
  .option('-c, --conversation <id>', 'Test conversation ID (optional, will auto-detect)')
  .option('-e, --email <email>', 'Email for authentication', DEFAULT_EMAIL)
  .option('-P, --password <password>', 'Password for authentication', DEFAULT_PASSWORD)
  .option('--export', 'Export detailed report to JSON', false)
  .option('-o, --output-dir <path>', 'Output directory for report', path.join(process.cwd(), 'reports'))
  .option('-u, --url <url>', 'API base URL', API_BASE_URL)
  .option('--delay <ms>', 'Delay between tests in milliseconds', parseInt, 100)
  .action(async (options) => {
    try {
      validateCredentials(options);
      
      if (options.url) {
        api.defaults.baseURL = options.url;
      }
      
      await login(options.email, options.password);
      
      // Import and run the API test
      const { testAllEndpoints } = require('./api-test.js');
      await testAllEndpoints(api, {
        projectId: options.project,
        workspaceId: options.workspace,
        conversationId: options.conversation,
        export: options.export,
        outputDir: options.outputDir,
        delay: options.delay
      });
      
      process.exit(0);
    } catch (error) {
      console.error('\n❌ API test failed:', error.message);
      process.exit(1);
    }
  });

// Update metadata command
program
  .command('update-metadata')
  .description('Update conversation metadata from CSV file')
  .requiredOption('-p, --project <id>', 'Project ID')
  .requiredOption('-f, --file <path>', 'CSV file path')
  .requiredOption('-m, --match-field <field>', 'Field to match conversations (e.g., conversation_id, email)')
  .option('-e, --email <email>', 'Email for authentication', DEFAULT_EMAIL)
  .option('-P, --password <password>', 'Password for authentication', DEFAULT_PASSWORD)
  .option('-u, --url <url>', 'API base URL', API_BASE_URL)
  .option('-d, --dry-run', 'Preview changes without applying them', false)
  .option('--delay <ms>', 'Delay between updates in milliseconds', parseInt, 500)
  .option('--continue-on-error', 'Continue processing even if an error occurs', false)
  .action(async (options) => {
    try {
      validateCredentials(options);
      
      if (options.url) {
        api.defaults.baseURL = options.url;
      }
      await login(options.email, options.password);
      await updateConversationMetadata(options.project, options.file, options.matchField, options);
      process.exit(0);
    } catch (error) {
      console.error('\n❌ Update failed:', error.message);
      process.exit(1);
    }
  });

// Bulk invite users command
program
  .command('bulk-invite')
  .description('Bulk invite users to an organization from CSV file')
  .requiredOption('-o, --organization <id>', 'Organization ID')
  .requiredOption('-f, --file <path>', 'CSV file path (must contain email and name columns)')
  .option('-r, --role <role>', 'User role (admin, moderator, viewer)', 'viewer')
  .option('-e, --email <email>', 'Email for authentication', DEFAULT_EMAIL)
  .option('-P, --password <password>', 'Password for authentication', DEFAULT_PASSWORD)
  .option('-u, --url <url>', 'API base URL', API_BASE_URL)
  .option('-d, --dry-run', 'Preview invitations without sending them', false)
  .option('--output-dir <path>', 'Output directory for results', path.join(process.cwd(), 'exports'))
  .option('--delay <ms>', 'Delay between invitations in milliseconds', parseInt, 500)
  .action(async (options) => {
    try {
      validateCredentials(options);
      
      if (options.url) {
        api.defaults.baseURL = options.url;
      }
      await login(options.email, options.password);
      
      // Import and run bulk invite
      const { bulkInviteUsers } = require('./bulk-invite.js');
      await bulkInviteUsers(api, {
        organizationId: options.organization,
        csvFile: options.file,
        role: options.role,
        outputDir: options.outputDir,
        dryRun: options.dryRun,
        delay: options.delay
      });
      
      process.exit(0);
    } catch (error) {
      console.error('\n❌ Bulk invite failed:', error.message);
      process.exit(1);
    }
  });

// Usage analytics command
program
  .command('usage-analytics')
  .description('Generate usage analytics report for organizations and workspaces')
  .option('-o, --organization <id>', 'Specific organization ID (optional)')
  .option('-w, --workspace <id>', 'Specific workspace ID (optional)')
  .option('-s, --start-date <date>', 'Start date for analytics (YYYY-MM-DD)')
  .option('-e, --end-date <date>', 'End date for analytics (YYYY-MM-DD, default: today)')
  .option('--output-dir <path>', 'Output directory for reports (default: ./analytics)')
  .option('-v, --verbose', 'Show detailed progress')
  .option('--email <email>', 'Email for authentication')
  .option('--password <password>', 'Password for authentication')
  .option('-u, --url <url>', 'API base URL', API_BASE_URL)
  .action(async (options) => {
    const UsageAnalytics = require('./usage-analytics');
    
    try {
      // Get credentials
      const email = options.email || DEFAULT_EMAIL;
      const password = options.password || DEFAULT_PASSWORD;
      
      if (!email || !password) {
        console.error('Error: Email and password are required. Set TELLET_EMAIL and TELLET_PASSWORD environment variables or use --email and --password flags.');
        process.exit(1);
      }
      
      // Update API base URL if provided
      if (options.url) {
        api.defaults.baseURL = options.url;
      }
      
      // Authenticate
      const loginData = { email, password };
      const loginResponse = await api.post(API_ENDPOINTS.login, loginData);
      authToken = loginResponse.data.token;
      
      console.log('✅ Authentication successful');
      
      // Create analytics instance
      const analytics = new UsageAnalytics(api, {
        startDate: options.startDate,
        endDate: options.endDate,
        outputDir: options.outputDir,
        verbose: options.verbose,
        organizationId: options.organization,
        workspaceId: options.workspace
      });
      
      // Run analytics
      await analytics.run();
      
    } catch (error) {
      console.error('❌ Error:', error.response?.data?.message || error.message);
      process.exit(1);
    }
  });

// Interactive wizard command
program
  .command('wizard')
  .description('Launch interactive wizard mode')
  .action(() => {
    // Launch the wizard
    require('child_process').spawn('node', ['tellet-wizard.js'], {
      stdio: 'inherit',
      shell: true
    });
  });

program
  .command('update')
  .description('Check for and install updates to the Tellet Admin CLI')
  .action(async () => {
    await updateChecker.performUpdate();
  });

// Check for updates on startup (silent check)
updateChecker.checkAndNotify();

program.parse();