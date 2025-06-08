const { AuthManager, requireAuth } = require('../../lib/auth');
const { AuthenticationError } = require('../../lib/errors');
const inquirer = require('inquirer');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

// Mock dependencies
jest.mock('inquirer');
jest.mock('fs', () => ({
  promises: {
    mkdir: jest.fn(),
    readFile: jest.fn(),
    writeFile: jest.fn(),
    access: jest.fn()
  }
}));

describe('AuthManager', () => {
  let authManager;
  const mockToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
  
  beforeEach(() => {
    jest.clearAllMocks();
    authManager = new AuthManager();
    process.env = {};
  });

  describe('constructor', () => {
    it('should initialize with default baseURL', () => {
      expect(authManager.baseURL).toBe('https://api.tellet.ai');
    });
  });

  describe('getCredentials', () => {
    it('should use provided credentials', async () => {
      const creds = await authManager.getCredentials({
        email: 'test@example.com',
        password: 'password123'
      });
      
      expect(creds).toEqual({
        email: 'test@example.com',
        password: 'password123'
      });
      expect(inquirer.prompt).not.toHaveBeenCalled();
    });

    it('should use environment variables', async () => {
      process.env.TELLET_EMAIL = 'env@example.com';
      process.env.TELLET_PASSWORD = 'envpass';
      
      const creds = await authManager.getCredentials();
      
      expect(creds).toEqual({
        email: 'env@example.com',
        password: 'envpass'
      });
    });

    it('should prompt for missing password', async () => {
      inquirer.prompt.mockResolvedValue({ password: 'prompted' });
      
      const creds = await authManager.getCredentials({
        email: 'test@example.com'
      });
      
      expect(inquirer.prompt).toHaveBeenCalledWith([{
        type: 'password',
        name: 'password',
        message: 'Enter password:',
        mask: '*',
        validate: expect.any(Function)
      }]);
      expect(creds.password).toBe('prompted');
    });

    it('should prompt for all credentials when none provided', async () => {
      inquirer.prompt.mockResolvedValue({
        email: 'prompted@example.com',
        password: 'prompted'
      });
      
      const creds = await authManager.getCredentials();
      
      expect(inquirer.prompt).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ name: 'email' }),
          expect.objectContaining({ name: 'password' })
        ])
      );
    });
  });

  describe('login', () => {
    it('should login successfully', async () => {
      authManager.api = { 
        post: jest.fn().mockResolvedValue({
          data: { token: mockToken }
        })
      };
      fs.writeFile.mockResolvedValue();
      
      const result = await authManager.login('test@example.com', 'password');
      
      expect(authManager.api.post).toHaveBeenCalledWith(
        '/users/login',
        { email: 'test@example.com', password: 'password' }
      );
      expect(result).toBe(mockToken);
    });

    it('should handle login errors', async () => {
      authManager.api = { 
        post: jest.fn().mockRejectedValue({ 
          response: { status: 401 } 
        })
      };
      
      await expect(authManager.login('test@example.com', 'wrong'))
        .rejects.toThrow('Invalid email or password');
    });
  });

  describe('loadTokenCache', () => {
    it('should load token from cache file', async () => {
      const cacheData = {
        token: mockToken,
        email: 'cached@example.com'
      };
      
      fs.access.mockResolvedValue();
      fs.readFile.mockResolvedValue(JSON.stringify(cacheData));
      
      const result = await authManager.loadTokenCache();
      
      expect(result).toEqual(cacheData);
    });

    it('should return null if cache file does not exist', async () => {
      fs.access.mockRejectedValue(new Error('ENOENT'));
      
      const result = await authManager.loadTokenCache();
      
      expect(result).toBeNull();
    });
  });

  describe('saveTokenCache', () => {
    it('should save token to cache file', async () => {
      fs.mkdir.mockResolvedValue();
      fs.writeFile.mockResolvedValue();
      
      await authManager.saveTokenCache(mockToken, 'test@example.com');
      
      expect(fs.mkdir).toHaveBeenCalled();
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('auth.json'),
        expect.stringContaining(mockToken)
      );
    });
  });

  describe('clearTokenCache', () => {
    it('should clear the token cache', async () => {
      fs.writeFile.mockResolvedValue();
      
      await authManager.clearTokenCache();
      
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('auth.json'),
        JSON.stringify({})
      );
    });
  });
});

describe('requireAuth', () => {
  it('should wrap async function with authentication', async () => {
    const mockApi = { 
      post: jest.fn().mockResolvedValue({ data: { token: mockToken } }),
      defaults: { headers: { common: {} } }
    };
    
    // Mock the createAuthManager function
    jest.doMock('../../lib/auth', () => ({
      ...jest.requireActual('../../lib/auth'),
      createAuthManager: () => ({
        getAuthenticatedClient: jest.fn().mockResolvedValue(mockApi)
      })
    }));
    
    const { requireAuth } = require('../../lib/auth');
    const mockHandler = jest.fn().mockResolvedValue('result');
    const wrapped = requireAuth(mockHandler);
    
    const result = await wrapped({ email: 'test@example.com' });
    
    expect(mockHandler).toHaveBeenCalledWith(
      expect.objectContaining({ 
        email: 'test@example.com',
        api: mockApi
      }),
      expect.any(Object)
    );
    expect(result).toBe('result');
  });

  it('should handle authentication errors', async () => {
    jest.doMock('../../lib/auth', () => ({
      ...jest.requireActual('../../lib/auth'),
      createAuthManager: () => ({
        getAuthenticatedClient: jest.fn().mockRejectedValue(
          new AuthenticationError('Invalid credentials')
        )
      })
    }));
    
    const { requireAuth } = require('../../lib/auth');
    const mockHandler = jest.fn();
    const wrapped = requireAuth(mockHandler);
    
    await expect(wrapped({})).rejects.toThrow('Invalid credentials');
    expect(mockHandler).not.toHaveBeenCalled();
  });
});