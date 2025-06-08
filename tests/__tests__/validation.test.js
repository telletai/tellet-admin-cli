// Input validation tests

describe('Input Validation', () => {
  describe('MongoDB ObjectId Validation', () => {
    const isValidObjectId = (id) => {
      return /^[a-fA-F0-9]{24}$/.test(id);
    };

    it('should accept valid ObjectIds', () => {
      const validIds = [
        '507f1f77bcf86cd799439011',
        '507F1F77BCF86CD799439011', // uppercase
        'aaaaaaaaaaaaaaaaaaaaaaaa',
        '000000000000000000000000'
      ];

      validIds.forEach(id => {
        expect(isValidObjectId(id)).toBe(true);
      });
    });

    it('should reject invalid ObjectIds', () => {
      const invalidIds = [
        '507f1f77bcf86cd79943901',   // 23 chars
        '507f1f77bcf86cd7994390111',  // 25 chars
        '507f1f77bcf86cd79943901g',   // contains 'g'
        'invalid-id',
        '',
        null,
        undefined,
        123456789012345678901234
      ];

      invalidIds.forEach(id => {
        expect(isValidObjectId(String(id))).toBe(false);
      });
    });
  });

  describe('Email Validation', () => {
    const isValidEmail = (email) => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(email);
    };

    it('should accept valid email addresses', () => {
      const validEmails = [
        'user@example.com',
        'test.user@example.com',
        'user+tag@example.co.uk',
        'user123@test-domain.com'
      ];

      validEmails.forEach(email => {
        expect(isValidEmail(email)).toBe(true);
      });
    });

    it('should reject invalid email addresses', () => {
      const invalidEmails = [
        'invalid.email',
        '@example.com',
        'user@',
        'user @example.com',
        'user@example',
        '',
        null,
        undefined
      ];

      invalidEmails.forEach(email => {
        expect(isValidEmail(String(email || ''))).toBe(false);
      });
    });
  });

  describe('Date Validation', () => {
    const isValidDate = (dateString) => {
      const date = new Date(dateString);
      return date instanceof Date && !isNaN(date);
    };

    it('should accept valid date formats', () => {
      const validDates = [
        '2025-01-01',
        '2025-01-01T00:00:00Z',
        '2025-01-01T12:30:45.000Z',
        'January 1, 2025',
        '01/01/2025'
      ];

      validDates.forEach(date => {
        expect(isValidDate(date)).toBe(true);
      });
    });

    it('should reject invalid dates', () => {
      const invalidDates = [
        'invalid-date',
        '2025-13-01',    // Invalid month
        '2025-01-32',    // Invalid day
        '',
        null,
        undefined
      ];

      invalidDates.forEach(date => {
        expect(isValidDate(String(date || ''))).toBe(false);
      });
    });
  });

  describe('File Path Validation', () => {
    const path = require('path');
    
    const sanitizePath = (inputPath) => {
      if (!inputPath || typeof inputPath !== 'string') {
        return null;
      }

      // Normalize the path
      const normalized = path.normalize(inputPath);
      
      // Check for directory traversal
      if (normalized.includes('..')) {
        return null;
      }

      // Check for absolute paths (security risk)
      if (path.isAbsolute(normalized) && !normalized.startsWith(process.cwd())) {
        return null;
      }

      return normalized;
    };

    it('should accept safe file paths', () => {
      const safePaths = [
        'exports/data.csv',
        './exports/data.csv',
        'exports/project/file.json',
        'file.txt'
      ];

      safePaths.forEach(filePath => {
        expect(sanitizePath(filePath)).toBeTruthy();
      });
    });

    it('should reject unsafe file paths', () => {
      const unsafePaths = [
        '../../../etc/passwd',
        '..\\..\\windows\\system32',
        '/etc/passwd',
        'C:\\Windows\\System32',
        '',
        null,
        undefined
      ];

      unsafePaths.forEach(filePath => {
        expect(sanitizePath(filePath)).toBeFalsy();
      });
    });
  });

  describe('Number Validation', () => {
    const parsePositiveInt = (value, defaultValue) => {
      const parsed = parseInt(value, 10);
      if (isNaN(parsed) || parsed < 0) {
        return defaultValue;
      }
      return parsed;
    };

    it('should parse valid positive integers', () => {
      expect(parsePositiveInt('100', 50)).toBe(100);
      expect(parsePositiveInt('0', 50)).toBe(0);
      expect(parsePositiveInt('999999', 50)).toBe(999999);
    });

    it('should return default for invalid values', () => {
      expect(parsePositiveInt('-1', 50)).toBe(50);
      expect(parsePositiveInt('abc', 50)).toBe(50);
      expect(parsePositiveInt('', 50)).toBe(50);
      expect(parsePositiveInt(null, 50)).toBe(50);
      expect(parsePositiveInt(undefined, 50)).toBe(50);
    });
  });

  describe('CSV Field Validation', () => {
    const validateCSVHeaders = (headers, requiredHeaders) => {
      const normalizedHeaders = headers.map(h => h.toLowerCase().trim());
      return requiredHeaders.every(required => 
        normalizedHeaders.includes(required.toLowerCase())
      );
    };

    it('should validate required CSV headers', () => {
      const headers = ['Email', 'Name', 'Role'];
      const required = ['email', 'name'];
      
      expect(validateCSVHeaders(headers, required)).toBe(true);
    });

    it('should fail when required headers are missing', () => {
      const headers = ['Email', 'Role'];
      const required = ['email', 'name'];
      
      expect(validateCSVHeaders(headers, required)).toBe(false);
    });

    it('should handle case-insensitive matching', () => {
      const headers = ['EMAIL', 'NAME'];
      const required = ['email', 'name'];
      
      expect(validateCSVHeaders(headers, required)).toBe(true);
    });
  });

  describe('API Response Validation', () => {
    const validateAPIResponse = (response, requiredFields) => {
      if (!response || typeof response !== 'object') {
        return false;
      }

      return requiredFields.every(field => {
        const value = field.split('.').reduce((obj, key) => obj?.[key], response);
        return value !== undefined && value !== null;
      });
    };

    it('should validate response with required fields', () => {
      const response = {
        data: {
          token: 'abc123',
          user: { id: '123', email: 'test@example.com' }
        }
      };

      expect(validateAPIResponse(response, ['data.token', 'data.user.id'])).toBe(true);
    });

    it('should fail when required fields are missing', () => {
      const response = {
        data: {
          user: { id: '123' }
          // missing token
        }
      };

      expect(validateAPIResponse(response, ['data.token', 'data.user.id'])).toBe(false);
    });

    it('should handle null/undefined responses', () => {
      expect(validateAPIResponse(null, ['data'])).toBe(false);
      expect(validateAPIResponse(undefined, ['data'])).toBe(false);
      expect(validateAPIResponse({}, ['data'])).toBe(false);
    });
  });

  describe('Command Line Argument Validation', () => {
    const validateDelay = (delay) => {
      const parsed = parseInt(delay, 10);
      if (isNaN(parsed) || parsed < 0) {
        throw new Error('Delay must be a positive number');
      }
      if (parsed > 600000) { // 10 minutes max
        throw new Error('Delay cannot exceed 600000ms (10 minutes)');
      }
      return parsed;
    };

    it('should accept valid delay values', () => {
      expect(validateDelay('100')).toBe(100);
      expect(validateDelay('0')).toBe(0);
      expect(validateDelay('600000')).toBe(600000);
    });

    it('should reject invalid delay values', () => {
      expect(() => validateDelay('-1')).toThrow('positive number');
      expect(() => validateDelay('abc')).toThrow('positive number');
      expect(() => validateDelay('700000')).toThrow('cannot exceed');
    });
  });
});