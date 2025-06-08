/**
 * @module lib/api
 * @description API client module for Tellet Admin CLI with built-in retry logic,
 * rate limiting, and concurrent request management. Provides a robust wrapper
 * around axios for all API communications.
 * 
 * @example
 * const { createAPIClient } = require('./lib/api');
 * 
 * const api = createAPIClient({
 *   baseURL: 'https://api.tellet.ai',
 *   maxConcurrent: 5,
 *   retries: 3
 * });
 * 
 * api.setAuthToken(token);
 * const data = await api.get('/organizations');
 */

const axios = require('axios');
const axiosRetry = require('axios-retry').default;
const pLimit = require('p-limit');
const { APIError, RateLimitError, NetworkError } = require('./errors');
const { logger } = require('./logger');

// Default configuration
const DEFAULT_CONFIG = {
  baseURL: process.env.TELLET_API_URL || 'https://api.tellet.ai',
  timeout: 30000,
  retries: 3,
  retryDelay: 1000,
  maxConcurrent: 5,
  rateLimit: {
    maxRequests: 100,
    perMilliseconds: 60000 // 100 requests per minute
  }
};

/**
 * API client with built-in retry and rate limiting
 */
class APIClient {
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.requestCount = 0;
    this.requestTimestamps = [];
    this.concurrencyLimit = pLimit(this.config.maxConcurrent);
    
    // Create axios instance
    this.client = axios.create({
      baseURL: this.config.baseURL,
      timeout: this.config.timeout,
      headers: {
        'User-Agent': `TelletAdminCLI/${require('../package.json').version}`,
        'Content-Type': 'application/json'
      }
    });
    
    // Configure retry logic
    axiosRetry(this.client, {
      retries: this.config.retries,
      retryDelay: axiosRetry.exponentialDelay,
      retryCondition: (error) => {
        // Retry on network errors and 5xx errors
        return axiosRetry.isNetworkOrIdempotentRequestError(error) ||
               (error.response && error.response.status >= 500);
      },
      onRetry: (retryCount, error) => {
        logger.debug(`Retrying request (${retryCount}/${this.config.retries}): ${error.message}`);
      }
    });
    
    // Add request interceptor for rate limiting
    this.client.interceptors.request.use(
      async (config) => {
        await this.checkRateLimit();
        return config;
      },
      (error) => Promise.reject(error)
    );
    
    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => {
        this.trackRequest();
        return response;
      },
      async (error) => {
        this.trackRequest();
        
        // Handle rate limit errors
        if (error.response?.status === 429) {
          const retryAfter = error.response.headers['retry-after'];
          throw new RateLimitError(retryAfter);
        }
        
        // Convert to our error types
        if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
          throw new NetworkError(`Cannot connect to ${this.config.baseURL}`);
        }
        
        throw APIError.fromAxiosError(error);
      }
    );
  }

  /**
   * Check rate limit before making request
   * @returns {Promise<void>}
   */
  async checkRateLimit() {
    const now = Date.now();
    const windowStart = now - this.config.rateLimit.perMilliseconds;
    
    // Remove old timestamps
    this.requestTimestamps = this.requestTimestamps.filter(ts => ts > windowStart);
    
    // Check if we've hit the limit
    if (this.requestTimestamps.length >= this.config.rateLimit.maxRequests) {
      const oldestTimestamp = this.requestTimestamps[0];
      const waitTime = oldestTimestamp + this.config.rateLimit.perMilliseconds - now;
      
      logger.debug(`Rate limit reached, waiting ${waitTime}ms`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }

  /**
   * Track request for rate limiting
   */
  trackRequest() {
    this.requestTimestamps.push(Date.now());
    this.requestCount++;
  }

  /**
   * Set authentication token
   * @param {string} token - JWT token
   */
  setAuthToken(token) {
    this.client.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  }

  /**
   * Make a GET request with concurrency limiting
   * @param {string} url - Request URL
   * @param {Object} config - Axios config
   * @returns {Promise<any>} Response data
   */
  async get(url, config = {}) {
    return this.concurrencyLimit(async () => {
      const response = await this.client.get(url, config);
      return response.data;
    });
  }

  /**
   * Make a POST request with concurrency limiting
   * @param {string} url - Request URL
   * @param {any} data - Request data
   * @param {Object} config - Axios config
   * @returns {Promise<any>} Response data
   */
  async post(url, data, config = {}) {
    return this.concurrencyLimit(async () => {
      const response = await this.client.post(url, data, config);
      return response.data;
    });
  }

  /**
   * Make a PUT request with concurrency limiting
   * @param {string} url - Request URL
   * @param {any} data - Request data
   * @param {Object} config - Axios config
   * @returns {Promise<any>} Response data
   */
  async put(url, data, config = {}) {
    return this.concurrencyLimit(async () => {
      const response = await this.client.put(url, data, config);
      return response.data;
    });
  }

  /**
   * Make a DELETE request with concurrency limiting
   * @param {string} url - Request URL
   * @param {Object} config - Axios config
   * @returns {Promise<any>} Response data
   */
  async delete(url, config = {}) {
    return this.concurrencyLimit(async () => {
      const response = await this.client.delete(url, config);
      return response.data;
    });
  }

  /**
   * Download file with progress tracking
   * @param {string} url - File URL
   * @param {Object} options - Download options
   * @returns {Promise<Buffer>} File data
   */
  async download(url, options = {}) {
    const { onProgress } = options;
    
    return this.concurrencyLimit(async () => {
      const response = await this.client.get(url, {
        responseType: 'stream',
        onDownloadProgress: (progressEvent) => {
          if (onProgress) {
            const percentCompleted = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total
            );
            onProgress(percentCompleted, progressEvent);
          }
        }
      });
      
      // Collect stream data
      const chunks = [];
      for await (const chunk of response.data) {
        chunks.push(chunk);
      }
      
      return Buffer.concat(chunks);
    });
  }

  /**
   * Fetch paginated data
   * @param {string} url - Base URL
   * @param {Object} options - Pagination options
   * @returns {AsyncGenerator} Data generator
   */
  async* paginate(url, options = {}) {
    const { pageSize = 100, maxPages = Infinity } = options;
    let page = 0;
    let hasMore = true;
    
    while (hasMore && page < maxPages) {
      const response = await this.get(url, {
        params: {
          limit: pageSize,
          offset: page * pageSize,
          ...options.params
        }
      });
      
      const items = Array.isArray(response) ? response : response.data || [];
      
      if (items.length === 0) {
        hasMore = false;
      } else {
        yield* items;
        page++;
        
        // Check if we got less than a full page
        if (items.length < pageSize) {
          hasMore = false;
        }
      }
    }
  }

  /**
   * Batch API requests
   * @param {Array} requests - Array of request configs
   * @param {Object} options - Batch options
   * @returns {Promise<Array>} Results
   */
  async batch(requests, options = {}) {
    const { chunkSize = 10, onProgress } = options;
    const results = [];
    let completed = 0;
    
    // Process in chunks
    for (let i = 0; i < requests.length; i += chunkSize) {
      const chunk = requests.slice(i, i + chunkSize);
      
      const chunkResults = await Promise.allSettled(
        chunk.map(req => this.request(req))
      );
      
      results.push(...chunkResults);
      completed += chunk.length;
      
      if (onProgress) {
        onProgress(completed, requests.length);
      }
    }
    
    return results;
  }

  /**
   * Make a generic request
   * @param {Object} config - Request config
   * @returns {Promise<any>} Response data
   */
  async request(config) {
    const method = config.method?.toLowerCase() || 'get';
    
    switch (method) {
      case 'get':
        return this.get(config.url, config);
      case 'post':
        return this.post(config.url, config.data, config);
      case 'put':
        return this.put(config.url, config.data, config);
      case 'delete':
        return this.delete(config.url, config);
      default:
        throw new Error(`Unsupported method: ${method}`);
    }
  }

  /**
   * Get request statistics
   * @returns {Object} Statistics
   */
  getStats() {
    return {
      totalRequests: this.requestCount,
      currentWindowRequests: this.requestTimestamps.length,
      rateLimit: this.config.rateLimit,
      concurrencyLimit: this.config.maxConcurrent
    };
  }
}

/**
 * Create API client instance
 * @param {Object} config - Configuration
 * @returns {APIClient} API client
 */
function createAPIClient(config = {}) {
  return new APIClient(config);
}

module.exports = {
  APIClient,
  createAPIClient,
  DEFAULT_CONFIG
};