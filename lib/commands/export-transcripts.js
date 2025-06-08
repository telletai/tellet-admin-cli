/**
 * @fileoverview Export transcripts command handler for Tellet Admin CLI.
 * Provides streaming export of conversation transcripts with support for
 * splitting by question and handling large datasets efficiently.
 * 
 * @module lib/commands/export-transcripts
 */

const fs = require('fs').promises;
const { createWriteStream } = require('fs');
const path = require('path');
const { requireAuth } = require('../auth');
const { validateOptions } = require('../validation');
const { logger, ProgressTracker } = require('../logger');
const { ErrorHandler } = require('../errors');
const { createExportDirectory, ensureDirectoryExists } = require('../utils/file-utils');
const { streamPaginatedAPI, createBatchStream } = require('../utils/stream-utils');

/**
 * Command options schema for validation.
 * Supports multiple projects, workspaces, and export configurations.
 * 
 * @type {Object}
 * @private
 */
const optionsSchema = {
  projects: { type: 'array' },
  workspaces: { type: 'array' },
  outputDir: { type: 'string', default: './exports' },
  splitByQuestion: { type: 'boolean', default: false },
  includeUnrelated: { type: 'boolean', default: true },
  delay: { type: 'int', min: 0, max: 600000, default: 100 },
  continueOnError: { type: 'boolean', default: false },
  batchSize: { type: 'int', min: 1, max: 1000, default: 50 }
};

/**
 * Export transcripts command handler with streaming support.
 * Handles large datasets efficiently using streams and batching.
 * 
 * @param {Object} options - Command options
 * @param {string[]} [options.projects] - Array of project IDs to export
 * @param {string[]} [options.workspaces] - Array of workspace IDs to export
 * @param {string} [options.outputDir='./exports'] - Output directory path
 * @param {boolean} [options.splitByQuestion=false] - Create separate files per question
 * @param {boolean} [options.includeUnrelated=true] - Include unrelated messages
 * @param {number} [options.delay=100] - Delay between API calls in ms
 * @param {boolean} [options.continueOnError=false] - Continue on errors
 * @param {number} [options.batchSize=50] - Conversations per batch
 * @param {Object} context - Command context
 * @param {AxiosInstance} context.api - Authenticated API client
 * @returns {Promise<Array<Object>>} Array of export results per project
 * @throws {Error} If no projects found or export fails
 * @example
 * const results = await exportTranscriptsHandler(
 *   { projects: ['projectId1', 'projectId2'], splitByQuestion: true },
 *   { api: authenticatedClient }
 * );
 */
async function exportTranscriptsHandler(options, context) {
  try {
    // Validate options
    const validated = validateOptions(options, optionsSchema);
    const { api } = context;
    
    logger.header('Export Transcripts');
    
    // Collect projects to export
    const projects = await collectProjects(validated, api);
    
    if (projects.length === 0) {
      logger.warn('No projects found to export');
      return;
    }
    
    logger.info(`Found ${projects.length} projects to export`);
    
    const results = [];
    const tracker = new ProgressTracker(projects.length, { logger });
    
    // Process each project
    for (const project of projects) {
      try {
        const result = await exportProjectTranscripts(project, validated, api, tracker);
        results.push(result);
      } catch (error) {
        logger.error(`Failed to export project ${project._id}: ${error.message}`);
        if (!validated.continueOnError) {
          throw error;
        }
      }
      
      tracker.increment();
    }
    
    tracker.complete();
    logger.success(`Exported transcripts for ${results.length} projects`);
    
    return results;
  } catch (error) {
    ErrorHandler.handle(error, { operation: 'export-transcripts', exit: false });
    throw error;
  }
}

/**
 * Collect projects based on input options.
 * Resolves project IDs and workspace projects.
 * 
 * @param {Object} options - Validated command options
 * @param {string[]} [options.projects] - Direct project IDs
 * @param {string[]} [options.workspaces] - Workspace IDs to get projects from
 * @param {AxiosInstance} api - API client
 * @returns {Promise<Array<Object>>} Array of project objects
 * @private
 */
async function collectProjects(options, api) {
  const projects = [];
  
  // Add directly specified projects
  if (options.projects && options.projects.length > 0) {
    for (const projectId of options.projects) {
      try {
        // We need basic project info - try to get it from the API
        const project = { _id: projectId, title: projectId };
        projects.push(project);
      } catch (error) {
        logger.warn(`Failed to get project ${projectId}: ${error.message}`);
      }
    }
  }
  
  // Add projects from workspaces
  if (options.workspaces && options.workspaces.length > 0) {
    for (const workspaceId of options.workspaces) {
      try {
        // Find the workspace in organizations
        const orgs = await api.get('/organizations');
        
        for (const org of orgs) {
          const workspaceData = await api.get(`/organizations/${org._id}/workspaces`);
          const allWorkspaces = [
            ...(workspaceData.privateWorkspaces || workspaceData.priv || []),
            ...(workspaceData.sharedWorkspaces || workspaceData.shared || [])
          ];
          
          const workspace = allWorkspaces.find(ws => ws._id === workspaceId);
          if (workspace) {
            const wsProjects = await api.get(
              `/organizations/${org._id}/workspaces/${workspaceId}/projects`
            );
            projects.push(...wsProjects);
            break;
          }
        }
      } catch (error) {
        logger.warn(`Failed to get workspace ${workspaceId}: ${error.message}`);
      }
    }
  }
  
  return projects;
}

/**
 * Export transcripts for a single project using streaming.
 * Creates output files based on export configuration.
 * 
 * @param {Object} project - Project to export
 * @param {string} project._id - Project ID
 * @param {string} [project.title] - Project title
 * @param {Object} options - Export options
 * @param {AxiosInstance} api - API client
 * @param {ProgressTracker} tracker - Progress tracker instance
 * @returns {Promise<Object>} Export result with file paths
 * @returns {Promise<string>} returns.projectId - Project ID
 * @returns {Promise<string>} returns.projectName - Project name
 * @returns {Promise<string[]>} returns.files - Array of created file paths
 * @returns {Promise<string>} returns.exportPath - Export directory path
 * @private
 */
async function exportProjectTranscripts(project, options, api, tracker) {
  const projectId = project._id;
  const projectName = project.title || project.name || projectId;
  
  logger.info(`Exporting project: ${projectName}`);
  
  // Create export directory
  const exportPath = await createExportDirectory(projectId, options.outputDir, api);
  await ensureDirectoryExists(exportPath);
  
  // Get project questions
  let questions = [];
  try {
    const questionsData = await api.get(`/analyzer/results/${projectId}/interview_questions`);
    questions = Array.isArray(questionsData) ? questionsData : [];
  } catch (error) {
    logger.warn(`Failed to get questions for project ${projectId}: ${error.message}`);
  }
  
  const timestamp = new Date().toISOString().split('T')[0];
  const files = [];
  
  if (options.splitByQuestion && questions.length > 0) {
    // Export each question to a separate file
    for (const question of questions) {
      const fileName = `${projectId}_Q${question.id}_${timestamp}_transcripts.txt`;
      const filePath = path.join(exportPath, fileName);
      
      await exportQuestionTranscripts(projectId, question, filePath, options, api);
      files.push(filePath);
    }
    
    // Export unrelated messages if requested
    if (options.includeUnrelated) {
      const fileName = `${projectId}_unrelated_${timestamp}_transcripts.txt`;
      const filePath = path.join(exportPath, fileName);
      
      await exportUnrelatedTranscripts(projectId, filePath, options, api);
      files.push(filePath);
    }
  } else {
    // Export all conversations to a single file
    const fileName = `${projectId}_${timestamp}_transcripts.txt`;
    const filePath = path.join(exportPath, fileName);
    
    await exportAllTranscripts(projectId, filePath, options, api, questions);
    files.push(filePath);
  }
  
  return {
    projectId,
    projectName,
    files,
    exportPath
  };
}

/**
 * Export all transcripts for a project using streaming.
 * Writes all conversations to a single file with metadata and summaries.
 * 
 * @param {string} projectId - Project ID
 * @param {string} filePath - Output file path
 * @param {Object} options - Export options
 * @param {number} options.batchSize - Batch size for streaming
 * @param {number} options.delay - Delay between batches
 * @param {AxiosInstance} api - API client
 * @param {Array<Object>} questions - Project questions for header
 * @returns {Promise<void>}
 * @throws {Error} If write stream fails
 * @private
 */
async function exportAllTranscripts(projectId, filePath, options, api, questions) {
  const writeStream = createWriteStream(filePath);
  
  // Write header
  writeStream.write(`Transcript Export - Project: ${projectId}\n`);
  writeStream.write(`Generated: ${new Date().toISOString()}\n`);
  writeStream.write('='.repeat(80) + '\n\n');
  
  // Write questions summary
  if (questions.length > 0) {
    writeStream.write('Interview Questions:\n');
    questions.forEach((q, i) => {
      writeStream.write(`${i + 1}. ${q.question}\n`);
    });
    writeStream.write('\n' + '='.repeat(80) + '\n\n');
  }
  
  let conversationCount = 0;
  
  // Stream conversations with batching
  const conversationStream = streamPaginatedAPI(
    api,
    `/analyzer/results/${projectId}/conversations`,
    { pageSize: options.batchSize }
  );
  
  for await (const conversation of conversationStream) {
    conversationCount++;
    
    // Write conversation header
    writeStream.write(`\nConversation ${conversationCount}: ${conversation._id}\n`);
    writeStream.write('-'.repeat(60) + '\n');
    
    // Write metadata
    if (conversation.metadata) {
      writeStream.write('Metadata:\n');
      Object.entries(conversation.metadata).forEach(([key, value]) => {
        writeStream.write(`  ${key}: ${value}\n`);
      });
    }
    
    // Write summary if available
    if (conversation.digest?.summary) {
      writeStream.write(`\nSummary: ${conversation.digest.summary}\n`);
    }
    
    writeStream.write('\nTranscript:\n');
    
    // Write messages
    const messages = conversation.messages || [];
    messages.forEach((message, index) => {
      const role = message.role === 'assistant' ? 'Interviewer' : 'Participant';
      const timestamp = new Date(message.created_at || message.createdAt).toLocaleString();
      
      writeStream.write(`\n[${index + 1}] ${role} (${timestamp}):\n`);
      writeStream.write(message.text + '\n');
    });
    
    writeStream.write('\n' + '='.repeat(80) + '\n');
    
    // Add delay between conversations
    if (options.delay > 0) {
      await new Promise(resolve => setTimeout(resolve, options.delay));
    }
  }
  
  // Write footer
  writeStream.write(`\nTotal Conversations: ${conversationCount}\n`);
  writeStream.write(`Export completed at: ${new Date().toISOString()}\n`);
  
  return new Promise((resolve, reject) => {
    writeStream.end((err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

/**
 * Export transcripts for a specific question.
 * Filters conversations to include only messages related to the question.
 * 
 * @param {string} projectId - Project ID
 * @param {Object} question - Question object
 * @param {string} question.id - Question ID
 * @param {string} question.question - Question text
 * @param {string} filePath - Output file path
 * @param {Object} options - Export options
 * @param {number} options.batchSize - Batch size for streaming
 * @param {AxiosInstance} api - API client
 * @returns {Promise<void>}
 * @throws {Error} If write stream fails
 * @private
 */
async function exportQuestionTranscripts(projectId, question, filePath, options, api) {
  const writeStream = createWriteStream(filePath);
  
  // Write header
  writeStream.write(`Transcript Export - Question: ${question.question}\n`);
  writeStream.write(`Project: ${projectId}\n`);
  writeStream.write(`Generated: ${new Date().toISOString()}\n`);
  writeStream.write('='.repeat(80) + '\n\n');
  
  let responseCount = 0;
  
  // Stream conversations
  const conversationStream = streamPaginatedAPI(
    api,
    `/analyzer/results/${projectId}/conversations`,
    { pageSize: options.batchSize }
  );
  
  for await (const conversation of conversationStream) {
    // Find messages related to this question
    const relatedMessages = (conversation.messages || []).filter(
      msg => msg.relates_to === question.id
    );
    
    if (relatedMessages.length > 0) {
      responseCount++;
      
      writeStream.write(`\nResponse ${responseCount} (${conversation._id}):\n`);
      writeStream.write('-'.repeat(40) + '\n');
      
      relatedMessages.forEach((message) => {
        const role = message.role === 'assistant' ? 'Interviewer' : 'Participant';
        writeStream.write(`\n${role}: ${message.text}\n`);
      });
      
      writeStream.write('\n');
    }
  }
  
  // Write footer
  writeStream.write('\n' + '='.repeat(80) + '\n');
  writeStream.write(`Total Responses: ${responseCount}\n`);
  
  return new Promise((resolve, reject) => {
    writeStream.end((err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

/**
 * Export unrelated transcripts.
 * Includes only messages without a relates_to field.
 * 
 * @param {string} projectId - Project ID
 * @param {string} filePath - Output file path
 * @param {Object} options - Export options
 * @param {number} options.batchSize - Batch size for streaming
 * @param {AxiosInstance} api - API client
 * @returns {Promise<void>}
 * @throws {Error} If write stream fails
 * @private
 */
async function exportUnrelatedTranscripts(projectId, filePath, options, api) {
  const writeStream = createWriteStream(filePath);
  
  // Write header
  writeStream.write(`Transcript Export - Unrelated Messages\n`);
  writeStream.write(`Project: ${projectId}\n`);
  writeStream.write(`Generated: ${new Date().toISOString()}\n`);
  writeStream.write('='.repeat(80) + '\n\n');
  
  let messageCount = 0;
  
  // Stream conversations
  const conversationStream = streamPaginatedAPI(
    api,
    `/analyzer/results/${projectId}/conversations`,
    { pageSize: options.batchSize }
  );
  
  for await (const conversation of conversationStream) {
    // Find messages without relates_to
    const unrelatedMessages = (conversation.messages || []).filter(
      msg => !msg.relates_to
    );
    
    if (unrelatedMessages.length > 0) {
      writeStream.write(`\nConversation ${conversation._id}:\n`);
      writeStream.write('-'.repeat(40) + '\n');
      
      unrelatedMessages.forEach((message) => {
        messageCount++;
        const role = message.role === 'assistant' ? 'Interviewer' : 'Participant';
        const timestamp = new Date(message.created_at || message.createdAt).toLocaleString();
        
        writeStream.write(`\n[${messageCount}] ${role} (${timestamp}):\n`);
        writeStream.write(`${message.text}\n`);
      });
      
      writeStream.write('\n');
    }
  }
  
  // Write footer
  writeStream.write('\n' + '='.repeat(80) + '\n');
  writeStream.write(`Total Unrelated Messages: ${messageCount}\n`);
  
  return new Promise((resolve, reject) => {
    writeStream.end((err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

/**
 * Register the export-transcripts command with the CLI program.
 * Supports exporting from multiple projects and workspaces with streaming.
 * 
 * @param {Command} program - Commander program instance
 * @example
 * const program = new Command();
 * registerExportTranscriptsCommand(program);
 * 
 * // Usage:
 * // tellet-admin export-transcripts -p PROJECT_ID
 * // tellet-admin export-transcripts -w WORKSPACE_ID -q
 * // tellet-admin export-transcripts -p ID1 ID2 ID3 --split-by-question
 */
function registerExportTranscriptsCommand(program) {
  program
    .command('export-transcripts')
    .description('Export conversation transcripts for qualitative analysis')
    .option('-p, --projects <ids...>', 'Project IDs to export (space-separated)')
    .option('-w, --workspaces <ids...>', 'Workspace IDs to export all projects from')
    .option('-o, --output-dir <path>', 'Output directory', './exports')
    .option('-q, --split-by-question', 'Create separate files for each question')
    .option('--include-unrelated', 'Include messages without relates_to field', true)
    .option('--batch-size <size>', 'Conversations per batch', '50')
    .option('--delay <ms>', 'Delay between API calls', '100')
    .option('--continue-on-error', 'Continue processing even if errors occur')
    .option('-u, --url <url>', 'API base URL')
    .action(requireAuth(exportTranscriptsHandler));
}

module.exports = {
  exportTranscriptsHandler,
  registerExportTranscriptsCommand
};