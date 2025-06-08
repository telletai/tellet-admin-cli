# Changelog

All notable changes to this project will be documented in this file.

## [2.7.2] - 2024-01-08

### Added
- Production readiness infrastructure with modular architecture
  - `lib/api.js` - API client with retry logic and rate limiting
  - `lib/auth.js` - Secure authentication with password prompts (no CLI args)
  - `lib/cache.js` - In-memory and persistent caching with TTL support
  - `lib/errors.js` - Comprehensive error hierarchy
  - `lib/logger.js` - Advanced logging with progress tracking
  - `lib/validation.js` - Input validation utilities
  - `lib/cli.js` - CLI setup and configuration
  - `lib/commands/` - Modular command handlers
  - `lib/utils/` - File and streaming utilities
- Streaming support for large file processing
- Comprehensive JSDoc documentation for all modules
- Test suite with 77 passing tests

### Changed
- Refactored monolithic code into modular architecture
- Authentication now uses secure password prompts instead of CLI arguments
- Improved error handling with user-friendly messages

### Fixed
- Border alignment in wizard title display
- Question counting in usage analytics

### Security
- Passwords are no longer passed as command-line arguments
- Secure credential storage with token caching

## [2.7.0] - 2024-01-06

### Added
- Fast organization/workspace/project selection for improved performance
- Usage analytics feature for comprehensive data analysis
- Windows compatibility improvements

### Fixed
- Various bug fixes and performance improvements

## [2.6.3] - 2024-01-01

### Added
- Export directory structure with organization hierarchy
- Improved file organization for exports

## Previous versions
See git history for changes prior to v2.6.3