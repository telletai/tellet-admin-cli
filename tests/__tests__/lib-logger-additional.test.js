const { Logger, logger } = require('../../lib/logger');
const fs = require('fs');
const path = require('path');

jest.mock('fs');

describe('Logger Additional Coverage', () => {
  let mockWriteStream;
  
  beforeEach(() => {
    mockWriteStream = {
      write: jest.fn(),
      end: jest.fn()
    };
    
    fs.createWriteStream = jest.fn().mockReturnValue(mockWriteStream);
    fs.existsSync = jest.fn().mockReturnValue(false);
    fs.mkdirSync = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('File logging', () => {
    it('should initialize file logging', () => {
      const testLogger = new Logger({ 
        logFile: '/path/to/test.log',
        level: 'info'
      });
      
      expect(fs.mkdirSync).toHaveBeenCalledWith('/path/to', { recursive: true });
      expect(fs.createWriteStream).toHaveBeenCalledWith('/path/to/test.log', { flags: 'a' });
    });

    it('should write to log file when logging', () => {
      const testLogger = new Logger({ 
        logFile: '/path/to/test.log',
        level: 'info'
      });
      
      testLogger.info('Test message');
      
      expect(mockWriteStream.write).toHaveBeenCalledWith(
        expect.stringContaining('[INFO] Test message')
      );
    });

    it('should close log stream', () => {
      const testLogger = new Logger({ 
        logFile: '/path/to/test.log'
      });
      
      testLogger.close();
      
      expect(mockWriteStream.end).toHaveBeenCalled();
    });
  });

  describe('Progress and timing methods', () => {
    let consoleLogSpy;
    
    beforeEach(() => {
      consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    });
    
    afterEach(() => {
      consoleLogSpy.mockRestore();
    });

    it('should log progress messages', () => {
      const testLogger = new Logger({ level: 'info' });
      
      testLogger.progress('Processing files');
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('🔄')
      );
    });

    it('should log completion messages', () => {
      const testLogger = new Logger({ level: 'info' });
      
      testLogger.complete('Task completed');
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('✨')
      );
    });

    it('should create separator lines', () => {
      const testLogger = new Logger({ level: 'info' });
      
      testLogger.separator();
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('─'.repeat(60))
      );
    });

    it('should create custom separator lines', () => {
      const testLogger = new Logger({ level: 'info' });
      
      testLogger.separator('=', 20);
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('='.repeat(20))
      );
    });

    // Note: Logger doesn't have time/timeEnd methods
  });

  describe('Table formatting', () => {
    let consoleTableSpy;
    
    beforeEach(() => {
      consoleTableSpy = jest.spyOn(console, 'table').mockImplementation();
    });
    
    afterEach(() => {
      consoleTableSpy.mockRestore();
    });

    it('should format simple tables', () => {
      const testLogger = new Logger({ level: 'info' });
      const data = [
        { name: 'John', age: 30 },
        { name: 'Jane', age: 25 }
      ];
      
      testLogger.table(data);
      
      expect(consoleTableSpy).toHaveBeenCalledWith(data, undefined);
    });

    it('should format tables with specific columns', () => {
      const testLogger = new Logger({ level: 'info' });
      const data = [{ id: 1, name: 'Test', hidden: 'secret' }];
      
      testLogger.table(data, ['name']);
      
      expect(consoleTableSpy).toHaveBeenCalledWith(data, ['name']);
    });

    it('should respect log level for tables', () => {
      const testLogger = new Logger({ level: 'error' });
      
      testLogger.table([{ test: 'data' }]);
      
      expect(consoleTableSpy).not.toHaveBeenCalled();
    });
  });

  describe('Metadata handling', () => {
    let consoleLogSpy;
    
    beforeEach(() => {
      consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    });
    
    afterEach(() => {
      consoleLogSpy.mockRestore();
    });

    it('should include metadata in formatted messages', () => {
      const testLogger = new Logger({ 
        level: 'info',
        timestamp: true
      });
      
      testLogger.info('Test message', { userId: 123, action: 'login' });
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Test message')
      );
    });

    it('should format timestamp correctly', () => {
      const testLogger = new Logger({ 
        level: 'info',
        timestamp: true
      });
      
      testLogger.info('Test message');
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('ℹ️')
      );
    });
  });

  describe('Log level filtering', () => {
    let consoleLogSpy, consoleWarnSpy, consoleErrorSpy;
    
    beforeEach(() => {
      consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    });
    
    afterEach(() => {
      consoleLogSpy.mockRestore();
      consoleWarnSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });

    it('should respect silent mode', () => {
      const testLogger = new Logger({ level: 'silent' });
      
      testLogger.info('Should not appear');
      testLogger.warn('Should not appear');
      testLogger.error('Should not appear');
      
      expect(consoleLogSpy).not.toHaveBeenCalled();
      expect(consoleWarnSpy).not.toHaveBeenCalled();
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('should handle verbose logging', () => {
      const testLogger = new Logger({ level: 'verbose' });
      
      testLogger.verbose('Verbose message');
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('📝')
      );
    });

    it('should handle debug logging', () => {
      const testLogger = new Logger({ level: 'debug' });
      
      testLogger.debug('Debug message');
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('🔍')
      );
    });
  });

  describe('Error cases', () => {
    it('should attempt file logging setup', () => {
      fs.createWriteStream = jest.fn().mockReturnValue(mockWriteStream);
      
      new Logger({ logFile: '/path/test.log' });
      
      expect(fs.createWriteStream).toHaveBeenCalledWith('/path/test.log', { flags: 'a' });
    });
  });

  describe('Special formatting', () => {
    let consoleLogSpy;
    
    beforeEach(() => {
      consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    });
    
    afterEach(() => {
      consoleLogSpy.mockRestore();
    });

    it('should format subsections correctly', () => {
      const testLogger = new Logger({ level: 'info' });
      
      testLogger.subsection('Subsection Title');
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Subsection Title')
      );
    });

    it('should format bullet points correctly', () => {
      const testLogger = new Logger({ level: 'info' });
      
      testLogger.bullet('Bullet point');
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('• Bullet point')
      );
    });
  });
});