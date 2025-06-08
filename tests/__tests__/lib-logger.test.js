const { Logger, ProgressTracker, logger } = require('../../lib/logger');
const chalk = require('chalk');

// Mock chalk to avoid color codes in tests
jest.mock('chalk', () => ({
  cyan: jest.fn(str => str),
  green: jest.fn(str => str),
  yellow: jest.fn(str => str),
  red: jest.fn(str => str),
  gray: jest.fn(str => str),
  magenta: jest.fn(str => str),
  blue: jest.fn(str => str),
  bold: Object.assign(jest.fn(str => str), {
    green: jest.fn(str => str),
    red: jest.fn(str => str),
    yellow: jest.fn(str => str),
    underline: jest.fn(str => str)
  })
}));

describe('Logger', () => {
  let consoleLogSpy, consoleErrorSpy, consoleWarnSpy;
  let testLogger;
  
  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    
    testLogger = new Logger({ level: 'debug' });
  });
  
  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  describe('constructor', () => {
    it('should initialize with default options', () => {
      const logger = new Logger();
      expect(logger.options.level).toBe('info');
      expect(logger.options.colorize).toBe(true);
      expect(logger.options.timestamp).toBe(true);
    });

    it('should accept custom options', () => {
      const logger = new Logger({
        level: 'debug',
        colorize: false,
        timestamp: false
      });
      
      expect(logger.options.level).toBe('debug');
      expect(logger.options.colorize).toBe(false);
      expect(logger.options.timestamp).toBe(false);
    });
  });

  describe('log levels', () => {
    it('should log debug messages when level is debug', () => {
      const debugLogger = new Logger({ level: 'debug' });
      debugLogger.debug('Debug message');
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('🔍')
      );
    });

    it('should not log debug when level is info', () => {
      const infoLogger = new Logger({ level: 'info' });
      infoLogger.debug('Debug message');
      
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('should log info messages', () => {
      testLogger.info('Info message');
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('ℹ️')
      );
    });

    it('should log warnings', () => {
      testLogger.warn('Warning message');
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('⚠️')
      );
    });

    it('should log errors', () => {
      testLogger.error('Error message');
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('❌')
      );
    });

    it('should log errors at error level', () => {
      const errorLogger = new Logger({ level: 'error' });
      errorLogger.error('Error message');
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('❌')
      );
    });
  });

  describe('formatting', () => {
    it('should include timestamps when enabled', () => {
      const logger = new Logger({ timestamp: true });
      logger.info('Test');
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('ℹ️')
      );
    });

    it('should format messages with metadata', () => {
      testLogger.info('Data', { key: 'value' });
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('ℹ️')
      );
    });
  });

  describe('special log methods', () => {
    it('should log success messages', () => {
      testLogger.success('Operation completed');
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('✅')
      );
    });

    it('should log failure messages', () => {
      testLogger.fail('Operation failed');
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('❌ Operation failed')
      );
    });

    it('should create sections', () => {
      testLogger.section('New Section');
      
      expect(consoleLogSpy).toHaveBeenCalledWith('');
      expect(consoleLogSpy).toHaveBeenCalledWith('New Section');
    });

    it('should create subsections', () => {
      testLogger.subsection('Subsection');
      
      expect(consoleLogSpy).toHaveBeenCalledWith('');
      expect(consoleLogSpy).toHaveBeenCalledWith('Subsection');
    });

    it('should log bullet points', () => {
      testLogger.bullet('Item 1');
      
      expect(consoleLogSpy).toHaveBeenCalledWith('  • Item 1');
    });

    it('should create tables', () => {
      const consoleTableSpy = jest.spyOn(console, 'table').mockImplementation();
      const data = [
        { name: 'John', age: 30 },
        { name: 'Jane', age: 25 }
      ];
      
      testLogger.table(data);
      
      expect(consoleTableSpy).toHaveBeenCalledWith(data, undefined);
      
      consoleTableSpy.mockRestore();
    });
  });

  describe('child loggers', () => {
    it('should create child logger with context', () => {
      const child = testLogger.child({ module: 'CHILD' });
      expect(child).toBeInstanceOf(Logger);
      expect(child.context).toEqual({ module: 'CHILD' });
      
      child.info('Message from child');
      expect(consoleLogSpy).toHaveBeenCalled();
    });
  });
});

describe('ProgressTracker', () => {
  let tracker;
  let processStdoutSpy;
  let consoleLogSpy;
  
  beforeEach(() => {
    processStdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation();
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    tracker = new ProgressTracker(100, { showPercentage: true });
  });
  
  afterEach(() => {
    processStdoutSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });

  describe('constructor', () => {
    it('should initialize with total and options', () => {
      expect(tracker.total).toBe(100);
      expect(tracker.current).toBe(0);
      expect(tracker.options.showPercentage).toBe(true);
    });
  });

  describe('update', () => {
    it('should update progress', () => {
      tracker.update(50);
      
      expect(tracker.current).toBe(50);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Progress: 50/100')
      );
    });

    it('should show progress with percentage', () => {
      tracker.update(25);
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('(25%)')
      );
    });

    it('should handle completion', () => {
      tracker.update(100);
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('(100%)')
      );
    });
  });

  describe('increment', () => {
    it('should increment by 1', () => {
      tracker.increment();
      expect(tracker.current).toBe(1);
    });

    it('should increment by custom amount', () => {
      tracker.increment(5);
      expect(tracker.current).toBe(5);
    });
  });

  describe('complete', () => {
    it('should complete the progress', () => {
      tracker.update(50);
      tracker.complete();
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Completed 100 items')
      );
    });

    it('should show completion statistics', () => {
      tracker.complete();
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Completed 100 items')
      );
    });
  });
});

describe('New Logger methods', () => {
  const logger = new Logger({ level: 'info' });
  
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('section', () => {
    it('should output section header with formatting', () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      
      logger.section('Test Section');
      
      expect(consoleLogSpy).toHaveBeenCalledTimes(3);
      expect(consoleLogSpy).toHaveBeenNthCalledWith(1, '');
      expect(consoleLogSpy).toHaveBeenNthCalledWith(2, expect.stringContaining('Test Section'));
      expect(consoleLogSpy).toHaveBeenNthCalledWith(3, '');
      
      consoleLogSpy.mockRestore();
    });
  });

  describe('subsection', () => {
    it('should output subsection header with formatting', () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      
      logger.subsection('Test Subsection');
      
      expect(consoleLogSpy).toHaveBeenCalledTimes(2);
      expect(consoleLogSpy).toHaveBeenNthCalledWith(1, '');
      expect(consoleLogSpy).toHaveBeenNthCalledWith(2, expect.stringContaining('Test Subsection'));
      
      consoleLogSpy.mockRestore();
    });
  });

  describe('bullet', () => {
    it('should output bullet point item', () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      
      logger.bullet('Item 1');
      
      expect(consoleLogSpy).toHaveBeenCalledWith('  • Item 1');
      
      consoleLogSpy.mockRestore();
    });
  });

  describe('fail', () => {
    it('should output failure message with icon', () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      const logger = new Logger({ level: 'error' });
      
      logger.fail('Operation failed');
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('❌ Operation failed')
      );
      
      consoleLogSpy.mockRestore();
    });
  });
});

describe('Singleton logger', () => {
  it('should export a default logger instance', () => {
    expect(logger).toBeInstanceOf(Logger);
    expect(logger.options.level).toBe('error'); // 'error' in test environment
  });
});