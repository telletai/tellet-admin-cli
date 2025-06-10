const { AuthManager, requireAuth } = require('../../lib/auth');
const { AuthenticationError } = require('../../lib/errors');
const inquirer = require('inquirer');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const axios = require('axios');

// Mock dependencies
jest.mock('inquirer');
jest.mock('fs', () => ({
  promises: {
    mkdir: jest.fn(),
    readFile: jest.fn(),
    writeFile: jest.fn(),
    access: jest.fn(),
    unlink: jest.fn(),
    chmod: jest.fn()
  }
}));

// Create a mock axios instance
const mockAxiosInstance = {
  post: jest.fn(),
  get: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
  defaults: { headers: { common: {} } },
  interceptors: {
    response: { use: jest.fn() }
  }
};

jest.mock('axios', () => ({
  create: jest.fn(() => mockAxiosInstance),
  post: jest.fn()
}));

describe('AuthManager', () => {
  let authManager;
  const mockToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
  
  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {};
    
    // Clear mock implementations
    mockAxiosInstance.post.mockClear();
    mockAxiosInstance.get.mockClear();
    
    // Create new authManager instance which will use the mocked axios
    authManager = new AuthManager();
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
      mockAxiosInstance.post.mockResolvedValue({
        data: { token: mockToken }
      });
      fs.writeFile.mockResolvedValue();
      fs.mkdir.mockResolvedValue();
      fs.chmod.mockResolvedValue();
      
      const result = await authManager.login('test@example.com', 'password');
      
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/users/login',
        { email: 'test@example.com', password: 'password' }
      );
      expect(result).toBe(mockToken);
    });

    it('should handle login errors', async () => {
      mockAxiosInstance.post.mockRejectedValue({ 
        response: { 
          status: 401,
          data: { message: 'Unauthorized' }
        },
        message: 'Request failed with status code 401'
      });
      
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
      fs.access.mockRejectedValueOnce(new Error('ENOENT'));
      fs.readFile.mockRejectedValueOnce(new Error('ENOENT'));
      
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
      fs.unlink.mockResolvedValue();
      
      await authManager.clearTokenCache();
      
      expect(fs.unlink).toHaveBeenCalledWith(
        expect.stringContaining('auth.json')
      );
    });
  });
});

// Mock the createAPIClient function
jest.mock('../../lib/api', () => ({
  createAPIClient: jest.fn(() => ({
    setAuthToken: jest.fn(),
    config: { baseURL: 'https://api.tellet.ai' }
  }))
}));

const { createAPIClient } = require('../../lib/api');

describe('requireAuth', () => {
  it('should wrap async function with authentication', async () => {
    const mockToken = 'test-token';
    
    // Mock successful login
    mockAxiosInstance.post.mockResolvedValue({ 
      data: { token: mockToken } 
    });
    
    // Don't use cache
    fs.access.mockRejectedValue(new Error('ENOENT'));
    fs.mkdir.mockResolvedValue();
    fs.writeFile.mockResolvedValue();
    fs.chmod.mockResolvedValue();
    
    const mockHandler = jest.fn().mockResolvedValue('result');
    const wrapped = requireAuth(mockHandler);
    
    const result = await wrapped({ 
      email: 'test@example.com', 
      password: 'password123' 
    });
    
    expect(mockHandler).toHaveBeenCalledWith(
      expect.objectContaining({ 
        email: 'test@example.com',
        password: 'password123',
        api: expect.any(Object)
      }),
      expect.any(Object)  // authManager
    );
    expect(result).toBe('result');
  });

  it('should handle authentication errors', async () => {
    // Mock failed login
    mockAxiosInstance.post.mockRejectedValue({ 
      response: { 
        status: 401,
        data: { message: 'Unauthorized' }
      },
      message: 'Request failed with status code 401'
    });
    fs.access.mockRejectedValue(new Error('ENOENT'));
    
    const mockHandler = jest.fn();
    const wrapped = requireAuth(mockHandler);
    
    await expect(wrapped({
      email: 'test@example.com',
      password: 'wrong'
    })).rejects.toThrow('Invalid email or password');
    expect(mockHandler).not.toHaveBeenCalled();
  });
});