const { APIClient } = require('../../lib/api');
const axios = require('axios');
const MockAdapter = require('axios-mock-adapter');

describe('APIClient Additional Tests', () => {
  let client;
  let mock;

  beforeEach(() => {
    client = new APIClient({
      baseURL: 'https://api.test.com',
      maxConcurrent: 2
    });
    mock = new MockAdapter(client.client);
  });

  afterEach(() => {
    mock.restore();
  });

  describe('HTTP methods', () => {
    it('should make PUT requests', async () => {
      const data = { name: 'Updated' };
      mock.onPut('/resource/123').reply(200, { success: true });
      
      const result = await client.put('/resource/123', data);
      
      expect(result).toEqual({ success: true });
      expect(mock.history.put.length).toBe(1);
      expect(mock.history.put[0].data).toBe(JSON.stringify(data));
    });

    it('should make DELETE requests', async () => {
      mock.onDelete('/resource/123').reply(204);
      
      const result = await client.delete('/resource/123');
      
      expect(result).toBeUndefined();
      expect(mock.history.delete.length).toBe(1);
    });
  });

  describe('Request interceptors', () => {
    it('should track requests', async () => {
      mock.onGet('/test').reply(200, { data: 'test' });
      
      const initialCount = client.requestCount;
      await client.get('/test');
      
      expect(client.requestCount).toBe(initialCount + 1);
    });

    it('should set default headers', async () => {
      mock.onGet('/test').reply((config) => {
        expect(config.headers['Content-Type']).toBe('application/json');
        return [200, {}];
      });
      
      await client.get('/test');
    });
  });

  describe('Error handling edge cases', () => {
    it('should handle timeout errors', async () => {
      mock.onGet('/timeout').timeout();
      
      await expect(client.get('/timeout')).rejects.toThrow('timeout');
    });

    it('should handle network errors in interceptor', async () => {
      mock.onGet('/network-error').networkError();
      
      await expect(client.get('/network-error')).rejects.toThrow('Network Error');
    });
  });

  describe('batch', () => {
    it('should handle empty request array', async () => {
      const results = await client.batch([]);
      expect(results).toEqual([]);
    });

    it('should process single batch', async () => {
      const requests = [
        { method: 'get', url: '/test1' },
        { method: 'get', url: '/test2' }
      ];
      
      mock.onGet('/test1').reply(200, { id: 1 });
      mock.onGet('/test2').reply(200, { id: 2 });
      
      const results = await client.batch(requests);
      
      expect(results).toHaveLength(2);
      expect(results[0].status).toBe('fulfilled');
      expect(results[0].value).toEqual({ id: 1 });
      expect(results[1].status).toBe('fulfilled');
      expect(results[1].value).toEqual({ id: 2 });
    });
  });

  describe('concurrent request limiting', () => {
    it('should process multiple requests', async () => {
      mock.onGet(/\/concurrent\/\d+/).reply(200, { success: true });
      
      // Start 4 requests
      const promises = [1, 2, 3, 4].map(i => 
        client.get(`/concurrent/${i}`)
      );
      
      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(4);
      results.forEach(result => {
        expect(result).toEqual({ success: true });
      });
    });
  });

  describe('download method edge cases', () => {
    it('should have download method available', () => {
      expect(typeof client.download).toBe('function');
    });
  });

  describe('statistics', () => {
    it('should track request count', async () => {
      mock.onGet('/stats1').reply(200);
      mock.onGet('/stats2').reply(200);
      
      await client.get('/stats1');
      await client.get('/stats2');
      
      const stats = client.getStats();
      
      expect(stats.totalRequests).toBe(2);
      expect(stats.currentWindowRequests).toBeGreaterThanOrEqual(0);
    });

    it('should track all requests including failed ones', async () => {
      const freshClient = new APIClient({
        baseURL: 'https://api.test.com',
        maxConcurrent: 2
      });
      const freshMock = new MockAdapter(freshClient.client);
      
      freshMock.onGet('/fail').reply(500);
      
      try {
        await freshClient.get('/fail');
      } catch (e) {
        // expected
      }
      
      const stats = freshClient.getStats();
      expect(stats.totalRequests).toBeGreaterThan(0);
      expect(stats.rateLimit).toBeDefined();
      expect(stats.concurrencyLimit).toBe(2);
      
      freshMock.restore();
    });
  });
});