# Moving Tellet Admin CLI to a New Repository

This guide will help you move the tellet-admin-cli to its own repository while maintaining Git history and setting up proper distribution.

## Step 1: Create the New Repository

1. Create a new repository on GitHub/GitLab/Bitbucket:
   - Name: `tellet-admin-cli`
   - Description: "Admin CLI tool for Tellet platform"
   - Make it private if needed

## Step 2: Extract the Admin CLI with Git History

```bash
# Clone the main tellet repository
git clone https://github.com/tellet/tellet.git tellet-temp
cd tellet-temp

# Filter out only the tellet-admin-cli directory
git filter-branch --subdirectory-filter tellet-admin-cli -- --all

# Clean up
git gc --aggressive
git prune

# Add the new remote
git remote add new-origin https://github.com/YOUR-ORG/tellet-admin-cli.git

# Push to the new repository
git push new-origin main
```

## Step 3: Alternative - Fresh Start (Without History)

If you don't need Git history:

```bash
# Copy the tellet-admin-cli directory
cp -r tellet-admin-cli ~/tellet-admin-cli-new
cd ~/tellet-admin-cli-new

# Initialize new Git repo
git init
git add .
git commit -m "Initial commit: Tellet Admin CLI v2.5.1"

# Add remote and push
git remote add origin https://github.com/YOUR-ORG/tellet-admin-cli.git
git push -u origin main
```

## Step 4: Update Package Configuration

Update `package.json` in the new repository:

```json
{
  "name": "@tellet/admin-cli",
  "version": "2.5.1",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/YOUR-ORG/tellet-admin-cli.git"
  },
  "homepage": "https://github.com/YOUR-ORG/tellet-admin-cli#readme",
  "bugs": {
    "url": "https://github.com/YOUR-ORG/tellet-admin-cli/issues"
  }
}
```

## Step 5: Set Up Version Tags

```bash
# Create initial version tag
git tag -a v2.5.1 -m "Release version 2.5.1"
git push origin v2.5.1

# For future releases
git tag -a v2.5.2 -m "Release version 2.5.2"
git push origin v2.5.2
```

## Step 6: Update Installation Instructions

Your colleagues can now install directly from Git:

```bash
# Install latest from main branch
npm install -g git+https://github.com/YOUR-ORG/tellet-admin-cli.git

# Install specific version
npm install -g git+https://github.com/YOUR-ORG/tellet-admin-cli.git#v2.5.1

# Install from specific branch
npm install -g git+https://github.com/YOUR-ORG/tellet-admin-cli.git#feature-branch
```

## Step 7: Set Up Automated Releases (Optional)

Create `.github/workflows/release.yml`:

```yaml
name: Release

on:
  push:
    tags:
      - 'v*'

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Create Release
        uses: actions/create-release@v1
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          tag_name: ${{ github.ref }}
          release_name: Release ${{ github.ref }}
          body: |
            Changes in this Release
            - First Change
            - Second Change
          draft: false
          prerelease: false
```

## Step 8: Internal Distribution Setup

### For Private GitHub/GitLab:

1. **Add collaborators** to the repository
2. **Set up SSH keys** for easier access:
   ```bash
   # Colleagues need to add SSH key to their GitHub account
   ssh-keygen -t ed25519 -C "email@example.com"
   # Add the public key to GitHub Settings > SSH Keys
   ```

3. **Create an install script** for your team:
   ```bash
   #!/bin/bash
   echo "Installing Tellet Admin CLI..."
   npm install -g git+ssh://git@github.com/YOUR-ORG/tellet-admin-cli.git
   ```

### For Corporate Network:

If behind a firewall, you might need to:

1. **Clone to internal Git server**
2. **Use internal npm registry**:
   ```bash
   npm config set registry https://internal-registry.company.com
   npm publish
   ```

## Step 9: Update Mechanism

The update checker in the tool needs to be modified for Git-based distribution:

1. Update `update-checker.js` to check Git tags instead of npm registry
2. Or maintain a `VERSION` file in the repo that the tool can check

## Step 10: Documentation Updates

Update the README.md in the new repository:

1. Remove references to the monorepo
2. Add standalone installation instructions
3. Update contribution guidelines
4. Add changelog/release notes

## Maintenance Tips

1. **Use semantic versioning**: MAJOR.MINOR.PATCH
2. **Tag every release**: `git tag -a v2.5.2 -m "Description"`
3. **Maintain a CHANGELOG.md**
4. **Update version in package.json before tagging**
5. **Consider using npm version command**:
   ```bash
   npm version patch  # 2.5.1 -> 2.5.2
   npm version minor  # 2.5.1 -> 2.6.0
   npm version major  # 2.5.1 -> 3.0.0
   ```

## Quick Start for Colleagues

Once set up, share this with your team:

```bash
# One-time installation
npm install -g git+https://github.com/YOUR-ORG/tellet-admin-cli.git

# Update to latest
npm update -g @tellet/admin-cli

# Or reinstall
npm uninstall -g @tellet/admin-cli
npm install -g git+https://github.com/YOUR-ORG/tellet-admin-cli.git
```