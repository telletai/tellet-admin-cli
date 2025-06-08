const {
  TelletError,
  APIError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NetworkError,
  FileSystemError,
  ConfigurationError,
  ResourceError,
  OperationError,
  RateLimitError,
  ErrorHandler
} = require('../../lib/errors');

describe('Error Classes', () => {
  describe('TelletError', () => {
    it('should create base error with message and code', () => {
      const error = new TelletError('Test error', 'TEST_ERROR');
      
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(TelletError);
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_ERROR');
      expect(error.name).toBe('TelletError');
    });

    it('should capture stack trace', () => {
      const error = new TelletError('Test error');
      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('TelletError');
    });
  });

  describe('APIError', () => {
    it('should create API error with status and data', () => {
      const error = new APIError('API failed', 400, { field: 'value' });
      
      expect(error).toBeInstanceOf(APIError);
      expect(error.statusCode).toBe(400);
      expect(error.response).toEqual({ field: 'value' });
      expect(error.code).toBe('API_ERROR');
    });

    it('should create from axios error with response', () => {
      const axiosError = {
        response: {
          status: 404,
          data: { message: 'Not found', error: 'RESOURCE_NOT_FOUND' }
        }
      };
      
      const error = APIError.fromAxiosError(axiosError);
      
      expect(error).toBeInstanceOf(APIError);
      expect(error.statusCode).toBe(404);
      expect(error.message).toBe('Not found');
      expect(error.response).toEqual(axiosError.response.data);
    });

    it('should handle network errors', () => {
      const axiosError = {
        request: {},
        message: 'Network Error'
      };
      
      const error = APIError.fromAxiosError(axiosError);
      
      expect(error).toBeInstanceOf(NetworkError);
      expect(error.message).toBe('No response received from server');
    });

    it('should handle generic errors', () => {
      const axiosError = {
        message: 'Something went wrong'
      };
      
      const error = APIError.fromAxiosError(axiosError);
      
      expect(error).toBeInstanceOf(TelletError);
      expect(error.message).toBe('Something went wrong');
    });
  });

  describe('ValidationError', () => {
    it('should create validation error with field info', () => {
      const error = new ValidationError('Invalid email', 'email', 'not-an-email');
      
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.field).toBe('email');
      expect(error.value).toBe('not-an-email');
    });

    it('should store field and value', () => {
      const error = new ValidationError('Invalid input', 'age', -5);
      expect(error.message).toBe('Invalid input');
      expect(error.field).toBe('age');
      expect(error.value).toBe(-5);
    });
  });

  describe('AuthenticationError', () => {
    it('should create auth error', () => {
      const error = new AuthenticationError('Invalid credentials');
      
      expect(error.code).toBe('AUTH_ERROR');
      expect(error.message).toBe('Invalid credentials');
      expect(error.statusCode).toBe(401);
    });
  });

  describe('ResourceError', () => {
    it('should create not found error with resource info', () => {
      const error = ResourceError.notFound('Project', '123abc');
      
      expect(error.code).toBe('RESOURCE_ERROR');
      expect(error.details.resource).toBe('Project');
      expect(error.details.id).toBe('123abc');
      expect(error.message).toBe('Project not found: 123abc');
    });
  });

  describe('NetworkError', () => {
    it('should create network error', () => {
      const error = new NetworkError('Connection timeout');
      
      expect(error.code).toBe('NETWORK_ERROR');
      expect(error.message).toBe('Connection timeout');
    });
  });

  describe('RateLimitError', () => {
    it('should create rate limit error with retry after', () => {
      const error = new RateLimitError(60);
      
      expect(error.code).toBe('RATE_LIMIT_ERROR');
      expect(error.retryAfter).toBe(60);
      expect(error.message).toBe('Rate limit exceeded. Retry after 60 seconds');
    });

    it('should handle no retry after value', () => {
      const error = new RateLimitError();
      expect(error.message).toBe('Rate limit exceeded');
    });
  });

  describe('FileSystemError', () => {
    it('should create file system error with operation', () => {
      const error = new FileSystemError('Failed to write file', '/path/to/file', 'write');
      
      expect(error.code).toBe('FS_ERROR');
      expect(error.operation).toBe('write');
      expect(error.path).toBe('/path/to/file');
    });
  });

  describe('ErrorHandler', () => {
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

    it('should handle TelletError', () => {
      const error = new ValidationError('Invalid input', 'field', 'value');
      
      ErrorHandler.handle(error, { exit: false });
      
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('VALIDATION_ERROR: Invalid input')
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Details:', expect.stringContaining('"field"')
      );
      expect(processExitSpy).not.toHaveBeenCalled();
    });

    it('should handle APIError with status codes', () => {
      const error = new APIError('Unauthorized', 401);
      
      ErrorHandler.handle(error, { exit: false });
      
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('API_ERROR: Unauthorized')
      );
    });

    it('should handle rate limit errors', () => {
      const error = new RateLimitError(120);
      
      ErrorHandler.handle(error, { exit: false });
      
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('RATE_LIMIT_ERROR')
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Please wait 120 seconds')
      );
    });

    it('should handle generic errors', () => {
      const error = new Error('Something went wrong');
      
      ErrorHandler.handle(error, { exit: false });
      
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Something went wrong'
      );
    });

    it('should get correct exit codes', () => {
      expect(ErrorHandler.getExitCode(new ValidationError())).toBe(2);
      expect(ErrorHandler.getExitCode(new AuthenticationError())).toBe(3);
      expect(ErrorHandler.getExitCode(new AuthorizationError())).toBe(4);
      expect(ErrorHandler.getExitCode(new NetworkError())).toBe(5);
      expect(ErrorHandler.getExitCode(new FileSystemError('', '', ''))).toBe(6);
      expect(ErrorHandler.getExitCode(new ConfigurationError('', {}))).toBe(7);
      expect(ErrorHandler.getExitCode(new RateLimitError())).toBe(8);
      expect(ErrorHandler.getExitCode(new Error())).toBe(1);
    });

    it('should wrap functions with error handling', async () => {
      const mockFn = jest.fn().mockRejectedValue(new Error('Test error'));
      const wrapped = ErrorHandler.wrap(mockFn, { operation: 'test', exit: false });
      
      await wrapped();
      
      expect(mockFn).toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error in test:')
      );
    });
  });
});