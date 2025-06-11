const UsageAnalytics = require('../../usage-analytics');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

jest.mock('axios');
jest.mock('fs').promises;
jest.mock('ora', () => {
  return () => ({
    start: jest.fn().mockReturnThis(),
    succeed: jest.fn().mockReturnThis(),
    fail: jest.fn().mockReturnThis(),
    text: ''
  });
});

// Mock csv-writer
jest.mock('csv-writer', () => ({
  createObjectCsvWriter: jest.fn(() => ({
    writeRecords: jest.fn().mockResolvedValue()
  }))
}));

describe('UsageAnalytics', () => {
  let mockApi;
  let analytics;
  
  // Store original Date for restoration
  const RealDate = Date;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockApi = {
      get: jest.fn(),
      post: jest.fn(),
      defaults: { baseURL: 'https://api.tellet.ai' }
    };

    analytics = new UsageAnalytics(mockApi, {
      outputDir: './test-analytics',
      verbose: false
    });
  });

  describe('constructor', () => {
    it('should initialize with default options', () => {
      const ua = new UsageAnalytics(mockApi);
      
      expect(ua.options.outputDir).toBe('./analytics');
      expect(ua.options.verbose).toBe(false);
      expect(ua.options.endDate).toBeDefined();
    });

    it('should accept custom options', () => {
      const options = {
        startDate: '2025-01-01',
        endDate: '2025-12-31',
        outputDir: './custom-dir',
        verbose: true,
        organizationId: 'org123',
        workspaceId: 'ws456'
      };

      const ua = new UsageAnalytics(mockApi, options);
      
      expect(ua.options).toMatchObject(options);
    });
  });

  describe('isWithinDateRange', () => {
    it('should return true when no date filters are set', () => {
      expect(analytics.isWithinDateRange('2025-06-01')).toBe(true);
    });

    it('should correctly filter dates within range', () => {
      // Create a new instance with date range
      const analyticsWithDates = new UsageAnalytics(mockApi, {
        startDate: '2025-01-01',
        endDate: '2025-12-31',
        outputDir: './test-analytics'
      });

      expect(analyticsWithDates.isWithinDateRange('2025-06-01')).toBe(true);
      expect(analyticsWithDates.isWithinDateRange('2024-12-31')).toBe(false);
      expect(analyticsWithDates.isWithinDateRange('2026-01-01')).toBe(false);
    });

    it('should handle invalid date strings', () => {
      const analyticsWithDates = new UsageAnalytics(mockApi, {
        startDate: '2025-01-01',
        endDate: '2025-12-31',
        outputDir: './test-analytics'
      });
      
      // Invalid date strings should create invalid Date objects
      const result = analyticsWithDates.isWithinDateRange('invalid-date');
      expect(result).toBe(false);
    });
  });

  describe('collectOrganizationStats', () => {
    const mockOrgs = [
      { _id: 'org1', name: 'Test Org 1' },
      { _id: 'org2', name: 'Test Org 2' }
    ];

    const mockWorkspaces = {
      priv: [{ _id: 'ws1', name: 'Private Workspace' }],
      shared: [{ _id: 'ws2', name: 'Shared Workspace' }]
    };

    beforeEach(() => {
      mockApi.get.mockImplementation((url) => {
        if (url === '/organizations') {
          return Promise.resolve(mockOrgs);  // API returns data directly
        }
        if (url.includes('/workspaces')) {
          return Promise.resolve(mockWorkspaces);  // API returns data directly
        }
        return Promise.reject(new Error('Unknown endpoint'));
      });

      // Mock collectWorkspaceStats to prevent deep recursion
      analytics.collectWorkspaceStats = jest.fn().mockResolvedValue();
    });

    it('should collect stats for all organizations', async () => {
      await analytics.collectOrganizationStats();

      expect(mockApi.get).toHaveBeenCalledWith('/organizations');
      expect(analytics.stats.summary.totalOrganizations).toBe(2);
      expect(analytics.stats.organizations).toHaveProperty('org1');
      expect(analytics.stats.organizations).toHaveProperty('org2');
    });

    it('should filter by specific organization', async () => {
      analytics.options.organizationId = 'org1';
      
      await analytics.collectOrganizationStats();

      expect(analytics.stats.summary.totalOrganizations).toBe(1);
      expect(analytics.stats.organizations).toHaveProperty('org1');
      expect(analytics.stats.organizations).not.toHaveProperty('org2');
    });

    it('should handle organization not found', async () => {
      analytics.options.organizationId = 'nonexistent';
      
      await expect(analytics.collectOrganizationStats())
        .rejects.toThrow('Organization nonexistent not found');
    });

    it('should handle API errors gracefully', async () => {
      mockApi.get.mockRejectedValue(new Error('API Error'));
      
      await expect(analytics.collectOrganizationStats())
        .rejects.toThrow('API Error');
    });

    it('should correctly parse workspace data', async () => {
      await analytics.collectOrganizationStats();

      expect(analytics.collectWorkspaceStats).toHaveBeenCalledTimes(4); // 2 orgs × 2 workspaces
      expect(analytics.collectWorkspaceStats).toHaveBeenCalledWith('org1', mockWorkspaces.priv[0]);
      expect(analytics.collectWorkspaceStats).toHaveBeenCalledWith('org1', mockWorkspaces.shared[0]);
    });
  });

  describe('collectProjectStats', () => {
    const mockProject = {
      _id: 'proj1',
      title: 'Test Project',
      status: 'PUBLISHED',
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-06-01T00:00:00Z'
    };

    const mockConversations = [
      { _id: 'conv1', status: 'DIGESTED', createdAt: '2025-02-01' },
      { _id: 'conv2', status: 'DIGESTED', createdAt: '2025-03-01' },
      { _id: 'conv3', status: 'ABANDONED', createdAt: '2025-04-01' },
      { _id: 'conv4', status: 'IN_PROGRESS', createdAt: '2025-04-15' }
    ];

    const mockProjectData = {
      _id: 'proj1',
      title: 'Test Project',
      status: 'PUBLISHED',
      interview_questions: [
        { id: 'q1', question: 'Question 1', follow_up_question: 2 },
        { id: 'q2', question: 'Question 2', follow_up_question: 1 }
      ]
    };

    beforeEach(() => {
      // Initialize required parent structures
      analytics.stats.organizations['org1'] = {
        id: 'org1',
        name: 'Test Org',
        workspaces: ['ws1'],
        totalProjects: 0,
        totalConversations: 0,
        completedConversations: 0,
        abandonedConversations: 0,
        inProgressConversations: 0,
        totalQuestions: 0,
        totalQuestionsWithProbing: 0
      };

      analytics.stats.workspaces['ws1'] = {
        id: 'ws1',
        name: 'Test Workspace',
        organizationId: 'org1',
        organizationName: 'Test Org',
        projects: [],
        totalProjects: 0,
        totalConversations: 0,
        completedConversations: 0,
        abandonedConversations: 0,
        inProgressConversations: 0,
        totalQuestions: 0,
        totalQuestionsWithProbing: 0
      };

      mockApi.get.mockImplementation((url) => {
        if (url.includes('/conversations')) {
          return Promise.resolve(mockConversations);  // API returns data directly
        }
        if (url.includes('/projects/proj1')) {
          return Promise.resolve(mockProjectData);  // API returns project data with interview_questions
        }
        return Promise.reject(new Error('Unknown endpoint'));
      });
    });

    it('should collect project statistics correctly', async () => {
      await analytics.collectProjectStats('org1', 'ws1', mockProject);

      const projectStats = analytics.stats.projects['proj1'];
      
      expect(projectStats).toBeDefined();
      expect(projectStats.name).toBe('Test Project');
      expect(projectStats.conversations).toBe(4);
      expect(projectStats.completedConversations).toBe(2);
      expect(projectStats.abandonedConversations).toBe(1);
      expect(projectStats.inProgressConversations).toBe(1);
      expect(projectStats.questions).toBe(2 * 2); // 2 questions × 2 completed conversations
      expect(projectStats.questionsWithProbing).toBe(5 * 2); // (2 questions + 3 follow-ups) × 2 completed conversations
    });

    it('should update parent statistics', async () => {
      await analytics.collectProjectStats('org1', 'ws1', mockProject);

      expect(analytics.stats.workspaces['ws1'].totalProjects).toBe(1);
      expect(analytics.stats.workspaces['ws1'].totalConversations).toBe(4);
      expect(analytics.stats.organizations['org1'].completedConversations).toBe(2);
      expect(analytics.stats.organizations['org1'].abandonedConversations).toBe(1);
      expect(analytics.stats.summary.totalProjects).toBe(1);
    });

    it('should handle missing interview questions', async () => {
      mockApi.get.mockImplementation((url) => {
        if (url.includes('/conversations')) {
          return Promise.resolve(mockConversations);  // API returns data directly
        }
        if (url.includes('/projects/proj1')) {
          return Promise.reject(new Error('Not found'));
        }
        return Promise.reject(new Error('Unknown endpoint'));
      });

      await analytics.collectProjectStats('org1', 'ws1', mockProject);

      const projectStats = analytics.stats.projects['proj1'];
      expect(projectStats.questions).toBe(0);
      expect(projectStats.questionsWithProbing).toBe(0);
    });

    it('should filter conversations by date range', async () => {
      // Create analytics instance with date range
      const analyticsWithDateRange = new UsageAnalytics(mockApi, {
        startDate: '2025-03-01',
        endDate: '2025-03-31',
        outputDir: './test-analytics'
      });
      
      // Initialize required parent structures
      analyticsWithDateRange.stats.organizations['org1'] = {
        id: 'org1',
        name: 'Test Org',
        workspaces: ['ws1'],
        totalProjects: 0,
        totalConversations: 0,
        completedConversations: 0,
        abandonedConversations: 0,
        inProgressConversations: 0,
        totalQuestions: 0,
        totalQuestionsWithProbing: 0
      };

      analyticsWithDateRange.stats.workspaces['ws1'] = {
        id: 'ws1',
        name: 'Test Workspace',
        organizationId: 'org1',
        organizationName: 'Test Org',
        projects: [],
        totalProjects: 0,
        totalConversations: 0,
        completedConversations: 0,
        abandonedConversations: 0,
        inProgressConversations: 0,
        totalQuestions: 0,
        totalQuestionsWithProbing: 0
      };

      await analyticsWithDateRange.collectProjectStats('org1', 'ws1', mockProject);

      const projectStats = analyticsWithDateRange.stats.projects['proj1'];
      expect(projectStats.conversations).toBe(1); // Only conv2 is in range
      expect(projectStats.completedConversations).toBe(1);
    });
  });

  describe('generateReport', () => {
    beforeEach(() => {
      fs.mkdir = jest.fn().mockResolvedValue();
      fs.writeFile = jest.fn().mockResolvedValue();

      // Set up some test data
      analytics.stats = {
        summary: {
          totalOrganizations: 1,
          totalWorkspaces: 1,
          totalProjects: 1,
          totalConversations: 10,
          completedConversations: 8,
          abandonedConversations: 1,
          inProgressConversations: 1,
          totalQuestions: 50,
          totalQuestionsWithProbing: 70
        },
        organizations: {
          'org1': {
            id: 'org1',
            name: 'Test Org',
            workspaces: ['ws1'],
            totalProjects: 1,
            totalConversations: 10,
            completedConversations: 8,
            abandonedConversations: 1,
            inProgressConversations: 1,
            totalQuestions: 50,
            totalQuestionsWithProbing: 70
          }
        },
        workspaces: {
          'ws1': {
            id: 'ws1',
            name: 'Test Workspace',
            organizationId: 'org1',
            organizationName: 'Test Org',
            projects: ['proj1'],
            totalProjects: 1,
            totalConversations: 10,
            completedConversations: 8,
            abandonedConversations: 1,
            inProgressConversations: 1,
            totalQuestions: 50,
            totalQuestionsWithProbing: 70
          }
        },
        projects: {
          'proj1': {
            id: 'proj1',
            name: 'Test Project',
            status: 'PUBLISHED',
            organizationId: 'org1',
            organizationName: 'Test Org',
            workspaceId: 'ws1',
            workspaceName: 'Test Workspace',
            conversations: 10,
            completedConversations: 8,
            abandonedConversations: 1,
            inProgressConversations: 1,
            questions: 50,
            questionsWithProbing: 70,
            createdAt: '2025-01-01',
            updatedAt: '2025-06-01'
          }
        }
      };
    });

    it('should create output directory', async () => {
      await analytics.generateReport();

      expect(fs.mkdir).toHaveBeenCalledWith('./test-analytics', { recursive: true });
    });

    it('should generate all report files', async () => {
      const result = await analytics.generateReport();

      expect(result).toHaveProperty('organizationCsv');
      expect(result).toHaveProperty('workspaceCsv');
      expect(result).toHaveProperty('projectCsv');
      expect(result).toHaveProperty('jsonReport');
      
      expect(fs.writeFile).toHaveBeenCalled();
    });

    it('should include filters in filename', async () => {
      analytics.options.organizationId = 'org1';
      analytics.stats.organizations['org1'].name = 'Test Org';
      
      const result = await analytics.generateReport();

      expect(result.organizationCsv).toContain('test_org');
      expect(result.jsonReport).toContain('test_org');
    });

    it('should handle file write errors', async () => {
      fs.writeFile.mockRejectedValue(new Error('Write failed'));

      await expect(analytics.generateReport()).rejects.toThrow('Write failed');
    });
  });

  describe('displaySummary', () => {
    beforeEach(() => {
      // Set up test data
      analytics.stats = {
        summary: {
          totalOrganizations: 2,
          totalWorkspaces: 5,
          totalProjects: 10,
          totalConversations: 100,
          completedConversations: 85,
          abandonedConversations: 10,
          inProgressConversations: 5,
          totalQuestions: 500,
          totalQuestionsWithProbing: 750
        },
        organizations: {
          'org1': { name: 'Big Org', totalConversations: 80, completedConversations: 70 },
          'org2': { name: 'Small Org', totalConversations: 20, completedConversations: 15 }
        }
      };
    });

    it('should display summary statistics', () => {
      const consoleSpy = jest.spyOn(console, 'log');
      
      analytics.displaySummary();

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Organizations:'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('2'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Completion Rate:'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('85.0%'));
    });

    it('should show top organizations', () => {
      const consoleSpy = jest.spyOn(console, 'log');
      
      analytics.displaySummary();

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Top Organizations by Completed Conversations'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('70 completed'));
    });

    it('should display filters when set', () => {
      const consoleSpy = jest.spyOn(console, 'log');
      analytics.options.organizationId = 'org1';
      analytics.options.startDate = '2025-01-01';
      analytics.options.endDate = '2025-12-31';
      
      // Add some workspace data for testing
      analytics.stats.workspaces = {
        'ws1': { name: 'Main Workspace', completedConversations: 50, totalConversations: 60 },
        'ws2': { name: 'Secondary Workspace', completedConversations: 20, totalConversations: 25 }
      };
      
      analytics.displaySummary();

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Organization: Big Org'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Date Range: 2025-01-01 to 2025-12-31'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Top Workspaces by Completed Conversations'));
    });
  });

  describe('run', () => {
    it('should execute full analytics workflow', async () => {
      analytics.collectOrganizationStats = jest.fn().mockResolvedValue();
      analytics.generateReport = jest.fn().mockResolvedValue({
        organizationCsv: 'org.csv',
        workspaceCsv: 'ws.csv',
        projectCsv: 'proj.csv',
        jsonReport: 'report.json'
      });
      analytics.displaySummary = jest.fn();

      const result = await analytics.run();

      expect(analytics.collectOrganizationStats).toHaveBeenCalled();
      expect(analytics.generateReport).toHaveBeenCalled();
      expect(analytics.displaySummary).toHaveBeenCalled();
      expect(result).toBe(analytics.stats);
    });

    it('should handle errors gracefully', async () => {
      analytics.collectOrganizationStats = jest.fn()
        .mockRejectedValue(new Error('Collection failed'));

      await expect(analytics.run()).rejects.toThrow('Collection failed');
    });
  });
});