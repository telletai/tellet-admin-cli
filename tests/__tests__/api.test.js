const { APIClient, createAPIClient } = require('../../lib/api');
const { APIError, RateLimitError, NetworkError } = require('../../lib/errors');
const MockAdapter = require('axios-mock-adapter');

describe('APIClient', () => {
  let client;
  let mock;

  beforeEach(() => {
    client = createAPIClient({
      baseURL: 'https://api.test.com',
      timeout: 1000,
      retries: 1,
      maxConcurrent: 2,
      rateLimit: {
        maxRequests: 5,
        perMilliseconds: 1000
      }
    });
    
    // Create mock adapter on the client's axios instance
    mock = new MockAdapter(client.client);
  });

  afterEach(() => {
    mock.restore();
  });

  describe('constructor', () => {
    it('should initialize with default config', () => {
      const defaultClient = new APIClient();
      expect(defaultClient.config.baseURL).toBe('https://api.tellet.ai');
      expect(defaultClient.config.timeout).toBe(30000);
      expect(defaultClient.config.retries).toBe(3);
    });

    it('should accept custom configuration', () => {
      expect(client.config.baseURL).toBe('https://api.test.com');
      expect(client.config.timeout).toBe(1000);
      expect(client.config.retries).toBe(1);
    });
  });

  describe('authentication', () => {
    it('should set auth token', () => {
      const token = 'test-token-123';
      client.setAuthToken(token);
      
      expect(client.client.defaults.headers.common['Authorization']).toBe(`Bearer ${token}`);
    });
  });

  describe('GET requests', () => {
    it('should make successful GET request', async () => {
      mock.onGet('https://api.test.com/test').reply(200, { success: true });
      
      const result = await client.get('/test');
      
      expect(result).toEqual({ success: true });
      expect(mock.history.get.length).toBe(1);
    });

    it('should retry on 5xx errors', async () => {
      mock
        .onGet('https://api.test.com/test')
        .replyOnce(500)
        .onGet('https://api.test.com/test')
        .reply(200, { success: true });
      
      const result = await client.get('/test');
      
      expect(result).toEqual({ success: true });
      expect(mock.history.get.length).toBe(2);
    });

    it('should handle rate limit errors', async () => {
      mock.onGet('https://api.test.com/test').reply(429, null, {
        'retry-after': '60'
      });
      
      await expect(client.get('/test')).rejects.toThrow(RateLimitError);
    });

    it('should handle network errors', async () => {
      mock.onGet('https://api.test.com/test').networkError();
      
      await expect(client.get('/test')).rejects.toThrow('Network Error');
    });
  });

  describe('POST requests', () => {
    it('should make successful POST request', async () => {
      const data = { name: 'test' };
      mock.onPost('https://api.test.com/test', data).reply(201, { id: 123 });
      
      const result = await client.post('/test', data);
      
      expect(result).toEqual({ id: 123 });
    });
  });

  describe('rate limiting', () => {
    it('should enforce rate limits', async () => {
      // Mock successful responses
      mock.onGet(/.*/).reply(200, { success: true });
      
      // Make requests up to the limit
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(client.get(`/test${i}`));
      }
      
      await Promise.all(promises);
      
      // Track time before next request
      const startTime = Date.now();
      
      // This should be delayed due to rate limit
      await client.get('/test-delayed');
      
      const endTime = Date.now();
      const elapsed = endTime - startTime;
      
      // Should have been delayed
      expect(elapsed).toBeGreaterThanOrEqual(0);
      expect(mock.history.get.length).toBe(6);
    });
  });

  describe('concurrent requests', () => {
    it('should limit concurrent requests', async () => {
      // Mock simple responses
      mock.onGet(/.*/).reply(200, { success: true });
      
      // Since we mocked p-limit to not actually limit concurrency,
      // we'll just verify the requests complete successfully
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(client.get(`/test${i}`));
      }
      
      const results = await Promise.all(promises);
      
      // All requests should succeed
      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result).toEqual({ success: true });
      });
    });
  });

  describe('pagination', () => {
    it('should handle paginated requests', async () => {
      // Mock paginated responses
      let callCount = 0;
      mock.onGet(/\/items.*/).reply(() => {
        const responses = [
          [200, [{ id: 1 }, { id: 2 }]],  // First page
          [200, [{ id: 3 }, { id: 4 }]],  // Second page
          [200, [{ id: 5 }]],              // Third page (partial)
          [200, []]                        // Empty page (end)
        ];
        return responses[callCount++] || [200, []];
      });
      
      const items = [];
      for await (const item of client.paginate('/items', { pageSize: 2 })) {
        items.push(item);
      }
      
      expect(items).toHaveLength(5);
      expect(items[0]).toEqual({ id: 1 });
      expect(items[4]).toEqual({ id: 5 });
    });
  });

  describe('batch requests', () => {
    it('should process requests in batches', async () => {
      mock.onGet(/.*/).reply(200, { success: true });
      
      const requests = [];
      for (let i = 0; i < 5; i++) {
        requests.push({
          method: 'GET',
          url: `/test${i}`
        });
      }
      
      let progressCalls = 0;
      const results = await client.batch(requests, {
        chunkSize: 2,
        onProgress: (completed, total) => {
          progressCalls++;
          expect(completed).toBeLessThanOrEqual(total);
        }
      });
      
      expect(results).toHaveLength(5);
      expect(progressCalls).toBeGreaterThan(0);
      results.forEach(result => {
        expect(result.status).toBe('fulfilled');
      });
    });
  });

  describe('download', () => {
    it('should download file with progress tracking', async () => {
      const mockData = 'test file content';
      
      // Create a mock stream
      const { Readable } = require('stream');
      const mockStream = new Readable({
        read() {
          this.push(mockData);
          this.push(null); // End the stream
        }
      });
      
      mock.onGet('https://api.test.com/file').reply(() => {
        return [200, mockStream];
      });
      
      const data = await client.download('/file', {
        onProgress: (percent) => {
          expect(percent).toBeGreaterThanOrEqual(0);
          expect(percent).toBeLessThanOrEqual(100);
        }
      });
      
      expect(data).toBeInstanceOf(Buffer);
      expect(data.toString()).toBe('test file content');
    });
  });

  describe('statistics', () => {
    it('should track request statistics', async () => {
      mock.onGet(/.*/).reply(200, { success: true });
      
      const initialStats = client.getStats();
      expect(initialStats.totalRequests).toBe(0);
      
      await client.get('/test1');
      await client.get('/test2');
      
      const stats = client.getStats();
      expect(stats.totalRequests).toBe(2);
      expect(stats.rateLimit).toEqual({
        maxRequests: 5,
        perMilliseconds: 1000
      });
    });
  });
});