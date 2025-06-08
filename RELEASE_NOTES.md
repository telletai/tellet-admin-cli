# Release Notes for v2.7.1

## What's New in v2.7.1

### Major Features
- **Production-Ready Architecture**: Complete refactoring of the codebase into a modular architecture
  - Secure authentication with password prompts (no more CLI password arguments)
  - API client with built-in retry logic and rate limiting
  - Streaming support for large file processing
  - In-memory and persistent caching with TTL support
  - Comprehensive error handling with user-friendly messages
  
- **Enhanced Security**
  - Passwords are now prompted securely and never exposed in command history
  - Token caching for improved security and performance
  
- **Developer Experience**
  - Comprehensive JSDoc documentation for all modules
  - Modular command structure for easier maintenance
  - Test suite with extensive coverage

### Bug Fixes
- Fixed wizard title border alignment issue
- Fixed question counting in usage analytics
- Improved error messages for better debugging

### Performance Improvements
- Streaming implementation prevents memory issues with large datasets
- Caching reduces redundant API calls
- Rate limiting prevents API throttling

## Installation

```bash
npm install -g git+https://github.com/telletai/tellet-admin-cli.git@v2.7.1
```

## Upgrade from Previous Version

If you're upgrading from v2.5.x or earlier:

```bash
# Uninstall old version
npm uninstall -g tellet-admin-cli

# Install new version
npm install -g git+https://github.com/telletai/tellet-admin-cli.git@v2.7.1
```

## Breaking Changes
- Password arguments (`-p` or `--password`) are no longer supported for security reasons
- The tool will now prompt for passwords interactively

## Documentation
Full documentation is available in the [README.md](README.md)

## Known Issues
- Some unit tests are failing due to implementation changes. These do not affect functionality.

## Requirements
- Node.js 14.0.0 or higher
- npm 6.0.0 or higher