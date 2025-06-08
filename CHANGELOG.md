# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.0.0] - 2025-01-08

### 🎉 Major Release - Complete Modular Rewrite

This is a major release that completely restructures the CLI tool with a modular architecture, enhanced security, and production-ready improvements.

### Added
- **Modular Architecture**: Complete rewrite with modular command structure
  - Each command now in its own module under `lib/commands/`
  - Centralized authentication with `lib/auth.js`
  - Shared utilities in `lib/utils/`
  - Consistent logging with `lib/logger.js`
- **Enhanced Security**:
  - Centralized token management - no more passwords in CLI arguments
  - Secure credential caching with token refresh
  - Authentication state management across commands
- **Improved Testing**:
  - Comprehensive test suite with 80.91% code coverage
  - 222 tests covering all major functionality
  - Proper mocking for API calls and file operations
- **Better Error Handling**:
  - Consistent error messages across all commands
  - Proper validation for all inputs
  - Graceful fallbacks for API failures
- **Performance Improvements**:
  - Optimized API calls with proper response handling
  - Progress tracking for long-running operations
  - Streaming support for large dataset exports

### Changed
- **Breaking Changes**:
  - Moved from monolithic `tellet-admin-tool.js` to modular architecture
  - All commands now use centralized authentication
  - API response handling standardized to use `response.data`
  - Workspace helper functions now accept API instance instead of credentials
- **Command Improvements**:
  - `export-transcripts`: Now supports streaming for large datasets
  - `usage-analytics`: Enhanced with better filtering and date range support
  - `test-api`: Removed deprecated endpoints, added better error reporting
  - `health-check`: Improved scoring algorithm and report format
- **Code Quality**:
  - All modules now have comprehensive JSDoc comments
  - Consistent code style across the entire codebase
  - Removed all direct axios usage in favor of centralized API client

### Fixed
- Fixed authentication issues with analyzer API endpoints
- Fixed response data extraction throughout the codebase
- Fixed workspace selection causing 401 errors
- Fixed progress tracking in long-running operations
- Fixed memory leaks in streaming operations
- Fixed validation errors not being properly caught
- Fixed test suite failures and improved test coverage

### Removed
- Removed direct axios usage from all command files
- Removed deprecated `/users/me` endpoint tests
- Removed unused validation functions
- Removed duplicate code across commands
- Removed password arguments from internal function calls

### Security
- Passwords are no longer passed as CLI arguments (major security improvement)
- Token-based authentication with automatic refresh
- Secure credential storage in environment variables
- No sensitive data in logs or error messages

### Migration Guide
See [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md) for detailed upgrade instructions from v2.x to v3.0.0.

## [2.7.2] - 2024-01-08

### Added
- Foundation for modular architecture (lib/ directory structure created)
- Comprehensive test suite infrastructure
- JSDoc documentation templates

### Changed
- None (modular architecture not yet integrated)

### Fixed
- Border alignment in wizard title display
- Version number consistency across files

### Known Issues
- New modular architecture exists but is not yet integrated into the main tool
- Password security improvements are planned but not yet active

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