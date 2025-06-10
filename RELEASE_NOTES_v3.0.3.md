# Release Notes - v3.0.3

**Release Date:** June 10, 2025  
**Type:** Documentation Update

## 📚 Documentation Release

This patch release updates all installation instructions to reflect the GitHub-based distribution model for the Tellet Admin CLI.

## What's Changed

### Documentation Updates
- **Complete Installation Overhaul**: All installation instructions now use GitHub URLs instead of npm registry references
- **Windows Support**: Added dedicated Windows installation commands with PowerShell support
- **Simplified Installation**: The install script method is now the recommended approach for all platforms
- **Migration Guide**: Updated to reflect the GitHub-based installation process
- **Quick Start Guide**: Enhanced with clearer, platform-specific instructions

### Key Improvements
1. **Install Script Method** (Recommended):
   ```bash
   # macOS/Linux
   curl -fsSL https://raw.githubusercontent.com/telletai/tellet-admin-cli/main/install.sh | bash
   
   # Windows
   powershell -Command "Invoke-WebRequest -Uri https://raw.githubusercontent.com/telletai/tellet-admin-cli/main/install.cmd -OutFile install.cmd; .\install.cmd"
   ```

2. **Direct GitHub Installation**:
   ```bash
   npm install -g git+https://github.com/telletai/tellet-admin-cli.git
   ```

3. **Update Command**: Fixed to show the correct GitHub URL

## Installation & Update

### New Installation
```bash
# Using install script (recommended)
curl -fsSL https://raw.githubusercontent.com/telletai/tellet-admin-cli/main/install.sh | bash

# Or direct from GitHub
npm install -g git+https://github.com/telletai/tellet-admin-cli.git#v3.0.3
```

### Updating from Previous Versions
```bash
# Using built-in updater
tellet-admin update

# Or manual update
npm update -g git+https://github.com/telletai/tellet-admin-cli.git
```

## Compatibility
- **Node.js**: 14.0.0 or higher
- **Platforms**: macOS, Linux, Windows
- **API Compatibility**: Tellet Platform API v1

## Notes
- This is a documentation-only release with no functional changes
- All features from v3.0.2 remain unchanged
- The tool continues to be distributed via GitHub, not the npm registry

## Full Changelog
See [CHANGELOG.md](./CHANGELOG.md) for complete version history.

---
*For support or questions, please visit our [GitHub repository](https://github.com/telletai/tellet-admin-cli).*