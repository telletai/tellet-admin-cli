# Installing Tellet Admin CLI

## Installation

Install the Tellet Admin CLI from npm:

```bash
# Install globally (recommended)
npm install -g @tellet/admin-cli

# Or install a specific version
npm install -g @tellet/admin-cli@3.0.0
```

For development or latest features from GitHub:
```bash
npm install -g git+https://github.com/telletai/tellet-admin-cli.git
```

## Updating

To update to the latest version:

```bash
# Using the built-in updater
tellet-admin update

# Or manually with npm
npm update -g git+https://github.com/telletai/tellet-admin-cli.git

# Or reinstall
npm uninstall -g tellet-admin-cli
npm install -g git+https://github.com/telletai/tellet-admin-cli.git
```

## Quick Start

After installation:

```bash
# Launch the interactive wizard
tellet-wizard

# Or use the CLI directly
tellet-admin --help
```
