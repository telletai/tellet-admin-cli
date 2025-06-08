# Release Process for Tellet Admin CLI

This document describes how to create and publish releases for the Tellet Admin CLI.

## Prerequisites

- GitHub CLI (`gh`) installed and authenticated
  - macOS: `brew install gh`
  - Other: https://cli.github.com/
- Git configured with push access to the repository
- Node.js and npm installed

## Creating a New Release

### 1. Automatic Release (Recommended)

Use the `release.sh` script to automate the entire process:

```bash
# For patch release (2.5.1 -> 2.5.2)
./release.sh patch

# For minor release (2.5.1 -> 2.6.0)
./release.sh minor

# For major release (2.5.1 -> 3.0.0)
./release.sh major

# For specific version
./release.sh 2.5.3
```

This script will:
1. Update version in `package.json`
2. Update version in `tellet-wizard.js` banner
3. Commit changes
4. Create Git tag
5. Push to GitHub
6. Create GitHub release with auto-generated notes

### 2. Manual Release

If you need to create a release manually:

```bash
# 1. Update version
npm version patch --no-git-tag-version

# 2. Update wizard banner
# Edit tellet-wizard.js to update version in banner

# 3. Commit changes
git add .
git commit -m "Release version X.X.X"

# 4. Create tag
git tag -a vX.X.X -m "Release version X.X.X"

# 5. Push changes
git push origin main
git push origin vX.X.X

# 6. Create GitHub release
gh release create vX.X.X --title "Release vX.X.X" --notes "Release notes here"
```

### 3. Creating Release for Existing Version

If you need to create a GitHub release for an already-tagged version:

```bash
./create-github-release.sh
```

This is useful for:
- Creating the initial release
- Fixing missing releases
- Recreating releases if needed

## Release Notes Format

Release notes should include:

1. **What's New** - Major features or changes
2. **Installation** - How to install this version
3. **Bug Fixes** - Fixed issues
4. **Breaking Changes** - Any backwards compatibility issues
5. **Documentation** - Link to README

Example:
```markdown
## What's New in v2.5.2

### Features
- Added support for bulk metadata updates
- Improved error messages for API failures

### Bug Fixes
- Fixed update checker for GitHub releases
- Resolved issue with CSV export formatting

### Installation
\`\`\`bash
npm install -g git+https://github.com/telletai/tellet-admin-cli.git
\`\`\`
```

## Version Numbering

We follow semantic versioning (MAJOR.MINOR.PATCH):

- **MAJOR**: Breaking changes or major features
- **MINOR**: New features, backwards compatible
- **PATCH**: Bug fixes and minor improvements

## Testing Before Release

Before creating a release:

1. Run all commands to ensure they work:
   ```bash
   node tellet-admin-tool.js --help
   node tellet-wizard.js
   ```

2. Test the update mechanism:
   ```bash
   node tellet-admin-tool.js update
   ```

3. Verify installation works:
   ```bash
   npm install -g git+https://github.com/telletai/tellet-admin-cli.git
   ```

## Post-Release

After releasing:

1. Notify team members about the new release
2. Update any documentation that references the version
3. Monitor for any issues reported by users

## Troubleshooting

### GitHub CLI Authentication

If you get authentication errors:
```bash
gh auth login
```

### Missing Tags

If a tag is missing on GitHub:
```bash
git push origin vX.X.X
```

### Failed Release Creation

If release creation fails, you can:
1. Delete and recreate: `gh release delete vX.X.X --yes`
2. Create manually on GitHub: https://github.com/telletai/tellet-admin-cli/releases/new

## Update Distribution

Users can update their installation using:

```bash
# Using the built-in update command
tellet-admin update

# Or manually
npm install -g git+https://github.com/telletai/tellet-admin-cli.git@latest
```

The tool automatically checks for updates daily and notifies users when a new version is available.