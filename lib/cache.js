/**
 * Caching module for Tellet Admin CLI
 * Provides in-memory and file-based caching
 */

const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { logger } = require('./logger');

/**
 * Cache manager with TTL support, LRU eviction, and optional persistent storage.
 * Provides both in-memory and file-based caching capabilities.
 * 
 * @class CacheManager
 * @example
 * const cache = new CacheManager({ ttl: 300000, maxSize: 50, persistent: true });
 * await cache.set('key', { data: 'value' });
 * const value = await cache.get('key');
 */
class CacheManager {
  /**
   * Creates an instance of CacheManager.
   * 
   * @param {Object} [options={}] - Configuration options
   * @param {number} [options.ttl=600000] - Time to live in milliseconds (default: 10 minutes)
   * @param {number} [options.maxSize=100] - Maximum number of items in memory cache
   * @param {boolean} [options.persistent=false] - Enable persistent file-based caching
   * @param {string} [options.cacheDir] - Directory for persistent cache files (default: ~/.tellet/cache)
   */
  constructor(options = {}) {
    this.options = {
      ttl: options.ttl || 600000, // 10 minutes default
      maxSize: options.maxSize || 100, // Max items in memory
      persistent: options.persistent || false,
      cacheDir: options.cacheDir || path.join(os.homedir(), '.tellet', 'cache'),
      ...options
    };
    
    this.memoryCache = new Map();
    this.accessOrder = [];
    
    if (this.options.persistent) {
      this.initPersistentCache();
    }
  }

  /**
   * Initialize persistent cache directory, creating it if it doesn't exist.
   * 
   * @returns {Promise<void>}
   * @private
   */
  async initPersistentCache() {
    try {
      await fs.mkdir(this.options.cacheDir, { recursive: true });
    } catch (error) {
      logger.debug('Failed to create cache directory:', error.message);
    }
  }

  /**
   * Generate a unique cache key from namespace and parameters using MD5 hash.
   * 
   * @param {string} namespace - Cache namespace to prevent key collisions
   * @param {*} params - Parameters to include in key (will be JSON stringified)
   * @returns {string} MD5 hash cache key
   * @example
   * const key = cache.generateKey('projects', { workspaceId: '123', status: 'active' });
   * // Returns: 'a1b2c3d4e5f6...'
   */
  generateKey(namespace, params) {
    const data = JSON.stringify({ namespace, params });
    return crypto.createHash('md5').update(data).digest('hex');
  }

  /**
   * Get item from cache, checking memory first then persistent storage.
   * Automatically handles expiration and LRU access order updates.
   * 
   * @param {string} key - Cache key
   * @returns {Promise<*|null>} Cached value or null if not found/expired
   * @example
   * const value = await cache.get('project-123');
   * if (value) {
   *   console.log('Cache hit:', value);
   * }
   */
  async get(key) {
    // Check memory cache first
    const memoryItem = this.memoryCache.get(key);
    if (memoryItem) {
      if (this.isExpired(memoryItem)) {
        this.memoryCache.delete(key);
        this.removeFromAccessOrder(key);
      } else {
        this.updateAccessOrder(key);
        return memoryItem.value;
      }
    }
    
    // Check persistent cache if enabled
    if (this.options.persistent) {
      const persistentValue = await this.getPersistent(key);
      if (persistentValue !== null) {
        // Add to memory cache
        this.set(key, persistentValue, { skipPersistent: true });
        return persistentValue;
      }
    }
    
    return null;
  }

  /**
   * Set item in cache with automatic TTL and optional persistence.
   * Enforces LRU eviction when memory cache exceeds maxSize.
   * 
   * @param {string} key - Cache key
   * @param {*} value - Value to cache (must be JSON serializable for persistent cache)
   * @param {Object} [options={}] - Cache options
   * @param {number} [options.ttl] - Override default TTL for this item
   * @param {boolean} [options.skipPersistent] - Skip persistent storage for this item
   * @returns {Promise<void>}
   * @example
   * await cache.set('user-123', { name: 'John', role: 'admin' }, { ttl: 300000 });
   */
  async set(key, value, options = {}) {
    const ttl = options.ttl || this.options.ttl;
    const expires = Date.now() + ttl;
    
    // Add to memory cache
    this.memoryCache.set(key, { value, expires });
    this.updateAccessOrder(key);
    
    // Enforce size limit
    if (this.memoryCache.size > this.options.maxSize) {
      this.evictOldest();
    }
    
    // Save to persistent cache if enabled
    if (this.options.persistent && !options.skipPersistent) {
      await this.setPersistent(key, value, expires);
    }
  }

  /**
   * Delete item from both memory and persistent cache.
   * 
   * @param {string} key - Cache key to delete
   * @returns {Promise<void>}
   * @example
   * await cache.delete('outdated-key');
   */
  async delete(key) {
    this.memoryCache.delete(key);
    this.removeFromAccessOrder(key);
    
    if (this.options.persistent) {
      await this.deletePersistent(key);
    }
  }

  /**
   * Clear all items from both memory and persistent cache.
   * 
   * @returns {Promise<void>}
   * @example
   * await cache.clear();
   * console.log('Cache cleared');
   */
  async clear() {
    this.memoryCache.clear();
    this.accessOrder = [];
    
    if (this.options.persistent) {
      await this.clearPersistent();
    }
  }

  /**
   * Check if a cache item has expired based on its timestamp.
   * 
   * @param {Object} item - Cache item with expires property
   * @param {number} item.expires - Expiration timestamp in milliseconds
   * @returns {boolean} True if expired, false otherwise
   * @private
   */
  isExpired(item) {
    return Date.now() > item.expires;
  }

  /**
   * Update access order for LRU (Least Recently Used) eviction policy.
   * Moves the key to the end of the access order list.
   * 
   * @param {string} key - Cache key that was accessed
   * @private
   */
  updateAccessOrder(key) {
    this.removeFromAccessOrder(key);
    this.accessOrder.push(key);
  }

  /**
   * Remove key from the LRU access order list.
   * 
   * @param {string} key - Cache key to remove
   * @private
   */
  removeFromAccessOrder(key) {
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
  }

  /**
   * Evict the least recently used item from memory cache.
   * Called when cache size exceeds maxSize.
   * 
   * @private
   */
  evictOldest() {
    if (this.accessOrder.length > 0) {
      const oldestKey = this.accessOrder.shift();
      this.memoryCache.delete(oldestKey);
    }
  }

  /**
   * Get item from persistent file-based cache.
   * Automatically deletes expired items.
   * 
   * @param {string} key - Cache key
   * @returns {Promise<*|null>} Cached value or null if not found/expired
   * @private
   */
  async getPersistent(key) {
    try {
      const filePath = path.join(this.options.cacheDir, `${key}.json`);
      const data = await fs.readFile(filePath, 'utf8');
      const item = JSON.parse(data);
      
      if (this.isExpired(item)) {
        await this.deletePersistent(key);
        return null;
      }
      
      return item.value;
    } catch (error) {
      return null;
    }
  }

  /**
   * Save item to persistent file-based cache.
   * 
   * @param {string} key - Cache key
   * @param {*} value - Value to cache (must be JSON serializable)
   * @param {number} expires - Expiration timestamp in milliseconds
   * @returns {Promise<void>}
   * @private
   */
  async setPersistent(key, value, expires) {
    try {
      const filePath = path.join(this.options.cacheDir, `${key}.json`);
      const data = JSON.stringify({ value, expires });
      await fs.writeFile(filePath, data);
    } catch (error) {
      logger.debug('Failed to write persistent cache:', error.message);
    }
  }

  /**
   * Delete item from persistent file-based cache.
   * 
   * @param {string} key - Cache key to delete
   * @returns {Promise<void>}
   * @private
   */
  async deletePersistent(key) {
    try {
      const filePath = path.join(this.options.cacheDir, `${key}.json`);
      await fs.unlink(filePath);
    } catch (error) {
      // File might not exist
    }
  }

  /**
   * Clear all items from persistent file-based cache.
   * Deletes all JSON files in the cache directory.
   * 
   * @returns {Promise<void>}
   * @private
   */
  async clearPersistent() {
    try {
      const files = await fs.readdir(this.options.cacheDir);
      await Promise.all(
        files
          .filter(file => file.endsWith('.json'))
          .map(file => fs.unlink(path.join(this.options.cacheDir, file)))
      );
    } catch (error) {
      logger.debug('Failed to clear persistent cache:', error.message);
    }
  }

  /**
   * Get cache statistics including size, valid/expired counts, and configuration.
   * 
   * @returns {Object} Cache statistics
   * @returns {number} returns.size - Total number of items in memory cache
   * @returns {number} returns.validCount - Number of non-expired items
   * @returns {number} returns.expiredCount - Number of expired items
   * @returns {number} returns.maxSize - Maximum cache size configuration
   * @returns {number} returns.ttl - Default TTL configuration
   * @returns {boolean} returns.persistent - Whether persistent caching is enabled
   * @example
   * const stats = cache.getStats();
   * console.log(`Cache: ${stats.validCount}/${stats.size} valid items`);
   */
  getStats() {
    let validCount = 0;
    let expiredCount = 0;
    
    for (const [key, item] of this.memoryCache.entries()) {
      if (this.isExpired(item)) {
        expiredCount++;
      } else {
        validCount++;
      }
    }
    
    return {
      size: this.memoryCache.size,
      validCount,
      expiredCount,
      maxSize: this.options.maxSize,
      ttl: this.options.ttl,
      persistent: this.options.persistent
    };
  }
}

/**
 * Create a memoization decorator for async functions with automatic caching.
 * The decorated function will cache results based on its arguments.
 * 
 * @param {Function} fn - Async function to wrap with caching
 * @param {Object} [options={}] - Cache options (same as CacheManager constructor)
 * @param {number} [options.ttl] - Time to live for cached results
 * @param {number} [options.maxSize] - Maximum cache size
 * @param {boolean} [options.persistent] - Enable persistent caching
 * @returns {Function} Wrapped function with caching
 * @example
 * const fetchUser = cached(async (userId) => {
 *   const response = await api.get(`/users/${userId}`);
 *   return response.data;
 * }, { ttl: 300000 });
 * 
 * // First call hits API
 * const user1 = await fetchUser(123);
 * // Second call returns from cache
 * const user2 = await fetchUser(123);
 */
function cached(fn, options = {}) {
  const cache = new CacheManager(options);
  
  return async function(...args) {
    const key = cache.generateKey(fn.name, args);
    
    // Check cache
    const cachedValue = await cache.get(key);
    if (cachedValue !== null) {
      logger.debug(`Cache hit for ${fn.name}`);
      return cachedValue;
    }
    
    // Call function
    logger.debug(`Cache miss for ${fn.name}`);
    const result = await fn.apply(this, args);
    
    // Store in cache
    await cache.set(key, result);
    
    return result;
  };
}

/**
 * Pre-configured global cache instances for common use cases.
 * 
 * @type {Object.<string, CacheManager>}
 * @property {CacheManager} organizations - Organization/workspace cache (10 min TTL, persistent)
 * @property {CacheManager} projects - Project cache (5 min TTL, persistent)
 * @property {CacheManager} api - API response cache (2 min TTL, memory only)
 * @example
 * // Use global project cache
 * await caches.projects.set('project-123', projectData);
 * const project = await caches.projects.get('project-123');
 */
const caches = {
  // Organization/workspace cache - 10 minutes
  organizations: new CacheManager({
    ttl: 600000,
    maxSize: 50,
    persistent: true
  }),
  
  // Project cache - 5 minutes
  projects: new CacheManager({
    ttl: 300000,
    maxSize: 100,
    persistent: true
  }),
  
  // API response cache - 2 minutes
  api: new CacheManager({
    ttl: 120000,
    maxSize: 200,
    persistent: false
  })
};

module.exports = {
  CacheManager,
  cached,
  caches
};