/**
 * @fileoverview Input validation utilities for Tellet Admin CLI.
 * Provides comprehensive validation functions for various input types
 * including ObjectIds, emails, dates, file paths, and command options.
 * 
 * @module lib/validation
 */

const { ValidationError } = require('./errors');

/**
 * Validate MongoDB ObjectId format.
 * Checks for 24 character hexadecimal string.
 * 
 * @param {string} id - The ID to validate
 * @param {string} [field='id'] - Field name for error messages
 * @returns {string} The validated ID
 * @throws {ValidationError} If ID is invalid or missing
 * @example
 * const projectId = validateObjectId('507f1f77bcf86cd799439011', 'projectId');
 * // Returns: '507f1f77bcf86cd799439011'
 * 
 * validateObjectId('invalid'); // Throws ValidationError
 */
function validateObjectId(id, field = 'id') {
  if (!id || typeof id !== 'string') {
    throw ValidationError.requiredField(field);
  }

  if (!/^[a-fA-F0-9]{24}$/.test(id)) {
    throw ValidationError.invalidObjectId(field, id);
  }

  return id;
}

/**
 * Validate email address format.
 * Returns normalized email (lowercase, trimmed).
 * 
 * @param {string} email - Email to validate
 * @returns {string} The validated and normalized email
 * @throws {ValidationError} If email is invalid or missing
 * @example
 * const email = validateEmail('User@Example.com  ');
 * // Returns: 'user@example.com'
 * 
 * validateEmail('invalid-email'); // Throws ValidationError
 */
function validateEmail(email) {
  if (!email || typeof email !== 'string') {
    throw ValidationError.requiredField('email');
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw ValidationError.invalidEmail(email);
  }

  return email.toLowerCase().trim();
}

/**
 * Validate date string and return Date object.
 * Accepts any format parseable by JavaScript Date constructor.
 * 
 * @param {string} dateString - Date to validate
 * @param {string} [field='date'] - Field name for error messages
 * @returns {Date} The parsed date object
 * @throws {ValidationError} If date is invalid or missing
 * @example
 * const date = validateDate('2024-01-15');
 * // Returns: Date object for January 15, 2024
 * 
 * validateDate('invalid-date'); // Throws ValidationError
 */
function validateDate(dateString, field = 'date') {
  if (!dateString) {
    throw ValidationError.requiredField(field);
  }

  const date = new Date(dateString);
  if (isNaN(date.getTime())) {
    throw new ValidationError(
      `Invalid date format for ${field}`,
      field,
      dateString
    );
  }

  return date;
}

/**
 * Validate date range ensuring start date is before end date.
 * 
 * @param {string} startDate - Start date string
 * @param {string} endDate - End date string
 * @returns {{start: Date, end: Date}} Validated date range with Date objects
 * @throws {ValidationError} If dates are invalid or start > end
 * @example
 * const range = validateDateRange('2024-01-01', '2024-12-31');
 * // Returns: { start: Date, end: Date }
 * 
 * validateDateRange('2024-12-31', '2024-01-01'); // Throws ValidationError
 */
function validateDateRange(startDate, endDate) {
  const start = validateDate(startDate, 'startDate');
  const end = validateDate(endDate, 'endDate');

  if (start > end) {
    throw ValidationError.invalidDateRange(startDate, endDate);
  }

  return { start, end };
}

/**
 * Validate and sanitize file path with security checks.
 * Prevents directory traversal and enforces path restrictions.
 * 
 * @param {string} filePath - Path to validate
 * @param {Object} [options={}] - Validation options
 * @param {boolean} [options.allowAbsolute=false] - Allow absolute paths
 * @param {string} [options.basePath] - Base directory to restrict paths within
 * @returns {string} Normalized and validated path
 * @throws {ValidationError} If path is invalid or violates security rules
 * @example
 * // Validate relative path
 * const path = validateFilePath('./exports/data.csv');
 * 
 * // Validate within base directory
 * const safePath = validateFilePath('subdir/file.txt', {
 *   basePath: '/home/user/project'
 * });
 */
function validateFilePath(filePath, options = {}) {
  const path = require('path');
  
  if (!filePath || typeof filePath !== 'string') {
    throw ValidationError.requiredField('filePath');
  }

  // Normalize the path
  const normalized = path.normalize(filePath);

  // Check for directory traversal
  if (normalized.includes('..')) {
    throw new ValidationError(
      'Path traversal detected',
      'filePath',
      filePath
    );
  }

  // Check if absolute paths are allowed
  if (!options.allowAbsolute && path.isAbsolute(normalized)) {
    throw new ValidationError(
      'Absolute paths are not allowed',
      'filePath',
      filePath
    );
  }

  // Check if path is within allowed directory
  if (options.basePath) {
    const resolved = path.resolve(options.basePath, normalized);
    if (!resolved.startsWith(path.resolve(options.basePath))) {
      throw new ValidationError(
        'Path is outside allowed directory',
        'filePath',
        filePath
      );
    }
  }

  return normalized;
}

/**
 * Validate positive integer with optional min/max constraints.
 * 
 * @param {*} value - Value to validate (string or number)
 * @param {string} [field='value'] - Field name for error messages
 * @param {Object} [options={}] - Validation options
 * @param {number} [options.min=0] - Minimum allowed value
 * @param {number} [options.max=Infinity] - Maximum allowed value
 * @param {number} [options.defaultValue] - Default if value is missing
 * @returns {number} Validated integer
 * @throws {ValidationError} If value is invalid or out of range
 * @example
 * const count = validatePositiveInt('42', 'count', { min: 1, max: 100 });
 * // Returns: 42
 * 
 * validatePositiveInt(-5, 'count'); // Throws ValidationError
 */
function validatePositiveInt(value, field = 'value', options = {}) {
  const { min = 0, max = Infinity, defaultValue } = options;

  if (value === undefined || value === null || value === '') {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw ValidationError.requiredField(field);
  }

  const parsed = parseInt(value, 10);
  
  if (isNaN(parsed)) {
    throw new ValidationError(
      `${field} must be a number`,
      field,
      value
    );
  }

  if (parsed < min) {
    throw new ValidationError(
      `${field} must be at least ${min}`,
      field,
      value
    );
  }

  if (parsed > max) {
    throw new ValidationError(
      `${field} must be at most ${max}`,
      field,
      value
    );
  }

  return parsed;
}

/**
 * Validate enum value against allowed values list.
 * 
 * @param {*} value - Value to validate
 * @param {string[]} allowedValues - Array of allowed values
 * @param {string} [field='value'] - Field name for error messages
 * @returns {string} Validated value
 * @throws {ValidationError} If value is not in allowed list or missing
 * @example
 * const status = validateEnum('active', ['active', 'inactive', 'pending'], 'status');
 * // Returns: 'active'
 * 
 * validateEnum('invalid', ['a', 'b', 'c']); // Throws ValidationError
 */
function validateEnum(value, allowedValues, field = 'value') {
  if (!value) {
    throw ValidationError.requiredField(field);
  }

  if (!allowedValues.includes(value)) {
    throw new ValidationError(
      `${field} must be one of: ${allowedValues.join(', ')}`,
      field,
      value
    );
  }

  return value;
}

/**
 * Validate CSV headers contain all required columns.
 * Case-insensitive comparison with trimming.
 * 
 * @param {string[]} headers - Actual CSV headers
 * @param {string[]} requiredHeaders - Required header names
 * @returns {boolean} True if all required headers are present
 * @throws {ValidationError} If required headers are missing
 * @example
 * validateCSVHeaders(
 *   ['Name', 'Email', 'Role'],
 *   ['name', 'email']
 * ); // Returns: true
 * 
 * validateCSVHeaders(['Name'], ['Name', 'Email']); // Throws ValidationError
 */
function validateCSVHeaders(headers, requiredHeaders) {
  const normalizedHeaders = headers.map(h => h.toLowerCase().trim());
  const missing = requiredHeaders.filter(required => 
    !normalizedHeaders.includes(required.toLowerCase())
  );

  if (missing.length > 0) {
    throw new ValidationError(
      `Missing required CSV headers: ${missing.join(', ')}`,
      'headers',
      headers
    );
  }

  return true;
}

/**
 * Validate API response structure contains required fields.
 * Supports nested field paths using dot notation.
 * 
 * @param {Object} response - API response object
 * @param {string[]} requiredFields - Required field paths (e.g., 'data.token')
 * @returns {boolean} True if all required fields are present
 * @throws {ValidationError} If response is invalid or fields are missing
 * @example
 * validateAPIResponse(
 *   { data: { token: 'abc', user: { id: 1 } } },
 *   ['data.token', 'data.user.id']
 * ); // Returns: true
 * 
 * validateAPIResponse({}, ['data.token']); // Throws ValidationError
 */
function validateAPIResponse(response, requiredFields) {
  if (!response || typeof response !== 'object') {
    throw new ValidationError(
      'Invalid API response',
      'response',
      response
    );
  }

  const missing = [];
  
  requiredFields.forEach(fieldPath => {
    const value = fieldPath.split('.').reduce((obj, key) => obj?.[key], response);
    if (value === undefined || value === null) {
      missing.push(fieldPath);
    }
  });

  if (missing.length > 0) {
    throw new ValidationError(
      `Missing required fields in API response: ${missing.join(', ')}`,
      'response',
      response
    );
  }

  return true;
}

/**
 * Validate command options against a schema definition.
 * Supports multiple validation types and rules.
 * 
 * @param {Object} options - Command options to validate
 * @param {Object} schema - Validation schema defining rules for each option
 * @param {Object} schema[key] - Rules for a specific option
 * @param {string} schema[key].type - Value type (objectId, email, date, int, enum, string, boolean)
 * @param {boolean} [schema[key].required] - Whether the option is required
 * @param {*} [schema[key].default] - Default value if not provided
 * @param {RegExp} [schema[key].pattern] - Pattern for string validation
 * @param {string[]} [schema[key].values] - Allowed values for enum type
 * @param {number} [schema[key].min] - Minimum value for int type
 * @param {number} [schema[key].max] - Maximum value for int type
 * @returns {Object} Validated and normalized options
 * @throws {ValidationError} If validation fails for any option
 * @example
 * const validated = validateOptions(
 *   { project: '507f1f77bcf86cd799439011', delay: '5000' },
 *   {
 *     project: { type: 'objectId', required: true },
 *     delay: { type: 'int', min: 0, max: 60000, default: 1000 }
 *   }
 * );
 * // Returns: { project: '507f1f77bcf86cd799439011', delay: 5000 }
 */
function validateOptions(options, schema) {
  const validated = {};

  for (const [key, rules] of Object.entries(schema)) {
    const value = options[key];

    // Check if required
    if (rules.required && (value === undefined || value === null)) {
      throw ValidationError.requiredField(key);
    }

    // Skip if not provided and not required
    if (value === undefined) {
      if (rules.default !== undefined) {
        validated[key] = rules.default;
      }
      continue;
    }

    // Validate based on type
    switch (rules.type) {
      case 'objectId':
        validated[key] = validateObjectId(value, key);
        break;
      
      case 'email':
        validated[key] = validateEmail(value);
        break;
      
      case 'date':
        validated[key] = validateDate(value, key);
        break;
      
      case 'int':
        validated[key] = validatePositiveInt(value, key, rules);
        break;
      
      case 'enum':
        validated[key] = validateEnum(value, rules.values, key);
        break;
      
      case 'string':
        if (rules.pattern && !rules.pattern.test(value)) {
          throw new ValidationError(
            `${key} does not match required pattern`,
            key,
            value
          );
        }
        validated[key] = value;
        break;
      
      case 'boolean':
        validated[key] = Boolean(value);
        break;
      
      default:
        validated[key] = value;
    }
  }

  return validated;
}

/**
 * Pre-defined validation schemas for common command patterns.
 * These can be used directly with validateOptions() or extended for specific commands.
 * 
 * @type {Object.<string, Object>}
 * @property {Object} projectCommand - Schema for project-based commands
 * @property {Object} organizationCommand - Schema for organization-based commands
 * @property {Object} dateRangeCommand - Schema for date range commands
 * @example
 * // Use a pre-defined schema
 * const validated = validateOptions(options, commonSchemas.projectCommand);
 * 
 * // Extend a schema
 * const customSchema = {
 *   ...commonSchemas.projectCommand,
 *   format: { type: 'enum', values: ['json', 'csv'], default: 'json' }
 * };
 */
const commonSchemas = {
  projectCommand: {
    project: { type: 'objectId', required: true },
    email: { type: 'email' },
    password: { type: 'string' },
    url: { type: 'string', pattern: /^https?:\/\// },
    delay: { type: 'int', min: 0, max: 600000, default: 1000 },
    outputDir: { type: 'string', default: './exports' }
  },
  
  organizationCommand: {
    organization: { type: 'objectId', required: true },
    email: { type: 'email' },
    password: { type: 'string' },
    url: { type: 'string', pattern: /^https?:\/\// }
  },
  
  dateRangeCommand: {
    startDate: { type: 'date' },
    endDate: { type: 'date' },
    email: { type: 'email' },
    password: { type: 'string' },
    url: { type: 'string', pattern: /^https?:\/\// }
  }
};

module.exports = {
  validateObjectId,
  validateEmail,
  validateDate,
  validateDateRange,
  validateFilePath,
  validatePositiveInt,
  validateEnum,
  validateCSVHeaders,
  validateAPIResponse,
  validateOptions,
  commonSchemas
};