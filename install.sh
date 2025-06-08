#!/bin/bash
#
# Tellet Admin CLI Installation Script
# This script installs or updates the Tellet Admin CLI tool
#

echo "🚀 Tellet Admin CLI Installer"
echo "============================"
echo ""

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ Error: npm is not installed."
    echo "   Please install Node.js and npm first:"
    echo "   https://nodejs.org/"
    exit 1
fi

# Check if already installed
if command -v tellet-admin &> /dev/null; then
    echo "📦 Tellet Admin CLI is already installed."
    CURRENT_VERSION=$(tellet-admin --version 2>/dev/null || echo "unknown")
    echo "   Current version: $CURRENT_VERSION"
    echo ""
    echo "Would you like to update to the latest version? (y/n)"
    read -r response
    if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
        echo "📥 Updating Tellet Admin CLI..."
        npm install -g git+https://github.com/telletai/tellet-admin-cli.git@latest
    else
        echo "✅ No changes made."
        exit 0
    fi
else
    echo "📥 Installing Tellet Admin CLI..."
    npm install -g git+https://github.com/telletai/tellet-admin-cli.git
fi

# Check if installation was successful
if command -v tellet-admin &> /dev/null; then
    echo ""
    echo "✅ Installation successful!"
    echo ""
    echo "🎉 You can now use the following commands:"
    echo "   tellet-wizard    - Launch the interactive wizard"
    echo "   tellet-admin     - Use the CLI directly"
    echo ""
    echo "📚 Getting started:"
    echo "   1. Run 'tellet-wizard' to launch the interactive mode"
    echo "   2. The wizard will guide you through setting up credentials"
    echo "   3. Choose from various operations like categorization, export, etc."
    echo ""
    echo "📖 For more information:"
    echo "   tellet-admin --help"
    echo ""
else
    echo ""
    echo "❌ Installation failed."
    echo "   You may need to run with sudo:"
    echo "   sudo npm install -g git+https://github.com/telletai/tellet-admin-cli.git"
    exit 1
fi