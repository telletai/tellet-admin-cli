#!/bin/bash
#
# Release script for Tellet Admin CLI
#

# Check if version argument provided
if [ -z "$1" ]; then
    echo "Usage: ./release.sh <patch|minor|major|x.x.x>"
    echo "Examples:"
    echo "  ./release.sh patch     # 2.5.1 -> 2.5.2"
    echo "  ./release.sh minor     # 2.5.1 -> 2.6.0"
    echo "  ./release.sh major     # 2.5.1 -> 3.0.0"
    echo "  ./release.sh 2.5.3     # Set specific version"
    exit 1
fi

# Update version
echo "📦 Updating version..."
npm version $1 --no-git-tag-version

# Get new version
NEW_VERSION=$(node -p "require('./package.json').version")

# Update version in wizard banner
sed -i '' "s/Interactive CLI v[0-9]\+\.[0-9]\+\.[0-9]\+/Interactive CLI v$NEW_VERSION/g" tellet-wizard.js

# Commit changes
git add .
git commit -m "Release version $NEW_VERSION"

# Create tag
git tag -a "v$NEW_VERSION" -m "Release version $NEW_VERSION"

# Get current branch
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)

# Push changes
echo "📤 Pushing to remote..."
git push origin "$CURRENT_BRANCH"
git push origin "v$NEW_VERSION"

# Create GitHub release
echo ""
echo "📋 Creating GitHub release..."

# Check if gh CLI is installed
if command -v gh &> /dev/null; then
    # Generate release notes
    RELEASE_NOTES="## What's New in v$NEW_VERSION

### Installation
\`\`\`bash
# Install from GitHub
npm install -g git+https://github.com/telletai/tellet-admin-cli.git

# Or update existing installation
tellet-admin update
\`\`\`

### Changes
- Auto-generated release for version $NEW_VERSION
- See commit history for detailed changes

### Full Documentation
See the [README](https://github.com/telletai/tellet-admin-cli#readme) for usage instructions."

    # Create GitHub release using gh CLI
    gh release create "v$NEW_VERSION" \
        --title "Release v$NEW_VERSION" \
        --notes "$RELEASE_NOTES" \
        --target "$CURRENT_BRANCH"
    
    echo "✅ GitHub release created!"
else
    echo "⚠️  GitHub CLI (gh) not found. Please create release manually at:"
    echo "   https://github.com/telletai/tellet-admin-cli/releases/new"
    echo "   Tag: v$NEW_VERSION"
fi

echo ""
echo "✅ Released version $NEW_VERSION"
echo ""
echo "📢 Team members can update with:"
echo "   npm install -g git+https://github.com/telletai/tellet-admin-cli.git"
echo "   or"
echo "   tellet-admin update"
