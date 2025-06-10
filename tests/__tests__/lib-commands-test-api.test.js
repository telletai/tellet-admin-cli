const { testApiHandler } = require('../../lib/commands/test-api');
const { logger } = require('../../lib/logger');

// Mock the logger to prevent console output during tests
jest.mock('../../lib/logger', () => ({
  logger: {
    section: jest.fn(),
    info: jest.fn(),
    success: jest.fn(),
    fail: jest.fn(),
    error: jest.fn(),
    bullet: jest.fn()
  }
}));

describe('test-api command', () => {
  let mockApi;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    mockApi = {
      get: jest.fn(),
      defaults: { baseURL: 'https://api.tellet.ai' }
    };
  });

  it('should test all API endpoints successfully', async () => {
    // Mock successful responses - API returns data directly, not wrapped
    mockApi.get
      .mockResolvedValueOnce([{ _id: 'org1', name: 'Test Organization' }])
      .mockResolvedValueOnce([{ _id: 'org1', name: 'Test Organization' }])
      .mockResolvedValueOnce({
        priv: [{ _id: 'ws1', name: 'Private Workspace' }],
        shared: [{ _id: 'ws2', name: 'Shared Workspace' }]
      });
    
    await testApiHandler({ api: mockApi });
    
    expect(logger.section).toHaveBeenCalledWith('Testing API Connection');
    expect(logger.section).toHaveBeenCalledWith('API Test Summary');
    
    expect(logger.success).toHaveBeenCalledWith('✓ Organizations: Found 1 organization(s)');
    expect(logger.success).toHaveBeenCalledWith('✓ Authentication: Token is valid and working');
    expect(logger.success).toHaveBeenCalledWith('✓ Workspaces: Found 2 workspace(s)');
    
    expect(mockApi.get).toHaveBeenCalledWith('/organizations');
    expect(mockApi.get).toHaveBeenCalledWith('/organizations/org1/workspaces');
  });

  it('should handle organization endpoint failure', async () => {
    mockApi.get.mockRejectedValueOnce(new Error('Network error'));
    
    await testApiHandler({ api: mockApi });
    
    expect(logger.fail).toHaveBeenCalledWith('✗ Organizations: Network error');
  });

  it('should handle empty organizations list', async () => {
    mockApi.get
      .mockResolvedValueOnce([])  // empty organizations
      .mockResolvedValueOnce([]);
    
    await testApiHandler({ api: mockApi });
    
    expect(logger.success).toHaveBeenCalledWith('✓ Organizations: Found 0 organization(s)');
    expect(logger.success).toHaveBeenCalledWith('✓ Authentication: Token is valid and working');
    // No workspace test when no orgs
    expect(mockApi.get).toHaveBeenCalledTimes(2);  // Only org calls
  });

  it('should handle workspace endpoint failure', async () => {
    mockApi.get
      .mockResolvedValueOnce([{ _id: 'org1', name: 'Test Org' }])
      .mockResolvedValueOnce([{ _id: 'org1', name: 'Test Org' }])
      .mockRejectedValueOnce(new Error('Forbidden'));
    
    await testApiHandler({ api: mockApi });
    
    expect(logger.fail).toHaveBeenCalledWith('✗ Workspaces: Forbidden');
  });

  it('should handle API failures gracefully', async () => {
    const error = new Error('Connection refused');
    mockApi.get.mockRejectedValue(error);
    
    // The function doesn't throw - it catches individual errors
    await testApiHandler({ api: mockApi });
    
    expect(logger.fail).toHaveBeenCalledWith('✗ Organizations: Connection refused');
  });

  it('should handle empty organizations', async () => {
    mockApi.get
      .mockResolvedValueOnce([])  // First /organizations call
      .mockResolvedValueOnce({ data: [] });  // Second /organizations call for workspaces check
    
    await testApiHandler({ api: mockApi });
    
    expect(logger.success).toHaveBeenCalledWith('✓ Organizations: Found 0 organization(s)');
    // Should make 2 calls: organizations, then organizations again for workspace test
    expect(mockApi.get).toHaveBeenCalledTimes(2);
  });
});