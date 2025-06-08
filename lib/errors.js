/**
 * @fileoverview Custom error classes and error handling utilities for Tellet Admin CLI.
 * Provides a hierarchy of error types for different failure scenarios and a centralized
 * error handler with user-friendly error messages and suggestions.
 * 
 * @module lib/errors
 */

/**
 * Base error class for all Tellet CLI errors.
 * Extends the standard Error class with additional properties for error handling.
 * 
 * @class TelletError
 * @extends Error
 * @example
 * throw new TelletError('Something went wrong', 'CUSTOM_ERROR', { userId: 123 });
 */
class TelletError extends Error {
  /**
   * Creates an instance of TelletError.
   * 
   * @param {string} message - Error message
   * @param {string} [code='TELLET_ERROR'] - Error code for categorization
   * @param {Object} [details={}] - Additional error details
   */
  constructor(message, code = 'TELLET_ERROR', details = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.details = details;
    this.timestamp = new Date().toISOString();
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Convert error to JSON representation.
   * 
   * @returns {Object} JSON representation of the error
   * @returns {string} returns.name - Error class name
   * @returns {string} returns.message - Error message
   * @returns {string} returns.code - Error code
   * @returns {Object} returns.details - Additional error details
   * @returns {string} returns.timestamp - ISO timestamp when error occurred
   * @returns {string} returns.stack - Stack trace
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      details: this.details,
      timestamp: this.timestamp,
      stack: this.stack
    };
  }
}

/**
 * API-related errors for HTTP request failures.
 * 
 * @class APIError
 * @extends TelletError
 * @example
 * throw new APIError('Resource not found', 404, { resource: 'project' });
 */
class APIError extends TelletError {
  /**
   * Creates an instance of APIError.
   * 
   * @param {string} message - Error message
   * @param {number} statusCode - HTTP status code
   * @param {Object} [response={}] - API response body
   */
  constructor(message, statusCode, response = {}) {
    super(message, 'API_ERROR', { statusCode, response });
    this.statusCode = statusCode;
    this.response = response;
  }

  /**
   * Create an APIError from an Axios error object.
   * 
   * @param {Error} error - Axios error object
   * @returns {APIError|NetworkError|TelletError} Appropriate error instance
   * @example
   * try {
   *   await axios.get('/api/resource');
   * } catch (error) {
   *   throw APIError.fromAxiosError(error);
   * }
   */
  static fromAxiosError(error) {
    if (error.response) {
      const message = error.response.data?.message || error.message;
      return new APIError(message, error.response.status, error.response.data);
    }
    if (error.request) {
      return new NetworkError('No response received from server');
    }
    return new TelletError(error.message);
  }
}

/**
 * Authentication errors for login and credential failures.
 * 
 * @class AuthenticationError
 * @extends APIError
 * @example
 * throw new AuthenticationError('Invalid credentials');
 */
class AuthenticationError extends APIError {
  constructor(message = 'Authentication failed') {
    super(message, 401, { requiresAuth: true });
    this.code = 'AUTH_ERROR';
  }
}

/**
 * Authorization errors for permission and access control failures.
 * 
 * @class AuthorizationError
 * @extends APIError
 * @example
 * throw new AuthorizationError('Insufficient permissions to access workspace');
 */
class AuthorizationError extends APIError {
  constructor(message = 'Access denied') {
    super(message, 403, { requiresPermission: true });
    this.code = 'AUTHZ_ERROR';
  }
}

/**
 * Network-related errors for connectivity issues.
 * 
 * @class NetworkError
 * @extends TelletError
 * @example
 * throw new NetworkError('Connection timeout');
 */
class NetworkError extends TelletError {
  constructor(message = 'Network error occurred') {
    super(message, 'NETWORK_ERROR');
  }
}

/**
 * Validation errors for input validation failures.
 * 
 * @class ValidationError
 * @extends TelletError
 * @example
 * throw new ValidationError('Invalid email format', 'email', 'not-an-email');
 */
class ValidationError extends TelletError {
  /**
   * Creates an instance of ValidationError.
   * 
   * @param {string} message - Error message
   * @param {string} field - Field that failed validation
   * @param {*} value - Invalid value that was provided
   */
  constructor(message, field, value) {
    super(message, 'VALIDATION_ERROR', { field, value });
    this.field = field;
    this.value = value;
  }

  /**
   * Create a validation error for invalid MongoDB ObjectId.
   * 
   * @param {string} field - Field name
   * @param {string} value - Invalid ObjectId value
   * @returns {ValidationError} Validation error instance
   * @example
   * throw ValidationError.invalidObjectId('projectId', 'invalid-id');
   */
  static invalidObjectId(field, value) {
    return new ValidationError(
      `Invalid MongoDB ObjectId format for ${field}`,
      field,
      value
    );
  }

  /**
   * Create a validation error for invalid email format.
   * 
   * @param {string} email - Invalid email address
   * @returns {ValidationError} Validation error instance
   * @example
   * throw ValidationError.invalidEmail('not-an-email');
   */
  static invalidEmail(email) {
    return new ValidationError(
      'Invalid email format',
      'email',
      email
    );
  }

  /**
   * Create a validation error for missing required field.
   * 
   * @param {string} field - Required field name
   * @returns {ValidationError} Validation error instance
   * @example
   * throw ValidationError.requiredField('projectId');
   */
  static requiredField(field) {
    return new ValidationError(
      `${field} is required`,
      field,
      null
    );
  }

  /**
   * Create a validation error for invalid date range.
   * 
   * @param {Date|string} start - Start date
   * @param {Date|string} end - End date
   * @returns {ValidationError} Validation error instance
   * @example
   * throw ValidationError.invalidDateRange('2024-01-01', '2023-01-01');
   */
  static invalidDateRange(start, end) {
    return new ValidationError(
      'Start date must be before end date',
      'dateRange',
      { start, end }
    );
  }
}

/**
 * File system errors for I/O operations.
 * 
 * @class FileSystemError
 * @extends TelletError
 * @example
 * throw new FileSystemError('Cannot write file', '/path/to/file', 'write');
 */
class FileSystemError extends TelletError {
  /**
   * Creates an instance of FileSystemError.
   * 
   * @param {string} message - Error message
   * @param {string} path - File or directory path
   * @param {string} operation - Operation that failed (read, write, delete, etc.)
   */
  constructor(message, path, operation) {
    super(message, 'FS_ERROR', { path, operation });
    this.path = path;
    this.operation = operation;
  }

  static fileNotFound(path) {
    return new FileSystemError(
      `File not found: ${path}`,
      path,
      'read'
    );
  }

  static permissionDenied(path, operation) {
    return new FileSystemError(
      `Permission denied: ${operation} ${path}`,
      path,
      operation
    );
  }

  static diskSpaceError(path, required) {
    return new FileSystemError(
      `Insufficient disk space for ${path}`,
      path,
      'write'
    );
  }
}

/**
 * Configuration errors for missing or invalid configuration.
 * 
 * @class ConfigurationError
 * @extends TelletError
 * @example
 * throw new ConfigurationError('Invalid API URL', { url: 'not-a-url' });
 */
class ConfigurationError extends TelletError {
  constructor(message, config) {
    super(message, 'CONFIG_ERROR', { config });
  }

  static missingCredentials() {
    return new ConfigurationError(
      'Missing credentials. Please set TELLET_EMAIL and TELLET_PASSWORD environment variables or pass them as arguments.',
      { required: ['TELLET_EMAIL', 'TELLET_PASSWORD'] }
    );
  }

  static invalidApiUrl(url) {
    return new ConfigurationError(
      `Invalid API URL: ${url}`,
      { url }
    );
  }
}

/**
 * Resource errors for entity not found or conflict scenarios.
 * 
 * @class ResourceError
 * @extends TelletError
 * @example
 * throw new ResourceError('Project not found', 'project', '123');
 */
class ResourceError extends TelletError {
  /**
   * Creates an instance of ResourceError.
   * 
   * @param {string} message - Error message
   * @param {string} resource - Resource type (project, workspace, etc.)
   * @param {string} id - Resource identifier
   */
  constructor(message, resource, id) {
    super(message, 'RESOURCE_ERROR', { resource, id });
    this.resource = resource;
    this.id = id;
  }

  static notFound(resource, id) {
    return new ResourceError(
      `${resource} not found: ${id}`,
      resource,
      id
    );
  }

  static alreadyExists(resource, id) {
    return new ResourceError(
      `${resource} already exists: ${id}`,
      resource,
      id
    );
  }
}

/**
 * Operation errors for failed or incomplete operations.
 * 
 * @class OperationError
 * @extends TelletError
 * @example
 * throw new OperationError('Export failed', 'export', 'disk_full');
 */
class OperationError extends TelletError {
  constructor(message, operation, reason) {
    super(message, 'OPERATION_ERROR', { operation, reason });
  }

  static timeout(operation, duration) {
    return new OperationError(
      `Operation timed out after ${duration}ms`,
      operation,
      'timeout'
    );
  }

  static cancelled(operation) {
    return new OperationError(
      `Operation cancelled: ${operation}`,
      operation,
      'cancelled'
    );
  }

  static partial(operation, completed, total) {
    return new OperationError(
      `Operation partially completed: ${completed}/${total}`,
      operation,
      'partial'
    );
  }
}

/**
 * Rate limiting errors for API request throttling.
 * 
 * @class RateLimitError
 * @extends APIError
 * @example
 * throw new RateLimitError(60); // Retry after 60 seconds
 */
class RateLimitError extends APIError {
  /**
   * Creates an instance of RateLimitError.
   * 
   * @param {number|null} [retryAfter=null] - Seconds to wait before retrying
   */
  constructor(retryAfter = null) {
    const message = retryAfter 
      ? `Rate limit exceeded. Retry after ${retryAfter} seconds`
      : 'Rate limit exceeded';
    super(message, 429, { retryAfter });
    this.code = 'RATE_LIMIT_ERROR';
    this.retryAfter = retryAfter;
  }
}

/**
 * Error handler utility for centralized error processing and user-friendly output.
 * Provides consistent error formatting, suggestions, and exit codes.
 * 
 * @class ErrorHandler
 * @example
 * ErrorHandler.handle(error, { operation: 'export', exit: false });
 */
class ErrorHandler {
  /**
   * Handle an error with appropriate logging, suggestions, and exit codes.
   * 
   * @param {Error} error - Error to handle
   * @param {Object} [context={}] - Error context
   * @param {string} [context.operation] - Operation that failed
   * @param {boolean} [context.exit=true] - Whether to exit the process
   * @throws {never} Exits process unless context.exit is false
   */
  static handle(error, context = {}) {
    // Log error with context
    console.error(`[${new Date().toISOString()}] Error in ${context.operation || 'unknown operation'}:`);
    
    if (error instanceof TelletError) {
      console.error(`${error.code}: ${error.message}`);
      if (Object.keys(error.details).length > 0) {
        console.error('Details:', JSON.stringify(error.details, null, 2));
      }
    } else if (error.response) {
      // Axios error
      console.error(`API Error (${error.response.status}):`, error.response.data?.message || error.message);
    } else if (error.code === 'ENOENT') {
      console.error('File not found:', error.path);
    } else if (error.code === 'EACCES') {
      console.error('Permission denied:', error.path);
    } else if (error.code === 'ECONNREFUSED') {
      console.error('Connection refused. Please check if the API server is running.');
    } else {
      console.error(error.message);
    }

    // Show user-friendly suggestions
    this.showSuggestions(error);

    // Exit with appropriate code
    if (context.exit !== false) {
      process.exit(this.getExitCode(error));
    }
  }

  /**
   * Show user-friendly suggestions based on error type.
   * 
   * @param {Error} error - Error to provide suggestions for
   * @private
   */
  static showSuggestions(error) {
    if (error instanceof AuthenticationError) {
      console.error('\nPlease check your credentials and try again.');
      console.error('You can set credentials using environment variables:');
      console.error('  export TELLET_EMAIL=your-email@example.com');
      console.error('  export TELLET_PASSWORD=your-password');
    } else if (error instanceof NetworkError) {
      console.error('\nPlease check your internet connection and try again.');
    } else if (error instanceof RateLimitError && error.retryAfter) {
      console.error(`\nPlease wait ${error.retryAfter} seconds before trying again.`);
    } else if (error instanceof ValidationError) {
      console.error('\nPlease check your input and try again.');
    }
  }

  /**
   * Get appropriate exit code based on error type.
   * 
   * @param {Error} error - Error to get exit code for
   * @returns {number} Exit code (1-8)
   * @private
   */
  static getExitCode(error) {
    if (error instanceof ValidationError) return 2;
    if (error instanceof AuthenticationError) return 3;
    if (error instanceof AuthorizationError) return 4;
    if (error instanceof NetworkError) return 5;
    if (error instanceof FileSystemError) return 6;
    if (error instanceof ConfigurationError) return 7;
    if (error instanceof RateLimitError) return 8;
    return 1;
  }

  /**
   * Wrap an async function with automatic error handling.
   * 
   * @param {Function} fn - Async function to wrap
   * @param {Object} context - Error context for handling
   * @returns {Function} Wrapped function
   * @example
   * const safeExport = ErrorHandler.wrap(exportFunction, { operation: 'export' });
   * await safeExport(projectId);
   */
  static wrap(fn, context) {
    return async (...args) => {
      try {
        return await fn(...args);
      } catch (error) {
        this.handle(error, context);
      }
    };
  }
}

module.exports = {
  TelletError,
  APIError,
  AuthenticationError,
  AuthorizationError,
  NetworkError,
  ValidationError,
  FileSystemError,
  ConfigurationError,
  ResourceError,
  OperationError,
  RateLimitError,
  ErrorHandler
};