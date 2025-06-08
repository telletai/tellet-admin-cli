const { CacheManager, cached } = require('../../lib/cache');
const path = require('path');
const os = require('os');

// Mock fs module
jest.mock('fs', () => ({
  promises: {
    mkdir: jest.fn(),
    readFile: jest.fn(),
    writeFile: jest.fn(),
    unlink: jest.fn(),
    readdir: jest.fn()
  }
}));

const fs = require('fs').promises;

describe('CacheManager', () => {
  let cache;
  
  beforeEach(() => {
    jest.clearAllMocks();
    cache = new CacheManager({
      ttl: 1000,
      maxSize: 3
    });
  });

  describe('memory cache', () => {
    it('should store and retrieve values', async () => {
      await cache.set('key1', 'value1');
      const value = await cache.get('key1');
      
      expect(value).toBe('value1');
    });

    it('should return null for missing keys', async () => {
      const value = await cache.get('nonexistent');
      expect(value).toBeNull();
    });

    it('should respect TTL', async () => {
      await cache.set('key1', 'value1', { ttl: 100 });
      
      // Should exist immediately
      expect(await cache.get('key1')).toBe('value1');
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Should be expired
      expect(await cache.get('key1')).toBeNull();
    });

    it('should enforce size limit with LRU eviction', async () => {
      await cache.set('key1', 'value1');
      await cache.set('key2', 'value2');
      await cache.set('key3', 'value3');
      
      // Access key1 to make it more recent
      await cache.get('key1');
      
      // Add one more, should evict key2
      await cache.set('key4', 'value4');
      
      expect(await cache.get('key1')).toBe('value1');
      expect(await cache.get('key2')).toBeNull(); // Evicted
      expect(await cache.get('key3')).toBe('value3');
      expect(await cache.get('key4')).toBe('value4');
    });

    it('should delete specific keys', async () => {
      await cache.set('key1', 'value1');
      await cache.delete('key1');
      
      expect(await cache.get('key1')).toBeNull();
    });

    it('should clear all cache', async () => {
      await cache.set('key1', 'value1');
      await cache.set('key2', 'value2');
      
      await cache.clear();
      
      expect(await cache.get('key1')).toBeNull();
      expect(await cache.get('key2')).toBeNull();
    });
  });

  describe('persistent cache', () => {
    let persistentCache;
    const cacheDir = path.join(os.tmpdir(), 'test-cache');
    
    beforeEach(() => {
      fs.mkdir.mockResolvedValue();
      fs.readFile.mockResolvedValue(JSON.stringify({
        value: 'persistedValue',
        expires: Date.now() + 10000
      }));
      fs.writeFile.mockResolvedValue();
      fs.unlink.mockResolvedValue();
      fs.readdir.mockResolvedValue(['key1.json', 'key2.json']);
      
      persistentCache = new CacheManager({
        ttl: 1000,
        persistent: true,
        cacheDir
      });
    });

    it('should save to persistent storage', async () => {
      await persistentCache.set('testKey', 'testValue');
      
      expect(fs.writeFile).toHaveBeenCalledWith(
        path.join(cacheDir, 'testKey.json'),
        expect.stringContaining('"value":"testValue"')
      );
    });

    it('should load from persistent storage', async () => {
      const value = await persistentCache.get('testKey');
      
      expect(fs.readFile).toHaveBeenCalledWith(
        path.join(cacheDir, 'testKey.json'),
        'utf8'
      );
      expect(value).toBe('persistedValue');
    });

    it('should delete expired persistent items', async () => {
      fs.readFile.mockResolvedValue(JSON.stringify({
        value: 'expiredValue',
        expires: Date.now() - 1000 // Expired
      }));
      
      const value = await persistentCache.get('testKey');
      
      expect(value).toBeNull();
      expect(fs.unlink).toHaveBeenCalledWith(
        path.join(cacheDir, 'testKey.json')
      );
    });

    it('should clear persistent cache', async () => {
      await persistentCache.clear();
      
      expect(fs.readdir).toHaveBeenCalledWith(cacheDir);
      expect(fs.unlink).toHaveBeenCalledWith(path.join(cacheDir, 'key1.json'));
      expect(fs.unlink).toHaveBeenCalledWith(path.join(cacheDir, 'key2.json'));
    });
  });

  describe('key generation', () => {
    it('should generate consistent keys', () => {
      const key1 = cache.generateKey('namespace', { id: 123, name: 'test' });
      const key2 = cache.generateKey('namespace', { id: 123, name: 'test' });
      
      expect(key1).toBe(key2);
    });

    it('should generate different keys for different inputs', () => {
      const key1 = cache.generateKey('namespace', { id: 123 });
      const key2 = cache.generateKey('namespace', { id: 456 });
      
      expect(key1).not.toBe(key2);
    });
  });

  describe('statistics', () => {
    it('should provide cache statistics', async () => {
      await cache.set('key1', 'value1');
      await cache.set('key2', 'value2', { ttl: 100 });
      
      // Wait for key2 to expire
      await new Promise(resolve => setTimeout(resolve, 150));
      
      const stats = cache.getStats();
      
      expect(stats.size).toBe(2);
      expect(stats.validCount).toBe(1);
      expect(stats.expiredCount).toBe(1);
      expect(stats.maxSize).toBe(3);
    });
  });
});

describe('cached decorator', () => {
  it('should cache function results', async () => {
    let callCount = 0;
    const expensiveFunction = async (x, y) => {
      callCount++;
      return x + y;
    };
    
    const cachedFunction = cached(expensiveFunction, { ttl: 1000 });
    
    // First call
    const result1 = await cachedFunction(2, 3);
    expect(result1).toBe(5);
    expect(callCount).toBe(1);
    
    // Second call with same args - should use cache
    const result2 = await cachedFunction(2, 3);
    expect(result2).toBe(5);
    expect(callCount).toBe(1); // Not incremented
    
    // Different args - should call function
    const result3 = await cachedFunction(3, 4);
    expect(result3).toBe(7);
    expect(callCount).toBe(2);
  });

  it('should respect TTL in decorator', async () => {
    let callCount = 0;
    const testFunction = async () => {
      callCount++;
      return 'result';
    };
    
    const cachedFunction = cached(testFunction, { ttl: 100 });
    
    await cachedFunction();
    expect(callCount).toBe(1);
    
    await cachedFunction();
    expect(callCount).toBe(1); // Cached
    
    // Wait for expiration
    await new Promise(resolve => setTimeout(resolve, 150));
    
    await cachedFunction();
    expect(callCount).toBe(2); // Called again after expiration
  });
});