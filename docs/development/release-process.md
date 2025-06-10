# Release Process for Tellet Admin CLI

This document describes how to create and publish releases for the Tellet Admin CLI.

## Release Notes Organization

Starting with v3.0.3, release notes are organized in the `releases/` directory:
```
releases/
├── README.md           # Index of all releases
├── RELEASE_TEMPLATE.md # Template for new releases
├── v3.0.3.md          # Individual release notes
├── v3.0.2.md
├── v3.0.1.md
└── v3.0.0.md
```

Each release should have comprehensive notes following the template.

## Prerequisites

- GitHub CLI (`gh`) installed and authenticated
  - macOS: `brew install gh`
  - Other: https://cli.github.com/
- Git configured with push access to the repository
- Node.js and npm installed

## Creating a New Release

### Complete Release Checklist

1. **Pre-Release Checks**
   - [ ] All tests passing (`npm test`)
   - [ ] Code linted (`npm run lint`)
   - [ ] Documentation updated
   - [ ] CHANGELOG.md prepared

2. **Version Updates**
   - [ ] Update version in `package.json`
   - [ ] Update version references in:
     - `README.md` (badge and installation examples)
     - `INSTALL.md` (version examples)
     - `docs/INDEX.md` (header and footer)
     - `docs/installation/README.md`
     - `docs/guides/migration-v3.md`

3. **Release Notes**
   - [ ] Create release notes: `cp releases/RELEASE_TEMPLATE.md releases/vX.X.X.md`
   - [ ] Fill in all sections of release notes
   - [ ] Update `releases/README.md` with new version link
   - [ ] Update CHANGELOG.md with summary

4. **Git Operations**
   - [ ] Commit all changes
   - [ ] Create annotated tag: `git tag -a vX.X.X -m "Release version X.X.X"`
   - [ ] Push commits and tag

5. **GitHub Release**
   - [ ] Create GitHub release using release notes

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

Use the template in `releases/RELEASE_TEMPLATE.md`. Key sections:

1. **Release Header** - Version, date, type
2. **Release Title** - Brief, descriptive title with emoji
3. **What's Changed** - Organized by category:
   - Features
   - Bug Fixes  
   - Documentation
   - Breaking Changes
4. **Installation & Update** - Clear instructions
5. **Migration Guide** - If applicable
6. **Known Issues** - Transparency about limitations
7. **Contributors** - Credit where due

See existing releases in `releases/` directory for examples.

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