module.exports = {
  testEnvironment: 'node',
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    '**/*.js',
    '!**/node_modules/**',
    '!**/coverage/**',
    '!**/*.config.js',
    '!**/test/**',
    '!**/tests/**',
    '!**/__tests__/**'
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
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  verbose: true,
  clearMocks: true,
  restoreMocks: true,
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1'
  }
};