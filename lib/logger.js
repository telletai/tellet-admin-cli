/**
 * Logging utilities for Tellet Admin CLI
 */

const chalk = require('chalk');
const fs = require('fs');
const path = require('path');

class Logger {
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

  initFileLogging() {
    const logDir = path.dirname(this.options.logFile);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    this.logStream = fs.createWriteStream(this.options.logFile, { flags: 'a' });
  }

  shouldLog(level) {
    return this.levels[level] <= this.levels[this.options.level];
  }

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

  error(message, meta) {
    this.log('error', message, meta);
  }

  warn(message, meta) {
    this.log('warn', message, meta);
  }

  info(message, meta) {
    this.log('info', message, meta);
  }

  verbose(message, meta) {
    this.log('verbose', message, meta);
  }

  debug(message, meta) {
    this.log('debug', message, meta);
  }

  success(message, meta) {
    if (this.shouldLog('info')) {
      const { formatted } = this.formatMessage('info', message, meta);
      console.log(`${this.icons.success} ${chalk.green(formatted)}`);
      
      if (this.logStream) {
        this.logStream.write(`[SUCCESS] ${formatted}\n`);
      }
    }
  }

  progress(message, meta) {
    if (this.shouldLog('info')) {
      const { formatted } = this.formatMessage('info', message, meta);
      console.log(`${this.icons.progress} ${chalk.cyan(formatted)}`);
      
      if (this.logStream) {
        this.logStream.write(`[PROGRESS] ${formatted}\n`);
      }
    }
  }

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
   * Log a table of data
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
   * Log a separator line
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
   * Log a header
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
   * Create a child logger with additional context
   */
  child(context) {
    const child = new Logger(this.options);
    child.context = { ...this.context, ...context };
    return child;
  }

  /**
   * Close log file stream
   */
  close() {
    if (this.logStream) {
      this.logStream.end();
    }
  }
}

/**
 * Progress tracker for long-running operations
 */
class ProgressTracker {
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

  increment(amount = 1) {
    this.current += amount;
    this.update();
  }

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
 * Default logger instance
 */
const defaultLogger = new Logger({
  level: process.env.NODE_ENV === 'test' ? 'error' : 'info'
});

module.exports = {
  Logger,
  ProgressTracker,
  logger: defaultLogger
};