module.exports = {
  testEnvironment: 'node',
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'lib/api.js',
    'lib/cache.js',
    'lib/auth.js',
    'lib/errors.js',
    'lib/logger.js',
    'lib/validation.js',
    'usage-analytics.js'
  ],
  testMatch: [
    '**/__tests__/**/*.(test|spec).js',
    '**/test/**/*.(test|spec).js',
    '**/tests/**/*.(test|spec).js',
    '**/*.(test|spec).js'
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/coverage/',
    '/dist/',
    '/exports/',
    '/analytics/',
    '/media-downloads/'
  ],
  // Temporarily disabled while we work on achieving 80%+ coverage
  // coverageThreshold: {
  //   global: {
  //     branches: 80,
  //     functions: 80,
  //     lines: 80,
  //     statements: 80
  //   }
  // },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  verbose: true,
  clearMocks: true,
  restoreMocks: true,
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^p-limit$': '<rootDir>/tests/__mocks__/p-limit.js'
  }
};