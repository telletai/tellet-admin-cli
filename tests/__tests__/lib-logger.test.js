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
  bold: {
    green: jest.fn(str => str),
    red: jest.fn(str => str),
    yellow: jest.fn(str => str)
  }
}));

describe('Logger', () => {
  let consoleLogSpy, consoleErrorSpy, consoleWarnSpy;
  let testLogger;
  
  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    
    testLogger = new Logger({ prefix: 'TEST' });
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
      expect(logger.options.prefix).toBe('');
      expect(logger.options.timestamps).toBe(false);
    });

    it('should accept custom options', () => {
      const logger = new Logger({
        level: 'debug',
        prefix: 'APP',
        timestamps: true
      });
      
      expect(logger.options.level).toBe('debug');
      expect(logger.options.prefix).toBe('APP');
      expect(logger.options.timestamps).toBe(true);
    });
  });

  describe('log levels', () => {
    it('should log debug messages when level is debug', () => {
      testLogger.setLevel('debug');
      testLogger.debug('Debug message');
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('[TEST]'),
        expect.stringContaining('[DEBUG]'),
        'Debug message'
      );
    });

    it('should not log debug when level is info', () => {
      testLogger.setLevel('info');
      testLogger.debug('Debug message');
      
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('should log info messages', () => {
      testLogger.info('Info message');
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('[TEST]'),
        expect.stringContaining('[INFO]'),
        'Info message'
      );
    });

    it('should log warnings', () => {
      testLogger.warn('Warning message');
      
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[TEST]'),
        expect.stringContaining('[WARN]'),
        'Warning message'
      );
    });

    it('should log errors', () => {
      testLogger.error('Error message');
      
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[TEST]'),
        expect.stringContaining('[ERROR]'),
        'Error message'
      );
    });

    it('should always log errors regardless of level', () => {
      testLogger.setLevel('silent');
      testLogger.error('Error message');
      
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe('formatting', () => {
    it('should include timestamps when enabled', () => {
      const logger = new Logger({ timestamps: true });
      logger.info('Test');
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringMatching(/\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\]/),
        expect.any(String),
        'Test'
      );
    });

    it('should format objects and arrays', () => {
      testLogger.info('Data:', { key: 'value' }, [1, 2, 3]);
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        'Data:',
        { key: 'value' },
        [1, 2, 3]
      );
    });
  });

  describe('special log methods', () => {
    it('should log success messages', () => {
      testLogger.success('Operation completed');
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('✓'),
        'Operation completed'
      );
    });

    it('should log failure messages', () => {
      testLogger.fail('Operation failed');
      
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('✗'),
        'Operation failed'
      );
    });

    it('should create sections', () => {
      testLogger.section('New Section');
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('━━━')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('New Section')
      );
    });

    it('should create subsections', () => {
      testLogger.subsection('Subsection');
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('──')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Subsection')
      );
    });

    it('should log bullet points', () => {
      testLogger.bullet('Item 1');
      testLogger.bullet('Item 2', 2);
      
      expect(consoleLogSpy).toHaveBeenCalledWith('  • Item 1');
      expect(consoleLogSpy).toHaveBeenCalledWith('    ◦ Item 2');
    });

    it('should create tables', () => {
      const data = [
        { name: 'John', age: 30 },
        { name: 'Jane', age: 25 }
      ];
      
      testLogger.table(data);
      
      // Check header
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Name')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Age')
      );
      
      // Check data
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('John')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('30')
      );
    });
  });

  describe('child loggers', () => {
    it('should create child logger with combined prefix', () => {
      const child = testLogger.child('CHILD');
      child.info('Message from child');
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('[TEST:CHILD]'),
        expect.any(String),
        'Message from child'
      );
    });
  });
});

describe('ProgressTracker', () => {
  let tracker;
  let processStdoutSpy;
  
  beforeEach(() => {
    processStdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation();
    tracker = new ProgressTracker(100, 'Processing');
  });
  
  afterEach(() => {
    processStdoutSpy.mockRestore();
  });

  describe('constructor', () => {
    it('should initialize with total and label', () => {
      expect(tracker.total).toBe(100);
      expect(tracker.label).toBe('Processing');
      expect(tracker.current).toBe(0);
    });
  });

  describe('update', () => {
    it('should update progress', () => {
      tracker.update(50);
      
      expect(tracker.current).toBe(50);
      expect(processStdoutSpy).toHaveBeenCalledWith(
        expect.stringContaining('Processing: 50/100')
      );
      expect(processStdoutSpy).toHaveBeenCalledWith(
        expect.stringContaining('50.0%')
      );
    });

    it('should show progress bar', () => {
      tracker.update(25);
      
      const output = processStdoutSpy.mock.calls[0][0];
      expect(output).toContain('█');
      expect(output).toContain('░');
    });

    it('should handle completion', () => {
      tracker.update(100);
      
      expect(processStdoutSpy).toHaveBeenCalledWith(
        expect.stringContaining('100.0%')
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

  describe('finish', () => {
    it('should complete the progress', () => {
      tracker.update(50);
      tracker.finish();
      
      expect(tracker.current).toBe(100);
      expect(processStdoutSpy).toHaveBeenCalledWith('\n');
    });

    it('should show custom message', () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      
      tracker.finish('Completed successfully!');
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('✓'),
        'Completed successfully!'
      );
      
      consoleLogSpy.mockRestore();
    });
  });
});

describe('Singleton logger', () => {
  it('should export a default logger instance', () => {
    expect(logger).toBeInstanceOf(Logger);
    expect(logger.options.level).toBe('info');
  });
});