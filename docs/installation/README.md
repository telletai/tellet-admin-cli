# Installation Guide

This guide covers all installation methods for the Tellet Admin CLI tool.

## Prerequisites

- **Node.js**: Version 14.0.0 or higher
- **npm**: Version 6.0.0 or higher
- **Operating System**: Windows, macOS, or Linux

## Installation Methods

### 1. NPM Installation (Recommended)

The easiest way to install the Tellet Admin CLI is via npm:

```bash
# Install globally
npm install -g @tellet/admin-cli

# Verify installation
tellet-admin --version
```

See [NPM Installation Guide](npm.md) for detailed instructions.

### 2. GitHub Installation

For development or to get the latest unreleased features:

```bash
# Install from GitHub
npm install -g git+https://github.com/telletai/tellet-admin-cli.git

# Install specific branch
npm install -g git+https://github.com/telletai/tellet-admin-cli.git#branch-name
```

See [GitHub Installation Guide](github.md) for more details.

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
# Update via npm
npm update -g @tellet/admin-cli

# Check for updates
tellet-admin update
```

## Troubleshooting

Having issues? See our [Troubleshooting Guide](troubleshooting.md).

## Next Steps

- [Quick Start Guide](../guides/quick-start.md) - Get started with basic commands
- [Configuration Guide](../configuration/README.md) - Configure your environment
- [Interactive Wizard](../guides/wizard.md) - Use the wizard interface