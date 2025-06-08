/**
 * @fileoverview Logging utilities for Tellet Admin CLI.
 * Provides configurable logging with multiple levels, colors, icons,
 * file output, and progress tracking capabilities.
 * 
 * @module lib/logger
 */

const chalk = require('chalk');
const fs = require('fs');
const path = require('path');

/**
 * Logger class with support for multiple log levels, colors, and file output.
 * 
 * @class Logger
 * @example
 * const logger = new Logger({ level: 'debug', logFile: './app.log' });
 * logger.info('Application started');
 * logger.error('An error occurred', { code: 'ERR_001' });
 */
class Logger {
  /**
   * Creates an instance of Logger.
   * 
   * @param {Object} [options={}] - Logger configuration
   * @param {string} [options.level='info'] - Minimum log level (error, warn, info, verbose, debug)
   * @param {boolean} [options.colorize=true] - Enable colored console output
   * @param {boolean} [options.timestamp=true] - Include timestamps in log messages
   * @param {string} [options.logFile] - Path to log file for persistent logging
   */
  constructor(options = {}) {
    this.options = {
      level: options.level || process.env.LOG_LEVEL || 'info',
      colorize: options.colorize !== false,
      timestamp: options.timestamp !== false,
      logFile: options.logFile || process.env.LOG_FILE,
      ...options
    };

    this.levels = {
      error: 0,
      warn: 1,
      info: 2,
      verbose: 3,
      debug: 4
    };

    this.colors = {
      error: chalk.red,
      warn: chalk.yellow,
      info: chalk.blue,
      verbose: chalk.cyan,
      debug: chalk.gray
    };

    this.icons = {
      error: '❌',
      warn: '⚠️',
      info: 'ℹ️',
      verbose: '📝',
      debug: '🔍',
      success: '✅',
      progress: '🔄',
      complete: '✨'
    };

    if (this.options.logFile) {
      this.initFileLogging();
    }
  }

  /**
   * Initialize file logging by creating log directory and write stream.
   * 
   * @private
   */
  initFileLogging() {
    const logDir = path.dirname(this.options.logFile);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    this.logStream = fs.createWriteStream(this.options.logFile, { flags: 'a' });
  }

  /**
   * Check if a message at the given level should be logged.
   * 
   * @param {string} level - Log level to check
   * @returns {boolean} True if message should be logged
   * @private
   */
  shouldLog(level) {
    return this.levels[level] <= this.levels[this.options.level];
  }

  /**
   * Format a log message with timestamp, level, and metadata.
   * 
   * @param {string} level - Log level
   * @param {string} message - Log message
   * @param {Object} [meta={}] - Additional metadata
   * @returns {{formatted: string, icon: string}} Formatted message and icon
   * @private
   */
  formatMessage(level, message, meta = {}) {
    const timestamp = this.options.timestamp 
      ? `[${new Date().toISOString()}] `
      : '';
    
    const levelStr = `[${level.toUpperCase()}]`;
    const icon = this.icons[level] || '';
    
    let formatted = `${timestamp}${levelStr} ${message}`;
    
    if (Object.keys(meta).length > 0) {
      formatted += '\n' + JSON.stringify(meta, null, 2);
    }

    return { formatted, icon };
  }

  /**
   * Log a message at the specified level.
   * 
   * @param {string} level - Log level
   * @param {string} message - Log message
   * @param {Object} [meta={}] - Additional metadata to log
   * @example
   * logger.log('info', 'User logged in', { userId: 123 });
   */
  log(level, message, meta = {}) {
    if (!this.shouldLog(level)) {
      return;
    }

    const { formatted, icon } = this.formatMessage(level, message, meta);

    // Console output
    if (this.options.colorize && this.colors[level]) {
      const colorFn = this.colors[level];
      console.log(`${icon} ${colorFn(formatted)}`);
    } else {
      console.log(`${icon} ${formatted}`);
    }

    // File output
    if (this.logStream) {
      this.logStream.write(formatted + '\n');
    }
  }

  /**
   * Log an error message.
   * 
   * @param {string} message - Error message
   * @param {Object} [meta] - Additional error details
   * @example
   * logger.error('Database connection failed', { host: 'localhost', port: 5432 });
   */
  error(message, meta) {
    this.log('error', message, meta);
  }

  /**
   * Log a warning message.
   * 
   * @param {string} message - Warning message
   * @param {Object} [meta] - Additional warning details
   * @example
   * logger.warn('API rate limit approaching', { remaining: 100 });
   */
  warn(message, meta) {
    this.log('warn', message, meta);
  }

  /**
   * Log an informational message.
   * 
   * @param {string} message - Info message
   * @param {Object} [meta] - Additional info details
   * @example
   * logger.info('Server started', { port: 3000 });
   */
  info(message, meta) {
    this.log('info', message, meta);
  }

  /**
   * Log a verbose message (more detailed than info).
   * 
   * @param {string} message - Verbose message
   * @param {Object} [meta] - Additional verbose details
   * @example
   * logger.verbose('Processing item', { id: 123, type: 'order' });
   */
  verbose(message, meta) {
    this.log('verbose', message, meta);
  }

  /**
   * Log a debug message.
   * 
   * @param {string} message - Debug message
   * @param {Object} [meta] - Additional debug details
   * @example
   * logger.debug('Function called', { args: [1, 2, 3], stack: true });
   */
  debug(message, meta) {
    this.log('debug', message, meta);
  }

  /**
   * Log a success message with green color and checkmark icon.
   * 
   * @param {string} message - Success message
   * @param {Object} [meta] - Additional success details
   * @example
   * logger.success('Export completed', { files: 10, duration: '5s' });
   */
  success(message, meta) {
    if (this.shouldLog('info')) {
      const { formatted } = this.formatMessage('info', message, meta);
      console.log(`${this.icons.success} ${chalk.green(formatted)}`);
      
      if (this.logStream) {
        this.logStream.write(`[SUCCESS] ${formatted}\n`);
      }
    }
  }

  /**
   * Log a progress message with cyan color and progress icon.
   * 
   * @param {string} message - Progress message
   * @param {Object} [meta] - Additional progress details
   * @example
   * logger.progress('Processing items', { current: 50, total: 100 });
   */
  progress(message, meta) {
    if (this.shouldLog('info')) {
      const { formatted } = this.formatMessage('info', message, meta);
      console.log(`${this.icons.progress} ${chalk.cyan(formatted)}`);
      
      if (this.logStream) {
        this.logStream.write(`[PROGRESS] ${formatted}\n`);
      }
    }
  }

  /**
   * Log a completion message with magenta color and sparkle icon.
   * 
   * @param {string} message - Completion message
   * @param {Object} [meta] - Additional completion details
   * @example
   * logger.complete('All tasks finished', { total: 100, duration: '2m' });
   */
  complete(message, meta) {
    if (this.shouldLog('info')) {
      const { formatted } = this.formatMessage('info', message, meta);
      console.log(`${this.icons.complete} ${chalk.magenta(formatted)}`);
      
      if (this.logStream) {
        this.logStream.write(`[COMPLETE] ${formatted}\n`);
      }
    }
  }

  /**
   * Log data in a table format.
   * 
   * @param {Array<Object>} data - Array of objects to display
   * @param {string[]} [columns] - Specific columns to display
   * @example
   * logger.table([
   *   { name: 'Project A', status: 'active', count: 10 },
   *   { name: 'Project B', status: 'inactive', count: 5 }
   * ], ['name', 'status']);
   */
  table(data, columns) {
    if (!this.shouldLog('info')) {
      return;
    }

    console.table(data, columns);
    
    if (this.logStream) {
      this.logStream.write(`[TABLE] ${JSON.stringify(data)}\n`);
    }
  }

  /**
   * Log a section header with formatting.
   * 
   * @param {string} title - Section title
   * @example
   * logger.section('Test Results');
   */
  section(title) {
    if (this.shouldLog('info')) {
      console.log('');
      console.log(chalk.bold.underline(title));
      console.log('');
    }
  }

  /**
   * Log a subsection header with formatting.
   * 
   * @param {string} title - Subsection title
   * @example
   * logger.subsection('Details');
   */
  subsection(title) {
    if (this.shouldLog('info')) {
      console.log('');
      console.log(chalk.bold(title));
    }
  }

  /**
   * Log a bullet point item.
   * 
   * @param {string} message - Bullet point message
   * @example
   * logger.bullet('First item');
   */
  bullet(message) {
    if (this.shouldLog('info')) {
      console.log(`  • ${message}`);
    }
  }

  /**
   * Log a failure message with red color and X icon.
   * 
   * @param {string} message - Failure message
   * @example
   * logger.fail('Connection failed');
   */
  fail(message) {
    if (this.shouldLog('error')) {
      console.log(`${this.icons.error} ${chalk.red(message)}`);
      
      if (this.logStream) {
        this.logStream.write(`[FAIL] ${message}\n`);
      }
    }
  }

  /**
   * Log a separator line for visual separation.
   * 
   * @param {string} [char='─'] - Character to use for the line
   * @param {number} [length=60] - Length of the separator line
   * @example
   * logger.separator();
   * logger.separator('=', 40);
   */
  separator(char = '─', length = 60) {
    if (!this.shouldLog('info')) {
      return;
    }

    const line = char.repeat(length);
    console.log(chalk.gray(line));
    
    if (this.logStream) {
      this.logStream.write(`${line}\n`);
    }
  }

  /**
   * Log a header with title and decorative lines.
   * 
   * @param {string} title - Header title
   * @param {string} [char='═'] - Character to use for decorative lines
   * @param {number} [length=60] - Length of the header lines
   * @example
   * logger.header('Export Results');
   * logger.header('Configuration', '=', 40);
   */
  header(title, char = '═', length = 60) {
    if (!this.shouldLog('info')) {
      return;
    }

    const line = char.repeat(length);
    console.log(chalk.blue(line));
    console.log(chalk.blue.bold(title));
    console.log(chalk.blue(line));
    
    if (this.logStream) {
      this.logStream.write(`${line}\n${title}\n${line}\n`);
    }
  }

  /**
   * Create a child logger with additional context that's included in all log messages.
   * 
   * @param {Object} context - Context to add to all child logger messages
   * @returns {Logger} New logger instance with inherited options and additional context
   * @example
   * const requestLogger = logger.child({ requestId: '123', userId: 'abc' });
   * requestLogger.info('Processing request'); // Includes requestId and userId
   */
  child(context) {
    const child = new Logger(this.options);
    child.context = { ...this.context, ...context };
    return child;
  }

  /**
   * Close the log file stream to ensure all data is written.
   * 
   * @example
   * logger.close(); // Call when application shuts down
   */
  close() {
    if (this.logStream) {
      this.logStream.end();
    }
  }
}

/**
 * Progress tracker for monitoring and displaying progress of long-running operations.
 * Provides ETA calculation, rate tracking, and percentage display.
 * 
 * @class ProgressTracker
 * @example
 * const tracker = new ProgressTracker(1000, { showETA: true });
 * for (let i = 0; i < 1000; i++) {
 *   // Do work...
 *   tracker.increment();
 * }
 * tracker.complete();
 */
class ProgressTracker {
  /**
   * Creates an instance of ProgressTracker.
   * 
   * @param {number} total - Total number of items to process
   * @param {Object} [options={}] - Progress tracker options
   * @param {boolean} [options.showPercentage=true] - Show percentage complete
   * @param {boolean} [options.showETA=true] - Show estimated time of arrival
   * @param {boolean} [options.showRate=true] - Show processing rate
   * @param {number} [options.updateInterval=1000] - Minimum ms between updates
   * @param {Logger} [options.logger] - Logger instance to use
   */
  constructor(total, options = {}) {
    this.total = total;
    this.current = 0;
    this.startTime = Date.now();
    this.options = {
      showPercentage: true,
      showETA: true,
      showRate: true,
      updateInterval: 1000, // ms
      ...options
    };
    this.lastUpdate = 0;
    this.logger = options.logger || new Logger();
  }

  /**
   * Increment the progress counter and update display.
   * 
   * @param {number} [amount=1] - Amount to increment by
   * @example
   * tracker.increment();    // Increment by 1
   * tracker.increment(10);  // Increment by 10
   */
  increment(amount = 1) {
    this.current += amount;
    this.update();
  }

  /**
   * Update the progress display with current status.
   * 
   * @param {number} [current] - Set current progress to specific value
   * @example
   * tracker.update();      // Update with current value
   * tracker.update(500);   // Set current to 500 and update
   */
  update(current) {
    if (current !== undefined) {
      this.current = current;
    }

    const now = Date.now();
    if (now - this.lastUpdate < this.options.updateInterval && this.current < this.total) {
      return;
    }

    this.lastUpdate = now;
    const elapsed = now - this.startTime;
    const percentage = Math.round((this.current / this.total) * 100);
    
    let message = `Progress: ${this.current}/${this.total}`;
    
    if (this.options.showPercentage) {
      message += ` (${percentage}%)`;
    }

    if (this.options.showRate && elapsed > 0) {
      const rate = (this.current / elapsed) * 1000;
      message += ` - ${rate.toFixed(1)} items/sec`;
    }

    if (this.options.showETA && this.current > 0 && this.current < this.total) {
      const remaining = this.total - this.current;
      const eta = (elapsed / this.current) * remaining;
      const etaMin = Math.ceil(eta / 60000);
      message += ` - ETA: ${etaMin} min`;
    }

    this.logger.progress(message);
  }

  /**
   * Mark the operation as complete and log final statistics.
   * 
   * @example
   * tracker.complete(); // Logs: "Completed 1000 items in 2m 15s"
   */
  complete() {
    const elapsed = Date.now() - this.startTime;
    const minutes = Math.floor(elapsed / 60000);
    const seconds = Math.floor((elapsed % 60000) / 1000);
    
    this.logger.complete(
      `Completed ${this.total} items in ${minutes}m ${seconds}s`
    );
  }
}

/**
 * Default logger instance configured based on environment.
 * Uses 'error' level in test environment, 'info' otherwise.
 * 
 * @type {Logger}
 * @example
 * const { logger } = require('./logger');
 * logger.info('Application started');
 */
const defaultLogger = new Logger({
  level: process.env.NODE_ENV === 'test' ? 'error' : 'info'
});

module.exports = {
  Logger,
  ProgressTracker,
  logger: defaultLogger
};