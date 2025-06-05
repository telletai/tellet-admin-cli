#!/bin/bash
#
# Setup script for Tellet Admin CLI in new repository
# This script helps set up the tellet-admin-cli in its own repository
#

echo "🚀 Tellet Admin CLI Repository Setup"
echo "===================================="
echo ""

# Check if we're in the tellet-admin-cli directory
if [ ! -f "package.json" ] || [ ! -f "tellet-admin-tool.js" ]; then
    echo "❌ Error: This script must be run from the tellet-admin-cli directory"
    exit 1
fi

# Get repository URL from user
echo "📝 Please enter your new repository details:"
read -p "GitHub organization/username: " GITHUB_ORG
read -p "Repository name (default: tellet-admin-cli): " REPO_NAME
REPO_NAME=${REPO_NAME:-tellet-admin-cli}

REPO_URL="https://github.com/$GITHUB_ORG/$REPO_NAME"
GIT_URL="git@github.com:$GITHUB_ORG/$REPO_NAME.git"

echo ""
echo "📦 Repository URL: $REPO_URL"
echo ""

# Update package.json
echo "📝 Updating package.json..."
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    sed -i '' "s|\"url\": \"git+https://github.com/tellet/tellet-admin-cli.git\"|\"url\": \"git+$REPO_URL.git\"|g" package.json
    sed -i '' "s|\"url\": \"https://github.com/tellet/tellet-admin-cli/issues\"|\"url\": \"$REPO_URL/issues\"|g" package.json
    sed -i '' "s|\"homepage\": \"https://github.com/tellet/tellet-admin-cli#readme\"|\"homepage\": \"$REPO_URL#readme\"|g" package.json
else
    # Linux
    sed -i "s|\"url\": \"git+https://github.com/tellet/tellet-admin-cli.git\"|\"url\": \"git+$REPO_URL.git\"|g" package.json
    sed -i "s|\"url\": \"https://github.com/tellet/tellet-admin-cli/issues\"|\"url\": \"$REPO_URL/issues\"|g" package.json
    sed -i "s|\"homepage\": \"https://github.com/tellet/tellet-admin-cli#readme\"|\"homepage\": \"$REPO_URL#readme\"|g" package.json
fi

# Update the update checker configuration
echo "📝 Configuring update checker..."
if [ -f "update-checker-git.js" ]; then
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s|https://github.com/YOUR-ORG/tellet-admin-cli|$REPO_URL|g" update-checker-git.js
    else
        sed -i "s|https://github.com/YOUR-ORG/tellet-admin-cli|$REPO_URL|g" update-checker-git.js
    fi
    
    # Replace the standard update-checker with git version
    mv update-checker.js update-checker-npm.js
    mv update-checker-git.js update-checker.js
fi

# Initialize git if not already initialized
if [ ! -d ".git" ]; then
    echo "📁 Initializing Git repository..."
    git init
    git add .
    git commit -m "Initial commit: Tellet Admin CLI v2.5.1"
fi

# Add remote
echo "🔗 Adding remote repository..."
git remote remove origin 2>/dev/null || true
git remote add origin $GIT_URL

# Create initial tag
CURRENT_VERSION=$(node -p "require('./package.json').version")
echo "🏷️  Creating version tag v$CURRENT_VERSION..."
git tag -a "v$CURRENT_VERSION" -m "Release version $CURRENT_VERSION" 2>/dev/null || true

# Create distribution instructions
echo "📄 Creating distribution instructions..."
cat > INSTALL.md << EOF
# Installing Tellet Admin CLI

## For Team Members

Install the Tellet Admin CLI directly from our Git repository:

\`\`\`bash
# Install globally (recommended)
npm install -g git+$REPO_URL.git

# Or install a specific version
npm install -g git+$REPO_URL.git#v$CURRENT_VERSION
\`\`\`

## Updating

To update to the latest version:

\`\`\`bash
# Using the built-in updater
tellet-admin update

# Or manually with npm
npm update -g @tellet/admin-cli

# Or reinstall
npm uninstall -g @tellet/admin-cli
npm install -g git+$REPO_URL.git
\`\`\`

## Quick Start

After installation:

\`\`\`bash
# Launch the interactive wizard
tellet-wizard

# Or use the CLI directly
tellet-admin --help
\`\`\`
EOF

# Create release script
echo "📄 Creating release script..."
cat > release.sh << 'EOF'
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

# Push changes
echo "📤 Pushing to remote..."
git push origin main
git push origin "v$NEW_VERSION"

echo ""
echo "✅ Released version $NEW_VERSION"
echo ""
echo "📢 Team members can update with:"
echo "   npm update -g @tellet/admin-cli"
echo "   or"
echo "   tellet-admin update"
EOF

chmod +x release.sh

echo ""
echo "✅ Setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Create the repository on GitHub: $REPO_URL"
echo "2. Push your code:"
echo "   git push -u origin main"
echo "   git push origin v$CURRENT_VERSION"
echo ""
echo "3. Share installation instructions with your team:"
echo "   npm install -g git+$REPO_URL.git"
echo ""
echo "📄 Files created:"
echo "   - INSTALL.md (installation instructions for team)"
echo "   - release.sh (script for creating new releases)"
echo ""
echo "🔄 To create a new release in the future:"
echo "   ./release.sh patch  # or minor/major"