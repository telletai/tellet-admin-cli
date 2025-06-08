#!/bin/bash
#
# Create GitHub release for current version
# Useful for creating initial release or fixing missing releases
#

# Get current version
CURRENT_VERSION=$(node -p "require('./package.json').version")
TAG_NAME="v$CURRENT_VERSION"

echo "🏷️  Creating GitHub release for version $CURRENT_VERSION..."

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
    echo "❌ GitHub CLI (gh) is not installed."
    echo "   Please install it first:"
    echo "   - macOS: brew install gh"
    echo "   - Other: https://cli.github.com/"
    exit 1
fi

# Check if authenticated
if ! gh auth status &> /dev/null; then
    echo "🔐 Please authenticate with GitHub first:"
    gh auth login
fi

# Check if tag exists
if ! git rev-parse "$TAG_NAME" &> /dev/null 2>&1; then
    echo "⚠️  Tag $TAG_NAME doesn't exist. Creating it..."
    git tag -a "$TAG_NAME" -m "Release version $CURRENT_VERSION"
    git push origin "$TAG_NAME"
fi

# Generate release notes
RELEASE_NOTES="## Tellet Admin CLI v$CURRENT_VERSION

### 🚀 Installation

\`\`\`bash
# Install globally from GitHub
npm install -g git+https://github.com/telletai/tellet-admin-cli.git

# Or clone and install locally
git clone https://github.com/telletai/tellet-admin-cli.git
cd tellet-admin-cli
npm install
\`\`\`

### 🔄 Updating

The tool includes automatic update checking:

\`\`\`bash
# Check for updates
tellet-admin update

# Manual update
npm install -g git+https://github.com/telletai/tellet-admin-cli.git@latest
\`\`\`

### 📋 Features

- 🧙 **Interactive Wizard Mode** - User-friendly guided interface
- 🤖 **Auto-categorization** - AI-powered category generation
- 📥 **Data Export** - Export conversations and metadata
- 🎬 **Media Download** - Download audio, video, and images
- 🏥 **Health Check** - Analyze project health
- 📊 **Usage Analytics** - Generate comprehensive usage reports for organizations, workspaces, and projects
- 👥 **Bulk User Management** - Invite multiple users from CSV
- 🔍 **API Testing** - Test Tellet API endpoints

### 📖 Documentation

See the full [README](https://github.com/telletai/tellet-admin-cli#readme) for detailed usage instructions.

### 🛠️ Requirements

- Node.js >= 14.0.0
- Valid Tellet account
- Project access permissions"

# Check if release already exists
if gh release view "$TAG_NAME" &> /dev/null; then
    echo "⚠️  Release $TAG_NAME already exists."
    echo -n "Do you want to delete and recreate it? (y/N) "
    read -r response
    if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
        gh release delete "$TAG_NAME" --yes
        echo "🗑️  Deleted existing release"
    else
        echo "❌ Aborted"
        exit 1
    fi
fi

# Create GitHub release
echo "📋 Creating GitHub release..."
gh release create "$TAG_NAME" \
    --title "Tellet Admin CLI v$CURRENT_VERSION" \
    --notes "$RELEASE_NOTES" \
    --target main

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ GitHub release created successfully!"
    echo "🔗 View at: https://github.com/telletai/tellet-admin-cli/releases/tag/$TAG_NAME"
    echo ""
    echo "📢 Users can now update with:"
    echo "   tellet-admin update"
else
    echo "❌ Failed to create release"
    exit 1
fi