/**
 * Input validation utilities for Tellet Admin CLI
 */

const { ValidationError } = require('./errors');

/**
 * Validate MongoDB ObjectId format
 * @param {string} id - The ID to validate
 * @param {string} field - Field name for error messages
 * @returns {string} The validated ID
 * @throws {ValidationError} If ID is invalid
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
 * Validate email address format
 * @param {string} email - Email to validate
 * @returns {string} The validated email
 * @throws {ValidationError} If email is invalid
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
 * Validate date string
 * @param {string} dateString - Date to validate
 * @param {string} field - Field name for error messages
 * @returns {Date} The parsed date
 * @throws {ValidationError} If date is invalid
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
 * Validate date range
 * @param {string} startDate - Start date
 * @param {string} endDate - End date
 * @returns {{start: Date, end: Date}} Validated date range
 * @throws {ValidationError} If dates are invalid or range is wrong
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
 * Validate and sanitize file path
 * @param {string} filePath - Path to validate
 * @param {Object} options - Validation options
 * @returns {string} Sanitized path
 * @throws {ValidationError} If path is invalid
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
 * Validate positive integer
 * @param {*} value - Value to validate
 * @param {string} field - Field name
 * @param {Object} options - Validation options
 * @returns {number} Validated integer
 * @throws {ValidationError} If value is invalid
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
 * Validate enum value
 * @param {*} value - Value to validate
 * @param {string[]} allowedValues - Allowed values
 * @param {string} field - Field name
 * @returns {string} Validated value
 * @throws {ValidationError} If value is invalid
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
 * Validate CSV headers
 * @param {string[]} headers - CSV headers
 * @param {string[]} requiredHeaders - Required header names
 * @returns {boolean} True if valid
 * @throws {ValidationError} If required headers are missing
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
 * Validate API response structure
 * @param {Object} response - API response
 * @param {string[]} requiredFields - Required field paths (e.g., 'data.token')
 * @returns {boolean} True if valid
 * @throws {ValidationError} If required fields are missing
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
 * Validate command options
 * @param {Object} options - Command options
 * @param {Object} schema - Validation schema
 * @returns {Object} Validated options
 * @throws {ValidationError} If validation fails
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
 * Create a validation schema for common command options
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