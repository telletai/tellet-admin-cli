/**
 * Authentication module for Tellet Admin CLI
 * Handles secure credential management and authentication
 */

const axios = require('axios');
const inquirer = require('inquirer');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const { AuthenticationError, ConfigurationError, APIError } = require('./errors');
const { validateEmail } = require('./validation');
const { logger } = require('./logger');

// Token cache file location
const TOKEN_CACHE_PATH = path.join(os.homedir(), '.tellet', 'auth.json');

/**
 * Authentication manager class that handles credential management, token caching,
 * and API authentication for the Tellet Admin CLI.
 * 
 * @class AuthManager
 * @example
 * const authManager = new AuthManager({ baseURL: 'https://api.tellet.ai' });
 * const token = await authManager.login('user@example.com', 'password');
 */
class AuthManager {
  /**
   * Creates an instance of AuthManager.
   * 
   * @param {Object} [options={}] - Configuration options
   * @param {string} [options.baseURL] - Base URL for the API (defaults to TELLET_API_URL env var or https://api.tellet.ai)
   */
  constructor(options = {}) {
    this.baseURL = options.baseURL || process.env.TELLET_API_URL || 'https://api.tellet.ai';
    this.tokenCache = null;
    this.api = axios.create({
      baseURL: this.baseURL,
      timeout: 30000,
      headers: {
        'User-Agent': `TelletAdminCLI/${require('../package.json').version}`
      }
    });
  }

  /**
   * Get credentials from environment variables, command options, or interactive prompt.
   * Priority: options > environment variables > interactive prompt
   * 
   * @param {Object} [options={}] - Command options
   * @param {string} [options.email] - Email address (overrides environment variable)
   * @param {string} [options.password] - Password (overrides environment variable)
   * @returns {Promise<{email: string, password: string}>} User credentials
   * @throws {Error} If email validation fails
   * @example
   * const credentials = await authManager.getCredentials({ email: 'user@example.com' });
   * // Will prompt only for password since email was provided
   */
  async getCredentials(options = {}) {
    let email = options.email || process.env.TELLET_EMAIL || process.env.TELLET_ADMIN_EMAIL;
    let password = options.password || process.env.TELLET_PASSWORD || process.env.TELLET_ADMIN_PASSWORD;

    // If email is provided but not password, only prompt for password
    if (email && !password) {
      logger.info(`Authenticating as ${email}`);
      const answers = await inquirer.prompt([{
        type: 'password',
        name: 'password',
        message: 'Enter password:',
        mask: '*',
        validate: (input) => input.length > 0 || 'Password is required'
      }]);
      password = answers.password;
    }
    
    // If neither are provided, prompt for both
    if (!email || !password) {
      logger.info('Please enter your Tellet credentials');
      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'email',
          message: 'Email:',
          when: !email,
          validate: (input) => {
            try {
              validateEmail(input);
              return true;
            } catch (error) {
              return error.message;
            }
          }
        },
        {
          type: 'password',
          name: 'password',
          message: 'Password:',
          mask: '*',
          when: !password,
          validate: (input) => input.length > 0 || 'Password is required'
        }
      ]);
      
      email = email || answers.email;
      password = password || answers.password;
    }

    return { email, password };
  }

  /**
   * Check if saved credentials exist and prompt user whether to use them.
   * 
   * @returns {Promise<boolean>} True if user wants to use saved credentials, false otherwise
   * @example
   * if (await authManager.shouldUseSavedCredentials()) {
   *   // Use cached token
   * }
   */
  async shouldUseSavedCredentials() {
    try {
      const cached = await this.loadTokenCache();
      if (cached && cached.email) {
        const { useSaved } = await inquirer.prompt([{
          type: 'confirm',
          name: 'useSaved',
          message: `Use saved credentials for ${cached.email}?`,
          default: true
        }]);
        return useSaved;
      }
    } catch (error) {
      // No saved credentials
    }
    return false;
  }

  /**
   * Load authentication token from cache file.
   * Checks token expiration and returns null if expired.
   * 
   * @returns {Promise<Object|null>} Cached token data or null if not found/expired
   * @returns {Promise<Object>} returns.token - JWT authentication token
   * @returns {Promise<string>} returns.email - User email associated with token
   * @returns {Promise<string>} returns.expiresAt - Token expiration timestamp
   * @returns {Promise<string>} returns.baseURL - API base URL
   * @returns {Promise<string>} returns.savedAt - Timestamp when token was saved
   * @example
   * const cache = await authManager.loadTokenCache();
   * if (cache) {
   *   console.log(`Using cached token for ${cache.email}`);
   * }
   */
  async loadTokenCache() {
    try {
      const data = await fs.readFile(TOKEN_CACHE_PATH, 'utf8');
      const cache = JSON.parse(data);
      
      // Check if token is expired
      if (cache.expiresAt && new Date(cache.expiresAt) < new Date()) {
        logger.debug('Cached token is expired');
        return null;
      }
      
      this.tokenCache = cache;
      return cache;
    } catch (error) {
      return null;
    }
  }

  /**
   * Save authentication token to cache file with restricted permissions.
   * Extracts expiration time from JWT token payload.
   * 
   * @param {string} token - JWT authentication token
   * @param {string} email - User email address
   * @returns {Promise<void>}
   * @throws {Error} If unable to parse token or save to file
   * @example
   * await authManager.saveTokenCache(jwtToken, 'user@example.com');
   */
  async saveTokenCache(token, email) {
    try {
      // Parse token to get expiration
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
      const expiresAt = payload.exp ? new Date(payload.exp * 1000).toISOString() : null;
      
      const cache = {
        token,
        email,
        expiresAt,
        baseURL: this.baseURL,
        savedAt: new Date().toISOString()
      };
      
      // Ensure directory exists
      const dir = path.dirname(TOKEN_CACHE_PATH);
      await fs.mkdir(dir, { recursive: true });
      
      // Save with restricted permissions
      await fs.writeFile(TOKEN_CACHE_PATH, JSON.stringify(cache, null, 2));
      await fs.chmod(TOKEN_CACHE_PATH, 0o600); // Read/write for owner only
      
      this.tokenCache = cache;
      logger.debug('Token cached successfully');
    } catch (error) {
      logger.warn('Failed to cache token:', error.message);
    }
  }

  /**
   * Clear the authentication token cache by deleting the cache file.
   * 
   * @returns {Promise<void>}
   * @example
   * await authManager.clearTokenCache();
   * // User will need to re-authenticate on next request
   */
  async clearTokenCache() {
    try {
      await fs.unlink(TOKEN_CACHE_PATH);
      this.tokenCache = null;
      logger.debug('Token cache cleared');
    } catch (error) {
      // File might not exist
    }
  }

  /**
   * Authenticate with the Tellet API and cache the resulting token.
   * 
   * @param {string} email - User email address
   * @param {string} password - User password
   * @returns {Promise<string>} JWT authentication token
   * @throws {AuthenticationError} If credentials are invalid
   * @throws {APIError} If API request fails
   * @example
   * try {
   *   const token = await authManager.login('user@example.com', 'password');
   *   console.log('Login successful');
   * } catch (error) {
   *   console.error('Login failed:', error.message);
   * }
   */
  async login(email, password) {
    try {
      logger.debug(`Authenticating with ${this.baseURL}`);
      
      const response = await this.api.post('/users/login', {
        email,
        password
      });

      if (!response.data || !response.data.token) {
        throw new AuthenticationError('Invalid response from login endpoint');
      }

      // Save token to cache
      await this.saveTokenCache(response.data.token, email);
      
      logger.success('Authentication successful');
      return response.data.token;
    } catch (error) {
      if (error.response?.status === 401) {
        throw new AuthenticationError('Invalid email or password');
      }
      throw APIError.fromAxiosError(error);
    }
  }

  /**
   * Get an authenticated axios client instance with automatic token refresh.
   * Uses cached token if available and valid, otherwise prompts for credentials.
   * 
   * @param {Object} [options={}] - Command options
   * @param {boolean} [options.skipCache=false] - Skip token cache and force re-authentication
   * @param {string} [options.email] - Email address (passed to getCredentials)
   * @param {string} [options.password] - Password (passed to getCredentials)
   * @returns {Promise<AxiosInstance>} Configured axios instance with authentication headers
   * @throws {AuthenticationError} If authentication fails
   * @throws {APIError} If API request fails
   * @example
   * const api = await authManager.getAuthenticatedClient();
   * const response = await api.get('/projects');
   */
  async getAuthenticatedClient(options = {}) {
    let token = null;
    
    // Check for cached token
    if (!options.skipCache) {
      const cached = await this.loadTokenCache();
      if (cached && cached.token && cached.baseURL === this.baseURL) {
        token = cached.token;
        logger.debug('Using cached authentication token');
      }
    }
    
    // If no cached token, authenticate
    if (!token) {
      const { email, password } = await this.getCredentials(options);
      token = await this.login(email, password);
    }
    
    // Create authenticated client
    const client = axios.create({
      baseURL: this.baseURL,
      timeout: 30000,
      headers: {
        'Authorization': `Bearer ${token}`,
        'User-Agent': `TelletAdminCLI/${require('../package.json').version}`
      }
    });
    
    // Add response interceptor for token expiration
    client.interceptors.response.use(
      response => response,
      async error => {
        if (error.response?.status === 401 && !error.config._retry) {
          logger.debug('Token expired, re-authenticating');
          error.config._retry = true;
          
          // Clear cache and re-authenticate
          await this.clearTokenCache();
          const { email, password } = await this.getCredentials(options);
          const newToken = await this.login(email, password);
          
          // Retry request with new token
          error.config.headers.Authorization = `Bearer ${newToken}`;
          return client.request(error.config);
        }
        return Promise.reject(error);
      }
    );
    
    return client;
  }

  /**
   * Logout by clearing the cached authentication token.
   * 
   * @returns {Promise<void>}
   * @example
   * await authManager.logout();
   * console.log('Logged out successfully');
   */
  async logout() {
    await this.clearTokenCache();
    logger.success('Logged out successfully');
  }
}

/**
 * Factory function to create an AuthManager instance.
 * 
 * @param {Object} [options={}] - Configuration options
 * @param {string} [options.baseURL] - Base URL for the API
 * @returns {AuthManager} New AuthManager instance
 * @example
 * const authManager = createAuthManager({ baseURL: 'https://api.tellet.ai' });
 */
function createAuthManager(options = {}) {
  return new AuthManager(options);
}

/**
 * Middleware function that ensures authentication before executing a command handler.
 * Automatically injects an authenticated API client into the handler options.
 * 
 * @param {Function} handler - Command handler function to wrap
 * @returns {Function} Wrapped handler that ensures authentication
 * @throws {AuthenticationError} If authentication fails
 * @example
 * // In command definition
 * module.exports = {
 *   handler: requireAuth(async (options, authManager) => {
 *     // options.api is automatically injected with authenticated client
 *     const response = await options.api.get('/projects');
 *     console.log(response.data);
 *   })
 * };
 */
function requireAuth(handler) {
  return async (options) => {
    const authManager = createAuthManager({ baseURL: options.url });
    
    try {
      // Get authenticated API client
      const api = await authManager.getAuthenticatedClient(options);
      
      // Call handler with authenticated API
      return await handler({ ...options, api }, authManager);
    } catch (error) {
      if (error instanceof AuthenticationError) {
        logger.error('Authentication failed. Please check your credentials.');
        if (!options.email && !process.env.TELLET_EMAIL) {
          logger.info('Tip: You can set TELLET_EMAIL and TELLET_PASSWORD environment variables');
        }
      }
      throw error;
    }
  };
}

module.exports = {
  AuthManager,
  createAuthManager,
  requireAuth
};