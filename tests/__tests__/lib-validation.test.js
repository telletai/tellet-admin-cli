const {
  validateObjectId,
  validateEmail,
  validateDate,
  validateFilePath,
  validatePositiveInt,
  validateEnum,
  validateOptions,
  commonSchemas
} = require('../../lib/validation');
const { ValidationError } = require('../../lib/errors');

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

    it('should throw for invalid ObjectIds', () => {
      const invalidIds = [
        '123',
        'invalid',
        '507f1f77bcf86cd79943901Z',
        '',
        null,
        undefined
      ];
      
      invalidIds.forEach(id => {
        expect(() => validateObjectId(id)).toThrow(ValidationError);
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

    it('should throw for invalid emails', () => {
      const invalidEmails = [
        { email: 'notanemail', reason: 'no @ symbol' },
        { email: '@example.com', reason: 'missing local part' },
        { email: 'test@', reason: 'missing domain' },
        { email: 'test@.com', reason: 'domain starts with dot' },
        { email: 'test..name@example.com', reason: 'double dots' },
        { email: '', reason: 'empty string' },
        { email: null, reason: 'null value' }
      ];
      
      invalidEmails.forEach(({ email, reason }) => {
        expect(() => validateEmail(email)).toThrow(ValidationError);
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

    it('should throw for invalid dates', () => {
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
        expect(() => validateDate(date)).toThrow();
      });
    });
  });

  describe('validateFilePath', () => {
    it('should validate safe file paths', () => {
      const path = require('path');
      const testCases = [
        { input: 'exports/data.csv', expected: 'exports/data.csv' },
        { input: './reports/summary.json', expected: 'reports/summary.json' },
        { input: 'media/image.png', expected: 'media/image.png' }
      ];
      
      testCases.forEach(({ input, expected }) => {
        expect(validateFilePath(input)).toBe(expected);
      });
      
      // Test absolute paths with allowAbsolute option
      expect(validateFilePath('/home/user/documents/file.txt', { allowAbsolute: true }))
        .toBe('/home/user/documents/file.txt');
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
        expect(() => validateFilePath(path)).toThrow();
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

  describe('validateEnum', () => {
    it('should validate allowed enum values', () => {
      const allowedValues = ['active', 'inactive', 'pending'];
      
      expect(validateEnum('active', allowedValues, 'status')).toBe('active');
      expect(validateEnum('inactive', allowedValues, 'status')).toBe('inactive');
    });

    it('should throw for invalid enum values', () => {
      const allowedValues = ['active', 'inactive'];
      
      expect(() => validateEnum('pending', allowedValues, 'status'))
        .toThrow(ValidationError);
      expect(() => validateEnum('', allowedValues, 'status'))
        .toThrow(ValidationError);
      expect(() => validateEnum(null, allowedValues, 'status'))
        .toThrow(ValidationError);
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
        .toThrow(ValidationError);
    });

    it('should throw for invalid types', () => {
      const schema = {
        id: { type: 'objectId' }
      };
      
      expect(() => validateOptions({ id: 'invalid' }, schema))
        .toThrow(ValidationError);
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
        .toThrow(ValidationError);
    });

    it('should validate integer ranges', () => {
      const schema = {
        delay: { type: 'int', min: 0, max: 60000 }
      };
      
      expect(validateOptions({ delay: '1000' }, schema))
        .toEqual({ delay: 1000 });
      
      expect(() => validateOptions({ delay: '70000' }, schema))
        .toThrow(ValidationError);
    });
  });

  describe('commonSchemas', () => {
    it('should have valid predefined schemas', () => {
      expect(commonSchemas).toBeDefined();
      expect(commonSchemas.projectCommand).toBeDefined();
      expect(commonSchemas.organizationCommand).toBeDefined();
      expect(commonSchemas.dateRangeCommand).toBeDefined();
      
      // Test using a predefined schema
      const validated = validateOptions({
        project: '507f1f77bcf86cd799439011',
        delay: '5000'
      }, commonSchemas.projectCommand);
      
      expect(validated.project).toBe('507f1f77bcf86cd799439011');
      expect(validated.delay).toBe(5000);
    });

    it('should validate organization command schema', () => {
      const validated = validateOptions({
        organization: '507f1f77bcf86cd799439011',
        email: 'test@example.com'
      }, commonSchemas.organizationCommand);
      
      expect(validated.organization).toBe('507f1f77bcf86cd799439011');
      expect(validated.email).toBe('test@example.com');
    });

    it('should validate date range command schema', () => {
      const validated = validateOptions({
        startDate: '2024-01-01',
        endDate: '2024-12-31'
      }, commonSchemas.dateRangeCommand);
      
      expect(validated.startDate).toEqual(new Date('2024-01-01T00:00:00.000Z'));
      expect(validated.endDate).toEqual(new Date('2024-12-31T00:00:00.000Z'));
    });

    it('should use default values from schema', () => {
      const validated = validateOptions({
        project: '507f1f77bcf86cd799439011'
      }, commonSchemas.projectCommand);
      
      expect(validated.delay).toBe(1000);
      expect(validated.outputDir).toBe('./exports');
    });

    it('should validate URL pattern', () => {
      expect(() => validateOptions({
        project: '507f1f77bcf86cd799439011',
        url: 'not-a-url'
      }, commonSchemas.projectCommand)).toThrow();
      
      const validated = validateOptions({
        project: '507f1f77bcf86cd799439011',
        url: 'https://api.tellet.ai'
      }, commonSchemas.projectCommand);
      
      expect(validated.url).toBe('https://api.tellet.ai');
    });
  });

  describe('boolean type validation', () => {
    it('should convert values to boolean', () => {
      const schema = {
        active: { type: 'boolean' }
      };
      
      expect(validateOptions({ active: true }, schema)).toEqual({ active: true });
      expect(validateOptions({ active: false }, schema)).toEqual({ active: false });
      expect(validateOptions({ active: 'true' }, schema)).toEqual({ active: true });
      expect(validateOptions({ active: '' }, schema)).toEqual({ active: false });
      expect(validateOptions({ active: 0 }, schema)).toEqual({ active: false });
      expect(validateOptions({ active: 1 }, schema)).toEqual({ active: true });
    });
  });
});