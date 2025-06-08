# Release Notes - Tellet Admin CLI v3.0.0

**Release Date:** January 8, 2025

## 🎉 Major Release Announcement

We're excited to announce the release of Tellet Admin CLI v3.0.0! This is a complete rewrite of the tool with a focus on modularity, security, performance, and production readiness.

## 🚀 What's New

### Complete Modular Architecture
- Transformed from a monolithic 925-line file to a clean modular structure
- Each command now lives in its own module under `lib/commands/`
- Centralized authentication, logging, and utilities
- Easier to maintain, test, and extend

### Enhanced Security
- **No more passwords in CLI arguments!** All authentication is handled securely
- Centralized token management with automatic refresh
- Secure credential caching
- No sensitive data in logs or error messages

### Production Ready
- Comprehensive test suite with 80.91% code coverage (222 tests)
- All critical security vulnerabilities fixed
- Memory leaks resolved
- Proper error handling throughout

### Performance Improvements
- Optimized API calls with consistent response handling
- Progress tracking for long-running operations
- Streaming support for large dataset exports
- Better memory management

## 📋 Complete Feature List

### Core Commands
- **Auto-categorization** - AI-powered category generation for interview questions
- **Export Conversations** - Export to CSV/JSON with streaming support
- **Export Overview** - Conversation metadata exports
- **Export Transcripts** - Text exports for qualitative analysis
- **Download Media** - Bulk download audio, video, and images
- **Health Check** - Project health analysis and scoring
- **Usage Analytics** - Comprehensive usage reports
- **Bulk Invite** - Invite users from CSV files
- **List Organizations** - Browse org/workspace/project hierarchy
- **Test API** - Verify API connectivity

### Interactive Features
- **Wizard Mode** - User-friendly guided interface
- **Credential Management** - Save credentials to .env
- **Progress Tracking** - Visual progress for long operations
- **Automatic Updates** - Daily update checks

## 🔄 Migration from v2.x

### For End Users
```bash
# Update to v3.0.0
npm update -g @tellet/admin-cli

# Test the upgrade
tellet-admin test-api
tellet-admin --version  # Should show 3.0.0
```

**Important:** Command-line usage remains the same! Your existing scripts will continue to work.

### For Developers
If you're using the CLI as a library, see [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md) for detailed upgrade instructions.

Key changes:
- Use centralized auth system instead of passing credentials
- All API responses now use `response.data`
- Import from specific modules instead of main file

## 🐛 Bug Fixes
- Fixed authentication issues with analyzer API endpoints
- Fixed response data extraction errors
- Fixed workspace selection 401 errors
- Fixed progress tracking completion
- Fixed memory leaks in streaming operations
- Fixed validation error handling
- Fixed all 48 failing tests from v2.x

## 🗑️ Breaking Changes
- Internal API completely restructured (command-line interface unchanged)
- Direct axios usage removed in favor of centralized API client
- Workspace helper functions now require API instance
- Some internal functions renamed or moved

## 📚 Documentation
- Comprehensive README with examples
- Detailed CHANGELOG
- Complete MIGRATION_GUIDE
- JSDoc comments on all functions
- Updated command help text

## 🔒 Security Improvements
- Passwords no longer exposed in process arguments
- Token-based authentication with refresh
- Secure credential storage
- No sensitive data in logs
- Fixed all security vulnerabilities identified in v2.x

## 🎯 Known Issues
- Update metadata command requires API deployment (placeholder ready)
- Some Windows-specific path issues may still exist

## 📦 Installation

### New Installation
```bash
npm install -g @tellet/admin-cli
```

### Upgrade from v2.x
```bash
npm update -g @tellet/admin-cli
```

### Verify Installation
```bash
tellet-admin --version  # Should show 3.0.0
tellet-wizard          # Launch interactive wizard
```

## 🙏 Acknowledgments

Thank you to all users who provided feedback and bug reports. This major release addresses all critical issues identified in the production readiness review.

## 📞 Support

For issues or questions:
- Check the [Migration Guide](./MIGRATION_GUIDE.md)
- Review the [README](./README.md)
- Contact the development team

---

**Note:** This is a major version bump (v2.x to v3.0) due to significant internal changes. While we've maintained command-line compatibility, the internal architecture is completely new. Please test thoroughly in your environment before deploying to production.