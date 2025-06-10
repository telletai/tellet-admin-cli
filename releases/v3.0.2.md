# Release Notes - Tellet Admin CLI v3.0.2

## Release Date: June 10, 2025

### 🔧 Maintenance Release

This release follows v3.0.1 which fixed critical authentication issues. Version 3.0.2 includes updated documentation and version consistency across the codebase.

### 🐛 Major Fixes

#### Authentication Crisis Resolved
The `requireAuth` function was returning a raw axios client instead of the expected APIClient instance, causing all authenticated commands to fail with 401 errors. This has been fixed by properly creating and configuring the APIClient with authentication tokens.

#### Module Compatibility
Replaced the ES module `p-limit` with a custom CommonJS `ConcurrencyLimiter` implementation to resolve module loading errors.

#### Command-Specific Fixes
- **export-overview**: Fixed missing `generateFilename` function and CSV writer configuration
- **export-conversations**: Fixed enum validation schema
- **download-media**: Fixed project endpoint URL construction
- **health-check**: Updated response handling for APIClient
- **categorize**: Fixed response compatibility in auto-categorize-logic.js
- **usage-analytics**: Improved response handling

#### Wizard Display
- Fixed missing ASCII art banner (now displays in cyan)
- Version number now dynamically loaded from package.json

### 📊 Test Coverage
- All 222 tests now passing
- 100% compatibility with the refactored architecture
- Updated test mocks to match APIClient behavior

### 🔧 For Developers
The root cause was incomplete integration of the v3.0.0 authentication refactor. The APIClient instance creation was missing in the critical `requireAuth` wrapper function, affecting every authenticated command.

### 📦 Installation
```bash
npm install -g @tellet/admin-cli@3.0.2
```

### 🙏 Acknowledgments
Thank you to users who reported the authentication issues. We apologize for any inconvenience caused by v3.0.0.

### 📝 Next Steps
If you're upgrading from v2.x, please see the [Migration Guide](./MIGRATION_GUIDE.md).
If you encounter any issues, please contact the Tellet support team.