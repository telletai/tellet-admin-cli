# Installation Guide

This guide covers all installation methods for the Tellet Admin CLI tool.

## Prerequisites

- **Node.js**: Version 14.0.0 or higher
- **npm**: Version 6.0.0 or higher
- **Operating System**: Windows, macOS, or Linux

## Installation Methods

### 1. Install Script (Recommended)

The easiest way to install is using our automated install script:

**macOS/Linux:**
```bash
curl -fsSL https://raw.githubusercontent.com/telletai/tellet-admin-cli/main/install.sh | bash
```

**Windows:**
```cmd
# Download and run install.cmd
curl -o install.cmd https://raw.githubusercontent.com/telletai/tellet-admin-cli/main/install.cmd
install.cmd
```

The script will:
- Check for Node.js/npm prerequisites
- Install or update the CLI tool
- Verify the installation
- Provide next steps

### 2. Direct GitHub Installation

Install directly from our GitHub repository:

```bash
# Install latest version
npm install -g git+https://github.com/telletai/tellet-admin-cli.git

# Install specific version
npm install -g git+https://github.com/telletai/tellet-admin-cli.git#v3.0.2

# Install from branch
npm install -g git+https://github.com/telletai/tellet-admin-cli.git#main
```

## Post-Installation Setup

### 1. Verify Installation

```bash
# Check version
tellet-admin --version

# View help
tellet-admin --help

# Launch wizard
tellet-wizard
```

### 2. Configure Credentials

Create a `.env` file in your working directory:

```bash
# Create .env file
echo "TELLET_EMAIL=your-email@example.com" > .env
echo "TELLET_PASSWORD=your-password" >> .env
```

Or use environment variables:

```bash
export TELLET_EMAIL=your-email@example.com
export TELLET_PASSWORD=your-password
```

### 3. Test Connection

```bash
# Test API connection
tellet-admin test-api

# List organizations
tellet-admin list-orgs
```

## Platform-Specific Instructions

- **Windows**: Special considerations for Windows users
- **macOS**: Handling permissions on macOS
- **Linux**: Distribution-specific notes

## Updating

To update to the latest version:

```bash
# Method 1: Run install script again
curl -fsSL https://raw.githubusercontent.com/telletai/tellet-admin-cli/main/install.sh | bash

# Method 2: Built-in updater
tellet-admin update

# Method 3: npm update from GitHub
npm update -g git+https://github.com/telletai/tellet-admin-cli.git
```

## Troubleshooting

Having issues? See our [Troubleshooting Guide](troubleshooting.md).

## Next Steps

- [Quick Start Guide](../guides/quick-start.md) - Get started with basic commands
- [Configuration Guide](../configuration/README.md) - Configure your environment
- [Interactive Wizard](../guides/wizard.md) - Use the wizard interface