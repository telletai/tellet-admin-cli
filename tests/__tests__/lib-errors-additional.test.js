const {
  TelletError,
  APIError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  ResourceError,
  NetworkError,
  RateLimitError,
  FileSystemError,
  ConfigurationError,
  ErrorHandler
} = require('../../lib/errors');

describe('Additional Error Classes Tests', () => {
  describe('ConfigurationError', () => {
    it('should create configuration error', () => {
      const error = new ConfigurationError('Invalid API URL', { url: 'invalid' });
      expect(error).toBeInstanceOf(TelletError);
      expect(error.message).toBe('Invalid API URL');
      expect(error.code).toBe('CONFIG_ERROR');
    });
  });

  describe('Error static factory methods', () => {
    it('should create required field error', () => {
      const error = ValidationError.requiredField('email');
      expect(error.message).toBe('email is required');
      expect(error.field).toBe('email');
    });

    it('should create invalid object ID error', () => {
      const error = ValidationError.invalidObjectId('projectId', '123');
      expect(error.message).toBe('Invalid MongoDB ObjectId format for projectId');
      expect(error.field).toBe('projectId');
      expect(error.value).toBe('123');
    });

    it('should create invalid email error', () => {
      const error = ValidationError.invalidEmail('notanemail');
      expect(error.message).toBe('Invalid email format');
      expect(error.field).toBe('email');
      expect(error.value).toBe('notanemail');
    });

    it('should create invalid date range error', () => {
      const error = ValidationError.invalidDateRange('2024-12-31', '2024-01-01');
      expect(error.message).toBe('Start date must be before end date');
      expect(error.field).toBe('dateRange');
    });

    it('should create resource not found error', () => {
      const error = ResourceError.notFound('Project', '123');
      expect(error.message).toBe('Project not found: 123');
      expect(error.resource).toBe('Project');
      expect(error.id).toBe('123');
    });

    it('should create already exists error', () => {
      const error = ResourceError.alreadyExists('User', 'test@example.com');
      expect(error.message).toBe('User already exists: test@example.com');
      expect(error.code).toBe('RESOURCE_ERROR');
    });

    it('should create access denied error', () => {
      // ResourceError doesn't have accessDenied method, let's test constructor instead
      const error = new ResourceError('Access denied to Workspace: 456', 'Workspace', '456');
      expect(error.message).toBe('Access denied to Workspace: 456');
      expect(error.code).toBe('RESOURCE_ERROR');
    });
  });

  describe('ErrorHandler advanced features', () => {
    let consoleErrorSpy;
    let processExitSpy;

    beforeEach(() => {
      consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      processExitSpy = jest.spyOn(process, 'exit').mockImplementation();
    });

    afterEach(() => {
      consoleErrorSpy.mockRestore();
      processExitSpy.mockRestore();
    });

    it('should handle file system errors', () => {
      const error = new FileSystemError('Failed to write file', 'write');
      ErrorHandler.handle(error, { operation: 'export' });
      
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('FS_ERROR')
      );
    });

    it('should handle configuration errors', () => {
      const error = new ConfigurationError('Missing API key', {});
      ErrorHandler.handle(error, { operation: 'init' });
      
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('CONFIG_ERROR')
      );
    });

    it('should provide correct exit codes for different errors', () => {
      expect(ErrorHandler.getExitCode(new ValidationError('Invalid'))).toBe(2);
      expect(ErrorHandler.getExitCode(new AuthenticationError('Unauthorized'))).toBe(3);
      expect(ErrorHandler.getExitCode(new AuthorizationError('Forbidden'))).toBe(4);
      expect(ErrorHandler.getExitCode(new NetworkError('Timeout'))).toBe(5);
      expect(ErrorHandler.getExitCode(new ResourceError('Not found', 'resource', 'id'))).toBe(1);
      expect(ErrorHandler.getExitCode(new FileSystemError('IO error', '/path', 'read'))).toBe(6);
      expect(ErrorHandler.getExitCode(new ConfigurationError('Bad config', {}))).toBe(7);
      expect(ErrorHandler.getExitCode(new Error('Unknown'))).toBe(1);
    });

    it('should wrap async functions', async () => {
      const mockFn = jest.fn().mockResolvedValue('success');
      const wrapped = ErrorHandler.wrap(mockFn, { operation: 'test' });
      
      const result = await wrapped('arg1', 'arg2');
      
      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledWith('arg1', 'arg2');
    });

    it('should handle errors in wrapped functions', async () => {
      const error = new ValidationError('Test error');
      const mockFn = jest.fn().mockRejectedValue(error);
      const wrapped = ErrorHandler.wrap(mockFn, { operation: 'test' });
      
      await wrapped();
      
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('VALIDATION_ERROR')
      );
      expect(processExitSpy).toHaveBeenCalledWith(2);
    });

    it('should handle rate limit errors with retry info', () => {
      const error = new RateLimitError('Too many requests', 60);
      ErrorHandler.handle(error, { operation: 'api-call' });
      
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('RATE_LIMIT_ERROR')
      );
    });
  });

  describe('APIError edge cases', () => {
    it('should handle axios error without response', () => {
      const axiosError = new Error('Network error');
      axiosError.request = {};
      
      const apiError = APIError.fromAxiosError(axiosError);
      
      expect(apiError).toBeInstanceOf(NetworkError);
      expect(apiError.message).toBe('No response received from server');
    });

    it('should handle generic errors', () => {
      const genericError = new Error('Something went wrong');
      
      const apiError = APIError.fromAxiosError(genericError);
      
      expect(apiError).toBeInstanceOf(TelletError);
      expect(apiError.message).toBe('Something went wrong');
    });
  });
});