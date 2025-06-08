// Global test setup
const dotenv = require('dotenv');

// Load test environment variables
dotenv.config({ path: '.env.test' });

// Set test environment
process.env.NODE_ENV = 'test';

// Mock console methods to reduce noise during tests
global.console = {
  ...console,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
};

// Global test utilities
global.testUtils = {
  // Generate a valid MongoDB ObjectId
  generateObjectId: () => {
    const timestamp = Math.floor(Date.now() / 1000).toString(16);
    const random = Array.from({ length: 16 }, () => 
      Math.floor(Math.random() * 16).toString(16)
    ).join('');
    return timestamp + random;
  },

  // Create mock API response
  mockApiResponse: (data, status = 200) => ({
    data,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    headers: {},
    config: {},
  }),

  // Create mock error
  mockApiError: (message, status = 500, data = {}) => {
    const error = new Error(message);
    error.response = {
      status,
      data,
      statusText: message,
    };
    return error;
  },

  // Wait for async operations
  wait: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
};

// Set longer timeout for integration tests
jest.setTimeout(30000);

// Cleanup after all tests
afterAll(async () => {
  // Close any open handles
  await new Promise(resolve => setTimeout(resolve, 500));
});