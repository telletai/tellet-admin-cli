/**
 * Custom error classes for Tellet Admin CLI
 */

/**
 * Base error class for all Tellet CLI errors
 */
class TelletError extends Error {
  constructor(message, code = 'TELLET_ERROR', details = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.details = details;
    this.timestamp = new Date().toISOString();
    Error.captureStackTrace(this, this.constructor);
  }

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
 * API-related errors
 */
class APIError extends TelletError {
  constructor(message, statusCode, response = {}) {
    super(message, 'API_ERROR', { statusCode, response });
    this.statusCode = statusCode;
    this.response = response;
  }

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
 * Authentication errors
 */
class AuthenticationError extends APIError {
  constructor(message = 'Authentication failed') {
    super(message, 401, { requiresAuth: true });
    this.code = 'AUTH_ERROR';
  }
}

/**
 * Authorization errors
 */
class AuthorizationError extends APIError {
  constructor(message = 'Access denied') {
    super(message, 403, { requiresPermission: true });
    this.code = 'AUTHZ_ERROR';
  }
}

/**
 * Network-related errors
 */
class NetworkError extends TelletError {
  constructor(message = 'Network error occurred') {
    super(message, 'NETWORK_ERROR');
  }
}

/**
 * Validation errors
 */
class ValidationError extends TelletError {
  constructor(message, field, value) {
    super(message, 'VALIDATION_ERROR', { field, value });
    this.field = field;
    this.value = value;
  }

  static invalidObjectId(field, value) {
    return new ValidationError(
      `Invalid MongoDB ObjectId format for ${field}`,
      field,
      value
    );
  }

  static invalidEmail(email) {
    return new ValidationError(
      'Invalid email format',
      'email',
      email
    );
  }

  static requiredField(field) {
    return new ValidationError(
      `${field} is required`,
      field,
      null
    );
  }

  static invalidDateRange(start, end) {
    return new ValidationError(
      'Start date must be before end date',
      'dateRange',
      { start, end }
    );
  }
}

/**
 * File system errors
 */
class FileSystemError extends TelletError {
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
 * Configuration errors
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
 * Resource errors
 */
class ResourceError extends TelletError {
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
 * Operation errors
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
 * Rate limiting errors
 */
class RateLimitError extends APIError {
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
 * Error handler utility
 */
class ErrorHandler {
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
   * Wrap an async function with error handling
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