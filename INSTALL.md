# Installing Tellet Admin CLI

## Installation Methods

### Method 1: Using Install Script (Recommended)

The easiest way to install is using our install script:

**macOS/Linux:**
```bash
curl -fsSL https://raw.githubusercontent.com/telletai/tellet-admin-cli/main/install.sh | bash
```

**Windows:**
```cmd
# Download install.cmd from the repository and run it
# Or use PowerShell:
powershell -Command "Invoke-WebRequest -Uri https://raw.githubusercontent.com/telletai/tellet-admin-cli/main/install.cmd -OutFile install.cmd; .\install.cmd"
```

### Method 2: Direct Installation from GitHub

```bash
# Install latest version (recommended)
npm install -g git+https://github.com/telletai/tellet-admin-cli.git

# Install a specific version/tag
npm install -g git+https://github.com/telletai/tellet-admin-cli.git#v3.0.2

# Install from a specific branch
npm install -g git+https://github.com/telletai/tellet-admin-cli.git#main
```

## Updating

### Option 1: Using the Install Script
```bash
# The install script will detect existing installation and offer to update
curl -fsSL https://raw.githubusercontent.com/telletai/tellet-admin-cli/main/install.sh | bash
```

### Option 2: Using Built-in Updater
```bash
tellet-admin update
```

### Option 3: Manual Update
```bash
# Update to latest version
npm update -g git+https://github.com/telletai/tellet-admin-cli.git

# Or reinstall (more reliable)
npm uninstall -g tellet-admin-cli
npm install -g git+https://github.com/telletai/tellet-admin-cli.git
```

## Verifying Installation

```bash
# Check if installed
tellet-admin --version

# Should output: 3.0.2 (or current version)
```

## Quick Start

After installation:

```bash
# Launch the interactive wizard
tellet-wizard

# Or use the CLI directly
tellet-admin --help
```
