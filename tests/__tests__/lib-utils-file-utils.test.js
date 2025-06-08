const fs = require('fs').promises;
const path = require('path');
const { 
  ensureDirectoryExists, 
  findProjectInOrganizations,
  createExportDirectory,
  safeWriteFile,
  getAvailableDiskSpace,
  streamCopyFile,
  cleanupOldFiles
} = require('../../lib/utils/file-utils');

jest.mock('fs', () => ({
  promises: {
    mkdir: jest.fn(),
    writeFile: jest.fn(),
    rename: jest.fn(),
    unlink: jest.fn(),
    stat: jest.fn(),
    readdir: jest.fn()
  },
  createReadStream: jest.fn(),
  createWriteStream: jest.fn()
}));

jest.mock('stream/promises', () => ({
  pipeline: jest.fn()
}));

jest.mock('child_process', () => ({
  promises: {
    execFile: jest.fn()
  }
}));

describe('file-utils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('ensureDirectoryExists', () => {
    it('should create directory successfully', async () => {
      fs.mkdir.mockResolvedValue();
      
      await ensureDirectoryExists('/path/to/dir');
      
      expect(fs.mkdir).toHaveBeenCalledWith('/path/to/dir', { recursive: true });
    });

    it('should throw error if mkdir fails', async () => {
      fs.mkdir.mockRejectedValue(new Error('Permission denied'));
      
      await expect(ensureDirectoryExists('/path/to/dir'))
        .rejects.toThrow('Failed to create directory');
    });
  });

  describe('safeWriteFile', () => {
    it('should write file atomically', async () => {
      fs.writeFile.mockResolvedValue();
      fs.rename.mockResolvedValue();
      
      await safeWriteFile('/path/file.txt', 'content');
      
      expect(fs.writeFile).toHaveBeenCalledWith('/path/file.txt.tmp', 'content');
      expect(fs.rename).toHaveBeenCalledWith('/path/file.txt.tmp', '/path/file.txt');
    });

    it('should clean up temp file on error', async () => {
      fs.writeFile.mockRejectedValue(new Error('Write failed'));
      fs.unlink.mockResolvedValue();
      
      await expect(safeWriteFile('/path/file.txt', 'content'))
        .rejects.toThrow('Failed to write file');
      
      expect(fs.unlink).toHaveBeenCalledWith('/path/file.txt.tmp');
    });
  });

  describe('cleanupOldFiles', () => {
    beforeEach(() => {
      const mockStats = {
        isFile: () => true,
        mtime: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000) // 8 days old
      };
      fs.readdir.mockResolvedValue(['old1.txt', 'old2.txt']);
      fs.stat.mockResolvedValue(mockStats);
      fs.unlink.mockResolvedValue();
    });

    it('should delete old files', async () => {
      const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
      
      const deleted = await cleanupOldFiles('/temp', maxAge);
      
      expect(deleted).toBe(2);
      expect(fs.unlink).toHaveBeenCalledTimes(2);
    });

    it('should handle errors gracefully', async () => {
      fs.readdir.mockRejectedValue(new Error('Access denied'));
      
      const deleted = await cleanupOldFiles('/temp', 1000);
      
      expect(deleted).toBe(0);
    });
  });
});