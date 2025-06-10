/**
 * @fileoverview File system utilities for Tellet Admin CLI.
 * Provides safe file operations, directory management, and disk space utilities.
 * 
 * @module lib/utils/file-utils
 */

const fs = require('fs').promises;
const path = require('path');
const { logger } = require('../logger');
const { FileSystemError } = require('../errors');

/**
 * Ensure directory exists, creating it recursively if needed.
 * 
 * @param {string} dirPath - Directory path to ensure exists
 * @returns {Promise<void>}
 * @throws {FileSystemError} If directory creation fails
 * @example
 * await ensureDirectoryExists('./exports/project-123');
 */
async function ensureDirectoryExists(dirPath) {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (error) {
    throw new FileSystemError(
      `Failed to create directory: ${dirPath}`,
      dirPath,
      'mkdir'
    );
  }
}

/**
 * Find project in organization hierarchy.
 * Searches through all organizations and workspaces to locate the project.
 * 
 * @param {string} projectId - Project ID to find
 * @param {AxiosInstance} api - Authenticated API client
 * @returns {Promise<Object|null>} Hierarchy information or null if not found
 * @returns {Promise<Object>} returns.organization - Organization containing the project
 * @returns {Promise<Object>} returns.workspace - Workspace containing the project
 * @returns {Promise<Object>} returns.project - Project details
 * @example
 * const hierarchy = await findProjectInOrganizations('507f1f77bcf86cd799439011', api);
 * if (hierarchy) {
 *   console.log(`Found in org: ${hierarchy.organization.name}`);
 * }
 */
async function findProjectInOrganizations(projectId, api) {
  try {
    logger.debug('Finding project in organizations', { projectId });
    // Get all organizations
    const orgs = await api.get('/organizations');
    
    for (const org of orgs) {
      // Get workspaces for this org
      const workspaceData = await api.get(`/organizations/${org._id}/workspaces`);
      
      // Combine private and shared workspaces
      let workspaces = [];
      if (workspaceData.privateWorkspaces || workspaceData.priv) {
        workspaces = workspaces.concat(workspaceData.privateWorkspaces || workspaceData.priv || []);
      }
      if (workspaceData.sharedWorkspaces || workspaceData.shared) {
        workspaces = workspaces.concat(workspaceData.sharedWorkspaces || workspaceData.shared || []);
      }
      
      // Check each workspace
      for (const workspace of workspaces) {
        try {
          const projects = await api.get(
            `/organizations/${org._id}/workspaces/${workspace._id}/projects`
          );
          
          const project = projects.find(p => p._id === projectId);
          if (project) {
            return {
              organization: org,
              workspace: workspace,
              project: project
            };
          }
        } catch (error) {
          // Workspace might not be accessible
          logger.debug(`Failed to access workspace ${workspace._id}: ${error.message}`);
        }
      }
    }
    
    return null;
  } catch (error) {
    logger.warn('Failed to find project in organization hierarchy:', error.message);
    return null;
  }
}

/**
 * Create export directory with organization structure.
 * Creates nested directories: base/org_id/workspace_id/project_id/
 * Falls back to base/project_id/ if hierarchy cannot be determined.
 * 
 * @param {string} projectId - Project ID
 * @param {string} baseOutputDir - Base output directory path
 * @param {AxiosInstance} api - Authenticated API client
 * @returns {Promise<string>} Created export directory path
 * @throws {FileSystemError} If directory creation fails
 * @example
 * const exportPath = await createExportDirectory(
 *   '507f1f77bcf86cd799439011',
 *   './exports',
 *   api
 * );
 * // Returns: './exports/org123/ws456/507f1f77bcf86cd799439011/'
 */
async function createExportDirectory(projectId, baseOutputDir, api) {
  let exportPath;
  
  try {
    const hierarchy = await findProjectInOrganizations(projectId, api);
    
    if (hierarchy) {
      // Create path: exports/org_id/workspace_id/project_id/
      exportPath = path.join(
        baseOutputDir,
        hierarchy.organization._id,
        hierarchy.workspace._id,
        projectId
      );
    } else {
      // Fallback to simple structure
      exportPath = path.join(baseOutputDir, projectId);
    }
  } catch (error) {
    logger.debug('Failed to determine hierarchy, using simple structure');
    exportPath = path.join(baseOutputDir, projectId);
  }
  
  await ensureDirectoryExists(exportPath);
  return exportPath;
}

/**
 * Safely write file with atomic operation.
 * Writes to a temporary file first, then renames to ensure atomicity.
 * Prevents partial writes and data corruption.
 * 
 * @param {string} filePath - Target file path
 * @param {string|Buffer} data - Data to write
 * @returns {Promise<void>}
 * @throws {FileSystemError} If write operation fails
 * @example
 * await safeWriteFile('./data.json', JSON.stringify(data));
 * // File is written atomically, preventing corruption
 */
async function safeWriteFile(filePath, data) {
  const tempPath = `${filePath}.tmp`;
  
  try {
    // Write to temp file first
    await fs.writeFile(tempPath, data);
    
    // Rename to final path (atomic on most systems)
    await fs.rename(tempPath, filePath);
  } catch (error) {
    // Clean up temp file if it exists
    try {
      await fs.unlink(tempPath);
    } catch (e) {
      // Ignore cleanup errors
    }
    
    throw new FileSystemError(
      `Failed to write file: ${filePath}`,
      filePath,
      'write'
    );
  }
}

/**
 * Check available disk space for a directory.
 * Uses platform-specific commands (df on Unix, wmic on Windows).
 * 
 * @param {string} dirPath - Directory path to check
 * @returns {Promise<number>} Available space in bytes (Infinity if check fails)
 * @example
 * const bytes = await getAvailableDiskSpace('./exports');
 * const gb = bytes / (1024 * 1024 * 1024);
 * console.log(`${gb.toFixed(2)} GB available`);
 */
async function getAvailableDiskSpace(dirPath) {
  const { execFile } = require('child_process').promises;
  
  try {
    if (process.platform === 'win32') {
      // Windows: Use wmic
      const { stdout } = await execFile('wmic', [
        'logicaldisk',
        'where',
        `caption="${path.parse(dirPath).root}"`,
        'get',
        'freespace',
        '/value'
      ]);
      const match = stdout.match(/FreeSpace=(\d+)/);
      return match ? parseInt(match[1], 10) : 0;
    } else {
      // Unix-like: Use df
      const { stdout } = await execFile('df', ['-k', dirPath]);
      const lines = stdout.trim().split('\n');
      if (lines.length > 1) {
        const parts = lines[1].split(/\s+/);
        return parseInt(parts[3], 10) * 1024; // Convert KB to bytes
      }
    }
  } catch (error) {
    logger.debug('Failed to check disk space:', error.message);
    return Infinity; // Assume unlimited if check fails
  }
}

/**
 * Stream copy file with progress reporting.
 * Efficiently copies large files using streams.
 * 
 * @param {string} source - Source file path
 * @param {string} destination - Destination file path
 * @param {Function} [onProgress] - Progress callback function
 * @param {number} onProgress.percentage - Progress percentage (0-100)
 * @param {number} onProgress.copied - Bytes copied so far
 * @param {number} onProgress.total - Total file size in bytes
 * @returns {Promise<void>}
 * @throws {Error} If source doesn't exist or copy fails
 * @example
 * await streamCopyFile('./large.csv', './backup.csv', (percent, copied, total) => {
 *   console.log(`Progress: ${percent}% (${copied}/${total} bytes)`);
 * });
 */
async function streamCopyFile(source, destination, onProgress) {
  const { createReadStream, createWriteStream } = require('fs');
  const { pipeline } = require('stream/promises');
  
  const stats = await fs.stat(source);
  let copied = 0;
  
  const readStream = createReadStream(source);
  const writeStream = createWriteStream(destination);
  
  readStream.on('data', (chunk) => {
    copied += chunk.length;
    if (onProgress) {
      const progress = Math.round((copied / stats.size) * 100);
      onProgress(progress, copied, stats.size);
    }
  });
  
  await pipeline(readStream, writeStream);
}

/**
 * Clean up old files from a directory.
 * Deletes files older than the specified age.
 * 
 * @param {string} directory - Directory to clean
 * @param {number} maxAge - Maximum age in milliseconds
 * @returns {Promise<number>} Number of files deleted
 * @example
 * // Delete files older than 7 days
 * const deleted = await cleanupOldFiles('./temp', 7 * 24 * 60 * 60 * 1000);
 * console.log(`Deleted ${deleted} old files`);
 */
async function cleanupOldFiles(directory, maxAge) {
  let deletedCount = 0;
  const now = Date.now();
  
  try {
    const files = await fs.readdir(directory);
    
    for (const file of files) {
      const filePath = path.join(directory, file);
      const stats = await fs.stat(filePath);
      
      if (stats.isFile() && (now - stats.mtime.getTime()) > maxAge) {
        await fs.unlink(filePath);
        deletedCount++;
        logger.debug(`Deleted old file: ${file}`);
      }
    }
  } catch (error) {
    logger.debug('Error during cleanup:', error.message);
  }
  
  return deletedCount;
}

module.exports = {
  ensureDirectoryExists,
  findProjectInOrganizations,
  createExportDirectory,
  safeWriteFile,
  getAvailableDiskSpace,
  streamCopyFile,
  cleanupOldFiles
};