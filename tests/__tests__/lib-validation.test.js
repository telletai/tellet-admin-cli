const {
  validateObjectId,
  validateEmail,
  validateDate,
  validateFilePath,
  validatePositiveInt,
  validateCommandArgs,
  validateOptions,
  schemas
} = require('../../lib/validation');

describe('lib/validation', () => {
  describe('validateObjectId', () => {
    it('should validate correct ObjectIds', () => {
      const validIds = [
        '507f1f77bcf86cd799439011',
        '507f191e810c19729de860ea',
        '65b123456789012345678901'
      ];
      
      validIds.forEach(id => {
        expect(validateObjectId(id)).toBe(id);
      });
    });

    it('should return null for invalid ObjectIds', () => {
      const invalidIds = [
        '123',
        'invalid',
        '507f1f77bcf86cd79943901Z',
        '',
        null,
        undefined
      ];
      
      invalidIds.forEach(id => {
        expect(validateObjectId(id)).toBeNull();
      });
    });
  });

  describe('validateEmail', () => {
    it('should validate correct emails', () => {
      const validEmails = [
        'test@example.com',
        'user.name@company.co.uk',
        'first+last@domain.org',
        'test123@subdomain.example.com'
      ];
      
      validEmails.forEach(email => {
        expect(validateEmail(email)).toBe(email);
      });
    });

    it('should return null for invalid emails', () => {
      const invalidEmails = [
        'notanemail',
        '@example.com',
        'test@',
        'test@.com',
        'test..name@example.com',
        '',
        null
      ];
      
      invalidEmails.forEach(email => {
        expect(validateEmail(email)).toBeNull();
      });
    });
  });

  describe('validateDate', () => {
    it('should validate and parse date strings', () => {
      const testCases = [
        { input: '2024-01-15', expected: new Date('2024-01-15T00:00:00.000Z') },
        { input: '2024-12-31', expected: new Date('2024-12-31T00:00:00.000Z') },
        { input: '2023-06-15', expected: new Date('2023-06-15T00:00:00.000Z') }
      ];
      
      testCases.forEach(({ input, expected }) => {
        const result = validateDate(input);
        expect(result).toEqual(expected);
      });
    });

    it('should return null for invalid dates', () => {
      const invalidDates = [
        '2024-13-01',
        '2024-00-01',
        '2024-01-32',
        'not-a-date',
        '2024/01/15',
        '',
        null
      ];
      
      invalidDates.forEach(date => {
        expect(validateDate(date)).toBeNull();
      });
    });
  });

  describe('validateFilePath', () => {
    it('should validate safe file paths', () => {
      const safePaths = [
        'exports/data.csv',
        './reports/summary.json',
        'media/image.png',
        '/home/user/documents/file.txt'
      ];
      
      safePaths.forEach(path => {
        expect(validateFilePath(path)).toBe(path);
      });
    });

    it('should reject unsafe paths', () => {
      const unsafePaths = [
        '../../../etc/passwd',
        '..\\..\\windows\\system32\\config',
        '/etc/shadow',
        'C:\\Windows\\System32\\drivers\\etc\\hosts',
        '~/../../root/.ssh/id_rsa'
      ];
      
      unsafePaths.forEach(path => {
        expect(validateFilePath(path)).toBeNull();
      });
    });
  });

  describe('validatePositiveInt', () => {
    it('should parse valid positive integers', () => {
      expect(validatePositiveInt('123')).toBe(123);
      expect(validatePositiveInt('1')).toBe(1);
      expect(validatePositiveInt('999999')).toBe(999999);
      expect(validatePositiveInt(456)).toBe(456);
    });

    it('should return default for invalid values', () => {
      expect(validatePositiveInt('abc', 10)).toBe(10);
      expect(validatePositiveInt('-5', 10)).toBe(10);
      expect(validatePositiveInt('0', 10)).toBe(10);
      expect(validatePositiveInt('1.5', 10)).toBe(10);
      expect(validatePositiveInt('', 10)).toBe(10);
      expect(validatePositiveInt(null, 10)).toBe(10);
    });
  });

  describe('validateCommandArgs', () => {
    it('should validate all delay values', () => {
      const validDelays = ['1000', '5000', '30000', '120000'];
      
      validDelays.forEach(delay => {
        expect(() => validateCommandArgs({ delay })).not.toThrow();
      });
    });

    it('should throw for invalid delay values', () => {
      const invalidDelays = ['-1000', '999999999', 'abc', '1.5'];
      
      invalidDelays.forEach(delay => {
        expect(() => validateCommandArgs({ delay }))
          .toThrow('Invalid delay value');
      });
    });

    it('should validate dryRun flag', () => {
      expect(() => validateCommandArgs({ dryRun: true })).not.toThrow();
      expect(() => validateCommandArgs({ dryRun: false })).not.toThrow();
      expect(() => validateCommandArgs({ dryRun: 'true' })).not.toThrow();
    });
  });

  describe('validateOptions', () => {
    it('should validate options against schema', () => {
      const schema = {
        name: { type: 'string', required: true },
        age: { type: 'int', min: 0, max: 150 },
        email: { type: 'email' }
      };
      
      const validOptions = {
        name: 'John',
        age: '30',
        email: 'john@example.com'
      };
      
      const result = validateOptions(validOptions, schema);
      expect(result).toEqual({
        name: 'John',
        age: 30,
        email: 'john@example.com'
      });
    });

    it('should throw for missing required fields', () => {
      const schema = {
        required: { type: 'string', required: true }
      };
      
      expect(() => validateOptions({}, schema))
        .toThrow('Missing required field: required');
    });

    it('should throw for invalid types', () => {
      const schema = {
        id: { type: 'objectId' }
      };
      
      expect(() => validateOptions({ id: 'invalid' }, schema))
        .toThrow('Invalid objectId for field: id');
    });

    it('should apply defaults', () => {
      const schema = {
        count: { type: 'int', default: 10 }
      };
      
      const result = validateOptions({}, schema);
      expect(result.count).toBe(10);
    });

    it('should validate enum values', () => {
      const schema = {
        status: { type: 'string', enum: ['active', 'inactive'] }
      };
      
      expect(validateOptions({ status: 'active' }, schema))
        .toEqual({ status: 'active' });
      
      expect(() => validateOptions({ status: 'pending' }, schema))
        .toThrow('Invalid value for status. Must be one of: active, inactive');
    });

    it('should validate integer ranges', () => {
      const schema = {
        delay: { type: 'int', min: 0, max: 60000 }
      };
      
      expect(validateOptions({ delay: '1000' }, schema))
        .toEqual({ delay: 1000 });
      
      expect(() => validateOptions({ delay: '70000' }, schema))
        .toThrow('delay must be between 0 and 60000');
    });
  });

  describe('schemas', () => {
    it('should have valid predefined schemas', () => {
      expect(schemas.apiConfig).toBeDefined();
      expect(schemas.exportOptions).toBeDefined();
      expect(schemas.categorizeOptions).toBeDefined();
      
      // Test using a predefined schema
      const config = validateOptions({
        timeout: '5000',
        retries: '3'
      }, schemas.apiConfig);
      
      expect(config.timeout).toBe(5000);
      expect(config.retries).toBe(3);
    });
  });
});